// Fuzzes the original camelCase key scan against the linear one (issue #170):
// both must report the same matches, groups and indexes on short inputs.
const suffix =
  '(?:Secret|Password|Passwd|Passphrase|Pass|Pwd|Token|Credentials?|(?:Api|Private|Access|Secret|Signing|Encryption|Master|Client|App|Subscription|Account|Storage)Key)(?:Key|Value)?';
const exact =
  '(?:[Ss]ecret|[Pp]assword|[Pp]asswd|[Tt]oken|[Pp]rivate|[Aa]ccess|[Ss]igning|[Ee]ncryption)(?:Key|Value|Secret|Token)';
const rocket = `=>(?=[ \\t]*\\\\*["'])`;
const build = (key) =>
  new RegExp(
    `(?<![\\p{L}\\p{N}_$])(?:\\\\*["'])?(${key})(?![\\p{L}\\p{N}_])(?:\\\\*["'])?[ \\t]*(${rocket}|[:=])[ \\t]*`,
    'gu'
  );
const before = build(
  `[\\p{L}][\\p{Ll}\\p{N}]*(?:\\p{Lu}[\\p{Ll}\\p{N}]*)*?${suffix}|${exact}`
);
const after = build(`[\\p{L}][\\p{Ll}\\p{Lu}\\p{N}]*?${suffix}|${exact}`);
const pieces = [
  'Secret', 'secret', 'Token', 'token', 'Key', 'Value', 'Api', 'Client',
  'Pass', 'Password', 'Credential', 'Credentials', 'Access', 'App', 'a', 'A',
  'b', 'Z', '1', '_', '$', '-', '.', 'ǅ', 'ʰ', '中', 'é', 'É', '𝐀', '𝐚', '"',
  "'", '\\', ' ', '\t', ':', '=', '=>', '\n', 'x',
];
let seed = 170;
const random = () => {
  seed = (seed * 1103515245 + 12345) % 2 ** 31;
  return seed / 2 ** 31;
};
const show = (re, text) =>
  JSON.stringify([...text.matchAll(re)].map((m) => [m.index, ...m]));
let differences = 0;
let matched = 0;
const runs = Number(process.argv[2] ?? 200000);
for (let i = 0; i < runs; i++) {
  let text = '';
  const length = 1 + Math.floor(random() * 12);
  for (let j = 0; j < length; j++) {
    text += pieces[Math.floor(random() * pieces.length)];
  }
  if (show(before, text) !== "[]") matched++;
  if (show(before, text) !== show(after, text)) {
    differences++;
    if (differences < 5) {
      console.log(JSON.stringify(text), show(before, text), show(after, text));
    }
  }
}
console.log("runs", runs, "matched", matched, "differences", differences);
