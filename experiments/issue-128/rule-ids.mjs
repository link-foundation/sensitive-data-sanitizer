// Lists rule ids written in src/ that are missing from builtInRules.
import { readFileSync, readdirSync } from 'node:fs';
import { builtInRules, credentialRules } from '../../src/rule-catalog.js';
const known = new Set(builtInRules);
const found = new Map();
for (const file of readdirSync('src').filter((f) => f.endsWith('.js'))) {
  const source = readFileSync(`src/${file}`, 'utf8');
  for (const match of source.matchAll(
    /rule:\s*'([^']+)'|(?:details|personal)\(\s*'[A-Z_]+',\s*'([^']+)'/g
  )) {
    const id = match[1] ?? match[2];
    if (!known.has(id)) {
      found.set(id, file);
    }
  }
}
console.log([...found].map(([id, file]) => `${id}\t${file}`).join('\n'));
console.log(
  'credential rules not in builtInRules:',
  [...credentialRules].filter((id) => !known.has(id))
);
