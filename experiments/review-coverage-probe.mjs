import { sanitize, entityCatalogs } from '../src/index.js';
for (const catalog of Object.values(entityCatalogs)) {
  for (const name of catalog.names) {
    const field = name.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase();
    try {
      sanitize(`${field}: private-value`);
    } catch (error) {
      console.log(field, error.code);
    }
  }
}
for (const value of [
  '529.982.247-25',
  '12345678Z',
  'ABCDE1234F',
  '1234567893',
]) {
  console.log(value, sanitize(value).text);
}
