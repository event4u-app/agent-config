#!/usr/bin/env python3
"""Stale-manifest guard — re-builds the manifest in memory and diffs it
against the committed ``dist/discovery/discovery-manifest.json``.

CI runs this after a freshly-checked-out tree; non-zero diff = somebody
forgot to regenerate the manifest after touching artefact frontmatter.

The ``generated_at`` field is normalised on both sides (wall-clock).
Everything else MUST match byte-for-byte.

CLI:
  python scripts/validate_discovery_manifest.py [--quiet]

Exit codes:
  0  manifest on disk matches a fresh re-build
  1  drift detected (committed manifest is stale)
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCANNER = ROOT / "scripts" / "build_discovery_manifest.py"
COMMITTED = ROOT / "dist" / "discovery" / "discovery-manifest.json"


def _normalise(manifest: dict) -> str:
    out = dict(manifest)
    out["generated_at"] = "<normalised>"
    return json.dumps(out, indent=2, sort_keys=True, ensure_ascii=False) + "\n"


def _fresh_build() -> dict:
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


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--quiet", action="store_true")
    args = parser.parse_args(argv)

    if not COMMITTED.exists():
        print(
            f"error: committed manifest not found at {COMMITTED.relative_to(ROOT)} "
            "— run `task build-discovery` and commit the output.",
            file=sys.stderr,
        )
        return 1

    committed = json.loads(COMMITTED.read_text(encoding="utf-8"))
    fresh = _fresh_build()
    sa = _normalise(committed)
    sb = _normalise(fresh)
    if sa != sb:
        print(
            "DRIFT: committed discovery-manifest.json differs from a fresh re-build.",
            file=sys.stderr,
        )
        print(
            "  Run `task build-discovery` and commit dist/discovery/.",
            file=sys.stderr,
        )
        # first divergence — single most useful line
        for i, (la, lb) in enumerate(zip(sa.splitlines(), sb.splitlines()), 1):
            if la != lb:
                print(f"  first diff at line {i}:", file=sys.stderr)
                print(f"    committed: {la}", file=sys.stderr)
                print(f"    fresh:     {lb}", file=sys.stderr)
                break
        return 1
    if not args.quiet:
        print(
            f"OK {COMMITTED.relative_to(ROOT)} matches fresh re-build "
            f"({committed['stats']['total_artefacts']} artefacts)."
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
