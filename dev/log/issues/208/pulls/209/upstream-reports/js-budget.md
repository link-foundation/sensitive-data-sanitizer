## Summary

15 networked installs in the template's workflows and composite actions run **without** a `run-with-budget-warning.sh` budget. `tests/ci-timeouts.test.js` cannot notice, because it:

1. checks only `release.yml` (`keeps every declared step budget under the job backstop` reads `releaseWorkflow` only), so budgets in `example-app.yml`, `workflows.yml`, `security.yml` and `links.yml` are never compared with their job's `timeout-minutes`;
2. ignores local composite actions (`uses: ./.github/actions/...`), whose budgets and step `timeout-minutes` spend the caller job's clock once per call;
3. matches `run-with-budget-warning\.sh\s+(\S+)\s+"([^"]+)"`, which skips a quoted wrapper path such as `bash "$ROOT/scripts/run-with-budget-warning.sh" 300 "label" ...` (the Python template uses that form in `release.yml`);
4. has no rule that a networked install must own a budget.

An install that stalls on the registry hangs silently until `timeout-minutes`, and the job then concludes **cancelled**, not failed, without the wrapper's titled error and process list — the false result that the budget model exists to prevent.

## Evidence (template head `74de898`)

Unbudgeted installs found by parsing the workflow YAML (`run:` lines with `npm ci|install`, `npx --yes`, `pip install`, `curl`, ... not wrapped by the budget script):

```
example-app.yml:web-build: "Install app dependencies": npm ci --prefix examples/universal-app --no-audit --no-fund
example-app.yml:desktop-package: "Install app dependencies": npm ci --prefix examples/universal-app --no-audit --no-fund
example-app.yml:android-build: "Install app dependencies": npm ci --prefix examples/universal-app --no-audit --no-fund
example-app.yml:ios-build: "Install app dependencies": npm ci --prefix examples/universal-app --no-audit --no-fund
example-app.yml:preview-regen: "Install example app dependencies": npm ci --prefix examples/universal-app --no-audit --no-fund
example-app.yml:preview-regen: "Install browser automation dependencies": npm install --no-save --package-lock=false --no-audit --no-fund browser-commander@0.8.1 playwright@1.59.1
release.yml:changeset-check: "Install dependencies": npm ci
release.yml:lint: "Check for secrets": npx --yes -p secretlint@13.0.7 -p @secretlint/secretlint-rule-preset-recommend@13.0.7 node scripts/check-secrets.mjs
release.yml:lint: "Install dependencies": npm ci
release.yml:test: "Install dependencies (runtime tests and native fixtures)": npm ci
release.yml:test: "Install native CI adapter dependencies": npm ci --prefix .github/actions/artifact-transport --ignore-scripts --no-audit --no-fund
release.yml:instant-release: "Install dependencies": npm ci
release.yml:changeset-pr: "Install dependencies": npm ci
workflows.yml:artifact-roundtrip: "Install pinned artifact dependencies": npm ci --prefix .github/actions/artifact-transport --ignore-scripts --no-audit --no-fund
.github/actions/artifact-transport: "Install pinned artifact SDK": npm ci --prefix "$ACTION_DIRECTORY" --ignore-scripts --no-audit --no-fund
```

## Reproduction

1. In `release.yml`, add to any job a step `run: bash "$GITHUB_WORKSPACE/scripts/run-with-budget-warning.sh" 99999 "huge" true` (quoted path), or add a 99999-second budget to `workflows.yml`, or to `.github/actions/artifact-transport/action.yml`.
2. `npm test -- tests/ci-timeouts.test.js` still passes, although the budget is far above the job's `timeout-minutes`.
3. Remove the wrapper from `release.yml`'s test job `npm ci` (it is already absent): nothing fails.

## Workaround

Wrap each install: `run: bash scripts/run-with-budget-warning.sh 240 "Dependency install" npm ci`, and re-check the job sum by hand.

## Suggested fix

Applied downstream in link-foundation/sensitive-data-sanitizer#209 (`tests/ci-timeouts.test.js`):

```js
// Count a quoted wrapper path too.
const BUDGET_PATTERN = /run-with-budget-warning\.sh["']?\s+(\S+)\s+"([^"]+)"/g;

// Check every workflow, not only release.yml.
const workflowFiles = readdirSync('.github/workflows')
  .filter((name) => /\.ya?ml$/.test(name))
  .map((name) => `.github/workflows/${name}`);

// Charge each call of a local composite action to the calling job, ANDing
// the caller's `if:` with the composite step's own condition.
if (uses.startsWith('./') && !stack.includes(uses)) {
  const action = readCompositeAction(uses); // runs.using === 'composite'
  if (action) budgets.push(...getStepsBudgets(action.runs.steps, [], stepCondition, [...stack, uses]));
}

// Every networked install owns a budget; offline installs are exempt.
const INSTALL_COMMAND =
  /(^|[\s;&|(])(npm\s+(ci|install|i)\b|npx\s+(--yes|-y)\b|pipx\s+install\b|pip3?\s+install\b|uv\s+pip\s+install\b|bun\s+install\b|deno\s+(install|cache)\b|curl\b|wget\b|apt-get\s+install\b|brew\s+install\b)/;
const OFFLINE_INSTALL = /--no-index\b|--offline\b/;
function findUnbudgetedInstalls(steps, where) {
  const findings = [];
  for (const step of steps ?? []) {
    const lines = String(step.run ?? '').replace(/\s*\\\n\s*/g, ' ').split('\n')
      .map((line) => line.trim()).filter((line) => line && !line.startsWith('#'));
    for (const line of lines) {
      if (INSTALL_COMMAND.test(line) && !OFFLINE_INSTALL.test(line) &&
          !/run-with-budget-warning\.sh["']?\s+\S+\s+"[^"]+"/.test(line)) {
        findings.push(`${where}: "${step.name ?? step.uses}" runs ${line}`);
      }
    }
  }
  return findings;
}
// expect(findings over all workflows and .github/actions/*).toEqual([])
```

Then wrap the 15 installs above (60–300 s is ample for `npm ci` on hosted runners) and keep each job's sum ≤ 70% of `timeout-minutes`.
