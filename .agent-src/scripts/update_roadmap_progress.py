#!/usr/bin/env python3
"""Generate `agents/roadmaps-progress.md` — aggregated progress across open roadmaps.

Scans every roadmap under `agents/roadmaps/` (excluding `archive/`, `skipped/`,
`template.md`, `README.md`, `open-questions*.md`), counts checkbox states per
phase, and writes a dashboard at `agents/roadmaps-progress.md` (outside the
`roadmaps/` folder to keep it clean) with:

  - Overall progress (open-roadmap count, steps done, %)
  - A summary table of every open roadmap
  - Per-roadmap phase breakdown
  - A footer listing capture-only synthesis documents (excluded from totals)

Checkbox states:
  [x]  done      [ ]  open      [~]  deferred      [-]  cancelled

Percentage = done / (done + open). Deferred and cancelled do not count towards
"open" (they are explicit decisions).

Capture-only roadmaps — frontmatter `status: capture-only` (or `capture_only`)
or `mode: feedback` — are synthesis/feedback documents, not executable plans.
They are excluded from the executable totals and listed in a separate footer
section so the dashboard reflects only actionable work.

Invocation (from project root):
  python3 .augment/scripts/update_roadmap_progress.py              # rewrite
  python3 .augment/scripts/update_roadmap_progress.py --check      # CI: exit 1 if stale

`--check` mode also fails when a roadmap reaches `count_open == 0` but is
still under `agents/roadmaps/` instead of `agents/roadmaps/archive/` —
backstopping the `roadmap-progress-sync` rule's "completion = archival,
same response" requirement. The write path emits the same finding as a
warning on stderr and still regenerates the dashboard.
"""

from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

CHECKBOX_RE = re.compile(r"^\s*[-*]\s+\[([ xX~\-])\]\s", re.MULTILINE)
# H2 or H3 heading starting with "Phase <id>"; separator (colon, em-dash,
# hyphen, or whitespace) and name are optional. The id supports three
# project-level conventions:
#   - numeric        `Phase 0`, `Phase 10`
#   - roman I..XXXIX `Phase I`, `Phase III`
#   - letter track   `Phase A`, `Phase B1` (single uppercase letter,
#                    optional trailing digits for sub-track IDs)
# Roman is capped at [IVX]+ (up to XXXIX) on purpose: the broader
# [IVXLCDM]+ would also match all-caps words like `Phase LIVE`. Letter
# is [A-Z] not [A-Za-z] so `## Phase overview` stays a non-phase anchor.
PHASE_RE = re.compile(
    r"^(#{2,3})\s+Phase\s+(\d+|[IVX]+|[A-Z](?:\d+)?)"
    r"(?:[\s:\u2014\-]+(.*?))?\s*$",
    re.MULTILINE,
)
TITLE_RE = re.compile(r"^#\s+(?:Roadmap:\s*)?(.+?)\s*$", re.MULTILINE)
EXCLUDE_NAMES = {"template.md", "README.md", "progress.md", "roadmaps-progress.md"}
EXCLUDE_PREFIXES = ("open-questions",)
EXCLUDE_DIRS = {"archive", "skipped"}

# Frontmatter — minimal YAML block at the top of a roadmap. Used to flag
# synthesis/feedback docs (`status: capture-only` or `mode: feedback`) so the
# dashboard separates "capture vs execution" cleanly.
FRONTMATTER_RE = re.compile(r"\A---\n(.*?)\n---\s*\n", re.DOTALL)
CAPTURE_ONLY_VALUES = frozenset({"capture-only", "capture_only", "feedback"})


@dataclass
class PhaseStats:
    # Phase identifier as it appears in the heading: numeric ("0"),
    # roman ("III"), or letter-track ("A", "B1"). Kept as a string so
    # non-numeric conventions survive round-tripping through render().
    id: str
    name: str
    done: int = 0
    open_: int = 0
    deferred: int = 0
    cancelled: int = 0

    @property
    def total_active(self) -> int:  # denominator for %
        return self.done + self.open_

    @property
    def total_all(self) -> int:  # all checkboxes incl. deferred + cancelled
        return self.done + self.open_ + self.deferred + self.cancelled

    @property
    def percent(self) -> int:
        return round(self.done * 100 / self.total_active) if self.total_active else 0

    @property
    def state(self) -> str:
        if self.total_active == 0 and (self.deferred or self.cancelled):
            return "⏭️ skipped"
        if self.total_active == 0:
            return "⬜ empty"
        if self.done == 0:
            return "⬜ not started"
        if self.open_ == 0:
            return "✅ done"
        return "🟡 in progress"


