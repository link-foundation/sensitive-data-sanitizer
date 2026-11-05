// Make the existing runtime limitations visible in test reports.
import { parse } from 'espree';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';

function* nodes(node) {
  if (!node || typeof node !== 'object') {
    return;
  }
  yield node;
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      for (const child of value) {
        yield* nodes(child);
      }
    } else if (value && typeof value === 'object') {
      yield* nodes(value);
    }
  }
}

function skipGuard(node, source) {
  if (node.type !== 'IfStatement' || node.alternate) {
    return null;
  }
  if (node.consequent?.body?.length !== 1) {
    return null;
  }
  if (node.consequent.body[0].type !== 'ReturnStatement') {
    return null;
  }
  const condition = source.slice(node.test.start, node.test.end);
  if (!/Deno|Bun|canWrite/.test(condition)) {
    return null;
  }
  return /canWrite|permissions/.test(condition)
    ? 'sandboxed'
    : 'nodeCliUnavailable';
}

for (const name of readdirSync('tests').filter((file) =>
  file.endsWith('.test.js')
)) {
  const path = `tests/${name}`;
  let source = readFileSync(path, 'utf8');
  const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
  const edits = [];
  const imports = new Set(['itUnless']);
  for (const test of nodes(ast)) {
    if (test.type !== 'CallExpression' || test.callee?.name !== 'it') {
      continue;
    }
    const reasons = new Set();
    for (const node of nodes(test.arguments[1])) {
      const reason = skipGuard(node, source);
      if (!reason) {
        continue;
      }
      reasons.add(reason);
      imports.add(reason);
      edits.push({ start: node.start, end: node.end, text: '' });
    }
    if (reasons.size) {
      edits.push({
        start: test.callee.start,
        end: test.callee.end,
        text: `itUnless(${[...reasons].join(', ')})`,
      });
    }
  }
  if (!edits.length) {
    continue;
  }
  for (const edit of edits.sort((a, b) => b.start - a.start)) {
    source = source.slice(0, edit.start) + edit.text + source.slice(edit.end);
  }
  source = `import { ${[...imports].join(', ')} } from './helpers/skip.js';\n${source}`;
  writeFileSync(path, source);
  console.log(`${path}: explicit runtime skips`);
}
