// Checks the run scans used by shortenedView (issue 173) on 16 MiB one-byte
// and two-byte subjects: `[…]{1024,}` overflows V8's regexp stack, while a
// fixed `{64}` probe plus a sticky `*` loop does not.
const block = /[A-Za-z0-9+/]{64}/g;
const tailRun = /[A-Za-z0-9+/]*/y;
const runs = (text) => {
  const found = [];
  block.lastIndex = 0;
  for (let m; (m = block.exec(text)); ) {
    tailRun.lastIndex = m.index;
    const end = m.index + tailRun.exec(text)[0].length;
    found.push([m.index, end]);
    block.lastIndex = end;
  }
  return found;
};
for (const tail of ['\n', '—\n']) {
  for (const [name, body] of [
    ['A', 'A'.repeat(16 * 1024 * 1024)],
    ['a_', 'a_'.repeat(8 * 1024 * 1024)],
    ['x1000_', ('x'.repeat(1000) + '_').repeat(16 * 1024)],
  ]) {
    const text = body + tail;
    const value = /[\w.=/+-]*/y;
    value.lastIndex = 0;
    let t = performance.now();
    const length = value.exec(text)[0].length;
    const valueMs = Math.round(performance.now() - t);
    t = performance.now();
    const found = runs(text).length;
    const runMs = Math.round(performance.now() - t);
    let counted;
    try {
      counted = [...text.matchAll(/[A-Za-z0-9+/]{1024,}/g)].length;
    } catch (error) {
      counted = error.message;
    }
    console.log(JSON.stringify(tail), name, 'value', length, valueMs, 'ms; runs', found, runMs, 'ms; {1024,}:', counted);
  }
}