@dataclass
class RoadmapStats:
    path: Path
    rel: str
    title: str
    phases: list[PhaseStats] = field(default_factory=list)

    @property
    def done(self) -> int:
        return sum(p.done for p in self.phases)

    @property
    def open_(self) -> int:
        return sum(p.open_ for p in self.phases)

    @property
    def deferred(self) -> int:
        return sum(p.deferred for p in self.phases)

    @property
    def cancelled(self) -> int:
        return sum(p.cancelled for p in self.phases)

    @property
    def total_active(self) -> int:
        return self.done + self.open_

    @property
    def total_all(self) -> int:
        return self.done + self.open_ + self.deferred + self.cancelled

    @property
    def percent(self) -> int:
        return round(self.done * 100 / self.total_active) if self.total_active else 0


@dataclass
class CaptureOnlyDoc:
    """A roadmap flagged as capture-only / feedback in its frontmatter.

    Tracked separately from RoadmapStats so it never contributes to
    open-step totals. Surfaced in a footer section of the dashboard.
    """
    path: Path
    rel: str
    title: str
    marker: str  # the frontmatter value that flagged it (e.g. "capture-only")


def parse_frontmatter(text: str) -> dict[str, str]:
    """Parse a leading YAML frontmatter block. String scalars only.

    Returns an empty dict if no frontmatter is present. Handles quoted and
    unquoted values; ignores blank lines and comments. Nested keys, lists,
    and multiline scalars are out of scope — the dashboard only needs flat
    string flags (`status`, `mode`).
    """
    m = FRONTMATTER_RE.match(text)
    if not m:
        return {}
    fm: dict[str, str] = {}
    for line in m.group(1).splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or ":" not in line:
            continue
        key, _, value = line.partition(":")
        fm[key.strip()] = value.strip().strip('"').strip("'")
    return fm


def capture_only_marker(fm: dict[str, str]) -> str | None:
    """Return the frontmatter value that flagged the doc as capture-only.

    Checks `status:` and `mode:` (in that order). Returns None when the doc
    is a normal executable roadmap.
    """
    for key in ("status", "mode"):
        v = fm.get(key, "").lower()
        if v in CAPTURE_ONLY_VALUES:
            return v
    return None


def is_roadmap_candidate(path: Path) -> bool:
    if path.name in EXCLUDE_NAMES:
        return False
    if any(path.name.startswith(p) for p in EXCLUDE_PREFIXES):
        return False
    if any(part in EXCLUDE_DIRS for part in path.parts):
        return False
    return True


def count_checkboxes(text: str) -> tuple[int, int, int, int]:
    done = open_ = deferred = cancelled = 0
    for m in CHECKBOX_RE.finditer(text):
        c = m.group(1).lower()
        if c == "x":
            done += 1
        elif c == " ":
            open_ += 1
        elif c == "~":
            deferred += 1
        elif c == "-":
            cancelled += 1
    return done, open_, deferred, cancelled


def parse_roadmap(path: Path, roadmap_root: Path) -> RoadmapStats | None:
    text = path.read_text(encoding="utf-8")
    phase_matches = list(PHASE_RE.finditer(text))
    if not phase_matches:
        return None  # not a roadmap — no ## Phase headings
    title_match = TITLE_RE.search(text)
    title = title_match.group(1).strip() if title_match else path.stem
    rel = str(path.relative_to(roadmap_root))
    stats = RoadmapStats(path=path, rel=rel, title=title)
    for i, pm in enumerate(phase_matches):
        start = pm.end()
        end = phase_matches[i + 1].start() if i + 1 < len(phase_matches) else len(text)
        d, o, df, c = count_checkboxes(text[start:end])
        phase_id = pm.group(2)
        name = (pm.group(3) or "").strip() or f"Phase {phase_id}"
        stats.phases.append(PhaseStats(phase_id, name, d, o, df, c))
    return stats


def bar(pct: int, width: int = 10) -> str:
    filled = round(pct * width / 100)
    return "█" * filled + "░" * (width - filled)


