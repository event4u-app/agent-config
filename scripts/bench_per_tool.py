#!/usr/bin/env python3
"""Per-tool projection-fidelity bench — step-4 Phase 4.

Re-runs the keyword-overlap selection scorer against each projected
tool surface and computes:

    fidelity(tool) = selection_accuracy(tool) / selection_accuracy(reference)

Reference = Augment projection (most complete per roadmap). Threshold
for "fit for purpose" is >= 0.85.

Surfaces:
- `.augment/skills/`   skill projection      automated  (reference)
- `.claude/skills/`    skill projection      automated
- `.cursor/rules/`     rules-only            not_applicable (no skill projection)
- `.windsurfrules`     single concatenated   not_applicable
- `.clinerules/`       rules-only            not_applicable

Usage:
    python3 scripts/bench_per_tool.py --corpus dev
    python3 scripts/bench_per_tool.py --corpus dev --json
    python3 scripts/bench_per_tool.py --corpus dev --threshold 0.85
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import sys
from pathlib import Path

try:
    import yaml
except ImportError:
    sys.stderr.write("error: PyYAML required (pip install pyyaml)\n")
    sys.exit(2)

# Reuse tokenization + ranking from the reference runner so the only
# axis that changes between tools is the skill catalogue on disk.
from bench_runner import rank_skills  # type: ignore  # noqa: E402

REPO_ROOT = Path(__file__).resolve().parent.parent
CORPUS_DIR = REPO_ROOT / "tests" / "eval"
REPORTS_DIR = REPO_ROOT / "bench" / "reports"

# tool_id -> (skills_root, kind). kind = "skills" | "rules_only" | "single_file".
SURFACES: dict[str, tuple[Path, str]] = {
    "augment": (REPO_ROOT / ".augment" / "skills", "skills"),
    "claude":  (REPO_ROOT / ".claude" / "skills",  "skills"),
    "cursor":  (REPO_ROOT / ".cursor" / "rules",   "rules_only"),
    "cline":   (REPO_ROOT / ".clinerules",         "rules_only"),
    "windsurf":(REPO_ROOT / ".windsurfrules",      "single_file"),
}

REFERENCE_TOOL = "augment"


def load_descriptions(root: Path) -> dict[str, str]:
    """Return {skill_name: 'name + description'} for SKILL.md files under root."""
    out: dict[str, str] = {}
    if not root.is_dir():
        return out
    for skill_dir in sorted(root.iterdir()):
        skill_md = skill_dir / "SKILL.md"
        if not skill_md.is_file():
            continue
        text = skill_md.read_text(encoding="utf-8")
        m = re.search(r"^---\s*\n(.*?)\n---\s*\n", text, re.DOTALL)
        if not m:
            continue
        try:
            fm = yaml.safe_load(m.group(1)) or {}
        except yaml.YAMLError:
            continue
        desc = fm.get("description") or ""
        name = fm.get("name") or skill_dir.name
        if desc:
            out[name] = f"{name} {desc}"
    return out


def score_corpus(skills: dict[str, str], prompts: list[dict], top_k: int) -> dict:
    hits = 0
    per_prompt = []
    for p in prompts:
        ranked = rank_skills(p["prompt"], skills, top_k)
        expected = set(p.get("expected_skills", []))
        hit = bool(expected & set(ranked))
        if hit:
            hits += 1
        per_prompt.append({"id": p["id"], "expected": sorted(expected),
                           "ranked": ranked, "hit": hit})
    n = len(prompts)
    return {
        "prompts_total": n,
        "prompts_hit": hits,
        "selection_accuracy": round(hits / n, 4) if n else 0.0,
        "skill_count": len(skills),
        "per_prompt": per_prompt,
    }


def evaluate(corpus_path: Path, top_k: int, threshold: float) -> dict:
    corpus = yaml.safe_load(corpus_path.read_text(encoding="utf-8"))
    prompts = corpus["prompts"]
    results: dict[str, dict] = {}

    for tool, (root, kind) in SURFACES.items():
        if kind != "skills":
            results[tool] = {
                "status": "not_applicable",
                "reason": f"surface is {kind}; no SKILL.md projection",
                "path": str(root.relative_to(REPO_ROOT)),
            }
            continue
        skills = load_descriptions(root)
        if not skills:
            results[tool] = {"status": "error", "reason": "no skills found",
                             "path": str(root.relative_to(REPO_ROOT))}
            continue
        scored = score_corpus(skills, prompts, top_k)
        scored["status"] = "ok"
        scored["path"] = str(root.relative_to(REPO_ROOT))
        results[tool] = scored

    ref = results.get(REFERENCE_TOOL, {})
    ref_acc = ref.get("selection_accuracy", 0.0) if ref.get("status") == "ok" else 0.0
    below = []
    for tool, r in results.items():
        if r.get("status") != "ok":
            continue
        fidelity = (r["selection_accuracy"] / ref_acc) if ref_acc else 0.0
        r["fidelity"] = round(fidelity, 4)
        r["passed_threshold"] = fidelity >= threshold
        if tool != REFERENCE_TOOL and not r["passed_threshold"]:
            below.append(tool)

    return {
        "schema": "projection-fidelity-v1",
        "generated_at": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "corpus_id": corpus["corpus_id"],
        "top_k": top_k,
        "threshold": threshold,
        "reference_tool": REFERENCE_TOOL,
        "reference_accuracy": ref_acc,
        "tools": results,
        "below_threshold": below,
    }


def render_markdown(summary: dict) -> str:
    lines = [
        f"# Projection fidelity — {summary['corpus_id']}",
        "",
        f"_Generated {summary['generated_at']} · top-K={summary['top_k']} · "
        f"threshold={summary['threshold']:.2f} · reference=`{summary['reference_tool']}`_",
        "",
        "| tool | status | skills | accuracy | fidelity | pass |",
        "|---|---|---:|---:|---:|---|",
    ]
    for tool, r in summary["tools"].items():
        status = r.get("status", "?")
        if status != "ok":
            lines.append(f"| `{tool}` | {status} | — | — | — | — |")
            continue
        lines.append(
            f"| `{tool}` | ok | {r['skill_count']} | "
            f"{r['selection_accuracy']:.2%} | {r['fidelity']:.2f} | "
            f"{'✅' if r['passed_threshold'] else '❌'} |"
        )
    if summary["below_threshold"]:
        lines += ["", f"**Below threshold:** {', '.join(summary['below_threshold'])} "
                  f"→ inspect `scripts/_lib/generate_tools.py` projection mapping."]
    else:
        lines += ["", "**All projections fit-for-purpose** (≥ threshold)."]
    return "\n".join(lines) + "\n"


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--corpus", default="dev")
    ap.add_argument("--top-k", type=int, default=3)
    ap.add_argument("--threshold", type=float, default=0.85)
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--write-report", action="store_true",
                    help="emit bench/reports/<ts>-<corpus>-projection.{json,md}")
    args = ap.parse_args(argv)

    corpus_path = CORPUS_DIR / f"corpus-{args.corpus}.yaml"
    if not corpus_path.is_file():
        sys.stderr.write(f"error: corpus not found: {corpus_path}\n")
        return 2

    summary = evaluate(corpus_path, args.top_k, args.threshold)

    if args.write_report:
        REPORTS_DIR.mkdir(parents=True, exist_ok=True)
        stamp = summary["generated_at"].replace(":", "-")
        base = REPORTS_DIR / f"{stamp}-{args.corpus}-projection"
        base.with_suffix(".json").write_text(json.dumps(summary, indent=2) + "\n")
        base.with_suffix(".md").write_text(render_markdown(summary))
        sys.stderr.write(f"wrote {base}.json + {base}.md\n")

    if args.json:
        print(json.dumps(summary, indent=2))
    else:
        print(render_markdown(summary))

    return 1 if summary["below_threshold"] else 0


if __name__ == "__main__":
    sys.exit(main())

