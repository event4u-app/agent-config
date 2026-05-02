"""Temporary helper for F3.3 rename: replace backtick-wrapped tokens in a list of files."""
from __future__ import annotations

import sys
from pathlib import Path

OLD = sys.argv[1]
NEW = sys.argv[2]
files = sys.argv[3:]

bt = chr(96)
for fp in files:
    p = Path(fp)
    if not p.exists():
        continue
    s = p.read_text(encoding="utf-8")
    before = s.count(OLD)
    s = s.replace(f"{bt}{OLD}{bt}", f"{bt}{NEW}{bt}")
    s = s.replace(f"{OLD}.md", f"{NEW}.md")
    p.write_text(s, encoding="utf-8")
    after = s.count(OLD)
    print(f"  {fp}: {before} -> {after}")
