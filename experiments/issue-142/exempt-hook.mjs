// The `exempt` hook keeps findings a caller's policy knows are not secrets
// and keeps the residual verification for everything else (issue 135).
import { createSyncSanitizer, createSanitizer } from '../../src/index.js';
const GH = ['ghp_', 'Zx9Qw7Er5Ty3Ui1Op0As', '2Df4Gh6Jk8Lz0Xc2Vb4N'].join('');
const text = `FEATURE_TOKEN=keep-this-value-123\nother_token=keep-this-value-123\nAUTH_TOKEN=${GH}`;
const exempt = (finding, source) =>
  finding.value === 'keep-this-value-123' &&
  /FEATURE_TOKEN=$/.test(source.slice(0, finding.start));
const options = { credentialsOnly: true, exempt };
console.log(createSyncSanitizer(options).sanitize(text).text);
console.log((await createSanitizer(options).sanitize(text)).text);
const asyncExempt = (finding) =>
  Promise.resolve(finding.value.startsWith('keep-'));
console.log(
  (
    await createSanitizer({
      credentialsOnly: true,
      exempt: asyncExempt,
    }).sanitize(text)
  ).text
);
try {
  createSyncSanitizer({ credentialsOnly: true, exempt: asyncExempt }).sanitize(
    text
  );
} catch (error) {
  console.log('sync engine with an async hook:', error.code);
}
console.log(
  createSyncSanitizer({
    credentialsOnly: true,
    exempt,
    transformation: (finding) => `<${finding.type}>`,
  }).sanitize(text).text
);
