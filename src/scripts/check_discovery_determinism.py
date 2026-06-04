#!/usr/bin/env python3
"""Determinism check — runs the discovery scanner twice and diffs the output.

The `generated_at` field is normalised because it intentionally captures
wall-clock time. Everything else (artefact order, unassigned order,
checksum) MUST be byte-identical between runs.

CLI:
  python scripts/check_discovery_determinism.py

Exit codes:
  0  byte-identical (apart from generated_at)
  1  drift detected
"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCANNER = ROOT / "src" / "scripts" / "build_discovery_manifest.py"


def _run() -> dict:
    proc = subprocess.run(
        [sys.executable, str(SCANNER)],
        capture_output=True,
        text=True,
        check=False,
        cwd=str(ROOT),
    )
    if proc.returncode != 0:
        print(proc.stderr, file=sys.stderr)
        raise SystemExit(f"scanner failed: exit {proc.returncode}")
    return json.loads(proc.stdout)


def _normalise(manifest: dict) -> dict:
    out = dict(manifest)
    out["generated_at"] = "<normalised>"
    return out


def main() -> int:
    a = _normalise(_run())
    b = _normalise(_run())
    sa = json.dumps(a, indent=2, sort_keys=True, ensure_ascii=False)
    sb = json.dumps(b, indent=2, sort_keys=True, ensure_ascii=False)
    if sa != sb:
        print("DRIFT: scanner produced different output across two runs", file=sys.stderr)
        # show first divergence
        for i, (la, lb) in enumerate(zip(sa.splitlines(), sb.splitlines()), 1):
            if la != lb:
                print(f"  line {i}:", file=sys.stderr)
                print(f"    run1: {la}", file=sys.stderr)
                print(f"    run2: {lb}", file=sys.stderr)
                break
        return 1
    # also assert the checksum survives the round-trip
    if a["checksum"] != b["checksum"]:
        print(f"DRIFT: checksum changed ({a['checksum']} vs {b['checksum']})", file=sys.stderr)
        return 1
    print(f"OK: deterministic across 2 runs, checksum {a['checksum'][:24]}...")
    return 0


if __name__ == "__main__":
    sys.exit(main())
