// Match the bounded JSON-string candidates used by encoded detection in one
// pass. Escaped quotes are also possible openings after an earlier candidate
// exceeds its bound, matching RegExp's recovery on malformed log fragments.
export function* jsonStringRuns(text) {
  let candidates = [],
    head = 0,
    units = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '\r' || char === '\n') {
      candidates = [];
      head = units = 0;
      continue;
    }
    if (char === '\\' && i + 1 < text.length && !/[\r\n]/.test(text[i + 1])) {
      units++;
      if (text[++i] === '"') {
        candidates.push({ index: i, units });
      }
    } else if (char === '"') {
      const opening = candidates[head];
      if (opening && units > opening.units) {
        yield { index: opening.index, 0: text.slice(opening.index, i + 1) };
        candidates = [];
        head = units = 0;
      } else {
        candidates = [{ index: i, units: ++units }];
        head = 0;
      }
    } else {
      units++;
    }
    // Retain only potentially valid openings, even on huge unfinished lines.
    while (head < candidates.length && units - candidates[head].units > 8192) {
      head++;
    }
    if (head > 8192) {
      candidates = candidates.slice(head);
      head = 0;
    }
  }
}

// Complete JSON literals for callers whose input already has an outer bound.
// Skip escaped characters once, including escaped quotes, with constant state.
export function* jsonStringLiterals(text) {
  let start = -1;
  for (let i = 0; i < text.length; i++) {
    if (start < 0) {
      if (text[i] === '"') {
        start = i;
      }
    } else if (text[i] === '\\') {
      i++;
    } else if (text[i] === '"') {
      yield text.slice(start, i + 1);
      start = -1;
    }
  }
}
