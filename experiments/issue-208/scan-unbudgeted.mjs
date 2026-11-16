// List workflow steps that run a networked install without a step budget.
//
// Usage: node experiments/issue-208/scan-unbudgeted.mjs <repo-dir>
//
// The workflows are read as YAML data only; nothing from <repo-dir> runs.
// Used to compare this repository with the JS and Python pipeline templates.
import { readdirSync, readFileSync } from 'node:fs';
import { parse } from 'yaml';

const INSTALL =
  /(^|[\s;&|(])(npm\s+(ci|install|i)\b|npx\s+(--yes|-y)\b|pipx\s+install\b|pip3?\s+install\b|uv\s+(pip\s+install|sync)\b|bun\s+install\b|curl\b|wget\b|apt-get\s+install\b)/;
const OFFLINE = /--no-index\b|--offline\b/;
const WRAP = /run-with-budget-warning\.sh["']?\s+\S+\s+"[^"]+"/;

const joinContinuations = (text) => text.replace(/\s*\\\n\s*/g, ' ');

function scan(steps, where) {
  for (const step of steps ?? []) {
    const run = joinContinuations(String(step.run ?? ''));
    if (WRAP.test(run)) {
      continue;
    }
    const lines = run
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'));
    for (const line of lines) {
      if (INSTALL.test(line) && !OFFLINE.test(line)) {
        console.log(`${where}: "${step.name ?? step.uses}": ${line}`);
      }
    }
  }
}

const root = process.argv[2];
if (!root) {
  console.error('Usage: node scan-unbudgeted.mjs <repo-dir>');
  process.exit(2);
}
const workflowDir = `${root}/.github/workflows`;
for (const file of readdirSync(workflowDir).filter((name) =>
  /\.ya?ml$/.test(name)
)) {
  const workflow = parse(readFileSync(`${workflowDir}/${file}`, 'utf8'));
  for (const [jobName, job] of Object.entries(workflow.jobs ?? {})) {
    scan(job.steps, `${file}:${jobName}`);
  }
}
