#!/usr/bin/env python3
"""Generate the named cookbook (road-to-competitive-borrow P1.4).

Renders ``docs/cookbook.md`` — "10 things you can do in a minute" — from
``src/flows/cookbook.yaml`` (curated recipe seed) plus the four validated
``src/flows/<flow>.yaml`` user-work flows.

**Anti-cargo-cult guard.** Every command and skill ref is validated via
``resolve_logical`` (the same primitive ``lint_flows.py`` uses). Generation
FAILS if any recipe references a command or skill that does not exist — the
failure mode where a cookbook lists recipes pointing at tools with no real
backing. This is the lesson the roadmap names against Source C.

Output (deterministic — no timestamp, so ``--check`` is stable):
  - ``docs/cookbook.md``

Usage:
    python3 scripts/generate_cookbook.py
    python3 scripts/generate_cookbook.py --check   # fail if out of date
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import yaml  # type: ignore

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib.agent_src import resolve_logical  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
COOKBOOK_SEED = ROOT / "src" / "flows" / "cookbook.yaml"
FLOWS_DIR = ROOT / "src" / "flows"
USER_WORK_FLOWS = ["discovery", "implementation", "review", "delivery"]
OUT = ROOT / "docs" / "cookbook.md"


class BadRecipe(Exception):
    pass


def _command_exists(ref: str) -> bool:
    return resolve_logical(f"commands/{ref}.md") is not None


def _invocation(ref: str) -> str:
    """Colon-canonical invocation form (ADR-003): `cluster/sub` -> `/cluster:sub`.

    Refs are validated as file paths (`commands/<ref>.md`) but rendered as the
    canonical `/<cluster>:<sub>` invocation. Refs are at most one segment deep
    (sub-sub invocation is forbidden), so only the first `/` becomes `:`.
    """
    return "/" + ref.replace("/", ":", 1)


def _skill_exists(slug: str) -> bool:
    return resolve_logical(f"skills/{slug}/SKILL.md") is not None


def validate_refs(label: str, commands: list[str], skills: list[str]) -> None:
    for c in commands:
        if not _command_exists(c):
            raise BadRecipe(f"recipe '{label}' references non-existent command `{c}`")
    for s in skills:
        if not _skill_exists(s):
            raise BadRecipe(f"recipe '{label}' references non-existent skill `{s}`")


def load_seed() -> list[dict]:
    data = yaml.safe_load(COOKBOOK_SEED.read_text(encoding="utf-8")) or {}
    return data.get("recipes", [])


def load_flow(flow: str) -> dict:
    return yaml.safe_load((FLOWS_DIR / f"{flow}.yaml").read_text(encoding="utf-8")) or {}


def render() -> str:
    seed = load_seed()
    flows = {f: load_flow(f) for f in USER_WORK_FLOWS}

    # Validate every ref BEFORE rendering — generation fails on any bad recipe.
    for r in seed:
        validate_refs(r["title"], r.get("commands", []), r.get("skills", []))
    for fid, f in flows.items():
        validate_refs(f"flow:{fid}", f.get("default_path", []), f.get("skills", []))

    lines = [
        "# Cookbook — things you can do in a minute",
        "",
        "> **Generated** by `scripts/generate_cookbook.py` from "
        "`src/flows/cookbook.yaml` + `src/flows/<flow>.yaml` — do NOT hand-edit.",
        "> Every command and skill below is validated to exist at generation "
        "time; a recipe naming a missing command fails the build.",
        "",
        "Each recipe is a short command sequence. Run the commands in order; the "
        "listed skills are the capabilities they compose.",
        "",
        "## Named recipes",
        "",
    ]
    for r in seed:
        cmds = " → ".join(f"`{_invocation(c)}`" for c in r.get("commands", []))
        sk = ", ".join(f"`{s}`" for s in r.get("skills", []))
        lines.append(f"### {r['title']}")
        lines.append("")
        lines.append(f"*{r['when']}*")
        lines.append("")
        lines.append(f"- **Commands:** {cmds}")
        if sk:
            lines.append(f"- **Skills:** {sk}")
        lines.append("")

    lines += [
        "## The four work flows",
        "",
        "Broader than a single recipe — the end-to-end shapes most work follows.",
        "",
    ]
    for fid in USER_WORK_FLOWS:
        f = flows[fid]
        path = " → ".join(f"`{_invocation(c)}`" for c in f.get("default_path", []))
        sk = ", ".join(f"`{s}`" for s in f.get("skills", []))
        summary = " ".join((f.get("summary") or "").split())
        lines.append(f"### {f.get('title', fid)} flow")
        lines.append("")
        if summary:
            lines.append(summary)
            lines.append("")
        lines.append(f"- **Path:** {path}")
        if sk:
            lines.append(f"- **Skills:** {sk}")
        lines.append("")

    return "\n".join(lines).rstrip() + "\n"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--check", action="store_true", help="fail if docs/cookbook.md is out of date")
    ap.add_argument("--quiet", action="store_true")
    args = ap.parse_args()

    try:
        content = render()
    except BadRecipe as e:
        print(f"❌  generate_cookbook: {e}", file=sys.stderr)
        return 1

    if args.check:
        current = OUT.read_text(encoding="utf-8") if OUT.is_file() else ""
        if current != content:
            print(
                "generate_cookbook: docs/cookbook.md is stale — run "
                "`python3 scripts/generate_cookbook.py`",
                file=sys.stderr,
            )
            return 1
        if not args.quiet:
            print("generate_cookbook: OK — docs/cookbook.md up to date")
        return 0

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(content, encoding="utf-8")
    if not args.quiet:
        print(f"generate_cookbook: wrote {OUT.relative_to(ROOT)} "
              f"({len(load_seed())} recipes + {len(USER_WORK_FLOWS)} flows)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
