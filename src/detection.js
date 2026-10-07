import { isIP } from 'node:net';
import { serviceRules, labels } from './rules.js';

export const REDACTED = '[REDACTED]';
export const failure = (code = 'ERR_SANITIZATION') =>
  Object.assign(new Error('Sanitization failed; output was blocked.'), {
    code,
  });
export const escapePattern = (text) =>
  text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function collectMatches(
  text,
  regex,
  emit,
  details,
  group = 0,
  accept = () => true
) {
  // Clone expressions so concurrent callers never share lastIndex.
  const pattern = new RegExp(
    regex.source,
    regex.flags.includes('g') ? regex.flags : `${regex.flags}g`
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

function labelled(text, emit) {
  for (const [kind, words] of Object.entries(labels)) {
    const alternation = words.map(escapePattern).join('|');
    const key =
      kind === 'credential'
        ? `[\\p{L}\\p{N}_.-]{0,32}(?:${alternation})[\\p{L}\\p{N}_.-]{0,32}`
        : `(?:${alternation})`;
    // Handle quotes escaped inside an AI-session JSON string as well as raw
    // JSON, YAML, env, INI, shell flags and query-string assignments.
    const prefix = `(?<![\\p{L}\\p{N}_])(?:\\\\*["'])?(${key})(?:\\\\*["'])?[ \\t]*[:=：](?!>)[ \\t]*`;
    const quoted = new RegExp(`${prefix}(\\\\*["'])(.*?)(\\2)`, 'giu');
    const unquoted = new RegExp(
      `${prefix}(?![\\\\"'{\\[])([^\\s,;&}\\]"'<>]+)`,
      'giu'
    );
    const details = {
      type: kind === 'credential' ? 'SECRET' : kind,
      category: kind === 'credential' ? 'credential' : 'personal',
      rule: kind === 'credential' ? 'context' : 'label',
    };
    const accept = (value, match) => {
      if (value === REDACTED) {
        return false;
      }
      if (kind !== 'credential') {
        return true;
      }
      const keyName = match[1].replace(/[^\p{L}\p{N}]/gu, '').toLowerCase();
      if (
        /tokens$|token(?:count|limit|usage|budget)$/.test(keyName) &&
        /^\d+(?:\.\d+)?$/.test(value)
      ) {
        return false;
      }
      return !/^(?:true|false|null|undefined|await|async|function|none|nil)$/.test(
        value
      );
    };
    collectMatches(text, quoted, emit, details, 3, accept);
    if (kind === 'credential') {
      collectMatches(text, unquoted, emit, details, 2, accept);
    }
    // PII in labelled prose commonly spans multiple words.
    if (kind !== 'credential') {
      collectMatches(
        text,
        new RegExp(`${prefix}(?![\\\\"'{\\[])([^\\r\\n,;<>]{1,256})`, 'giu'),
        emit,
        details,
        2
      );
    }
    if (kind === 'credential') {
      collectMatches(
        text,
        new RegExp(`<((${key}))[ \\t]*>([^<]+)</\\1[ \\t]*>`, 'giu'),
        emit,
        details,
        3
      );
      collectMatches(
        text,
        new RegExp(`--(${key})[ \\t]+(?:"([^"]+)"|'([^']+)'|([^\\s]+))`, 'giu'),
        emit,
        details,
        2
      );
      // Separate unquoted/single-quoted CLI variants to keep capture offsets exact.
      collectMatches(
        text,
        new RegExp(`--(${key})[ \\t]+(?:'([^']+)'|([^\\s"']+))`, 'giu'),
        emit,
        details,
        2
      );
      collectMatches(
        text,
        new RegExp(`--(${key})[ \\t]+([^\\s"']+)`, 'giu'),
        emit,
        details,
        2
      );
    }
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

export function nativeDetect(text, options, emit) {
  const credential = { type: 'SECRET', category: 'credential' };
  for (const [rule, pattern] of serviceRules) {
    collectMatches(text, pattern, emit, { ...credential, rule });
  }
  for (const value of options.knownSecrets ?? []) {
    collectMatches(text, new RegExp(escapePattern(value), 'g'), emit, {
      ...credential,
      rule: 'known-secret',
    });
  }
  for (const entry of options.knownPersonal ?? []) {
    collectMatches(text, new RegExp(escapePattern(entry.value), 'giu'), emit, {
      type: entry.type,
      category: 'personal',
      rule: 'known-personal',
    });
  }
  labelled(text, emit);
  collectMatches(
    text,
    /-----BEGIN ([A-Z0-9 ]*PRIVATE KEY)-----[\s\S]*?(?:-----END \1-----|$)/g,
    emit,
    { ...credential, rule: 'private-key' }
  );
  collectMatches(
    text,
    /(?:Proxy-)?Authorization[ \t]*:[ \t]*(?:Bearer|Basic|Digest)[ \t]+([^\r\n"',]+)/gi,
    emit,
    { ...credential, rule: 'authorization' },
    1
  );
  collectMatches(
    text,
    /(?:Set-)?Cookie[ \t]*:[ \t]*([^\r\n]+)/gi,
    emit,
    { ...credential, rule: 'cookie' },
    1
  );
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
  collectMatches(
    text,
    /(?<![\p{L}\p{N}_.+-])[\p{L}\p{N}_.!#$%&'*+/?^`{|}~-]+@[\p{L}\p{N}](?:[\p{L}\p{N}.-]{0,252})\.[\p{L}]{2,63}(?![\p{L}\p{N}_-])/gu,
    emit,
    { type: 'EMAIL', category: 'personal', rule: 'email' }
  );
  collectMatches(
    text,
    /(?<!\d)\+\d[\d ()-]{6,24}\d(?!\d)/g,
    emit,
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
    luhn
  );
  collectMatches(
    text,
    /\b\d{3}-\d{2}-\d{4}\b/g,
    emit,
    { type: 'ID', category: 'personal', rule: 'us-ssn' },
    0,
    (v) => !/^(?:000|666|9\d\d)-|^\d{3}-00-|0000$/.test(v)
  );
  collectMatches(
    text,
    /(?<![\w.])(?:\d{1,3}\.){3}\d{1,3}(?![\w.])/g,
    emit,
    { type: 'IP_ADDRESS', category: 'personal', rule: 'ipv4' },
    0,
    (v) => isIP(v) === 4
  );
  collectMatches(
    text,
    /(?<![\w:])(?:[a-fA-F0-9]{0,4}:){2,7}[a-fA-F0-9]{0,4}(?![\w:])/g,
    emit,
    { type: 'IP_ADDRESS', category: 'personal', rule: 'ipv6' },
    0,
    (v) => isIP(v) === 6
  );
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
