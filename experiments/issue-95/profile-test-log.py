"""Summarize measured macOS Deno suites without rerunning costly tests."""

import argparse
import gzip
import json
import re
from collections import defaultdict
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("log", type=Path)
args = parser.parse_args()
jobs = defaultdict(lambda: {"modules_ms": defaultdict(float), "warnings": []})
escape = re.compile(r"\x1b\[[0-9;]*m|\^\[\[[0-9;]*m")
duration = re.compile(r"\./tests/(.+?\.test\.js).*\(([\d.]+)(µs|ms|s)\)\s*$")
finished = re.compile(r"finished in (\d+)s")
opener = gzip.open if args.log.suffix == ".gz" else open
with opener(args.log, "rt") as stream:
    for line_number, line in enumerate(stream, 1):
        if "Test runtimes (macos-26-intel, deno," not in line:
            continue
        job = jobs[line.split("\t")[0]]
        clean = escape.sub("", line)
        match = duration.search(clean)
        if match:
            name, value, unit = match.groups()
            job["modules_ms"][name] += (
                float(value)
                * {
                    "µs": 0.001,
                    "ms": 1,
                    "s": 1000,
                }[unit]
            )
        if "::warning::" in clean or "##[warning]" in clean:
            job["warnings"].append({"line": line_number, "text": clean.strip()})
        match = finished.search(clean)
        if match:
            job["elapsed_seconds"] = int(match[1])
            job["finished_line"] = line_number
for job in jobs.values():
    job["modules_ms"] = dict(
        sorted(job["modules_ms"].items(), key=lambda pair: -pair[1])
    )
print(
    json.dumps(
        {
            "source": str(args.log),
            "note": "Module sums overlap under --parallel; they are not serial wall time.",
            "jobs": dict(jobs),
        },
        indent=2,
    )
)
