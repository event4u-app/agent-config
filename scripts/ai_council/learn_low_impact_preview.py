"""Preview builder for ``/memory learn-low-impact`` (step-9 Phase 7).

Default invocation is ``--preview``: build a structured plan describing
which Validated entries would be upstreamed to the package seed without
opening a PR. ``--apply`` (handled by the agent, not this module) is the
explicit opt-in that triggers the actual upstream-contribute PR flow.

The module is import-light by design — pure parsing + redaction + diff
rendering. PR creation lives in the ``upstream-contribute`` skill;
this module only hands the agent the material to surface.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable

from scripts.ai_council.low_impact_corpus import (
    CorpusEntry,
    parse_corpus_strict,
)
from scripts.ai_council.redact_low_impact_entry import (
    RedactionViolation,
    redact_low_impact_entry,
)


_PROVENANCE_RE = re.compile(r"^last-upstreamed:\s*([0-9a-f]{6,40}|0+)\s*$",
                            re.IGNORECASE | re.MULTILINE)


@dataclass(frozen=True)
class PreviewEntry:
    """One Validated bullet that would be upstreamed."""
    phrase: str
    normalised: str
    line_no: int


@dataclass(frozen=True)
class RefusedEntry:
    """A Validated bullet the redactor refused — never upstreams."""
    phrase: str
    line_no: int
    violations: tuple[RedactionViolation, ...]

    def reason(self) -> str:
        return "; ".join(f"{v.category}: {v.snippet}" for v in self.violations)


@dataclass(frozen=True)
class LearnLowImpactPreview:
    """Structured preview for ``/memory learn-low-impact --preview``.

    Consumed by the agent which renders the human-facing preview block,
    then waits for explicit ``--apply`` before invoking
    :doc:`upstream-contribute </skills/upstream-contribute/SKILL>`.
    """
    promoted: tuple[PreviewEntry, ...]
    refused: tuple[RefusedEntry, ...]
    already_seeded: tuple[str, ...]
    last_upstreamed_sha: str
    seed_path: str
    corpus_path: str
    repo_slug: str = ""
    warnings: tuple[str, ...] = field(default_factory=tuple)

    @property
    def has_work(self) -> bool:
        return bool(self.promoted) or bool(self.refused)

    @property
    def would_open_pr(self) -> bool:
        """True when ``--apply`` would actually open a PR.

        Iron Law: any redactor refusal blocks the PR — the author must
        rephrase or drop the offending entry locally and re-run.
        """
        return bool(self.promoted) and not self.refused

    def render(self) -> str:
        """Human-readable preview block.

        Mirrors the rendering convention from ``/memory mine-session``:
        a leading title line, then bucketed entries.
        """
        lines: list[str] = []
        lines.append(
            "## learn-low-impact preview"
            + (f" — repo={self.repo_slug}" if self.repo_slug else "")
        )
        lines.append(f"last-upstreamed: {self.last_upstreamed_sha}")
        lines.append(f"seed: {self.seed_path}")
        lines.append("")
        if self.promoted:
            lines.append(f"### Promoted ({len(self.promoted)})")
            for e in self.promoted:
                lines.append(f"- \"{e.phrase}\"  (line {e.line_no})")
            lines.append("")
        if self.refused:
            lines.append(f"### Refused ({len(self.refused)}) — redactor blocked")
            for r in self.refused:
                lines.append(
                    f"- \"{r.phrase}\"  (line {r.line_no}) — {r.reason()}"
                )
            lines.append("")
        if self.already_seeded:
            lines.append(f"### Already seeded ({len(self.already_seeded)})")
            for phrase in self.already_seeded:
                lines.append(f"- \"{phrase}\"")
            lines.append("")
        if not self.has_work:
            lines.append("> No new validated entries to upstream.")
            lines.append("")
        if self.refused:
            lines.append(
                "> Refusals block the PR. Rephrase the entries locally"
                " (or drop them) and re-run."
            )
        elif self.promoted:
            lines.append(
                "> Re-run with `--apply` to open the draft PR via"
                " `upstream-contribute`."
            )
        return "\n".join(lines).rstrip() + "\n"

    def render_diff(self) -> str:
        """Source-project-stripped diff that ``--apply`` would propose.

        Emits unified-diff-style ``+`` lines for each promoted phrase
        under the seed file's ``## Validated`` section. The agent uses
        this as the ``upstream-contribute`` patch body.
        """
        if not self.promoted:
            return ""
        lines = [f"--- {self.seed_path}", f"+++ {self.seed_path}"]
        for e in self.promoted:
            lines.append(f'+- "{e.phrase}"')
        return "\n".join(lines) + "\n"

    def render_pr_body(self) -> str:
        """Draft PR body for the upstream contribute flow."""
        n = len(self.promoted)
        slug = self.repo_slug or "<repo-slug>"
        title = f"feat(low-impact-seed): add {n} validated entries from {slug}"
        body_lines: list[str] = [
            f"# {title}",
            "",
            "Upstream from `/memory learn-low-impact --apply`.",
            "",
            "## Entries",
            "",
        ]
        for e in self.promoted:
            body_lines.append(f'- "{e.phrase}"')
        body_lines.append("")
        body_lines.append(
            f"Provenance baseline: `{self.last_upstreamed_sha}`."
        )
        body_lines.append("")
        body_lines.append(
            "Per `low-impact-corpus-privacy-floor`, every entry above"
            " cleared the redactor on intake and again at upstream."
        )
        return "\n".join(body_lines) + "\n"


def _read_seed_phrases(seed_path: Path) -> set[str]:
    """Return the set of normalised phrases already in the seed file.

    Missing seed file is not an error — it returns an empty set so the
    first-ever upstream PR can seed the whole corpus. Reuses the
    strict parser so the seed itself is contract-validated.
    """
    if not seed_path.exists():
        return set()
    result = parse_corpus_strict(seed_path)
    return {e.normalised for e in result.validated}


def _read_provenance(corpus_path: Path) -> str:
    if not corpus_path.exists():
        return "0" * 40
    text = corpus_path.read_text(encoding="utf-8")
    m = _PROVENANCE_RE.search(text)
    return m.group(1).lower() if m else "0" * 40


def build_preview(
    corpus_path: "object",
    seed_path: "object",
    *,
    repo_root: str | None = None,
    private_domains: Iterable[str] = (),
    customer_names: Iterable[str] = (),
    sql_identifiers: Iterable[str] = (),
    repo_slug: str = "",
) -> LearnLowImpactPreview:
    """Build the preview plan without performing any PR side-effects.

    Steps mirror the command doc:

    1. Parse the local corpus (strict — drift surfaces as ParseError).
    2. Diff Validated entries against the upstream seed.
    3. Run the redactor on every candidate.
    4. Bucket into promoted / refused / already-seeded.
    """
    corpus_p = Path(str(corpus_path))
    seed_p = Path(str(seed_path))
    parsed = parse_corpus_strict(corpus_p)
    seeded = _read_seed_phrases(seed_p)
    promoted: list[PreviewEntry] = []
    refused: list[RefusedEntry] = []
    already: list[str] = []
    for entry in parsed.validated:
        if entry.normalised in seeded:
            already.append(entry.phrase)
            continue
        result = redact_low_impact_entry(
            entry.phrase,
            repo_root=repo_root,
            private_domains=private_domains,
            customer_names=customer_names,
            sql_identifiers=sql_identifiers,
        )
        if result.ok:
            promoted.append(PreviewEntry(
                phrase=entry.phrase,
                normalised=entry.normalised,
                line_no=entry.line_no,
            ))
        else:
            refused.append(RefusedEntry(
                phrase=entry.phrase,
                line_no=entry.line_no,
                violations=result.violations,
            ))
    return LearnLowImpactPreview(
        promoted=tuple(promoted),
        refused=tuple(refused),
        already_seeded=tuple(already),
        last_upstreamed_sha=_read_provenance(corpus_p),
        seed_path=str(seed_p),
        corpus_path=str(corpus_p),
        repo_slug=repo_slug,
        warnings=parsed.warnings,
    )
