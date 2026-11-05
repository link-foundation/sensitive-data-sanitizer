// Finite witnesses taken from the saved CodeQL SARIF. Parent bounds execution.
import { detectIdentity } from '../../src/identity.js';
import { detectPersonal } from '../../src/personal.js';
const kind = process.argv[2];
const prefix = {
  booking: 'booking',
  ticket: 'ticket',
  visa: 'visa',
  postal: '1 Main Street,',
}[kind];
if (!prefix) {
  throw new Error('Choose booking, ticket, visa, or postal');
}
const text = `${prefix}${'\t'.repeat(300_000)}!`;
(kind === 'postal' ? detectPersonal : detectIdentity)(text, () => {});
console.log('completed');
