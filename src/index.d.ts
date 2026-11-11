export type Category = 'credential' | 'personal';
/** UTF-16 offsets, zero-based start and exclusive end; never contains source values. */
export interface Finding {
  start: number;
  end: number;
  category: Category;
  type: string;
  rule: string;
  /** Detector confidence, not a cross-engine probability calibration. */
  confidence?: number;
  likelihood?:
    'VERY_UNLIKELY' | 'UNLIKELY' | 'POSSIBLE' | 'LIKELY' | 'VERY_LIKELY';
  /** One-based line and UTF-16 column, populated by inspect. */
  line?: number;
  column?: number;
  /** Reviewed/generated fake exemption; generated credentials require explicit opt-in. */
  kept?: 'fake';
  /** Returned finding replaced with, or recognized as, a generated fake. */
  faked?: true;
  /** For `JSON_VALUE`: the field's personal type, e.g. `AGE`, when known. */
  valueType?: string;
}
export interface PersonalValue {
  type: string;
  value: string;
  properCase?: boolean;
}
export type VocabularyList =
  readonly string[] | { values: readonly string[]; replace: true };
export type Vocabulary = Partial<
  Record<
    | 'roles'
    | 'organizationCues'
    | 'educationCues'
    | 'personalLabels'
    | 'personalFields'
    /** Word stems for the strict special-category rule; needs `strict: true`. */
    | 'personalAttributes',
    VocabularyList
  >
>;
export interface PublicEntity {
  type: 'PERSON' | 'ORGANIZATION' | 'EDUCATION' | 'LOCATION' | 'EMAIL';
  value: string;
  /** Organization-controlled HTTPS evidence, reviewed by the policy author. */
  source: string;
  /** ISO calendar date. The library does not fetch the evidence. */
  reviewedAt: string;
}
export interface Detector {
  id?: string;
  /** Required detectors must throw on failure and return offsets for this exact input. */
  detect(text: string): Finding[] | Promise<Finding[]>;
}
export interface SanitizerOptions {
  /** Preserve all personal/account data; credential findings still redact. */
  credentialsOnly?: boolean;
  /** Use explicit findings, knownPersonal/knownSecrets and reused map values; skip automatic detectors. */
  knownOnly?: boolean;
  profile?: 'publication' | 'documents';
  /** Opt in to bounded employer, school, city/region heuristics. */
  documentEntities?: boolean;
  /** Opt-in aggressive stored-log attributes, ages, dates and numeric shapes. */
  strict?: boolean;
  vocabulary?: Vocabulary;
  /** Stable ids from builtInRules. Unknown ids fail with ERR_CONFIG. */
  rules?: Record<string, boolean>;
  types?: Record<string, boolean>;
  /** Required to disable any built-in credential rule or type. */
  allowCredentialDisable?: boolean;
  /** Treat a built-in property as ordinary scanned text. */
  fields?: Record<string, 'scan'>;
  /** Aggressive structural proper names in prose values; opt-in, off by default. */
  properNames?: 'capitalized';
  /** Unicode Script aliases that activate prose detection; default ['Cyrillic']. */
  scripts?: string[];
  confirmedPersonal?: Array<{ value: string; type: string }>;
  knownSecrets?: string[];
  knownPersonal?: readonly PersonalValue[];
  publicEntities?: PublicEntity[];
  /** Built-in exact public entities/resolvers and role mail on known domains. */
  publicKnowledge?: boolean;
  findings?: Finding[];
  transformation?: Transformation;
  transformations?: Record<string, Transformation>;
  preserveEncoding?: boolean;
  /** First/last two characters and a fixed *** marker for identity values >=5. */
  identityMask?: boolean;
  /** Explicit opt-in. Words such as test/fake/example never grant exemptions. */
  fakeIdentity?: false | 'specimen-and-synthetic';
  /** Reviewed exact fake identity values, maintained outside published text. */
  fakeValues?: string[];
  /** Scan JSON string keys/values in bounded batches and preserve parseability. */
  structured?: 'json' | 'jsonl';
  /** Property names whose metadata heuristics may be suppressed. */
  structuralFields?: string[];
  /** Normalized property names or dotted paths with *; entire JSON/JSONL values redact. */
  sensitiveFields?: string[];
  /** Match sensitiveFields/allowedFields with exact case and punctuation. */
  exactFields?: boolean;
  /** Only these string leaves remain eligible to keep; listed strings are still scanned. */
  allowedFields?: string[];
  /** Personal replacement threshold, default 0.5. Inspect retains lower scores. */
  minConfidence?: number;
  /** Alias for minConfidence; specifying both requires equal values. */
  threshold?: number;
  /** Per-type thresholds (e.g. `{ PERSON: 0.8 }`) that override minConfidence. */
  minConfidenceByType?: Record<string, number>;
  /**
   * Values kept as-is: a string must equal the whole detected value and a
   * RegExp must fully match it. Declared knownPersonal/knownSecrets values and
   * credentials (unless allowCredentialDisable) are never allow-listed.
   */
  allowList?: (string | RegExp)[];
  /**
   * Honour scanner suppression comments (`gitleaks:allow`, `pragma: allowlist
   * secret`, `pragma: allowlist nextline secret`, `NOSONAR`, ...) under the
   * same rules as allowList.
   */
  inlineAllow?: boolean;
  /**
   * Keeps a finding the caller's policy knows is not sensitive. Runs after
   * detection and before transformation, once per finding, with the text the
   * offsets refer to; it must return a boolean (`true` keeps the span as-is).
   * Verification of the output consults it again per span, so the same value
   * elsewhere is still caught. Declared knownSecrets/knownPersonal/
   * confirmedPersonal values and JSON_VALUE denials are never offered.
   * Bounded escaped JSON findings are independently inspected with the same
   * policy (up to three levels); hooks there receive decoded text/offsets.
   * createSyncSanitizer and sanitize() require a synchronous hook.
   */
  exempt?: (
    finding: Readonly<Finding & { value: string }>,
    text: string
  ) => boolean | Promise<boolean>;
  /** Explicit network/callback verification; credentials never qualify. */
  verifyPublic?: (candidate: {
    type: PublicEntity['type'];
    value: string;
  }) => Promise<PublicEntity | undefined>;

