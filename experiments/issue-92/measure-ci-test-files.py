"""Compare per-file execution costs in preserved runtime CI logs."""
import collections
import gzip
import json
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[2] / 'dev/log/issues/92/pulls/93'
ANSI = re.compile(r'\x1b\[[0-9;]*m|\^\[\[[0-9;]*m')
DURATION = re.compile(r'./tests/(.+?\.test\.js).*\(([\d.]+)(µs|ms|s)\)\s*$')

platform, runtime, *runs = sys.argv[1:]
records = {}
for run in runs:
    totals = collections.defaultdict(float)
    counts = collections.Counter()
    budgets = []
    with gzip.open(ROOT / f'ci-logs/run-{run}.log.gz', 'rt') as source:
        for number, line in enumerate(source, 1):
            text = ANSI.sub('', line)
            if f'{platform}, {runtime},' not in text:
                continue
            match = DURATION.search(text)
            if match:
                name, value, unit = match.groups()
                totals[name] += float(value) * {'µs': .001, 'ms': 1, 's': 1000}[unit]
                counts[name] += 1
            if any(marker in text for marker in ['##[warning]', '##[error]', 'finished in']):
                budgets.append({'line': number, 'text': text.strip()})
    records[run] = {
        'files': [{'file': name, 'ms': round(value), 'count': counts[name]}
                  for name, value in sorted(totals.items(), key=lambda row: -row[1])],
        'budgets': budgets,
    }
print(json.dumps(records, indent=2))
