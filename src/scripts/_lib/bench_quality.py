# Quality probe for `scripts/bench_run.py` — step-4 Phase 2 Step 3.
#
# Each prompt declares `rubric.must_include` / `must_not_include` or a
# `quality_assertion` regex (per docs/contracts/benchmark-corpus-spec.md).
# When an agent-output file is passed via --agent-output, we score the
# assertions against actual output. Without it, we emit `not_collected`
# per docs/contracts/benchmark-report-schema.md § quality invariants.
"""Quality probe helper for the bench runner."""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any


def _eval_rubric(rubric: dict[str, Any], output: str) -> tuple[bool, str]:
    """Apply rubric.must_include / must_not_include / length_words to output."""
    for phrase in rubric.get("must_include") or []:
        if phrase not in output:
            return False, f"missing: {phrase!r}"
    for phrase in rubric.get("must_not_include") or []:
        if phrase in output:
            return False, f"forbidden: {phrase!r}"
    bounds = rubric.get("length_words") or {}
    if bounds:
        words = len(output.split())
        lo, hi = bounds.get("min", 0), bounds.get("max", 0)
        if lo and words < lo:
            return False, f"length<{lo}: {words}"
        if hi and words > hi:
            return False, f"length>{hi}: {words}"
    return True, "ok"


def _eval_regex(pattern: str, output: str) -> tuple[bool, str]:
    try:
        compiled = re.compile(pattern, re.MULTILINE)
    except re.error as exc:
        return False, f"bad_regex: {exc}"
    return (bool(compiled.search(output)), "ok" if compiled.search(output) else "no_match")


def _format_rubric(rubric: dict[str, Any]) -> str:
    parts = []
    if rubric.get("must_include"):
        parts.append(f"must_include={rubric['must_include']}")
    if rubric.get("must_not_include"):
        parts.append(f"must_not_include={rubric['must_not_include']}")
    if rubric.get("length_words"):
        parts.append(f"length_words={rubric['length_words']}")
    return " ".join(parts) or "<empty>"


def score_corpus(
    prompts: list[dict[str, Any]],
    agent_output_path: Path | None,
) -> dict[str, Any]:
    """Return the `quality` block per benchmark-report-schema § quality."""
    declared = [
        p for p in prompts
        if (p.get("rubric") or {}).get("must_include")
        or (p.get("rubric") or {}).get("must_not_include")
        or (p.get("rubric") or {}).get("length_words")
        or p.get("quality_assertion")
    ]
    total_declared = len(declared)

    if agent_output_path is None or not agent_output_path.is_file():
        return {
            "source": "not_collected",
            "prompts_with_assertion": total_declared,
            "prompts_passing": 0,
            "quality_score": 0.0,
            "per_prompt": [
                {
                    "id": p["id"],
                    "assertion": p.get("quality_assertion") or _format_rubric(p.get("rubric") or {}),
                    "assertion_kind": "quality_assertion" if p.get("quality_assertion") else "rubric",
                    "passed": "not_collected",
                }
                for p in declared
            ],
        }

    outputs = json.loads(agent_output_path.read_text(encoding="utf-8"))
    per_prompt: list[dict[str, Any]] = []
    passing = 0
    for p in declared:
        pid = p["id"]
        output_text = str(outputs.get(pid, ""))
        rubric = p.get("rubric") or {}
        regex = p.get("quality_assertion")
        if regex:
            ok, _why = _eval_regex(regex, output_text)
            kind = "quality_assertion"
            assertion = regex
        else:
            ok, _why = _eval_rubric(rubric, output_text)
            kind = "rubric"
            assertion = _format_rubric(rubric)
        per_prompt.append({
            "id": pid,
            "assertion": assertion,
            "assertion_kind": kind,
            "passed": ok,
        })
        if ok:
            passing += 1

    score = round(passing / total_declared, 4) if total_declared else 0.0
    return {
        "source": str(agent_output_path),
        "prompts_with_assertion": total_declared,
        "prompts_passing": passing,
        "quality_score": score,
        "per_prompt": per_prompt,
    }
