// Compares camelCase key expressions on long letter runs (issue #170).
// Usage: node experiments/issue-170/variants.mjs [MiB]
const suffix =
  '(?:Secret|Password|Passwd|Passphrase|Pass|Pwd|Token|Credentials?|(?:Api|Private|Access|Secret|Signing|Encryption|Master|Client|App|Subscription|Account|Storage)Key)(?:Key|Value)?';
const exact =
  '(?:[Ss]ecret|[Pp]assword|[Pp]asswd|[Tt]oken|[Pp]rivate|[Aa]ccess|[Ss]igning|[Ee]ncryption)(?:Key|Value|Secret|Token)';
const variants = {
  original: `[\\p{L}][\\p{Ll}\\p{N}]*(?:\\p{Lu}[\\p{Ll}\\p{N}]*)*?${suffix}|${exact}`,
  bounded: `[\\p{L}][\\p{Ll}\\p{N}]{0,63}(?:\\p{Lu}[\\p{Ll}\\p{N}]{0,63}){0,8}?${suffix}|${exact}`,
  greedy: `[\\p{L}][\\p{Ll}\\p{Lu}\\p{N}]*${suffix}|${exact}`,
  lazy: `[\\p{L}][\\p{Ll}\\p{Lu}\\p{N}]*?${suffix}|${exact}`,
};
const rocket = `=>(?=[ \\t]*\\\\*["'])`;
const mib = Number(process.argv[2] ?? 15);
for (const [name, key] of Object.entries(variants)) {
  const re = new RegExp(
    `(?<![\\p{L}\\p{N}_$])(?:\\\\*["'])?(${key})(?![\\p{L}\\p{N}_])(?:\\\\*["'])?[ \\t]*(${rocket}|[:=])[ \\t]*`,
    'gu'
  );
  for (const unit of ['A', 'Ab', 'aB', 'a', 'Aé', 'A1']) {
    const text =
      unit.repeat((mib * 1024 * 1024) / unit.length) + 'ClientSecret: x\n';
    const t = performance.now();
    let result;
    try {
      result = [...text.matchAll(re)].map((m) => m[1].slice(-12)).join(',');
    } catch (error) {
      result = error.message;
    }
    console.log(name, unit, Math.round(performance.now() - t), 'ms', result);
  }
}
