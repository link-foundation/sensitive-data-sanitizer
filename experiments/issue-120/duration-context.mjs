import { createSyncSanitizer, restore } from '../../src/index.js';

const config = {
  profile: 'documents',
  properNames: 'capitalized',
  strict: true,
};
for (const input of [
  'работал в ромашке 5 лет',
  'Kubernetes (5 лет)',
  'Power BI (5 лет)',
  'Работал там 5 лет',
]) {
  for (const transformation of [undefined, { mode: 'placeholder' }]) {
    try {
      const result = createSyncSanitizer({
        ...config,
        transformation,
      }).sanitize(input);
      console.log(
        JSON.stringify({
          input,
          mode: transformation?.mode ?? 'redact',
          output: result.text,
          ...(result.map ? { restored: restore(result.text, result.map) } : {}),
        })
      );
    } catch (error) {
      console.log(
        JSON.stringify({ input, mode: transformation?.mode, error: error.code })
      );
    }
  }
}
