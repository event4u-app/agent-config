#!/usr/bin/env python3
"""check_no_external_sources — block readable inspiration/harvest source names.

Backstop for the source-confidentiality policy (rule: source-confidentiality;
the 2026-06-13 sweep). Scans the **tracked** tree for a denylist of external
inspiration / harvest / comparison source slugs so they cannot re-enter the
repo by accident. Recommending an integrated tool is allowed; recording that
we copied / derived / were-inspired-by a named external source is not.

Carve-outs (see external_sources_denylist.json):
- Vendored Apache/MIT code keeps its license-required attribution.
- Recommendation/registry docs may name registries (Smithery/Glama).
- A retained source link must be stored encrypted via
  src/scripts/_lib/link_crypto.py, never in plaintext.

Exit codes: 0 = clean, 1 = at least one denied token in a non-skipped tracked
file, 2 = usage / config error.

Usage:
    python3 src/scripts/check_no_external_sources.py [--json]
"""

from __future__ import annotations

import fnmatch
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CONFIG = Path(__file__).with_name("external_sources_denylist.json")
# Scan only text-ish files; skip binaries / lockfiles / images.
_SKIP_EXT = {
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".pdf", ".zip", ".gz",
    ".woff", ".woff2", ".ttf", ".mp3", ".mp4", ".wav", ".lock",
}


def _tracked_files() -> list[str]:
    out = subprocess.run(
        ["git", "ls-files"], cwd=ROOT, capture_output=True, text=True, check=True
    ).stdout
    return [line for line in out.splitlines() if line]


def _load_config() -> dict:
    data = json.loads(CONFIG.read_text(encoding="utf-8"))
    if not data.get("deny"):
        raise SystemExit("config error: empty deny list")
    return data


def _skipped(path: str, skip_globs: list[str]) -> bool:
    return any(fnmatch.fnmatch(path, g) for g in skip_globs)


def main(argv: list[str]) -> int:
    as_json = "--json" in argv
    cfg = _load_config()
    patterns = [(p, re.compile(p, re.IGNORECASE)) for p in cfg["deny"]]
    skip_globs = cfg.get("skip_paths", [])

    hits: list[dict] = []
    for rel in _tracked_files():
        if Path(rel).suffix.lower() in _SKIP_EXT:
            continue
        if _skipped(rel, skip_globs):
            continue
        try:
            text = (ROOT / rel).read_text(encoding="utf-8", errors="replace")
        except (OSError, IsADirectoryError):
            continue
        for lineno, line in enumerate(text.splitlines(), start=1):
            for raw, rx in patterns:
                if rx.search(line):
                    hits.append({"file": rel, "line": lineno, "token": raw,
                                 "text": line.strip()[:160]})

    if as_json:
        print(json.dumps({"ok": not hits, "hits": hits}, indent=2))
    else:
        if hits:
            print(f"❌  {len(hits)} external-source reference(s) in the tracked tree:\n")
            for h in hits:
                print(f"  {h['file']}:{h['line']}  [{h['token']}]  {h['text']}")
            print(
                "\nThese name an external inspiration/harvest source. Remove the name,\n"
                "or — if a real source link must be retained — encrypt it via\n"
                "src/scripts/_lib/link_crypto.py. Legitimate carve-outs (vendored code,\n"
                "registry recommendations) belong in external_sources_denylist.json\n"
                "skip_paths. See rule: source-confidentiality."
            )
        else:
            print("✅  No external inspiration-source references in the tracked tree.")
    return 1 if hits else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
