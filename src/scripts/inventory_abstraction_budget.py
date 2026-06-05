"""Abstraction-budget inventory — read-only discovery pass.

Drives Phase 1 of `agents/roadmaps/road-to-abstraction-budget-discovery.md`.

For each abstraction class (packs, roles, directives, council-members,
trust-levels, flows, commands, skills, rules, personas) emits a row
with name, class, reference count, last-modified date, and a
`bloat_candidate` flag (Y if usage_count == 0 OR purpose overlap).

Also runs a frontmatter field-bloat sub-audit: tabulates every
frontmatter field across artefacts that carry one, and flags fields
with a single dominant value in >95% of artefacts as
lean-contract candidates.

Outputs to:
- agents/evidence/analysis/abstraction-budget-inventory.md
- agents/evidence/analysis/abstraction-budget-inventory.csv
- agents/evidence/analysis/abstraction-budget-frontmatter.csv

Read-only. Touches no abstraction file. Reference counts are
grep-backed (ripgrep with python fallback) — not estimates.

Usage:
    python3 scripts/inventory_abstraction_budget.py [--quiet]
"""
from __future__ import annotations

import argparse
import csv
import os
import re
import shutil
import subprocess
import sys
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(REPO_ROOT / "src" / "scripts"))

try:
    from _lib import script_output  # type: ignore[import-not-found]
except ImportError:
    script_output = None  # graceful fallback when running outside repo

from _lib.agent_src import SRC_AGENT  # noqa: E402

# 6.0.x: uncondensed source container moved to src/agent-src/ (ADR-051).
CORE_SRC = SRC_AGENT
# Enforced source target — read by scripts/check_gate_paths.py so a future move
# that desyncs this path fails CI instead of silently no-opping.
GATE_CORE_PATHS = (CORE_SRC,)
DIRECTIVES_ROOT = CORE_SRC / "templates" / "scripts" / "work_engine" / "directives"
EVIDENCE_DIR = REPO_ROOT / "agents" / "evidence" / "analysis"

EXCLUDE_DIRS = {
    ".git",
    "node_modules",
    "dist",
    ".claude/worktrees",
    ".cursor",
    ".windsurf",
    ".clinerules",
    ".augment",
    ".agent-src",  # condensed output (counts already covered by .uncondensed)
    ".claude/skills",
    ".claude/commands",
    ".claude/personas",
    "agents/evidence",  # don't count our own outputs
    "agents/runtime",
}

EXCLUDE_PATH_FRAGMENTS = tuple(EXCLUDE_DIRS)

ROLES_ENUM = ("developer", "reviewer", "tester", "po", "incident", "planner")
TRUST_LEVELS_ENUM = ("core", "professional", "advisory", "restricted", "experimental")


@dataclass
class InventoryRow:
    name: str
    cls: str
    ref_count: int
    last_modified: str
    bloat_candidate: bool
    notes: str = ""

    def to_row(self) -> list[str]:
        return [
            self.cls,
            self.name,
            str(self.ref_count),
            self.last_modified,
            "Y" if self.bloat_candidate else "N",
            self.notes,
        ]


@dataclass
class FrontmatterAudit:
    field: str
    cls: str
    total: int
    distinct: int
    dominant_value: str
    dominant_share: float
    bloat_candidate: bool

    def to_row(self) -> list[str]:
        return [
            self.cls,
            self.field,
            str(self.total),
            str(self.distinct),
            self.dominant_value,
            f"{self.dominant_share:.2%}",
            "Y" if self.bloat_candidate else "N",
        ]


@dataclass
class Stats:
    rows: list[InventoryRow] = field(default_factory=list)
    fm_rows: list[FrontmatterAudit] = field(default_factory=list)
    overlap_notes: list[str] = field(default_factory=list)


def _log(level: str, msg: str) -> None:
    if script_output is None:
        if level == "error":
            print(msg, file=sys.stderr)
        return
    getattr(script_output, level)(msg)


def has_rg() -> bool:
    return shutil.which("rg") is not None


