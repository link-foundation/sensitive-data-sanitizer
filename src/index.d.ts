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
    | 'VERY_UNLIKELY'
    | 'UNLIKELY'
    | 'POSSIBLE'
    | 'LIKELY'
    | 'VERY_LIKELY';
  /** One-based line and UTF-16 column, populated by inspect. */
  line?: number;
  column?: number;
}
export interface PersonalValue {
  type: string;
  value: string;
}
export interface PublicEntity {
  type: 'PERSON' | 'ORGANIZATION' | 'EMAIL';
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
  knownSecrets?: string[];
  knownPersonal?: PersonalValue[];
  publicEntities?: PublicEntity[];
  /** Built-in exact public entities/resolvers and role mail on known domains. */
  publicKnowledge?: boolean;
  findings?: Finding[];
  transformation?: Transformation;
  transformations?: Record<string, Transformation>;
  preserveEncoding?: boolean;
  /** Explicit network/callback verification; credentials never qualify. */
  verifyPublic?: (candidate: {
    type: PublicEntity['type'];
    value: string;
  }) => Promise<PublicEntity | undefined>;

  paranoid?: boolean;
  decode?: boolean;
  maxInputLength?: number;
  maxFindings?: number;
  debug?: (event: { event: 'detected'; count: number }) => void;
  /** Used by createSanitizer; synchronous functions use native rules only. */
  detectors?: Detector[];
  /** Required by default in createSanitizer. */
  secretlint?: boolean;
}
export interface SanitizedText {
  text: string;
  findings: Finding[];
  /** Number of disjoint replacements after overlapping detections are merged. */
  redactions: number;
}
export interface Sanitizer {
  inspect(text: string): Promise<Finding[]>;
  sanitize(text: string): Promise<SanitizedText>;
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
export declare function createSanitizer(options?: SanitizerOptions): Sanitizer;
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
  names?: string[]
): string[];
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
export type Transformation =
  | { mode: 'redact' | 'hive-mask' }
  | { mode: 'mask'; keepStart?: number; keepEnd?: number }
  | { mode: 'pseudonym' | 'format-preserving'; key: string }
  | { mode: 'date-shift'; days: number }
  | { mode: 'bucket'; size: number };
export interface StreamOptions extends SanitizerOptions {
  sanitizerOptions?: SanitizerOptions;
  sanitizer?: Sanitizer;
  maxRecordBytes?: number;
  batchBytes?: number;
  maxTotalBytes?: number;
  worker?: boolean;
  workerHeapMb?: number;
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