  paranoid?: boolean;
  decode?: boolean;
  maxInputLength?: number;
  maxFindings?: number;
  debug?: (event: DebugEvent) => void;
  /** Required callbacks; synchronous functions reject Promise-returning detectors. */
  detectors?: Detector[];
  /** Required by default in createSanitizer. */
  secretlint?: boolean;
}
/** Value-free diagnostics; enabled only when a debug callback is supplied. */
export type DebugEvent =
  | { event: 'strict-attributes'; detected: number; suppressed: number }
  | { event: 'detected'; count: number }
  | { event: 'document-experience' | 'proper-name-prose'; count: number }
  | { event: 'residual-redaction'; round: number }
  | { event: 'template-value'; rule: string }
  | { event: 'exempt-decoded-view'; rule: string }
  | { event: 'two-pass-confirmation'; type: string }
  | { event: 'propagation-skipped'; reason: 'length'; type: string }
  | { event: 'gitleaks-rule'; rule: string; length: number; ms: number };
export interface SanitizedText {
  text: string;
  findings: Finding[];
  /** Number of disjoint replacements after overlapping detections are merged. */
  redactions: number;
  /** Placeholder-mode replacements absent from the restore map (e.g. credentials). */
  irreversibleRedactions?: number;
  /** Private personal data. Absent for map:false and non-placeholder modes. */
  map?: RestoreMap;
}
export interface Sanitizer {
  inspect(text: string): Promise<Finding[]>;
  sanitize(text: string): Promise<SanitizedText>;
}
export interface SyncSanitizer {
  inspect(text: string): Finding[];
  sanitize(text: string): SanitizedText;
}
export declare function createSyncSanitizer(
  options?: SanitizerOptions
): SyncSanitizer;
/** Copies and freezes caller values, merging lists and caching matching/projection. */
export declare function compileKnown(
  ...lists: Array<readonly PersonalValue[]>
): readonly Readonly<PersonalValue>[];
export declare const builtInRules: readonly string[];
export declare const defaultVocabulary: Readonly<
  Record<keyof Vocabulary, readonly string[]>
