// Check new navigation and that README reaches every Markdown document.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
const links = (file) =>
  [...readFileSync(file, 'utf8').matchAll(/\]\(([^)]+)\)/g)]
    .map((match) => match[1].replace(/^<|>$/g, '').split('#')[0])
    .filter((path) => path && !/^[a-z]+:/i.test(path))
    .map((path) => resolve(dirname(file), decodeURIComponent(path)));
const active = [
  'README.md',
  'docs/README.md',
  'docs/USE-CASES.md',
  'docs/VERIFICATION.md',
  'docs/case-studies/README.md',
  'docs/case-studies/issue-146/README.md',
  'docs/case-studies/issue-146/research/sources.md',
  'docs/case-studies/issue-146/research/documentation-gaps.md',
];
for (const file of active) {
  for (const target of links(file)) {
    if (!existsSync(target)) {
      throw new Error(`${file}: missing ${target}`);
    }
  }
}
const seen = new Set();
function walk(file) {
  if (seen.has(file) || !existsSync(file)) {
    return;
  }
  seen.add(file);
  for (const target of links(file)) {
    if (target.endsWith('.md')) {
      walk(target);
    }
  }
}
walk(resolve('README.md'));
function documents(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory()
      ? documents(path)
      : path.endsWith('.md')
        ? [path]
        : [];
  });
}
const all = documents('docs');
const missing = all.filter((path) => !seen.has(path));
if (missing.length) {
  throw new Error(`Unreachable documents: ${missing.join(', ')}`);
}
console.log(
  `README reaches all ${all.length} documentation Markdown files; new local links resolve.`
);
