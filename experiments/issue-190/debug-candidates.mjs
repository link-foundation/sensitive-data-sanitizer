// Prints the anchors of each known entry and the matches the prefilter finds.
// Usage: node debug-candidates.mjs TEXT VALUE...
import { compileKnown } from '../../src/index.js';
import { knownMatcher } from '../../src/compiled-known.js';
import { regexAnchors } from '../../src/known-matcher.js';
import { personalSource } from '../../src/personal-variants.js';

const [text = 'о Тютюнника Евсея', ...rest] = process.argv.slice(2);
const values = rest.length ? rest : ['Тютюнник Евсей', 'Пряжкина Велимира'];
const list = compileKnown(values.map((value) => ({ type: 'PERSON', value })));
const matcher = knownMatcher(list);
for (const entry of list) {
  console.log(
    entry.value,
    regexAnchors(personalSource(entry.value, entry.type, entry))
  );
}
matcher.each(text, (index, match) =>
  console.log('match', list[index].value, match.index, JSON.stringify(match[0]))
);
console.log(`compiled ${matcher.created()} of ${matcher.size} expressions`);
