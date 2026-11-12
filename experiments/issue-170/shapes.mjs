// Sanitizes one long single-line run of each shape in both modes and through
// sanitizeFileToFile (issue 170). Usage: node shapes.mjs [MiB] [mode]
import { performance } from 'node:perf_hooks';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSanitizer, sanitizeFileToFile } from '../../src/index.js';
const mib = Number(process.argv[2] ?? 10);
const modes = process.argv[3]
  ? [process.argv[3]]
  : ['credentials', 'default', 'file'];
const size = mib * 1024 * 1024;
const shapes = {
  A: 'A',
  Ab: 'Ab',
  aB: 'aB',
  A1: 'A1',
  Ae: 'Aé',
  A_: 'A_',
  'a-': 'a-',
  'a.': 'a.',
  base64: randomBytes(Math.ceil((size * 3) / 4))
    .toString('base64')
    .slice(0, size),
};
const tail = '\npassword=xx-private-value\n';
const dir = mkdtempSync(join(tmpdir(), 'issue-170-'));
for (const mode of modes) {
  const sanitizer = createSanitizer({
    credentialsOnly: mode === 'credentials',
    maxInputLength: 64 * 1024 * 1024,
  });
  for (const [name, unit] of Object.entries(shapes)) {
    const text =
      unit.repeat(Math.ceil(size / unit.length)).slice(0, size) + tail;
    const t = performance.now();
    let result;
    try {
      if (mode === 'file') {
        const input = join(dir, 'in.log');
        const output = join(dir, 'out.log');
        writeFileSync(input, text);
        await sanitizeFileToFile(input, output, {
          maxInputLength: 64 * 1024 * 1024,
        });
        result = readFileSync(output, 'utf8').includes('xx-private-value')
          ? 'LEAK'
          : 'ok';
      } else {
        const r = await sanitizer.sanitize(text);
        result = r.text.includes('xx-private-value')
          ? 'LEAK'
          : `ok ${r.redactions}`;
      }
    } catch (error) {
      result = `${error.code} ${error.message}`;
    }
    console.log(mode, name, result, Math.round(performance.now() - t), 'ms');
  }
}
rmSync(dir, { recursive: true, force: true });
