// Repeats detectGitleaks on `password=` + 'A' × N to separate warm-up
// (rule compilation) from per-call cost (issue 173).
import { detectGitleaks } from '../../src/gitleaks.js';
const kib = Number(process.argv[2] ?? 1024);
const unit = process.argv[3] ?? 'A';
const text = `password=${unit.repeat(Math.ceil((kib * 1024) / unit.length))}\n`;
for (let round = 0; round < 3; round++) {
  const rows = [];
  detectGitleaks(
    text,
    () => {},
    (row) => rows.push(row)
  );
  rows.sort((a, b) => b.ms - a.ms);
  console.log(
    round,
    rows
      .slice(0, 3)
      .map((row) => `${row.rule} ${Math.round(row.ms)} ms`)
      .join(', ')
  );
}
