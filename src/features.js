// Personal-data features that the main entry registers through
// `personal-features.js`. The `./credentials` entry never imports that module,
// so it does not load the personal detectors, faker or libphonenumber
// (issue 137). This module must stay free of imports.
const registered = {};

export function registerFeatures(entries) {
  Object.assign(registered, entries);
}

/** Runs the registered implementation, or returns `fallback` without one. */
export function withFeature(name, fallback, ...args) {
  const value = registered[name];
  return value ? value(...args) : fallback;
}

/** The registered implementation; fails closed when it is unavailable. */
export function feature(name) {
  const value = registered[name];
  if (!value) {
    throw Object.assign(
      new Error(
        'This option needs the personal-data modules of the main entry.'
      ),
      { code: 'ERR_CONFIG' }
    );
  }
  return value;
}
