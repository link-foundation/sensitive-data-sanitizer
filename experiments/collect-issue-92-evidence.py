"""Collect issue #92 evidence without holding large Actions logs in memory."""

import gzip
import json
import pathlib
import subprocess

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "dev/log/issues/92/pulls/93"
REPO = "link-foundation/sensitive-data-sanitizer"


def collect(run_id):
    metadata = OUT / f"github/run-{run_id}.json"
    if not metadata.exists():
        result = subprocess.run(
            [
                "gh",
                "run",
                "view",
                str(run_id),
                "--repo",
                REPO,
                "--json",
                "databaseId,name,headSha,event,status,conclusion,createdAt,updatedAt,url,jobs",
            ],
            capture_output=True,
            check=True,
        )
        metadata.write_bytes(result.stdout)
    data = json.loads(metadata.read_text())
    if data["status"] != "completed":
        metadata.unlink()
        print(f"{run_id}: still running; collect after completion", flush=True)
        return
    log = OUT / f"ci-logs/run-{run_id}.log.gz"
    if log.exists():
        return
    errors = OUT / f"ci-logs/run-{run_id}.download-error.txt"
    with errors.open("wb") as stderr:
        process = subprocess.Popen(
            ["gh", "run", "view", str(run_id), "--repo", REPO, "--log"],
            stdout=subprocess.PIPE,
            stderr=stderr,
        )
        with gzip.open(log, "wb") as compressed:
            while block := process.stdout.read(65536):
                compressed.write(block)
        status = process.wait()
    if status:
        log.unlink()
        print(f"{run_id}: unavailable: {errors.read_text().strip()}", flush=True)
    else:
        errors.unlink()
        print(f"{run_id}: {data['name']} / {data['conclusion']}", flush=True)


if __name__ == "__main__":
    runs = {
        42060441559,
        42060441049,
        42060440016,
        42060440544,
        41883360342,
        37679381132,
    }
    for filename in ("main-runs.json", "branch-runs-initial.json"):
        runs.update(
            run["databaseId"]
            for run in json.loads((OUT / "github" / filename).read_text())[:8]
        )
    for run_id in sorted(runs):
        collect(run_id)
