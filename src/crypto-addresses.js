import { createHash } from 'node:crypto';

// Offline checksum validation for Bitcoin addresses (Presidio parity): legacy
// Base58Check (P2PKH/P2SH) and SegWit Bech32/Bech32m. Ethereum addresses carry
// no case-insensitive checksum and stay format-only.
const base58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const sha256 = (bytes) => createHash('sha256').update(bytes).digest();

export function base58Check(value) {
  let number = 0n;
  for (const char of value) {
    const digit = base58.indexOf(char);
    if (digit < 0) {
      return false;
    }
    number = number * 58n + BigInt(digit);
  }
  const hex = number.toString(16);
  const body = Buffer.from(hex.length % 2 ? `0${hex}` : hex, 'hex');
  const zeros = /^1*/.exec(value)[0].length;
  const bytes = Buffer.concat([Buffer.alloc(zeros), body]);
  if (bytes.length !== 25) {
    return false;
  }
  const check = sha256(sha256(bytes.subarray(0, 21))).subarray(0, 4);
  return check.equals(bytes.subarray(21));
}

const bech32Charset = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
function polymod(values) {
  const generator = [
    0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3,
  ];
  let checksum = 1;
  for (const value of values) {
    const top = checksum >>> 25;
    checksum = ((checksum & 0x1ffffff) << 5) ^ value;
    for (let i = 0; i < 5; i++) {
      if ((top >>> i) & 1) {
        checksum ^= generator[i];
      }
    }
  }
  return checksum >>> 0;
}
export function bech32Address(value) {
  if (value !== value.toLowerCase() && value !== value.toUpperCase()) {
    return false;
  }
  const lower = value.toLowerCase();
  const separator = lower.lastIndexOf('1');
  const prefix = lower.slice(0, separator);
  const data = [...lower.slice(separator + 1)].map((char) =>
    bech32Charset.indexOf(char)
  );
  if (!['bc', 'tb'].includes(prefix) || data.length < 7 || data.includes(-1)) {
    return false;
  }
  const expanded = [
    ...[...prefix].map((char) => char.charCodeAt(0) >> 5),
    0,
    ...[...prefix].map((char) => char.charCodeAt(0) & 31),
    ...data,
  ];
  const constant = polymod(expanded);
  return constant === 1 || constant === 0x2bc830a3;
}

export function cryptoAddress(value) {
  if (/^0x[a-fA-F0-9]{40}$/.test(value)) {
    return true;
  }
  return /^(?:bc|tb)1/i.test(value) ? bech32Address(value) : base58Check(value);
}
