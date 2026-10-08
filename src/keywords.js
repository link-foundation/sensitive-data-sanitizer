// Aho-Corasick keyword prefilter: equivalent to checking every literal with
// includes(), including overlapping keywords, but scans a detection view once.
export function keywordMatcher(words) {
  const nodes = [{ next: new Map(), fail: 0, output: [] }];
  for (const word of new Set(words)) {
    let state = 0;
    for (let i = 0; i < word.length; i++) {
      const char = word[i];
      if (!nodes[state].next.has(char)) {
        nodes[state].next.set(char, nodes.length);
        nodes.push({ next: new Map(), fail: 0, output: [] });
      }
      state = nodes[state].next.get(char);
    }
    nodes[state].output.push(word);
  }
  const queue = [...nodes[0].next.values()];
  for (let index = 0; index < queue.length; index++) {
    const state = queue[index];
    for (const [char, child] of nodes[state].next) {
      let fallback = nodes[state].fail;
      while (fallback && !nodes[fallback].next.has(char)) {
        fallback = nodes[fallback].fail;
      }
      nodes[child].fail = nodes[fallback].next.get(char) ?? 0;
      nodes[child].output.push(...nodes[nodes[child].fail].output);
      queue.push(child);
    }
  }
  return (text) => {
    const found = new Set();
    let state = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      while (state && !nodes[state].next.has(char)) {
        state = nodes[state].fail;
      }
      state = nodes[state].next.get(char) ?? 0;
      for (const word of nodes[state].output) {
        found.add(word);
      }
    }
    return found;
  };
}
