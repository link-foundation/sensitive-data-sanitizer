// A record often stores one name in separate fields: `first_name`, `last_name`
// and `middle_name` in JSON, YAML, `key=value` lines, XML, CSV, Markdown tables
// and SQL inserts. Each value alone is only a part of the listed name, so the
// parts of one record are joined and matched as one name. A match that covers
// two or more parts reports each value at its own place in the text.
import { detectKnownPersonal } from './personal-variants.js';

// Inspecting the lines a structured batch is made of must not join values of
// different objects: the structured pass groups them by their parent path.
export const structuredRecords = Symbol('structured-records');

const exactRoles = new Map([
  ...[
    'first',
    'given',
    'fname',
    'forename',
    'forenames',
    'firstname',
    'firstnames',
    'givenname',
    'givennames',
    'имя',
  ].map((key) => [key, 'given']),
  ...[
    'last',
    'family',
    'lname',
    'surname',
    'surnames',
    'lastname',
    'familyname',
    'фамилия',
  ].map((key) => [key, 'surname']),
  ...[
    'middle',
    'mname',
    'patronymic',
    'patronym',
    'middlename',
    'middlenames',
    'отчество',
  ].map((key) => [key, 'patronymic']),
]);
// `author_first_name`, `user.lastName`, `contactSurname`, `имя_клиента`.
const suffixRoles = [
  [/(?:firstnames?|givennames?|forenames?)$/u, 'given'],
  [/(?:lastname|familyname|surnames?)$/u, 'surname'],
  [/(?:middlenames?|patronymic|patronym)$/u, 'patronymic'],
  [/^имя|имя$/u, 'given'],
  [/^фамилия|фамилия$/u, 'surname'],
  [/^отчество|отчество$/u, 'patronymic'],
];
const roleHint =
  /first|last|given|family|surname|forename|middle|patronym|[flm]name|имя|фамили|отчеств/iu;

// Whether the text may hold a name field at all.
export const hasRecordKey = (text) => roleHint.test(text);

export function nameRole(key) {
  const normal = key
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '');
  if (!normal || normal.length > 64) {
    return undefined;
  }
  return (
    exactRoles.get(normal) ??
    suffixRoles.find(([pattern]) => pattern.test(normal))?.[1]
  );
}

const order = [
  ['surname', 'given', 'patronymic'],
  ['given', 'patronymic', 'surname'],
];
const maxPart = 200;

// Joins the parts of each record in the name orders and reports each value
// a match covers. Records are kept apart by a blank line, which no name spans,
// so one pass of the matcher serves every record.
function matchRecords(records, entries, rule, emit, options) {
  if (!entries?.length) {
    return;
  }
  let text = '';
  const placed = [];
  for (const parts of records) {
    const values = parts.filter(
      (part) => part.value.trim() && part.value.length <= maxPart
    );
    if (new Set(values.map((part) => part.role)).size < 2) {
      continue;
    }
    // A listed name of two words matches in either order already.
    const orders = values.some((part) => part.role === 'patronymic')
      ? order
      : order.slice(0, 1);
    for (const roles of orders) {
      text += text ? '\n\n' : '';
      let first = true;
      for (const role of roles) {
        const part = values.find((value) => value.role === role);
        if (part) {
          text += first ? '' : ' ';
          first = false;
          const start = text.length;
          text += part.value.trim();
          placed.push({ part, start, end: text.length });
        }
      }
    }
  }
  const reported = new Set();
  detectKnownPersonal(
    text,
    entries,
    rule,
    (finding) => {
      let low = 0,
        high = placed.length;
      while (low < high) {
        const middle = (low + high) >> 1;
        if (placed[middle].end <= finding.start) {
          low = middle + 1;
        } else {
          high = middle;
        }
      }
      const covered = [];
      for (
        let i = low;
        i < placed.length && placed[i].start < finding.end;
        i++
      ) {
        covered.push(placed[i].part);
      }
      if (covered.length < 2) {
        return;
      }
      for (const part of covered) {
        const key = `${part.start}:${part.end}:${finding.type}`;
        if (!reported.has(key)) {
          reported.add(key);
          emit({ ...finding, start: part.start, end: part.end });
        }
      }
    },
    options
  );
}

