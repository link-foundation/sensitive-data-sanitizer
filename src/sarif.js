// SARIF 2.1.0 export for code-scanning dashboards (GitHub, GitLab, Azure
// DevOps), matching the reporting formats of Gitleaks/Betterleaks, TruffleHog,
// detect-secrets and Kingfisher. Only metadata is emitted: rule, type,
// category, confidence and location. Matched values are never included.
const schema = 'https://json.schemastore.org/sarif-2.1.0.json';
const levels = { credential: 'error', personal: 'warning' };

function artifactUri(path) {
  if (path === '-' || path === undefined) {
    return 'stdin';
  }
  return encodeURI(String(path).replaceAll('\\', '/'));
}

function region(finding) {
  const result = {
    charOffset: finding.start,
    charLength: finding.end - finding.start,
  };
  if (Number.isSafeInteger(finding.line)) {
    result.startLine = finding.line;
  }
  if (Number.isSafeInteger(finding.column)) {
    result.startColumn = finding.column;
  }
  return result;
}

function sarifResult(finding, uri, ruleIndex) {
  return {
    ruleId: finding.rule,
    ruleIndex,
    level: levels[finding.category] ?? 'note',
    message: {
      text: `${finding.type} ${finding.category === 'credential' ? 'credential' : 'personal data'} detected`,
    },
    locations: [
      {
        physicalLocation: {
          artifactLocation: { uri },
          region: region(finding),
        },
      },
    ],
    properties: {
      type: finding.type,
      category: finding.category,
      confidence: finding.confidence,
    },
  };
}

/**
 * Converts scan results to a SARIF 2.1.0 log. Accepts the CLI scan report
 * (`{complete, results: [{path, findings}], skipped}`), an array of
 * `{path, findings}` entries, or a findings array for one artifact. Values
 * are never copied into the log; paths should already be sanitized.
 */
function entriesOf(report, path) {
  if (!Array.isArray(report)) {
    return report?.results ?? [];
  }
  return report.every((item) => Array.isArray(item?.findings))
    ? report
    : [{ path, findings: report }];
}

export function toSarif(report, { version, path = '-' } = {}) {
  const entries = entriesOf(report, path);
  const rules = [],
    indexes = new Map(),
    results = [];
  for (const entry of entries) {
    const uri = artifactUri(entry.path);
    for (const finding of entry.findings) {
      if (!indexes.has(finding.rule)) {
        indexes.set(finding.rule, rules.length);
        rules.push({
          id: finding.rule,
          name: finding.rule,
          shortDescription: { text: `${finding.type} (${finding.category})` },
          defaultConfiguration: {
            level: levels[finding.category] ?? 'note',
          },
          properties: { tags: [finding.category, finding.type] },
        });
      }
      results.push(sarifResult(finding, uri, indexes.get(finding.rule)));
    }
  }
  const skipped = report?.skipped ?? [];
  return {
    $schema: schema,
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: 'sensitive-data-sanitizer',
            informationUri:
              'https://github.com/link-foundation/sensitive-data-sanitizer',
            ...(version ? { version } : {}),
            rules,
          },
        },
        invocations: [
          {
            executionSuccessful: report?.complete ?? true,
            toolExecutionNotifications: skipped.map((item) => ({
              level: 'warning',
              message: { text: `Skipped: ${item.reason}` },
              locations: [
                {
                  physicalLocation: {
                    artifactLocation: { uri: artifactUri(item.path) },
                  },
                },
              ],
            })),
          },
        ],
        columnKind: 'utf16CodeUnits',
        results,
      },
    ],
  };
}
