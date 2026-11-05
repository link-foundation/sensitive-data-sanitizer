import { performance } from 'node:perf_hooks';
// Finite, serial benchmark. Supply another checkout's src/index.js to compare.
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const { sanitize } = await import(
  pathToFileURL(resolve(process.argv[2] ?? 'src/index.js'))
);
const log = {
  level: 30,
  time: 1730000000000,
  id: 'req-1a',
  msg: 'request completed',
  req: {
    method: 'GET',
    url: '/api/v1/items',
    route: '/api/v1/items/:id',
    host: 'api.example.org',
    remoteAddress: '127.0.0.1',
    remotePort: 52344,
  },
  res: { statusCode: 200 },
  responseTime: 12.34,
};
const lines = [
  JSON.stringify({
    level: 30,
    msg: 'request completed',
    route: '/api/v1/items',
    method: 'GET',
    count: 200,
  }),
  JSON.stringify(log),
  JSON.stringify({ ...log, detail: 'request completed; '.repeat(480) }),
];
for (const [index, line] of [...lines, lines[1]].entries()) {
  const options = {
    profile: 'documents',
    ...(index === 3 ? {} : { structured: 'json' }),
  };
  for (let i = 0; i < 100; i++) {
    sanitize(line, options);
  }
  const samples = [];
  for (let run = 0; run < 3; run++) {
    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      sanitize(line, options);
    }
    samples.push((performance.now() - start) / 100);
  }
  console.log(
    JSON.stringify({
      index,
      chars: line.length,
      ms: samples.sort((a, b) => a - b)[1],
    })
  );
}
