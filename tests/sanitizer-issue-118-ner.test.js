import { describe, it, expect } from 'test-anywhere';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { createNerDetector } from '../src/ner.js';
import { sanitize, createSanitizer } from '../src/index.js';

const corpus = JSON.parse(
  readFileSync(
    new URL('../experiments/issue-118/ner-corpus.json', import.meta.url),
    'utf8'
  )
);
describe('issue 113 optional in-process offline recognition', () => {
  it('recognizes the acceptance corpus with exact UTF-16 spans, synchronously after loading', async () => {
    const detector = await createNerDetector({ languages: ['ru', 'en'] });
    for (const row of corpus.filter((r) => r.acceptance)) {
      const entities = detector
        .detect(row.text)
        .map((f) => [f.type, row.text.slice(f.start, f.end)]);
      expect(entities).toEqual(row.entities);
      const options = { detectors: [detector] };
      const output = sanitize(row.text, options).text;
      expect(
        (
          await createSanitizer({ ...options, secretlint: false }).sanitize(
            row.text
          )
        ).text
      ).toBe(output);
      for (const [, value] of row.entities) {
        expect(output.includes(value)).toBe(false);
      }
      if (!row.entities.length) {
        expect(output).toBe(row.text);
      }
    }
  });
  it('honors languages and rejects invalid configuration', async () => {
    expect(
      (await createNerDetector({ languages: ['ru'] })).detect('John').length
    ).toBe(0);
    for (const languages of [[], ['xx'], 'ru']) {
      let code;
      try {
        await createNerDetector({ languages });
      } catch (error) {
        code = error.code;
      }
      expect(code).toBe('ERR_CONFIG');
    }
  });
});
