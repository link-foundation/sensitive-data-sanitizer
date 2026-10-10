import { createSanitizer } from '../src/index.js';

// Synthetic data: supply real knownSecrets from your secret store in memory.
const sanitizer = createSanitizer({
  profile: 'publication',
  structured: 'jsonl',
  structuralFields: ['id', 'type', 'name', 'description'],
  knownSecrets: ['an-opaque-synthetic-secret'],
  publicEntities: [
    {
      type: 'EMAIL',
      value: 'press@example.org',
      source: 'https://example.org/contact',
      reviewedAt: '2026-10-07',
    },
  ],
});
const session = JSON.stringify({
  type: 'tool_result',
  id: 'req_123',
  name: 'Read',
  stdout: 'password=short contact=private@example.org',
  publicContact: 'press@example.org',
});
const result = await sanitizer.sanitizeJsonl(session);
console.log(result.text);
console.log({ findings: result.findings.length });
