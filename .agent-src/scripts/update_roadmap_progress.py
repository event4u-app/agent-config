#!/usr/bin/env python3
"""Generate `agents/roadmaps-progress.md` — aggregated progress across open roadmaps.

Scans every roadmap under `agents/roadmaps/` (excluding `archive/`, `skipped/`,
`template.md`, `README.md`, `open-questions*.md`), counts checkbox states per
phase, and writes a dashboard at `agents/roadmaps-progress.md` (outside the
`roadmaps/` folder to keep it clean) with:

  - Overall progress (open-roadmap count, steps done, %)
  - A summary table of every open roadmap
  - Per-roadmap phase breakdown

Checkbox states:
  [x]  done      [ ]  open      [~]  deferred      [-]  cancelled

Percentage = done / (done + open). Deferred and cancelled do not count towards
"open" (they are explicit decisions).

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
    def percent(self) -> int:
        return round(self.done * 100 / self.total_active) if self.total_active else 0


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
    results: list[RoadmapStats] = []
    for path in sorted(roadmap_root.rglob("*.md")):
        if not path.is_file() or not is_roadmap_candidate(path):
            continue
        stats = parse_roadmap(path, roadmap_root)
        if stats:
            results.append(stats)
    return results


def unarchived_complete(roadmaps: list[RoadmapStats]) -> list[RoadmapStats]:
    # A roadmap is complete when every active checkbox is done and at least
    # one active checkbox exists. The `roadmap-progress-sync` rule mandates
    # that such a roadmap be moved to `agents/roadmaps/archive/` in the
    # same response that closes its last open item; `collect()` already
    # excludes that directory, so anything left here is unarchived.
    return [r for r in roadmaps if r.total_active > 0 and r.open_ == 0]


def render(roadmaps: list[RoadmapStats]) -> str:
    total_done = sum(r.done for r in roadmaps)
    total_active = sum(r.total_active for r in roadmaps)
    overall_pct = round(total_done * 100 / total_active) if total_active else 0
    lines: list[str] = []
    lines.append("# Roadmap Progress\n")
    lines.append(
        "> Auto-generated by `.augment/scripts/update_roadmap_progress.py`. "
        "Do not edit — regenerated on every roadmap-create, -execute, or "
        "completion change (last-modified timestamp lives in git history).\n>\n"
        f"> {len(roadmaps)} open roadmap"
        f"{'s' if len(roadmaps) != 1 else ''} · "
        "[roadmaps/](roadmaps/) · [archive/](roadmaps/archive/) · "
        "[skipped/](roadmaps/skipped/)\n"
    )
    lines.append("## Overall\n")
    lines.append(f"**{total_done} / {total_active} steps done · {overall_pct}%**\n")
    lines.append("```text\n" + bar(overall_pct, 40) + f"   {overall_pct}%\n```\n")
    if not roadmaps:
        lines.append("_No open roadmaps._\n")
        return "\n".join(lines) + "\n"
    lines.append("## Open roadmaps\n")
    lines.append("| # | Roadmap | Phases | Steps | Done | Open | Deferred | Cancelled | Progress |")
    lines.append("|---|---|---:|---:|---:|---:|---:|---:|---|")
    for i, r in enumerate(roadmaps, 1):
        lines.append(
            f"| {i} | [{r.rel}](roadmaps/{r.rel}) | {len(r.phases)} | {r.total_active} | "
            f"{r.done} | {r.open_} | {r.deferred} | {r.cancelled} | "
            f"{bar(r.percent)} {r.percent}% |"
        )
    lines.append("")
    lines.append("---\n")
    lines.append("## Per-roadmap phase breakdown\n")
    for r in roadmaps:
        lines.append(f"### [{r.rel}](roadmaps/{r.rel})\n")
        lines.append(f"**{r.title}** — {r.done} / {r.total_active} done ({r.percent}%)\n")
        lines.append("| # | Phase | State | Done | Open | Deferred | Cancelled | % |")
        lines.append("|---|---|---|---:|---:|---:|---:|---:|")
        for p in r.phases:
            lines.append(
                f"| {p.id} | {p.name} | {p.state} | {p.done} | {p.open_} | "
                f"{p.deferred} | {p.cancelled} | {p.percent}% |"
            )
        lines.append("")
    return "\n".join(lines) + "\n"


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
    new_text = render(roadmaps)
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
    print(f"✅  Wrote {target.relative_to(args.repo_root)} · "
          f"{len(roadmaps)} roadmap(s) · "
          f"{sum(r.done for r in roadmaps)}/{sum(r.total_active for r in roadmaps)} steps done.")
    if complete:
        print("⚠️   Completed roadmaps not yet archived — move to "
              "`agents/roadmaps/archive/`:", file=sys.stderr)
        for r in complete:
            print(f"      - {r.rel}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
