// Library-free repro from issue 172: the `key` shape of credentialPrefix
// overflows V8's regexp stack only on two-byte strings.
const re =
  /(?<![\p{L}\p{N}_])((?:[\p{L}\p{N}]+[_.-]){0,16}(?:auth|token|pass)(?:[_.-][\p{L}\p{N}]+){0,16})(?![\p{L}\p{N}_])[ \t]*[:=]/giu;
const mib = Number(process.argv[2] ?? 4);
for (const tail of ['\nauth: x é\n', '\nauth: x —\n']) {
  const text = 'A'.repeat(mib * 1024 * 1024) + tail;
  try {
    console.log(JSON.stringify(tail), [...text.matchAll(re)].length);
  } catch (err) {
    console.log(JSON.stringify(tail), err.message);
  }
}
