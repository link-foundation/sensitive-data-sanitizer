/** Sensitive text APIs and retained template utilities. */

export { add, multiply, delay } from './arithmetic.js';

export { inspect, sanitize, redact } from './sanitizer.js';
export { createSanitizer } from './engines.js';
export { REDACTED, entropy, luhn } from './detection.js';
export { codePointRange } from './projection.js';
export {
  fromGitleaks,
  fromTrufflehog,
  fromDetectSecrets,
  fromPresidio,
  byteRange,
  fromOffsetReport,
} from './adapters.js';
export { knownSecretsFromEnv, personalVariants } from './known.js';
export { auditGitHistory } from './history.js';
export {
  createGitleaksDetector,
  createTrufflehogDetector,
  createPresidioDetector,
} from './external.js';

export { entityCatalogs } from './entities.js';
export {
  sanitizeStream,
  sanitizeStreamToFile,
  sanitizeFileToFile,
  sanitizeFileBounded,
} from './stream.js';

export { createWikidataVerifier } from './public-verifier.js';
export {
  sanitizePayload,
  createSentryBeforeSend,
  createOutboundSanitizer,
} from './outbound.js';
export { knownSecretsFromGitHubAuth } from './known.js';
export { rewriteGitHistory } from './history-rewrite.js';