>;
export declare const documentVocabulary: readonly (readonly string[])[];
export interface JsonlSanitizer extends Sanitizer {
  sanitizeJsonl(text: string): Promise<SanitizedText>;
}
export declare const REDACTED: '[REDACTED]';
export declare function inspect(
  text: string,
  options?: SanitizerOptions
): Finding[];
export declare function sanitize(
  text: string,
  options?: SanitizerOptions
): SanitizedText;
/** Apply validated findings; use sanitize for automatic residual verification. */
export declare function redact(
  text: string,
  findings: Finding[],
  options?: SanitizerOptions
): string;
export declare function createSanitizer(
  options?: SanitizerOptions
): JsonlSanitizer;
export declare function entropy(value: string): number;
export declare function luhn(value: string): boolean;
export declare function codePointRange(
  text: string,
  start: number,
  end: number
): { start: number; end: number };
export declare function byteRange(
  text: string,
  start: number,
  end: number
): { start: number; end: number };
export declare function fromGitleaks(
  text: string,
  report: Array<{ Secret: string; [key: string]: unknown }>
): Finding[];
export declare function fromTrufflehog(
  text: string,
  report: Array<{ Raw: string; RawV2?: string; [key: string]: unknown }>
): Finding[];
export declare function fromDetectSecrets(
  text: string,
  report: {
    results: Record<
      string,
      Array<{ line_number: number; [key: string]: unknown }>
    >;
  },
  filename: string
): Finding[];
export declare function fromPresidio(
  text: string,
  report: Array<{
    start: number;
    end: number;
    entity_type: string;
    [key: string]: unknown;
  }>
): Finding[];
export declare function fromOffsetReport(
  text: string,
  entries: Array<{
    start: number;
    end: number;
    category: Category;
    type: string;
    [key: string]: unknown;
  }>,
  options: { unit: 'utf16' | 'codepoint' | 'byte'; rule: string }
): Finding[];
export declare function knownSecretsFromEnv(
  env?: Record<string, string | undefined>,
  names?: string[],
  options?: {
    /** Skip values shorter than this many characters (default 1). */
    minLength?: number;
  }
): string[];
/** Reversible UTF-8 view: invalid bytes use unpaired U+DC80..U+DCFF. */
export declare function decodeLogBytes(bytes: Uint8Array): string;
/** Encode sanitized text while restoring surrogate-escaped invalid bytes. */
export declare function encodeLogText(text: string): Uint8Array;
export declare function knownSecretsFromGitHubConfig(options?: {
  path?: string;
}): Promise<string[]>;
export declare function personalVariants(
  entries: PersonalValue[]
): PersonalValue[];
export interface LocalScannerOptions {
  command?: string;
  timeoutMs?: number;
  maxOutputBytes?: number;
}
export declare function createGitleaksDetector(
  options?: LocalScannerOptions
): Detector;
export declare function createBetterleaksDetector(
  options?: LocalScannerOptions
): Detector;
export declare function createTrufflehogDetector(
  options?: LocalScannerOptions
): Detector;
export declare function createPresidioDetector(
  options: LocalScannerOptions & { args: string[] }
): Detector;
export interface HistoryAudit {
  scanned: number;
  complete: boolean;
  findings: Array<{
    object: string;
    type: 'blob' | 'commit' | 'tag';
    findings: Finding[];
  }>;
  skipped: Array<{ object: string; reason: string }>;
}
export declare function auditGitHistory(
  repository: string,
  options?: {
    sanitizer?: Pick<Sanitizer, 'inspect'>;
    maxObjects?: number;
    maxBytes?: number;
    maxTotalBytes?: number;
  }
): Promise<HistoryAudit>;
/** Callback receives private matched data. Sync APIs require an immediate string. */
export type TransformationCallback = (
  finding: Readonly<Finding & { value: string }>
) => string | Promise<string>;
export type Transformation =
  | TransformationCallback
  | { mode: 'redact' | 'hive-mask' }
  | {
      mode: 'placeholder';
      map?: RestoreMap | false;
      format?: string;
      credentials?: boolean;
      /**
       * Tokens of the namespace already in the input: `'error'` (default)
       * throws `ERR_PLACEHOLDER_COLLISION`; `'keep'` leaves them as they are
       * and numbers new values after the highest kept number per type.
       */
      existing?: 'error' | 'keep';
    }
  | {
      mode: 'mask';
      keepStart?: number;
      keepEnd?: number;
      marker?: string;
      minLength?: number;
      /** One masking character, default `*`; not combinable with marker. */
      char?: string;
      /** Characters left unmasked, e.g. `'-'` for `****-****-1111`. */
      ignore?: string;
      ignoreClasses?: (
        'digits' | 'upper' | 'lower' | 'punctuation' | 'whitespace'
      )[];
      /** Mask at most this many maskable characters. */
      count?: number;
      /** Apply `count` from the end instead of the start. */
      fromEnd?: boolean;
    }
  | { mode: 'pseudonym' | 'format-preserving'; key: string }
  | {
      mode: 'fake';
      /** At least 16 UTF-8 bytes; keep this pseudonymisation key private. */
      key: string;
      /** Emit visibly invalid fake credentials; default is full redaction. */
      credentials?: boolean;
      /** Keep original MRZ issuer/nationality unless Utopia is requested. */
      mrzCountry?: 'UTO';
      /** Caller-reviewed names that replace the generated entity vocabulary. */
      pools?: Partial<
        Record<'ORGANIZATION' | 'LOCATION' | 'EDUCATION', string[]>
      >;
    }
  | { mode: 'date-shift'; days: number }
  | { mode: 'bucket'; size: number }
  /** Deterministic AES-256-GCM `[ENCRYPTED:TYPE:…]`; key >= 16 UTF-8 bytes. */
  | { mode: 'encrypt'; key: string };