const trimmed = (text, start, end, edge = /\s/u) => {
  while (start < end && edge.test(text[start])) {
    start++;
  }
  while (end > start && edge.test(text[end - 1])) {
    end--;
  }
  return { start, end };
};
// A value without the Markdown emphasis around it: `**Пряжкина**`,
// `_Пряжкина_`, `` `Пряжкина` `` (issue 201). No name starts or ends with
// these marks, so the span covers the value only and a replacement keeps them.
const unmarked = (text, start, end) => trimmed(text, start, end, /[\s*_`]/u);

// `"key": "value"`, `key: value`, `key = value`, `key=value&`, `key => 'v'`,
// and in Markdown `**key:** value`, `**key**: value`, `key: **value**`.
const pairPattern =
  /(?<![\p{L}\p{N}_$])(["'`]?)([\p{L}_$](?:[\p{L}\p{N}_$.-]| (?=[\p{L}\p{N}])){0,63})\1\*{0,3}[ \t]*(?::=|=>|:|=)[ \t]*(?:"((?:[^"\\\r\n]|\\.){0,200})"|'((?:[^'\\\r\n]|\\.){0,200})'|([^\s,;&|{}[\]<>"'#][^\r\n,;&|{}[\]<>"'#]{0,199}))/gu;
const xmlPattern =
  /<([\p{L}_][\p{L}\p{N}_.:-]{0,63})(?:\s[^<>]{0,200})?>([^<>\r\n]{1,200})<\/\1>/gu;

function pairs(text) {
  const found = [];
  for (const match of text.matchAll(pairPattern)) {
    const role = nameRole(match[2]);
    if (!role) {
      continue;
    }
    const raw = match[3] ?? match[4] ?? match[5];
    const offset =
      match.index +
      match[0].length -
      raw.length -
      (match[5] === undefined ? 1 : 0);
    found.push({
      role,
      key: match.index,
      ...unmarked(text, offset, offset + raw.length),
    });
  }
  for (const match of text.matchAll(xmlPattern)) {
    const role = nameRole(match[1]);
    if (role) {
      const offset = match.index + match[0].length - match[1].length - 3;
      found.push({
        role,
        key: match.index,
        ...unmarked(text, offset - match[2].length, offset),
      });
    }
  }
  return found
    .filter((pair) => pair.end > pair.start)
    .sort((a, b) => a.start - b.start);
}

// A Markdown or YAML list item: `- `, `* `, `+ `, `1. `, `1) `.
const listItem = /^[ \t]*(?:[-*+]|\d{1,9}[.)])[ \t]/u;
// Whether the key of a pair starts a list item: `- **Фамилия:** Пряжкина`.
const startsItem = (text, pair) => {
  const line = text.slice(text.lastIndexOf('\n', pair.key - 1) + 1, pair.key);
  return listItem.test(line) && /^[ \t]*\S+[ \t]+[*_]{0,3}$/u.test(line);
};

// A blank line, leaving the enclosing object or a long gap ends a record, as
// does a field the record already has. A new list item ends it too, unless
// both fields are list items with nothing but list items between them: the
// fields of a Markdown person card, `- **Фамилия:** …\n- **Имя:** …`
// (issue 201). In a YAML list of objects the next object's first field is a
// list item and the last field of the previous one is not.
function separate(gap, items) {
  if (gap.length > 400 || /\n[ \t]*\r?\n/u.test(gap)) {
    return true;
  }
  if (
    items
      ? gap
          .split('\n')
          .slice(1, -1)
          .some((line) => !listItem.test(line))
      : /\n[ \t]*-[ \t]/u.test(gap)
  ) {
    return true;
  }
  let depth = 0;
  for (const char of gap) {
    if (char === '{' || char === '[') {
      depth++;
    } else if ((char === '}' || char === ']') && --depth < 0) {
      return true;
    }
  }
  // The gap starts inside the element of the value and leaves its parent
  // when it closes one element more than it opens: `</first></person>`.
  let tags = 1;
  for (const tag of gap.matchAll(/<(\/?)[\p{L}_][^<>]*?(\/?)>/gu)) {
    if (!tag[2] && (tags += tag[1] ? -1 : 1) < 0) {
      return true;
    }
  }
  return false;
}

function pairRecords(text) {
  const records = [];
  let record = [],
    end = 0,
    item = false;
  for (const pair of pairs(text)) {
    const starts = startsItem(text, pair);
    if (
      record.length &&
      (record.some((part) => part.role === pair.role) ||
        separate(text.slice(end, pair.start), item && starts))
    ) {
      records.push(record);
      record = [];
    }
    record.push(pair);
    end = pair.end;
    item = starts;
  }
  records.push(record);
  return records;
}

