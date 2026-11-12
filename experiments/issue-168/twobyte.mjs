// Compare detection cost on one-byte vs two-byte (contains "…") strings.
import { performance } from 'node:perf_hooks';
import { nativeDetect } from '../../src/detection.js';
import { projectText } from '../../src/projection.js';
const options = { credentialsOnly: true };
const lines = (fmt) =>
  `${Array.from({ length: 6000 }, (_, i) => fmt(i)).join('\n')}\n`;
const cases = {
  ascii: lines((i) => `line ${i} token ghp...b4N`),
  unicode: lines((i) => `line ${i} token ghp…b4N`),
};
cases.projected = projectText(cases.unicode).text;
nativeDetect(cases.ascii.slice(0, 1000), options, () => {});
for (let round = 0; round < 2; round++) {
  for (const [name, text] of Object.entries(cases)) {
    const t = performance.now();
    nativeDetect(text, options, () => {});
    console.log(
      round,
      name.padEnd(10),
      Math.round(performance.now() - t),
      'ms'
    );
  }
}
