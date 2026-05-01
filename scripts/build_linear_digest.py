#!/usr/bin/env python3
"""build_linear_digest.py — build the Linear AI rules digest.

Concatenates a curated set of cloud-safe rules from
`.agent-src.uncompressed/rules/` into three Markdown files under
`dist/linear/`:

  workspace.md  — universal coding posture (18 rules)
  team.md       — framework-specific (4 rules; paste only where stack matches)
  personal.md   — empty stub for individual preferences

Per-rule inclusion + mode is the source of truth in
`agents/contexts/linear-ai-rules-inclusion.md`. This script encodes the
same lists so a drift between the two surfaces is caught by the digest
audit (Phase 3 Step 4) — the markdown doc is the human-readable spec,
this script is the executable.

Transformations applied to every included rule:

  1. Strip YAML frontmatter.
  2. Demote the rule's H1 to H2 (H1 stays for the digest's own title).
  3. Replace `[text](path.md...)` links with plain `text` — paths do
     not resolve outside the repo. External `http(s)` links are kept.
  4. For rules tagged ``degraded`` in DEGRADE_RULES, strip the named
     H2/H3 sections (cloud-irrelevant content like `.agent-settings.yml`
     references, rtk Iron Law, English-`.md`-files clause, etc.).

Outputs and exit code:

  - Writes to dist/linear/{workspace,team,personal}.md
  - Stdout: per-digest size summary (chars, rules, sections stripped)
  - Exit 0 on success
  - Exit 2 if any digest exceeds --max-bytes (Phase 3 Step 4 budget gate)
  - Exit 3 if a referenced rule file is missing
"""
from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
# Compressed source is the shipped form — denser, sharper section
# structure; better fit for a guidance field than the verbose authoring
# layer. The inclusion list at agents/contexts/linear-ai-rules-inclusion.md
# remains the human-readable spec.
SOURCE = ROOT / ".agent-src" / "rules"
OUT_DIR = ROOT / "dist" / "linear"

# Linear does not publish a hard cap on agent-guidance fields. 100 KB
# is generous for every observed agent surface (Linear Agent, Codegen,
# Charlie); tighten via --max-bytes once the actual cap is researched
# (Open Question #1 in road-to-universal-distribution.md).
DEFAULT_MAX_BYTES = 100_000


@dataclass
class RuleEntry:
    name: str
    mode: str = "as-is"           # "as-is" | "degraded"
    strip_sections: list[str] = field(default_factory=list)


# Workspace digest — universal coding posture. Maps 1:1 to the
# "Workspace digest" table in agents/contexts/linear-ai-rules-inclusion.md.
WORKSPACE: list[RuleEntry] = [
    RuleEntry("ask-when-uncertain"),
    RuleEntry("commit-conventions"),
    RuleEntry("context-hygiene", "degraded",
              strip_sections=["Augment-specific: Ignored Skills Recovery"]),
    RuleEntry("direct-answers"),
    RuleEntry("markdown-safe-codeblocks"),
    RuleEntry("minimal-safe-diff"),
    RuleEntry("reviewer-awareness"),
    RuleEntry("scope-control"),
    RuleEntry("security-sensitive-stop"),
    RuleEntry("think-before-action", "degraded",
              strip_sections=["Consult memory before editing"]),
    RuleEntry("verify-before-complete"),
    RuleEntry("cli-output-handling", "degraded",
              strip_sections=["Iron Law — rtk first, tail/grep fallback"]),
    RuleEntry("downstream-changes"),
    RuleEntry("improve-before-implement"),
    RuleEntry("language-and-tone", "degraded",
              strip_sections=["`.md` files are ALWAYS English — no exceptions"]),
    RuleEntry("missing-tool-handling"),
    RuleEntry("token-efficiency"),
    RuleEntry("user-interaction"),
]

# Team digest — framework-specific. Stack already named in each rule's
# trigger line; no per-rule stripping required.
TEAM: list[RuleEntry] = [
    RuleEntry("docker-commands"),
    RuleEntry("laravel-translations"),
    RuleEntry("e2e-testing"),
    RuleEntry("php-coding"),
]

# Personal digest is empty by default — just a stub.
PERSONAL: list[RuleEntry] = []

FRONTMATTER_RE = re.compile(r"^---\n.*?\n---\n", re.DOTALL)
LINK_RE = re.compile(r"\[([^\]]+)\]\((?!https?://)[^)]+\)")
H1_RE = re.compile(r"^# ", re.MULTILINE)


def strip_frontmatter(text: str) -> str:
    return FRONTMATTER_RE.sub("", text, count=1).lstrip()


def demote_h1(text: str) -> str:
    """Promote rule H1 to H2 so the digest H1 stays the only top-level."""
    return H1_RE.sub("## ", text, count=1)


def normalize_links(text: str) -> str:
    """Replace internal markdown links with their plain anchor text.

    Internal = relative path or repo-rooted path. External http(s)
    links are preserved verbatim.
    """
    return LINK_RE.sub(r"\1", text)


