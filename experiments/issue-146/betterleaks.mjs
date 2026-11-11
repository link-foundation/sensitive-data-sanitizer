import { createSanitizer, createBetterleaksDetector } from '../../src/index.js';
const command = process.argv[2];
if (!command) {
  throw new Error('Pass the absolute path to an installed Betterleaks binary');
}
const engine = createSanitizer({
  secretlint: false,
  detectors: [createBetterleaksDetector({ command })],
});
const value = ['ghp_', 'aB3dE6gH9jK2mN5pQ8sT1vW4xY7zA0bC3dE6'].join('');
const input = `release_credential=${value}`;
const findings = await engine.inspect(input);
if (!findings.some((finding) => finding.rule === 'betterleaks')) {
  throw new Error('Upstream rule did not participate');
}
const result = await engine.sanitize(input);
if (result.text.includes(value)) {
  throw new Error('Credential survived publication');
}
console.log(
  JSON.stringify({ upstreamFinding: true, verifiedOutput: result.text })
);
