"""Resolve each manifest from registry metadata with the reviewed npm release."""

import os
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LOGS = ROOT / "dev/log/issues/102/pulls/103/verification"

for name, directory in (
    ("root", "."),
    ("app", "examples/universal-app"),
    ("artifact", ".github/actions/artifact-transport"),
):
    path = ROOT / directory
    # An existing installation can seed Arborist with stale versions and omit
    # registry integrity metadata. Resolve with no node_modules, restoring it
    # afterwards without deleting or duplicating the installed tree.
    with tempfile.TemporaryDirectory(prefix="issue-102-npm-") as temporary:
        modules = path / "node_modules"
        backup = Path(temporary) / "node_modules"
        if modules.exists():
            modules.rename(backup)
        try:
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
        finally:
            if backup.exists():
                backup.rename(modules)
    print(f"Resolved {directory}", flush=True)
