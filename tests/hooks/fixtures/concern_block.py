#!/usr/bin/env python3
"""Test fixture concern — emits a block decision and exits 1."""
import json
import sys

_ = sys.stdin.read() if not sys.stdin.isatty() else ""
print(json.dumps({"decision": "block", "reason": "fixture block"}))
sys.exit(1)
