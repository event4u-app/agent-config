"""Parity fixture: file-tree mismatch — written file content differs."""
from pathlib import Path

Path("out.txt").write_text("written by python\n")
