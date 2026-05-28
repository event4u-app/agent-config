#!/usr/bin/env python3
"""Measure rtk's token savings on a fixed corpus of verbose CLI invocations.

Phase 2 Step 3 of `agents/roadmaps/road-to-readable-value-dashboard.md`.

For each entry in `internal/bench/corpora/rtk/commands.yaml`:
  1. Run the raw command, capture stdout + stderr bytes.
  2. Run the rtk-wrapped command, capture stdout + stderr bytes.
  3. Compute char + token deltas (chars / 4 approximation).
  4. Record per-command result + aggregate.

Output: `internal/bench/reports/rtk/<UTC>.json` + `latest.json`.

Each command runs in the repo root with a 30 s timeout. Missing tools
(`rtk` not installed, raw command not on PATH) emit `skipped: <reason>`
entries and are excluded from the aggregate. The script never crashes —
mirror the placeholder discipline of `render_benchmark_md.py`.

Surfaces honoured per `script-writing`:
  --quiet      suppress per-step progress (errors still print to stderr)
  --corpus     override the default corpus path
  --out        override the default report dir
"""
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

try:
    import yaml
except ImportError:
    yaml = None  # type: ignore[assignment]


REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_CORPUS = REPO_ROOT / "internal" / "bench" / "corpora" / "rtk" / "commands.yaml"
DEFAULT_OUT_DIR = REPO_ROOT / "internal" / "bench" / "reports" / "rtk"
TIMEOUT_SECONDS = 30
CHARS_PER_TOKEN = 4


def _utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _log(msg: str, quiet: bool, *, err: bool = False) -> None:
    if err:
        print(msg, file=sys.stderr)
        return
    if not quiet:
        print(msg)


def _run_capture(argv: List[str], cwd: Path) -> Dict[str, Any]:
    """Run a command, return stdout+stderr bytes + exit code.

    Never raises — TimeoutExpired, FileNotFoundError, OSError each
    produce a dict marker. Bench results explicitly carry failures so
    the aggregate can exclude them.
    """
    try:
        result = subprocess.run(
            argv,
            cwd=str(cwd),
            capture_output=True,
            timeout=TIMEOUT_SECONDS,
            check=False,
        )
    except FileNotFoundError as exc:
        return {
            "error": f"FileNotFoundError: {exc}",
            "stdout_bytes": 0,
            "stderr_bytes": 0,
            "chars": 0,
            "tokens_approx": 0,
            "returncode": None,
        }
    except subprocess.TimeoutExpired:
        return {
            "error": f"TimeoutExpired after {TIMEOUT_SECONDS}s",
            "stdout_bytes": 0,
            "stderr_bytes": 0,
            "chars": 0,
            "tokens_approx": 0,
            "returncode": None,
        }
    except OSError as exc:
        return {
            "error": f"OSError: {exc}",
            "stdout_bytes": 0,
            "stderr_bytes": 0,
            "chars": 0,
            "tokens_approx": 0,
            "returncode": None,
        }
    stdout = result.stdout or b""
    stderr = result.stderr or b""
    chars = len(stdout) + len(stderr)
    return {
        "error": None,
        "stdout_bytes": len(stdout),
        "stderr_bytes": len(stderr),
        "chars": chars,
        "tokens_approx": chars // CHARS_PER_TOKEN,
        "returncode": result.returncode,
    }


def measure_one(entry: Dict[str, Any], cwd: Path, quiet: bool) -> Dict[str, Any]:
    """Measure one corpus entry."""
    entry_id = entry["id"]
    description = entry.get("description", "")
    raw = entry["raw"]
    rtk = entry["rtk"]

    raw_cmd = raw[0] if raw else None
    rtk_cmd = rtk[0] if rtk else None

    if raw_cmd and not shutil.which(raw_cmd):
        return {
            "id": entry_id,
            "description": description,
            "skipped": f"raw command '{raw_cmd}' not on PATH",
            "raw": None,
            "rtk": None,
            "delta": None,
        }
    if rtk_cmd and not shutil.which(rtk_cmd):
        return {
            "id": entry_id,
            "description": description,
            "skipped": f"rtk command '{rtk_cmd}' not on PATH",
            "raw": None,
            "rtk": None,
            "delta": None,
        }

    _log(f"  {entry_id}: running raw …", quiet)
    raw_result = _run_capture(raw, cwd)
    _log(f"  {entry_id}: running rtk …", quiet)
    rtk_result = _run_capture(rtk, cwd)

    if raw_result.get("error") or rtk_result.get("error"):
        return {
            "id": entry_id,
            "description": description,
            "skipped": (
                f"raw error: {raw_result.get('error')}; "
                f"rtk error: {rtk_result.get('error')}"
            ),
            "raw": raw_result,
            "rtk": rtk_result,
            "delta": None,
        }

    raw_chars = raw_result["chars"]
    rtk_chars = rtk_result["chars"]
    chars_saved = raw_chars - rtk_chars
    tokens_saved = chars_saved // CHARS_PER_TOKEN
    pct_saved = (
        (chars_saved / raw_chars * 100.0) if raw_chars > 0 else 0.0
    )

    return {
        "id": entry_id,
        "description": description,
        "skipped": None,
        "raw": raw_result,
        "rtk": rtk_result,
        "delta": {
            "chars_saved": chars_saved,
            "tokens_saved": tokens_saved,
            "pct_saved": round(pct_saved, 3),
        },
    }


