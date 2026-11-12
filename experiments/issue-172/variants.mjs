import { performance } from 'node:perf_hooks';
// Which loop shapes overflow V8's regexp stack (issue 172)? Each variant is
// sticky, so it makes one attempt at offset 0 of 'A' × N + tail; this keeps
// the probe linear. Usage: node variants.mjs [MiB]
const mib = Number(process.argv[2] ?? 8);
const variants = {
  'u [\\p{L}\\p{N}]+ then :': /[\p{L}\p{N}]+:/uy,
  'u [\\p{L}\\p{N}]+ alone': /[\p{L}\p{N}]+/uy,
  'u [\\p{L}\\p{N}]{1,64} then :': /[\p{L}\p{N}]{1,64}:/uy,
  'u [\\p{Ll}\\p{Lu}\\p{N}]*? then Secret':
    /[\p{L}][\p{Ll}\p{Lu}\p{N}]*?Secret/uy,
  'u [^\\s]+ then :': /[^\s]+:/uy,
  'u \\S+ alone': /\S+/uy,
  'u . + then :': /.+:/uy,
  'u [A-Za-z0-9]+ then :': /[A-Za-z0-9]+:/uy,
  'u [\\w]+ then :': /\w+:/uy,
  'no-u [^\\s]+ then :': /[^\s]+:/y,
  'no-u [A-Za-z]+ then :': /[A-Za-z]+:/y,
  'v [\\p{L}\\p{N}]+ then :': /[\p{L}\p{N}]+:/vy,
  'v [\\p{L}\\p{N}--[\\u{10000}-\\u{10FFFF}]]+ then :':
    /[[\p{L}\p{N}]--[\u{10000}-\u{10FFFF}]]+:/vy,
};
for (const tail of [' é:\n', ' —:\n']) {
  const text = 'A'.repeat(mib * 1024 * 1024) + tail;
  for (const [name, re] of Object.entries(variants)) {
    const t = performance.now();
    let r;
    try {
      re.lastIndex = 0;
      r = re.exec(text)?.[0].length ?? 'no match';
    } catch (e) {
      r = e.message;
    }
    console.log(
      tail.includes('—') ? 'two-byte' : 'one-byte',
      name,
      r,
      Math.round(performance.now() - t),
      'ms'
    );
  }
}
