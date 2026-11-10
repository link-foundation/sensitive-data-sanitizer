/**
 * Credentials-only entry point. It has the same API as the main entry for the
 * functions it exports, always runs with `credentialsOnly: true`, and rejects
 * `credentialsOnly: false` and `mode: 'fake'` with `ERR_CONFIG`.
 */
export type * from './index.js';
export {
  inspect,
  sanitize,
  redact,
  createSanitizer,
  createSyncSanitizer,
  REDACTED,
  entropy,
  builtInRules,
  tokenChecksum,
  tokenWithChecksum,
  knownSecretsFromEnv,
  knownSecretsFromGitHubAuth,
  knownSecretsFromGitHubConfig,
  reservedPlaceholderTypes,
  isPlaceholderToken,
} from './index.js';
