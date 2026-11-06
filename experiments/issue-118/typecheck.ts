// Type-only consumer fixture: deno check experiments/issue-118/typecheck.ts
import type * as API from '../../src/index.d.ts';
import type * as NER from '../../src/ner.d.ts';
declare const api: typeof API;
declare const ner: typeof NER;
const known = api.compileKnown([{ type: 'ORGANIZATION', value: 'Ромашка' }]);
const detector = await ner.createNerDetector({ languages: ['ru', 'en'] });
const findings: API.Finding[] = detector.detect('at Romashka');
const policy: API.SanitizerOptions = {
  knownPersonal: known,
  detectors: [detector],
  rules: { 'organization-context': false },
  types: { LOCATION: false },
  vocabulary: { roles: { values: ['маркетолог'], replace: true } },
  fields: { location: 'scan' },
  strict: true,
  allowedFields: ['msg', 'items.*.name'],
  exactFields: true,
  transformation: (finding) => `Private-${finding.type}`,
};
const sync: API.SyncSanitizer = api.createSyncSanitizer(policy);
const result: API.SanitizedText = sync.sanitize('at Romashka');
const asyncResult: API.SanitizedText = await api
  .createSanitizer({
    ...policy,
    transformation: async () => 'PrivateName',
  })
  .sanitize('at Romashka');
export { result, asyncResult, findings };