/** Contains original personal data; never publish this object or its files. */
export interface RestoreMap {
  kind: 'sensitive-data-restore-map';
  version: 1;
  format: string;
  entries: Array<{
    token: string;
    type: string;
    number: number;
    values: string[];
    aliases: string[];
    /** PERSON parts listed by the caller, which also match alone on reuse. */
    standalone?: string[];
  }>;
  documents: Array<{
    digest: string;
    occurrences: Array<{
      start: number;
      end: number;
      token: string;
      raw: string;
    }>;
  }>;
}
export declare function createRestoreMap(options?: {
  format?: string;
}): RestoreMap;
export declare function serializeRestoreMap(
  map: RestoreMap,
  format?: 'json' | 'lino'
): string;
export declare function parseRestoreMap(text: string): RestoreMap;
export declare function readRestoreMap(path: string): Promise<RestoreMap>;
export declare function writeRestoreMap(
  path: string,
  map: RestoreMap,
  options?: { format?: 'json' | 'lino'; replace?: boolean }
): Promise<void>;
/** Exact original-document restoration; derived text uses canonical surfaces. */
export declare function restore(text: string, map: RestoreMap): string;
/** Sorted, frozen list of the types built-in rules turn into `Type-n` tokens. */
export declare function reservedPlaceholderTypes(): readonly string[];
/** Whether `text` is one whole token of the placeholder namespace. */
export declare function isPlaceholderToken(
  text: string,
  options?: {
    /** Placeholder format, default `'{Type}-{n}'`. */
    format?: string;
    /** Extra custom types, e.g. those of `createPatternDetector`. */
    types?: readonly string[];
  }
): boolean;
export interface StreamOptions extends SanitizerOptions {
  /** Treat NUL as a log byte; default false. Incompatible with JSON/JSONL. */
  allowBinary?: boolean;
  /** Atomic file APIs only: spool input privately, collect, then redact. */
  twoPass?: boolean;
  maxRegistryValues?: number;
  sanitizerOptions?: SanitizerOptions;
  sanitizer?: Sanitizer;
  maxRecordBytes?: number;
  batchBytes?: number;
  maxTotalBytes?: number;
  worker?: boolean;
  /** JSONL record workers, 1–16; default 2, or 1 for callbacks/Deno. */
  workers?: number;
  workerHeapMb?: number;
  /** 1–2147483647 ms; file inactivity / JSONL per-batch deadline; default 60000. */
  workerTimeoutMs?: number;
  replace?: boolean;
}
export declare function sanitizeStream(
  source: AsyncIterable<string | Uint8Array> | Iterable<string | Uint8Array>,
  options?: StreamOptions
): AsyncGenerator<string>;
export declare function sanitizeStreamToFile(
  source: AsyncIterable<string | Uint8Array> | Iterable<string | Uint8Array>,
  path: string,
  options?: StreamOptions
): Promise<{ outputBytes: number }>;
export declare function sanitizeFileToFile(
  source: string,
  target: string,
  options?: StreamOptions
): Promise<{ inputBytes: number; outputBytes: number }>;
export declare function sanitizeFileBounded(
  source: string,
  target: string,
  options?: StreamOptions
): Promise<{ inputBytes: number; outputBytes: number }>;
export declare const entityCatalogs: Record<
  'google' | 'azure' | 'aws',
  { source: string; sha256: string; names: string[] }
>;
/** Built-in identifier rule; `context` is tested near each `pattern` match. */
export interface IdentifierRule {
  type: string;
  /** Global regular expression for candidate values. */
  pattern: RegExp;
  /** Non-global label/context expression, 64 characters before to 32 after. */
  context: RegExp;
  /** Checksum or issuing-format check that raises confidence. */
  checksum: (value: string) => boolean;
  /** Distinctive shape that is reported without context. */
  plausible?: (value: string) => boolean;
  /** Mandatory gate; candidates failing it are never reported. */
  valid?: (value: string) => boolean;
}
export declare const nationalRules: readonly IdentifierRule[];
/** Format and checksum validators; they never prove issuance. */
export declare const identifierChecks: Readonly<
  Record<string, (value: string, ...args: number[]) => boolean>
