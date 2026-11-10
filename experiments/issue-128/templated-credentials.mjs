// Shows which template, variable and mask values are kept and which literal
// credentials are still redacted. Usage: node experiments/issue-128/templated-credentials.mjs
import { sanitize } from '../../src/index.js';

// Built at runtime so secret scanners do not flag sample URIs.
const pg = ['postgres', '://'].join('');

for (const text of [
  `${pg}alice:\${DB_PASSWORD}@db.internal/app`,
  `${pg}alice:$DB_PASSWORD@db.internal/app`,
  `${pg}<username>:<password>@db.internal/app`,
  'curl -u "${username}":"${password}"',
  'curl --user "$1:$2"',
  'curl -H "Authorization: Bearer <Openverse API token>"',
  'curl -H "Authorization: Bearer XXXXXXXXXXXX"',
  'curl -H "Authorization: Token **********"',
  'curl --user neo4j:[PASSWORD]',
  'password: $${PYPI_PASSWORD}',
  'password: ${link}',
  'mysqladmin --password="$DB_PASS"',
  // Literal values below must stay redacted.
  'secret = "hunter2"',
  `${pg}alice:s3cr3tPass@db.internal/app`,
  'curl --user neo4j:realpass',
  'Authorization: Bearer <x>abc123def456ghi789',
  'password: [REDACTED_BUT_NOT]x9',
  'curl -u admin:<pass>word',
]) {
  console.log(`${text.padEnd(55)} => ${sanitize(text).text}`);
}
