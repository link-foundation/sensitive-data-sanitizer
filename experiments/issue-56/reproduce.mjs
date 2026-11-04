import { inspect, sanitize, restore } from '../../src/index.js';

const text =
  '2019–2023  Acme Ltd, Senior Engineer\n2015–2019  Northfield State University\nBased in Springfield, relocated from Riverton\nООО «Ромашка»\nРомашка GmbH';
console.log(
  'Document findings:',
  inspect(text).map(({ type, start, end }) => ({
    type,
    value: text.slice(start, end),
  }))
);
try {
  console.log(
    sanitize('Jane Doe met Jane Doe.', {
      transformation: { mode: 'placeholder' },
    })
  );
} catch (error) {
  console.log('Placeholder mode:', error.code);
}

const fixed = sanitize(text, {
  profile: 'documents',
  transformation: { mode: 'placeholder' },
});
console.log('Documents profile:', fixed.text);
console.log('Exact restoration:', restore(fixed.text, fixed.map) === text);
