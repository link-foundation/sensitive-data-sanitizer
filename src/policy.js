import { failure } from './detection.js';
import { builtInRules, credentialRules } from './rule-catalog.js';
import { normalizeFieldName } from './document-fields.js';

const ruleIds = new Set(builtInRules);
const credentialType = (type) =>
  /SECRET|TOKEN|PASSWORD|AUTH|CREDENTIAL|PRIVATE_KEY|ACCESS_KEY|^PIN$|CVV|CVC|CONNECTION.*STRING/.test(
    type
  );
const record = (value) =>
  value && typeof value === 'object' && !Array.isArray(value);
// These recognizers consume the replaceable cue lists. Independent evidence
// (legal forms, dates, full names, identifiers) remains available.
const vocabularyRules = {
  roles: ['document-reversed-role', 'document-role-employer'],
  organizationCues: [
    'organization-context',
    'employer-label',
    'employer-prose',
    'organization-cue',
    'organization-group-cue',
    'document-employer-prefix',
    'document-employer-dash',
  ],
  educationCues: [
    'school-acronym-context',
    'education-label',
    'education-training',
    'document-school-context',
    'numbered-school',
    'education-type',
    'education-russian',
  ],
  personalLabels: ['document-role'],
};
export function validatePolicyControls(options) {
  for (const key of ['allowCredentialDisable', 'strict', 'exactFields']) {
    if (options[key] !== undefined && typeof options[key] !== 'boolean') {
      throw failure('ERR_CONFIG');
    }
  }
  for (const key of ['rules', 'types', 'fields']) {
    if (options[key] === undefined) {
      continue;
    }
    if (!record(options[key])) {
      throw failure('ERR_CONFIG');
    }
    for (const [id, value] of Object.entries(options[key])) {
      validateControl(key, id, value, options);
    }
  }
}
function validateControl(key, id, value, options) {
  const validId =
    key === 'rules'
      ? ruleIds.has(id)
      : key === 'types'
        ? /^[A-Z][A-Z0-9_]{0,63}$/.test(id)
        : id.length > 0;
  if (
    !validId ||
    (key === 'fields' ? value !== 'scan' : typeof value !== 'boolean')
  ) {
    throw failure('ERR_CONFIG');
  }
  const credential =
    key === 'rules' ? credentialRules.has(id) : credentialType(id);
  if (value === false && !options.allowCredentialDisable && credential) {
    throw failure('ERR_CONFIG');
  }
}
export function builtInEnabled(finding, options) {
  if (finding.category === 'credential' && !options.allowCredentialDisable) {
    return true;
  }
  for (const [list, rules] of Object.entries(vocabularyRules)) {
    if (
      options.vocabulary?.[list]?.replace === true &&
      rules.includes(finding.rule)
    ) {
      return false;
    }
  }
  return (
    options.rules?.[finding.rule] !== false &&
    options.types?.[finding.type] !== false
  );
}
export function scanField(field, options) {
  return Object.keys(options.fields ?? {}).some(
    (name) => normalizeFieldName(name) === normalizeFieldName(field)
  );
}
export function fieldMatches(patterns, field, path, exact = false) {
  const normalize = exact ? (s) => s : normalizeFieldName;
  return (patterns ?? []).some((pattern) => {
    const parts = pattern.split('.');
    const values = parts.length === 1 ? [field] : path;
    return (
      parts.length === values.length &&
      parts.every(
        (part, i) => part === '*' || normalize(part) === normalize(values[i])
      )
    );
  });
}
