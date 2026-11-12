// Per-rule timings of detectGitleaks on `password=` + 'A' × N (issue 173).
import { detectGitleaks } from '../../src/gitleaks.js';
const kib = Number(process.argv[2] ?? 256);
const text = `password=${'A'.repeat(kib * 1024)}\n`;
const rows = [];
detectGitleaks(text, () => {}, (row) => rows.push(row));
rows.sort((a, b) => b.ms - a.ms);
for (const row of rows.slice(0, 5)) console.log(row.rule, Math.round(row.ms), 'ms');
