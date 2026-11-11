// Rebuild the exhaustive historical documentation index without scanning data.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
const root = 'docs/case-studies';
function markdown(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory()
      ? markdown(path)
      : entry.name.endsWith('.md') && path !== join(root, 'README.md')
        ? [path]
        : [];
  });
}
const rows = markdown(root)
  .sort()
  .map((path) => {
    const title = readFileSync(path, 'utf8').match(/^#\s+(.+)$/m)?.[1] ?? path;
    return `| [${relative(root, path)}](${relative(root, path)}) | ${title.replaceAll('|', '\\|')} |`;
  });
writeFileSync(
  join(root, 'README.md'),
  `# Case studies and historical evidence\n\n[Documentation](../README.md) · [Current coverage](../COVERAGE.md)\n\nThese records describe work at their recorded versions. Historical plans and\ncompletion statements do not supersede current coverage or establish that every\nrequirement remains satisfied. Raw data and machine-readable research sit beside\nthe corresponding study. The latest cross-project audit is [issue 146](issue-146/README.md).\n\nRegenerate this index with \`node experiments/issue-146/index-docs.mjs\`.\n\n| Document | Subject |\n| --- | --- |\n${rows.join('\n')}\n`
);
