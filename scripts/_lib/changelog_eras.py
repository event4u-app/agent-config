"""Shared constants + helpers for CHANGELOG.md era discipline.

The drift gate (``tests/test_changelog_eras.py``) and the release
automation (``scripts/release.py``) both reason about the same era
shape: a single ``# Era: X.Y.x — current`` header followed by inline
entries, then ``# Era: pre-X.Y.0 — archived`` pointers to files under
``docs/archive/``. Keeping the regex / cap / path constants in one
place prevents drift between the gate and the auto-split logic.

Normative source: ``docs/contracts/CHANGELOG-conventions.md § Era splits``.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
CHANGELOG = REPO_ROOT / "CHANGELOG.md"
CONVENTIONS = REPO_ROOT / "docs" / "contracts" / "CHANGELOG-conventions.md"
ARCHIVE_DIR = REPO_ROOT / "docs" / "archive"

# Drift cap — entries between the current era header and the next era
# header may not exceed this many lines. Raising the cap is a contract
# change (see CHANGELOG-conventions.md § Era splits).
CURRENT_ERA_BODY_CAP = 250

ERA_HEADER_RE = re.compile(
    r"^# Era: (?P<label>[^\n]+?)(?: — (?P<state>current|archived))?\s*$"
)
ARCHIVE_LINK_RE = re.compile(r"\(docs/archive/(CHANGELOG-pre-[^)\s]+\.md)\)")
VERSION_HEADING_RE = re.compile(r"^## \[?(?P<version>\d+\.\d+\.\d+)")
ERA_LABEL_RE = re.compile(r"^(?P<major>\d+)\.(?P<minor>\d+)\.x$")


@dataclass(frozen=True)
class EraSpan:
    """One era header in CHANGELOG.md, with its line index."""

    line_index: int
    label: str
    state: str  # "current" | "archived" | ""


def read_changelog_lines() -> list[str]:
    """Return CHANGELOG.md split into lines (no trailing newlines)."""
    return CHANGELOG.read_text(encoding="utf-8").splitlines()


def era_spans(lines: list[str]) -> list[EraSpan]:
    """Return every era header in line-order."""
    spans: list[EraSpan] = []
    for i, line in enumerate(lines):
        m = ERA_HEADER_RE.match(line)
        if m:
            spans.append(
                EraSpan(
                    line_index=i,
                    label=m.group("label"),
                    state=m.group("state") or "",
                )
            )
    return spans


def current_era_index(spans: list[EraSpan]) -> int | None:
    """Return the line index of the ``— current`` era header, or None."""
    for span in spans:
        if span.state == "current":
            return span.line_index
    return None


def current_era_body_size(lines: list[str] | None = None) -> int:
    """Return the number of lines between the current era header and
    the next era header (exclusive of both)."""
    if lines is None:
        lines = read_changelog_lines()
    spans = era_spans(lines)
    current_idx = current_era_index(spans)
    if current_idx is None:
        return 0
    next_era_line = len(lines)
    for span in spans:
        if span.line_index > current_idx:
            next_era_line = span.line_index
            break
    return next_era_line - current_idx - 1


def parse_era_label(label: str) -> tuple[int, int] | None:
    """Parse ``M.N.x`` into ``(M, N)``; return None for archived labels."""
    m = ERA_LABEL_RE.match(label.strip())
    if not m:
        return None
    return int(m.group("major")), int(m.group("minor"))


def archive_path_for_boundary(boundary: str) -> Path:
    """Return ``docs/archive/CHANGELOG-pre-<boundary>.md``."""
    return ARCHIVE_DIR / f"CHANGELOG-pre-{boundary}.md"


def collapsed_era_block(boundary: str) -> str:
    """Render the standard ``# Era: pre-<boundary> — archived`` pointer
    block that replaces archived entries in CHANGELOG.md.

    Mirrors the wording the manual splits already used (verified against
    every existing collapsed era as of 3.2.x).
    """
    archive_rel = f"docs/archive/CHANGELOG-pre-{boundary}.md"
    return (
        f"# Era: pre-{boundary} — archived\n"
        "\n"
        f"> All entries before `{boundary}` live in\n"
        f"> [`{archive_rel}`]({archive_rel}).\n"
        "> The archive is read-only; git tags remain the canonical\n"
        "> source for what shipped. Splitting them out of the main file\n"
        "> keeps the active era under the 250-line drift cap enforced by\n"
        "> `tests/test_changelog_eras.py`.\n"
    )


def archive_file_header(boundary: str) -> str:
    """Return the standard prologue for ``docs/archive/CHANGELOG-pre-<boundary>.md``."""
    return (
        f"# Changelog Archive — pre-{boundary}\n"
        "\n"
        f"> Frozen snapshot of `event4u/agent-config` changelog entries\n"
        f"> released before `{boundary}`, split out of the main\n"
        "> [`CHANGELOG.md`](../../CHANGELOG.md) by `scripts/release.py`\n"
        "> once the active era's body crossed the drift cap enforced by\n"
        "> `tests/test_changelog_eras.py`.\n"
        ">\n"
        "> **Read-only.** New entries land in `CHANGELOG.md`. Entries\n"
        "> here are not amended — git tags remain the canonical source\n"
        "> for what shipped.\n"
        ">\n"
        "> Entry shape follows\n"
        "> [`../contracts/CHANGELOG-conventions.md`](../contracts/CHANGELOG-conventions.md).\n"
        "\n"
    )


# ─── split planning + execution ────────────────────────────────────────────────


_RELEASE_VERSION_RE = re.compile(r"^(\d+)\.(\d+)\.(\d+)$")


@dataclass(frozen=True)
class SplitPlan:
    """Recipe for an era split during release of ``release_version``."""

    release_version: str  # e.g. "3.3.0"
    boundary: str  # e.g. "3.3.0" — used in archive filename + pointer
    new_era_label: str  # e.g. "3.3.x"
    old_era_label: str  # e.g. "3.2.x"
    archive_path: Path

    @property
    def commit_subject(self) -> str:
        return (
            f"chore(changelog): split era {self.old_era_label} "
            f"→ pre-{self.boundary}"
        )


def plan_split(release_version: str) -> SplitPlan | None:
    """Plan an era split when releasing ``release_version``.

    Returns None when no split is needed (release is a patch within the
    current era, or no current era header exists). Returns a SplitPlan
    when the release crosses a minor or major boundary; the caller
    decides whether to invoke ``perform_split`` based on era body size.

    Raises ValueError when ``release_version`` is not bare semver, or
    when it would move backward relative to the current era label.
    """
    m = _RELEASE_VERSION_RE.match(release_version.strip())
    if not m:
        raise ValueError(f"not a bare semver (X.Y.Z): {release_version!r}")
    rel_major, rel_minor, _rel_patch = (int(m.group(i)) for i in (1, 2, 3))

    lines = read_changelog_lines()
    spans = era_spans(lines)
    current = next((s for s in spans if s.state == "current"), None)
    if current is None:
        return None

    parsed = parse_era_label(current.label)
    if parsed is None:
        return None
    era_major, era_minor = parsed

    if (rel_major, rel_minor) < (era_major, era_minor):
        raise ValueError(
            f"release {release_version!r} is older than current era "
            f"{current.label!r}; refusing to plan a backwards split"
        )
    if (rel_major, rel_minor) == (era_major, era_minor):
        # Patch release within the current era — no era boundary crossed,
        # so an auto-split would create a nonsensical archive name. The
        # caller is expected to die() with the manual-intervention message.
        return None

    boundary = f"{rel_major}.{rel_minor}.0"
    return SplitPlan(
        release_version=release_version,
        boundary=boundary,
        new_era_label=f"{rel_major}.{rel_minor}.x",
        old_era_label=current.label,
        archive_path=archive_path_for_boundary(boundary),
    )


def new_era_intro_block(new_era_label: str, boundary: str) -> str:
    """Render the header + blockquote intro for a freshly-split current era."""
    parsed = parse_era_label(new_era_label)
    if parsed is None:
        next_example = "# Era: <next>.x"
    else:
        m, n = parsed
        next_example = f"# Era: {m}.{n + 1}.x"
    return (
        f"# Era: {new_era_label} — current\n"
        "\n"
        f"> Started at `{boundary}`. Full entries live inline below.\n"
        "> The drift test caps this era at 250 lines of entry body; growth past\n"
        f"> that forces a new era split (`{next_example}`, etc.) — see\n"
        "> [`docs/contracts/CHANGELOG-conventions.md § Era splits`](docs/contracts/CHANGELOG-conventions.md).\n"
    )


def _era_body_bounds(
    lines: list[str], current_idx: int
) -> tuple[int, int, int]:
    """Return ``(body_start, body_end, next_era_line)`` for the era at
    ``current_idx``.

    * ``body_start`` — first line after the header + leading blockquote
      intro + the blank line that follows.
    * ``body_end`` — exclusive; one line before the next era marker (or
      end of file). Trailing blank lines are NOT trimmed; the caller
      reattaches them on splice.
    * ``next_era_line`` — index of the next ``# Era:`` line, or
      ``len(lines)`` when none follows.
    """
    next_era_line = len(lines)
    for i in range(current_idx + 1, len(lines)):
        if ERA_HEADER_RE.match(lines[i]):
            next_era_line = i
            break

    cursor = current_idx + 1
    # Skip leading blank lines between header and blockquote intro.
    while cursor < next_era_line and lines[cursor].strip() == "":
        cursor += 1
    # Skip the leading blockquote intro (consecutive `>`-prefixed lines).
    while cursor < next_era_line and lines[cursor].startswith(">"):
        cursor += 1
    # Skip the blank separator between intro and entries.
    while cursor < next_era_line and lines[cursor].strip() == "":
        cursor += 1

    return cursor, next_era_line, next_era_line


def current_era_insertion_point(lines: list[str]) -> int | None:
    """Return the line index at which a new release entry should be
    prepended within the current era.

    Strategy:
    * If the current era body contains one or more ``## [X.Y.Z]``
      headings, return the line of the topmost (newest) one.
    * Otherwise, return the first line after the era intro blockquote.

    Returns None when no current era header exists.
    """
    spans = era_spans(lines)
    current_idx = current_era_index(spans)
    if current_idx is None:
        return None
    body_start, body_end, _ = _era_body_bounds(lines, current_idx)
    for i in range(body_start, body_end):
        if VERSION_HEADING_RE.match(lines[i]):
            return i
    return body_start


def perform_split(plan: SplitPlan) -> None:
    """Execute ``plan`` against the on-disk CHANGELOG.md.

    * Refuses to overwrite an existing archive file.
    * Moves every entry in the current era body into the new archive.
    * Replaces the current era block with the collapsed pointer + the
      freshly-labelled new current era header (empty body).
    """
    if plan.archive_path.exists():
        raise FileExistsError(
            f"archive already exists at {plan.archive_path} — "
            "likely a previous --resume run; inspect manually"
        )

    lines = read_changelog_lines()
    spans = era_spans(lines)
    current_idx = current_era_index(spans)
    if current_idx is None:
        raise RuntimeError("no current era header found in CHANGELOG.md")

    body_start, _, next_era_line = _era_body_bounds(lines, current_idx)
    entries = lines[body_start:next_era_line]
    # Trim trailing blank lines so the archive doesn't accumulate them.
    while entries and entries[-1].strip() == "":
        entries.pop()

    collapsed = collapsed_era_block(plan.boundary).rstrip("\n").splitlines()
    new_era = new_era_intro_block(plan.new_era_label, plan.boundary).rstrip("\n").splitlines()

    head = lines[:current_idx]
    tail = lines[next_era_line:]
    new_lines = head + collapsed + [""] + new_era + [""] + tail
    new_text = "\n".join(new_lines).rstrip() + "\n"

    archive_body = "\n".join(entries).rstrip() + "\n" if entries else ""
    archive_text = archive_file_header(plan.boundary) + archive_body

    plan.archive_path.parent.mkdir(parents=True, exist_ok=True)
    plan.archive_path.write_text(archive_text, encoding="utf-8")
    CHANGELOG.write_text(new_text, encoding="utf-8")
