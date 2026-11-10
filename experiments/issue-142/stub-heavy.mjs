// Replace faker and libphonenumber with empty modules to measure how much of
// the start-up cost they account for (issue 137). Usage:
//   node --import ./experiments/issue-142/stub-heavy.mjs -e "await import('./src/index.js')"
import { registerHooks } from 'node:module';
const names =
  'Faker en es fr de pt_BR ru ja zh_CN zh_TW ko ar he tr id_ID vi th parsePhoneNumberFromString'.split(
    ' '
  );
registerHooks({
  resolve(specifier, context, next) {
    return /^(@faker-js\/faker|libphonenumber-js\/max)$/.test(specifier)
      ? {
          url: `data:text/javascript,${names.map((n) => `export const ${n}={};`).join('')}`,
          shortCircuit: true,
        }
      : next(specifier, context);
  },
});
