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

`[~]` deferred items carry plans the user intends to revisit later. They
block silent auto-archive per `roadmap-progress-sync` Iron Law 3: a
roadmap with `count_open == 0` and `count_deferred > 0` is reported
separately (`pending_iron_law_3`) and the user must resolve the
deferrals (spawn follow-up roadmap, restore, or convert to cancelled)
before the file moves to `archive/`.

Roadmap visibility is binary:

  - No `status:` frontmatter (or `status: ready`) → executable, listed.
  - `status: draft` → hidden from the dashboard entirely (not counted,
    not listed). Drafts become visible the moment the frontmatter flag
    is removed or flipped to `ready`.

Invocation (from project root):
  python3 .augment/scripts/update_roadmap_progress.py              # rewrite
  python3 .augment/scripts/update_roadmap_progress.py --check      # CI: exit 1 if stale

`--check` mode also fails when a roadmap reaches `count_open == 0` but is
still under `agents/roadmaps/` instead of `agents/roadmaps/archive/` —
backstopping the `roadmap-progress-sync` rule's "completion = archival,
same response" requirement. The write path emits the same finding as a
warning on stderr and still regenerates the dashboard.

Merge-gated criteria
--------------------
A near-complete roadmap may hold its last open `[ ]` item open **on
purpose** while its closing PR is in flight, so the file stays under
`agents/roadmaps/` (unarchived) and inbound ADR / report / sibling
links keep resolving until the PR merges. Such an item carries a
machine-readable annotation on its line or the immediately-following
HTML comment:

    - [ ] task ci green on the new structure. <!-- merge-gated: pr=365
      archives + ref-migrates the moment PR #365 merges to main -->

