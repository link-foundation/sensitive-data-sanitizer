import { compileKnown, createSyncSanitizer } from '../src/index.js';

// Reuse caller-owned compilation in a synchronous logging hook.
const known = compileKnown([{ type: 'ORGANIZATION', value: 'Ромашка' }]);
const loggerPolicy = createSyncSanitizer({
  profile: 'documents',
  knownPersonal: known,
  vocabulary: { roles: ['маркетолог'] },
  structured: 'json',
  allowedFields: ['level', 'msg'],
  fields: { location: 'scan' },
  transformations: { ORGANIZATION: () => 'PrivateCompany' },
});
console.log(
  loggerPolicy.sanitize(
    JSON.stringify({
      level: 'info',
      msg: 'работал в Ромашке',
      privateNote: 'caller-private text',
      count: 1,
    })
  ).text
);
