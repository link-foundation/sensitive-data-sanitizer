// Warm up both sizes, then interleave a fixed number of measurements so
// initialization, isolated pauses and gradual runner load do not skew a ratio.
// Keep the raw timings for actionable assertion messages.
export function measureGrowth(measure, shortInput, longInput) {
  measure(shortInput);
  measure(longInput);
  const short = [],
    long = [];
  for (let sample = 0; sample < 5; sample++) {
    short.push(measure(shortInput));
    long.push(measure(longInput));
  }
  const median = (values) => [...values].sort((a, b) => a - b)[2];
  return { short, long, ratio: median(long) / median(short) };
}
