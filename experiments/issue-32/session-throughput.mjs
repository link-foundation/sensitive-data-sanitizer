// Finite synthetic session: run with --max-old-space-size=256 --stack_size=1024.
import { performance } from 'node:perf_hooks';
import { createSanitizer, sanitizeStream } from '../../src/index.js';

const input = `${[
  JSON.stringify({
    toolUseResult: { file: { content: 'Applicant: Qazvela Zorveta' } },
  }),
  ...Array.from({ length: 24 }, (_, i) =>
    JSON.stringify({
      payload: {
        item: {
          content: [
            {
              text: `PASS ${i}\nstate:\nt\ndiff --git a/app.js b/app.js\n${'ordinary output '.repeat(5700)}`,
            },
          ],
        },
      },
    })
  ),
  JSON.stringify({
    toolUseResult: {
      file: { content: 'saved qazvela.pdf\npassword: private-fixture' },
    },
  }),
].join('\n')}\n`;
for (const workers of [0, 1, 4]) {
  const start = performance.now();
  let output = '';
  if (!workers) {
    output = (
      await createSanitizer({ profile: 'publication' }).sanitizeJsonl(input)
    ).text;
  } else {
    for await (const chunk of sanitizeStream([input], {
      structured: 'jsonl',
      profile: 'publication',
      workers,
      workerHeapMb: 256,
    })) {
      output += chunk;
    }
  }
  if (
    output.toLowerCase().includes('qazvela') ||
    output.includes('private-fixture') ||
    output.trim().split('\n').map(JSON.parse).length !== 26
  ) {
    throw new Error('Incomplete session protection');
  }
  const seconds = (performance.now() - start) / 1000;
  console.log(
    JSON.stringify({
      mode: workers ? `stream-${workers}` : 'sanitizeJsonl',
      bytes: Buffer.byteLength(input),
      seconds,
      mbPerSecond: Buffer.byteLength(input) / 1024 / 1024 / seconds,
    })
  );
}
