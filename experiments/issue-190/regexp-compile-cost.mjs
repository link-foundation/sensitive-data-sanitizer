import { performance } from 'node:perf_hooks';
// #189: which part of a known-value RegExp makes its first exec slow?
const N = 300;
const text = 'текст номер 1 без имен';
const names = Array.from(
  { length: N },
  (_, i) => `Имя${String.fromCharCode(1072 + (i % 30))}${i}ов`
);
function bench(label, make) {
  const res = names.map(make);
  const t = performance.now();
  for (const r of res) {
    r.lastIndex = 0;
    r.exec(text);
  }
  const first = performance.now() - t;
  console.log(
    label.padEnd(40),
    ((first / N) * 1000).toFixed(0),
    'µs/regexp first exec'
  );
}
const b = '[\\p{L}\\p{M}\\p{N}_]';
bench('boundary + iu', (n) => new RegExp(`(?<!${b})${n}(?!${b})`, 'giu'));
bench('boundary + u (no i)', (n) => new RegExp(`(?<!${b})${n}(?!${b})`, 'gu'));
bench('no boundary + iu', (n) => new RegExp(`${n}`, 'giu'));
bench(
  'ascii boundary + iu',
  (n) => new RegExp(`(?<![\\w])${n}(?![\\w])`, 'giu')
);
bench(
  'boundary \\p{L} only + iu',
  (n) => new RegExp(`(?<!\\p{L})${n}(?!\\p{L})`, 'giu')
);
bench('boundary + iu + v', (n) => new RegExp(`(?<!${b})${n}(?!${b})`, 'giv'));
bench('lookahead only', (n) => new RegExp(`${n}(?!${b})`, 'giu'));
bench('lookbehind only', (n) => new RegExp(`(?<!${b})${n}`, 'giu'));
bench(
  '\\p{N} only both',
  (n) => new RegExp(`(?<!\\p{N})${n}(?!\\p{N})`, 'giu')
);
bench(
  '\\p{M} only both',
  (n) => new RegExp(`(?<!\\p{M})${n}(?!\\p{M})`, 'giu')
);
bench(
  '\\p{L} only both, no i',
  (n) => new RegExp(`(?<!\\p{L})${n}(?!\\p{L})`, 'gu')
);
bench(
  '\\p{Lu} only both',
  (n) => new RegExp(`(?<!\\p{Lu})${n}(?!\\p{Lu})`, 'giu')
);
