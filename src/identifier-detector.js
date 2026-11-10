import { failure } from './detection.js';
import { detectNational } from './national.js';

const validRule = (rule) =>
  rule &&
  typeof rule.type === 'string' &&
  /^[A-Z][A-Z0-9_]{0,63}$/.test(rule.type) &&
  rule.pattern instanceof RegExp &&
  rule.pattern.global &&
  rule.context instanceof RegExp &&
  !rule.context.global &&
  !rule.context.sticky &&
  typeof rule.checksum === 'function' &&
  ['plausible', 'valid'].every(
    (key) => rule[key] === undefined || typeof rule[key] === 'function'
  );

// Adapts identifier rules (the `nationalRules` shape) to the Detector port, so
// callers can add or replace identifiers without forking the built-in table.
export function createIdentifierDetector(
  rules,
  { id = 'identifier-rules' } = {}
) {
  if (!Array.isArray(rules) || rules.length === 0 || !rules.every(validRule)) {
    throw failure('ERR_CONFIG');
  }
  const frozen = rules.map((rule) => Object.freeze({ ...rule }));
  return {
    id,
    detect(text) {
      const findings = [];
      detectNational(text, (finding) => findings.push(finding), frozen);
      return findings;
    },
  };
}
