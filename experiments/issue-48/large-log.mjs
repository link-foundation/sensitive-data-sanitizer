// Adapted from the finite upstream issue-47 reproduction. Run sequentially:
// node --max-old-space-size=128 experiments/issue-48/large-log.mjs [16..80]
// Children have finite heaps/stacks; fixtures are removed after verification.
import assert from 'node:assert/strict';
import { open, mkdtemp, rm, stat, readFile } from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { spawn } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';

const mib = Number(process.argv[2] ?? 80);
assert(Number.isSafeInteger(mib) && mib >= 16 && mib <= 80);
const directory = await mkdtemp(join(tmpdir(), 'sanitizer-issue-48-'));
const cli = fileURLToPath(
  new URL('../../bin/sensitive-data-sanitizer.js', import.meta.url)
);
const source = join(directory, 'input.log');
const prompt =
  'use: curl -L -H \\"Authorization: token $(gh auth token)\\" -o <filename> <url>\\n';
const ordinary =
  'INFO ordinary output line with http://127.0.0.1:34271/session and konard@example.com\n';
const token = 'a'.repeat(200 * 1024);
const terminal = `ghp_${'x'.repeat(36)}`;

async function generate() {
  const handle = await open(source, 'wx', 0o600);
  try {
    await handle.writeFile(
      '🧠 endpoint http://172.18.0.2:8080/api/openai/v1\n'
    );
    await handle.writeFile(
      `{"bodyPreview":"{\\"messages\\":[{\\"content\\":\\"${prompt.repeat(Math.floor((15 * 1024 * 1024) / prompt.length))}\\"}]}"}\n`
    );
    await handle.writeFile(`Authorization: Bearer ${token} tail\n`);
    // Include NUL and invalid UTF-8 in addition to the original reproduction.
    await handle.writeFile(Buffer.from([0x62, 0x61, 0x64, 0, 0xff, 0xfe, 10]));
    for (
      let written = 16 * 1024 * 1024;
      written < mib * 1024 * 1024;
      written += ordinary.length * 1000
    ) {
      await handle.writeFile(ordinary.repeat(1000));
    }
    await handle.writeFile(`token ${terminal} end\n`);
  } finally {
    await handle.close();
  }
}
async function verify(path) {
  const hash = createHash('sha256');
  let tail = Buffer.alloc(0),
    foundBytes = false,
    foundHeader = false;
  for await (const chunk of createReadStream(path)) {
    hash.update(chunk);
    const view = Buffer.concat([tail, chunk]);
    assert(!view.includes(token));
    assert(!view.includes(terminal));
    foundBytes ||= view.includes(
      Buffer.from([0x62, 0x61, 0x64, 0, 0xff, 0xfe, 10])
    );
    foundHeader ||= view.includes(
      Buffer.from('Authorization: [REDACTED] tail\n')
    );
    tail = view.subarray(-token.length);
  }
  assert(foundBytes && foundHeader);
  assert(tail.toString().endsWith('token [REDACTED] end\n'));
  return hash.digest('hex');
}
async function run(stdin) {
  const output = join(directory, stdin ? 'stdin.log' : 'file.log');
  const started = performance.now();
  const child = spawn(
    process.execPath,
    [
      '--max-old-space-size=256',
      '--stack-size=4096',
      cli,
      'redact',
      stdin ? '-' : source,
      '--stream',
      '--credentials-only',
      '--allow-binary',
      '--output',
      output,
    ],
    { stdio: ['pipe', 'ignore', 'pipe'] }
  );
  const errors = join(directory, 'stderr.log');
  const errorLog = pipeline(child.stderr, createWriteStream(errors));
  const completed = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code) => resolve(code));
  });
  if (stdin) {
    await pipeline(createReadStream(source), child.stdin);
  } else {
    child.stdin.end();
  }
  const status = await completed;
  await errorLog;
  const elapsedMs = performance.now() - started;
  assert.equal(status, 0, `CLI failed: ${await readFile(errors, 'utf8')}`);
  const digest = await verify(output);
  const inputBytes = (await stat(source)).size;
  const outputBytes = (await stat(output)).size;
  assert.equal(
    outputBytes,
    inputBytes -
      `Bearer ${token}`.length -
      terminal.length +
      2 * '[REDACTED]'.length
  );
  console.log(
    JSON.stringify({
      mode: stdin ? 'stdin' : 'file',
      inputBytes,
      outputBytes,
      elapsedMs,
      mibPerSecond: inputBytes / 1024 / 1024 / (elapsedMs / 1000),
      digest,
    })
  );
  return digest;
}
try {
  await generate();
  assert.equal(await run(false), await run(true));
} finally {
  await rm(directory, { recursive: true, force: true });
}
