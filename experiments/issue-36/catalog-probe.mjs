import { entityCatalogs, sanitize } from '../../src/index.js';

for (const [vendor, catalog] of Object.entries(entityCatalogs)) {
  for (const name of catalog.names) {
    const field = name.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase();
    const value = /^(?:EMAIL|EMAIL_ADDRESS)$/.test(field)
      ? 'private@unknown.example'
      : /^(?:PHONE|PHONE_NUMBER)$/.test(field)
        ? '+1 202 555 0198'
        : /^(?:NAME|PERSON|PERSON_NAME)$/.test(field)
          ? 'Qazvela Zorveta'
          : /^(?:STATE|US_STATE|CITY|REGION|PROVINCE)$/.test(field)
            ? 'California'
            : 'private-value';
    const output = sanitize(`${field}: ${value}`).text;
    if (output !== `${field}: ${field === 'DATE' ? value : '[REDACTED]'}`) {
      console.log(JSON.stringify({ vendor, field, value, output }));
    }
  }
}
