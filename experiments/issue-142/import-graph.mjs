// Print the transitive static src/ imports of a module (issue 137).
import { readFileSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';
const seen = new Map();
const walk = (file, parent) => {
  if (seen.has(file)) {
    return;
  }
  seen.set(file, parent);
  const source = readFileSync(file, 'utf8');
  for (const match of source.matchAll(
    /^(?:import|export)[^'"]*?from\s+['"]([^'"]+)['"]|^import\s+['"]([^'"]+)['"]/gms
  )) {
    const spec = match[1] ?? match[2];
    if (spec.startsWith('.')) {
      walk(resolve(dirname(file), spec), file);
    } else {
      seen.has(spec) || seen.set(spec, file);
    }
  }
};
walk(resolve(process.argv[2]), undefined);
for (const [file, parent] of seen) {
  console.log(relative('.', file), '<-', parent ? relative('.', parent) : '');
}
