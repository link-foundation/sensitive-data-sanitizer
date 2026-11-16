import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { describe, it } from 'test-anywhere';
import {
  checkSecrets,
  readTarEntries,
  scanCompressed,
} from '../scripts/check-secrets.mjs';
import { itUnless, sandboxed } from './helpers/skip.js';

function tarEntry(name, content, type = '0') {
  const bytes = Buffer.from(content);
  const header = Buffer.alloc(512);
  header.write(name);
  header.write(`${bytes.length.toString(8).padStart(11, '0')}\0`, 124);
  header.fill(32, 148, 156);
  header.write(type, 156);
  const checksum = header.reduce((sum, byte) => sum + byte, 0);
  header.write(`${checksum.toString(8).padStart(6, '0')}\0 `, 148);
  return Buffer.concat([
    header,
    bytes,
    Buffer.alloc((512 - (bytes.length % 512)) % 512),
  ]);
}
const tar = (...entries) => Buffer.concat([...entries, Buffer.alloc(1024)]);
const token = `gh${'p_'}${'A'.repeat(36)}`;
const refuseToken = (_name, input) => {
  if (input.includes(token)) {
    throw new Error('secret detected');
  }
};

describe('compressed evidence secrets', () => {
  for (const extension of ['log.gz', 'json.gz', 'tar.gz', 'tgz']) {
    it(`scans secrets in ${extension}`, () => {
      const content = /tar.gz|tgz/.test(extension)
        ? tar(tarEntry('evidence.log', token))
        : Buffer.from(token);
      assert.throws(
        () =>
          scanCompressed(
            `evidence.${extension}`,
            gzipSync(content),
            refuseToken
          ),
        /secret detected/
      );
    });
  }
  it('scans every regular tar entry without extracting traversal paths', () => {
    const scanned = [];
    scanCompressed(
      'snapshot.tgz',
      gzipSync(
        tar(
          tarEntry('clean.txt', 'ok'),
          tarEntry('../../outside.log', 'evidence')
        )
      ),
      (name, bytes) => scanned.push([name, bytes.toString()])
    );
    assert.deepEqual(scanned, [
      ['snapshot.tgz/clean.txt', 'ok'],
      ['snapshot.tgz/../../outside.log', 'evidence'],
    ]);
  });
  it('scans gzip nested in tar, including GNU long names', () => {
    const content = tar(
      tarEntry('././@LongLink', 'nested.log.gz\0', 'L'),
      tarEntry('short', gzipSync(token))
    );
    assert.throws(
      () => scanCompressed('snapshot.tgz', gzipSync(content), refuseToken),
      /secret detected/
    );
  });
  it('uses PAX path records when identifying compressed members', () => {
    const record = 'path=nested.log.gz\n';
    const length = record.length + 3;
    const content = tar(
      tarEntry('pax', `${length} ${record}`, 'x'),
      tarEntry('short', gzipSync(token))
    );
    assert.throws(
      () => scanCompressed('snapshot.tgz', gzipSync(content), refuseToken),
      /secret detected/
    );
  });
  it('fails closed on archive formats nested where gzip is expected', () => {
    for (const [name, bytes] of [
      ['bundle.tgz', gzipSync(tar(tarEntry('creds.zip', 'PK')))],
      ['bundle.tgz', gzipSync(tar(tarEntry('inner.tar', tar())))],
      ['creds.zip.gz', gzipSync('PK')],
      ['logs.tar.xz.gz', gzipSync('xz')],
    ]) {
      assert.throws(
        () => scanCompressed(name, bytes, () => {}),
        /Cannot scan nested archive format/,
        name
      );
    }
  });
  it('fails closed on corrupt gzip and truncated or invalid tar', () => {
    assert.throws(() =>
      scanCompressed('bad.gz', Buffer.from('not gzip'), () => {})
    );
    assert.throws(
      () =>
        scanCompressed('bad.tgz', gzipSync(Buffer.from('not tar')), () => {}),
      /Truncated/
    );
    const corrupt = tar(tarEntry('ok', 'data'));
    corrupt[0] ^= 1;
    assert.throws(() => readTarEntries(corrupt), /checksum/);
    assert.throws(
      () => readTarEntries(tar(tarEntry('unsupported', '', 'S'))),
      /Unsupported/
    );
  });
  it('bounds decompression with a tiny finite fixture', () => {
    assert.throws(() =>
      scanCompressed('large.gz', gzipSync(Buffer.alloc(4096)), () => {}, {
        remaining: 1024,
      })
    );
    assert.throws(
      () =>
        scanCompressed(
          'nested.gz',
          gzipSync('ok'),
          () => {},
          { remaining: 1024 },
          4
        ),
      /nesting/
    );
  });
});

