import { createHmac, randomBytes } from 'node:crypto';
import { inspect, redact, applyProfile, validateOptions } from './sanitizer.js';
import { confirmedSeeds } from './propagation.js';
import { failure } from './detection.js';
import { nameAliases } from './transliteration.js';
import { structuredBatches } from './structured.js';
import { actionable } from './confidence.js';

// Per-stream values remain private. Prior unredacted tokens are represented
// only by keyed digests; a later confirmation blocks one-pass publication.
// A complete registry from discovery needs no prior-token history in pass 2.
export function streamIdentity(
  options,
  limit = 100000,
  collecting = false,
  complete = false
) {
  options = applyProfile(options);
  validateOptions(options);
  if (!Number.isSafeInteger(limit) || limit < 1) {
    throw failure('ERR_CONFIG');
  }
  if ((options.confirmedPersonal?.length ?? 0) > limit) {
    throw failure('ERR_LIMIT');
  }
  const key = randomBytes(32),
    seen = new Set(),
    values = new Map(
      (options.confirmedPersonal ?? []).map((entry) => [
        entry.value.trim().normalize('NFC').toLowerCase(),
        entry.type,
      ])
    );
  const personal = (options.confirmedPersonal ?? []).map((entry) => ({
    ...entry,
    value: entry.value.trim(),
  }));
  const configuration = { ...options, confirmedPersonal: personal };
  function fingerprint(value) {
    return createHmac('sha256', key)
      .update(value.trim().normalize('NFC').toLowerCase())
      .digest('base64');
  }
  function checkLimit() {
    if (seen.size + values.size > limit) {
      throw failure('ERR_LIMIT');
    }
  }
  function appearedEarlier(value) {
    // Compound usernames/addresses can have been emitted before any label.
    // Their components use the same private history as confirmed name tokens.
    const components = value.match(/[\p{L}\p{N}]{2,128}/gu) ?? [];
    return [value, ...components].some((part) => seen.has(fingerprint(part)));
  }
  function confirm(text, findings) {
    for (const [value, finding] of confirmedSeeds(
      text,
      findings,
      configuration
    )) {
      const normalized = value.trim().normalize('NFC').toLowerCase();
      if (values.has(normalized)) {
        continue;
      }
      if (!collecting && !complete && appearedEarlier(normalized)) {
        throw failure('ERR_LATE_PERSONAL');
      }
      if (complete) {
        options.debug?.({ event: 'two-pass-confirmation', type: finding.type });
      }
      values.set(normalized, finding.type);
      personal.push({ value: normalized, type: finding.type });
      checkLimit();
    }
  }
  checkLimit();
  return {
    options: configuration,
    prepare(text, findings = inspect(text, configuration)) {
      if (configuration.credentialsOnly) {
        return [];
      }
      confirm(text, findings);
      if (collecting || complete) {
        return [...personal];
      }
      const unredacted = redact(text, findings, {
        ...configuration,
        identityMask: false,
        transformation: undefined,
        transformations: undefined,
        preserveEncoding: false,
      });
      const parts = configuration.structured
        ? structuredBatches(unredacted, configuration).flatMap((batch) =>
            batch.entries.map((entry) => JSON.parse(entry.raw))
          )
        : [unredacted];
      const tokens = new Set();
      for (const finding of findings) {
        if (
          finding.category === 'personal' &&
          !actionable(finding, configuration)
        ) {
          seen.add(fingerprint(text.slice(finding.start, finding.end)));
          checkLimit();
        }
      }
      for (const part of parts) {
        for (const match of part.matchAll(
          /(?<![\p{L}\p{N}])[\p{L}\p{N}]{2,128}(?![\p{L}\p{N}])/gu
        )) {
          if (tokens.has(match[0])) {
            continue;
          }
          tokens.add(match[0]);
          if (tokens.size > limit) {
            throw failure('ERR_LIMIT');
          }
          for (const alias of nameAliases(match[0])) {
            seen.add(fingerprint(alias));
            checkLimit();
          }
        }
      }
      return [...personal];
    },
  };
}
