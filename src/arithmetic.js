/** Browser-compatible utilities retained from the original template. */

/** Add two numbers. */
export const add = (a, b) => a + b;

/** Multiply two numbers. */
export const multiply = (a, b) => a * b;

/** Resolve after the requested number of milliseconds. */
export const delay = (ms) =>
  new Promise((resolve) => globalThis.setTimeout(resolve, ms));
