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
const hostile = (length) =>
  `/cache/QAZVELA_ZORVETA_PASSPORT${'\t'.repeat(length)}tail`;
// Main-thread CPU (Node 23.9+) leaves out concurrent GC and compiler threads.
const cpuUsage = (previous) =>
  process.threadCpuUsage
    ? process.threadCpuUsage(previous)
    : process.cpuUsage(previous);
function measure(text) {
  const started = cpuUsage();
  const output = sanitize(text).text;
  const cpu = cpuUsage(started);
  assert(!output.includes('QAZVELA'));
  assert(output.endsWith('tail'));
  return (cpu.user + cpu.system) / 1000;
}

measure(hostile(1));
process.send?.({ event: 'ready' });
const text = hostile(128 * 1024);
const started = performance.now();
const smallCpuMilliseconds = measure(hostile(16 * 1024));
const cpuMilliseconds = measure(text);
console.log(
  JSON.stringify({
    bytes: text.length,
    milliseconds: performance.now() - started,
    smallCpuMilliseconds,
    cpuMilliseconds,
    growth: cpuMilliseconds / Math.max(smallCpuMilliseconds, 1),
  })
);