def collect(roadmap_root: Path) -> list[RoadmapStats]:
    """Collect executable roadmaps. Capture-only docs are excluded."""
    results: list[RoadmapStats] = []
    for path in sorted(roadmap_root.rglob("*.md")):
        if not path.is_file() or not is_roadmap_candidate(path):
            continue
        text = path.read_text(encoding="utf-8")
        if capture_only_marker(parse_frontmatter(text)) is not None:
            continue
        stats = parse_roadmap(path, roadmap_root)
        if stats:
            results.append(stats)
    return results


def collect_capture_only(roadmap_root: Path) -> list[CaptureOnlyDoc]:
    """Sibling of collect() — gather capture-only / feedback synthesis docs.

    These are intentionally excluded from open-step totals; they are
    surfaced in a separate dashboard footer so they remain discoverable
    without polluting executable progress arithmetic.
    """
    docs: list[CaptureOnlyDoc] = []
    for path in sorted(roadmap_root.rglob("*.md")):
        if not path.is_file() or not is_roadmap_candidate(path):
            continue
        text = path.read_text(encoding="utf-8")
        marker = capture_only_marker(parse_frontmatter(text))
        if marker is None:
            continue
        title_match = TITLE_RE.search(text)
        title = title_match.group(1).strip() if title_match else path.stem
        rel = str(path.relative_to(roadmap_root))
        docs.append(CaptureOnlyDoc(path=path, rel=rel, title=title, marker=marker))
    return docs


def unarchived_complete(roadmaps: list[RoadmapStats]) -> list[RoadmapStats]:
    # A roadmap is complete when every active checkbox is done and at least
    # one active checkbox exists. The `roadmap-progress-sync` rule mandates
    # that such a roadmap be moved to `agents/roadmaps/archive/` in the
    # same response that closes its last open item; `collect()` already
    # excludes that directory, so anything left here is unarchived.
    return [r for r in roadmaps if r.total_active > 0 and r.open_ == 0]


def render(
    roadmaps: list[RoadmapStats],
    capture_only: list[CaptureOnlyDoc] | None = None,
) -> str:
    capture_only = capture_only or []
    total_done = sum(r.done for r in roadmaps)
    total_active = sum(r.total_active for r in roadmaps)
    overall_pct = round(total_done * 100 / total_active) if total_active else 0
    lines: list[str] = []
    lines.append("# Roadmap Progress\n")
    header_meta = (
        f"> {len(roadmaps)} open roadmap"
        f"{'s' if len(roadmaps) != 1 else ''}"
    )
    if capture_only:
        header_meta += (
            f" · {len(capture_only)} capture-only doc"
            f"{'s' if len(capture_only) != 1 else ''}"
        )
    header_meta += (
        " · [roadmaps/](roadmaps/) · [archive/](roadmaps/archive/) · "
        "[skipped/](roadmaps/skipped/)\n"
    )
    lines.append(
        "> Auto-generated by `.augment/scripts/update_roadmap_progress.py`. "
        "Do not edit — regenerated on every roadmap-create, -execute, or "
        "completion change (last-modified timestamp lives in git history).\n>\n"
        + header_meta
    )
    lines.append("## Overall\n")
    lines.append(f"**{total_done} / {total_active} steps done · {overall_pct}%**\n")
    lines.append("```text\n" + bar(overall_pct, 40) + f"   {overall_pct}%\n```\n")
    if not roadmaps:
        lines.append("_No open roadmaps._\n")
        if capture_only:
            lines.extend(_render_capture_only(capture_only))
        return "\n".join(lines) + "\n"
    lines.append("## Open roadmaps\n")
    # Steps = ALL checkboxes (done + open + deferred + cancelled) so the row
    # arithmetic adds up: Steps − Done − Deferred − Cancelled = Open. Open
    # comes before Done by design — at-a-glance "what's left to do" first,
    # historical "what's behind us" second.
    lines.append("| # | Roadmap | Phases | Steps | Open | Done | Deferred | Cancelled | Progress |")
    lines.append("|---|---|---:|---:|---:|---:|---:|---:|---|")
    for i, r in enumerate(roadmaps, 1):
        lines.append(
            f"| {i} | [{r.rel}](roadmaps/{r.rel}) | {len(r.phases)} | {r.total_all} | "
            f"{r.open_} | {r.done} | {r.deferred} | {r.cancelled} | "
            f"{bar(r.percent)} {r.percent}% |"
        )
    lines.append("")
    lines.append("---\n")
    lines.append("## Per-roadmap phase breakdown\n")
    for r in roadmaps:
        lines.append(f"### [{r.rel}](roadmaps/{r.rel})\n")
        lines.append(f"**{r.title}** — {r.done} / {r.total_active} done ({r.percent}%)\n")
        lines.append("| # | Phase | State | Open | Done | Deferred | Cancelled | % |")
        lines.append("|---|---|---|---:|---:|---:|---:|---:|")
        for p in r.phases:
            lines.append(
                f"| {p.id} | {p.name} | {p.state} | {p.open_} | {p.done} | "
                f"{p.deferred} | {p.cancelled} | {p.percent}% |"
            )
        lines.append("")
    if capture_only:
        lines.extend(_render_capture_only(capture_only))
    return "\n".join(lines) + "\n"


