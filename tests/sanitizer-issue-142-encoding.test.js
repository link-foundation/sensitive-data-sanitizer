import { describe, it, expect } from 'test-anywhere';
import { Buffer } from 'node:buffer';
import {
  createSanitizer,
  createSyncSanitizer,
  inspect,
  redact,
  sanitizeStream,
} from '../src/index.js';

import * as credentials from '../src/credentials-entry.js';
import { createRequire } from 'node:module';
import { decodedRuns } from '../src/encoded.js';

// Synthetic values, assembled at run time so secret scanners skip the source.
const GH = ['ghp_', 'Zx9Qw7Er5Ty3Ui1Op0As', '2Df4Gh6Jk8Lz0Xc2Vb4N'].join('');
const KNOWN = ['Pk7Rm2Qx', '9LwZaB8yCd4E'].join('');
const HIVE = {
  credentialsOnly: true,
  preserveEncoding: true,
  transformation: { mode: 'hive-mask' },
};
const hive = (text, options = {}) =>
  createSyncSanitizer({ ...HIVE, ...options }).sanitize(text).text;
const hex = (value) => Buffer.from(value).toString('hex');
const wrapped = (value, width, newline = '\n') =>
  Buffer.from(value)
    .toString('base64')
    .match(new RegExp(`.{1,${width}}`, 'g'))
    .join(newline);
const document = JSON.stringify({
  note: 'x'.repeat(60),
  token: GH,
  more: 'y'.repeat(60),
});
const decode = (text) =>
  Buffer.from(text.replace(/\s/g, ''), 'base64').toString();

describe('wrapped encodings (issue 138)', () => {
  for (const [width, newline] of [
    [40, '\n'],
    [76, '\n'],
    [64, '\r\n'],
  ]) {
    it(`re-encodes with ${width} columns and ${JSON.stringify(newline)} lines`, async () => {
      const input = wrapped(document, width, newline);
      for (const output of [
        hive(input),
        (await createSanitizer(HIVE).sanitize(input)).text,
      ]) {
        const lines = output.split(newline);
        expect(lines.length > 1).toBe(true);
        expect(lines.slice(0, -1).every((line) => line.length === width)).toBe(
          true
        );
        expect(lines.at(-1).length <= width).toBe(true);
        expect(output.replaceAll(newline, '').includes('\n')).toBe(false);
        const decoded = decode(output);
        expect(decoded.includes(GH)).toBe(false);
        expect(JSON.parse(decoded).token).toBe('ghp…b4N');
      }
    });
  }
  it('reports one finding for a wrapped run', () => {
    const input = `log ${wrapped(document, 40)} end`;
    const findings = inspect(input, { credentialsOnly: true });
    expect(findings.map((f) => [f.rule, f.start, f.end])).toEqual([
      ['encoded', 4, input.length - 4],
    ]);
  });
});

describe('long encoded logs (issue 139)', () => {
  it('scans more decodable lines than one candidate budget', () => {
    const lines = Array.from({ length: 5000 }, (_, i) =>
      Buffer.from(`chunk number ${i} ok`).toString('base64')
    ).join('\n');
    expect(hive(`${lines}\ntoken: ${GH}`)).toBe(`${lines}\ntoken: ghp…b4N`);
  });
  it('masks candidates past a dense window budget without blocking', () => {
    const runs = Array.from(
      { length: 4200 },
      (_, i) => `&#${48 + (i % 10)};&#65;`
    );
    const text = `${runs.join(' ')}\ntoken: ${GH}`;
    const findings = inspect(text, { credentialsOnly: true });
    expect(findings.filter((f) => f.rule === 'encoded-limit').length).toBe(104);
    expect(hive(text).endsWith('\ntoken: ghp…b4N')).toBe(true);
  });
  it('keeps identifier and commit hash lines readable', () => {
    const ids = Array.from(
      { length: 1000 },
      (_, i) => `id_${String(i).padStart(4, '0')}abcdefghijklmnop`
    ).join('\n');
    expect(hive(`${ids}\ntoken: ${GH}\n`)).toBe(`${ids}\ntoken: ghp…b4N\n`);
    const shas = Array.from({ length: 250 }, (_, i) =>
      `${hex(`commit-${i}`)}`.padEnd(40, 'a')
    ).join('\n');
    expect(hive(`${shas}\n`)).toBe(`${shas}\n`);
    expect(inspect(shas, { credentialsOnly: true })).toEqual([]);
  });
  it('masks long wrapped text while preserving bounded binary payloads', () => {
    const text = wrapped(`${'note '.repeat(2000)}password=hunter2long`, 76);
    expect(text.length > 8192).toBe(true);
    expect(inspect(text, { credentialsOnly: true }).map((f) => f.rule)).toEqual(
      ['encoded-limit']
    );
    const binary = Buffer.alloc(9000, 0xfe).toString('base64');
    const body = binary.match(/.{1,64}/g).join('\n');
    expect(inspect(body, { credentialsOnly: true })).toEqual([]);
    expect(hive(body)).toBe(body);
  });
});

