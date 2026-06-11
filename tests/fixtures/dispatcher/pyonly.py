# Fixture: .py-only — dispatcher must fall back to python3.
# Echoes argv as JSON for exact passthrough assertions.
import json
import sys

# separators match JSON.stringify so tests can assert byte-exact output
print("py:" + json.dumps(sys.argv[1:], separators=(",", ":")))
