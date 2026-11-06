"""Snapshot published dependency metadata without installing dependency trees."""

import concurrent.futures
import csv
import json
import re
import subprocess
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "dev/log/issues/102/pulls/103/research"
BASE = "6889e9373817a664d13bdaa5c51627f8ba773bef"
LOCKS = [
    "package-lock.json",
    ".github/actions/artifact-transport/package-lock.json",
    "examples/universal-app/package-lock.json",
]


def baseline(path):
    return subprocess.check_output(
        ["git", "show", f"{BASE}:{path}"], cwd=ROOT, text=True
    )


def get_json(url):
    request = urllib.request.Request(url, headers={"User-Agent": "issue-102-research"})
    with urllib.request.urlopen(request) as response:
        return json.load(response)


def npm_metadata(name):
    url = f"https://registry.npmjs.org/{urllib.parse.quote(name, safe='')}/latest"
    data = get_json(url)
    return name, {
        key: data[key]
        for key in (
            "name",
            "version",
            "engines",
            "type",
            "exports",
            "deprecated",
            "dependencies",
            "peerDependencies",
            "repository",
        )
        if key in data
    } | {"source": url}


def npm_inventory():
    records = []
    names = {"npm", "npm-check-updates", "playwright", "browser-commander"}
    for path in LOCKS:
        packages = json.loads(baseline(path))["packages"]
        for location, info in packages.items():
            if "node_modules/" not in location or info.get("link"):
                continue
            name = info.get("name") or location.rsplit("node_modules/", 1)[1]
            if info.get("resolved", "").startswith("file:"):
                continue
            names.add(name)
            records.append((path, location, name, info.get("version", "MISSING")))
    for path in (ROOT / lock for lock in LOCKS):
        for location, info in json.loads(path.read_text())["packages"].items():
            if "node_modules/" in location and not info.get("link"):
                name = info.get("name") or location.rsplit("node_modules/", 1)[1]
                if not info.get("resolved", "").startswith("file:"):
                    names.add(name)
    for contents in (baseline("deno.lock"), (ROOT / "deno.lock").read_text()):
        names.update(
            re.match(r"^(@[^/]+/[^@]+|[^@]+)@", key)[1]
            for key in json.loads(contents).get("npm", {})
        )
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
        metadata = dict(executor.map(npm_metadata, sorted(names)))
    (OUTPUT / "npm-registry.json").write_text(json.dumps(metadata, indent=2) + "\n")
    with (OUTPUT / "npm-before.csv").open("w") as stream:
        writer = csv.writer(stream)
        writer.writerow(["lockfile", "location", "dependency", "before", "latest"])
        for path, location, name, version in records:
            writer.writerow([path, location, name, version, metadata[name]["version"]])
    print(f"Queried {len(metadata)} npm releases; inventoried {len(records)} entries")


def python_inventory():
    names = {
        "ruff",
        "uv",
        "pip-audit",
        "shellcheck-py",
        "git-filter-repo",
        "zizmor",
        "pip",
    }
    requirements = baseline("experiments/benchmark/requirements.txt")
    names.update(re.findall(r"^([\w-]+)==", requirements, re.MULTILINE))
    names.update(
        re.findall(
            r"^([\w.-]+)==",
            (ROOT / "experiments/benchmark/requirements.lock").read_text(),
            re.MULTILINE,
        )
    )
    names.update(
        item["name"]
        for item in json.loads((OUTPUT / "python-tooling-installed.json").read_text())
    )

    def metadata(name):
        url = f"https://pypi.org/pypi/{name}/json"
        package = get_json(url)
        info = package["info"]
        return name, {
            key: info[key]
            for key in ("version", "requires_python", "requires_dist", "project_urls")
        } | {"source": url, "vulnerabilities": package.get("vulnerabilities", [])}

    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
        data = dict(executor.map(metadata, sorted(names)))
    (OUTPUT / "python-registry.json").write_text(json.dumps(data, indent=2) + "\n")
    print(
        "PyPI: " + ", ".join(f"{name}={info['version']}" for name, info in data.items())
    )


if __name__ == "__main__":
    OUTPUT.mkdir(parents=True, exist_ok=True)
    npm_inventory()
    python_inventory()
