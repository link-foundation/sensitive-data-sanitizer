import { it, expect } from 'test-anywhere';
import { corpus } from '../experiments/benchmark/corpus.mjs';
import { createSanitizer } from '../src/index.js';

it('covers complete review-corpus spans with default settings and retains benign controls', async () => {
  const engine = createSanitizer();
  for (const entry of corpus) {
    const findings = await engine.inspect(entry.text);
    if (!entry.spans.length) {
      expect(findings).toEqual([]);
      continue;
    }
    for (const truth of entry.spans) {
      let cursor = truth.start;
      for (const finding of findings) {
        if (finding.start <= cursor && finding.end > cursor) {
          cursor = finding.end;
        }
      }
      expect(cursor >= truth.end).toBe(true);
    }
  }
});
