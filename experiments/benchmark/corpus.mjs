import { reviewFixtures } from '../../tests/fixtures/sanitizer-review.js';
import { localeVocabulary } from '../../src/locales.js';
import { nameExamples } from '../../src/names.js';

function annotated(id, marked, category = 'personal') {
  let text = '',
    cursor = 0;
  const spans = [];
  for (const match of marked.matchAll(/\[\[([\s\S]*?)\]\]/g)) {
    text += marked.slice(cursor, match.index);
    spans.push({
      start: text.length,
      end: text.length + match[1].length,
      category,
    });
    text += match[1];
    cursor = match.index + match[0].length;
  }
  return { id, text: text + marked.slice(cursor), spans };
}
function reviewed([id, text, expected]) {
  const pieces = expected.split('[REDACTED]');
  let cursor = pieces[0].length;
  const spans = [];
  for (let i = 1; i < pieces.length; i++) {
    const end = pieces[i] ? text.indexOf(pieces[i], cursor) : text.length;
    if (end < cursor) {
      throw new Error(`Invalid fixture ${id}`);
    }
    spans.push({
      start: cursor,
      end,
      category:
        id.startsWith('name') ||
        ['address', 'iban', 'passport', 'inn', 'mac', 'handle'].includes(id) ||
        id.startsWith('phone') ||
        id.startsWith('path')
          ? 'personal'
          : 'credential',
    });
    cursor = end + pieces[i].length;
  }
  return { id: `review/${id}`, text, spans };
}
export const corpus = [
  ...reviewFixtures.map(reviewed),
  ...localeVocabulary.flatMap(([locale, credential, ...fields]) => {
    const values = [
      'Private Person',
      '42 Example Avenue',
      '31.12.1990',
      'AB1234567',
      '09123456789',
      'private@unknown.example',
      'Private Company',
      'private-user',
    ];
    return [
      ...fields.map((field, i) =>
        annotated(`field/${locale}/${i}`, `${field}: [[${values[i]}]]`)
      ),
      annotated(
        `credential/${locale}`,
        `${credential}: [[hunter2]]`,
        'credential'
      ),
    ];
  }),
  ...nameExamples.map(([locale, name]) =>
    annotated(`name/${locale}`, `Yesterday [[${name}]] called.`)
  ),
  annotated('email', 'Send to [[alice.smith@private.example]] please.'),
  annotated('ssn', 'SSN [[123-45-6789]]'),
  annotated('credit-card', 'Card [[4111 1111 1111 1111]]'),
  annotated('phone-international', 'Call [[+44 20 7946 0958]]'),
  annotated('ip-private', 'Client [[10.27.18.95]]'),
  annotated('ipv6', 'Client [[2001:4860:dead:beef::1234]]'),
  annotated(
    'doppler',
    `Value [[dp.pt.${'Ab1cD2eF3gH4'.repeat(3)}Z9yX8wV]]`,
    'credential'
  ),
  annotated('github', `Value [[ghp_${'Ab1cD2'.repeat(6)}]]`, 'credential'),
  annotated(
    'slack',
    `Value [[xoxb-${'1234567890-'.repeat(3)}AbCdEfGhIjKlMnOpQrStUvWx]]`,
    'credential'
  ),
  annotated('aws', `Access [[AKIA${'AB12'.repeat(4)}]]`, 'credential'),
  annotated(
    'stripe',
    `Value [[sk_live_${'Ab1cD2eF'.repeat(4)}]]`,
    'credential'
  ),
  annotated(
    'pem',
    '[[-----BEGIN PRIVATE KEY-----\nYWJjZGVmZ2hpamtsbW5vcA==\n-----END PRIVATE KEY-----]]',
    'credential'
  ),
  annotated(
    'base64',
    `Encoded [[${Buffer.from('Password: Tr0ub4dor&3').toString('base64')}]]`,
    'credential'
  ),
  annotated(
    'percent',
    'Encoded [[%70%61%73%73%77%6f%72%64%3a%20%68%75%6e%74%65%72%32]]',
    'credential'
  ),
  annotated(
    'hex-entropy',
    'value="[[9b2c5d0e8f7a1346f0d28e7a4b69c531]]"',
    'credential'
  ),
  ...[
    ['arithmetic', 'add(2, 3) equals 5; 42 tests passed.'],
    ['counts', 'token_count=12345; total_tokens=42; password_length=16'],
    ['public-person', 'Albert Einstein worked on relativity.'],
    ['public-org', 'Microsoft and Google published docs.'],
    ['public-resolver', 'DNS 1.1.1.1 and 8.8.4.4'],
    ['documentation-ip', 'Examples use 192.0.2.1 and 203.0.113.42.'],
    ['commit', 'commit 9b2c5d0e8f7a1346f0d28e7a4b69c531'],
    ['mysql-port', 'mysql -P 3306; psql -p 5432'],
    ['empty', ''],
    ['redacted', 'password: [REDACTED]'],
    ['code', 'const maxInputLength = 10485760; await sanitize(text);'],
    ['tool', 'mcp__playwright__browser_navigate; browser_snapshot'],
  ].map(([id, text]) => ({ id: `negative/${id}`, text, spans: [] })),
];
