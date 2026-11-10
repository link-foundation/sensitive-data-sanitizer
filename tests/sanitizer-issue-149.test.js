import { describe, it, expect } from 'test-anywhere';
import { Buffer } from 'node:buffer';
import {
  createSyncSanitizer,
  createSanitizer,
  inspect,
} from '../src/credentials-entry.js';
import { sanitizeStream } from '../src/index.js';

const OPTIONS = {
  credentialsOnly: true,
  preserveEncoding: true,
  secretlint: false,
  transformation: { mode: 'hive-mask' },
};
const SECRET = ['gho_', 'SYNTHETIC0000NotARealToken11111111111'].join('');
const wrap = (bytes, width = 76, newline = '\n') =>
  bytes
    .toString('base64')
    .match(new RegExp(`.{1,${width}}`, 'g'))
    .join(newline);
const sanitize = (text, options = {}) =>
  createSyncSanitizer({ ...OPTIONS, ...options }).sanitize(text).text;
async function stream(text) {
  const chunks = [];
  for (let i = 0; i < text.length; i += 77) {
    chunks.push(text.slice(i, i + 77));
  }
  let result = '';
  for await (const chunk of sanitizeStream(chunks, {
    ...OPTIONS,
    batchBytes: 128,
  })) {
    result += chunk;
  }
  return result;
}

describe('wrapped base64 publication (issue 149)', () => {
  for (const newline of ['\n', '\r\n']) {
    it(`preserves the complete harmless binary payload with ${JSON.stringify(newline)}`, async () => {
      const bytes = Buffer.alloc(150000, 147);
      const text = wrap(bytes, 76, newline) + newline;
      expect(inspect(text)).toEqual([]);
      expect(sanitize(text)).toBe(text);
      expect((await createSanitizer(OPTIONS).sanitize(text)).text).toBe(text);
      expect(await stream(text)).toBe(text);
      const flat = JSON.stringify({ image: bytes.toString('base64') });
      expect(sanitize(flat)).toBe(flat);
    });

    it(`keeps prose, JSON fields and wrapping after body= with ${JSON.stringify(newline)}`, async () => {
      const document = JSON.stringify({ token: SECRET, note: 'keep me' });
      const body = wrap(Buffer.from(document), 20, newline);
      const prefix = `start of output${newline}response body=${newline}`;
      const suffix = `${newline}trailing line${newline}`;
      const input = prefix + body + suffix;
      const expectedBody = sanitize(body);
      const findings = inspect(input);
      expect(findings.map((f) => [f.rule, f.start, f.end])).toEqual([
        ['encoded', prefix.length, prefix.length + body.length],
      ]);
      for (const output of [
        sanitize(input),
        (await createSanitizer(OPTIONS).sanitize(input)).text,
        await stream(input),
      ]) {
        expect(output).toBe(prefix + expectedBody + suffix);
        const encoded = output.slice(prefix.length, -suffix.length);
        expect(
          encoded
            .split(newline)
            .slice(0, -1)
            .every((line) => line.length === 20)
        ).toBe(true);
        expect(JSON.parse(Buffer.from(encoded, 'base64').toString())).toEqual({
          token: 'gho…111',
          note: 'keep me',
        });
      }
    });
  }

  it('fails closed for text with credentials beyond the bounded probe', () => {
    const body = wrap(
      Buffer.from(`${'ordinary '.repeat(1500)}password=${SECRET}`)
    );
    expect(inspect(body).map((f) => f.rule)).toEqual(['encoded-limit']);
    expect(sanitize(body).includes(body)).toBe(false);
  });

  it('detects credentials in text embedded after invalid UTF-8 bytes', () => {
    const body = wrap(
      Buffer.concat([
        Buffer.alloc(9000, 147),
        Buffer.from(`\npassword=${SECRET}\n`),
      ])
    );
    expect(inspect(body).some((f) => f.rule === 'encoded')).toBe(true);
    expect(sanitize(body).includes(body)).toBe(false);
  });

  it('fails closed for oversized nested text inside a bounded binary payload', () => {
    const nested = Buffer.from(
      `${'ordinary '.repeat(1500)}password=${SECRET}`
    ).toString('base64');
    const body = wrap(
      Buffer.concat([Buffer.alloc(9000, 147), Buffer.from(`\n${nested}\n`)])
    );
    expect(inspect(body).some((f) => f.rule === 'encoded-limit')).toBe(true);
    expect(sanitize(body).includes(body)).toBe(false);
  });

  it('fails closed for binary runs beyond the full classification bound', () => {
    const body = wrap(Buffer.alloc(200000, 147));
    expect(body.length > 256 * 1024).toBe(true);
    expect(inspect(body).map((f) => f.rule)).toEqual(['encoded-limit']);
    expect(sanitize(body).includes(body)).toBe(false);
  });

  it('retains plaintext and exact-known-secret detection around inspected binary', () => {
    const bytes = Buffer.alloc(9000, 147);
    for (let i = 0; i < 57; i++) {
      bytes[i] = i;
    }
    const body = wrap(bytes);
    const known = body.split('\n')[0];
    const input = `${body}\npassword=${SECRET}\n`;
    const output = sanitize(input, { knownSecrets: [known] });
    expect(output.includes(known)).toBe(false);
    expect(output.includes(SECRET)).toBe(false);
    expect(output.endsWith('\npassword=gho…111\n')).toBe(true);
  });
});