def grep_count(pattern: str, *, regex: bool = False, exclude_dir: Path | None = None) -> int:
    """Count matches across repo, excluding generated trees and optionally a self-dir."""
    if has_rg():
        cmd = ["rg", "--count-matches", "--no-heading"]
        if not regex:
            cmd.append("--fixed-strings")
        for frag in EXCLUDE_PATH_FRAGMENTS:
            cmd.extend(["-g", f"!{frag}/**"])
        if exclude_dir is not None:
            try:
                rel = exclude_dir.relative_to(REPO_ROOT)
                cmd.extend(["-g", f"!{rel}/**"])
            except ValueError:
                pass
        cmd.extend([pattern, str(REPO_ROOT)])
        try:
            out = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                check=False,
            )
        except OSError:
            return _python_grep(pattern, regex=regex, exclude_dir=exclude_dir)
        total = 0
        for line in out.stdout.splitlines():
            # format: <path>:<count>
            parts = line.rsplit(":", 1)
            if len(parts) == 2 and parts[1].isdigit():
                total += int(parts[1])
        return total
    return _python_grep(pattern, regex=regex, exclude_dir=exclude_dir)


def _python_grep(pattern: str, *, regex: bool = False, exclude_dir: Path | None = None) -> int:
    rx = re.compile(pattern) if regex else None
    total = 0
    excl_str = str(exclude_dir) if exclude_dir is not None else None
    for root, dirs, files in os.walk(REPO_ROOT):
        rel = os.path.relpath(root, REPO_ROOT)
        if any(rel == frag or rel.startswith(frag + os.sep) for frag in EXCLUDE_PATH_FRAGMENTS):
            dirs[:] = []
            continue
        if excl_str is not None and root.startswith(excl_str):
            dirs[:] = []
            continue
        for fn in files:
            if not fn.endswith((".md", ".py", ".yml", ".yaml", ".json", ".sh", ".ts", ".js")):
                continue
            p = Path(root) / fn
            try:
                text = p.read_text(encoding="utf-8", errors="replace")
            except OSError:
                continue
            if regex and rx is not None:
                total += len(rx.findall(text))
            else:
                total += text.count(pattern)
    return total


def last_modified(path: Path) -> str:
    """Last git commit date for path; falls back to mtime."""
    try:
        out = subprocess.run(
            ["git", "log", "-1", "--format=%cs", "--", str(path)],
            capture_output=True,
            text=True,
            cwd=REPO_ROOT,
            check=False,
        )
        date = out.stdout.strip()
        if date:
            return date
    except OSError:
        pass
    try:
        return datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc).date().isoformat()
    except OSError:
        return "unknown"


def parse_frontmatter(path: Path) -> dict[str, str]:
    """Return frontmatter as flat dict[str, str]. Returns empty dict if absent."""
    try:
        text = path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return {}
    if not text.startswith("---\n"):
        return {}
    end = text.find("\n---\n", 4)
    if end < 0:
        return {}
    block = text[4:end]
    out: dict[str, str] = {}
    indent_path: list[str] = []
    for raw in block.splitlines():
        if not raw.strip() or raw.lstrip().startswith("#"):
            continue
        indent = len(raw) - len(raw.lstrip(" "))
        depth = indent // 2
        if ":" not in raw:
            continue
        key_part, _, value = raw.lstrip().partition(":")
        key = key_part.strip()
        value = value.strip()
        indent_path = indent_path[:depth]
        indent_path.append(key)
        if value:
            full_key = ".".join(indent_path)
            out[full_key] = value
    return out


def inventory_packs(stats: Stats) -> None:
    packs_dir = REPO_ROOT / "packages"
    for child in sorted(packs_dir.iterdir()):
        if not child.is_dir() or not child.name.startswith("pack-"):
            continue
        ref = grep_count(child.name)
        # subtract self-references inside the pack's own directory
        self_refs = 0
        if has_rg():
            try:
                out = subprocess.run(
                    ["rg", "--count-matches", "--no-heading", "--fixed-strings", child.name, str(child)],
                    capture_output=True,
                    text=True,
                    check=False,
                )
                for line in out.stdout.splitlines():
                    parts = line.rsplit(":", 1)
                    if len(parts) == 2 and parts[1].isdigit():
                        self_refs += int(parts[1])
            except OSError:
                pass
        external = max(ref - self_refs, 0)
        stats.rows.append(InventoryRow(
            name=child.name,
            cls="pack",
            ref_count=external,
            last_modified=last_modified(child),
            bloat_candidate=(external == 0),
            notes=f"total={ref}, internal={self_refs}",
        ))


