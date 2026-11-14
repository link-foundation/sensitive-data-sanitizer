// Prints which known entries the prefilter selects for a text.
import { compileKnown } from '../../src/index.js';
import { knownMatcher } from '../../src/compiled-known.js';
import { regexAnchors } from '../../src/known-matcher.js';
import { personalSource } from '../../src/personal-variants.js';

const values = process.argv.slice(3);
const list = compileKnown(values.map((value) => ({ type: 'PERSON', value })));
const marks = knownMatcher(list).candidates(process.argv[2]);
for (const [index, entry] of list.entries()) {
  console.log(
    marks[index] ? 'RUN ' : 'skip',
    entry.value,
    regexAnchors(personalSource(entry.value, entry.type, entry))
  );
}
