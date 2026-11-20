import { atomicWrite } from '../src/files.js';
import { encodeLinoObject } from '../src/lino-object.js';
import { toSarif } from '../src/sarif.js';

const csvFields = [
  'status',
  'path',
  'reason',
  'rule',
  'type',
  'category',
  'line',
  'column',
  'start',
  'end',
  'confidence',
  'baselined',
];

function csvCell(value = '') {
  if (typeof value === 'number') {
    return String(value);
  }
  const text = String(value);
  // Spreadsheet programs interpret even quoted formula-like text as code.
  const literal = /^[\s\uFEFF]*[=+@-]|^[\t\r\n]/u.test(text)
    ? `'${text}`
    : text;
  return `"${literal.replaceAll('"', '""')}"`;
}

function toCsv(report) {
  const rows = csvFields.map(csvCell).join(',');
  const payload = [
    {
      status: report.complete ? 'complete' : 'incomplete',
      baselined: report.baselined,
    },
    ...report.results.flatMap(({ path, findings }) =>
      findings.map((finding) => ({ ...finding, path, status: 'finding' }))
    ),
    ...report.skipped.map((item) => ({ ...item, status: 'skipped' })),
  ];
  return [
    rows,
    ...payload.map((row) =>
      csvFields.map((key) => csvCell(row[key])).join(',')
    ),
    '',
  ].join('\r\n');
}

const entities = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
  '\n': '&#10;',
  '\r': '&#13;',
  '\t': '&#9;',
};
function xml(value) {
  return String(value)
    .replace(
      // eslint-disable-next-line no-control-regex -- XML permits tab, CR, and LF.
      /[^\x09\x0A\x0D\x20-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/gu,
      '\uFFFD'
    )
    .replace(/[&<>"'\n\r\t]/g, (character) => entities[character]);
}

function toJunit(report) {
  const cases = [];
  let failures = 0;
  for (const { path, findings } of report.results) {
    if (!findings.length) {
      cases.push(`    <testcase classname="${xml(path)}" name="scan"/>`);
    }
    for (const finding of findings) {
      failures++;
      cases.push(
        `    <testcase classname="${xml(path)}" name="${xml(`${finding.rule}@${finding.line}:${finding.column}`)}"><failure message="${xml(finding.type)}"/></testcase>`
      );
    }
  }
  for (const { path, reason } of report.skipped) {
    cases.push(
      `    <testcase classname="${xml(path)}" name="scan"><error message="${xml(reason)}"/></testcase>`
    );
  }
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<testsuites><testsuite name="sensitive-data-sanitizer" tests="${cases.length}" failures="${failures}" errors="${report.skipped.length}">`,
    ...(report.baselined === undefined
      ? []
      : [
          `    <properties><property name="baselined" value="${report.baselined}"/></properties>`,
        ]),
    ...cases,
    '</testsuite></testsuites>',
    '',
  ].join('\n');
}

export function serializeReport(report, format, version) {
  switch (format) {
    case 'json':
      return `${JSON.stringify(report, null, 2)}\n`;
    case 'sarif':
      return `${JSON.stringify(toSarif(report, { version }), null, 2)}\n`;
    case 'csv':
      return toCsv(report);
    case 'junit':
      return toJunit(report);
    default:
      return encodeLinoObject(report);
  }
}

export async function publishReport(report, config, stdout, version) {
  const text = serializeReport(report, config.format, version);
  if (config.reportPath) {
    await atomicWrite(config.reportPath, text);
  } else {
    stdout.write(text);
  }
}