def inventory_roles(stats: Stats) -> None:
    for role in ROLES_ENUM:
        # role names are common English words; restrict to active_role context
        ref = grep_count(f'active_role: {role}')
        ref += grep_count(f'active_role: "{role}"')
        ref += grep_count(f'active_role: \'{role}\'')
        # mention in role-contracts table
        contract = REPO_ROOT / "docs" / "guidelines" / "agent-infra" / "role-contracts.md"
        stats.rows.append(InventoryRow(
            name=role,
            cls="role",
            ref_count=ref,
            last_modified=last_modified(contract),
            bloat_candidate=(ref == 0),
            notes="enum role-contracts.md",
        ))


def inventory_directives(stats: Stats) -> None:
    if not DIRECTIVES_ROOT.is_dir():
        return
    for child in sorted(DIRECTIVES_ROOT.iterdir()):
        if not child.is_dir() or child.name.startswith("_") or child.name.startswith("."):
            continue
        ref = grep_count(f'directive_set: {child.name}') + grep_count(f'directive_set="{child.name}"')
        ref += grep_count(f'"{child.name}"')  # broad
        stats.rows.append(InventoryRow(
            name=child.name,
            cls="directive_set",
            ref_count=ref,
            last_modified=last_modified(child),
            bloat_candidate=(ref < 2),
            notes="work_engine directive set",
        ))


def inventory_council_members(stats: Stats) -> None:
    # Council members per ai-council-config.md members block
    for member in ("anthropic", "openai", "gemini"):
        ref = grep_count(f'    {member}:')
        cfg = REPO_ROOT / "docs" / "contracts" / "ai-council-config.md"
        stats.rows.append(InventoryRow(
            name=member,
            cls="council_member",
            ref_count=ref,
            last_modified=last_modified(cfg),
            bloat_candidate=(ref == 0),
            notes="ai-council provider slot",
        ))


def inventory_trust_levels(stats: Stats) -> None:
    cfg = REPO_ROOT / "docs" / "contracts" / "trust-and-safety.md"
    for level in TRUST_LEVELS_ENUM:
        ref = grep_count(f'trust.level: {level}') + grep_count(f'level: {level}')
        ref += grep_count(f'`{level}`')
        stats.rows.append(InventoryRow(
            name=level,
            cls="trust_level",
            ref_count=ref,
            last_modified=last_modified(cfg),
            bloat_candidate=(ref < 2),
            notes="trust enum value",
        ))


def inventory_flows(stats: Stats) -> None:
    contracts = REPO_ROOT / "docs" / "contracts"
    if not contracts.is_dir():
        return
    for p in sorted(contracts.glob("*flow*.md")):
        ref = grep_count(p.stem)
        stats.rows.append(InventoryRow(
            name=p.stem,
            cls="flow",
            ref_count=ref,
            last_modified=last_modified(p),
            bloat_candidate=(ref < 3),
            notes=str(p.relative_to(REPO_ROOT)),
        ))


def inventory_artefacts(stats: Stats, *, subdir: str, cls: str) -> None:
    """Inventory skill/rule/command/persona artefacts with broad-match + self-ref subtraction."""
    root = CORE_SRC / subdir
    if not root.is_dir():
        return
    for child in sorted(root.iterdir()):
        if child.is_dir():
            md = child / "SKILL.md" if cls == "skill" else None
            if md and md.is_file():
                _record_artefact(stats, child.name, cls, md, exclude_dir=child)
            elif cls == "command":
                for cmd_file in child.rglob("*.md"):
                    name = str(cmd_file.relative_to(root)).removesuffix(".md").replace("/", ":")
                    _record_artefact(stats, name, cls, cmd_file, exclude_dir=None)
            elif cls == "persona":
                if child.name.startswith("_"):
                    continue
                for persona_file in child.rglob("*.md"):
                    name = persona_file.stem
                    if name.startswith("_"):
                        continue
                    _record_artefact(stats, name, cls, persona_file, exclude_dir=None)
        elif child.suffix == ".md":
            name = child.stem
            if name.startswith("_") or name.upper() == "README":
                continue
            _record_artefact(stats, name, cls, child, exclude_dir=None)


