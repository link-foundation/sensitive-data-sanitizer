import { performance } from 'node:perf_hooks';
// Finite serial comparison; optionally pass another checkout's src/index.js.
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const { sanitize } = await import(
  pathToFileURL(resolve(process.argv[2] ?? 'src/index.js'))
);
for (const bytes of [267, 9000]) {
  // ASCII fixture lengths are exact, including JSON syntax.
  const source = `{"note":"${'ordinary; '.repeat(Math.ceil(bytes / 10)).slice(0, bytes - 11)}"}`;
  const options = { profile: 'documents', structured: 'json' };
  for (let i = 0; i < 3; i++) {
    sanitize(source, options);
  }
  const start = performance.now();
  for (let i = 0; i < 10; i++) {
    sanitize(source, options);
  }
  console.log(
    JSON.stringify({
      bytes: source.length,
      ms: (performance.now() - start) / 10,
    })
  );
}
