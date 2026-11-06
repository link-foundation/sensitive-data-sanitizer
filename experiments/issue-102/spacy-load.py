"""Minimal reproducer for Presidio's preshed cap on CPython 3.15.

Install experiments/benchmark/requirements.lock and the model specified in that
benchmark's README in an isolated environment, then run this script. Python 3.14
loads successfully; the 3.15/preshed 3.0.13 combination raises OverflowError.
"""

import importlib.metadata
import sys

import spacy

print(sys.version)
for package in ("presidio-analyzer", "spacy", "preshed", "en-core-web-sm"):
    print(package, importlib.metadata.version(package))
nlp = spacy.load("en_core_web_sm")
assert nlp("Contact alice@example.com").ents
print("Model loaded and NER executed")
