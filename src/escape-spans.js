// Never cut a JSON escape in half, including when plain text contains JSON.
// Each endpoint is visited once after sorting, even for overlapping findings.
export function alignEscapes(text, findings) {
  const result = findings.map((finding) => ({ ...finding }));
  for (const boundary of ['start', 'end']) {
    const ordered = [...result].sort((a, b) => a[boundary] - b[boundary]);
    let index = 0;
    for (const match of text.matchAll(/\\(?:u[\da-fA-F]{4}|["\\/bfnrt])/g)) {
      const start = match.index,
        end = start + match[0].length;
      while (index < ordered.length && ordered[index][boundary] <= start) {
        index++;
      }
      while (index < ordered.length && ordered[index][boundary] < end) {
        ordered[index++][boundary] = boundary === 'start' ? start : end;
      }
    }
  }
  return result;
}