describe('encoded known secrets (issue 140)', () => {
  for (const length of [4, 12, 15, 16, 20]) {
    it(`masks hex and base64 forms of a ${length}-character known secret`, () => {
      const secret = KNOWN.slice(0, length);
      const options = { knownSecrets: [secret] };
      for (const form of [
        hex(secret),
        hex(secret).toUpperCase(),
        Buffer.from(secret).toString('base64'),
        Buffer.from(secret).toString('base64url'),
      ]) {
        const output = hive(`x ${form} y\nother log lines\n`, options);
        expect(output.includes(form)).toBe(false);
        expect(output.endsWith(' y\nother log lines\n')).toBe(true);
      }
    });
  }
  it('masks a payload that cannot be re-encoded as it stands', async () => {
    const secret = KNOWN.slice(0, 16);
    const text = `x ${hex(secret)} y\nother log lines\n`;
    const options = { ...HIVE, knownSecrets: [secret] };
    expect(createSyncSanitizer(options).sanitize(text).text).toBe(
      'x 506…879 y\nother log lines\n'
    );
    expect((await createSanitizer(options).sanitize(text)).text).toBe(
      'x 506…879 y\nother log lines\n'
    );
    expect(redact(text, inspect(text, options), options)).toBe(
      'x 506…879 y\nother log lines\n'
    );
  });
  it('leaves other hexadecimal and base64 text alone', () => {
    const options = { knownSecrets: [KNOWN.slice(0, 12)] };
    for (const text of [
      `x ${hex(KNOWN.slice(0, 12))}00 y`,
      `x ff${hex(KNOWN.slice(0, 12))} y`,
      'x 506b37526d32 y',
    ]) {
      expect(hive(text, options)).toBe(text);
    }
  });
});

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
  credentials.createSyncSanitizer({ ...OPTIONS, ...options }).sanitize(text)
    .text;
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
      expect(credentials.inspect(text)).toEqual([]);
      expect(sanitize(text)).toBe(text);
      expect(
        (await credentials.createSanitizer(OPTIONS).sanitize(text)).text
      ).toBe(text);
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
      const findings = credentials.inspect(input);
      expect(findings.map((f) => [f.rule, f.start, f.end])).toEqual([
        ['encoded', prefix.length, prefix.length + body.length],
      ]);
      for (const output of [
        sanitize(input),
        (await credentials.createSanitizer(OPTIONS).sanitize(input)).text,
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
    expect(credentials.inspect(body).map((f) => f.rule)).toEqual([
      'encoded-limit',
    ]);
    expect(sanitize(body).includes(body)).toBe(false);
  });

  it('detects credentials in text embedded after invalid UTF-8 bytes', () => {
    const body = wrap(
      Buffer.concat([
        Buffer.alloc(9000, 147),
        Buffer.from(`\npassword=${SECRET}\n`),
      ])
    );
    expect(credentials.inspect(body).some((f) => f.rule === 'encoded')).toBe(
      true
    );
    expect(sanitize(body).includes(body)).toBe(false);
  });

  it('fails closed for oversized nested text inside a bounded binary payload', () => {
    const nested = Buffer.from(
      `${'ordinary '.repeat(1500)}password=${SECRET}`
    ).toString('base64');
    const body = wrap(
      Buffer.concat([Buffer.alloc(9000, 147), Buffer.from(`\n${nested}\n`)])
    );
    expect(
      credentials.inspect(body).some((f) => f.rule === 'encoded-limit')
    ).toBe(true);
    expect(sanitize(body).includes(body)).toBe(false);
  });

  it('fails closed for binary runs beyond the full classification bound', () => {
    const body = wrap(Buffer.alloc(200000, 147));
    expect(body.length > 256 * 1024).toBe(true);
    expect(credentials.inspect(body).map((f) => f.rule)).toEqual([
      'encoded-limit',
    ]);
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

describe('unpadded wrapped base64 followed by prose (issue 162)', () => {
  const secret = ['gho_', 'SYNTHETIC0000NotARealToken', '1'.repeat(10)].join(
    ''
  );
  const document = JSON.stringify({ token: secret, note: 'keep me' });
  const commonjs = createRequire(import.meta.url)(
    '@link-foundation/sensitive-data-sanitizer/credentials'
  );
  for (const width of [20, 40, 48, 64, 76]) {
    for (const newline of ['\n', '\r\n']) {
      it(`preserves the complete JSON at width ${width} with ${JSON.stringify(newline)}`, async () => {
        const raw = Buffer.from(document).toString('base64');
        expect(raw.endsWith('=')).toBe(false);
        const body = wrap(Buffer.from(document), width, newline);
        const prefix = `start of output${newline}response body=${newline}`;
        const suffix = `${newline}trailing line${newline}`;
        const input = prefix + body + suffix;
        const expectedBody = wrap(
          Buffer.from(JSON.stringify({ token: 'gho…111', note: 'keep me' })),
          width,
          newline
        );
        const expected = prefix + expectedBody + suffix;
        expect(
          [...decodedRuns(input)]
            .filter((r) => r.depth === 0)
            .map((r) => [r.start, r.end, r.text])
        ).toEqual([[prefix.length, prefix.length + body.length, document]]);
        const findings = credentials.inspect(input);
        expect(findings.map((f) => [f.rule, f.start, f.end])).toEqual([
          ['encoded', prefix.length, prefix.length + body.length],
        ]);
        for (const entry of [credentials, commonjs]) {
          expect(entry.createSyncSanitizer(HIVE).sanitize(input).text).toBe(
            expected
          );
          expect((await entry.createSanitizer(HIVE).sanitize(input)).text).toBe(
            expected
          );
        }
        // Place a chunk boundary before and inside the following prose, as in
        // the consumer, and exercise a small batch at every input boundary.
        for (let split = 1; split < input.length; split++) {
          let output = '';
          for await (const chunk of sanitizeStream(
            [input.slice(0, split), input.slice(split)],
            { ...OPTIONS, batchBytes: 32 }
          )) {
            output += chunk;
          }
          expect(output).toBe(expected);
        }
        expect(JSON.parse(decode(expectedBody))).toEqual({
          token: 'gho…111',
          note: 'keep me',
        });
      });
    }
  }
});

it('recovers before multiple alphabet-only prose lines and scans later payloads', () => {
  const value = JSON.stringify({ token: SECRET.slice(0, -1), note: 'keep me' });
  const body = wrap(Buffer.from(value), 20);
  const prose = '\ntrailing\nline\n# next payload\n';
  const input = `${body + prose + body}\ntrailing line\n`;
  const expected = sanitize(body);
  expect(sanitize(input)).toBe(
    `${expected + prose + expected}\ntrailing line\n`
  );
  expect(
    [...decodedRuns(input)]
      .filter((r) => r.depth === 0)
      .map((r) => [r.start, r.end, r.text])
  ).toEqual([
    [0, body.length, value],
    [body.length + prose.length, 2 * body.length + prose.length, value],
  ]);
});
