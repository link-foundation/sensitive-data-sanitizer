// flatRegExp keeps matches identical and stays flat on long two-byte runs.
import { flatRegExp } from '../../src/unicode-runs.js';
const patterns = [
  /[\p{L}]+/gu,
  /[\p{L}\p{M}]+/gu,
  /\p{L}+/gu,
  /https?:\/\/[^\s"<>\\]+/gu,
  /(?<![\p{L}\p{N}_])паспорт[\p{L}]*/giu,
  /(?<![\p{L}\p{N}_.-])[\p{L}\p{N}_.-]{2,}?x/gu,
  /[\s\S]\p{M}*/gu,
  /(?<!\S)a\S+b/gu,
  /(?<!\p{L}+)(?<![^:])z[^:]*:/gu,
  /[\]\\-]+/gu,
];
const samples = [
  'abc def',
  'Ab𝐀c x',
  'https://a.b/😀 x',
  'ПАСПОРТ123 паспортИ',
  'a.b-cx',
  'é́x',
  'a😀b',
  'zq: z😀:',
  ']\\-a',
];
let bad = 0;
for (const p of patterns) {
  const f = flatRegExp(p);
  for (const s of samples) {
    const a = JSON.stringify([...s.matchAll(p)].map((m) => [m.index, m[0]]));
    const b = JSON.stringify([...s.matchAll(f)].map((m) => [m.index, m[0]]));
    if (a !== b) {
      bad++;
      console.log('DIFF', p, s, a, b);
    }
  }
  const long = p.source.includes('\\p{M}')
    ? `—e${'\u0301'.repeat(8 * 1024 * 1024)}`
    : `https://${'a'.repeat(8 * 1024 * 1024)} —`;
  try {
    f.lastIndex = 0;
    f.exec(long);
  } catch (e) {
    bad++;
    console.log('OVERFLOW', p, e.message);
  }
  console.log(p.source.length, '->', f.source.length, p.source);
}
console.log(bad ? `${bad} problems` : 'all equal and flat');
