// Finds the smallest run sizes that still fail on a given source tree, to
// size the regression tests (issue 170). Usage: node minimal.mjs <src dir>
// (`a.` on the context scan is omitted: it is quadratic before the fix.)
import { URL, pathToFileURL } from 'node:url';
const base = pathToFileURL(`${process.argv[2] ?? 'src'}/`);
const { detectContext } = await import(new URL('context.js', base));
const { detectPersonalEvidence } = await import(
  new URL('personal-evidence.js', base)
);
const scans = {
  context: (text) => detectContext(text, () => {}, true),
  email: (text) => detectPersonalEvidence(text, () => {}),
};
// The scans only reach a run once a later `password=` line gives them a
// candidate, so the reproduction keeps one.
const tail = process.env.TAIL ?? '\npassword=x\n';
for (const [scan, unit] of [
  ['context', 'A'],
  ['context', 'Ab'],
  ['context', 'A_'],
  ['email', 'a.'],
]) {
  for (const mib of [2, 4, 6, 8, 10]) {
    const text = `${unit.repeat((mib * 1024 * 1024) / unit.length)}${tail}`;
    let result = 'ok';
    try {
      scans[scan](text);
    } catch (error) {
      result = error.message;
    }
    console.log(scan, unit, mib, 'MiB', result);
    if (result !== 'ok') {
      break;
    }
  }
}
