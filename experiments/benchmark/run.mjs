/** Finite full-span comparison; competitors never receive live credentials. */
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, writeFile, readFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import { corpus } from './corpus.mjs';
import { createSanitizer } from '../../src/index.js';

const directory = await mkdtemp(join(tmpdir(), 'sanitizer-benchmark-'));
const python = process.env.BENCHMARK_PYTHON ?? 'python3';
const gitleaks = process.env.BENCHMARK_GITLEAKS ?? 'gitleaks';
const trufflehog = process.env.BENCHMARK_TRUFFLEHOG ?? 'trufflehog';
const output = process.argv[2] ?? 'experiments/benchmark/results.json';
const engine = createSanitizer();
const predictions = {};
const cp = (text, position) =>
  Array.from(text).slice(0, position).join('').length;
function occurrences(text, value) {
  const ranges = [];
  let cursor = 0;
  while (value && (cursor = text.indexOf(value, cursor)) >= 0) {
    ranges.push({ start: cursor, end: cursor + value.length });
    cursor += value.length;
  }
  return ranges;
}
try {
  verifyVersion(gitleaks, ['version'], '8.30.1');
  verifyVersion(trufflehog, ['--version'], '3.99.0');
  const foreign = JSON.parse(
    execFileSync(python, ['experiments/benchmark/python-bridge.py'], {
      input: JSON.stringify(corpus),
      maxBuffer: 8 * 1024 * 1024,
      stdio: ['pipe', 'pipe', 'inherit'],
    })
  );
  for (let i = 0; i < corpus.length; i++) {
    await writeFile(join(directory, `case-${i}.txt`), corpus[i].text);
    predictions[corpus[i].id] = {
      sanitizer: await engine.inspect(corpus[i].text),
      gitleaks: [],
      trufflehog: [],
      ...Object.fromEntries(
        Object.entries(foreign[corpus[i].id]).map(([name, spans]) => [
          name,
          spans.map((f) => ({
            start: cp(corpus[i].text, f.start),
            end: cp(corpus[i].text, f.end),
          })),
        ])
      ),
    };
  }
  const report = join(directory, 'gitleaks.json');
  execFileSync(
    gitleaks,
    [
      'dir',
      directory,
      '--no-banner',
      '--redact=0',
      '--exit-code=0',
      '--report-format=json',
      `--report-path=${report}`,
    ],
    { stdio: ['ignore', 'ignore', 'inherit'] }
  );
  for (const finding of JSON.parse(await readFile(report, 'utf8'))) {
    const i = Number(/case-(\d+)\.txt$/.exec(finding.File)?.[1]);
    if (Number.isInteger(i)) {
      predictions[corpus[i].id].gitleaks.push(
        ...occurrences(corpus[i].text, finding.Secret)
      );
    }
  }
  await rm(report);
  const raw = execFileSync(
    trufflehog,
    [
      'filesystem',
      directory,
      '--json',
      '--no-verification',
      '--no-update',
      '--concurrency=2',
      '--fail-on-scan-errors',
    ],
    { maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'inherit'] }
  ).toString();
  for (const line of raw.trim().split('\n').filter(Boolean)) {
    const finding = JSON.parse(line);
    const i = Number(
      /case-(\d+)\.txt$/.exec(
        finding.SourceMetadata?.Data?.Filesystem?.file
      )?.[1]
    );
    if (Number.isInteger(i)) {
      predictions[corpus[i].id].trufflehog.push(
        ...occurrences(corpus[i].text, finding.RawV2 || finding.Raw)
      );
    }
  }
  const metrics = {};
  for (const name of Object.keys(predictions[corpus[0].id])) {
    let detected = 0,
      partial = 0,
      missed = 0,
      truePredictions = 0,
      falsePredictions = 0;
    for (const c of corpus) {
      const ranges = [
        ...new Map(
          predictions[c.id][name].map((f) => [`${f.start}:${f.end}`, f])
        ).values(),
      ];
      for (const truth of c.spans) {
        const union = ranges
          .filter((f) => f.start < truth.end && f.end > truth.start)
          .sort((a, b) => a.start - b.start);
        const end = coverageEnd(union, truth.start);
        if (end >= truth.end) {
          detected++;
        } else if (union.length) {
          partial++;
        } else {
          missed++;
        }
      }
      for (const f of ranges) {
        if (c.spans.some((t) => f.start < t.end && f.end > t.start)) {
          truePredictions++;
        } else {
          falsePredictions++;
        }
      }
    }
    metrics[name] = {
      detected,
      partial,
      missed,
      falsePredictions,
      recall: detected / (detected + partial + missed),
      precision: truePredictions / (truePredictions + falsePredictions) || 0,
    };
  }
  const serializedCorpus = `${JSON.stringify(corpus, null, 2)}\n`;
  await writeCorpus(dirname(output));
  for (const name of Object.keys(metrics)) {
    await writeFile(
      join(dirname(output), `predictions-${name}.json`),
      `${JSON.stringify(
        Object.fromEntries(
          corpus.map((c) => [
            c.id,
            predictions[c.id][name].map((f) => ({
              start: f.start,
              end: f.end,
            })),
          ])
        ),
        null,
        2
      )}\n`
    );
  }
  await writeFile(
    output,
    `${JSON.stringify(
      {
        corpusVersion: 2,
        corpusSha256: createHash('sha256')
          .update(serializedCorpus)
          .digest('hex'),
        sourceSha256: await sourceHash(),
        cases: corpus.length,
        entities: corpus.reduce((n, c) => n + c.spans.length, 0),
        versions: {
          sanitizer: 'review implementation',
          gitleaks: '8.30.1',
          trufflehog: '3.99.0',
          'detect-secrets': '1.5.0',
          presidio: '2.2.364',
          spacy: '3.8.16 / en_core_web_sm 3.8.0',
          scrubadub: '2.0.1',
        },
        metrics,
      },
      null,
      2
    )}\n`
  );
  console.log(JSON.stringify(metrics, null, 2));
} finally {
  await rm(directory, { recursive: true, force: true });
}

function coverageEnd(ranges, start) {
  let end = start;
  for (const range of ranges) {
    if (range.start <= end) {
      end = Math.max(end, range.end);
    }
  }
  return end;
}
function verifyVersion(command, args, version) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    maxBuffer: 65536,
  });
  if (
    result.status !== 0 ||
    !`${result.stdout}${result.stderr}`.includes(version)
  ) {
    throw new Error('Install the pinned benchmark binary version.');
  }
}
async function writeCorpus(directory) {
  for (const entry of await readdir(directory)) {
    if (/^corpus(?:-\d+)?\.json$/.test(entry)) {
      await rm(join(directory, entry));
    }
  }
  for (let start = 0; start < corpus.length; start += 80) {
    await writeFile(
      join(directory, `corpus-${start / 80 + 1}.json`),
      `${JSON.stringify(corpus.slice(start, start + 80), null, 2)}\n`
    );
  }
}
async function sourceHash() {
  const hash = createHash('sha256');
  for (const entry of (await readdir('src', { recursive: true })).sort()) {
    if (!/\.(js|json)$/.test(entry)) {
      continue;
    }
    hash.update(entry).update(await readFile(join('src', entry)));
  }
  hash.update(await readFile('package-lock.json'));
  return hash.digest('hex');
}
