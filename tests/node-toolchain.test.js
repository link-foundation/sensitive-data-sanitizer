import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { it } from 'test-anywhere';
import { parse } from 'yaml';
import semver from 'semver';

it('installs the npm release required by the manifest on the reviewed Node release', () => {
  const manifest = JSON.parse(readFileSync('package.json', 'utf8'));
  const action = parse(
    readFileSync('.github/actions/setup-node/action.yml', 'utf8')
  );
  const node = action.runs.steps[0];
  const install = action.runs.steps[1];
  const npmVersion = install.run.match(/npm@([\d.]+)/)[1];
  assert.equal(node.with['node-version-file'], '.nvmrc');
  assert.ok(semver.valid(readFileSync('.nvmrc', 'utf8').trim()));
  assert.ok(
    semver.satisfies(npmVersion, manifest.devEngines.packageManager.version)
  );
  assert.match(install.run, /--global.*--ignore-scripts/);
  assert.equal(node.with['package-manager-cache'], false);
  assert.equal(action.runs.steps[2].with.cache, '${{ inputs.cache }}');
});
