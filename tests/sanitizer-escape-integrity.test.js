import { describe, it, expect } from 'test-anywhere';
import { createSanitizer, redact, sanitize } from '../src/index.js';

describe('complete JSON escape replacements', () => {
  it('carries document confirmations into decoded credential-containing strings', async () => {
    const input = [
      { text: 'Applicant: Qazvela Zorveta' },
      { text: 'saved qazvela.pdf\npassword: private-fixture' },
    ]
      .map(JSON.stringify)
      .join('\n');
    for (const options of [
      {},
      { structured: 'jsonl' },
      { structured: 'jsonl', profile: 'publication' },
    ]) {
      expect(
        (await createSanitizer(options).sanitize(input)).text
          .toLowerCase()
          .includes('qazvela')
      ).toBe(false);
      expect(
        sanitize(input, options).text.toLowerCase().includes('qazvela')
      ).toBe(false);
    }
  });
  for (const escape of ['\\n', '\\t', '\\"', '\\u041e', '\\\\']) {
    it(`aligns arbitrary detector spans inside ${escape}`, async () => {
      const input = `{"text":"before ${escape} after"}`;
      const start = input.indexOf(escape) + 1;
      const finding = {
        start,
        end: start + 1,
        category: 'credential',
        type: 'SECRET',
        rule: 'test-offset',
      };
      expect(JSON.parse(redact(input, [finding])).text).toBe(
        'before [REDACTED] after'
      );
      const engine = createSanitizer({
        secretlint: false,
        detectors: [
          {
            detect(text) {
              const index = text.indexOf(escape);
              return index < 0
                ? []
                : [{ ...finding, start: index + 1, end: index + 2 }];
            },
          },
        ],
      });
      expect(JSON.parse((await engine.sanitize(input)).text).text).toBe(
        'before [REDACTED] after'
      );
    });
  }
  it('keeps nested quotes, tabs and Unicode escapes valid in both API modes', async () => {
    const input =
      '{"payload":{"item":{"content":[{"text":"diff\\n+state:\\nt\\npassword: \\"secret\\t\\u041e\\""}]}}}\n';
    for (const engine of [
      createSanitizer(),
      createSanitizer({ structured: 'jsonl' }),
    ]) {
      const output = (await engine.sanitize(input)).text;
      expect(
        JSON.parse(output).payload.item.content[0].text.includes('secret')
      ).toBe(false);
    }
    expect(JSON.parse(sanitize(input).text).payload.item.content.length).toBe(
      1
    );
  });
});
