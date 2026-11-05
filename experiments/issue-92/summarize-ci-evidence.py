"""Index preserved CI logs by exact SHA, conclusion and annotation location."""

import gzip
import json
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2] / "dev/log/issues/92/pulls/93"


def log_lines(log):
    if log.suffix == ".zip":
        with zipfile.ZipFile(log) as archive:
            for member in archive.namelist():
                if "/" in member or not member.endswith(".txt"):
                    continue
                with archive.open(member) as source:
                    for number, raw in enumerate(source, 1):
                        yield member, number, raw.decode("utf8", errors="replace")
    else:
        with gzip.open(log, "rt", errors="replace") as source:
            for number, text in enumerate(source, 1):
                yield None, number, text


records = []
for metadata in sorted((ROOT / "github").glob("run-*.json")):
    run = json.loads(metadata.read_text())
    run_id = run["databaseId"]
    log = ROOT / f"ci-logs/run-{run_id}.log.gz"
    if not log.exists():
        log = ROOT / f"ci-logs/run-{run_id}.archive.zip"
        if not log.exists():
            continue
    annotations = []
    warnings = []
    lines = 0
    for member, number, text in log_lines(log):
        lines += 1
        location = {"line": number, "text": text.strip()[:1000]}
        if member:
            location["archive_member"] = member
        if any(marker in text for marker in ["##[warning]", "##[error]"]):
            annotations.append(location)
        if "npm warn deprecated" in text or "LF will be replaced by CRLF" in text:
            warnings.append(location)
    records.append(
        {
            "run": run_id,
            "name": run["name"],
            "sha": run["headSha"],
            "created_at": run["createdAt"],
            "status": run["status"],
            "conclusion": run["conclusion"],
            "url": run["url"],
            "log": str(log.relative_to(ROOT)),
            "lines": lines,
            "annotations": annotations,
            "dependency_or_eol_warnings": warnings,
            "jobs": [
                {
                    "name": job["name"],
                    "status": job["status"],
                    "conclusion": job["conclusion"],
                }
                for job in run["jobs"]
            ],
        }
    )
(ROOT / "ci-evidence-index.json").write_text(json.dumps(records, indent=2) + "\n")
print(f"Indexed {len(records)} preserved workflow logs.")
for row in records:
    print(
        f"{row['run']} {row['sha'][:8]} {row['name']}: {row['conclusion']}; "
        f"{len(row['annotations'])} annotations, "
        f"{len(row['dependency_or_eol_warnings'])} dependency/LF warnings"
    )
