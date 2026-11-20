import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { generateKeyPairSync } from 'node:crypto';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { tokenWithChecksum } from '../../src/token-checksum.js';

const { privateKey } = generateKeyPairSync('ed25519', {
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});
const connection = new URL('postgresql://localhost/example');
connection.username = 'demo';
connection.password = 'violet-canoe';

const fixtures = [
  ['credential-en', true, 'password: violet canoe'],
  ['credential-ru', true, 'Пароль: фиолетовый-берег'],
  ['credential-zh', true, '密码：紫色小舟'],
  ['credential-hi', true, 'पासवर्ड: बैंगनी-नाव'],
  ['person-en', true, 'Full name: Verena Mora'],
  ['person-ru', true, 'Имя: Алина Мороз'],
  ['person-zh', true, '姓名：王小明'],
  ['person-hi', true, 'नाम: आरव शर्मा'],
  ['email', true, 'Contact: someone@unknown.example'],
  ['uri-credentials', true, connection.href],
  [
    'pem',
    true,
    '-----BEGIN PRIVATE KEY-----\nY2Fub2U=\n-----END PRIVATE KEY-----',
  ],
  ['pem-complete', true, privateKey],
  [
    'provider-token',
    true,
    tokenWithChecksum('ghp_', 'Ab0123CD45ef6789GHi0JKl1mn2345'),
  ],
  ['template', false, 'password=${PASSWORD}'],
  ['ordinary-en', false, 'The purple canoe reached shore.'],
  ['ordinary-ru', false, 'Лодка причалила к берегу.'],
  ['ordinary-zh', false, '小船停在码头。'],
  ['ordinary-hi', false, 'नाव किनारे पर रुकी।'],
];

const binary = process.argv[2];
if (!binary) {
  throw new Error('Pass the path to a local Gitleaks binary.');
}
const cli = fileURLToPath(
  new URL('../../bin/sensitive-data-sanitizer.js', import.meta.url)
);
const root = mkdtempSync(join(tmpdir(), 'sds-comparison-'));

function run(binary, args, statuses) {
  const result = spawnSync(binary, args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 512 * 1024,
  });
  if (!statuses.includes(result.status)) {
    throw new Error(`Comparison command failed with status ${result.status}.`);
  }
  return result.stdout;
}

try {
  const inputs = join(root, 'fixtures');
  mkdirSync(inputs);
  for (const [name, , text] of fixtures) {
    writeFileSync(join(inputs, `${name}.txt`), `${text}\n`);
  }

  const report = join(root, 'gitleaks.json');
  const gitleaks = resolve(binary);
  const version = run(gitleaks, ['version'], [0]).trim();
  run(
    gitleaks,
    [
      'dir',
      inputs,
      '--redact=100',
      '--report-format',
      'json',
      '--report-path',
      report,
    ],
    [0, 1]
  );
  const upstreamFiles = new Set(
    JSON.parse(readFileSync(report, 'utf8')).map(({ File }) => basename(File))
  );

  const output = run(
    process.execPath,
    [cli, 'scan', inputs, '--format', 'json'],
    [0, 1]
  );
  const parsed = JSON.parse(output);
  if (!parsed.complete) {
    throw new Error('The sanitizer reported incomplete input.');
  }
  const localFiles = new Set(
    parsed.results
      .filter(({ findings }) => findings.length)
      .map(({ path }) => basename(path))
  );
  const results = fixtures.map(([name, sensitive]) => ({
    fixture: name,
    sensitive,
    sanitizer: localFiles.has(`${name}.txt`),
    gitleaks: upstreamFiles.has(`${name}.txt`),
  }));
  console.log(JSON.stringify({ gitleaks: version, results }, null, 2));
} finally {
  rmSync(root, { recursive: true, force: true });
}
