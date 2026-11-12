// Differential fuzz: new projectText against the 0.22.1 implementation.
// Usage: copy the old module to src/projection-old.tmp.js first:
//   git show 500bfbd:src/projection.js > src/projection-old.tmp.js
import { projectText } from '../../src/projection.js';
const { projectText: oldProject } =
  await import('../../src/projection-old.tmp.js');
const pieces = [
  'a',
  'Z',
  '0',
  '9',
  ' ',
  '\n',
  '\t',
  '.',
  '<',
  '>',
  '\\',
  '%',
  'U',
  'u',
  '+',
  '{',
  '}',
  '\0',
  '\x1b[31m',
  '\x1b',
  '\\u0041',
  '\\u{1F600}',
  '\\x{41}',
  '\\U0001F600',
  '%u0041',
  'U+0074 U+006F U+006B U+0065',
  '\\74 \\6f \\6b \\65 ',
  '<b>',
  '</span>',
  '<div>',
  '<br/>',
  '́',
  '̈',
  'é',
  'ｆ',
  '１',
  '٣',
  '०',
  '​',
  '­',
  '﻿',
  '😀',
  'ß',
  'ﬁ',
  '…',
  'ghp…b4N',
  'Bearer 012…567',
  '…́',
  'Ⅻ',
  '㎏',
  'ｱ',
  '\uD800',
  '\uDC00',
];
let seed = 168;
const random = (n) => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) % n;
const same = (a, b) => {
  if (a.text !== b.text || a.changed !== b.changed) {
    return false;
  }
  if (!a.changed) {
    return true;
  }
  for (let i = 0; i < a.text.length; i++) {
    if (a.starts[i] !== b.starts[i] || a.ends[i] !== b.ends[i]) {
      return false;
    }
  }
  return true;
};
let checked = 0,
  differences = 0;
for (let n = 0; n < 200000; n++) {
  let input = '';
  const length = 1 + random(12);
  for (let i = 0; i < length; i++) {
    input += pieces[random(pieces.length)];
  }
  const now = projectText(input);
  // 0.22.1 projected `…` to `...`; compare against the same input with the
  // ellipsis protected, which is the only intended difference.
  if (input.includes('…')) {
    // `…` followed by a combining mark is one unit and is still normalized.
    const bare = (value) =>
      value.split('…').length - value.split(/…\p{M}/u).length;
    if (bare(now.text) !== bare(input)) {
      differences++;
      console.log(
        'ellipsis lost',
        JSON.stringify(input),
        JSON.stringify(now.text)
      );
    }
    continue;
  }
  checked++;
  if (!same(now, oldProject(input))) {
    differences++;
    if (differences < 10) {
      console.log(
        'DIFF',
        JSON.stringify(input),
        JSON.stringify(now.text),
        JSON.stringify(oldProject(input).text)
      );
    }
  }
}
console.log('checked', checked, 'differences', differences);
