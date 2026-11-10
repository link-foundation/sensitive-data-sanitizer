/** Sensitive text detection and verified publication APIs. */

export { inspect, sanitize, redact } from './sanitizer.js';
export { createSanitizer } from './engines.js';
export { compileKnown } from './compiled-known.js';
export { builtInRules } from './rule-catalog.js';
export { defaultVocabulary } from './vocabulary.js';
export { documentVocabulary } from './document-vocabulary.js';
export { createSyncSanitizer } from './sync-sanitizer.js';
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
export { nationalRules } from './national.js';
export * as identifierChecks from './national-checks.js';
export { createIdentifierDetector } from './identifier-detector.js';
export { decrypt } from './encrypt.js';
export { createPatternDetector } from './pattern-detector.js';
export { toSarif } from './sarif.js';
export { tokenChecksum, tokenWithChecksum } from './token-checksum.js';
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
export { knownSecretsFromGitHubConfig } from './known.js';
export { decodeLogBytes, encodeLogText } from './log-bytes.js';
export { rewriteGitHistory } from './history-rewrite.js';
export {
  restore,
  createRestoreMap,
  serializeRestoreMap,
  parseRestoreMap,
  readRestoreMap,
  writeRestoreMap,
} from './restore-map.js';
