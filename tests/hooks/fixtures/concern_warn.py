#!/usr/bin/env python3
"""Test fixture concern — emits a warn decision and exits 2."""
import json
import sys

_ = sys.stdin.read() if not sys.stdin.isatty() else ""
print(json.dumps({"decision": "warn", "reason": "fixture warn"}))
sys.exit(2)
