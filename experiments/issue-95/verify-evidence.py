"""Check the issue's full-run evidence, compressed archives and template trees."""

import gzip
import json
import tarfile
import zipfile
from pathlib import Path

ROOT = Path("dev/log/issues/95/pulls/96")
RUNS = (
    42082184911,
    42080626844,
    42080627286,
    42080627175,
    42080626895,
    42080627191,
    37679381132,
)


def read_json(path):
    if path.exists():
        return json.loads(path.read_text())
    with gzip.open(str(path) + ".gz", "rt") as stream:
        return json.load(stream)


for run in RUNS:
    prefix = ROOT / "ci-logs" / f"run-{run}"
    for suffix in (".json", ".jobs.json", ".annotations.json"):
        read_json(prefix.with_suffix(suffix))
    assert prefix.with_suffix(".log.gz").exists(), f"Missing run log: {run}"
for path in ROOT.rglob("*.gz"):
    with gzip.open(path, "rb") as stream:
        while stream.read(65536):
            pass
with zipfile.ZipFile(ROOT / "preview-failure-artifact.zip") as archive:
    assert archive.testzip() is None, "Corrupt screenshot artifact"
for language in ("javascript", "python"):
    tree = read_json(ROOT / "templates" / f"{language}-tree.json")
    with tarfile.open(ROOT / "templates" / f"{language}.tar.gz") as archive:
        paths = {
            member.name.split("/", 1)[1]
            for member in archive.getmembers()
            if member.isfile() and "/" in member.name
        }
    assert not tree.get("truncated"), f"Incomplete {language} tree"
    assert paths == {item["path"] for item in tree["tree"] if item["type"] == "blob"}, (
        f"Incomplete {language} archive"
    )
print(
    "Seven original runs, all gzip/ZIP archives, and both full template trees verified."
)
