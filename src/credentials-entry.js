/**
 * Credentials-only entry point (`@link-foundation/sensitive-data-sanitizer/credentials`).
 *
 * It loads the credential detectors without the personal-data detectors,
 * faker or libphonenumber, so it starts faster and suits synchronous loggers.
 * Every function here runs with `credentialsOnly: true` (issue 137).
 */
import {
  inspect as inspectText,
  sanitize as sanitizeText,
  redact as redactText,
} from './sanitizer.js';
import { failure } from './detection.js';
import { createSanitizer as createAsyncSanitizer } from './engines.js';
import { createSyncSanitizer as createSync } from './sync-sanitizer.js';

export { REDACTED, entropy } from './detection.js';
export { builtInRules } from './rule-catalog.js';
export { tokenChecksum, tokenWithChecksum } from './token-checksum.js';
export {
  reservedPlaceholderTypes,
  isPlaceholderToken,
} from './placeholder-types.js';
export {
  knownSecretsFromEnv,
  knownSecretsFromGitHubAuth,
  knownSecretsFromGitHubConfig,
} from './known.js';

function credentialOptions(options = {}) {
  const transforms = [
    options.transformation,
    ...Object.values(options.transformations ?? {}),
  ];
  // Checked here, not through the feature registry: once the root entry is
  // loaded in the same process its personal features are registered too.
  if (
    options.credentialsOnly === false ||
    options.properNames !== undefined ||
    options.scripts !== undefined ||
    transforms.some((transform) => transform?.mode === 'fake')
  ) {
    throw failure('ERR_CONFIG');
  }
  return { ...options, credentialsOnly: true };
}

export function inspect(text, options) {
  return inspectText(text, credentialOptions(options));
}
export function sanitize(text, options) {
  return sanitizeText(text, credentialOptions(options));
}
export function redact(text, findings, options) {
  return redactText(text, findings, credentialOptions(options));
}
export function createSanitizer(options) {
  return createAsyncSanitizer(credentialOptions(options));
}
export function createSyncSanitizer(options) {
  return createSync(credentialOptions(options));
}
