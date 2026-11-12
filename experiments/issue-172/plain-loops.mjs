// Does a bare `u`-flag letter loop with nothing after it overflow on a long
// two-byte run? Usage: node plain-loops.mjs [MiB]
const mib = Number(process.argv[2] ?? 8);
const text = `${'a'.repeat(mib * 1024 * 1024)} —`;
for (const [name, pattern] of [
  ['replace [\\p{L}]+', () => text.replace(/[\p{L}]+/gu, (w) => w)],
  ['match [\\p{L}\\p{M}]+', () => text.match(/[\p{L}\p{M}]+/gu)],
  ['letters then colon', () => /[\p{L}]+:/u.test(text)],
]) {
  try {
    pattern();
    console.log('ok      ', name);
  } catch (error) {
    console.log('overflow', name, error.message);
  }
}
