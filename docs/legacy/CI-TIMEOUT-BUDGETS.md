# CI Timeout Budgets

`timeout-minutes` is a backstop, never the deadline.

## Why a backstop is not enough

GitHub reports a job killed by `timeout-minutes` as **cancelled**, not
**failed**. `scripts/check-pipeline-status.sh` turns an unexplained cancellation
into an error. It excuses a cancellation only when the tested commit is no
longer the branch head _and_ that specific job has a literal
`cancel-in-progress: true`; `false`, inherited defaults, expressions, and
unreadable workflow configuration all fail closed. Before this per-job check,
a moved pull request branch could make a genuine suite timeout look like a
harmless superseded run. Even on `main`, the resulting error could not say which
deadline was blown, because no step owned a deadline.

Reproduction:

```yaml
jobs:
  demo:
    runs-on: ubuntu-latest
    timeout-minutes: 1
    steps:
      - name: Slow suite
        run: sleep 120
```

Pushed on a non-default branch this yields conclusion `cancelled`, the
annotation `The job has exceeded the maximum execution time of 1m0s`, and only
`::warning::Cancelled jobs: demo`. Nothing is red.

The failure mode is not hypothetical. In `link-assistant/formal-ai` run
31937348472 a test job spent 133 seconds on unbudgeted setup, started a step
whose 480-second budget would have expired at 09:09:44.9Z, and was killed by
the 600-second job cap at 09:09:43.6Z — 1.3 seconds too early for the budget to
fire. The job reported `cancelled`, the run reported `cancelled`, and the
dependent release workflow reported `skipped`.

## Per-test timeouts do not bound a suite

`bun test --timeout 30000` and `node --test --test-timeout=30000` bound a
**single test** at 30 seconds. They do not bound the suite: 25 tests that each
take 29 seconds pass every per-test check and still blow a 10-minute job cap.
Keep them — a hung test is worth catching early — but do not treat them as a
suite deadline.

## The rule

Every long step owns an explicit budget, and every budget expires before the
job's backstop fires.

- **`run:` steps** wrap their command in
  [`scripts/run-with-budget-warning.sh`](../../scripts/run-with-budget-warning.sh):

  ```yaml
  - name: Run tests (Node.js)
    shell: bash
    run: bash scripts/run-with-budget-warning.sh 300 "Node.js test suite" npm test
  ```

- **`uses:` steps** cannot be wrapped, so they declare a step-level
  `timeout-minutes`. An exhausted _step_ budget fails the step; only an
  exhausted _job_ cap cancels the job.

  ```yaml
  - name: Build Docker image (no push)
    timeout-minutes: 20
    uses: docker/build-push-action@v7
  ```

## What the wrapper does

`scripts/run-with-budget-warning.sh SECONDS LABEL COMMAND [ARG...]`:

- Runs the command in its own **process group** (`set -m`). `npm test` and
  `bun test` spawn workers, and killing only the direct child leaves orphans
  holding the runner — which is also why `timeout(1)` is not sufficient.
- Emits `::warning` at 70% of the budget, while the overrun can still be acted
  on.
- On expiry emits
  `::error title=<label> exceeded its execution budget::…`, sends `SIGTERM` to
  the group, waits a grace period, then sends `SIGKILL`. On GitHub-hosted
  runners it can use passwordless `sudo` to reach privileged descendants and
  reports any process it still could not terminate.
- Captures and relays stdout and stderr separately, so a surviving descendant
  cannot inherit the CI step's pipe and hold the step open.
- Keeps wrapper-owned state under `RUNNER_TEMP`, independently of a wrapped
  command that clears its own `TMPDIR`.
- Exits **124** on termination, matching `timeout(1)`. Otherwise it passes the
  command's own exit code through unchanged.

Overrides: `BUDGET_WARN_PERCENT` (default 70), `BUDGET_GRACE_SECONDS`
(default 10), `BUDGET_KILL_SECONDS` (default 5), `BUDGET_POLL_SECONDS`
(default 1), `BUDGET_SUDO_KILL` (default 1), `BUDGET_CAPTURE_OUTPUT`
(default 1), `BUDGET_STATE_PARENT` (defaults to `RUNNER_TEMP`, then `TMPDIR`),
`BUDGET_VERBOSE` (default 0), `BUDGET_ATTEMPTS` (default 1) and
`BUDGET_RETRY_DELAY_SECONDS` (default 10).

`BUDGET_ATTEMPTS` runs a failing or overrunning command again, each attempt
under the full budget, after a pause of `BUDGET_RETRY_DELAY_SECONDS`. Every
`npm ci` step sets `BUDGET_ATTEMPTS: '2'`: one host's registry connection can
hang an install for its whole budget while the next attempt takes seconds. An
overrun that a later attempt can still recover from is reported as a warning,
and each retry adds a `LABEL retried` warning, so a step that passes on its
retry carries no error annotation. The last overrun is an error as before.

On Windows runners Git Bash may not support process groups; the wrapper falls
back to signalling the direct child.

## The invariant

`tests/ci-timeouts.test.js` parses every workflow and composite action as YAML
and asserts, for every job that declares budgets, that

- each individual budget is at most **70%** (`MAX_BUDGET_SHARE_PERCENT`) of the
  job's `timeout-minutes`, and
