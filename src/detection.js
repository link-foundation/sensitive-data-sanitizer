import {
  cardNetwork,
  cardEvidence,
  cardContext,
  uatpCard,
} from './confidence.js';
import { isIP } from 'node:net';
import { Buffer } from 'node:buffer';
import { serviceRules } from './rules.js';
import { detectContext, valueRange, authorizationRanges } from './context.js';
import { detectGitleaks } from './gitleaks.js';
import {
  detectCredentialFormats,
  credentialPlaceholder,
  maskedValue,
} from './credentials.js';
import { localAddress } from './public.js';
import { detectKnownPersonal } from './personal-variants.js';
import { builtInEnabled } from './policy.js';
import { feature } from './features.js';
import { tokenChecksum } from './token-checksum.js';
import { refineCredentialSpans, cookieValues } from './credential-spans.js';

export const REDACTED = '[REDACTED]';
export const failure = (code = 'ERR_SANITIZATION', location = {}) =>
  Object.assign(new Error('Sanitization failed; output was blocked.'), {
    code,
    ...Object.fromEntries(
      ['record', 'offset', 'recordOffset']
        .filter(
          (key) => Number.isSafeInteger(location[key]) && location[key] >= 0
        )
        .map((key) => [key, location[key]])
    ),
  });
export function internalFailure(error) {
  return /^ERR_[A-Z_]+$/.test(error?.code) ? error : failure();
}
export const maxPropagationLength = 256;
// Verification redacts values found again after a replacement, up to this many
// extra rounds, before publication fails closed with ERR_RESIDUAL.
export const residualRounds = 3;
export function personalPattern(value) {
  if (value.length > maxPropagationLength) {
    throw failure('ERR_LIMIT');
  }
  // Split before escaping: replacing hyphens in an escaped pattern can turn
  // a preceding literal backslash into regexp syntax.
  return value
    .split(/[ _-]+/)
    .map(escapePattern)
    .join('[ \\t_-]+');
}
// Hex and base64 spellings of a known secret, at any length. The generic
// decoders need 16 or more encoded characters, so they cannot see short ones.
const encodedForms = new Map();
function knownEncodedForms(value) {
  let pattern = encodedForms.get(value);
  if (!pattern) {
    const bytes = Buffer.from(value, 'utf8');
    const hex = bytes.toString('hex');
    const base64 = bytes.toString('base64').replace(/=+$/, '');
    const url = bytes.toString('base64url');
    const alternatives = [...new Set([hex, hex.toUpperCase()])].join('|');
    const base64Forms = [...new Set([base64, url])].map(escapePattern);
    pattern = new RegExp(
      `(?<![\\da-fA-F])(?:${alternatives})(?![\\da-fA-F])|(?<![\\w+/-])(?:${base64Forms.join('|')})(?:={0,2}(?![\\w+/=-]))`,
      'g'
    );
    if (encodedForms.size > 1024) {
      encodedForms.clear();
    }
    encodedForms.set(value, pattern);
  }
  return pattern;
}

export function escapePattern(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function collectMatches(
  text,
  regex,
  emit,
  details,
  group = 0,
  accept = () => true
) {
  // matchAll clones global expressions and leaves their lastIndex untouched.
  const pattern =
    regex.global && regex.lastIndex === 0
      ? regex
      : new RegExp(
          regex.source,
          regex.global ? regex.flags : `${regex.flags}g`
        );
  for (const match of text.matchAll(pattern)) {
    const raw = match[group];
    const value = details.category === 'personal' ? raw?.trim() : raw;
    if (!value || value.trim() === REDACTED || !accept(value, match)) {
      continue;
    }
    const offset = group ? match[0].lastIndexOf(value) : 0;
    emit({
      start: match.index + offset,
      end: match.index + offset + value.length,
      ...details,
    });
  }
}

export function entropy(value) {
  const counts = new Map();
  for (const char of value) {
    counts.set(char, (counts.get(char) ?? 0) + 1);
  }
  let result = 0;
  for (const count of counts.values()) {
    const p = count / value.length;
    result -= p * Math.log2(p);
  }
  return result;
}

export function luhn(value) {
  const digits = value.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19 || /^(\d)\1+$/.test(digits)) {
    return false;
  }
  let total = 0;
  for (
    let i = digits.length - 1, double = false;
    i >= 0;
    i--, double = !double
  ) {
    let n = Number(digits[i]);
    if (double) {
      n *= 2;
      if (n > 9) {
        n -= 9;
      }
    }
    total += n;
  }
  return total % 10 === 0;
}

