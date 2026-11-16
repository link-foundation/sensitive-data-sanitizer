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
  const install = action.runs.steps.find(
    (step) => step.name === 'Install reviewed npm'
  );
  const restore = action.runs.steps.find(
    (step) => step.name === 'Restore requested package cache with current npm'
  );
  const installer = readFileSync('scripts/install-reviewed-npm.sh', 'utf8');
  const npmVersion = install.run.match(
    /install-reviewed-npm\.sh (\d+\.\d+\.\d+)$/
  )[1];
  assert.equal(node.with['node-version-file'], '.nvmrc');
  assert.ok(semver.valid(readFileSync('.nvmrc', 'utf8').trim()));
  assert.ok(
    semver.satisfies(npmVersion, manifest.devEngines.packageManager.version)
  );
  // Both installs (global prefix and the Node installation) skip scripts.
  assert.equal(
    installer.match(/install --global [^\n]*--ignore-scripts/g)?.length,
    1
  );
  assert.match(
    installer,
    /install --global --prefix "\$\{node_prefix\}" \\\n\s+"npm@\$\{version\}" --ignore-scripts/
  );
  assert.equal(node.with['package-manager-cache'], false);
  assert.equal(restore.with.cache, '${{ inputs.cache }}');
});
