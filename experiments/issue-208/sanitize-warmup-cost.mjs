#!/usr/bin/env node
// Split the CPU time of the issue-32 document-name probe into one-time
// initialization and input-dependent matching (issue 208).
//
// Usage: node experiments/issue-208/sanitize-warmup-cost.mjs [cold|warm]
//
// "cold" measures the 128 KiB hostile suffix first, as the old probe did;
// "warm" first sanitizes a one-tab input. Main-thread CPU is used where
// process.threadCpuUsage exists (Node 23.9+).
import { sanitize } from '../../src/index.js';

const usage = (previous) =>
  process.threadCpuUsage
    ? process.threadCpuUsage(previous)
    : process.cpuUsage(previous);
function cpu(text) {
  const started = usage();
  sanitize(text);
  const spent = usage(started);
  return Math.round((spent.user + spent.system) / 1000);
}
const hostile = (kib) =>
  `/cache/QAZVELA_ZORVETA_PASSPORT${'\t'.repeat(kib * 1024)}tail`;
const mode = process.argv[2] ?? 'cold';
const result = { mode };
if (mode === 'warm') {
  result.oneTab = cpu(`${hostile(0)}\t`);
}
result.first128KiB = cpu(hostile(128));
for (const kib of [8, 16, 32, 128, 512]) {
  result[`${kib}KiB`] = cpu(hostile(kib));
}
console.log(JSON.stringify(result));
