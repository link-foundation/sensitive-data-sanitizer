// Print the step budgets the CI timeout test charges to each job.
//
// Usage (from the repository root):
//   node experiments/issue-208/dump-budgets.mjs example-app.yml:web-build release.yml:test
//
// It reuses the helpers in tests/ci-timeouts.test.js, so the numbers match
// what "keeps every declared step budget under the job backstop" checks.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const source = readFileSync(
  path.join(root, 'tests', 'ci-timeouts.test.js'),
  'utf8'
);
const helpers = source.slice(
  source.indexOf('function readWorkflow'),
  source.indexOf("describe('CI timeout policy'")
);
const yamlUrl = pathToFileURL(
  path.join(root, 'node_modules', 'yaml', 'dist', 'index.js')
).href;
const moduleSource = [
  "import { existsSync, readdirSync, readFileSync } from 'node:fs';",
  `import { parse } from ${JSON.stringify(yamlUrl)};`,
  helpers,
  'export { getStepBudgetSeconds, getConcurrentBudgetSeconds, readWorkflow };',
].join('\n');
const scratch = mkdtempSync(path.join(tmpdir(), 'dump-budgets-'));
try {
  const modulePath = path.join(scratch, 'budgets.mjs');
  writeFileSync(modulePath, moduleSource);
  const budgets = await import(pathToFileURL(modulePath).href);
  for (const arg of process.argv.slice(2)) {
    const [file, job] = arg.split(':');
    const steps = budgets.getStepBudgetSeconds(
      budgets.readWorkflow(`.github/workflows/${file}`),
      job
    );
    const total = budgets.getConcurrentBudgetSeconds(steps);
    console.log(`== ${arg} total=${total}`);
    for (const step of steps) {
      console.log(`  ${step.seconds}\t${step.label}\t[${step.condition}]`);
    }
  }
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
