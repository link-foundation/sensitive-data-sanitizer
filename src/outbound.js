import { createSanitizer } from './engines.js';
import { failure } from './detection.js';
/** Sanitizes one serialized payload so contextual keys survive to detection. */
export async function sanitizePayload(value, options = {}) {
  const engine = options.sanitizer ?? createSanitizer(options.sanitizerOptions);
  try {
    const serialized = JSON.stringify(value);
    const result = await engine.sanitize(serialized);
    return JSON.parse(result.text);
  } catch {
    throw failure('ERR_PUBLICATION');
  }
}
export function createSentryBeforeSend(options = {}) {
  return async (event) => {
    try {
      return await sanitizePayload(event, options);
    } catch {
      return null;
    }
  };
}
export function createOutboundSanitizer(publish, options = {}) {
  if (typeof publish !== 'function') {
    throw failure('ERR_CONFIG');
  }
  return async (payload) => publish(await sanitizePayload(payload, options));
}
