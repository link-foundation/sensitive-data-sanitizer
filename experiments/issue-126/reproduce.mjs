import { createSyncSanitizer } from '../../src/index.js';
import { attributes, operational, statuses } from './cases.mjs';

for (const structured of [undefined, 'json', 'jsonl']) {
  const sanitizer = createSyncSanitizer({
    profile: 'documents',
    properNames: 'capitalized',
    strict: true,
    structured,
  });
  for (const input of [...attributes.map(([text]) => text), ...operational]) {
    const source = structured ? JSON.stringify({ note: input }) : input;
    console.log(
      JSON.stringify({
        structured: structured ?? 'text',
        source,
        output: sanitizer.sanitize(source).text,
      })
    );
  }
  if (structured) {
    for (const status of statuses) {
      const source = JSON.stringify({ status });
      console.log(
        JSON.stringify({
          structured,
          source,
          output: sanitizer.sanitize(source).text,
        })
      );
    }
  }
}
