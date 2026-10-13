// Lists the findings that overlap encoded runs in the transform fixture and
// in the nested escaped key assignment from issue 38.
import { inspect } from '../../src/index.js';

const encoded = Buffer.from('Password: abcdefghijklmnop').toString('base64');
for (const [text, options] of [
  [JSON.stringify({ data: encoded }), {}],
  [
    `${JSON.stringify({ text: 'APIkey="\\"private_key:9"' })}\n`,
    { structured: 'jsonl', profile: 'publication' },
  ],
]) {
  console.log(text.trim());
  for (const f of inspect(text, options)) {
    console.log(
      ' ',
      f.start,
      f.end,
      f.type,
      f.category,
      f.rule,
      JSON.stringify(text.slice(f.start, f.end))
    );
  }
}
