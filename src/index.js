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
