import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'test-anywhere';
import { parse } from 'yaml';
import {
  checkPackages,
  collectPackages,
  fetchDeprecation,
  render,
} from '../scripts/check-deprecated-packages.mjs';

const tarball = (name, version) =>
  `https://registry.npmjs.org/${name}/-/${name.split('/').pop()}-${version}.tgz`;

function registry(documents, calls = []) {
  return async (url) => {
    calls.push(url);
    const next = documents[url];
    const value = typeof next === 'function' ? next() : next;
    if (value === undefined) {
      return { ok: false, status: 404, statusText: 'Not Found' };
    }
    if (typeof value === 'number') {
      return { ok: false, status: value, statusText: 'Error' };
    }
    return { ok: true, status: 200, json: async () => value };
  };
}

const URL = (name, version) =>
  `https://registry.npmjs.org/${name.replace('/', '%2F')}/${version}`;

describe('collectPackages', () => {
  it('lists each installed registry version once', () => {
    const packages = collectPackages({
      packages: {
        '': { name: 'root', version: '1.0.0' },
        'node_modules/a': { version: '1.0.0', resolved: tarball('a', '1.0.0') },
        'node_modules/b/node_modules/a': {
          version: '1.0.0',
          resolved: tarball('a', '1.0.0'),
        },
        'node_modules/@s/c': {
          version: '2.0.0',
          resolved: tarball('@s/c', '2.0.0'),
        },
        'node_modules/alias': {
          name: 'real',
          version: '3.0.0',
          resolved: tarball('real', '3.0.0'),
        },
        'compat/local': { name: 'local', version: '1.0.0' },
        'node_modules/local': { resolved: 'compat/local', link: true },
        'node_modules/git': {
          version: '1.0.0',
          resolved: 'git+ssh://git@github.com/o/r.git#abc',
        },
        'node_modules/x/node_modules/bundled': {
          version: '1.0.0',
          inBundle: true,
        },
      },
    });
    expect(packages.map((p) => `${p.name}@${p.version}`)).toEqual([
      '@s/c@2.0.0',
      'a@1.0.0',
      'real@3.0.0',
    ]);
    assert.equal(packages.find((p) => p.name === 'a').paths.length, 2);
  });

  it('rejects a lockfile without a packages map', () => {
    expect(() => collectPackages({ dependencies: {} })).toThrow(/packages/);
  });
});

describe('fetchDeprecation', () => {
  const quick = { backoffMs: 0 };

  it('returns the live deprecation message', async () => {
    const fetchFn = registry({
      [URL('a', '1.0.0')]: { version: '1.0.0', deprecated: 'use b' },
      [URL('@s/c', '2.0.0')]: { version: '2.0.0' },
    });
    expect(
      await fetchDeprecation({ name: 'a', version: '1.0.0' }, { fetchFn })
    ).toBe('use b');
    expect(
      await fetchDeprecation({ name: '@s/c', version: '2.0.0' }, { fetchFn })
    ).toBe('');
  });

  it('retries a transient failure and then answers', async () => {
    let attempts = 0;
    const calls = [];
    const fetchFn = registry(
      {
        [URL('a', '1.0.0')]: () =>
          (attempts += 1) < 3 ? 503 : { version: '1.0.0' },
      },
      calls
    );
    expect(
      await fetchDeprecation(
        { name: 'a', version: '1.0.0' },
        { fetchFn, ...quick }
      )
    ).toBe('');
    assert.equal(calls.length, 3);
  });

  it('fails without retrying a missing version', async () => {
    const calls = [];
    await assert.rejects(
      fetchDeprecation(
        { name: 'gone', version: '1.0.0' },
        { fetchFn: registry({}, calls), ...quick }
      ),
      /404/
    );
    assert.equal(calls.length, 1);
  });

  it('fails after the last retry', async () => {
    await assert.rejects(
      fetchDeprecation(
        { name: 'a', version: '1.0.0' },
        { fetchFn: registry({ [URL('a', '1.0.0')]: 502 }), ...quick }
      ),
      /502/
    );
  });
});

describe('render', () => {
  const pkg = { name: 'a', version: '1.0.0', paths: ['node_modules/a'] };

  it('warns about a deprecation without failing by default', async () => {
    const result = await checkPackages([pkg], {
      fetchFn: registry({
        [URL('a', '1.0.0')]: { version: '1.0.0', deprecated: 'no::longer' },
      }),
    });
    const rendered = render('package-lock.json', result);
    expect(rendered.failed).toBe(false);
    assert.equal(rendered.annotations.length, 1);
    expect(rendered.annotations[0]).toMatch(
      /^::warning file=package-lock\.json/
    );
    expect(rendered.summary).toMatch(/\| a@1\.0\.0 \| no::longer \|/);
    expect(render('package-lock.json', result, { fail: true }).failed).toBe(
      true
    );
  });

  it('fails closed when a package goes unanswered', async () => {
    const result = await checkPackages([pkg], {
      fetchFn: registry({}),
      backoffMs: 0,
    });
    const rendered = render('package-lock.json', result);
    assert.equal(result.errors.length, 1);
    expect(rendered.failed).toBe(true);
    expect(rendered.annotations[0]).toMatch(/^::error /);
  });

  it('escapes workflow commands in registry text', () => {
    const rendered = render(
      'lock',
      {
        checked: 1,
        deprecated: [{ ...pkg, message: 'x\n::error::injected' }],
        errors: [],
      },
      {}
    );
    expect(rendered.annotations[0]).not.toMatch(/\n/);
    expect(rendered.annotations[0]).toMatch(/x%0A::error::injected$/);
  });
});

describe('security workflow', () => {
  it('checks every audited lockfile against the live registry', () => {
    const workflow = parse(
      readFileSync('.github/workflows/security.yml', 'utf8')
    );
    const job = workflow.jobs['npm-audit'];
    const step = job.steps.find((s) => s.name === 'Check live deprecations');
    expect(step.run).toMatch(
      /^bash "\$GITHUB_WORKSPACE\/scripts\/run-with-budget-warning\.sh" \d+ "[^"]+" node "\$GITHUB_WORKSPACE\/scripts\/check-deprecated-packages\.mjs" package-lock\.json$/
    );
    expect(step['working-directory']).toBe('${{ matrix.directory }}');
    expect(step.env.DEPRECATED_FAIL).toMatch(/schedule/);
    assert.ok(workflow.on.schedule);
  });
});
