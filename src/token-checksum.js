// Offline structural check for prefixed tokens that end in a checksum.
// GitHub (ghp_, gho_, ghu_, ghs_, ghr_) and npm (npm_) tokens append six
// base62 characters: CRC32 (IEEE) of the characters after the first `_`.
// A valid checksum raises confidence; an invalid one never removes a finding
// because truncated or retyped tokens still need redaction.
const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const CHECKSUM_TOKEN = /^(?:gh[opsur]|npm)_([A-Za-z0-9]{30})([A-Za-z0-9]{6})$/;

let table;
function crcTable() {
  table ??= Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    return c >>> 0;
  });
  return table;
}

export function crc32(text) {
  let crc = 0xffffffff;
  for (let i = 0; i < text.length; i++) {
    crc = crcTable()[(crc ^ text.charCodeAt(i)) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function base62(value, width = 6) {
  let out = '';
  for (let i = 0; i < width; i++) {
    out = BASE62[value % 62] + out;
    value = Math.floor(value / 62);
  }
  return out;
}

// Builds a checksum-valid token from a prefix (including `_`) and a
// 30-character body, so tests and examples need no stored token literals.
export function tokenWithChecksum(prefix, body) {
  return `${prefix}${body}${base62(crc32(body))}`;
}

// true: checksum matches; false: format matches but checksum does not;
// undefined: the value is not a checksummed token format.
export function tokenChecksum(value) {
  const match = CHECKSUM_TOKEN.exec(value);
  return match ? base62(crc32(match[1])) === match[2] : undefined;
}
