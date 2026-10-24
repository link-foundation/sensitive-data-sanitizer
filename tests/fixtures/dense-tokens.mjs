import { createHash } from 'node:crypto';

// Deterministic, distinct synthetic credentials; never real provider secrets.
export function denseTokens(count, separator = ' ') {
  return Array.from({ length: count }, (_, index) => {
    const body = createHash('sha256')
      .update(`issue-51-fixture-${index}`)
      .digest('base64')
      .replace(/[^A-Za-z0-9]/g, 'x')
      .slice(0, 36);
    return `ghp_${body}${separator}`;
  }).join('');
}
