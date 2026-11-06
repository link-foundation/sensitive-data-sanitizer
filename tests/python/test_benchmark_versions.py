"""Run the bridge's version gate without installing NLP models."""

import importlib.metadata
import io
import json
import runpy
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

ROOT = Path(__file__).resolve().parents[2]
BRIDGE = ROOT / "experiments/benchmark/python-bridge.py"


class BenchmarkVersionTests(unittest.TestCase):
    def test_bridge_accepts_the_installed_manifest_versions(self):
        pins = dict(
            line.split("==")
            for line in BRIDGE.with_name("requirements.txt").read_text().splitlines()
        )
        pins["en-core-web-sm"] = "3.8.0"
        modules = {}
        for name, attributes in {
            "scrubadub": ["Scrubber"],
            "detect_secrets.core.scan": ["scan_file"],
            "detect_secrets.settings": ["default_settings"],
            "presidio_analyzer": ["AnalyzerEngine"],
            "presidio_analyzer.nlp_engine": ["NlpEngineProvider"],
        }.items():
            module = types.ModuleType(name)
            for attribute in attributes:
                setattr(module, attribute, Mock())
            modules[name] = module
        output = io.StringIO()
        with (
            patch.dict(sys.modules, modules),
            patch.object(importlib.metadata, "version", side_effect=pins.__getitem__),
            patch.object(sys, "stdin", io.StringIO("[]")),
            patch.object(sys, "stdout", output),
        ):
            runpy.run_path(str(BRIDGE))
        self.assertEqual(json.loads(output.getvalue()), {})
