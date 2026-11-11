import { failure } from './detection.js';

// Values that `mode: 'fake'` generated, per transformation object, so that a
// later pass recognizes them as fictional. Kept apart from fake.js so that the
// credentials entry can read the (empty) memory without loading faker.
const generated = new WeakMap();
export function generatedValues(options) {
  const transforms = [
    options.transformation,
    ...Object.values(options.transformations ?? {}),
  ];
  return transforms.flatMap((t) =>
    t?.mode === 'fake'
      ? [...(generated.get(t) ?? [])].map(([value, credential]) => ({
          value,
          credential,
        }))
      : []
  );
}
/** How many fake values the transformations remember; grows during a call. */
export function generatedCount(options) {
  let count = 0;
  for (const t of [
    options.transformation,
    ...Object.values(options.transformations ?? {}),
  ]) {
    count += t?.mode === 'fake' ? (generated.get(t)?.size ?? 0) : 0;
  }
  return count;
}
export function remember(value, transform, credential) {
  let values = generated.get(transform);
  if (!values) {
    values = new Map();
    generated.set(transform, values);
  }
  if (values.size >= 100000 && !values.has(value)) {
    throw failure('ERR_LIMIT');
  }
  values.set(value, credential);
  return value;
}