def _record_artefact(stats: Stats, name: str, cls: str, path: Path, *, exclude_dir: Path | None) -> None:
    """Count *external* references to the artefact name (broad match, self-ref subtracted)."""
    # Broad: count bare name across the tree, exclude the artefact's own dir/file.
    # The artefact name is kebab-case (commands use `:` separators) and is
    # treated as a fixed string — so the only false-positive risk is a generic
    # English word colliding with an artefact name, which the audit notes.
    if exclude_dir is not None:
        external = grep_count(name, exclude_dir=exclude_dir)
    else:
        # No own-dir to exclude: count whole-tree then subtract the file's own refs.
        total = grep_count(name)
        try:
            self_text = path.read_text(encoding="utf-8", errors="replace")
            self_refs = self_text.count(name)
        except OSError:
            self_refs = 0
        external = max(total - self_refs, 0)
    # Heuristic threshold: <3 external references signals a candidate
    # (not a verdict — Phase 2 gate decides).
    bloat = external < 3
    stats.rows.append(InventoryRow(
        name=name,
        cls=cls,
        ref_count=external,
        last_modified=last_modified(path),
        bloat_candidate=bloat,
        notes=str(path.relative_to(REPO_ROOT)),
    ))


def overlap_audit(stats: Stats) -> None:
    """Surface obvious purpose overlaps within the same class via name overlap."""
    by_class: dict[str, list[str]] = defaultdict(list)
    for row in stats.rows:
        by_class[row.cls].append(row.name)
    for cls, names in by_class.items():
        if cls not in ("skill", "rule", "command", "persona"):
            continue
        # naive overlap signal: same stemmed prefix family
        families: dict[str, list[str]] = defaultdict(list)
        for n in names:
            stem = re.split(r"[:_-]", n, maxsplit=1)[0]
            families[stem].append(n)
        for stem, group in families.items():
            if len(group) >= 4:
                stats.overlap_notes.append(
                    f"{cls} family '{stem}' has {len(group)} members: {', '.join(sorted(group))}",
                )


def frontmatter_audit(stats: Stats) -> None:
    """Per-class frontmatter field-bloat audit."""
    classes = {
        "skill": list(CORE_SRC.glob("skills/*/SKILL.md")),
        "rule": list(CORE_SRC.glob("rules/*.md")),
        "command": list(CORE_SRC.glob("commands/**/*.md")),
        "persona": list(CORE_SRC.glob("personas/**/*.md")),
    }
    for cls, paths in classes.items():
        field_values: dict[str, list[str]] = defaultdict(list)
        for p in paths:
            if p.name.startswith("_") or p.name.upper() == "README.MD":
                continue
            fm = parse_frontmatter(p)
            for k, v in fm.items():
                field_values[k].append(v)
        for fkey, values in field_values.items():
            counter = Counter(values)
            dominant_value, dominant_count = counter.most_common(1)[0]
            total = len(values)
            distinct = len(counter)
            share = dominant_count / total if total else 0
            bloat = share > 0.95 and total >= 10
            stats.fm_rows.append(FrontmatterAudit(
                field=fkey,
                cls=cls,
                total=total,
                distinct=distinct,
                dominant_value=(dominant_value[:60] + "…") if len(dominant_value) > 60 else dominant_value,
                dominant_share=share,
                bloat_candidate=bloat,
            ))