def _render_capture_only(docs: list[CaptureOnlyDoc]) -> list[str]:
    """Footer block listing capture-only / feedback synthesis docs.

    Kept visible in the dashboard so synthesis work does not vanish, but
    excluded from open-step totals — these docs have no executable steps
    by design (see `road-to-governance-cleanup` Bug #2).
    """
    out: list[str] = []
    out.append("---\n")
    out.append("## Capture-only roadmaps\n")
    out.append(
        "_Synthesis / feedback docs flagged with `status: capture-only` "
        "or `mode: feedback` in their frontmatter. Excluded from "
        "executable totals; awaiting promotion to executable phases._\n"
    )
    out.append("| # | Roadmap | Marker | Title |")
    out.append("|---|---|---|---|")
    for i, d in enumerate(docs, 1):
        out.append(
            f"| {i} | [{d.rel}](roadmaps/{d.rel}) | `{d.marker}` | {d.title} |"
        )
    out.append("")
    return out


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="exit 1 if progress.md is stale")
    parser.add_argument("--repo-root", type=Path, default=Path.cwd(),
                        help="project root (default: cwd)")
    args = parser.parse_args()
    roadmap_root = args.repo_root / "agents" / "roadmaps"
    target = args.repo_root / "agents" / "roadmaps-progress.md"
    if not roadmap_root.is_dir():
        # No roadmaps directory yet — skip silently so the CI check is safe in
        # consumer projects that haven't adopted roadmaps.
        if args.check:
            return 0
        print(f"ℹ️  No roadmaps directory at {roadmap_root} — nothing to do.")
        return 0
    roadmaps = collect(roadmap_root)
    capture_only = collect_capture_only(roadmap_root)
    new_text = render(roadmaps, capture_only)
    current = target.read_text(encoding="utf-8") if target.exists() else ""
    complete = unarchived_complete(roadmaps)
    if args.check:
        stale = current != new_text
        if stale:
            print(f"❌  {target.relative_to(args.repo_root)} is stale. "
                  f"Run `python3 .augment/scripts/update_roadmap_progress.py` "
                  f"to regenerate (or `task roadmap-progress` in Taskfile "
                  f"projects).", file=sys.stderr)
        if complete:
            print("❌  Completed roadmaps are still in `agents/roadmaps/` — "
                  "move them to `agents/roadmaps/archive/` (per the "
                  "`roadmap-progress-sync` rule):", file=sys.stderr)
            for r in complete:
                print(f"      - {r.rel}  ({r.done}/{r.total_active} done)",
                      file=sys.stderr)
        if stale or complete:
            return 1
        print(f"✅  {target.relative_to(args.repo_root)} is up to date.")
        return 0
    target.write_text(new_text, encoding="utf-8")
    capture_suffix = (
        f" · {len(capture_only)} capture-only" if capture_only else ""
    )
    print(f"✅  Wrote {target.relative_to(args.repo_root)} · "
          f"{len(roadmaps)} roadmap(s){capture_suffix} · "
          f"{sum(r.done for r in roadmaps)}/{sum(r.total_active for r in roadmaps)} steps done.")
    if complete:
        print("⚠️   Completed roadmaps not yet archived — move to "
              "`agents/roadmaps/archive/`:", file=sys.stderr)
        for r in complete:
            print(f"      - {r.rel}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
