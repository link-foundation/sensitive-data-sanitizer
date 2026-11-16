// Checks that an initial without its period ends its token (issue 206), for
// a Russian name with known roles and for a pair whose roles are unknown.
// Usage: node experiments/issue-206/initial-ends-token.mjs
import { compileKnown, inspect } from '../../src/index.js';

let failures = 0;
const check = (known, text, wanted) => {
  const found = inspect(text, { knownOnly: true, knownPersonal: known }).map(
    (f) => text.slice(f.start, f.end)
  );
  const ok = JSON.stringify(found) === JSON.stringify(wanted);
  failures += ok ? 0 : 1;
  console.log(
    ok ? 'ok  ' : 'FAIL',
    JSON.stringify(text),
    JSON.stringify(found)
  );
};
for (const flags of [{}, { identifiers: true, transliterate: true }]) {
  const mark = compileKnown([{ type: 'PERSON', value: 'Фомичёв Марк' }], flags);
  check(mark, 'Марк Ф2 и Марк Ф-2 ушли', []);
  check(mark, 'Марк Ф_2 ушёл', []);
  check(mark, 'Марк Фх ушёл', []);
  check(mark, 'Марк Ф. ответил', ['Марк Ф.']);
  check(mark, 'Марк Ф ответил', ['Марк Ф']);
  check(mark, 'Пишет Марк Ф', ['Марк Ф']);
  check(mark, 'Марк Ф, привет', ['Марк Ф']);
  check(mark, '(Марк Ф)', ['Марк Ф']);
  // Plain text treats `Ф.2` as one token; identifiers end a segment at a digit.
  check(mark, 'Марк Ф.2', flags.identifiers ? ['Марк Ф.'] : []);
  const pair = compileKnown([{ type: 'PERSON', value: 'John Smith' }], flags);
  check(pair, 'John S2 and John S-2', []);
  check(pair, 'John S. wrote', ['John S.']);
  check(pair, 'John S wrote', ['John S']);
  check(pair, 'Smith J. wrote', ['Smith J.']);
}
const latin = compileKnown([{ type: 'PERSON', value: 'Фомичёв Марк' }], {
  identifiers: true,
  transliterate: true,
});
check(latin, 'if I mark F2C partial', []);
check(latin, 'Mark F. wrote', ['Mark F.']);
console.log(failures ? `${failures} failures` : 'all ok');
process.exitCode = failures ? 1 : 0;
