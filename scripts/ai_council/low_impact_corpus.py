"""Hardened parser for ``agents/low-impact-decisions.md`` (step-9 P4).

Replaces the silent-skip behaviour of the inline regex in
``necessity.load_validated_phrases`` with a typed-error contract.

Contract: ``docs/contracts/low-impact-corpus-format.md``.

Two entry points:

- :func:`load_validated_phrases` — back-compat shim used by
  :mod:`scripts.ai_council.necessity` routing. Silently returns the
  successfully-parsed validated phrases (degrades to ``()`` on
  malformed sections so a broken corpus never blocks routing).
- :func:`parse_corpus_strict` — raises :class:`CorpusParseError` on
  the first structural anomaly. Used by CI lint
  (``task lint-low-impact-corpus``) and the strict-mode test suite.

Structural failures (raised in strict mode, dropped silently in
lenient mode):

- ``curly_quotes`` — phrase wrapped in U+201C / U+201D.
- ``single_quotes`` — phrase wrapped in ``'…'`` instead of ``"…"``.
- ``non_dash_bullet`` — ``*``, ``+`` or numbered list marker under a
  section that expects ``- "…"`` bullets.
- ``unclosed_quote`` — opening ``"`` with no matching closing ``"``.
- ``empty_phrase`` — phrase normalises to empty (whitespace /
  punctuation only).
- ``heading_drift`` — heading with the section name but the wrong
  level (e.g. ``### Validated``) or trailing punctuation
  (e.g. ``## Validated:``).
- ``missing_anchor`` — the ``<!-- intake-anchor: validated -->``
  marker is absent (the intake module relies on it to splice new
  probation entries).
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable, Literal


Section = Literal["validated", "probation", "anti_examples"]


_SECTION_TITLES: dict[Section, str] = {
    "validated": "Validated",
    "probation": "On Probation",
    "anti_examples": "Anti-Examples (Always Ask User)",
}

#: Heading-detection regex. ``^##\s+<title>\s*$`` accepts the canonical
#: form; anything else with the title text triggers ``heading_drift``.
_HEADING_OK = re.compile(r"^##\s+(.+?)\s*$")

#: Canonical bullet form: ``- "phrase"`` followed by optional metadata.
_BULLET_OK = re.compile(r'^\s*-\s*"([^"]+)"\s*(.*)$')

#: Non-dash list markers that drift away from the contract.
_BULLET_BAD_MARKER = re.compile(r'^\s*([*+]|\d+\.)\s+["\u201C\u2018\']')

#: Smart-quote and single-quote drift inside an otherwise dash-bulleted line.
_BULLET_CURLY = re.compile(r'^\s*-\s*[\u201C\u2018]')
_BULLET_SINGLE_Q = re.compile(r"^\s*-\s*'")

#: Phrase-normaliser: drop non-word/space, collapse whitespace, lowercase.
_NORM_PUNCT = re.compile(r"[^\w\s]")
_NORM_WS = re.compile(r"\s+")

#: Anchor comment per section.
_ANCHOR = "<!-- intake-anchor: {key} -->"


class CorpusParseError(ValueError):
    """Structural anomaly in the low-impact-decisions corpus.

    Attributes:
        reason: Stable machine-readable failure tag (see module docstring).
        line: 1-based line number of the offending content, or ``None``
            when the failure is file-level (missing anchor, etc.).
        section: Section the anomaly was found in, when known.
    """

    def __init__(
        self, reason: str, *,
        line: int | None = None,
        section: Section | None = None,
        detail: str = "",
    ) -> None:
        self.reason = reason
        self.line = line
        self.section = section
        self.detail = detail
        loc = f" at line {line}" if line is not None else ""
        sec = f" in section '{section}'" if section else ""
        msg = f"corpus parse failed: {reason}{loc}{sec}"
        if detail:
            msg += f" — {detail}"
        super().__init__(msg)


@dataclass(frozen=True)
class CorpusEntry:
    """One parsed bullet entry from a section."""
    phrase: str
    normalised: str
    section: Section
    line_no: int
    trailing_metadata: str = ""


@dataclass(frozen=True)
class CorpusParseResult:
    """Outcome of :func:`parse_corpus_strict`."""
    validated: tuple[CorpusEntry, ...] = ()
    probation: tuple[CorpusEntry, ...] = ()
    anti_examples: tuple[CorpusEntry, ...] = ()
    warnings: tuple[str, ...] = field(default_factory=tuple)

    def phrases(self, section: Section) -> tuple[str, ...]:
        entries: Iterable[CorpusEntry] = getattr(self, section)
        return tuple(e.normalised for e in entries)


def _normalise(phrase: str) -> str:
    return _NORM_WS.sub(" ", _NORM_PUNCT.sub(" ", phrase.lower())).strip()


def _section_bounds(
    text: str, title: str, *, all_titles: tuple[str, ...],
) -> tuple[int, int] | None:
    """Return ``(body_start, body_end)`` for the named section, or ``None``."""
    needle = f"## {title}"
    idx = text.find("\n" + needle)
    if idx < 0 and text.startswith(needle):
        idx = 0
    else:
        idx = idx + 1 if idx >= 0 else -1
    if idx < 0:
        return None
    line_end = text.find("\n", idx)
    if line_end < 0:
        return None
    body_start = line_end + 1
    end = len(text)
    for other in all_titles:
        if other == title:
            continue
        j = text.find("\n## " + other, body_start)
        if 0 <= j < end:
            end = j
    return body_start, end



def _line_no_at(text: str, offset: int) -> int:
    return text.count("\n", 0, offset) + 1


def _scan_section(
    text: str,
    section: Section,
    *,
    body_start: int,
    body_end: int,
    strict: bool,
) -> tuple[tuple[CorpusEntry, ...], tuple[str, ...]]:
    """Parse one section body into entries; raise or warn per ``strict``."""
    title = _SECTION_TITLES[section]
    entries: list[CorpusEntry] = []
    warnings: list[str] = []
    body = text[body_start:body_end]
    base_line = _line_no_at(text, body_start)
    for offset, raw_line in enumerate(body.splitlines()):
        line_no = base_line + offset
        stripped = raw_line.strip()
        if not stripped or stripped.startswith("<!--") or stripped.startswith("#"):
            continue
        if not stripped.startswith("-") and not _BULLET_BAD_MARKER.match(raw_line):
            # Free-form paragraph text; ignored by both modes.
            continue
        if _BULLET_BAD_MARKER.match(raw_line):
            reason = "non_dash_bullet"
            if strict:
                raise CorpusParseError(
                    reason, line=line_no, section=section,
                    detail=f"expected '- \"\u2026\"' bullet, got: {stripped[:40]!r}",
                )
            warnings.append(f"line {line_no}: {reason} (section={section})")
            continue
        if _BULLET_CURLY.match(raw_line):
            reason = "curly_quotes"
            if strict:
                raise CorpusParseError(
                    reason, line=line_no, section=section,
                    detail="use ASCII double quotes (\")",
                )
            warnings.append(f"line {line_no}: {reason} (section={section})")
            continue
        if _BULLET_SINGLE_Q.match(raw_line):
            reason = "single_quotes"
            if strict:
                raise CorpusParseError(
                    reason, line=line_no, section=section,
                    detail="use ASCII double quotes (\")",
                )
            warnings.append(f"line {line_no}: {reason} (section={section})")
            continue
        m = _BULLET_OK.match(raw_line)
        if not m:
            # Dash-bullet but no closed double-quoted phrase \u2192 unclosed quote.
            if stripped.startswith('- "') or stripped.startswith('-"'):
                reason = "unclosed_quote"
                if strict:
                    raise CorpusParseError(
                        reason, line=line_no, section=section,
                        detail="missing closing quote on bullet",
                    )
                warnings.append(f"line {line_no}: {reason} (section={section})")
                continue
            # Dash bullet without any quotes at all \u2192 treat as drift.
            reason = "non_dash_bullet"
            if strict:
                raise CorpusParseError(
                    reason, line=line_no, section=section,
                    detail=f"expected '- \"\u2026\"' bullet, got: {stripped[:40]!r}",
                )
            warnings.append(f"line {line_no}: {reason} (section={section})")
            continue
        phrase = m.group(1)
        trailing = m.group(2).strip() if m.lastindex and m.lastindex >= 2 else ""
        norm = _normalise(phrase)
        if not norm:
            reason = "empty_phrase"
            if strict:
                raise CorpusParseError(
                    reason, line=line_no, section=section,
                    detail="phrase normalises to empty",
                )
            warnings.append(f"line {line_no}: {reason} (section={section})")
            continue
        entries.append(
            CorpusEntry(
                phrase=phrase,
                normalised=norm,
                section=section,
                line_no=line_no,
                trailing_metadata=trailing,
            ),
        )
    _ = title  # silence linter: title surfaced via section enum.
    return tuple(entries), tuple(warnings)



def _check_heading_drift(text: str, title: str) -> tuple[int | None, str | None]:
    """Return ``(line, detail)`` if a near-miss heading is found, else
    ``(None, None)``. Detects ``### Validated``, ``## Validated:``, etc.

    Only reports drift when no canonical heading is also present.
    """
    canonical = f"## {title}"
    if "\n" + canonical + "\n" in text or text.startswith(canonical + "\n"):
        return None, None
    # Search for any heading line containing the title text.
    pattern = re.compile(
        rf"^(#+)\s+{re.escape(title)}([^\n]*)$", re.MULTILINE,
    )
    m = pattern.search(text)
    if not m:
        return None, None
    line_no = _line_no_at(text, m.start())
    hashes = m.group(1)
    tail = m.group(2)
    if hashes != "##" or tail.strip():
        return line_no, f"got '{m.group(0).strip()}', expected '{canonical}'"
    return None, None


def parse_corpus_strict(corpus_path: "object") -> CorpusParseResult:
    """Parse the corpus, raising :class:`CorpusParseError` on anomalies.

    A missing file is **not** an error \u2014 it returns an empty result.
    A present file with structural drift raises.
    """
    p = Path(str(corpus_path))
    if not p.exists():
        return CorpusParseResult()
    text = p.read_text(encoding="utf-8")
    all_titles = tuple(_SECTION_TITLES.values())
    result_sections: dict[Section, tuple[CorpusEntry, ...]] = {
        "validated": (), "probation": (), "anti_examples": (),
    }
    all_warnings: list[str] = []
    found_any = False
    for section, title in _SECTION_TITLES.items():
        drift_line, drift_detail = _check_heading_drift(text, title)
        if drift_line is not None:
            raise CorpusParseError(
                "heading_drift", line=drift_line, section=section,
                detail=drift_detail or "",
            )
        bounds = _section_bounds(text, title, all_titles=all_titles)
        if bounds is None:
            continue
        found_any = True
        body_start, body_end = bounds
        entries, warns = _scan_section(
            text, section,
            body_start=body_start, body_end=body_end, strict=True,
        )
        result_sections[section] = entries
        all_warnings.extend(warns)
    # Anchor presence is checked once we have at least one section.
    if found_any:
        for section in ("validated", "probation"):
            anchor = _ANCHOR.format(key=section)
            if anchor not in text:
                raise CorpusParseError(
                    "missing_anchor", section=section,  # type: ignore[arg-type]
                    detail=f"expected marker {anchor!r}",
                )
    return CorpusParseResult(
        validated=result_sections["validated"],
        probation=result_sections["probation"],
        anti_examples=result_sections["anti_examples"],
        warnings=tuple(all_warnings),
    )


def load_validated_phrases(corpus_path: "object") -> tuple[str, ...]:
    """Back-compat shim used by routing (lenient mode).

    Silently drops malformed lines so a broken corpus never blocks
    classification. Strict-mode contract validation lives in
    :func:`parse_corpus_strict` and the CI lint job.
    """
    p = Path(str(corpus_path))
    if not p.exists():
        return ()
    text = p.read_text(encoding="utf-8")
    all_titles = tuple(_SECTION_TITLES.values())
    bounds = _section_bounds(text, _SECTION_TITLES["validated"], all_titles=all_titles)
    if bounds is None:
        return ()
    entries, _ = _scan_section(
        text, "validated",
        body_start=bounds[0], body_end=bounds[1], strict=False,
    )
    return tuple(e.normalised for e in entries)


__all__ = (
    "CorpusEntry",
    "CorpusParseError",
    "CorpusParseResult",
    "Section",
    "load_validated_phrases",
    "parse_corpus_strict",
)
