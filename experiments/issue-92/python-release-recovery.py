"""Reproduce template recovery accepting an unverified remote version."""
import importlib.util
from pathlib import Path
import subprocess
import sys

source = Path(sys.argv[1]) / 'scripts/version_and_commit.py'
spec = importlib.util.spec_from_file_location('template_release', source)
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)

for remote_version in ['1.0.0', '1.0.1']:
    calls = []

    def command(args, **_options):
        calls.append(args)
        if args[:2] == ['git', 'rev-parse']:
            output = 'validated' if args[-1] == 'HEAD' else 'unverified-source-change'
        elif args[:2] == ['git', 'show']:
            output = f'[project]\nversion = "{remote_version}"\n'
        else:
            output = ''
        return subprocess.CompletedProcess(args, 0, output, '')

    release.run_command = command
    release.get_current_version = lambda _path: '1.0.0'
    result = release.check_remote_changes(Path('pyproject.toml'), 'pyproject.toml')
    if remote_version == '1.0.0':
        assert result == (True, '1.0.0')
        print('REPRODUCED: different remote commit accepted using only matching version')
    else:
        assert ['git', 'rebase', 'origin/main'] in calls
        print('REPRODUCED: unverified remote commit rebased without source/lock attestation')
    print('Calls:', calls)