def strip_section(text: str, section_title: str) -> tuple[str, bool]:
    """Strip an H2/H3 section by exact title match (without trailing comments)."""
    pattern = re.compile(
        rf"^(#{{2,3}})\s+{re.escape(section_title)}\s*\n.*?(?=^#{{1,3}}\s|\Z)",
        re.DOTALL | re.MULTILINE,
    )
    new_text, count = pattern.subn("", text)
    return new_text, count > 0


def render_rule(entry: RuleEntry) -> tuple[str, list[str]]:
    """Render one rule as a digest section.

    Returns (markdown, missing_sections). missing_sections is non-empty
    when a strip_sections entry did not match — a likely drift signal
    between this script and the source rule.
    """
    path = SOURCE / f"{entry.name}.md"
    if not path.is_file():
        raise FileNotFoundError(f"Rule source missing: {path}")

    text = path.read_text(encoding="utf-8")
    text = strip_frontmatter(text)
    text = demote_h1(text)
    text = normalize_links(text)

    missing: list[str] = []
    if entry.mode == "degraded":
        for section in entry.strip_sections:
            text, found = strip_section(text, section)
            if not found:
                missing.append(section)

    # Collapse any double-blank-lines created by stripping.
    text = re.sub(r"\n{3,}", "\n\n", text).rstrip() + "\n"
    return text, missing


def render_digest(layer: str, entries: list[RuleEntry]) -> tuple[str, dict]:
    parts: list[str] = []
    parts.append(f"# event4u/agent-config — Linear AI {layer.title()} Digest\n")
    parts.append(
        "> Auto-generated by `scripts/build_linear_digest.py` from "
        "`.agent-src/rules/` (compressed source) plus the inclusion list "
        "at `agents/contexts/linear-ai-rules-inclusion.md`. Do not edit "
        "this file by hand — re-run `task build-linear-digest` to "
        "regenerate.\n"
    )
    if layer == "personal":
        parts.append(
            "\nPersonal guidance is intentionally empty — paste your own "
            "preferences (response language overrides, IDE shortcuts, naming "
            "conventions) below this line.\n"
        )
        return "".join(parts), {"layer": layer, "rules": 0, "missing": {}}

    if not entries:
        parts.append("\n_No rules in this digest._\n")
        return "".join(parts), {"layer": layer, "rules": 0, "missing": {}}

    parts.append(
        f"\n_{len(entries)} rules included. Order matches the inclusion "
        "list._\n\n---\n\n"
    )

    missing_per_rule: dict[str, list[str]] = {}
    for i, entry in enumerate(entries):
        body, missing = render_rule(entry)
        if missing:
            missing_per_rule[entry.name] = missing
        parts.append(body)
        if i < len(entries) - 1:
            parts.append("\n---\n\n")

    return "".join(parts), {
        "layer": layer,
        "rules": len(entries),
        "missing": missing_per_rule,
    }


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__.split("\n", 1)[0])
    p.add_argument("--max-bytes", type=int, default=DEFAULT_MAX_BYTES,
                   help=f"per-digest byte budget (default {DEFAULT_MAX_BYTES})")
    p.add_argument("--out-dir", type=Path, default=OUT_DIR,
                   help="output directory (default dist/linear/)")
    p.add_argument("--strict-missing", action="store_true",
                   help="exit non-zero if a strip_sections title is unmatched")
    args = p.parse_args(argv)

    args.out_dir.mkdir(parents=True, exist_ok=True)

    layers = [("workspace", WORKSPACE), ("team", TEAM), ("personal", PERSONAL)]
    over_budget = False
    drift = False

    for layer, entries in layers:
        try:
            digest, summary = render_digest(layer, entries)
        except FileNotFoundError as exc:
            print(f"❌  {exc}", file=sys.stderr)
            return 3

        out_path = args.out_dir / f"{layer}.md"
        out_path.write_text(digest, encoding="utf-8")
        size = len(digest.encode("utf-8"))
        flag = "⚠️ " if size > args.max_bytes else "  "
        try:
            display_path = out_path.relative_to(ROOT)
        except ValueError:
            display_path = out_path
        print(f"{flag}{layer:<10} {summary['rules']:>2} rules  "
              f"{size:>6} bytes  {display_path}")
        if size > args.max_bytes:
            over_budget = True
        if summary["missing"]:
            drift = True
            for name, sections in summary["missing"].items():
                print(f"   ⚠️  {name}: unmatched strip_sections: {sections}",
                      file=sys.stderr)

    if over_budget:
        print(f"❌  one or more digests exceed --max-bytes={args.max_bytes}",
              file=sys.stderr)
        return 2
    if drift and args.strict_missing:
        print("❌  --strict-missing: at least one strip_sections title did "
              "not match (digest config drifted from rule source)",
              file=sys.stderr)
        return 4
    return 0


if __name__ == "__main__":
    sys.exit(main())
