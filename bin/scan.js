import { resolve } from 'node:path';
import { failure } from '../src/detection.js';
import {
  decodeTextInput,
  listTextCandidates,
  readFileBytes,
} from '../src/files.js';
import { openScanBaseline } from './scan-baseline.js';
import { publishReport } from './scan-report.js';

const maxFiles = 10000;
const inputErrors = new Set([
  'ERR_BINARY',
  'ERR_ENCODING',
  'ERR_LIMIT',
  'ERR_GIT_ENTRY',
]);

export async function readStdinBytes(stream, maxBytes) {
  const chunks = [];
  let size = 0;
  for await (const chunk of stream) {
    const buffer = Buffer.from(chunk);
    size += buffer.length;
    if (size > maxBytes) {
      throw failure('ERR_LIMIT');
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks, size);
}

async function scanFiles(config, stdin) {
  if (config.staged || config.respectGitignore) {
    const { gitScanFiles } = await import('./git-scan.js');
    return gitScanFiles(config);
  }
  if (config.path === '-') {
    return [
      {
        path: '-',
        stdin: true,
        read: (maxBytes) => readStdinBytes(stdin, maxBytes),
      },
    ];
  }
  const files = new Map();
  for (const root of config.paths) {
    for (const path of await listTextCandidates(root, maxFiles)) {
      const key = resolve(path);
      if (!files.has(key)) {
        files.set(key, {
          path,
          read: (maxBytes) => readFileBytes(path, maxBytes),
        });
      }
      if (files.size > maxFiles) {
        throw failure('ERR_LIMIT');
      }
    }
  }
  return files.values();
}

async function* scanInputs(file, config, archive) {
  let bytes;
  try {
    bytes = await file.read(config.maxBytes);
  } catch (error) {
    if (!inputErrors.has(error.code)) {
      throw error;
    }
    yield { path: [file.path], reason: error.code };
    return;
  }
  if (archive) {
    yield* archive(file.path, bytes, config);
  } else {
    yield { path: [file.path], bytes };
  }
}

async function inspectInput(input, context, location) {
  const { config, engine, baseline, report } = context;
  const path = (await engine.sanitize(input.path.join('!'))).text;
  if (input.reason) {
    report.skipped.push({ path, reason: input.reason });
    return;
  }
  let text;
  try {
    ({ text } = decodeTextInput(input.bytes, {
      lossless: config.lossless,
      allowBinary: Boolean(config.allowBinary),
    }));
  } catch (error) {
    if (!inputErrors.has(error.code)) {
      throw error;
    }
    report.skipped.push({ path, reason: error.code });
    return;
  }
  let findings = await engine.inspect(text);
  if (baseline) {
    const total = findings.length;
    findings = baseline.filter(
      [...location, ...input.path.slice(1)],
      text,
      findings
    );
    report.baselined += total - findings.length;
  }
  report.results.push({ path, findings });
}

export async function scanCommand(config, engine, { stdin, stdout }, version) {
  const baseline = await openScanBaseline(config);
  const archive = config.archiveDepth
    ? (await import('./scan-archives.js')).scanArchive
    : undefined;
  const report = {
    complete: true,
    results: [],
    skipped: [],
    ...(baseline ? { baselined: 0 } : {}),
  };
  const context = { config, engine, baseline, report };
  for (const file of await scanFiles(config, stdin)) {
    const location = await baseline?.location(file);
    for await (const input of scanInputs(file, config, archive)) {
      await inspectInput(input, context, location);
    }
  }
  report.complete = report.skipped.length === 0;
  if (report.complete) {
    await baseline?.save();
  }
  await publishReport(report, config, stdout, version);
  return !report.complete
    ? 2
    : report.results.some((r) => r.findings.length)
      ? 1
      : 0;
}
