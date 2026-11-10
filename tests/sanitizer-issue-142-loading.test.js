import { itUnless, nodeCliUnavailable } from './helpers/skip.js';
import { describe, it, expect } from 'test-anywhere';
import { readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
import * as credentials from '../src/credentials-entry.js';
// Registers the personal features in this process, as a shared test runner
// or an application that imports both entries does.
import '../src/index.js';

// Synthetic value, assembled at run time so secret scanners skip the source.
const GH = ['ghp_', 'Zx9Qw7Er5Ty3Ui1Op0As', '2Df4Gh6Jk8Lz0Xc2Vb4N'].join('');
const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
const nodeOnly =
  nodeCliUnavailable ??
  (process.versions.bun ? 'measures Node.js module loading' : null);

// Transitive static imports of a source module, as repository paths.
function staticImports(entry) {
  const seen = new Set();
  const visit = (file) => {
    if (seen.has(file)) {
      return;
    }
    seen.add(file);
    if (!file.endsWith('.js')) {
      return;
    }
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(
      /^(?:import|export)\b[^'"]*?from\s*['"]([^'"]+)['"]|^import\s*['"]([^'"]+)['"]/gms
    )) {
      const specifier = match[1] ?? match[2];
      visit(
        specifier.startsWith('.')
          ? relative('.', join(dirname(file), specifier)).replaceAll('\\', '/')
          : specifier
      );
    }
  };
  visit(entry);
  return [...seen];
}

const personal =
  /^(?:@faker-js\/faker|libphonenumber-js|src\/(?:personal|personal-context|personal-evidence|identity|national|national-checks|document-(?!fields)[a-z-]+|proper-names|strict|strict-attributes|fake|fake-entities|fake-names|specimens|russian-declension)\.js$)/;

describe('credentials entry point (issue 137)', () => {
  it('is exported with import, require and default conditions', () => {
    for (const key of ['.', './credentials']) {
      expect(Object.keys(packageJson.exports[key])).toEqual([
        'types',
        'import',
        'require',
        'default',
      ]);
    }
    expect(packageJson.exports['./credentials'].import).toBe(
      './src/credentials-entry.js'
    );
  });

  it('does not statically import personal-data modules', () => {
    const loaded = staticImports('src/credentials-entry.js');
    expect(loaded.filter((name) => personal.test(name))).toEqual([]);
    // The main entry still registers them.
    const full = staticImports('src/index.js');
    expect(full.includes('src/personal-features.js')).toBe(true);
    expect(full.includes('@faker-js/faker')).toBe(true);
  });

  it('masks credentials and leaves personal data alone', async () => {
    const text = `token: ${GH} mail john@example.com`;
    const expected = 'token: [REDACTED] mail john@example.com';
    expect(credentials.sanitize(text).text).toBe(expected);
    expect(credentials.createSyncSanitizer().sanitize(text).text).toBe(
      expected
    );
    expect((await credentials.createSanitizer().sanitize(text)).text).toBe(
      expected
    );
    const findings = credentials.inspect(text);
    expect(findings.every((finding) => finding.category === 'credential')).toBe(
      true
    );
    expect([...new Set(findings.map((finding) => finding.start))]).toEqual([7]);
    expect(credentials.REDACTED).toBe('[REDACTED]');
    expect(typeof credentials.knownSecretsFromEnv).toBe('function');
  });

  it('rejects options that need the personal-data modules', () => {
    const code = (run) => {
      try {
        run();
      } catch (error) {
        return error.code;
      }
      return undefined;
    };
    expect(
      code(() => credentials.sanitize('x', { credentialsOnly: false }))
    ).toBe('ERR_CONFIG');
    expect(
      code(() =>
        credentials.createSyncSanitizer({ transformation: { mode: 'fake' } })
      )
    ).toBe('ERR_CONFIG');
    // The root entry is loaded in this process, so its personal features are
    // registered; the credentials entry still rejects these options.
    for (const options of [
      { properNames: 'capitalized' },
      { properNames: 'off' },
      { scripts: ['Cyrl'] },
    ]) {
      expect(code(() => credentials.sanitize('x', options))).toBe('ERR_CONFIG');
    }
  });

  itUnless(nodeOnly)(
    'loads without personal modules and within a start-up budget',
    () => {
      const probe = (entry) => {
        const result = spawnSync(
          process.execPath,
          [
            '--input-type=module',
            '--eval',
            `import { registerHooks } from 'node:module';
const urls = new Set();
registerHooks({ resolve(specifier, context, next) {
  const resolved = next(specifier, context);
  urls.add(resolved.url);
  return resolved;
} });
const start = performance.now();
await import(${JSON.stringify(entry)});
console.log(JSON.stringify({ ms: performance.now() - start, urls: [...urls] }));`,
          ],
          { encoding: 'utf8' }
        );
        expect(result.stderr).toBe('');
        return JSON.parse(result.stdout);
      };
      const fastest = (entry) => {
        const runs = [probe(entry), probe(entry), probe(entry)];
        return runs.reduce((best, run) => (run.ms < best.ms ? run : best));
      };
      const light = fastest(
        '@link-foundation/sensitive-data-sanitizer/credentials'
      );
      const full = fastest('@link-foundation/sensitive-data-sanitizer');
      expect(
        light.urls.filter((url) =>
          /faker|libphonenumber|\/src\/(?:personal|personal-context|document-entities|fake|fake-names|national)\.js$/.test(
            url
          )
        )
      ).toEqual([]);
      expect(light.urls.length < full.urls.length * 0.75).toBe(true);
      // Faker and libphonenumber alone take about half of the full start-up.
      expect(light.ms < full.ms * 0.75).toBe(true);
      const required = spawnSync(
        process.execPath,
        [
          '--eval',
          "const api = require('@link-foundation/sensitive-data-sanitizer/credentials'); console.log(typeof api.sanitize, typeof require('@link-foundation/sensitive-data-sanitizer').sanitize);",
        ],
        { encoding: 'utf8' }
      );
      expect(required.stdout.trim()).toBe('function function');
    }
  );
});