> & {
  digitsOf(value: string): string;
};
/** Wrap identifier rules as a Detector for `detectors` options. */
export declare function createIdentifierDetector(
  rules: readonly IdentifierRule[],
  options?: { id?: string }
): Detector;
/** Restore `[ENCRYPTED:TYPE:…]` tokens; throws ERR_MAP on a wrong key. */
export declare function decrypt(
  text: string,
  key: string,
  options?: { json?: boolean }
): string;
export interface PatternSpec {
  type: string;
  category?: Category;
  /** Finding rule id, default `custom-pattern`. */
  rule?: string;
  /** Default base confidence, 0.6. */
  confidence?: number;
  patterns?: (
    | RegExp
    | string
    | { regex: RegExp | string; confidence?: number; group?: number }
  )[];
  /** Whole-word terms (case-insensitive unless caseSensitive). */
  denyList?: string[];
  caseSensitive?: boolean;
  denyListConfidence?: number;
  /** Hotwords that adjust confidence when found near a match. */
  context?: string[];
  /** Characters searched for context, default `{ before: 64, after: 16 }`. */
  contextWindow?: number | { before?: number; after?: number };
  /** Added when context is found (default 0.35); negative lowers it. */
  contextBoost?: number;
  /** false rejects the match; a number in 0..1 sets its confidence. */
  validate?: (value: string) => boolean | number | undefined;
}
/** Declarative regex/deny-list recognizers (Presidio/Google custom infoType style). */
export declare function createPatternDetector(
  specs: PatternSpec | readonly PatternSpec[],
  options?: { id?: string }
): Detector;
export interface SarifLog {
  $schema: string;
  version: '2.1.0';
  runs: unknown[];
}
/** SARIF 2.1.0 log of rules and locations; never contains matched values. */
export declare function toSarif(
  report:
    | {
        complete?: boolean;
        results: { path: string; findings: Finding[] }[];
        skipped?: { path: string; reason: string }[];
      }
    | { path: string; findings: Finding[] }[]
    | Finding[],
  options?: { version?: string; path?: string }
): SarifLog;
/**
 * Offline CRC32/base62 check of GitHub (gh[opsur]_) and npm (npm_) tokens:
 * true when the checksum matches, false when it does not, undefined for
 * other formats.
 */
export declare function tokenChecksum(value: string): boolean | undefined;
/** Builds a checksum-valid token from a prefix ending in `_` and a 30-character body. */
export declare function tokenWithChecksum(prefix: string, body: string): string;
export declare function createWikidataVerifier(options?: {
  fetch?: typeof fetch;
  language?: string;
  timeoutMs?: number;
  maxEntries?: number;
}): NonNullable<SanitizerOptions['verifyPublic']>;
export declare function knownSecretsFromGitHubAuth(options?: {
  command?: string;
  hostname?: string;
  timeoutMs?: number;
}): Promise<string[]>;
export interface OutboundOptions {
  sanitizer?: Pick<Sanitizer, 'sanitize'>;
  sanitizerOptions?: SanitizerOptions;
}
export declare function sanitizePayload<T>(
  value: T,
  options?: OutboundOptions
): Promise<T>;
export declare function createSentryBeforeSend<T>(
  options?: OutboundOptions
): (event: T) => Promise<T | null>;
export declare function createOutboundSanitizer<T, R>(
  publish: (payload: T) => R | Promise<R>,
  options?: OutboundOptions
): (payload: T) => Promise<R>;
export interface HistoryRewrite {
  applied: boolean;
  repository: string;
  before: HistoryAudit;
  after?: HistoryAudit;
  changedPaths: number;
  changedRefs: number;
}
export declare function rewriteGitHistory(
  source: string,
  destination: string,
  options?: {
    apply?: boolean;
    sanitizer?: Sanitizer;
    sanitizerOptions?: SanitizerOptions;
    filterRepoCommand?: string;
    maxPaths?: number;
    maxObjects?: number;
    maxBytes?: number;
    maxTotalBytes?: number;
  }
): Promise<HistoryRewrite>;

/** Read-only checks are disabled unless enabled is explicitly true. */
export interface CredentialVerification {
  provider: string;
  status: 'disabled' | 'unsupported' | 'valid' | 'invalid' | 'unknown';
  reason?: 'budget' | 'http' | 'response' | 'request';
}
export const credentialProviders: ReadonlyArray<
  Readonly<{
    id: string;
    endpoint: string;
    method: 'GET';
    source: string;
  }>
>;
export function createCredentialVerifier(options?: {
  enabled?: boolean;
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
  maxChecks?: number;
  maxResponseBytes?: number;
}): (candidate: {
  provider: string;
  token: string;
}) => Promise<CredentialVerification>;
