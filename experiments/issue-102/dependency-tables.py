"""Build exhaustive before/latest/resolved tables from saved registry evidence."""

import csv
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
EVIDENCE = ROOT / "dev/log/issues/102/pulls/103"
RESEARCH = EVIDENCE / "research"
OUTPUT = EVIDENCE / "dependencies"
BASE = "6889e9373817a664d13bdaa5c51627f8ba773bef"
LOCKS = {
    "npm-root": "package-lock.json",
    "npm-example": "examples/universal-app/package-lock.json",
    "npm-artifact": ".github/actions/artifact-transport/package-lock.json",
}


def before(path):
    return subprocess.check_output(["git", "show", f"{BASE}:{path}"], text=True)


def name_at(location, package):
    return package.get("name") or location.rsplit("node_modules/", 1)[1]


def resolve(packages, location, name):
    base = Path(location)
    while True:
        key = str(base / "node_modules" / name)
        if key in packages:
            return key
        if base == Path("."):
            return None
        base = base.parent


def parents(packages, target, name):
    found = []
    for location, package in packages.items():
        for field in ("dependencies", "devDependencies", "optionalDependencies"):
            requirement = package.get(field, {}).get(name)
            if requirement and resolve(packages, location, name) == target:
                parent = package.get("name") or location.rsplit("node_modules/", 1)[-1]
                found.append(
                    f"{parent or '(root)'}@{package.get('version', '')}: {requirement}"
                )
    return sorted(set(found))


def write_table(filename, rows):
    columns = [
        "dependency",
        "before",
        "latest",
        "resolved",
        "location",
        "reason",
        "registry",
    ]
    with (OUTPUT / f"{filename}.csv").open("w") as stream:
        writer = csv.DictWriter(stream, fieldnames=columns)
        writer.writeheader()
        writer.writerows(rows)
    # The CSV is the complete occurrence-level table; this grouped Markdown
    # keeps review comfortably below the repository's 1500-line file limit.
    grouped = {}
    for row in rows:
        key = row["dependency"]
        item = grouped.setdefault(
            key,
            {
                "before": set(),
                "latest": row["latest"],
                "resolved": set(),
                "reasons": set(),
            },
        )
        item["before"].add(row["before"])
        item["resolved"].add(row["resolved"])
        if row["reason"] != "Current registry release":
            item["reasons"].add(row["reason"])
    lines = [
        f"# {filename}: registry snapshot 2026-11-06 UTC",
        "",
        "Every lock location and its consumer constraints are in the matching CSV.",
        "",
        "| Dependency | Before | Registry latest | Resolved | Reason for retained version / removal |",
        "| --- | --- | --- | --- | --- |",
    ]
    for name, item in sorted(grouped.items()):
        values = [
            name,
            ", ".join(sorted(item["before"])),
            item["latest"],
            ", ".join(sorted(item["resolved"])),
            "; ".join(sorted(item["reasons"])) or "Current registry release",
        ]
        lines.append(
            "| " + " | ".join(value.replace("|", "&#124;") for value in values) + " |"
        )
    (OUTPUT / f"{filename}.md").write_text("\n".join(lines) + "\n")
    print(f"{filename}: {len(rows)} locations, {len(grouped)} packages")


def npm_tables():
    registry = json.loads((RESEARCH / "npm-registry.json").read_text())
    for label, path in LOCKS.items():
        old = json.loads(before(path))["packages"]
        new = json.loads((ROOT / path).read_text())["packages"]
        rows = []
        for location in sorted(old.keys() | new.keys()):
            if "node_modules/" not in location:
                continue
            package = new.get(location, old.get(location))
            if package.get("link"):
                continue
            name = name_at(location, package)
            info = registry[name]
            version = new.get(location, {}).get("version", "removed/hoisted")
            reason = "Current registry release"
            if version == "removed/hoisted":
                reason = "Fresh resolution removed this location; no direct feature or manifest dependency was removed"
            elif version != info["version"]:
                consumers = "; ".join(parents(new, location, name))
                reason = f"Upstream consumer API/range constraint: {consumers or 'optional/peer subtree'}"
                if info.get("type") == "module" and int(version.split(".")[0]) < int(
                    info["version"].split(".")[0]
                ):
                    reason += "; latest also changes the module/API major; a forced override would bypass the consumer's declared integration"
                if info.get("deprecated"):
                    reason += f"; upstream deprecation: {info['deprecated']}"
            rows.append(
                dict(
                    dependency=name,
                    before=old.get(location, {}).get("version", "new/unlocked"),
                    latest=info["version"],
                    resolved=version,
                    location=location,
                    reason=reason,
                    registry=info["source"],
                )
            )
        write_table(label, rows)

    old = json.loads(before("deno.lock"))["npm"]
    new = json.loads((ROOT / "deno.lock").read_text())["npm"]
    old_versions = {}
    for key in old:
        match = re.match(r"^(@[^/]+/[^@]+|[^@]+)@([^_]+)", key)
        old_versions.setdefault(match[1], set()).add(match[2])
    rows = []
    for key in sorted(new):
        match = re.match(r"^(@[^/]+/[^@]+|[^@]+)@([^_]+)", key)
        name, version = match.groups()
        info = registry[name]
        consumers = [
            parent
            for parent, value in new.items()
            if key in value.get("dependencies", [])
        ]
        reason = (
            "Current registry release"
            if version == info["version"]
            else f"Deno resolves the upstream consumer's declared API range; consumers: {', '.join(consumers) or 'root package'}"
        )
        rows.append(
            dict(
                dependency=name,
                before=", ".join(sorted(old_versions.get(name, {"new/unlocked"}))),
                latest=info["version"],
                resolved=version,
                location=key,
                reason=reason,
                registry=info["source"],
            )
        )
    for name in sorted(old_versions.keys() - {row["dependency"] for row in rows}):
        info = registry[name]
        rows.append(
            dict(
                dependency=name,
                before=", ".join(sorted(old_versions[name])),
                latest=info["version"],
                resolved="removed",
                location="deno.lock",
                reason="Fresh graph no longer requires this transitive package",
                registry=info["source"],
            )
        )
    write_table("deno", rows)


