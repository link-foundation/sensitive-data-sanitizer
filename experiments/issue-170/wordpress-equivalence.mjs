// Issue 170: fuzzes the unrolled WordPress key value expression against the
// original one, then checks a 10 MiB value.
// Usage: node experiments/issue-170/wordpress-equivalence.mjs [runs]
const original =
  /\bdefine\s*\(\s*(['"])(?:AUTH|SECURE_AUTH|LOGGED_IN|NONCE)_(?:KEY|SALT)\1\s*,\s*(['"])((?:\\.|(?!\2)[^\\\r\n])+)\2\s*\)/g;
const unrolled =
  /\bdefine\s*\(\s*(['"])(?:AUTH|SECURE_AUTH|LOGGED_IN|NONCE)_(?:KEY|SALT)\1\s*,\s*(['"])((?!\2)[^'"\\\r\n]*(?:(?:\\.|(?!\2)['"])[^'"\\\r\n]*)*)\2\s*\)/g;
const runs = Number(process.argv[2] ?? 200000);
const pieces = ['a', "'", '"', '\\', '\n', ')', ' ', "');", '");', '\\\\'];
let random = 170;
const next = () => {
  random = (random * 1103515245 + 12345) % 2147483648;
  return random / 2147483648;
};
const show = (re, text) =>
  [...text.matchAll(re)].map((m) => `${m.index}:${m[3]}`).join('|');
let differences = 0;
let matched = 0;
for (let i = 0; i < runs; i++) {
  const quote = next() < 0.5 ? "'" : '"';
  let value = '';
  const count = Math.floor(next() * 8);
  for (let j = 0; j < count; j++) {
    value += pieces[Math.floor(next() * pieces.length)];
  }
  const text = `define(${quote}AUTH_KEY${quote}, ${next() < 0.5 ? "'" : '"'}${value}`;
  const want = show(original, text);
  matched += want ? 1 : 0;
  if (want !== show(unrolled, text)) {
    differences++;
    if (differences <= 5) {
      console.log(JSON.stringify(text), want, show(unrolled, text));
    }
  }
}
console.log(`runs=${runs} matched=${matched} differences=${differences}`);
const long = `define('AUTH_KEY', '${'a'.repeat(10 * 1024 * 1024)}');`;
console.log('10 MiB value matches:', [...long.matchAll(unrolled)].length);
