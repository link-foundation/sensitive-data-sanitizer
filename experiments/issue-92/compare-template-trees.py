"""Hash complete committed trees against the preserved template archives."""
import hashlib
import json
from pathlib import Path
import subprocess
import tarfile

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'dev/log/issues/92/pulls/93/research'


def hashes(archive, upstream=False):
    result = {}
    for member in archive:
        if not member.isfile():
            continue
        name = member.name.split('/', 1)[1] if upstream else member.name
        digest = hashlib.sha256()
        with archive.extractfile(member) as source:
            while block := source.read(65536):
                digest.update(block)
        result[name] = digest.hexdigest()
    return result


sha = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
process = subprocess.Popen(['git', 'archive', '--format=tar', sha], cwd=ROOT, stdout=subprocess.PIPE)
with tarfile.open(fileobj=process.stdout, mode='r|') as archive:
    local = hashes(archive)
assert process.wait() == 0
summary = {'local_commit': sha, 'local_files': len(local), 'templates': {}}
for language in ['js', 'python']:
    with tarfile.open(OUT / f'{language}-snapshot.tar.gz') as archive:
        upstream = hashes(archive, upstream=True)
    tree = json.loads((OUT / f'{language}-tree.json').read_text())
    tracked = {item['path'] for item in tree['tree'] if item['type'] == 'blob'}
    assert set(upstream) == tracked, (language, set(upstream) ^ tracked)
    inventory = []
    for name in sorted(local.keys() | upstream.keys()):
        ours, theirs = local.get(name), upstream.get(name)
        status = ('identical' if ours == theirs else 'different') if ours and theirs else ('local-only' if ours else 'template-only')
        inventory.append({'path': name, 'status': status,
                          'local_sha256': ours, 'upstream_sha256': theirs})
    (OUT / f'{language}-full-inventory.json').write_text(json.dumps(inventory, indent=2) + '\n')
    summary['templates'][language] = {'commit': tree['sha'], 'files': len(upstream),
                                    'counts': {status: sum(row['status'] == status for row in inventory)
                                               for status in ['identical', 'different', 'local-only', 'template-only']}}
    if language == 'js':
        report = OUT / 'TEMPLATE-COMPARISON.md'
        source = report.read_text()
        for row in inventory:
            name = row['path']
            if not name.startswith('scripts/') or row['status'] == 'local-only':
                continue
            label = 'Identical upstream helper retained/adopted' if row['status'] == 'identical' else 'Adapted for release attestation, project coverage or diagnostics; see PR diff'
            lines = source.splitlines()
            for index, line in enumerate(lines):
                if line.startswith(f'| `{name.removeprefix("scripts/")}` |'):
                    lines[index] = f'| `{name.removeprefix("scripts/")}` | {label} |'
            source = '\n'.join(lines) + '\n'
        source = '\n'.join(line for line in source.splitlines() if '__pycache__' not in line) + '\n'
        report.write_text(source)
(OUT / 'inventory-revisions.json').write_text(json.dumps(summary, indent=2) + '\n')
print(json.dumps(summary, indent=2))
