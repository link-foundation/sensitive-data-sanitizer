import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
const rules = new Set();
const files = readdirSync('src').filter(
  (f) =>
    f.endsWith('.js') &&
    !['rule-catalog.js', 'restore-map.js', 'fake.js'].includes(f)
);
for (const file of files) {
  const source = readFileSync(`src/${file}`, 'utf8');
  for (const m of source.matchAll(/rule:\s*'([a-z][a-z0-9@/._-]+)'/g)) {
    rules.add(m[1]);
  }
  for (const m of source.matchAll(
    /\[\s*'[A-Z_]+',\s*'([a-z][a-z0-9@/._-]+)'/g
  )) {
    rules.add(m[1]);
  }
  for (const m of source.matchAll(
    /(?:personal|details)\(\s*'[A-Z_]+',\s*'([a-z][a-z0-9@/._-]+)'/g
  )) {
    rules.add(m[1]);
  }
}
const service = readFileSync('src/rules.js', 'utf8').split(
  'export const labels'
)[0];
const credential = new Set(
  [...service.matchAll(/\[\s*'([a-z][a-z0-9-]+)',/g)].map((m) => m[1])
);
for (const id of [
  'context',
  'cli-password',
  'authorization',
  'cookie',
  'entropy',
  'quoted-entropy',
  'private-key',
  'url-userinfo',
  'webhook',
  'known-secret',
  'netrc',
  'nuget',
  'wordpress',
  'putty-private-key',
  'encoded-limit',
  'encoded',
  'encoded-engine',
  'secretlint',
]) {
  credential.add(id);
}
for (const id of credential) {
  rules.add(id);
}
for (const vendor of ['google', 'azure', 'aws']) {
  rules.add(`catalog/${vendor}`);
  credential.add(`catalog/${vendor}`);
}
for (let i = 0; i < 6; i++) {
  for (const r of JSON.parse(
    readFileSync(`src/vendor/gitleaks/rules-${i}.json`)
  )) {
    rules.add(`gitleaks/${r.id}`);
    credential.add(`gitleaks/${r.id}`);
  }
}
writeFileSync(
  'src/rule-catalog.js',
  `// Stable Finding.rule ids; see the rule catalog generator in experiments.\nexport const builtInRules = Object.freeze(${JSON.stringify([...rules].sort(), null, 2)});\nexport const credentialRules = new Set(${JSON.stringify([...credential].sort(), null, 2)});\n`
);
writeFileSync(
  'docs/RULES.md',
  `# Stable finding rule identifiers\n\nUse keys from the exported frozen \`builtInRules\` list in \`rules: {id: false}\`.\nUnknown ids fail with ERR_CONFIG. Credential and mixed encoded/scanner rules\nrequire \`allowCredentialDisable: true\`. A disabled rule does not suppress\nanother rule's overlapping finding. Rules gate automatic built-in findings;\nexplicit findings and custom callbacks retain caller policy. See [API](API.md#rule-type-and-field-policy).\n\nRegenerate with \`node experiments/issue-118/generate-rule-catalog.mjs\`.\n\n${[
    ...rules,
  ]
    .sort()
    .map((rule) => `- \`${rule}\``)
    .join('\n')}\n`
);
