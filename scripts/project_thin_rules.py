#!/usr/bin/env python3
"""Thin-projection of the rule layer (lean-initial-context build-out, Phase 3.1).

The dominant always-on cost is rule BODIES (~58k GPT tok; kernel only ~6.5k).
0B.6 verdict: demote every non-kernel rule body to a progressive-disclosure
pointer the agent resolves on trigger-match (the one mechanism 0B.5 confirmed
works for the primary tool — like skills). The kernel stays full-bodied.

A **thin** rule entry keeps the matching signal (frontmatter `description` +
`triggers`) so the router still selects it, and replaces the body with a
one-line pointer to the full text. The agent loads the body on match.

This module is the mechanism + a measurement harness. It writes to a target
dir of your choosing — it never overwrites the live `.claude/` / `.augment/`
projections. condense.py reads `lean_projection.mode` (default `eager-all`)
to decide whether the real generate-tools path calls in here; until that flag
is flipped + live-A/B-validated, the default projection is unchanged.

Usage:
    python3 scripts/project_thin_rules.py --measure          # measure delta, no write
    python3 scripts/project_thin_rules.py --out <dir>        # write thin rules to <dir>
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "scripts"))
from _lib import token_count  # noqa: E402

RULES_SOURCE = REPO_ROOT / ".agent-src" / "rules"
ROUTER = REPO_ROOT / "dist" / "router.json"


def kernel_ids() -> set[str]:
    """The always-full-bodied set — authoritative kernel list from the router."""
    return set(json.loads(ROUTER.read_text(encoding="utf-8")).get("kernel", []))


def split_frontmatter(text: str) -> tuple[str, str]:
    """Return (frontmatter_including_fences, body). Empty fm if none."""
    if text.startswith("---\n"):
        end = text.find("\n---\n", 4)
        if end != -1:
            return text[: end + 5], text[end + 5 :]
    return "", text


def _description(fm: str) -> str:
    m = re.search(r'^description:\s*"?(.+?)"?\s*$', fm, re.MULTILINE)
    return m.group(1).strip() if m else ""


def thin_entry(rule_id: str, text: str) -> str:
    """Build the progressive-disclosure pointer for a non-kernel rule.

    Keeps the frontmatter verbatim (its `triggers:` are the match signal the
    router compiles from, and the `description` is the always-on hint) and
    replaces the rule body with a one-line pointer to the full source.
    """
    fm, _body = split_frontmatter(text)
    desc = _description(fm)
    title = rule_id.replace("-", " ").title()
    pointer = (
        f"# {title}\n\n"
        f"> **Routed rule — body loaded on trigger-match.** "
        f"{desc}\n\n"
        f"Full rule text: [`{rule_id}`](../../.agent-src.uncondensed/rules/{rule_id}.md). "
        f"The router fires this rule on its `triggers:` (above); load the body then.\n"
    )
    # Frontmatter stays so the matching signal and router compile are intact.
    return (fm + pointer) if fm else pointer


def build_thin(rules_dir: Path = RULES_SOURCE) -> dict[str, str]:
    """Map {filename: thin_or_full_text} for every rule. Kernel stays full."""
    kernel = kernel_ids()
    out: dict[str, str] = {}
    for p in sorted(rules_dir.glob("*.md")):
        text = p.read_text(encoding="utf-8")
        out[p.name] = text if p.stem in kernel else thin_entry(p.stem, text)
    return out


def measure(rules_dir: Path = RULES_SOURCE) -> dict:
    """Eager vs thin token footprint for the rule layer."""
    kernel = kernel_ids()
    eager_blob = "".join(
        p.read_text(encoding="utf-8") for p in sorted(rules_dir.glob("*.md"))
    )
    thin_blob = "".join(build_thin(rules_dir).values())
    eager = token_count.measure(eager_blob)
    thin = token_count.measure(thin_blob)
    n = len(list(rules_dir.glob("*.md")))
    return {
        "rules_total": n,
        "kernel_full": len(kernel & {p.stem for p in rules_dir.glob("*.md")}),
        "non_kernel_thinned": n - len(kernel & {p.stem for p in rules_dir.glob("*.md")}),
        "eager_gpt": eager["tokens_gpt"],
        "thin_gpt": thin["tokens_gpt"],
        "saved_gpt": eager["tokens_gpt"] - thin["tokens_gpt"],
        "saved_pct": round(
            100 * (eager["tokens_gpt"] - thin["tokens_gpt"]) / eager["tokens_gpt"], 1
        )
        if eager["tokens_gpt"]
        else 0.0,
        "eager_chars": eager["chars"],
        "thin_chars": thin["chars"],
        "token_method": token_count.method_note(),
    }


def write_thin(out_dir: Path, rules_dir: Path = RULES_SOURCE) -> int:
    out_dir.mkdir(parents=True, exist_ok=True)
    files = build_thin(rules_dir)
    for name, text in files.items():
        (out_dir / name).write_text(text, encoding="utf-8")
    return len(files)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--measure", action="store_true", help="print the eager-vs-thin token delta")
    ap.add_argument("--out", type=Path, help="write thin rule files to this dir")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args(argv)

    if args.out:
        n = write_thin(args.out)
        print(f"wrote {n} thin rule files → {args.out}")
        return 0

    m = measure()
    if args.json:
        print(json.dumps(m, indent=2, sort_keys=True))
    else:
        print(f"Rule-layer thin projection (kernel full-bodied + {m['non_kernel_thinned']} non-kernel pointers):")
        print(f"  eager: {m['eager_gpt']:>6} GPT tok ({m['eager_chars']:,} chars)")
        print(f"  thin:  {m['thin_gpt']:>6} GPT tok ({m['thin_chars']:,} chars)")
        print(f"  saved: {m['saved_gpt']:>6} GPT tok  ({m['saved_pct']}% of the rule layer)")
        print(f"  method: {m['token_method']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
