// Runs sanitize() on the competitor phrase samples handled by personal-evidence.js.
import { sanitize } from '../../src/index.js';
const samples = [
  'My name is Bond.',
  'my name is Harry Potter and I live here',
  'Dear Clifford,\n blah',
  'Dear Sir,\nhello',
  'Hi team,',
  'blah blah. Thanks -Jon',
  'All the best,\n\n--Meg C.',
  'Thank you ..Risemamy McCrubben',
  'Thanks!',
  'Best,\nThe Support Team',
  '# Contact: Bob Stone <bob.stone@example.com>',
  'login snoop pw biggreenhat',
  'u: snoop\np: biggreenhat',
  'user: thislibrary\npass: hunter22x',
  'john.doe[AT]protectai[DOT]com',
  'john at gmail.com',
  'jane [at] host [dot] org',
  'meet at example.com',
  'look at docs.python.org now',
  'PO Box 123456',
  'P.O. Box 77, Austin',
  'skype (dean.malmgren)',
  'skype: dean.malmgren.',
  'my card: 1234 5678 8765 4321.',
  'AMEX card 3714 496353 98431',
  'Ship to ZIP 94105 today.',
  'ZIPs 10001 and 30301',
  'New York City, NY 10002',
  'version 2, CA 12345',
  'card games 12 cards',
];
for (const s of samples) {
  console.log(JSON.stringify(s), '=>', JSON.stringify(sanitize(s).text));
}
