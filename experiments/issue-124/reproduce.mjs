import { createSyncSanitizer } from '../../src/index.js';
const policy = {
  profile: 'documents',
  properNames: 'capitalized',
  strict: true,
};
const text = createSyncSanitizer(policy);
const json = createSyncSanitizer({ ...policy, structured: 'json' });
for (const s of [
  'took 30 ms Retry scheduled',
  'p95 120 ms Upstream healthy',
  'see dr Drive mount',
  'dr Who',
  'took 30 Ms Retry',
  'Ms. Smith',
  'Ms Smith',
  'Dr. Smith',
  'Dr Smith',
  'Mr. Brown',
  'took 30 ms retry',
  '12ms Retry',
  'Call Ms Smith',
]) {
  console.log(JSON.stringify(s), '->', text.sanitize(s).text);
}
for (const s of [
  '{"msg":"took 30 ms Retry scheduled"}',
  '{"recruiterDisplayName":"Olga"}',
  '{"authorFullName":"Petrov"}',
  '{"resumePdfOriginalFileName":"Petrov_Ivan_CV.pdf"}',
  '{"author_full_name":"Petrov"}',
  '{"name":"Olga"}',
  '{"maxAge":"30"}',
  '{"fileName":"report.pdf"}',
  '{"surname":"x"}',
]) {
  const r = json.sanitize(s);
  console.log(s, '->', r.text ?? r);
}
