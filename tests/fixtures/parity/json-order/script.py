"""Parity fixture: same JSON data, different key order and whitespace."""
import json

print(json.dumps({"alpha": 1, "beta": [1, 2], "nested": {"x": True}}))