The keyword is the literal `merge-gated`; an optional `pr=<n>` (or
`PR #<n>`) records the gating pull request. A roadmap whose **every**
open checkbox is merge-gated is "effectively complete, pending
post-merge archival" — `count_open > 0` keeps it out of
`unarchived_complete`, so without this detector it would sit at e.g.
97% forever the moment its PR merges and nobody re-runs the closure.
`merge_gated_pending()` surfaces these in a dedicated dashboard section
and an stderr warning on every run (write path AND `--check`). It is
**not** a hard-fail: an open gating PR is a legitimate state. The loud,
always-on surfacing is the backstop — a merge-gated roadmap can never
again hide inside a partial progress bar.
"""

from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

CHECKBOX_RE = re.compile(r"^\s*[-*]\s+\[([ xX~\-])\]\s", re.MULTILINE)
# H2 or H3 heading starting with "Phase <id>"; separator (colon, em-dash,
# hyphen, or whitespace) and name are optional. The id supports four
# project-level conventions:
#   - numeric        `Phase 0`, `Phase 10`
#   - numeric+sub    `Phase 2a`, `Phase 10c` (digit run + single
#                    lowercase letter for sub-phases)
#   - roman I..XXXIX `Phase I`, `Phase III`
#   - letter track   `Phase A`, `Phase B1` (single uppercase letter,
#                    optional trailing digits for sub-track IDs)
# Roman is capped at [IVX]+ (up to XXXIX) on purpose: the broader
# [IVXLCDM]+ would also match all-caps words like `Phase LIVE`. Letter
# is [A-Z] not [A-Za-z] so `## Phase overview` stays a non-phase anchor.
# The numeric+sub branch keeps the lowercase-letter restriction so
# `Phase abc` (no digits) still falls through to the rejection branch.
PHASE_RE = re.compile(
    r"^(#{2,3})\s+Phase\s+(\d+[a-z]?|[IVX]+|[A-Z](?:\d+)?)"
    r"(?:[\s:\u2014\-]+(.*?))?\s*$",
    re.MULTILINE,
)
TITLE_RE = re.compile(r"^#\s+(?:Roadmap:\s*)?(.+?)\s*$", re.MULTILINE)
EXCLUDE_NAMES = {"template.md", "README.md", "progress.md", "roadmaps-progress.md"}
EXCLUDE_PREFIXES = ("open-questions",)
EXCLUDE_DIRS = {"archive", "skipped", "stubs", "later"}

# Frontmatter — minimal YAML block at the top of a roadmap. Used to hide
# drafts (`status: draft`) from the dashboard. Anything else (no
# frontmatter, `status: ready`, unknown values) counts as a normal
# executable roadmap.
FRONTMATTER_RE = re.compile(r"\A---\n(.*?)\n---\s*\n", re.DOTALL)
DRAFT_VALUES = frozenset({"draft"})

# A `merge-gated` open item is held open on purpose while its closing PR
# is in flight (see the module docstring). The keyword is matched in the
# checkbox line OR its immediately-following HTML comment; `pr=<n>` /
# `PR #<n>` records the gating pull request for the dashboard.
MERGE_GATED_RE = re.compile(r"merge-gated", re.IGNORECASE)
# Require a `pr` context so bare `#16` (e.g. "Step-16") is not mistaken
# for a PR number. Matches: pr=365 · pr 365 · PR #365 · pr#365.
PR_NUM_RE = re.compile(r"pr\s*[=#:]?\s*#?\s*(\d+)", re.IGNORECASE)


@dataclass
class PhaseStats:
    # Phase identifier as it appears in the heading: numeric ("0"),
    # numeric+sub ("2a"), roman ("III"), or letter-track ("A", "B1").
    # Kept as a string so non-numeric conventions survive round-tripping
    # through render().
    id: str
    name: str
    done: int = 0
    open_: int = 0
    deferred: int = 0
    cancelled: int = 0
    # Subset of open_ whose checkbox carries a `merge-gated` annotation —
    # held open on purpose while a closing PR is in flight.
    merge_gated: int = 0
    # PR numbers parsed from this phase's merge-gated annotations.
    merge_gated_prs: list[int] = field(default_factory=list)

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
    def merge_gated(self) -> int:
        return sum(p.merge_gated for p in self.phases)

    @property
    def merge_gated_prs(self) -> list[int]:
        seen: list[int] = []
        for p in self.phases:
            for n in p.merge_gated_prs:
                if n not in seen:
                    seen.append(n)
        return seen

    @property
    def total_active(self) -> int:
        return self.done + self.open_

    @property
    def total_all(self) -> int:
        return self.done + self.open_ + self.deferred + self.cancelled

    @property
    def percent(self) -> int:
        return round(self.done * 100 / self.total_active) if self.total_active else 0


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


def is_draft(fm: dict[str, str]) -> bool:
    """Return True when frontmatter declares the roadmap as draft.

    `status: draft` is the single supported way to hide a roadmap from
    the dashboard. Everything else (no frontmatter, `status: ready`,
    unknown values) counts as an executable roadmap.
    """
    return fm.get("status", "").lower() in DRAFT_VALUES


def is_roadmap_candidate(path: Path) -> bool:
    if path.name in EXCLUDE_NAMES:
        return False
    if any(path.name.startswith(p) for p in EXCLUDE_PREFIXES):
        return False
    if any(part in EXCLUDE_DIRS for part in path.parts):
        return False
    return True


def count_checkboxes(text: str) -> tuple[int, int, int, int, int, list[int]]:
    """Count checkbox states in a phase slice.

    Returns ``(done, open_, deferred, cancelled, merge_gated, prs)`` where
    ``merge_gated`` is the subset of ``open_`` whose checkbox carries a
    ``merge-gated`` annotation (same line or the immediately-following
    text up to the next checkbox), and ``prs`` collects any ``pr=<n>`` /
    ``#<n>`` numbers parsed from those annotations.
    """
    done = open_ = deferred = cancelled = merge_gated = 0
    prs: list[int] = []
    matches = list(CHECKBOX_RE.finditer(text))
    for i, m in enumerate(matches):
        c = m.group(1).lower()
        if c == "x":
            done += 1
        elif c == " ":
            open_ += 1
            # Span from this checkbox to the next (or slice end) — the
            # annotation may live on the line or a following HTML comment.
            span_end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
            span = text[m.start():span_end]
            if MERGE_GATED_RE.search(span):
                merge_gated += 1
                prs.extend(int(n) for n in PR_NUM_RE.findall(span))
        elif c == "~":
            deferred += 1
        elif c == "-":
            cancelled += 1
    return done, open_, deferred, cancelled, merge_gated, prs


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
        d, o, df, c, mg, prs = count_checkboxes(text[start:end])
        phase_id = pm.group(2)
        name = (pm.group(3) or "").strip() or f"Phase {phase_id}"
        stats.phases.append(PhaseStats(phase_id, name, d, o, df, c, mg, prs))
    return stats


def bar(pct: int, width: int = 10) -> str:
    filled = round(pct * width / 100)
    return "█" * filled + "░" * (width - filled)


def collect(roadmap_root: Path) -> list[RoadmapStats]:
    """Collect executable roadmaps. Drafts are excluded."""
    results: list[RoadmapStats] = []
    for path in sorted(roadmap_root.rglob("*.md")):
        if not path.is_file() or not is_roadmap_candidate(path):
            continue
        text = path.read_text(encoding="utf-8")
        if is_draft(parse_frontmatter(text)):
            continue
        stats = parse_roadmap(path, roadmap_root)
        if stats:
            results.append(stats)
    return results


def unarchived_complete(roadmaps: list[RoadmapStats]) -> list[RoadmapStats]:
    # A roadmap is complete-and-clean when every active checkbox is done,
    # at least one active checkbox exists, AND no `[~]` deferred items
    # remain. The `roadmap-progress-sync` rule mandates that such a
    # roadmap be moved to `agents/roadmaps/archive/` in the same response
    # that closes its last open item; `collect()` already excludes that
    # directory, so anything left here is unarchived.
    #
    # Deferred items are intentionally excluded — they block silent
    # archive per Iron Law 3 (see `pending_iron_law_3` below).
    return [
        r for r in roadmaps
        if r.total_active > 0 and r.open_ == 0 and r.deferred == 0
    ]


def merge_gated_pending(roadmaps: list[RoadmapStats]) -> list[RoadmapStats]:
    # Roadmaps whose ONLY remaining open work is merge-gated — i.e. every
    # `[ ]` item is held open on purpose while a closing PR is in flight
    # (see module docstring). `count_open > 0` keeps them out of
    # `unarchived_complete`, so without this detector a merge-gated
    # roadmap silently lingers at e.g. 97% the moment its PR merges and
    # nobody re-runs the closure. This is the always-on visibility
    # backstop — surfaced in the dashboard and as an stderr warning, but
    # NOT a hard-fail (an open gating PR is a legitimate state).
    return [
        r for r in roadmaps
        if r.open_ > 0 and r.merge_gated == r.open_
    ]


def pending_iron_law_3(roadmaps: list[RoadmapStats]) -> list[RoadmapStats]:
    # Roadmaps with no open work but unresolved `[~]` deferred items.
    # Per `roadmap-progress-sync` Iron Law 3 the agent must NOT auto-
    # archive these — surface the deferred items and ask the user
    # (spawn follow-up, restore, or convert). The dashboard merely
    # reports the state; the obligation lives in the rule.
    return [
        r for r in roadmaps
        if r.total_active > 0 and r.open_ == 0 and r.deferred > 0
    ]


def collect_bundles(repo_root: Path) -> list[dict]:
    """Read agents/tickets/_registry.yml (one scan) and count tickets per bundle.

    Graceful: returns [] when there is no registry or pyyaml is unavailable —
    consumer repos without bundles or without yaml simply get no bundle section.
    """
    reg = repo_root / "agents" / "tickets" / "_registry.yml"
    if not reg.exists():
        return []
    try:
        import yaml  # optional — see docstring
    except ImportError:
        return []
    try:
        data = yaml.safe_load(reg.read_text(encoding="utf-8")) or {}
    except Exception:  # noqa: BLE001 - a malformed registry must not break the dashboard
        return []
    out: list[dict] = []
    for slug, meta in sorted((data.get("bundles") or {}).items()):
        meta = meta or {}
        bdir = repo_root / "agents" / "tickets" / slug
        n = len(list(bdir.glob("T-*.md"))) if bdir.is_dir() else 0
        out.append({
            "slug": slug,
            "tickets": n,
            "status": meta.get("status", "?"),
            "roadmap": meta.get("source_roadmap", ""),
        })
    return out


def render(roadmaps: list[RoadmapStats], bundles: list[dict] | None = None) -> str:
    total_done = sum(r.done for r in roadmaps)
    total_active = sum(r.total_active for r in roadmaps)
    overall_pct = round(total_done * 100 / total_active) if total_active else 0
    pending = pending_iron_law_3(roadmaps)
    gated = merge_gated_pending(roadmaps)
    lines: list[str] = []
    lines.append("# Roadmap Progress\n")
    header_meta = (
        f"> {len(roadmaps)} open roadmap"
        f"{'s' if len(roadmaps) != 1 else ''}"
        " · [roadmaps/](roadmaps/) · [archive/](roadmaps/archive/) · "
        "[skipped/](roadmaps/skipped/) · [later/](roadmaps/later/)\n"
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
    if pending:
        lines.append("## ⚠️ Iron Law 3 — unresolved deferred items\n")
        lines.append(
            "These roadmaps have `count_open == 0` but carry `[~]` deferred "
            "items. Per `roadmap-progress-sync` Iron Law 3 they do NOT "
            "auto-archive — the user must resolve the deferrals first "
            "(spawn follow-up, restore, or cancel). See "
            "[`roadmap-management § 4b`](../packages/core/.agent-src.uncondensed/skills/roadmap-management/SKILL.md).\n"
        )
        lines.append("| Roadmap | Done | Deferred | Cancelled |")
        lines.append("|---|---:|---:|---:|")
        for r in pending:
            lines.append(f"| [{r.rel}](roadmaps/{r.rel}) | {r.done} | "
                         f"{r.deferred} | {r.cancelled} |")
        lines.append("")
    if gated:
        lines.append("## ⏳ Merge-gated — pending post-merge archival\n")
        lines.append(
            "Every open item in these roadmaps is `merge-gated`: held open "
            "on purpose while a closing PR is in flight, so inbound "
            "references keep resolving until the file archives. **The moment "
            "the gating PR merges**, flip the merge-gated box → `[x]`, "
            "`git mv` the roadmap to `archive/`, migrate inbound refs, and "
            "regenerate this dashboard — all in the same response (per "
            "`roadmap-progress-sync` Iron Law 1). Do NOT leave it lingering "
            "at < 100%.\n"
        )
        lines.append("| Roadmap | Done | Merge-gated open | Gating PR |")
        lines.append("|---|---:|---:|---|")
        for r in gated:
            prs = ", ".join(f"#{n}" for n in r.merge_gated_prs) or "—"
            lines.append(f"| [{r.rel}](roadmaps/{r.rel}) | {r.done} | "
                         f"{r.merge_gated} | {prs} |")
        lines.append("")
    if not roadmaps:
        lines.append("_No open roadmaps._\n")
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
    if bundles:
        lines.append("---\n")
        lines.append("## Ticket bundles\n")
        lines.append(
            "Materialised ticket bundles under [`agents/tickets/`](tickets/) "
            "(via `/roadmap:materialize`), counted from "
            "`agents/tickets/_registry.yml`.\n"
        )
        lines.append("| Bundle | Tickets | Status | Source roadmap |")
        lines.append("|---|---:|---|---|")
        for b in bundles:
            lines.append(
                f"| {b['slug']} | {b['tickets']} | {b['status']} | "
                f"{b['roadmap']} |"
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
    new_text = render(roadmaps, collect_bundles(args.repo_root))
    current = target.read_text(encoding="utf-8") if target.exists() else ""
    complete = unarchived_complete(roadmaps)
    pending = pending_iron_law_3(roadmaps)
    gated = merge_gated_pending(roadmaps)

    def _warn_merge_gated() -> None:
        # Always-on, loud-but-not-fatal: a merge-gated roadmap is a
        # legitimate state while its PR is open, but it must never hide.
        # The moment the gating PR merges, the agent flips + archives.
        print("⏳  Merge-gated roadmaps (every open item gated on a PR) — "
              "flip + archive the moment the gating PR merges "
              "(`roadmap-progress-sync` Iron Law 1):", file=sys.stderr)
        for r in gated:
            prs = ", ".join(f"#{n}" for n in r.merge_gated_prs) or "PR unknown"
            print(f"      - {r.rel}  ({r.done}/{r.total_active} done · "
                  f"{r.merge_gated} merge-gated · {prs})", file=sys.stderr)

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
        if pending:
            print("❌  Iron Law 3 — roadmaps with unresolved `[~]` deferred "
                  "items must NOT auto-archive. Resolve via `roadmap-management § 4b` "
                  "(spawn follow-up, restore, or cancel):", file=sys.stderr)
            for r in pending:
                print(f"      - {r.rel}  ({r.done}/{r.total_active} done · "
                      f"{r.deferred} deferred)", file=sys.stderr)
        if gated:
            _warn_merge_gated()
        if stale or complete or pending:
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
    if pending:
        print("⚠️   Iron Law 3 — roadmaps with unresolved `[~]` deferred items. "
              "Surface them and ask the user (`roadmap-management § 4b`) "
              "before any archive:", file=sys.stderr)
        for r in pending:
            print(f"      - {r.rel}  ({r.deferred} deferred)", file=sys.stderr)
    if gated:
        _warn_merge_gated()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