function git(cwd, ...args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(result.stderr);
  }
}

/** Track `files` in a fresh repository, scan it, and remove it. */
async function scanRepository(files, check = checkSecrets) {
  const cwd = mkdtempSync(join(tmpdir(), 'check-secrets-'));
  try {
    git(cwd, 'init', '-q');
    const tree = {
      '.secretlintrc.json':
        '{"rules":[{"id":"@secretlint/secretlint-rule-preset-recommend"}]}\n',
      ...files,
    };
    for (const [name, content] of Object.entries(tree)) {
      mkdirSync(join(cwd, dirname(name)), { recursive: true });
      writeFileSync(join(cwd, name), content);
    }
    git(cwd, 'add', '--force', '--', ...Object.keys(tree));
    return await check({ cwd });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

const github = '@secretlint/secretlint-rule-github';

describe('tracked secrets the working-tree scan cannot read', () => {
  itUnless(sandboxed)('finds a secret inside a gzip file', async () => {
    const { findings } = await scanRepository({
      'evidence/run.log.gz': gzipSync(`token=${token}\n`),
    });
    assert.deepEqual(
      findings.map(({ file, line, ruleId }) => [file, line, ruleId]),
      [['evidence/run.log', 1, github]]
    );
    assert.doesNotMatch(JSON.stringify(findings), new RegExp(token));
  });

  itUnless(sandboxed)('finds a secret inside a tar.gz member', async () => {
    const { findings } = await scanRepository({
      'evidence/snapshot.tar.gz': gzipSync(
        tar(tarEntry('ok.txt', 'ok\n'), tarEntry('app/.env', `T=${token}\n`))
      ),
    });
    assert.deepEqual(
      findings.map(({ file, ruleId }) => [file, ruleId]),
      [['evidence/snapshot.tar.gz/app/.env', github]]
    );
  });

  itUnless(sandboxed)('passes clean archives', async () => {
    const result = await scanRepository({
      'evidence/run.log.gz': gzipSync('all tests passed\n'),
      'evidence/snapshot.tgz': gzipSync(tar(tarEntry('a.txt', 'clean\n'))),
    });
    assert.deepEqual(result, { checked: 2, findings: [] });
  });

  itUnless(sandboxed)('fails closed on a corrupt archive', async () => {
    await assert.rejects(
      scanRepository({ 'evidence/run.log.gz': Buffer.from('not gzip') }),
      /evidence\/run\.log\.gz: /
    );
    await assert.rejects(
      scanRepository({
        'evidence/snapshot.tar.gz': gzipSync(Buffer.from('not a tar')),
      }),
      /evidence\/snapshot\.tar\.gz: Truncated tar archive/
    );
  });

  itUnless(sandboxed)('fails closed on an oversized archive', async () => {
    const limited = ({ cwd }) => checkSecrets({ cwd, maxBytes: 1024 });
    await assert.rejects(
      scanRepository(
        { 'evidence/run.log.gz': gzipSync(Buffer.alloc(4096)) },
        limited
      ),
      /evidence\/run\.log\.gz: /
    );
    await assert.rejects(
      scanRepository({ 'evidence/random.log.gz': randomBytes(2048) }, limited),
      /evidence\/random\.log\.gz: Compressed file exceeds scan size limit/
    );
    const fits = await scanRepository(
      { 'evidence/run.log.gz': gzipSync(Buffer.alloc(512)) },
      limited
    );
    assert.deepEqual(fits, { checked: 1, findings: [] });
  });

  itUnless(sandboxed)('rejects archive formats it cannot decode', async () => {
    await assert.rejects(
      scanRepository({ 'evidence/run.zip': Buffer.from('PK\u0003\u0004') }),
      /Cannot scan archive format of evidence\/run\.zip/
    );
  });

  itUnless(sandboxed)(
    'skips archives that .secretlintignore names',
    async () => {
      const secret = gzipSync(tar(tarEntry('.env', `T=${token}\n`)));
      const result = await scanRepository({
        '.secretlintignore': 'immutable/\n',
        'immutable/snapshot.tar.gz': secret,
        'immutable/run.zip': Buffer.from('PK\u0003\u0004'),
        'immutable/bad.log.gz': Buffer.from('not gzip'),
      });
      assert.deepEqual(result, { checked: 0, findings: [] });
    }
  );

  itUnless(sandboxed)(
    'scans tracked files that .gitignore matches',
    async () => {
      const { findings } = await scanRepository({
        '.gitignore': '*.log\n',
        'evidence/run.log': `token=${token}\n`,
      });
      assert.deepEqual(
        findings.map(({ file, ruleId }) => [file, ruleId]),
        [['evidence/run.log', github]]
      );
    }
  );
});
