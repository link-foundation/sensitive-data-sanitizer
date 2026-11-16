import { describe, it, expect } from 'test-anywhere';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { waitForVersionOnRegistry } from '../scripts/publish-retry.mjs';
import { parseArgs as parseWaitArgs } from '../scripts/wait-for-npm.mjs';

const releaseWorkflow = readWorkflow('.github/workflows/release.yml');
const linksWorkflow = readWorkflow('.github/workflows/links.yml');
const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
const workflowFiles = readdirSync('.github/workflows')
  .filter((name) => /\.ya?ml$/.test(name))
  .sort()
  .map((name) => `.github/workflows/${name}`);

function readWorkflow(filePath) {
  return readFileSync(filePath, 'utf8').replaceAll('\r\n', '\n');
}

function normalizeNewlines(text) {
  return text.replaceAll('\r\n', '\n');
}

function listWorkflowJobs(workflow) {
  const normalizedWorkflow = normalizeNewlines(workflow);
  const jobsStart = normalizedWorkflow.indexOf('\njobs:\n');
  const jobsBody = jobsStart === -1 ? '' : normalizedWorkflow.slice(jobsStart);
  const matches = jobsBody.matchAll(/^[ ]{2}([a-zA-Z0-9_-]+):\s*$/gm);

  return Array.from(matches, (match) => match[1]);
}

function getJobBlock(workflow, jobName) {
  const lines = normalizeNewlines(workflow).split('\n');
  const jobHeader = `  ${jobName}:`;
  const start = lines.findIndex((line) => line === jobHeader);

  if (start === -1) {
    return '';
  }

  const end = lines.findIndex(
    (line, index) => index > start && /^[ ]{2}[a-zA-Z0-9_-]+:\s*$/.test(line)
  );

  return lines.slice(start, end === -1 ? lines.length : end).join('\n');
}

function getTimeoutMinutes(workflow, jobName) {
  const block = getJobBlock(workflow, jobName);
  const timeout = block.match(/^[ ]{4}timeout-minutes:\s*(\d+)\s*$/m);

  return timeout ? Number(timeout[1]) : undefined;
}

function getStepBlock(workflow, stepName) {
  const lines = normalizeNewlines(workflow).split('\n');
  const start = lines.findIndex(
    (line) => line.trim() === `- name: ${stepName}`
  );

  if (start === -1) {
    return '';
  }

  const end = lines.findIndex(
    (line, index) => index > start && /^\s*- (name|uses|run):/.test(line)
  );

  return lines.slice(start, end === -1 ? lines.length : end).join('\n');
}

// A step declares its deadline either by wrapping a command in
// run-with-budget-warning.sh or, for `uses:` steps that cannot be wrapped,
// with a step-level timeout-minutes. A `uses: ./.github/actions/NAME` step
// contributes every budget inside that composite action for each call:
// a call runs all of its steps again, so the job clock pays every time.
// Every budget keeps the `if:` condition of the step it belongs to, so that
// provably exclusive legs (a matrix leg, say) are not summed as a sequence.
const BUDGET_PATTERN = /run-with-budget-warning\.sh\s+(\S+)\s+"([^"]+)"/g;