function detectCookies(text, emit) {
  for (const match of text.matchAll(/(?:Set-)?Cookie[ \t]*:[ \t]*/gi)) {
    const range = valueRange(text, match.index + match[0].length, 'line');
    for (const value of range
      ? cookieValues(text, range.start, range.end)
      : []) {
      if (!maskedValue(text.slice(value.start, value.end))) {
        emit({
          ...value,
          type: 'SECRET',
          category: 'credential',
          rule: 'cookie',
        });
      }
    }
  }
}

export function nativeDetect(text, options, emit) {
  const found = [];
  detectNative(text, options, (finding) => found.push(finding));
  for (const finding of refineCredentialSpans(text, found)) {
    if (builtInEnabled(finding, options)) {
      emit(finding);
    }
  }
}

function detectNative(text, options, emit) {
  const credential = { type: 'SECRET', category: 'credential' };
  for (const value of options.knownSecrets ?? []) {
    collectMatches(text, new RegExp(escapePattern(value), 'g'), emit, {
      ...credential,
      rule: 'known-secret',
    });
    collectMatches(text, knownEncodedForms(value), emit, {
      ...credential,
      rule: 'known-secret',
    });
  }
  detectKnownPersonal(
    text,
    options.knownPersonal,
    'known-personal',
    emit,
    options
  );
  detectKnownPersonal(
    text,
    options.confirmedPersonal,
    'confirmed-personal',
    emit,
    options
  );
  if (options.knownOnly) {
    return;
  }
  detectGitleaks(
    text,
    emit,
    options.debug
      ? (details) => options.debug({ event: 'gitleaks-rule', ...details })
      : undefined
  );
  const checked = (finding) =>
    emit(
      tokenChecksum(text.slice(finding.start, finding.end))
        ? { ...finding, confidence: 0.99 }
        : finding
    );
  for (const [rule, pattern] of serviceRules) {
    collectMatches(text, pattern, checked, { ...credential, rule });
  }
  detectContext(text, emit, options.credentialsOnly);
  if (!options.credentialsOnly) {
    feature('detectPersonalData')(text, emit, options);
  }
  detectCredentialFormats(text, emit);
  // detect-secrets-style quoted entropy detection; bare commit hashes and
  // common tool identifiers remain outside this heuristic's scope.
  collectMatches(
    text,
    /["']([A-Za-z0-9+/=_-]{20,256})["']/g,
    emit,
    { ...credential, rule: 'quoted-entropy' },
    1,
    (value) =>
      !/^[a-f0-9]{40}$/i.test(value) &&
      entropy(value) >= (/^[a-f0-9]+$/i.test(value) ? 3 : 4.5)
  );
  collectMatches(
    text,
    /-----BEGIN ([A-Z0-9 ]*PRIVATE KEY)-----[\s\S]*?(?:-----END \1-----|$)/g,
    emit,
    { ...credential, type: 'PRIVATE_KEY', rule: 'private-key' }
  );
  detectAuthorization(text, emit, credential);
  detectCookies(text, emit);
  collectMatches(
    text,
    /(?<![a-z0-9+.-])[a-z][a-z0-9+.-]*:\/\/([^\s/@]+)@/gi,
    emit,
    { ...credential, rule: 'url-userinfo' },
    1
  );
  collectMatches(
    text,
    /https:\/\/(?:hooks\.slack\.com\/services|(?:canary\.)?discord(?:app)?\.com\/api\/webhooks)\/([^\s"'<>]+)/gi,
    emit,
    { ...credential, rule: 'webhook' },
    1
  );
  if (options.credentialsOnly && !options.paranoid) {
    return;
  }
  detectPersonalFormats(text, options, emit);
  if (options.paranoid) {
    collectMatches(
      text,
      /(?<![A-Za-z0-9_+/-])[A-Za-z0-9_+/-]{20,256}={0,2}(?![A-Za-z0-9_+/-])/g,
      emit,
      { ...credential, rule: 'entropy' },
      0,
      (v) =>
        !(
          /^[a-f0-9]{7,64}$/i.test(v) ||
          /^mcp__|^browser_|^\[REDACTED\]$/.test(v)
        ) && entropy(v) >= 4.2
    );
  }
}

function detectAuthorization(text, emit, credential) {
  for (const match of text.matchAll(
    /(?:Proxy-)?Authorization[ \t]*:[ \t]*/gi
  )) {
    const start = match.index + match[0].length;
    for (const range of authorizationRanges(text, start)) {
      if (!credentialPlaceholder(text.slice(range.start, range.end))) {
        emit({ ...range, ...credential, rule: 'authorization' });
      }
    }
  }
}

// `/` and `|` are valid local-part characters, so `@handle/jane@example.com`
// reads as one address that starts after `@`. A mention keeps its own finding;
// any other leading `@` joins the address so that it cannot survive as a handle.
function emailAfterMention(text, finding) {
  if (
    text[finding.start - 1] !== '@' ||
    /[\p{L}\p{N}_.\]]/u.test(text[finding.start - 2] ?? '')
  ) {
    return finding;
  }
  const handle = /^[\p{L}\p{N}_]{2,32}[/|]/u.exec(
    text.slice(finding.start, finding.end)
  );
  return handle
    ? { ...finding, start: finding.start + handle[0].length }
    : { ...finding, start: finding.start - 1 };
}

function detectPersonalFormats(text, options, emit) {
  collectMatches(
    text,
    /(?<![\p{L}\p{N}_.!#$%&'*+/?^`{|}~-])[\p{L}\p{N}_.!#$%&'*+/?^`{|}~-]+@[\p{L}\p{N}](?:[\p{L}\p{N}.-]{0,252})\.[\p{L}]{2,63}(?![\p{L}\p{N}_-])/gu,
    (finding) => {
      // `https://user:password@host` is URL user info, not an address.
      if (
        !/[a-z][a-z0-9+.-]*:\/\/[^\s/@]*:$/i.test(
          text.slice(Math.max(0, finding.start - 256), finding.start)
        )
      ) {
        emit(emailAfterMention(text, finding));
      }
    },
    { type: 'EMAIL', category: 'personal', rule: 'email' }
  );
  collectMatches(
    text,
    /(?<!\d)\+\d[\d ()-]{6,24}\d(?!\d)/g,
    (finding) => {
      if (
        /[?&]phone=$/i.test(
          text.slice(Math.max(0, finding.start - 8), finding.start)
        )
      ) {
        const token = /^[^\s&#]+/.exec(
          text.slice(finding.start, finding.end)
        )[0];
        finding.end = finding.start + token.length;
      }
      emit(finding);
    },
    { type: 'PHONE', category: 'personal', rule: 'international-phone' },
    0,
    (v) => {
      const n = v.replace(/\D/g, '').length;
      return n >= 8 && n <= 15;
    }
  );
  collectMatches(
    text,
    /(?<!\d)(?:\d[ -]?){12,18}\d(?!\d)/g,
    emit,
    { type: 'CREDIT_CARD', category: 'personal', rule: 'luhn' },
    0,
    (value, match) =>
      luhn(value) &&
      (cardNetwork(value) ||
        (uatpCard(value) && cardContext(text, match.index, value))) &&
      cardEvidence(text, match.index, value)
  );
  collectMatches(
    text,
    /(?<![\w.-])\d{3}([-.])\d{2}\1\d{4}(?![\w-]|\.\d)/g,
    emit,
    { type: 'ID', category: 'personal', rule: 'us-ssn' },
    0,
    (v) => !/^(?:000|666|9\d\d)\D|^\d{3}\D00\D|0000$/.test(v)
  );
  collectMatches(
    text,
    /(?<![\w.])(?:\d{1,3}\.){3}\d{1,3}(?!\w|\.\d)/g,
    emit,
    { type: 'IP_ADDRESS', category: 'personal', rule: 'ipv4' },
    0,
    (v) =>
      isIP(v) === 4 && (options.publicKnowledge === false || !localAddress(v))
  );
  collectMatches(
    text,
    /(?<![\w:])(?:[a-fA-F0-9]{0,4}:){2,7}[a-fA-F0-9]{0,4}(?![\w:])/g,
    emit,
    { type: 'IP_ADDRESS', category: 'personal', rule: 'ipv6' },
    0,
    // Rust paths such as a::b and namespace prefixes are valid IPv6 syntax,
    // but carry no useful address evidence in coding-session text.
    (v) =>
      isIP(v) === 6 &&
      (options.publicKnowledge === false || !localAddress(v)) &&
      v !== '::' &&
      !/^[a-fA-F0-9]{0,4}::$/.test(v) &&
      (v.split(':').filter(Boolean).length >= 3 || /\d/.test(v))
  );
}
