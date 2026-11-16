#!/usr/bin/env node
/**
 * Find the jobs of a workflow run that never got to test the commit (no
 * runner was acquired, or the job stalled in its setup), and rerun them.
 *
 * When no hosted runner can be acquired (usually macOS arm64 under capacity
 * constraints) GitHub gives up with "The job was not acquired by Runner of
 * type hosted even after multiple attempts". The job ends `cancelled` or
 * `failure` with no runner name and no steps: no code ran, so the result
 * says nothing about the commit.
 *
 * A job can also stall in its setup: a dependency install that hangs on one
 * host (`npm ci` on a macOS runner, say) until a step budget or the job's
 * `timeout-minutes` ends it. The job ran, but stopped before any test step,
 * so its result too says nothing about the commit. Such a job counts as
 * stalled when the step it ended in is a setup step (`Set up …`, `Setup …`,
 * `Install …`, `Prepare … dependencies`, a checkout), no later step ran,
 * no earlier step ran tests, and its check run carries a timeout annotation:
 * GitHub's "exceeded the maximum execution time" or "has timed out", or the
 * "exceeded its execution budget" of scripts/run-with-budget-warning.sh. A
 * job killed by `timeout-minutes` ends `cancelled`, and so does its run.
 *
 * Modes:
 *
 * - `rerun` (default; .github/workflows/rerun-unacquired.yml): reads the
 *   `workflow_run` event and calls "rerun failed jobs" for a failed run whose
 *   failure is fully explained by unacquired or stalled jobs, and for a
 *   cancelled run when at least one job stalled in its setup. It does
 *   nothing when
 *   - no job is unacquired or stalled;
 *   - the run was cancelled and no job stalled (someone cancelled it, and
 *     queued jobs then look unacquired);
 *   - another job failed after running steps (a real failure is never
 *     rerun, and rerunning cannot turn that run green);
 *   - the run already reached its attempt limit, was rerun by someone else,
 *     or a newer run of the same workflow, branch and event exists.
 *   Status gates (`Pipeline Status`) fail because of the jobs they need, so
 *   their own failure does not block the rerun; it is rerun as a dependent.
 * - `report` (scripts/check-pipeline-status.sh): prints the unacquired jobs
 *   of the current attempt, one name per line. JOBS_JSON (a jobs API
 *   response) replaces the API request in tests.
 */
import { readFileSync } from 'node:fs';
import { URLSearchParams, pathToFileURL } from 'node:url';
import { describe, githubApi } from './github-api.mjs';

export const GATE_JOBS = ['Pipeline Status'];
export const MAX_ATTEMPTS = 3;
const FAILED = new Set(['failure', 'cancelled', 'timed_out']);
export const RERUN_CONCLUSIONS = ['failure', 'cancelled', 'timed_out'];
export const SETUP_STEP =
  /^(?:set ?up\b|setup\b|install\b|prepare\b.*\bdependencies\b|wait before retrying\b|run actions\/checkout@|checkout\b)/iu;
const AFTERMATH_STEP = /^(?:post\b|complete job$)/iu;
const TEST_STEP = /\btests?\b/iu;
export const TIMEOUT_ANNOTATION =
  /exceeded the maximum execution time|has timed out after|exceeded its execution budget/iu;

/** A job GitHub gave up on before any runner picked it up. */
export function isUnacquired(job) {
  return (
    (job?.conclusion === 'cancelled' || job?.conclusion === 'failure') &&
    !job.runner_name &&
    (job.steps ?? []).length === 0
  );
}

const started = (step) =>
  step.status === 'in_progress' ||
  (step.status === 'completed' && step.conclusion !== 'skipped');

/**
 * The setup step a failed job ended in, when no test ran, or undefined. It
 * reads only the steps; `confirmStalled` checks that a timeout ended it.
 */