// Splits one line into cells, keeping quoted cells whole.
function cells(text, start, end, delimiter) {
  const result = [];
  let cell = start,
    quoted = false;
  for (let i = start; i <= end; i++) {
    const char = i < end ? text[i] : delimiter;
    if (char === '"') {
      quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      let range = trimmed(text, cell, i);
      if (
        range.end - range.start >= 2 &&
        /^["'`]/u.test(text[range.start]) &&
        text[range.end - 1] === text[range.start]
      ) {
        range = { start: range.start + 1, end: range.end - 1 };
      }
      result.push(range);
      cell = i + 1;
    }
  }
  return result;
}

const delimiters = ['|', '\t', ';', ','];

function lines(text) {
  const result = [];
  let position = 0;
  for (const match of text.matchAll(/\r\n?|\n/gu)) {
    result.push({ start: position, end: match.index });
    position = match.index + match[0].length;
  }
  result.push({ start: position, end: text.length });
  return result;
}

// The cells of a Markdown table row, without the empty cells outside its
// leading and trailing `|`.
function rowCells(text, line) {
  const row = cells(text, line.start, line.end, '|');
  if (row.length > 1 && row[0].start === row[0].end) {
    row.shift();
  }
  if (row.length > 1 && row.at(-1).start === row.at(-1).end) {
    row.pop();
  }
  return row;
}

// A key/value table holds one field per row, the key in the first cell and
// the value in the second: `| Фамилия | Пряжкина |` (issue 201). The rows of
// one table form a record, ended by a line that is not a table row or by a
// field the record already has. A header row of name columns, such as
// `| Фамилия | Имя |`, is not a field.
function fieldRows(text) {
  const records = [];
  let record = [];
  for (const line of lines(text)) {
    if (!text.slice(line.start, line.end).includes('|')) {
      records.push(record);
      record = [];
      continue;
    }
    const row = rowCells(text, line);
    const role =
      row.length >= 2 && nameRole(text.slice(row[0].start, row[0].end));
    if (!role || nameRole(text.slice(row[1].start, row[1].end))) {
      continue;
    }
    if (record.some((part) => part.role === role)) {
      records.push(record);
      record = [];
    }
    record.push({ role, ...unmarked(text, row[1].start, row[1].end) });
  }
  records.push(record);
  return records;
}

// A header row such as `last_name,first_name` or `| Фамилия | Имя |` names the
// columns of the rows below it, up to a blank line.
function tableRecords(text) {
  const records = [];
  const rows = lines(text);
  for (let index = 0; index < rows.length; index++) {
    const line = rows[index];
    const head = text.slice(line.start, line.end);
    if (!roleHint.test(head)) {
      continue;
    }
    for (const delimiter of delimiters) {
      if (!head.includes(delimiter)) {
        continue;
      }
      const columns = cells(text, line.start, line.end, delimiter).map((cell) =>
        nameRole(text.slice(cell.start, cell.end))
      );
      if (new Set(columns.filter(Boolean)).size < 2) {
        continue;
      }
      let row = index + 1;
      for (; row < rows.length; row++) {
        const { start, end } = rows[row];
        const content = text.slice(start, end);
        if (!content.trim()) {
          break;
        }
        if (delimiter === '|' && /^[\s|:-]+$/u.test(content)) {
          continue;
        }
        const values = cells(text, start, end, delimiter);
        records.push(
          columns
            .map(
              (role, column) =>
                role &&
                values[column] && {
                  role,
                  ...unmarked(text, values[column].start, values[column].end),
                }
            )
            .filter(Boolean)
        );
      }
      index = row - 1;
      break;
    }
  }
  return records;
}

// `INSERT INTO people (first_name, last_name) VALUES ('Велимира', 'Пряжкина')`.
const insertPattern =
  /\(([^()\r\n]{1,1000})\)\s*VALUES\s*((?:\([^()]{0,4000}\)\s*,?\s*){1,1000})/giu;

function insertRecords(text) {
  const records = [];
  for (const match of text.matchAll(insertPattern)) {
    const head = match.index + match[0].indexOf('(') + 1;
    const columns = cells(text, head, head + match[1].length, ',').map((cell) =>
      nameRole(text.slice(cell.start, cell.end).replace(/[`"[\]]/gu, ''))
    );
    if (new Set(columns.filter(Boolean)).size < 2) {
      continue;
    }
    const offset = match.index + match[0].length - match[2].length;
    for (const tuple of match[2].matchAll(/\(([^()]*)\)/gu)) {
      const start = offset + tuple.index + 1;
      const values = sqlCells(text, start, start + tuple[1].length);
      records.push(
        columns
          .map(
            (role, column) =>
              role && values[column] && { role, ...values[column] }
          )
          .filter(Boolean)
      );
    }
  }
  return records;
}
function sqlCells(text, start, end) {
  const result = [];
  let cell = start,
    quoted = false;
  for (let i = start; i <= end; i++) {
    const char = i < end ? text[i] : ',';
    if (char === "'") {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      let range = trimmed(text, cell, i);
      if (text[range.start] === "'" && text[range.end - 1] === "'") {
        range = { start: range.start + 1, end: range.end - 1 };
      }
      result.push(range);
      cell = i + 1;
    }
  }
  return result;
}

export function detectKnownRecords(text, entries, rule, emit, options) {
  if (!entries?.length || options[structuredRecords] || !roleHint.test(text)) {
    return;
  }
  const records = [
    ...pairRecords(text),
    ...tableRecords(text),
    ...fieldRows(text),
    ...insertRecords(text),
  ].map((record) =>
    record.map((part) => ({ ...part, value: text.slice(part.start, part.end) }))
  );
  matchRecords(records, entries, rule, emit, options);
}

// Structured values of one object share their parent path.
export function structuredRecordFindings(batches, options) {
  const groups = new Map();
  for (const entry of batches.flatMap((batch) => batch.entries)) {
    const role =
      !entry.key && entry.raw.startsWith('"') && nameRole(entry.field ?? '');
    if (!role) {
      continue;
    }
    const parent = JSON.stringify(entry.path.slice(0, -1));
    if (!groups.has(parent)) {
      groups.set(parent, []);
    }
    groups.get(parent).push({
      role,
      value: JSON.parse(entry.raw),
      start: entry.start + 1,
      end: entry.start + entry.raw.length - 1,
    });
  }
  const findings = [];
  for (const [entries, rule] of [
    [options.knownPersonal, 'known-personal'],
    [options.confirmedPersonal, 'confirmed-personal'],
  ]) {
    matchRecords(
      [...groups.values()],
      entries,
      rule,
      (f) => findings.push(f),
      options
    );
  }
  return findings;
}

// Marks that separate the cells, values or quoted parts a listed name was
// found across (issue 192). A plain `-` or `.` stays inside a part, `'`
// separates only next to another mark (`O'Neil`, `Е.О.` stay whole), and
// Markdown emphasis only next to a space, so `Petrov_Ivan_CV.pdf` stays one
// value. A line break joins the lines of one name (`// Тютюнник\n// Евсей`).
const separator =
  /[\t,;|/\\()[\]{}"«»“”„‟—–]|'[^\p{L}]|[^\p{L}]'|\s[*_`]|[*_`]\s/u;
// A name found in a decoded view keeps one span: its `;` and `\` are part of
// the encoding.
const encodedSpan = /%[\da-fA-F]{2}|&#?[\dA-Za-z]+;|\\[ntru\\]/u;

// The parts of a listed-name finding whose span crosses separators, each a
// finding of its own, so a replacement keeps the table cells, quotes and SQL
// values of the original: `| Пряжкина | Велимира |` becomes
// `| Person-1 | Person-1 |`, not `| Person-1 |`.
export function separatedParts(text, finding) {
  const raw = text.slice(finding.start, finding.end);
  if (!/\t|[^\p{L}\p{M}\p{N}\s.'-]/u.test(raw) || encodedSpan.test(raw)) {
    return [finding];
  }
  const parts = [];
  let start = 0;
  for (const gap of raw.matchAll(/[^\p{L}\p{M}\p{N}.-]+/gu)) {
    if (separator.test(gap[0]) && !/[\n\r]/u.test(gap[0])) {
      parts.push([start, gap.index]);
      start = gap.index + gap[0].length;
    }
  }
  parts.push([start, raw.length]);
  return parts
    .filter(([from, to]) => /\p{L}/u.test(raw.slice(from, to)))
    .map(([from, to]) => ({
      ...finding,
      start: finding.start + from,
      end: finding.start + to,
    }));
}
