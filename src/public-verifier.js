import { URL } from 'node:url';
import { failure } from './detection.js';
/** Opt-in network lookup: sends only candidate public names, never credentials. */
export function createWikidataVerifier({
  fetch: request = globalThis.fetch,
  language = 'en',
  timeoutMs = 5000,
  maxEntries = 256,
} = {}) {
  if (
    typeof request !== 'function' ||
    !/^[a-z]{2,3}(?:-[a-z]+)?$/i.test(language) ||
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs <= 0 ||
    !Number.isSafeInteger(maxEntries) ||
    maxEntries <= 0
  ) {
    throw failure('ERR_CONFIG');
  }
  const cache = new Map();
  return async ({ type, value }) => {
    if (!['PERSON', 'ORGANIZATION'].includes(type)) {
      return undefined;
    }
    const key = `${type}:${value}`;
    if (cache.has(key)) {
      return cache.get(key);
    }
    const url = new URL('https://www.wikidata.org/w/api.php');
    for (const [name, setting] of Object.entries({
      action: 'wbsearchentities',
      format: 'json',
      language,
      search: value,
      limit: '5',
    })) {
      url.searchParams.set(name, setting);
    }
    let payload;
    try {
      const response = await request(url, {
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) {
        throw failure('ERR_PUBLIC_VERIFICATION');
      }
      payload = await response.json();
      if (!Array.isArray(payload.search)) {
        throw failure('ERR_PUBLIC_VERIFICATION');
      }
    } catch {
      throw failure('ERR_PUBLIC_VERIFICATION');
    }
    const match = payload.search.find(
      (entry) =>
        entry.label?.normalize('NFC') === value.normalize('NFC') &&
        /^Q\d+$/.test(entry.id) &&
        (type === 'PERSON'
          ? /(?:scientist|politician|writer|actor|singer|historian|physicist|mathematician|president|entrepreneur|philosopher)/i
          : /(?:company|organization|organisation|foundation|agency|university)/i
        ).test(entry.description ?? '')
    );
    const result = match
      ? {
          type,
          value,
          source: `https://www.wikidata.org/wiki/${match.id}`,
          reviewedAt: new Date().toISOString().slice(0, 10),
        }
      : undefined;
    if (cache.size >= maxEntries) {
      cache.delete(cache.keys().next().value);
    }
    cache.set(key, result);
    return result;
  };
}
