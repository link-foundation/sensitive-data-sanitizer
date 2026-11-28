import { createHash } from 'node:crypto';

// Hold an incomplete record, multiline quotes, PEM blocks and wrapped base64.
function advanceQuotes(line, state, previous = '') {
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (state.escaped) {
      state.escaped = false;
      continue;
    }
    if (char === '\\' && state.quote) {
      state.escaped = true;
      continue;
    }
    if (state.quote && char === state.quote) {
      state.quote = '';
    } else if (!state.quote && opensQuote(char, i ? line[i - 1] : previous)) {
      state.quote = char;
    }
  }
}
function opensQuote(char, previous) {
  return (
    char === '"' || (char === "'" && !/[\p{L}\p{N}]/u.test(previous ?? ''))
  );
}
function advanceCredentials(line, state) {
  if (/-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/.test(line)) {
    state.pem = true;
  }
  if (/-----END [A-Z0-9 ]*PRIVATE KEY-----/.test(line)) {
    state.pem = false;
  }
  if (/^PuTTY-User-Key-File-[23]:/.test(line)) {
    state.putty = true;
  }
  if (/^Private-MAC:[ \t]*[a-fA-F0-9]+/.test(line)) {
    state.putty = false;
  }
  advanceNetrc(line, state);
}
// A netrc entry is the token sequence `machine <name> | default`, `login
// <user>`, `password <value>`, possibly across lines. Hold text only while the
// tokens seen so far are a proper prefix of that sequence; any other token
// abandons the entry. Lines like `default = ["macro"]` or `machine learning
// is fun` are therefore released at once, and each token costs O(1), so held
// text is never rescanned for every following line.
const netrcName = /^[^\s"'<>]+$/;
function advanceNetrc(line, state) {
  for (const [token] of line.matchAll(/\S+/g)) {
    state.netrc = netrcStep(state.netrc, token);
  }
}
// Steps: 0 idle, 1 expects the machine name, 2 `login`, 3 the user,
// 4 `password`, 5 the password value. Completing an entry returns to idle.
function netrcStep(step, token, validName) {
  if (netrcContinues(step, token, validName)) {
    return step === 5 ? 0 : step + 1;
  }
  return token === 'machine' ? 1 : token === 'default' ? 2 : 0;
}
function netrcContinues(step, token, validName) {
  switch (step) {
    case 1:
    case 3:
      return validName ?? netrcName.test(token);
    case 2:
      return token === 'login';
    case 4:
      return token === 'password';
    case 5:
      return true;
    default:
      return false;
  }
}
function wrappedLine(line, continues) {
  return (
    continues
      ? /^[A-Za-z0-9+/_-]{1,128}={0,2}\r?\n?$/
      : /^[A-Za-z0-9+/_-]{16,128}={0,2}\r?\n?$/
  ).test(line);
}

export function releaseBoundary(text, final) {
  if (final) {
    return text.length;
  }
  // A partial physical line cannot release a record. Leave it for the next
  // complete line or EOF, especially when a long record spans many chunks.
  const end = text.lastIndexOf('\n') + 1;
  let offset = 0,
    boundary = 0,
    base64Start = -1;
  const state = {
    quote: '',
    escaped: false,
    pem: false,
    putty: false,
    netrc: 0,
  };
  for (const match of text.slice(0, end).matchAll(/[^\n]*\n/g)) {
    const line = match[0];
    const base64 = wrappedLine(line, base64Start >= 0);
    if (base64 && base64Start < 0) {
      base64Start = offset;
    }
    if (!base64) {
      base64Start = -1;
    }
    advanceCredentials(line, state);
    advanceQuotes(line, state);
    offset += line.length;
    if (state.quote || state.pem || state.putty || state.netrc) {
      continue;
    }
    if (base64Start >= 0) {
      boundary = Math.min(boundary, base64Start);
    } else {
      boundary = offset;
    }
  }
  return boundary;
}

const pemBegin = '-----BEGIN ';
const pemEnd = '-----END ';
const pemSuffix = 'PRIVATE KEY-----';
const pemTokens = /-----BEGIN |-----END |PRIVATE KEY-----|[^A-Z0-9 -]+|-/g;
const pemLookahead = pemSuffix.length - 1;
const puttyTokens = /PuTTY-User-Key-File-[23]:|Private-MAC:/g;
const puttyLookahead = 'PuTTY-User-Key-File-3:'.length - 1;
const macHeader = 'Private-MAC:';
const lineLookahead = 132; // 128 base64 characters, two padding bytes and CRLF.

// The same multiline holds as releaseBoundary, with fixed lookahead and no
// retained physical line. Overlong records still advance the framing state.
export class StreamBoundary {
  quote = '';
  escaped = false;
  previous = '';
  pem;
  pemTail = '';
  pemCandidate;
  putty = false;
  puttyTail = '';
  puttyCanClose = false;
  puttyMac = false;
  wrapped = false;
  wrappedHead = '';
  netrc = 0;
  netrcLength = 0;
  netrcHead = '';
  netrcValid = true;

  advance(fragment, lineEnd) {
    advanceQuotes(fragment, this, this.previous);
    this.previous = fragment.at(-1) ?? this.previous;
    this.advancePem(fragment, lineEnd);
    this.advancePutty(fragment, lineEnd);
    this.advanceNetrc(fragment);
    if (this.wrappedHead.length <= lineLookahead) {
      this.wrappedHead += fragment.slice(
        0,
        lineLookahead + 1 - this.wrappedHead.length
      );
    }
    if (!lineEnd) {
      return false;
    }
    this.wrapped = wrappedLine(this.wrappedHead, this.wrapped);
    this.wrappedHead = '';
    return (
      !this.quote && !this.pem && !this.putty && !this.netrc && !this.wrapped
    );
  }

  advancePem(fragment, lineEnd) {
    const text = this.pemTail + fragment;
    const limit = lineEnd
      ? text.length
      : Math.max(0, text.length - pemLookahead);
    let next = 0;
    for (const match of text.matchAll(pemTokens)) {
      if (match.index >= limit) {
        break;
      }
      const token = match[0];
      if (token === pemSuffix && this.pemCandidate) {
        const { hash, opening } = this.pemCandidate;
        const label = hash.update(text.slice(next, match.index)).digest('hex');
        if (opening) {
          this.pem = label;
        } else if (label === this.pem) {
          this.pem = undefined;
        }
      }
      const opening = token === pemBegin;
      const relevant = opening ? !this.pem : token === pemEnd && this.pem;
      // The native rule closes only at a matching armor label. Hash the
      // label incrementally so arbitrary valid labels don't grow framing state.
      this.pemCandidate = relevant
        ? { opening, hash: createHash('sha256') }
        : undefined;
      next = match.index + token.length;
    }
    if (this.pemCandidate && next < limit) {
      this.pemCandidate.hash.update(text.slice(next, limit));
    }
    this.pemTail = text.slice(Math.max(next, limit));
    if (lineEnd) {
      this.pemCandidate = undefined;
    }
  }

  advancePutty(fragment, lineEnd) {
    const text = this.puttyTail + fragment;
    const limit = lineEnd
      ? text.length
      : Math.max(0, text.length - puttyLookahead);
    let next = 0;
    for (const match of text.matchAll(puttyTokens)) {
      if (match.index >= limit) {
        break;
      }
      this.finishMac(text.slice(next, match.index));
      this.puttyMac = match[0] === macHeader && this.puttyCanClose;
      if (match[0] !== macHeader && !this.putty) {
        this.putty = true;
        this.puttyCanClose = false;
      }
      next = match.index + match[0].length;
    }
    if (next < limit) {
      this.finishMac(text.slice(next, limit));
    }
    this.puttyTail = text.slice(Math.max(next, limit));
    if (lineEnd) {
      this.puttyCanClose = this.putty;
      this.puttyMac = false;
    }
  }

  finishMac(fragment) {
    if (this.puttyMac) {
      const first = fragment[/^[ \t]*/.exec(fragment)[0].length];
      if (first) {
        if (/[a-fA-F0-9]/.test(first)) {
          this.putty = false;
          this.puttyCanClose = false;
        }
        this.puttyMac = false;
      }
    }
  }

  advanceNetrc(fragment) {
    for (const [token] of fragment.matchAll(/\S+|\s+/g)) {
      if (/^\s/u.test(token)) {
        if (this.netrcLength) {
          this.netrc = netrcStep(this.netrc, this.netrcHead, this.netrcValid);
          this.netrcLength = 0;
          this.netrcHead = '';
          this.netrcValid = true;
        }
      } else {
        this.netrcLength = Math.min(9, this.netrcLength + token.length);
        this.netrcHead = this.netrcLength <= 8 ? this.netrcHead + token : '';
        this.netrcValid &&= netrcName.test(token);
      }
    }
  }
}
