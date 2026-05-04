#!/usr/bin/env python3
"""Test fixture concern — emits an allow decision and exits 0."""
import json
import sys

# Drain stdin so the dispatcher's pipe completes cleanly.
_ = sys.stdin.read() if not sys.stdin.isatty() else ""
print(json.dumps({"decision": "allow", "reason": "fixture allow"}))
sys.exit(0)
