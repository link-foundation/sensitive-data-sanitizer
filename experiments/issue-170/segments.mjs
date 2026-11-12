// Checks separated key forms (`a_b_password`) on long `A_` runs (issue 170).
import { performance } from 'node:perf_hooks';
const tests = {
  original: '(?:[\\p{L}\\p{N}]+[_.-])*password(?:[_.-][\\p{L}\\p{N}]+)*',
  alternation:
    '(?:[\\p{L}\\p{N}](?:[\\p{L}\\p{N}]|[_.-](?![_.-]))*?[_.-])?password(?:[_.-](?:[\\p{L}\\p{N}]|[_.-](?![_.-]))*?[\\p{L}\\p{N}])?',
  lookahead:
    '(?:[\\p{L}\\p{N}][\\p{L}\\p{N}_.-]*?[_.-])?password(?:[_.-][\\p{L}\\p{N}_.-]*[\\p{L}\\p{N}])?',
};
for (const [name, key] of Object.entries(tests)) {
  const re = new RegExp(
    `(?<![\\p{L}\\p{N}_])(${key})(?![\\p{L}\\p{N}_])[ \\t]*[:=]`,
    'giu'
  );
  for (const text of [
    `${'A_'.repeat(5e6)}password=x`,
    `password${'_A'.repeat(5e6)}=x`,
    'a-'.repeat(5e6),
  ]) {
    const t = performance.now();
    let r;
    try {
      r = [...text.matchAll(re)].map((m) => m[1].length).join(',');
    } catch (e) {
      r = e.message;
    }
    console.log(name, Math.round(performance.now() - t), 'ms', r);
  }
}
