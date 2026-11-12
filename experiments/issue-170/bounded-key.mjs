// Times the real credentialPrefix with bounded key segment counts on 10 MiB
// separator runs (issue #170). Usage: node bounded-key.mjs [bound...]
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
const source = readFileSync(new URL('../../src/context.js', import.meta.url), 'utf8');
const bounds = process.argv.slice(2).length ? process.argv.slice(2) : ['', '16', '64'];
for (const bound of bounds) {
  const quantifier = bound ? `{0,${bound}}` : '*';
  const patched = source
    .replace('(?:[\\\\p{L}\\\\p{N}]+[_.-])*', `(?:[\\\\p{L}\\\\p{N}]+[_.-])${quantifier}`)
    .replace('(?:[_.-][\\\\p{L}\\\\p{N}]+)*`', `(?:[_.-][\\\\p{L}\\\\p{N}]+)${quantifier}\``)
    .concat('\nexport { credentialPrefix };\n');
  // A sibling file keeps the module's relative imports working.
  const file = new URL(`../../src/.issue-170-${bound || 'unbounded'}.js`, import.meta.url);
  writeFileSync(file, patched);
  const url = file.href;
  let credentialPrefix;
  try {
    ({ credentialPrefix } = await import(url));
  } catch (error) {
    console.log('cannot load patched module:', error.message);
    process.exit(1);
  } finally {
    rmSync(file, { force: true });
  }
  for (const unit of ['a-', 'A_', 'a.', 'ab-', 'A']) {
    const text = unit.repeat((10 * 1024 * 1024) / unit.length | 0) + '_password=x\n';
    const t = performance.now();
    let r;
    try { r = [...text.matchAll(credentialPrefix)].map((m) => m[1].length).join(','); } catch (e) { r = e.message; }
    console.log(bound || 'unbounded', unit, Math.round(performance.now() - t), 'ms', r);
  }
}