def python_table():
    registry = json.loads((RESEARCH / "python-registry.json").read_text())
    old = dict(
        re.findall(
            r"^([\w.-]+)==([^\s]+)",
            before("experiments/benchmark/requirements.txt"),
            re.M,
        )
    )
    current = dict(
        re.findall(
            r"^([\w.-]+)==([^\s]+)",
            (ROOT / "experiments/benchmark/requirements.lock").read_text(),
            re.M,
        )
    )
    rows = []
    for name, version in sorted(current.items()):
        info = registry[name]
        consumers = []
        for parent, metadata in registry.items():
            for requirement in metadata.get("requires_dist") or []:
                if re.match(rf"{re.escape(name)}\b", requirement, re.I):
                    consumers.append(f"{parent}: {requirement}")
        reason = (
            "Current registry release"
            if version == info["version"]
            else f"Resolver's upstream version/platform constraints: {'; '.join(consumers)}"
        )
        rows.append(
            dict(
                dependency=name,
                before=old.get(name, "previously unlocked"),
                latest=info["version"],
                resolved=version,
                location="experiments/benchmark/requirements.lock",
                reason=reason,
                registry=info["source"],
            )
        )
    write_table("python-benchmark", rows)

    rows = []
    installed = json.loads((RESEARCH / "python-tooling-installed.json").read_text())
    normalized = {
        re.sub(r"[-_.]+", "-", name).lower(): metadata
        for name, metadata in registry.items()
    }
    for item in installed:
        name, version = item["name"], item["version"]
        info = normalized[re.sub(r"[-_.]+", "-", name).lower()]
        reason = "Current registry release"
        if version != info["version"]:
            reason = "pip-audit's supported dependency API range; isolated CI tooling is resolved separately from benchmark NLP dependencies"
        rows.append(
            dict(
                dependency=name,
                before="runner-provided/unlocked",
                latest=info["version"],
                resolved=version,
                location="isolated Python CI tooling environment",
                reason=reason,
                registry=info["source"],
            )
        )
    write_table("python-tooling", rows)


def actions_table():
    registry = json.loads((RESEARCH / "actions-registry.json").read_text())
    files = [
        path
        for path in (ROOT / ".github").rglob("*.yml")
        if "node_modules" not in path.parts
    ]
    rows = []
    for file in files:
        for action, ref in re.findall(
            r"uses: ([\w.-]+/[\w./-]+)@([\w.-]+)", file.read_text()
        ):
            repo = "/".join(action.split("/")[:2])
            info = registry[repo]
            # CodeQL's releases/latest is a bundle, not a runnable Action.
            latest = "v4.39.3" if repo == "github/codeql-action" else info["tag_name"]
            old = sorted({item["before"] for item in info["occurrences"]})
            reason = "Current registry release"
            if len(ref) == 40:
                reason = "Immutable SHA of the current release; retained reviewed supply-chain pin"
            rows.append(
                dict(
                    dependency=action,
                    before=", ".join(old),
                    latest=latest,
                    resolved=ref,
                    location=str(file.relative_to(ROOT)),
                    reason=reason,
                    registry=f"https://github.com/{repo}/releases/tag/{latest}",
                )
            )
    write_table("github-actions", rows)


if __name__ == "__main__":
    OUTPUT.mkdir(parents=True, exist_ok=True)
    npm_tables()
    python_table()
    actions_table()