def aggregate(results: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Compute the aggregate block from per-command results."""
    measured = [r for r in results if not r.get("skipped") and r.get("delta")]
    if not measured:
        return {
            "commands_measured": 0,
            "commands_skipped": len(results) - len(measured),
            "total_chars_saved": 0,
            "total_tokens_saved": 0,
            "median_pct_saved": 0.0,
            "tokens_saved_per_request": 0,
        }
    chars_saved_total = sum(r["delta"]["chars_saved"] for r in measured)
    tokens_saved_total = sum(r["delta"]["tokens_saved"] for r in measured)
    pcts = sorted(r["delta"]["pct_saved"] for r in measured)
    median_pct = pcts[len(pcts) // 2]
    # Per-request approximation: average tokens saved across the corpus.
    # A real agent invocation typically pipes ONE such command into the
    # context per request — so the per-request saving is the mean, not
    # the sum, of the corpus.
    per_request = tokens_saved_total // len(measured)
    return {
        "commands_measured": len(measured),
        "commands_skipped": len(results) - len(measured),
        "total_chars_saved": chars_saved_total,
        "total_tokens_saved": tokens_saved_total,
        "median_pct_saved": median_pct,
        "tokens_saved_per_request": per_request,
    }


def run(
    corpus_path: Path = DEFAULT_CORPUS,
    out_dir: Path = DEFAULT_OUT_DIR,
    quiet: bool = False,
) -> int:
    """Run the bench, write the report, return 0 on success."""
    if yaml is None:
        _log("PyYAML is required to load the rtk corpus.", quiet, err=True)
        return 1
    if not corpus_path.exists():
        _log(f"corpus not found: {corpus_path}", quiet, err=True)
        return 1

    try:
        corpus = yaml.safe_load(corpus_path.read_text()) or {}
    except yaml.YAMLError as exc:
        _log(f"failed to parse corpus YAML: {exc}", quiet, err=True)
        return 1

    entries = corpus.get("commands", []) or []
    if not entries:
        _log("corpus has no commands", quiet, err=True)
        return 1

    _log(f"rtk savings bench — {len(entries)} commands", quiet)
    results = [measure_one(entry, REPO_ROOT, quiet) for entry in entries]
    agg = aggregate(results)

    report = {
        "schema_version": 1,
        "schema_id": "rtk-v1",
        "generated_at": _utc_iso(),
        "corpus": {
            "id": corpus.get("corpus_id", "rtk-commands"),
            "path": str(corpus_path.relative_to(REPO_ROOT)),
            "command_count": len(entries),
        },
        "commands": results,
        "aggregate": agg,
        "notes": [
            f"Tokens approximated at {CHARS_PER_TOKEN} chars / token.",
            (
                "tokens_saved_per_request is the per-command mean across "
                "measured entries; assumes one CLI invocation per request."
            ),
            (
                "Skipped commands carry a 'skipped' reason and are excluded "
                "from the aggregate."
            ),
        ],
    }

    out_dir.mkdir(parents=True, exist_ok=True)
    stamp = report["generated_at"].replace(":", "-")
    timestamped = out_dir / f"{stamp}.json"
    latest = out_dir / "latest.json"
    payload = json.dumps(report, indent=2, ensure_ascii=False) + "\n"
    timestamped.write_text(payload)
    latest.write_text(payload)

    _log(
        (
            f"rtk savings: {agg['commands_measured']}/{len(entries)} measured, "
            f"median {agg['median_pct_saved']:.1f}% saved, "
            f"{agg['tokens_saved_per_request']} tokens/request "
            f"(report: {timestamped.relative_to(REPO_ROOT)})"
        ),
        quiet=False,  # always print the headline (one-line summary)
    )
    return 0


def parse_args(argv: List[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Measure rtk's token savings on a fixed corpus of verbose CLI "
            "invocations."
        )
    )
    parser.add_argument(
        "--corpus",
        type=Path,
        default=DEFAULT_CORPUS,
        help="Path to the corpus YAML (default: %(default)s)",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=DEFAULT_OUT_DIR,
        help="Output directory for reports (default: %(default)s)",
    )
    parser.add_argument(
        "--quiet",
        action="store_true",
        help="Suppress per-step progress; print one-line summary only.",
    )
    return parser.parse_args(argv)


def main(argv: List[str] | None = None) -> int:
    args = parse_args(argv if argv is not None else sys.argv[1:])
    return run(corpus_path=args.corpus, out_dir=args.out, quiet=args.quiet)


if __name__ == "__main__":
    raise SystemExit(main())
