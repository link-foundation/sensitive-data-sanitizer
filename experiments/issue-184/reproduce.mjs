// Synthetic credentials and the Markdown release-note example from issue 181.
// Run: node --max-old-space-size=256 experiments/issue-184/reproduce.mjs
import { createSyncSanitizer } from '../../src/credentials-entry.js';

const sanitizer = createSyncSanitizer();
const secret = ['q7W9e2R4', 't6Y8u1I3o5P0'].join('');
for (const input of [
  'for example `` `Authorization: token <value>` `` in notes',
  'for example ``` ``Proxy-Authorization: Basic ${TOKEN}`` ``` in notes',
  `for example \`\` \`Authorization: Bearer ${secret}\` \`\` in notes`,
  `for example \`\` \`Authorization: Bearer abc\`${secret}\` \`\` in notes`,
]) {
  console.log(
    JSON.stringify({ input, output: sanitizer.sanitize(input).text })
  );
}
