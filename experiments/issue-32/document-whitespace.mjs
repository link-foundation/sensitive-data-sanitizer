import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { sanitize } from '../../src/index.js';

// A finite regression for CodeQL's filename-guard whitespace finding.
// The test parent caps startup/work deadlines and the child heap/stack.
//
// The first sanitize call pays a one-time initialization cost that does not
// depend on the input and scales with the machine. Locally it is about 200 ms
// of the 290 ms a single cold call takes; on a macOS Intel runner the cold call
// took 1149 ms of CPU (issue 208). So warm up before the deadline starts, then
// compare a 16 KiB and a 128 KiB suffix on the same machine: linear matching
// grows about 8x, quadratic matching 64x.
//
// A Windows runner measured 30x growth (issue 208). Windows counts thread CPU
// time in 15.625 ms ticks, about the cost of one 16 KiB call, so one small
// sample can read 0 or 1 tick. Average small calls until they span 100 ms (a
// slow runner stops after one, keeping the deadline) and also compare the
// wall clock, which is fine-grained everywhere.
const SMALL_TOTAL_MILLISECONDS = 100;
const MAX_SMALL_RUNS = 8;
const hostile = (length) =>
  `/cache/QAZVELA_ZORVETA_PASSPORT${'\t'.repeat(length)}tail`;
// Main-thread CPU (Node 23.9+) leaves out concurrent GC and compiler threads.
const cpuUsage = (previous) =>
  process.threadCpuUsage
    ? process.threadCpuUsage(previous)
    : process.cpuUsage(previous);
function measure(text) {
  const wallStarted = performance.now();
  const started = cpuUsage();
  const output = sanitize(text).text;
  const cpu = cpuUsage(started);
  const wall = performance.now() - wallStarted;
  assert(!output.includes('QAZVELA'));
  assert(output.endsWith('tail'));
  return { cpu: (cpu.user + cpu.system) / 1000, wall };
}

measure(hostile(1));
process.send?.({ event: 'ready' });
const text = hostile(128 * 1024);
const started = performance.now();
const small = hostile(16 * 1024);
const smallTotal = { cpu: 0, wall: 0 };
let smallRuns = 0;
while (
  Math.max(smallTotal.cpu, smallTotal.wall) < SMALL_TOTAL_MILLISECONDS &&
  smallRuns < MAX_SMALL_RUNS
) {
  const sample = measure(small);
  smallTotal.cpu += sample.cpu;
  smallTotal.wall += sample.wall;
  smallRuns += 1;
}
const smallCpuMilliseconds = smallTotal.cpu / smallRuns;
const smallWallMilliseconds = smallTotal.wall / smallRuns;
const large = measure(text);
const cpuGrowth = large.cpu / Math.max(smallCpuMilliseconds, 1);
const wallGrowth = large.wall / Math.max(smallWallMilliseconds, 1);
console.log(
  JSON.stringify({
    bytes: text.length,
    milliseconds: performance.now() - started,
    smallRuns,
    smallCpuMilliseconds,
    cpuMilliseconds: large.cpu,
    smallWallMilliseconds,
    wallMilliseconds: large.wall,
    cpuGrowth,
    wallGrowth,
    // A quadratic guard inflates both clocks; noise or a coarse clock (one
    // reading of 0 ticks) inflates only one.
    growth: Math.min(cpuGrowth, wallGrowth),
  })
);
