import {
  inspectReport,
  sanitize,
  validateOptions,
  applyProfile,
} from './sanitizer.js';

/** A reusable synchronous engine with the same verified publication boundary. */
export function createSyncSanitizer(options = {}) {
  options = applyProfile(options);
  validateOptions(options);
  return Object.freeze({
    inspect: (text) => inspectReport(text, options),
    sanitize: (text) => sanitize(text, options),
  });
}
