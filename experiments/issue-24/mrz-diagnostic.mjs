import { parse } from 'mrz';
import { sanitize } from '../../src/index.js';
import { mrzCheck } from '../../src/identity.js';
const key = 'private-fixture-key-at-least-16-bytes';
const options = { transformation: { mode: 'fake', key } };
const header = 'P<RUSKOVALEVA<<MARINA'.padEnd(44, '<');
let data = `583920471${mrzCheck('583920471')}RUS820411${mrzCheck(
  '820411'
)}F310519${mrzCheck('310519')}<<<<<<<<<<<<<<0`;
data += mrzCheck(data.slice(0, 10) + data.slice(13, 20) + data.slice(21, 43));
const input = `${header}\n${data}\nApplicant: Marina Kovaleva\nborn on ${['1982', '04', '11'].join('-')}`;
const output = sanitize(input, options).text.split('\n');
const document = parse(output.slice(0, 2));
console.log(JSON.stringify({ output, document }, null, 2));
const uto = sanitize(`${header}\n${data}`, {
  transformation: { mode: 'fake', key, mrzCountry: 'UTO' },
}).text.split('\n');
console.log(JSON.stringify({ uto, parsed: parse(uto) }, null, 2));
