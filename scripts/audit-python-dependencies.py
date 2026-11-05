#!/usr/bin/env python3
"""Audit every tracked Python requirements file without installing its packages.

Committed locks are audited directly. For unlocked manifests uv resolves wheel
metadata; --no-build prevents executing package build hooks. pip-audit reads the complete hashed resolution,
so its own environment (including pip) is not mistaken for project dependencies.
Set CI_SCRIPTS_DEBUG=1 to print the commands and discovered dependency surfaces.
"""

import os
import subprocess
import tempfile
from pathlib import Path


def discover():
    paths = subprocess.check_output(["git", "ls-files", "-z"]).decode().split("\0")
    manifests = []
    for path in filter(None, paths):
        if path.startswith(("dev/log/", "docs/case-studies/")):
            continue
        name = Path(path).name
        if name.startswith("requirements") and name.endswith(".txt"):
            manifests.append(path)
        elif name in {
            "pyproject.toml",
            "Pipfile",
            "Pipfile.lock",
            "setup.py",
            "setup.cfg",
        }:
            raise ValueError(f"Unmapped Python dependency manifest: {path}")
    return sorted(manifests)


def audit(manifests):
    status = 0
    with tempfile.TemporaryDirectory(prefix="python-audit-") as directory:
        for index, manifest in enumerate(manifests):
            print(f"Auditing resolved Python dependencies: {manifest}", flush=True)
            resolved = str(Path(directory) / f"resolved-{index}.txt")
            lock = Path(manifest).with_suffix(".lock")
            commands = (
                []
                if lock.is_file()
                else [
                    [
                        "uv",
                        "pip",
                        "compile",
                        "--no-build",
                        "--python-version",
                        "3.15",
                        "--generate-hashes",
                        "--no-annotate",
                        "--quiet",
                        manifest,
                        "--output-file",
                        resolved,
                    ],
                ]
            )
            commands.append(
                [
                    "pip-audit",
                    "--disable-pip",
                    "--require-hashes",
                    "--progress-spinner",
                    "off",
                    "--requirement",
                    str(lock) if lock.is_file() else resolved,
                ]
            )
            for command in commands:
                if os.environ.get("CI_SCRIPTS_DEBUG") == "1":
                    print(f"[python-audit] {command!r}", flush=True)
                result = subprocess.run(command, check=False)
                if result.returncode:
                    print(
                        f"::error file={manifest}::Python dependency resolution or audit failed.",
                        flush=True,
                    )
                    status = 1
                    break
    return status


def main():
    manifests = discover()
    if not manifests:
        print("No tracked Python requirements files; no Python dependencies to audit.")
    return audit(manifests)


if __name__ == "__main__":
    raise SystemExit(main())
