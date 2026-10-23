import { createReadStream } from 'node:fs';
import {
  knownSecretsFromEnv,
  knownSecretsFromGitHubConfig,
  sanitizeStreamToFile,
} from '../src/index.js';

// Shared integration for upload-log tools. Publish the output only after the
// atomic operation succeeds. Neither helper prints credential values.
const [input, output] = process.argv.slice(2);
if (!input || !output) {
  throw new Error('Usage: node examples/shared-tool-logs.mjs INPUT OUTPUT');
}
await sanitizeStreamToFile(createReadStream(input), output, {
  twoPass: true,
  credentialsOnly: true,
  knownSecrets: [
    ...knownSecretsFromEnv(),
    ...(await knownSecretsFromGitHubConfig()),
  ],
});
