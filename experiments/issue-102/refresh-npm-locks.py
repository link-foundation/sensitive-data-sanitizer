"""Resolve each manifest from registry metadata with the reviewed npm release."""

import os
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LOGS = ROOT / "dev/log/issues/102/pulls/103/verification"

for name, directory in (
    ("root", "."),
    ("app", "examples/universal-app"),
    ("artifact", ".github/actions/artifact-transport"),
):
    path = ROOT / directory
    (path / "package-lock.json").unlink(missing_ok=True)
    with (LOGS / f"{name}-fresh-lock.log").open("w") as log:
        subprocess.run(
            [
                "npm",
                "install",
                "--package-lock-only",
                "--ignore-scripts",
                "--no-audit",
                "--no-fund",
            ],
            cwd=path,
            env=os.environ | {"NODE_OPTIONS": "--max-old-space-size=512"},
            stdout=log,
            stderr=subprocess.STDOUT,
            check=True,
        )
    print(f"Resolved {directory}", flush=True)