- the budgets that can run in the same job sum to at most 70% of that cap,
  leaving headroom for the unbudgeted setup (checkout, toolchain caches) that
  runs on the same job clock.

How budgets are counted:

- **A retried step counts every attempt.** A step with `BUDGET_ATTEMPTS: '2'`
  and a 60s budget is charged 2 × 60s plus one 10s pause, 130s.
- **A step `timeout-minutes` counts as a budget.** `Setup Bun` and both
  `Setup Deno` attempts have two minutes each, so a hung download fails its
  step instead of running the job into its backstop.
- **Composite actions count per call.** A `uses: ./.github/actions/NAME` step
  contributes every budget inside that action, recursively, each time it is
  called: a job that calls `artifact-transport` twice pays its reviewed-npm and
  SDK install budgets twice.
- **Conditions are summed unless provably exclusive.** Each budget keeps the
  `if:` of its step (and of the composite call it sits in). Two budgets are
  treated as alternatives only when their conditions compare the same
  expression with different literals (`matrix.runtime == 'node'` vs
  `matrix.runtime == 'bun'`); anything else, such as an event check and a
  matrix leg, is assumed to run together.
- **The wrapper may be called through any path**, including a quoted
  `"$GITHUB_WORKSPACE/scripts/run-with-budget-warning.sh"` from a step with a
  `working-directory`.

A second policy test, "wraps every networked install in workflows and composite
actions", fails on any `npm ci`, `npm install`, `pip install`, `pipx install`,
`uv pip install`, `curl`/`wget` download or similar networked install that is
not inside the wrapper. Registry outages and slow mirrors are the most common
way a job silently drifts into its backstop, so installs get budgets too.

This invariant is what finds the _next_ occurrence rather than the one that
already failed. In the reference incident the same sweep immediately surfaced a
job at 1415s of a 1500s cap and another with no `timeout-minutes` at all,
neither of which was involved in the original failure.

## Current budgets

Concurrent sums as computed by the test. Every reviewed-npm install
(`.github/actions/setup-node`) is 120s and every dependency install is 60s
unless listed, and every `npm ci` is charged twice plus its pause (130s for a
60s budget). The test charges every reviewed-npm install in full, although
the second and later ones in a job only verify the version.
`node experiments/issue-208/dump-budgets.mjs FILE.yml:JOB` prints the budgets
behind a row.

The reviewed-npm budget holds on Windows because
`scripts/install-reviewed-npm.sh` installs once, into the Node directory that
both the top-level and nested npm fall back to. Installing into the configured
global prefix as well took 47–63s there. The budget is 120s. A macOS Intel
runner took 47s for one install, which warned at 70% of the former 60s budget,
and a Windows runner then took 65s, which warned at 70% of the following 90s
budget, while the same job's `npm ci` took a normal 8s. The bounded retries on
a stalled registry end after about 52s
(`experiments/issue-208/npm-fetch-stall.mjs`), well under the 84s warning.

| Workflow: job                        | Backstop | Sum   | Largest step budgets                                      |
| ------------------------------------ | -------- | ----- | --------------------------------------------------------- |
| `release.yml: test`                  | 18 min   | 750s  | Node.js 300s, Bun 200s, Deno 200s (legs exclusive)        |
| `release.yml: session-publication`   | 9 min    | 370s  | corpus 120s                                               |
| `release.yml: docker-build`          | 30 min   | 1200s | image build 20 min                                        |
| `release.yml: release`               | 72 min   | 3010s | install 2 × 240s, npm publish 1800s, smoke test 600s      |
| `release.yml: instant-release`       | 65 min   | 2650s | npm publish 1800s, smoke test 600s                        |
| `release.yml: docker-publish-config` | 45 min   | 1800s | npm availability wait 1800s                               |
| `release.yml: docker-publish-build`  | 35 min   | 1450s | image build and push 20 min, artifact transport 250s      |
| `security.yml: npm-audit`            | 10 min   | 240s  | live deprecation check 120s                               |
| `security.yml: python-audit`         | 10 min   | 360s  | requirements audit 90s, benchmark install 90s             |
| `example-app.yml: web-build`         | 18 min   | 750s  | two artifact-transport calls 250s each                    |
| `example-app.yml: preview-tools`     | 12 min   | 470s  | two `npm ci` 130s each                                    |
| `example-app.yml: preview-regen`     | 20 min   | 720s  | preview `gh` install 90s                                  |
| `workflows.yml: zizmor`              | 10 min   | 300s  | zizmor 5 min                                              |
| `workflows.yml: artifact-roundtrip`  | 30 min   | 1250s | four artifact-transport calls 250s each, SDK install 130s |
| `workflows.yml: shellcheck`          | 10 min   | 60s   | pinned ShellCheck venv install 60s                        |
| `links.yml: link-checker`            | 10 min   | 310s  | pinned lychee install 60s, artifact transport 250s        |

Run `node --test tests/ci-timeouts.test.js` after changing a budget or a
`timeout-minutes`; the failure message names the job and the budgets it summed.

## Reference

`link-assistant/formal-ai` PR #1018 (`scripts/run-with-budget-warning.sh`, the
`MAX_BUDGET_SHARE_PERCENT` invariant, and the incident reconstruction).
