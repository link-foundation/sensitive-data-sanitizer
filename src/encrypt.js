import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  hkdfSync,
} from 'node:crypto';
import { failure } from './detection.js';

// Deterministic authenticated encryption (synthetic IV), comparable to
// Google's CryptoDeterministicConfig (AES-SIV) and Presidio's encrypt
// operator. Equal values of one type produce equal tokens, so the output
// still supports joins and counts, and decrypt() recovers the value. The
// derived IV is an HMAC of the type and value, so it never repeats for
// different plaintexts under one key.
const ivBytes = 12,
  tagBytes = 16;
const token = /\[ENCRYPTED:([A-Z][A-Z0-9_]{0,63}):([A-Za-z0-9_-]{38,10000})\]/g;
const keys = new Map();

function derived(key) {
  if (typeof key !== 'string' || Buffer.byteLength(key) < 16) {
    throw failure('ERR_CONFIG');
  }
  let entry = keys.get(key);
  if (!entry) {
    const material = Buffer.from(
      hkdfSync(
        'sha256',
        key,
        'sensitive-data-sanitizer',
        'deterministic-encryption-v1',
        64
      )
    );
    entry = { cipher: material.subarray(0, 32), mac: material.subarray(32) };
    if (keys.size >= 16) {
      keys.clear();
    }
    keys.set(key, entry);
  }
  return entry;
}

export function encryptValue(value, type, key) {
  const { cipher, mac } = derived(key);
  const iv = createHmac('sha256', mac)
    .update(`${type}\0${value}`)
    .digest()
    .subarray(0, ivBytes);
  const engine = createCipheriv('aes-256-gcm', cipher, iv);
  engine.setAAD(Buffer.from(type));
  const body = Buffer.concat([engine.update(value, 'utf8'), engine.final()]);
  const payload = Buffer.concat([iv, body, engine.getAuthTag()]);
  return `[ENCRYPTED:${type}:${payload.toString('base64url')}]`;
}

function decryptToken(type, encoded, key) {
  const { cipher } = derived(key);
  const payload = Buffer.from(encoded, 'base64url');
  if (payload.length < ivBytes + tagBytes) {
    throw failure('ERR_MAP');
  }
  try {
    const engine = createDecipheriv(
      'aes-256-gcm',
      cipher,
      payload.subarray(0, ivBytes)
    );
    engine.setAAD(Buffer.from(type));
    engine.setAuthTag(payload.subarray(-tagBytes));
    return Buffer.concat([
      engine.update(payload.subarray(ivBytes, -tagBytes)),
      engine.final(),
    ]).toString('utf8');
  } catch {
    throw failure('ERR_MAP');
  }
}

/**
 * Restores `[ENCRYPTED:TYPE:…]` tokens produced by `{mode: 'encrypt', key}`.
 * A token that fails authentication under `key` throws ERR_MAP; nothing is
 * partially restored. With `json: true` restored values are JSON-escaped for
 * tokens inside JSON string literals.
 */
export function decrypt(text, key, { json = false } = {}) {
  if (typeof text !== 'string') {
    throw failure('ERR_INPUT');
  }
  derived(key);
  return text.replace(token, (_, type, encoded) => {
    const value = decryptToken(type, encoded, key);
    return json ? JSON.stringify(value).slice(1, -1) : value;
  });
}
