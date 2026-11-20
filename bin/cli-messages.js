import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { createI18n, parseLinoCatalogs } from 'lino-i18n/browser';
import { resolveConfig } from 'lino-arguments/pure';
import { failure } from '../src/detection.js';

const catalogs = parseLinoCatalogs(
  readFileSync(new URL('./cli-messages.lino', import.meta.url), 'utf8')
);
const i18n = createI18n({
  locales: Object.fromEntries(
    catalogs.map(({ locale, translations }) => [locale, translations])
  ),
});

export function resolveCliEnvironment(env = process.env) {
  return resolveConfig({
    autoMap: false,
    env: { SDS_CONFIG: env.SDS_CONFIG, SDS_LOCALE: env.SDS_LOCALE },
    options: {
      config: { type: 'string', env: 'SDS_CONFIG' },
      locale: { type: 'string', env: 'SDS_LOCALE', default: 'en' },
    },
  });
}

export function cliLocaleArgument(argv, fallback) {
  const separator = argv.indexOf('--');
  const index = argv.indexOf('--locale');
  if (index === -1 || (separator !== -1 && index > separator)) {
    return fallback;
  }
  if (!argv[index + 1] || argv[index + 1].startsWith('-')) {
    throw failure('ERR_LOCALE');
  }
  return argv.splice(index, 2)[1];
}

export function cliLocale(tag) {
  const locale = tag.toLowerCase().split(/[-_.]/, 1)[0];
  if (!i18n.listLocales().includes(locale)) {
    throw failure('ERR_LOCALE');
  }
  return (key, parameters) => i18n.t(key, parameters, { locale });
}
