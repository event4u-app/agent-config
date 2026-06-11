"""Parity fixture: identical pair. Echo argv + stdin, read a fixture file."""
import sys
from pathlib import Path

print("hello " + " ".join(sys.argv[1:]))
data = sys.stdin.read()
if data:
    sys.stdout.write("stdin:" + data)
seed = Path("seed.txt")
if seed.exists():
    sys.stdout.write("seed:" + seed.read_text())
