import {
  sanitize,
  restore,
  createRestoreMap,
  serializeRestoreMap,
} from '../src/index.js';

// Keep this map private. Publish only result.text, never the map or result.
const map = createRestoreMap();
const options = {
  profile: 'documents',
  transformation: { mode: 'placeholder', map },
};
const text = 'Jane Doe worked at Acme Ltd in Springfield.';
const result = sanitize(text, options);
console.log(result.text);
console.log('Exact private round trip:', restore(result.text, map) === text);
console.log(
  'Derived answer restored privately:',
  restore('Ask Person-1 about Organization-1.', map)
);
console.log(
  'Private map serialization available:',
  typeof serializeRestoreMap(map, 'lino') === 'string'
);
const anonymous = sanitize(text, {
  ...options,
  transformation: { mode: 'placeholder', map: false },
});
console.log(
  'No-map output:',
  anonymous.text,
  'Map returned:',
  Object.hasOwn(anonymous, 'map')
);
