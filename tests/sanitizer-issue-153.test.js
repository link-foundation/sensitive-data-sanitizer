import { describe, it, expect } from 'test-anywhere';
import { Buffer } from 'node:buffer';
import {
  createSyncSanitizer,
  createSanitizer,
} from '../src/credentials-entry.js';

const HIVE = {
  preserveEncoding: true,
  transformation: { mode: 'hive-mask' },
};
const GH = `gho_${'A'.repeat(12)}SyntheticNotReal${'9'.repeat(8)}`;
const base64 = (value) => Buffer.from(value).toString('base64');
const escaped = (value) => JSON.stringify(value);
const record = (value) =>
  `[INFO] "content": ${escaped(`token len ${GH.length}\n{"token":"${value}"}\n`)}`;
const KEEP = 'abc123def456ghi789';
const exempt = (finding) => finding.value === KEEP;

async function engines(options = {}) {
  return [
    createSyncSanitizer({ ...HIVE, ...options }),
    createSanitizer({ ...HIVE, ...options }),
  ];
}

describe('short encoded masks (issue 153)', () => {
  it('preserves the exact issue reproduction and encoded mask spellings', async () => {
    for (const mask of ['gho…999', 'ab…xyz', '[REDACTED]', '???…???']) {
      for (const encoding of ['base64', 'base64url']) {
        const encoded = Buffer.from(mask).toString(encoding);
        for (const value of [encoded, encoded.replace(/=+$/, '')]) {
          const text = `"token":"${value}"`;
          for (const engine of await engines()) {
            expect(await engine.inspect(text)).toEqual([]);
            for (let pass = 0; pass < 3; pass++) {
              expect((await engine.sanitize(text)).text).toBe(text);
            }
          }
        }
      }
    }
  });

  it('keeps the credential ends and escaped GHCR record on every pass', async () => {
    for (const engine of await engines()) {
      let text = record(base64(GH));
      const expected = record(base64('gho…999'));
      for (let pass = 0; pass < 3; pass++) {
        text = (await engine.sanitize(text)).text;
        expect(text).toBe(expected);
      }
    }
  });

  it('does not exempt arbitrary decoded text, partial masks or noncanonical bytes', async () => {
    for (const value of [
      base64('not a mask'),
      base64('gho…999literal'),
      `${base64('gho…999')}=`,
      `${base64('gho…999')}!`,
    ]) {
      for (const engine of await engines()) {
        expect(
          (await engine.sanitize(`token="${value}"`)).text ===
            `token="${value}"`
        ).toBe(false);
      }
    }
  });

  it('keeps explicit known secrets sensitive, even when they spell a mask', async () => {
    const encoded = base64('gho…999');
    for (const known of ['gho…999', encoded]) {
      for (const engine of await engines({ knownSecrets: [known] })) {
        expect((await engine.sanitize(`token="${encoded}"`)).text).toBe(
          'token="[REDACTED]"'
        );
      }
    }
  });
});

describe('escaped JSON policy views (issue 153)', () => {
  it('preserves a view only after independent inspection with the supplied policy', async () => {
    for (const engine of await engines({ exempt })) {
      const text = escaped(`{"token":"${KEEP}"}`);
      expect(await engine.inspect(text)).toEqual([]);
      expect((await engine.sanitize(text)).text).toBe(text);
    }
  });

  it('awaits async hooks in decoded views', async () => {
    const engine = createSanitizer({ ...HIVE, exempt: async (f) => exempt(f) });
    const text = escaped(`{"token":"${KEEP}"}`);
    expect(await engine.inspect(text)).toEqual([]);
    expect((await engine.sanitize(text)).text).toBe(text);
  });

  it('keeps other credentials and exact known secrets sensitive in escaped views', async () => {
    for (const engine of await engines({ exempt, knownSecrets: [KEEP] })) {
      const text = escaped(`{"token":"${KEEP}","password":"${GH}"}`);
      const result = (await engine.sanitize(text)).text;
      expect(result.includes(KEEP)).toBe(false);
      expect(result.includes(GH)).toBe(false);
      expect(JSON.parse(result)).toBe(
        '{"token":"abc…789","password":"gho…999"}'
      );
    }
  });
});

// Explicitly supplied findings exercise malformed/oversized/deep views without
// creating a large payload or stressing the process stack.
describe('escaped-view inspection limits', () => {
  const finding = (text) => ({
    start: 0,
    end: text.length,
    type: 'ENCODED_SENSITIVE',
    category: 'credential',
    rule: 'encoded',
  });

  it('retains malformed and oversized findings', async () => {
    for (const text of ['bad\\q', `ok\\n${'x'.repeat(8192)}`]) {
      for (const engine of await engines({
        exempt: () => false,
        findings: [finding(text)],
      })) {
        expect((await engine.inspect(text)).length > 0).toBe(true);
      }
    }
  });

  it('checks nested views with a finite depth and preserves clean results', async () => {
    let text = `{"token":"${KEEP}"}`;
    for (let level = 0; level < 3; level++) {
      text = escaped(text);
      for (const engine of await engines({ exempt })) {
        expect(await engine.inspect(text)).toEqual([]);
        expect((await engine.sanitize(text)).text).toBe(text);
      }
    }
    // A fourth view exceeds the independent inspection budget.
    text = escaped(text);
    for (const engine of await engines({ exempt })) {
      expect((await engine.inspect(text)).length > 0).toBe(true);
    }
  });

  it('includes independent async detectors when checking decoded views', async () => {
    const marker = 'policyguard';
    const engine = createSanitizer({
      ...HIVE,
      exempt,
      detectors: [
        {
          async detect(text) {
            const start = text.indexOf(marker);
            return start < 0
              ? []
              : [
                  {
                    start,
                    end: start + marker.length,
                    type: 'SECRET',
                    category: 'credential',
                    rule: 'custom-policy',
                  },
                ];
          },
        },
      ],
    });
    const text = escaped(`{"token":"${KEEP}","note":"${marker}"}`);
    expect((await engine.inspect(text)).length > 0).toBe(true);
    expect((await engine.sanitize(text)).text.includes(marker)).toBe(false);
  });

  it('reports value-free decoded-view diagnostics only when requested', async () => {
    const events = [];
    for (const engine of await engines({
      exempt,
      debug: (event) => events.push(event),
    })) {
      await engine.inspect(escaped(`{"token":"${KEEP}"}`));
    }
    expect(events.some((event) => event.event === 'exempt-decoded-view')).toBe(
      true
    );
    expect(JSON.stringify(events).includes(KEEP)).toBe(false);
  });
});
