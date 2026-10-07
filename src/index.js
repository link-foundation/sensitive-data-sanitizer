/** Sensitive text APIs and retained template utilities. */

/**
 * Example function that adds two numbers
 * @param {number} a - First number
 * @param {number} b - Second number
 * @returns {number} Sum of a and b
 */
export const add = (a, b) => a + b;

/**
 * Example function that multiplies two numbers
 * @param {number} a - First number
 * @param {number} b - Second number
 * @returns {number} Product of a and b
 */
export const multiply = (a, b) => a * b;

/**
 * Example async function
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>}
 */
export const delay = (ms) =>
  new Promise((resolve) => globalThis.setTimeout(resolve, ms));

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
