// The known-forms test "uses one token for a name listed with its parts"
// used `;` between mentions before this PR. Issue 192 makes `;` a separator
// inside one name, so this prints what the old input gives now.
import { sanitize, createRestoreMap } from '../../src/index.js';

const values = ['Данил Сергеевич', 'Петров Данил Сергеевич', 'Петров'];
for (const text of [
  'Данил Сергеевич; Петрову Данилу Сергеевичу; Петрову',
  'Данил Сергеевич. Петрову Данилу Сергеевичу. Петрову',
]) {
  const { text: out } = sanitize(text, {
    knownOnly: true,
    knownPersonal: values.map((value) => ({ type: 'PERSON', value })),
    transformation: { mode: 'placeholder', map: createRestoreMap() },
  });
  console.log(JSON.stringify(text), '->', JSON.stringify(out));
}
