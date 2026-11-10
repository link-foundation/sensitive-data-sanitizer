import { maskedValue } from './credentials.js';

// Credential findings cover the secret, not the readable context around it:
// PEM markers, URL hosts and user names, cookie names and the rest of a
// sentence stay visible, so a masked log still shows what was masked.

// Context rules that read "to the end of the value" without knowing the
// value's format. A structured vendor token that starts the same value
// bounds them.
const openEnded = new Set([
  'context',
  'cookie',
  'named-value',
  'cli-password',
  'quoted-entropy',
  'entropy',
  'gitleaks/generic-api-key',
  'betterleaks/generic-api-key',
]);
const notBounding = new Set([...openEnded, 'known-secret', 'authorization']);
const lineBreak = '(?:\\r?\\n|\\\\+[nr])';
const pemMarker = new RegExp(
  `-----(BEGIN|END) [A-Z0-9 _-]{0,100}-----(?:[ \\t]*${lineBreak})?`,
  'g'
);

// Body spans of every BEGIN/END block inside [start, end). Text between two
// blocks never belongs to a key; an unterminated block runs to `end`.
export function pemBodies(text, start, end) {
  const segment = text.slice(start, end);
  if (!/^(?:\\*["'])?-----BEGIN /.test(segment)) {
    return undefined;
  }
  const bodies = [];
  let open;
  for (const marker of segment.matchAll(pemMarker)) {
    if (marker[1] === 'BEGIN') {
      open = marker.index + marker[0].length;
    } else if (open !== undefined) {
      bodies.push(trimmed(text, start + open, start + marker.index));
      open = undefined;
    }
  }
  if (open !== undefined) {
    bodies.push(trimmed(text, start + open, end));
  }
  return bodies.filter((body) => body.end > body.start);
}
function trimmed(text, start, end) {
  const body = text.slice(start, end);
  const lead = /^(?:\s|\\+[nrt])+/.exec(body)?.[0].length ?? 0;
  const tail = /(?:\s|\\+[nrt])+$/.exec(body.slice(lead))?.[0].length ?? 0;
  return { start: start + lead, end: end - tail };
}

// `scheme://user:password@host`: only the password is the credential.
const userinfo = /^[a-z][a-z0-9+.-]*:\/\/([^\s/@:]+):([^\s/@]+)@/i;
// A URL secret keeps its scheme, host and fixed path words
// (`https://hooks.slack.com/services/`), so a reader still sees which
// endpoint it was.
const serviceUser =
  /^(?:x-access-token|x-oauth-basic|x-token-auth|oauth2?|git|gitlab-ci-token|token|pat|apikey|api)$/i;
const endpoint = /^(?:https?:\/\/)?[a-z0-9-]+(?:\.[a-z0-9-]+)+\//i;
const pathWord = /^(?:[a-z]{2,20}(?:\d{1,2})?\/)+/i;

function urlSecret(text, finding) {
  const value = text.slice(finding.start, finding.end);
  // `url-userinfo` already covers only `user:password`.
  const own = finding.rule === 'url-userinfo';
  const credentials = own
    ? /^([^:]+):(.+)$/s.exec(value)
    : userinfo.exec(value);
  if (credentials) {
    const end = finding.start + credentials[0].length - (own ? 0 : 1);
    const start = end - credentials[2].length;
    const user = start - 1 - credentials[1].length;
    return [
      { start, end },
      // Outside credentialsOnly the user name is still personal data.
      ...(serviceUser.test(credentials[1]) || maskedValue(credentials[1])
        ? []
        : [
            {
              start: user,
              end: user + credentials[1].length,
              type: 'USERNAME',
              category: 'personal',
            },
          ]),
    ];
  }
  const host = endpoint.exec(value);
  if (!host || finding.rule === 'url-userinfo') {
    return undefined;
  }
  const words = pathWord.exec(value.slice(host[0].length))?.[0] ?? '';
  const start = finding.start + host[0].length + words.length;
  return finding.end - start >= 8 ? [{ start, end: finding.end }] : undefined;
}

function narrowed(text, finding) {
  if (finding.category !== 'credential') {
    return [finding];
  }
  const parts =
    pemBodies(text, finding.start, finding.end) ?? urlSecret(text, finding);
  return parts ? parts.map((part) => ({ ...finding, ...part })) : [finding];
}

// A complete existing mask bounds context too: vendor rules no longer match
// it on the next pass. Only strip sentence punctuation, never a glued suffix.
function maskedPrefix(text, start, end) {
  const token = /^[^\s]+/u.exec(text.slice(start, end))?.[0] ?? '';
  let length = token.length;
  while (length > 0 && /[.,;:!?]/.test(token[length - 1])) {
    length--;
  }
  const value = token.slice(0, length);
  return maskedValue(value) ? start + value.length : end;
}

// `token: ghp_… . Next sentence` — a context value that a vendor rule ends
// earlier stops at that end when only punctuation or a space follows.
function bounded(text, finding, findings) {
  if (!openEnded.has(finding.rule) || finding.category !== 'credential') {
    return finding;
  }
  let end = maskedPrefix(text, finding.start, finding.end);
  for (const other of findings) {
    if (
      other.category === 'credential' &&
      !notBounding.has(other.rule) &&
      other.start === finding.start &&
      other.end < end &&
      other.end > other.start &&
      /^[.,;:!?]*(?:\s|$)/.test(text.slice(other.end, finding.end))
    ) {
      end = other.end;
    }
  }
  return end === finding.end ? finding : { ...finding, end };
}

// PEM armor (`-----BEGIN RSA PRIVATE KEY-----`) stays readable, and its
// upper-case words are not a person or an organization.
function pemMarkers(text, findings) {
  const markers = [];
  for (const finding of findings) {
    const segment = text.slice(finding.start, finding.end);
    if (finding.category === 'credential' && /-----BEGIN /.test(segment)) {
      for (const marker of segment.matchAll(pemMarker)) {
        const start = finding.start + marker.index;
        markers.push({ start, end: start + marker[0].length });
      }
    }
  }
  return markers;
}

export function refineCredentialSpans(text, findings) {
  const markers = pemMarkers(text, findings);
  const narrow = findings
    .filter(
      (finding) =>
        finding.category === 'credential' ||
        !markers.some(
          (marker) => finding.start < marker.end && marker.start < finding.end
        )
    )
    .flatMap((finding) => narrowed(text, finding));
  return narrow.map((finding) => bounded(text, finding, narrow));
}

// `Cookie: a=1; b=2` and `Set-Cookie: id=…; Path=/; HttpOnly`: each cookie
// value is a credential; names, separators and attributes stay readable.
const cookieAttribute =
  /^(?:path|domain|expires|max-age|samesite|secure|httponly|priority|partitioned|version|comment)$/i;
export function cookieValues(text, start, end) {
  const values = [];
  for (const pair of text.slice(start, end).matchAll(/[^;]+/g)) {
    const part = /^[ \t]*(?:([^=\s]+)[ \t]*=[ \t]*)?(.*?)[ \t]*$/s.exec(
      pair[0]
    );
    const [, name, value] = part;
    if (!value || cookieAttribute.test(name ?? value)) {
      continue;
    }
    const valueEnd = start + pair.index + pair[0].replace(/[ \t]+$/, '').length;
    values.push({ start: valueEnd - value.length, end: valueEnd });
  }
  return values;
}
