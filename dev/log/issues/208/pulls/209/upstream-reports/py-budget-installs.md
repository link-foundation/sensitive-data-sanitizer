## Summary

Four networked npm installs run **without** a `run-with-budget-warning.sh` budget (template head `c532c17`):

```
release.yml:lint: "Install pinned npm": npm install --global npm@12.2.2
security.yml:npm-audit: "Install pinned npm": npm install --global npm@12.2.2
workflows.yml:artifact-roundtrip: "Install pinned npm": npm install --global npm@12.2.2
workflows.yml:artifact-roundtrip: "Install pinned artifact dependencies": npm ci --ignore-scripts --no-audit --no-fund
```

A registry stall in these steps runs until the job's `timeout-minutes`. The job then concludes **cancelled**, not failed, and has no titled error naming the stuck process. Avoiding that false result is the whole point of the budget model (issue #60).

`tests/test_workflows.py::test_step_deadlines_expire_before_the_job_timeout_they_sit_under` cannot catch this:

1. There is no rule that an install must be budgeted.
2. `job_step_deadline_seconds` (`tests/workflow_helpers.py`) counts only `*_BUDGET_SECONDS: N` env lines at step indentation and step `timeout-minutes`. A literal budget (`run-with-budget-warning.sh 300 "label" ...`) or a job-level or workflow-level env budget is silently not counted.
3. Budgets inside local composite actions are not charged to the calling job.

## Reproduction

1. Add `run: bash scripts/run-with-budget-warning.sh 99999 "huge" true` to any job: `pytest tests/test_workflows.py` still passes.
2. Leave the four installs above as they are: nothing fails.

## Workaround

Wrap each install by hand:

```yaml
env:
  NPM_INSTALL_BUDGET_SECONDS: 120
run: bash scripts/run-with-budget-warning.sh "$NPM_INSTALL_BUDGET_SECONDS" "Install pinned npm" npm install --global npm@12.2.2
```

## Suggested fix

- Wrap the four installs. Keep each job's total at or below 70% of its `timeout-minutes`; in `artifact-roundtrip`, check the sum.
- Read budgets from the wrapper call itself, so literal, env and quoted-path forms are all counted:
  `re.finditer(r'run-with-budget-warning\.sh["\']?\s+(\S+)\s+"([^"]+)"', run)`, and resolve `$VAR` from the step, then job, then workflow `env`. Fail when a value does not resolve to an integer, never skip it.
- Add an install policy:

```python
INSTALL = re.compile(r'(^|[\s;&|(])(npm\s+(ci|install|i)\b|npx\s+(--yes|-y)\b|pipx\s+install\b|pip3?\s+install\b|uv\s+(pip\s+install|sync)\b|curl\b|wget\b)')
OFFLINE = re.compile(r'--no-index\b|--offline\b')
WRAPPED = re.compile(r'run-with-budget-warning\.sh["\']?\s+\S+\s+"[^"]+"')
# For every workflow job step and every local composite action step:
# join "\\\n" continuations, drop comments, and fail on each line where
# INSTALL matches and neither OFFLINE nor WRAPPED does.
```

The JS version is in `tests/ci-timeouts.test.js` (`findUnbudgetedInstalls`) of link-foundation/sensitive-data-sanitizer#209.
