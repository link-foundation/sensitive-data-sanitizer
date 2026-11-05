"""Verify the real pinned CLI archive and isolated Git helper without writes."""

import os
import subprocess
import tempfile
from pathlib import Path

log = Path("dev/log/issues/95/pulls/96/preview-tools-real.log")
with tempfile.TemporaryDirectory(prefix="issue95-preview-") as directory:
    path_file = Path(directory) / "paths"
    path_file.touch()
    env = {**os.environ, "RUNNER_TEMP": directory, "GITHUB_PATH": str(path_file)}
    with log.open("w") as stream:
        subprocess.run(
            ["bash", "scripts/setup-preview-gh.sh"],
            env=env,
            stdout=stream,
            stderr=subprocess.STDOUT,
            check=True,
        )
        env["PATH"] = path_file.read_text().strip() + os.pathsep + env["PATH"]
        env["CI_SCRIPTS_DEBUG"] = "1"
        subprocess.run(
            ["bash", "scripts/check-preview-tools.sh"],
            env=env,
            stdout=stream,
            stderr=subprocess.STDOUT,
            check=True,
        )
print(f"Pinned CLI and credential smoke check passed: {log}")
