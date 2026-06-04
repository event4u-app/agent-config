#!/usr/bin/env python3
"""Track A — behavioural eval runner for the package-impact A/B bench.

Phase 3 Step 2 of `agents/roadmaps/road-to-package-impact-benchmark.md`.

For each prompt in `internal/bench/corpora/ab-tracka.yaml`, check whether
the expected rule/skill surface is present in the target clone. Present +
keyword-grep passing → trigger fires. Absent → trigger does not fire.

By construction the `without` clone has no agent-config surface — every
expected_target file is missing — so its accuracy floor is 0%. The `with`
clone has the surface installed and should score near 100%. The delta is
the lift attributable to the package.

This runner does NOT invoke `claude` — Track A measures **surface
availability**, the necessary precondition for the rule-router to fire.
Track B (Phase 4) measures actual end-to-end task behaviour.

Output schema (consumed by bench_ab_diff.py):

    results:
      trigger_accuracy: 0.0 .. 1.0          # share of prompts that scored 1
      false_positives: int                  # `without` matches (expected = 0)
      per_rule_accuracy:                    # per-target hit map
        <expected_target>: {with: 0|1, without: 0|1}
      per_prompt:                           # full audit trail
        - id, expected_target, with_score, without_score, notes
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(REPO_ROOT / "src" / "scripts"))

from _lib import bench_ab_cache  # type: ignore[import-not-found]  # noqa: E402

CORPUS_PATH = REPO_ROOT / "internal" / "bench" / "corpora" / "ab-tracka.yaml"
CLONES_DIR = REPO_ROOT / "internal" / "bench" / "ab" / "clones"
REPORTS_DIR = REPO_ROOT / "internal" / "bench" / "reports" / "ab"

try:
    import yaml
except ImportError:
    sys.stderr.write("bench_ab_tracka_run: PyYAML required (pip install pyyaml)\n")
    raise SystemExit(2)


def utc_stamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H-%M-%SZ")


def load_corpus() -> dict:
    return yaml.safe_load(CORPUS_PATH.read_text())


def score_prompt(prompt: dict, clone_root: Path) -> tuple[int, str]:
    """Return (score, reason). score=1 when the surface is present AND every keyword hits."""
    target_rel = prompt.get("expected_target")
    if not target_rel:
        return 0, "no expected_target"
    target = clone_root / target_rel
    if not target.exists():
        return 0, f"missing: {target_rel}"
    keywords = prompt.get("expected_keywords") or []
    if not isinstance(keywords, list) or not keywords:
        # Surface presence alone counts when no keywords specified.
        return 1, "present (no keywords)"
    body = target.read_text(errors="replace")
    missing = [kw for kw in keywords if not re.search(re.escape(str(kw)), body, re.IGNORECASE)]
    if missing:
        return 0, f"keywords missing: {','.join(missing)}"
    return 1, "present (keywords matched)"


def run_variant(variant: str, prompts: list[dict]) -> dict:
    clone_root = CLONES_DIR / variant
    if not clone_root.exists():
        raise RuntimeError(
            f"clone missing at {clone_root} — run scripts/bench_ab_clone.py first"
        )
    per_prompt = []
    per_target: dict[str, int] = {}
    matched = 0
    for prompt in prompts:
        score, reason = score_prompt(prompt, clone_root)
        per_prompt.append(
            {
                "id": prompt.get("id"),
                "expected_target": prompt.get("expected_target"),
                "score": score,
                "reason": reason,
            }
        )
        per_target[prompt.get("expected_target", "")] = max(
            per_target.get(prompt.get("expected_target", ""), 0), score
        )
        matched += score
    total = len(prompts) or 1
    return {
        "trigger_accuracy": round(matched / total, 4),
        "matched": matched,
        "total": total,
        "per_target_present": per_target,
        "per_prompt": per_prompt,
    }


def integrity_check(without_results: dict) -> tuple[bool, str]:
    """Track A safety: `without` MUST score 0 — there is no agent-config surface
    to match. A non-zero score means the integrity boundary leaked and the run
    is invalid.
    """
    matched = without_results.get("matched", 0)
    if matched != 0:
        # Identify which prompts leaked
        leaked = [p["id"] for p in without_results.get("per_prompt", []) if p.get("score")]
        return False, f"`without` scored {matched} (expected 0); leaked: {','.join(leaked)}"
    return True, "without=0 (clean)"


def write_report(variant: str, results: dict, duration: float, *, integrity_ok: bool) -> Path:
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    cache_key = bench_ab_cache.CacheKey(
        corpus_hash=bench_ab_cache.hash_file(CORPUS_PATH),
        claude_cli_version=bench_ab_cache.claude_cli_version(),
        target_shape_hash=bench_ab_cache.target_shape_hash(),
    )
    stamp = utc_stamp()
    payload = {
        "schema": "ab-bench/0.1",
        "stamp": stamp,
        "variant": variant,
        "corpus": "ab-tracka",
        "cache_key": cache_key.to_dict(),
        "duration_seconds": round(duration, 3),
        "integrity_ok": integrity_ok,
        "results": results,
    }
    path = REPORTS_DIR / f"{stamp}-ab-tracka-{variant}.json"
    path.write_text(json.dumps(payload, indent=2) + "\n")
    md = path.with_suffix(".md")
    md.write_text(
        f"# Track A · {variant}\n\n"
        f"- Stamp: `{stamp}`\n"
        f"- Trigger accuracy: **{results.get('trigger_accuracy', 0) * 100:.1f}%**"
        f" ({results.get('matched', 0)}/{results.get('total', 0)})\n"
        f"- Integrity OK: `{integrity_ok}`\n"
    )
    return path


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run Track A behavioural eval per variant.")
    parser.add_argument(
        "--variant",
        choices=("with", "without", "both"),
        default="both",
        help="Which variant to run (default: both).",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv if argv is not None else sys.argv[1:])
    if not CORPUS_PATH.exists():
        sys.stderr.write(f"bench_ab_tracka_run: corpus missing at {CORPUS_PATH}\n")
        return 1
    data = load_corpus()
    prompts = data.get("prompts") or []
    if not prompts:
        sys.stderr.write("bench_ab_tracka_run: corpus has no prompts\n")
        return 1

    variants = ("with", "without") if args.variant == "both" else (args.variant,)
    integrity_ok = True
    for variant in variants:
        started = time.monotonic()
        results = run_variant(variant, prompts)
        duration = time.monotonic() - started
        if variant == "without":
            ok, reason = integrity_check(results)
            integrity_ok = ok
            if not ok:
                sys.stderr.write(f"bench_ab_tracka_run: integrity failure — {reason}\n")
        path = write_report(variant, results, duration, integrity_ok=integrity_ok)
        sys.stdout.write(
            f"bench_ab_tracka_run: {variant} → "
            f"{results['trigger_accuracy'] * 100:.1f}% "
            f"({results['matched']}/{results['total']}) — {path.relative_to(REPO_ROOT)}\n"
        )
    return 0 if integrity_ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
