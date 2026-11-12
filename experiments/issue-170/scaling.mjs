// Times the separated credential key scan on growing `a-` runs (issue #170).
const key = process.argv[2] ?? '(?:[\\p{L}\\p{N}]+[_.-])*(?:password|token)(?:[_.-][\\p{L}\\p{N}]+)*';
const re = new RegExp(`(?<![\\p{L}\\p{N}_])(${key})(?![\\p{L}\\p{N}_])[ \\t]*[:=]`, 'giu');
for (const unit of ['a-', 'A_', 'a.']) {
  for (const n of [1e4, 2e4, 4e4]) {
    const text = unit.repeat(n);
    const t = performance.now();
    let r;
    try { r = [...text.matchAll(re)].length; } catch (e) { r = e.message; }
    console.log(unit, n * 2, Math.round(performance.now() - t), 'ms', r);
  }
}
