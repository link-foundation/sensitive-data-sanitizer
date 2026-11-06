"""Bounded reproduction for npm's handling of an existing Deno module tree."""

import json
import os
import subprocess
import tempfile
from pathlib import Path

with tempfile.TemporaryDirectory(prefix="npm-deno-repro-") as directory:
    root = Path(directory)
    (root / "package.json").write_text(
        json.dumps(
            {
                "name": "npm-deno-link-reproduction",
                "private": True,
                "type": "module",
                "dependencies": {"links-notation": "0.31.0"},
                "overrides": {"minimatch@>=7 <11": "^11.0.4"},
            }
        )
    )
    (root / "deno.json").write_text('{"nodeModulesDir":"auto"}')
    (root / "repro.mjs").write_text('import "links-notation";\n')
    commands = [
        ["npm", "install", "--ignore-scripts", "--no-audit", "--no-fund"],
        [
            os.environ.get("ISSUE_102_DENO", "deno"),
            "test",
            "-A",
            "--no-run",
            "--minimum-dependency-age",
            "0",
            "--v8-flags=--max-old-space-size=512",
            "repro.mjs",
        ],
        [
            "npm",
            "install",
            "--package-lock-only",
            "--ignore-scripts",
            "--no-audit",
            "--no-fund",
        ],
    ]
    for index, command in enumerate(commands):
        if index == 2:
            (root / "package-lock.json").unlink()
        print("Running: " + " ".join(command), flush=True)
        result = subprocess.run(
            command,
            cwd=root,
            env=os.environ | {"NODE_OPTIONS": "--max-old-space-size=512"},
            check=False,
        )
        print(f"Exit: {result.returncode}", flush=True)
        if result.returncode:
            break
