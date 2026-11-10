// Lists the rules whose template or mask values are dropped, using the
// value-free `template-value` debug event.
// Usage: node experiments/issue-128/templated-rules.mjs
import { sanitize } from '../../src/index.js';

const pg = ['postgres', '://'].join('');
for (const text of [
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
]) {
  const rules = [];
  sanitize(text, {
    debug: (event) => {
      if (event.event === 'template-value') {
        rules.push(event.rule);
      }
    },
  });
  console.log(text.padEnd(55), rules.join(', '));
}
