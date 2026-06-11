"""Parity fixture: exit-code mismatch — Python exits 3, TS exits 0."""
import sys

print("same output")
sys.exit(3)
