"""Preserve issue-95 CI metadata, full compressed logs, and diagnostic lines."""

import gzip
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path("dev/log/issues/95/pulls/96")
REPO = "link-foundation/sensitive-data-sanitizer"
REPORTED = [
    42082184911,
    42080626844,
    42080627286,
    42080627175,
    42080626895,
    42080627191,
    37679381132,
]


def gh(*args):
    return subprocess.run(["gh", *args], capture_output=True, check=True).stdout


def collect(run_id):
    prefix = ROOT / "ci-logs" / f"run-{run_id}"
    metadata = json.loads(gh("api", f"repos/{REPO}/actions/runs/{run_id}"))
    prefix.with_suffix(".json").write_text(json.dumps(metadata, indent=2) + "\n")
    jobs = json.loads(
        gh(
            "api",
            f"repos/{REPO}/actions/runs/{run_id}/jobs?per_page=100",
            "--paginate",
            "--slurp",
        )
    )
    prefix.with_suffix(".jobs.json").write_text(json.dumps(jobs, indent=2) + "\n")
    annotations = []
    for page in jobs:
        for job in page["jobs"]:
            if job.get("check_run_url"):
                check_id = job["check_run_url"].rsplit("/", 1)[-1]
                values = json.loads(
                    gh(
                        "api",
                        f"repos/{REPO}/check-runs/{check_id}/annotations?per_page=100",
                        "--paginate",
                        "--slurp",
                    )
                )
                annotations.extend(
                    {"job": job["name"], **a} for items in values for a in items
                )
    prefix.with_suffix(".annotations.json").write_text(
        json.dumps(annotations, indent=2) + "\n"
    )
    result = subprocess.run(
        ["gh", "run", "view", str(run_id), "--repo", REPO, "--log"], capture_output=True
    )
    with gzip.open(prefix.with_suffix(".log.gz"), "wb") as stream:
        stream.write(result.stdout)
    if result.stderr:
        prefix.with_suffix(".download.txt").write_bytes(result.stderr)
    lines = result.stdout.decode(errors="replace").splitlines()
    pattern = re.compile(
        r"##\[(?:error|warning)\]|(?:npm warn|DeprecationWarning|^warning:|error:|fatal:|command not found|approaching .*budget|exceeded .*budget)",
        re.I,
    )
    findings = [
        f"{i}: {line}" for i, line in enumerate(lines, 1) if pattern.search(line)
    ]
    prefix.with_suffix(".findings.txt").write_text("\n".join(findings) + "\n")
    print(
        f"{run_id}: {metadata['name']} {metadata['head_sha'][:8]} {metadata['conclusion']}; {len(lines)} lines, {len(annotations)} annotations, {len(findings)} candidate diagnostic lines",
        flush=True,
    )


if __name__ == "__main__":
    for run_id in map(int, sys.argv[1:]) if len(sys.argv) > 1 else REPORTED:
        collect(run_id)