def write_csv(path: Path, header: list[str], rows: list[list[str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(header)
        w.writerows(rows)


def write_markdown(path: Path, stats: Stats) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    bloat_rows = [r for r in stats.rows if r.bloat_candidate]
    bloat_fm = [r for r in stats.fm_rows if r.bloat_candidate]
    by_class = Counter(r.cls for r in stats.rows)
    bloat_by_class = Counter(r.cls for r in bloat_rows)

    lines: list[str] = []
    lines.append("# Abstraction-Budget Inventory\n")
    lines.append(
        "> Read-only discovery output for "
        "`agents/roadmaps/road-to-abstraction-budget-discovery.md`. "
        "Counts are grep-backed via the inventory script "
        "`scripts/inventory_abstraction_budget.py`. "
        "`bloat_candidate = Y` means usage-count threshold not met "
        "(typically zero external references) OR purpose overlap.\n",
    )
    lines.append(f"_Generated: {datetime.now(timezone.utc).date().isoformat()}_\n")

    lines.append("\n## Summary\n")
    lines.append("| Class | Total | Bloat candidates |\n|---|---:|---:|")
    for cls in sorted(by_class):
        lines.append(f"| {cls} | {by_class[cls]} | {bloat_by_class.get(cls, 0)} |")
    lines.append("")

    lines.append("\n## Phase 2 gate signals\n")
    zero_usage = [r for r in stats.rows if r.ref_count == 0]
    lines.append(f"- **Abstractions with usage_count == 0:** {len(zero_usage)}")
    lines.append(f"- **Frontmatter fields >95% boilerplate:** {len(bloat_fm)}")
    lines.append(f"- **Overlap notes surfaced:** {len(stats.overlap_notes)}")
    lines.append("")
    if zero_usage:
        lines.append("Zero-usage list:\n")
        for r in zero_usage:
            lines.append(f"- `{r.cls}/{r.name}` (last modified {r.last_modified})")
        lines.append("")
    if bloat_fm:
        lines.append("\nFrontmatter boilerplate candidates:\n")
        for r in bloat_fm:
            lines.append(
                f"- `{r.cls}.{r.field}` — dominant `{r.dominant_value}` "
                f"in {r.dominant_share:.0%} of {r.total} artefacts",
            )
        lines.append("")
    if stats.overlap_notes:
        lines.append("\nOverlap notes:\n")
        for note in stats.overlap_notes:
            lines.append(f"- {note}")
        lines.append("")

    lines.append("\n## Full inventory\n")
    lines.append("| Class | Name | Refs | Last modified | Bloat? | Notes |")
    lines.append("|---|---|---:|---|:---:|---|")
    for r in sorted(stats.rows, key=lambda x: (x.cls, x.name)):
        lines.append(
            f"| {r.cls} | `{r.name}` | {r.ref_count} | "
            f"{r.last_modified} | {'Y' if r.bloat_candidate else 'N'} | {r.notes} |",
        )

    lines.append("\n## Frontmatter field audit\n")
    lines.append("| Class | Field | Total | Distinct | Dominant value | Share | Bloat? |")
    lines.append("|---|---|---:|---:|---|---:|:---:|")
    for r in sorted(stats.fm_rows, key=lambda x: (x.cls, -x.dominant_share)):
        lines.append(
            f"| {r.cls} | `{r.field}` | {r.total} | {r.distinct} | "
            f"`{r.dominant_value}` | {r.dominant_share:.0%} | "
            f"{'Y' if r.bloat_candidate else 'N'} |",
        )

    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--quiet", action="store_true", help="suppress info-level output")
    args = parser.parse_args()
    if args.quiet:
        os.environ.setdefault("AGENT_SCRIPT_VERBOSITY", "silent")

    _log("info", "[inventory] scanning packs…")
    stats = Stats()
    inventory_packs(stats)
    _log("info", "[inventory] scanning roles…")
    inventory_roles(stats)
    _log("info", "[inventory] scanning directives…")
    inventory_directives(stats)
    _log("info", "[inventory] scanning council members…")
    inventory_council_members(stats)
    _log("info", "[inventory] scanning trust levels…")
    inventory_trust_levels(stats)
    _log("info", "[inventory] scanning flows…")
    inventory_flows(stats)
    _log("info", "[inventory] scanning skills…")
    inventory_artefacts(stats, subdir="skills", cls="skill")
    _log("info", "[inventory] scanning rules…")
    inventory_artefacts(stats, subdir="rules", cls="rule")
    _log("info", "[inventory] scanning commands…")
    inventory_artefacts(stats, subdir="commands", cls="command")
    _log("info", "[inventory] scanning personas…")
    inventory_artefacts(stats, subdir="personas", cls="persona")
    _log("info", "[inventory] overlap audit…")
    overlap_audit(stats)
    _log("info", "[inventory] frontmatter audit…")
    frontmatter_audit(stats)

    out_md = EVIDENCE_DIR / "abstraction-budget-inventory.md"
    out_csv = EVIDENCE_DIR / "abstraction-budget-inventory.csv"
    out_fm_csv = EVIDENCE_DIR / "abstraction-budget-frontmatter.csv"

    write_markdown(out_md, stats)
    write_csv(
        out_csv,
        header=["class", "name", "ref_count", "last_modified", "bloat_candidate", "notes"],
        rows=[r.to_row() for r in sorted(stats.rows, key=lambda x: (x.cls, x.name))],
    )
    write_csv(
        out_fm_csv,
        header=["class", "field", "total", "distinct", "dominant_value", "dominant_share", "bloat_candidate"],
        rows=[r.to_row() for r in sorted(stats.fm_rows, key=lambda x: (x.cls, -x.dominant_share))],
    )

    _log("success", f"[inventory] wrote {out_md.relative_to(REPO_ROOT)}")
    _log("success", f"[inventory] wrote {out_csv.relative_to(REPO_ROOT)}")
    _log("success", f"[inventory] wrote {out_fm_csv.relative_to(REPO_ROOT)}")
    if script_output is not None:
        script_output.flush_summary("[inventory] inventory written")
    return 0


if __name__ == "__main__":
    sys.exit(main())