export function stalledSetupStep(job) {
  if (!FAILED.has(job?.conclusion) || isUnacquired(job)) {
    return undefined;
  }
  const steps = (job.steps ?? []).filter(
    (step) => !AFTERMATH_STEP.test(step.name ?? '')
  );
  const ran = steps.filter(started);
  const last = ran.at(-1);
  if (
    !last ||
    last.conclusion === 'success' ||
    !SETUP_STEP.test(last.name ?? '') ||
    ran.some((step) => TEST_STEP.test(step.name ?? ''))
  ) {
    return undefined;
  }
  const after = steps.slice(steps.indexOf(last) + 1);
  return after.some(started) ? undefined : last.name;
}

/**
 * Split the failed jobs of one attempt.
 * @returns {{unacquired: string[], stalled: object[], failed: string[]}}
 *   `stalled` are the jobs that ended in a setup step (still to be
 *   confirmed), `failed` the other jobs that ran and failed, other than
 *   status gates.
 */
export function classifyJobs(jobs, { gateJobs = GATE_JOBS } = {}) {
  const unacquired = [];
  const stalled = [];
  const failed = [];
  for (const job of jobs) {
    if (isUnacquired(job)) {
      unacquired.push(job.name);
    } else if (FAILED.has(job.conclusion) && !gateJobs.includes(job.name)) {
      const step = stalledSetupStep(job);
      if (step) {
        stalled.push({ job, step });
      } else {
        failed.push(job.name);
      }
    }
  }
  return { unacquired, stalled, failed };
}

/** The annotations of a job's check run (the job ID is its check run ID). */
async function annotations(request, repository, job) {
  const body = await request(
    'GET',
    `/repos/${repository}/check-runs/${job.id}/annotations?per_page=100`
  );
  return Array.isArray(body) ? body : [];
}

/**
 * Keep the stalled jobs whose check run says a timeout ended them; the
 * others failed for a reason a rerun does not fix.
 * @returns {Promise<{stalled: string[], failed: string[]}>} `stalled` as
 *   "job (step)" labels.
 */
export async function confirmStalled(request, repository, candidates) {
  const stalled = [];
  const failed = [];
  for (const { job, step } of candidates) {
    const notes = await annotations(request, repository, job);
    const timedOut = notes.some((note) =>
      TIMEOUT_ANNOTATION.test(`${note.title ?? ''} ${note.message ?? ''}`)
    );
    if (timedOut) {
      stalled.push(`${job.name} (${step})`);
    } else {
      failed.push(job.name);
    }
  }
  return { stalled, failed };
}

/** Every job of one run attempt, following pagination. */
export async function listJobs(request, { repository, runId, attempt }) {
  const jobs = [];
  for (let page = 1; ; page++) {
    const body = await request(
      'GET',
      `/repos/${repository}/actions/runs/${runId}/attempts/${attempt}/jobs?per_page=100&page=${page}`
    );
    const batch = body?.jobs ?? [];
    jobs.push(...batch);
    if (batch.length < 100 || jobs.length >= (body.total_count ?? 0)) {
      return jobs;
    }
  }
}

/** Why the run must be left alone, or '' when it can be rerun. */
async function reasonToSkip(request, repository, run, maxAttempts) {
  if (!RERUN_CONCLUSIONS.includes(run.conclusion)) {
    return `the run concluded ${run.conclusion}, not ${RERUN_CONCLUSIONS.join(' or ')}`;
  }
  if (run.run_attempt >= maxAttempts) {
    return `attempt ${run.run_attempt} reached the limit of ${maxAttempts}`;
  }
  const current = await request(
    'GET',
    `/repos/${repository}/actions/runs/${run.id}`
  );
  if (current.status !== 'completed' || current.run_attempt > run.run_attempt) {
    return `the run was already rerun (attempt ${current.run_attempt}, ${current.status})`;
  }
  if (!run.head_branch || !run.workflow_id) {
    return '';
  }
  const query = new URLSearchParams({
    branch: run.head_branch,
    event: run.event,
    per_page: '1',
  });
  const { workflow_runs: latest = [] } = await request(
    'GET',
    `/repos/${repository}/actions/workflows/${run.workflow_id}/runs?${query}`
  );
  if (latest[0] && latest[0].id > run.id) {
    return `newer run ${latest[0].id} of ${run.head_branch} supersedes it`;
  }
  return '';
}