function resolveBudget(raw, envs) {
  if (/^\d+$/.test(raw)) {
    return { seconds: Number(raw) };
  }

  const variableName = raw.replace(/^["']|["']$/g, '').replace(/^\$/, '');
  const resolved = envs
    .map((env) => env?.[variableName])
    .find((value) => value !== undefined);

  if (resolved !== undefined && /^\d+$/.test(String(resolved))) {
    return { seconds: Number(resolved) };
  }

  return {
    seconds: NaN,
    source: `"${variableName}" does not resolve to an integer in the step, job, or workflow env`,
  };
}

function readCompositeAction(reference) {
  const directory = reference.replace(/^\.\//, '').replace(/\/$/, '');
  const file = ['action.yml', 'action.yaml']
    .map((name) => `${directory}/${name}`)
    .find((candidate) => existsSync(candidate));

  if (!file) {
    return undefined;
  }

  const action = parse(readFileSync(file, 'utf8'));

  return action?.runs?.using === 'composite' ? action : undefined;
}

function getStepsBudgets(steps, envs, condition, stack = []) {
  const budgets = [];

  for (const step of steps ?? []) {
    // A composite step runs only when its caller does, so both apply.
    const stepCondition = [condition, normalizeCondition(step.if)]
      .filter(Boolean)
      .join(' && ');
    const stepEnvs = [step.env, ...envs];

    for (const match of String(step.run ?? '').matchAll(BUDGET_PATTERN)) {
      budgets.push({
        label: [...stack, match[2]].join(' > '),
        condition: stepCondition,
        ...resolveBudget(match[1], stepEnvs),
      });
    }

    if (step['timeout-minutes'] !== undefined) {
      budgets.push({
        label: [...stack, 'step timeout-minutes'].join(' > '),
        seconds: Number(step['timeout-minutes']) * 60,
        condition: stepCondition,
      });
    }

    const uses = String(step.uses ?? '');

    if (uses.startsWith('./') && !stack.includes(uses)) {
      const action = readCompositeAction(uses);

      if (action) {
        budgets.push(
          ...getStepsBudgets(action.runs.steps, [], stepCondition, [
            ...stack,
            uses,
          ])
        );
      }
    }
  }

  return budgets;
}

function getStepBudgetSeconds(workflowText, jobName) {
  const workflow = parse(normalizeNewlines(workflowText));
  const job = workflow?.jobs?.[jobName];

  return job ? getStepsBudgets(job.steps, [job.env, workflow.env], '') : [];
}

// GitHub status functions say *whether* a step runs after earlier results,
// not which leg of the job it belongs to, so they never make steps exclusive.
const STATUS_FUNCTION = /^!?\s*(always|success|failure|cancelled)\(\)$/;

function normalizeCondition(condition) {
  return String(condition ?? '')
    .replace(/^\s*\$\{\{([\s\S]*)\}\}\s*$/, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

// Only a top-level `&&` chain is split. A condition with `||` or parentheses
// stays a single opaque conjunct, which can never be proven exclusive.
function getConjuncts(condition) {
  if (condition === '') {
    return [];
  }
  if (/\|\||[()]/.test(condition.replace(/\b\w+\(\)/g, ''))) {
    return [condition];
  }

  return condition
    .split('&&')
    .map((conjunct) => conjunct.trim())
    .filter((conjunct) => conjunct && !STATUS_FUNCTION.test(conjunct));
}

function getComparisons(conjuncts) {
  return conjuncts
    .map((conjunct) =>
      conjunct.match(/^([A-Za-z_][\w.-]*)\s*(==|!=)\s*'([^']*)'$/)
    )
    .filter(Boolean)
    .map(([, subject, operator, value]) => ({ subject, operator, value }));
}

// Two conditions are exclusive only when one requires `x == 'a'` and the
// other `x == 'b'` (or `x != 'a'`) for the same `x`. Anything else -- an
// event check next to a matrix check, say -- may run in the same job.
function areExclusive(left, right) {
  return getComparisons(left).some((a) =>
    getComparisons(right).some(
      (b) =>
        a.subject === b.subject &&
        ((a.operator === '==' && b.operator === '==' && a.value !== b.value) ||
          (a.operator !== b.operator && a.value === b.value))
    )
  );
}

// The largest a job can spend is the heaviest set of condition groups that
// can all run together: unconditional budgets plus every group that no other
// chosen group excludes. Groups are few, so every subset is checked.
function getConcurrentBudgetSeconds(budgets) {
  const groups = new Map();

  for (const budget of budgets) {
    groups.set(
      budget.condition,
      (groups.get(budget.condition) ?? 0) + budget.seconds
    );
  }

  const entries = Array.from(groups, ([condition, seconds]) => ({
    conjuncts: getConjuncts(condition),
    seconds,
  }));

  if (entries.length > 16) {
    return entries.reduce((sum, entry) => sum + entry.seconds, 0);
  }

  let largest = 0;

  for (let mask = 0; mask < 1 << entries.length; mask += 1) {
    const chosen = entries.filter((_, index) => mask & (1 << index));
    const compatible = chosen.every((entry, index) =>
      chosen
        .slice(index + 1)
        .every((other) => !areExclusive(entry.conjuncts, other.conjuncts))
    );

    if (compatible) {
      largest = Math.max(
        largest,
        chosen.reduce((sum, entry) => sum + entry.seconds, 0)
      );
    }
  }

  return largest;
}

describe('CI timeout policy', () => {
  it('sets timeout-minutes for every release workflow job', () => {
    const expectedTimeouts = {
      'detect-changes': 5,
      'session-publication': 6,
      'test-compilation': 5,
      'check-file-line-limits': 5,
      'version-check': 5,
      'changeset-check': 10,
      lint: 10,
      test: 15,
      'validate-docs': 5,
      release: 65,
      'instant-release': 65,
      'docker-build': 30,
      'docker-publish-config': 45,
      'docker-publish-build': 35,
      'docker-publish': 30,
      'changeset-pr': 10,
      'pipeline-status': 5,
      'release-preflight': 5,
    };

    expect(listWorkflowJobs(releaseWorkflow).sort()).toEqual(
      Object.keys(expectedTimeouts).sort()
    );

    for (const [jobName, timeout] of Object.entries(expectedTimeouts)) {
      expect(getTimeoutMinutes(releaseWorkflow, jobName)).toBe(timeout);
    }
  });

  it('sets timeout-minutes for every link workflow job', () => {
    expect(listWorkflowJobs(linksWorkflow).sort()).toEqual([
      'link-checker',
      'pipeline-status',
    ]);
    expect(getTimeoutMinutes(linksWorkflow, 'link-checker')).toBe(10);
    expect(getTimeoutMinutes(linksWorkflow, 'pipeline-status')).toBe(5);
  });

  it('parses workflow files checked out with Windows line endings', () => {
    const crlfWorkflow = [
      'name: CRLF fixture',
      '',
      'jobs:',
      '  first-job:',
      '    timeout-minutes: 5',
      '  second-job:',
      '    timeout-minutes: 10',
      '',
    ].join('\r\n');

    expect(listWorkflowJobs(crlfWorkflow)).toEqual(['first-job', 'second-job']);
    expect(getTimeoutMinutes(crlfWorkflow, 'second-job')).toBe(10);
  });

  it('caps individual Node.js and Bun tests at 30 seconds', () => {
    expect(packageJson.scripts.test).toBe(
      'node --test --test-timeout=30000 tests/*.test.js'
    );
    expect(readFileSync('scripts/run-test-shard.mjs', 'utf8')).toContain(
      "bun: ['test', '--timeout', '30000']"
    );
  });

  it('documents that the Bun flag bounds a test and not the suite', () => {
    const bunStep = getStepBlock(releaseWorkflow, 'Run tests (Bun)');

    expect(bunStep).toContain('per-test bound and does not bound the suite');
  });
});

// `timeout-minutes` on a job is a backstop, never the deadline: GitHub reports
// a job it kills as *cancelled*, not *failed*. Every long step therefore
// declares its own budget, and every budget must expire with room to spare
// before the backstop fires.
const MAX_BUDGET_SHARE_PERCENT = 70;

describe('CI execution budgets', () => {
  it('lets publish and Docker waits complete their default propagation window', async () => {
    let publishWaitSeconds = 0;
    await waitForVersionOnRegistry({
      verify: async () => false,
      sleepFn: async (ms) => {
        publishWaitSeconds += ms / 1000;
      },
      log: () => {},
    });
    const wait = parseWaitArgs([], {});
    const dockerWaitSeconds = (wait.maxAttempts - 1) * wait.sleepSeconds;
    for (const job of ['release', 'instant-release', 'docker-publish-config']) {
      const label =
        job === 'docker-publish-config'
          ? 'Docker npm availability wait'
          : 'npm publish and registry verification';
      const pollingSeconds =
        job === 'docker-publish-config'
          ? dockerWaitSeconds
          : publishWaitSeconds;
      const budget = getStepBudgetSeconds(releaseWorkflow, job).find(
        (entry) => entry.label === label
      );
      // Keep room for requests and publishing outside the sleep-only window.
      expect(budget.seconds).toBeGreaterThan(pollingSeconds + 60);
    }
  });

  it('keeps every declared step budget under the job backstop', () => {
    const jobsWithBudgets = workflowFiles.flatMap((file) => {
      const text = readWorkflow(file);
      const workflow = parse(text);

      return Object.entries(workflow.jobs ?? {}).map(([jobName, job]) => ({
        jobName: `${file.replace('.github/workflows/', '')}:${jobName}`,
        budgets: getStepBudgetSeconds(text, jobName),
        backstop: job['timeout-minutes'],
      }));
    });
    const budgeted = jobsWithBudgets.filter((job) => job.budgets.length > 0);

    // Every workflow with a dependency install now owns its budgets; a job
    // dropping out of this list means a budget (or a whole step) vanished.
    for (const jobName of [
      'release.yml:test',
      'release.yml:lint',
      'release.yml:release',
      'release.yml:docker-build',
      'example-app.yml:desktop-package',
      'example-app.yml:preview-tools',
      'security.yml:python-audit',
      'security.yml:npm-audit',
      'workflows.yml:artifact-roundtrip',
    ]) {
      expect(budgeted.map((job) => job.jobName)).toContain(jobName);
    }

    const violations = [];

    for (const { jobName, budgets, backstop } of budgeted) {
      if (typeof backstop !== 'number') {
        violations.push(`${jobName}: declares budgets but no timeout-minutes`);
        continue;
      }

      const allowedSeconds = Math.floor(
        (backstop * 60 * MAX_BUDGET_SHARE_PERCENT) / 100
      );

      for (const budget of budgets) {
        // A budget the parser cannot read is itself a violation: silently
        // skipping it would convert every future syntax change into a gap
        // nobody sees.
        if (!Number.isFinite(budget.seconds)) {
          violations.push(
            `${jobName}: "${budget.label}" declares a budget this check cannot read (${budget.source}); the step is not covered by the invariant`
          );
          continue;
        }

        if (budget.seconds > allowedSeconds) {
          violations.push(
            `${jobName}: "${budget.label}" budget ${budget.seconds}s exceeds ${allowedSeconds}s (${MAX_BUDGET_SHARE_PERCENT}% of the ${backstop}min backstop)`
          );
        }
      }

      const totalSeconds = getConcurrentBudgetSeconds(
        budgets.filter((budget) => Number.isFinite(budget.seconds))
      );

      if (totalSeconds > allowedSeconds) {
        violations.push(
          `${jobName}: budgets total ${totalSeconds}s, exceeding ${allowedSeconds}s (${MAX_BUDGET_SHARE_PERCENT}% of the ${backstop}min backstop)`
        );
      }
    }

    expect(violations).toEqual([]);
  });

  it('warns at the same share of the budget that the invariant allows', () => {
    const budgetScript = readWorkflow('scripts/run-with-budget-warning.sh');

    expect(budgetScript).toContain(
      `BUDGET_WARN_PERCENT:-${MAX_BUDGET_SHARE_PERCENT}`
    );
  });
});

// Fixtures for the grouping rules behind the invariant: exclusive legs,
// unconditional-plus-largest-group totals, env resolution, unreadable
// budgets.
describe('step budget grouping', () => {
  // A single matrix job runs exactly one leg, so legs guarded by distinct
  // `if:` conditions never share a job clock. Raising one leg past its
  // allowance while the others still fit must not be rejected as a sequence.
  it('sums exclusive matrix legs as alternatives, not as a sequence', () => {
    const workflow = [
      'name: Fixture',
      '',
      'jobs:',
      '  test:',
      '    timeout-minutes: 15',
      '    strategy:',
      '      matrix:',
      '        runtime: [node, bun, deno]',
      '    steps:',
      '      - name: Run tests (Node.js)',
      "        if: matrix.runtime == 'node'",
      '        run: bash scripts/run-with-budget-warning.sh 331 "Node.js test suite" npm test',
      '      - name: Run tests (Bun)',
      "        if: matrix.runtime == 'bun'",
      '        run: bash scripts/run-with-budget-warning.sh 200 "Bun test suite" bun test',
      '      - name: Run tests (Deno)',
      "        if: matrix.runtime == 'deno'",
      '        run: bash scripts/run-with-budget-warning.sh 100 "Deno test suite" deno test',
      '',
    ].join('\n');

    const budgets = getStepBudgetSeconds(workflow, 'test');

    expect(budgets.map((budget) => budget.seconds).sort()).toEqual([
      100, 200, 331,
    ]);
    expect(getConcurrentBudgetSeconds(budgets)).toBe(331);
  });

  it('still fails when a single leg exceeds the allowance', () => {
    const workflow = [
      'name: Fixture',
      '',
      'jobs:',
      '  test:',
      '    timeout-minutes: 15',
      '    steps:',
      '      - name: Run tests (Node.js)',
      "        if: matrix.runtime == 'node'",
      '        run: bash scripts/run-with-budget-warning.sh 700 "Node.js test suite" npm test',
      '',
    ].join('\n');

    const budgets = getStepBudgetSeconds(workflow, 'test');

    expect(budgets[0].seconds).toBe(700);
    expect(budgets[0].seconds).toBeGreaterThan(630);
  });

  it('adds unconditional budgets to the largest conditional group', () => {
    const workflow = [
      'name: Fixture',
      '',
      'jobs:',
      '  job:',
      '    timeout-minutes: 15',
      '    steps:',
      '      - name: Install',
      '        run: bash scripts/run-with-budget-warning.sh 240 "install" npm install',
      '      - name: Full leg',
      "        if: matrix.test-suite == 'full'",
      '        run: bash scripts/run-with-budget-warning.sh 1440 "full" npm test',
      '      - name: Spec leg',
      "        if: matrix.test-suite == 'specification'",
      '        run: bash scripts/run-with-budget-warning.sh 660 "spec" npm test',
      '',
    ].join('\n');

    const budgets = getStepBudgetSeconds(workflow, 'job');

    expect(getConcurrentBudgetSeconds(budgets)).toBe(1680);
  });

  it('resolves a "$VAR" budget from the step, job, or workflow env', () => {
    const workflow = [
      'name: Fixture',
      '',
      'env:',
      "  WORKFLOW_BUDGET: '50'",
      '',
      'jobs:',
      '  job:',
      '    timeout-minutes: 15',
      '    env:',
      "      JOB_BUDGET: '60'",
      '    steps:',
      '      - name: Step env wins',
      '        env:',
      "          STEP_BUDGET: '70'",
      '        run: bash scripts/run-with-budget-warning.sh "$STEP_BUDGET" "step" npm test',
      '      - name: Job env resolves',
      '        run: bash scripts/run-with-budget-warning.sh "$JOB_BUDGET" "job" npm test',
      '      - name: Workflow env resolves',
      '        run: bash scripts/run-with-budget-warning.sh "$WORKFLOW_BUDGET" "workflow" npm test',
      '',
    ].join('\n');

    const budgets = getStepBudgetSeconds(workflow, 'job');

    expect(budgets.map((budget) => budget.seconds)).toEqual([70, 60, 50]);
  });

  it('reports a budget it cannot read and never skips one silently', () => {
    const workflow = [
      'name: Fixture',
      '',
      'jobs:',
      '  test:',
      '    timeout-minutes: 15',
      '    steps:',
      '      - name: Run tests',
      '        env:',
      "          DENO_TEST_BUDGET_SECONDS: '900'",
      '        run: bash scripts/run-with-budget-warning.sh "$DENO_TEST_BUDGET_SECONDS" "Deno test suite" deno test',
      '      - name: Unresolvable',
      '        run: bash scripts/run-with-budget-warning.sh "$NOWHERE_BUDGET" "missing var" npm test',
      '',
    ].join('\n');

    const budgets = getStepBudgetSeconds(workflow, 'test');

    expect(budgets[0].seconds).toBe(900);
    expect(Number.isFinite(budgets[1].seconds)).toBe(false);
    expect(budgets[1].source).toContain('"NOWHERE_BUDGET"');
  });
});

// Fixtures for the grouping rules: a condition that is merely
// *different* is not exclusive, composite actions spend their caller's
// clock, and no dependency install may run without its own budget.
describe('step budget grouping across conditions and composite actions', () => {
  const fixture = (steps) =>
    [
      'name: Fixture',
      '',
      'jobs:',
      '  job:',
      '    timeout-minutes: 15',
      '    steps:',
      ...steps,
      '',
    ].join('\n');

  it('sums conditions that can hold together, such as an event and a leg', () => {
    const budgets = getStepBudgetSeconds(
      fixture([
        '      - name: PR only',
        "        if: github.event_name == 'pull_request'",
        '        run: bash scripts/run-with-budget-warning.sh 100 "pr" npm test',
        '      - name: Node leg',
        "        if: matrix.runtime == 'node'",
        '        run: bash scripts/run-with-budget-warning.sh 200 "node" npm test',
        '      - name: Bun leg',
        "        if: matrix.runtime == 'bun'",
        '        run: bash scripts/run-with-budget-warning.sh 150 "bun" bun test',
      ]),
      'job'
    );

    // pr + node; the two runtime legs still exclude each other.
    expect(getConcurrentBudgetSeconds(budgets)).toBe(300);
  });

  it('adds a narrower condition to the broader one it implies', () => {
    const budgets = getStepBudgetSeconds(
      fixture([
        '      - name: Node leg',
        "        if: matrix.runtime == 'node'",
        '        run: bash scripts/run-with-budget-warning.sh 200 "node" npm test',
        '      - name: Node on Linux',
        "        if: matrix.runtime == 'node' && matrix.os == 'ubuntu-24.04'",
        '        run: bash scripts/run-with-budget-warning.sh 100 "linux" npm test',
        '      - name: Deno leg',
        "        if: matrix.runtime == 'deno'",
        '        run: bash scripts/run-with-budget-warning.sh 250 "deno" deno test',
      ]),
      'job'
    );

    expect(getConcurrentBudgetSeconds(budgets)).toBe(300);
  });

  it('never treats status functions or || conditions as exclusive', () => {
    const budgets = getStepBudgetSeconds(
      fixture([
        '      - name: Always',
        '        if: always()',
        '        run: bash scripts/run-with-budget-warning.sh 50 "always" true',
        '      - name: Leg or event',
        "        if: matrix.runtime == 'node' || github.event_name == 'push'",
        '        run: bash scripts/run-with-budget-warning.sh 60 "either" true',
        '      - name: Bun after success',
        "        if: success() && matrix.runtime == 'bun'",
        '        run: bash scripts/run-with-budget-warning.sh 70 "bun" true',
      ]),
      'job'
    );

    expect(getConcurrentBudgetSeconds(budgets)).toBe(180);
  });

  it('charges every call of a local composite action to the job', () => {
    const budgets = getStepBudgetSeconds(
      fixture([
        '      - uses: ./.github/actions/setup-node',
        '      - name: Upload',
        '        uses: ./.github/actions/artifact-transport',
        '      - name: Download on main',
        "        if: github.ref == 'refs/heads/main'",
        '        uses: ./.github/actions/artifact-transport',
      ]),
      'job'
    );
    const setupNode = getStepBudgetSeconds(
      fixture(['      - uses: ./.github/actions/setup-node']),
      'job'
    );
    const transport = getStepBudgetSeconds(
      fixture(['      - uses: ./.github/actions/artifact-transport']),
      'job'
    );

    expect(setupNode.length).toBeGreaterThan(0);
    // The transport action runs setup-node itself before its SDK install.
    expect(transport.length).toBe(setupNode.length + 1);
    expect(budgets.length).toBe(setupNode.length + 2 * transport.length);
    expect(getConcurrentBudgetSeconds(budgets)).toBe(
      getConcurrentBudgetSeconds(setupNode) +
        2 * getConcurrentBudgetSeconds(transport)
    );
  });
});

// An install talks to a registry or a download host, which is exactly what
// can hang for minutes without output. Each one owns a budget, so a stall
// fails as a titled error that lists the stuck processes; an unbudgeted one
// runs into the job timeout, which cancels the job and can lose its log.
const INSTALL_COMMAND =
  /(^|[\s;&|(])(npm\s+(ci|install|i)\b|npx\s+(--yes|-y)\b|pipx\s+install\b|pip3?\s+install\b|uv\s+pip\s+install\b|bun\s+install\b|deno\s+(install|cache)\b|deno\s+test\b.*--no-run|curl\b|wget\b|apt-get\s+install\b|brew\s+install\b)/;
// Offline installs only copy what an earlier, budgeted step fetched.
const OFFLINE_INSTALL = /--no-index\b|--offline\b/;

function findUnbudgetedInstalls(steps, where) {
  const findings = [];

  for (const step of steps ?? []) {
    const logicalLines = String(step.run ?? '')
      .replace(/\s*\\\n\s*/g, ' ')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'));

    for (const line of logicalLines) {
      if (
        INSTALL_COMMAND.test(line) &&
        !OFFLINE_INSTALL.test(line) &&
        !/run-with-budget-warning\.sh\s+\S+\s+"[^"]+"/.test(line)
      ) {
        findings.push(`${where}: "${step.name ?? step.uses}" runs ${line}`);
      }
    }
  }

  return findings;
}

describe('dependency install budgets', () => {
  it('wraps every networked install in workflows and composite actions', () => {
    const findings = workflowFiles.flatMap((file) => {
      const workflow = parse(readWorkflow(file));

      return Object.entries(workflow.jobs ?? {}).flatMap(([jobName, job]) =>
        findUnbudgetedInstalls(job.steps, `${file}:${jobName}`)
      );
    });
    const actions = readdirSync('.github/actions', { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => `./.github/actions/${entry.name}`);

    for (const reference of actions) {
      const action = readCompositeAction(reference);

      if (action) {
        findings.push(...findUnbudgetedInstalls(action.runs.steps, reference));
      }
    }

    expect(findings).toEqual([]);
  });

  it('flags a bare install and accepts wrapped or offline ones', () => {
    expect(
      findUnbudgetedInstalls(
        [
          { name: 'bare', run: 'npm ci' },
          { name: 'continued', run: 'pipx install \\\n  uv==0.13.7' },
          { name: 'npx', run: 'npx --yes -p tool@1.0.0 tool' },
          {
            name: 'wrapped',
            run: 'bash scripts/run-with-budget-warning.sh 60 "Dependency install" npm ci',
          },
          {
            name: 'offline',
            run: 'uv pip install --system --no-index -r requirements.txt',
          },
          { name: 'comment', run: '# npm ci is wrapped below' },
          { name: 'script', run: 'npm run build' },
        ],
        'fixture'
      )
    ).toEqual([
      'fixture: "bare" runs npm ci',
      'fixture: "continued" runs pipx install uv==0.13.7',
      'fixture: "npx" runs npx --yes -p tool@1.0.0 tool',
    ]);
  });
});
