// Finite log benchmark. Run with node --max-old-space-size=256 --stack-size=4096.
import { performance } from 'node:perf_hooks';
const started = performance.now();
const { createSanitizer, sanitizeStream } = await import('../../src/index.js');
console.log(
  JSON.stringify({ event: 'import', ms: performance.now() - started })
);
const kind = process.argv[2] ?? 'ordinary';
const mib = Number(process.argv[3] ?? 2);
if (!Number.isSafeInteger(mib) || mib < 1 || mib > 80) {
  throw Error('1–80 MiB only');
}
const ordinary =
  'INFO ordinary output line with http://127.0.0.1:34271/session and konard@example.com\n';
const prompt =
  'use: curl -L -H \\"Authorization: token $(gh auth token)\\" -o <filename> <url>\\n';
const unit = kind === 'escaped' ? prompt : ordinary;
const text = unit.repeat(Math.floor((mib * 1024 * 1024) / unit.length));
const engine = createSanitizer({ credentialsOnly: true });
const start = performance.now();
let outputBytes = 0;
async function* source() {
  for (let i = 0; i < text.length; i += 65536) {
    yield Buffer.from(text.slice(i, i + 65536));
  }
}
for await (const chunk of sanitizeStream(source(), { sanitizer: engine })) {
  outputBytes += Buffer.byteLength(chunk);
}
const ms = performance.now() - start;
console.log(
  JSON.stringify({
    event: 'stream',
    kind,
    inputBytes: text.length,
    outputBytes,
    ms,
    mibPerSecond: mib / (ms / 1000),
    maxRssKb: process.resourceUsage().maxRSS,
  })
);