/**
 * Decide on and perform the rerun of one completed run.
 * @returns {Promise<{action: 'rerun'|'skip', reason: string, unacquired: string[], stalled: string[], failed: string[]}>}
 */
export async function rerunUnacquired({
  request,
  repository,
  run,
  maxAttempts = MAX_ATTEMPTS,
  gateJobs = GATE_JOBS,
  log = console.log,
}) {
  const label = `${run.name ?? 'workflow'} run ${run.id} attempt ${run.run_attempt}`;
  let reason = await reasonToSkip(request, repository, run, maxAttempts);
  let unacquired = [];
  let stalled = [];
  let failed = [];
  if (!reason) {
    const jobs = await listJobs(request, {
      repository,
      runId: run.id,
      attempt: run.run_attempt,
    });
    const classified = classifyJobs(jobs, { gateJobs });
    ({ unacquired } = classified);
    const confirmed = await confirmStalled(
      request,
      repository,
      classified.stalled
    );
    stalled = confirmed.stalled;
    failed = [...classified.failed, ...confirmed.failed];
    if (unacquired.length === 0 && stalled.length === 0) {
      reason = 'every failed job ran on a runner';
    } else if (failed.length > 0) {
      reason = `${failed.join(', ')} failed after running steps; fix them and push`;
    } else if (run.conclusion === 'cancelled' && stalled.length === 0) {
      reason =
        'the run was cancelled and no job stalled in its setup, so someone may have cancelled it';
    }
  }
  if (unacquired.length > 0) {
    log(
      `::warning title=Hosted runner not acquired::${label}: ${unacquired.join(', ')}. GitHub could not provide a runner; no code ran.`
    );
  }
  if (stalled.length > 0) {
    log(
      `::warning title=Job stalled in setup::${label}: ${stalled.join(', ')}. A timeout ended the job before any test ran.`
    );
  }
  if (reason) {
    log(`Not rerunning ${label}: ${reason}.`);
    return { action: 'skip', reason, unacquired, stalled, failed };
  }
  await request(
    'POST',
    `/repos/${repository}/actions/runs/${run.id}/rerun-failed-jobs`
  );
  log(
    `Reran the failed jobs of ${label} (${[...unacquired, ...stalled].join(', ')} and their dependents).`
  );
  return { action: 'rerun', reason: '', unacquired, stalled, failed };
}

/** The unacquired jobs of the current attempt, for the status gate. */
export async function reportUnacquired(env, request) {
  const body = env.JOBS_JSON
    ? { jobs: JSON.parse(env.JOBS_JSON).jobs ?? [] }
    : {
        jobs: await listJobs(request, {
          repository: env.GITHUB_REPOSITORY,
          runId: env.GITHUB_RUN_ID,
          attempt: env.GITHUB_RUN_ATTEMPT || '1',
        }),
      };
  return body.jobs.filter(isUnacquired).map((job) => job.name);
}

function client(env) {
  return githubApi({
    token: env.GITHUB_TOKEN || env.GH_TOKEN,
    apiUrl: env.GITHUB_API_URL || undefined,
  });
}

export async function main(argv = process.argv.slice(2), env = process.env) {
  const mode = argv[0] || 'rerun';
  if (mode === 'report') {
    const names = await reportUnacquired(
      env,
      env.JOBS_JSON ? null : client(env)
    );
    for (const name of names) {
      console.log(name);
    }
    return;
  }
  if (mode !== 'rerun') {
    throw new Error(`Unknown mode: ${mode} (expected rerun or report)`);
  }
  const event = JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, 'utf8'));
  if (!event.workflow_run) {
    throw new Error('The event has no workflow_run; run this on workflow_run.');
  }
  await rerunUnacquired({
    request: client(env),
    repository: env.GITHUB_REPOSITORY,
    run: event.workflow_run,
  });
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    const message = describe(error);
    // The status gate wraps a report failure in its own warning.
    if (process.argv[2] === 'report') {
      console.error(message);
    } else {
      console.log(
        `::error title=Rerun of unacquired jobs failed::${message
          .replaceAll('%', '%25')
          .replaceAll('\r', '%0D')
          .replaceAll('\n', '%0A')}`
      );
    }
    process.exitCode = 1;
  });
}
