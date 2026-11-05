"""Exercise manifest discovery and fail-closed auditing without network access."""

import importlib.util
import io
import subprocess
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest.mock import patch

SCRIPT = Path(__file__).resolve().parents[2] / "scripts/audit-python-dependencies.py"
spec = importlib.util.spec_from_file_location("dependency_audit", SCRIPT)
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)


class DependencyAuditTests(unittest.TestCase):
    def setUp(self):
        # Expected failure fixtures must not create real CI error annotations.
        self.output = io.StringIO()
        redirect = redirect_stdout(self.output)
        redirect.__enter__()
        self.addCleanup(redirect.__exit__, None, None, None)

    def test_discovers_every_requirements_surface_and_excludes_raw_evidence(self):
        files = (
            b"experiments/benchmark/requirements.txt\0examples/my app/requirements-dev.txt\0"
            b"dev/log/requirements.txt\0docs/case-studies/x/requirements.txt\0ruff.toml\0"
        )
        with patch.object(audit.subprocess, "check_output", return_value=files):
            self.assertEqual(
                audit.discover(),
                [
                    "examples/my app/requirements-dev.txt",
                    "experiments/benchmark/requirements.txt",
                ],
            )

    def test_requires_an_explicit_mapping_for_new_manifest_formats(self):
        for name in (
            "pyproject.toml",
            "setup.py",
            "setup.cfg",
            "Pipfile",
            "Pipfile.lock",
        ):
            with self.subTest(name=name):
                with patch.object(
                    audit.subprocess,
                    "check_output",
                    return_value=f"pkg/{name}\0".encode(),
                ):
                    with self.assertRaisesRegex(
                        ValueError, "Unmapped Python dependency manifest"
                    ):
                        audit.discover()

    def test_resolves_transitive_hashes_without_installing_or_building_packages(self):
        with patch.object(
            audit.subprocess, "run", return_value=subprocess.CompletedProcess([], 0)
        ) as run:
            self.assertEqual(audit.audit(["requirements.txt"]), 0)
        resolve, scan = [call.args[0] for call in run.call_args_list]
        self.assertEqual(resolve[:3], ["uv", "pip", "compile"])
        self.assertIn("--no-build", resolve)
        self.assertIn("--generate-hashes", resolve)
        self.assertEqual(scan[0], "pip-audit")
        for flag in ("--disable-pip", "--require-hashes"):
            self.assertIn(flag, scan)
        self.assertEqual(resolve[-1], scan[-1])

    def test_resolution_failure_does_not_scan_an_empty_result_or_hide_other_surfaces(
        self,
    ):
        results = [subprocess.CompletedProcess([], status) for status in (1, 0, 0)]
        with patch.object(audit.subprocess, "run", side_effect=results) as run:
            self.assertEqual(audit.audit(["first.txt", "second.txt"]), 1)
        self.assertEqual(
            [call.args[0][0] for call in run.call_args_list], ["uv", "uv", "pip-audit"]
        )

    def test_advisories_and_audit_service_errors_fail_the_gate(self):
        for status in (1, 2):
            with self.subTest(status=status):
                results = [
                    subprocess.CompletedProcess([], code) for code in (0, status)
                ]
                with patch.object(audit.subprocess, "run", side_effect=results):
                    self.assertEqual(audit.audit(["requirements.txt"]), 1)

    def test_audits_committed_transitive_lock_without_building_source_metadata(self):
        with (
            patch.object(audit.Path, "is_file", return_value=True),
            patch.object(
                audit.subprocess, "run", return_value=subprocess.CompletedProcess([], 0)
            ) as run,
        ):
            self.assertEqual(audit.audit(["requirements.txt"]), 0)
        self.assertEqual(run.call_count, 1)
        command = run.call_args.args[0]
        self.assertEqual(command[0], "pip-audit")
        self.assertIn("--require-hashes", command)
        self.assertEqual(command[-1], "requirements.lock")


if __name__ == "__main__":
    unittest.main()
