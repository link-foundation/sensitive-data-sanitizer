// Synthetic subprocess fixture for the local adapter contract.
const mode = process.argv[2];
const chunks = [];
for await (const chunk of process.stdin) {
  chunks.push(chunk);
}
const text = Buffer.concat(chunks).toString('utf8');
if (mode === 'error') {
  process.stderr.write('synthetic-private-detail');
  process.exitCode = 7;
} else if (mode === 'large') {
  process.stdout.write('x'.repeat(4096));
} else if (mode === 'slow') {
  await new Promise((resolve) => setTimeout(resolve, 10000));
} else if (mode === 'malformed') {
  process.stdout.write('{');
} else {
  const index = Array.from(text).join('').indexOf('Zoë');
  const start = index < 0 ? -1 : Array.from(text.slice(0, index)).length;
  process.stdout.write(
    JSON.stringify(
      start < 0 ? [] : [{ start, end: start + 3, entity_type: 'PERSON' }]
    )
  );
}
