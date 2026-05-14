"""Privacy floor for `agents/low-impact-decisions.md` (Phase 12).

Non-bypassable redactor invoked on intake (write-side) AND on
upstream (`/learn-low-impact`, leave-the-repo side). Both gates call
:func:`redact_low_impact_entry` and refuse to proceed when a forbidden
pattern fires.

Iron Law: nothing leaves the project repo until this redactor clears
the entry. See ``.augment/rules/low-impact-corpus-privacy-floor.md``.

Forbidden-content classes (per Phase 12 § Step 4):

1. Secrets — raw-key prefixes mirrored from
   :data:`scripts.ai_council.config._RAW_KEY_PREFIXES`, plus a
   generic ``api[-_]?key:\\s*<token>`` shape.
2. Emails — RFC-5322-ish shape, deliberately permissive.
3. Project-rooted paths — anything starting ``/Users/``, ``/home/``,
   ``/opt/``, ``/private/``, drive letters (``C:\\``), or the
   configured repo root from ``.agent-settings.yml`` when supplied.
4. Customer / tenant names — caller passes a name list (project
   policy); generic placeholders ``<customer>``, ``<tenant>``,
   ``<account>``, ``<user>`` survive.
5. Internal hostnames — ``*.internal``, ``*.local``, plus any
   project-private domain the caller supplies.
6. Monetary amounts — ``$1,234`` / ``€500`` / ``USD 1000`` shapes
   that look like business figures (lone ``$0.05`` cap mentions in
   curly-brace context are skipped via the call-site, not here).
7. Business-context SQL identifiers — caller-supplied table /
   column allow-list. Default empty.
8. Inline code excerpts > 40 chars — any backtick-fenced run > 40.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable

from scripts.ai_council.config import _RAW_KEY_PREFIXES


@dataclass(frozen=True)
class RedactionViolation:
    """Single forbidden-pattern hit."""

    category: str
    snippet: str
    note: str = ""


@dataclass(frozen=True)
class RedactionResult:
    """Outcome of one redaction pass."""

    ok: bool
    violations: tuple[RedactionViolation, ...] = ()

    def summary(self) -> str:
        if self.ok:
            return "redaction: clean"
        parts = [f"{v.category}: {v.snippet!r}" for v in self.violations]
        return "redaction REFUSED — " + "; ".join(parts)


_EMAIL_RE = re.compile(r"\b[\w.+-]+@[\w-]+\.[\w.-]+\b")
_PATH_RE = re.compile(
    r"(?:^|[\s\"'(])"
    r"(?:/Users/|/home/|/opt/|/private/|[A-Z]:\\)"
    r"[\w.\-/\\]+"
)
_INTERNAL_HOST_RE = re.compile(
    r"\b[a-zA-Z0-9][\w.-]*\.(?:internal|local)\b",
    re.IGNORECASE,
)
_MONEY_RE = re.compile(
    r"(?:[\$€£¥]\s?\d{1,3}(?:[,.]\d{3})*(?:\.\d+)?"
    r"|\b(?:USD|EUR|GBP|JPY)\s?\d+(?:[,.]\d+)?)"
)
_API_KEY_RE = re.compile(
    r"(?i)\bapi[_-]?key\b\s*[:=]\s*[A-Za-z0-9+/=_\-]{12,}"
)
_CODE_FENCE_RE = re.compile(r"`([^`]{41,})`")


def _check_secrets(text: str) -> list[RedactionViolation]:
    hits: list[RedactionViolation] = []
    for prefix in _RAW_KEY_PREFIXES:
        pat = re.compile(re.escape(prefix) + r"[A-Za-z0-9_\-]{6,}")
        m = pat.search(text)
        if m:
            hits.append(RedactionViolation(
                "secret", m.group(0)[:8] + "…",
                f"raw-key prefix {prefix!r}",
            ))
    m = _API_KEY_RE.search(text)
    if m:
        hits.append(RedactionViolation("secret", m.group(0)[:20] + "…",
                                       "inline api_key"))
    return hits


def _check_patterns(text: str, repo_root: str | None,
                    private_domains: Iterable[str],
                    customer_names: Iterable[str],
                    sql_identifiers: Iterable[str]) -> list[RedactionViolation]:
    hits: list[RedactionViolation] = []
    for m in _EMAIL_RE.finditer(text):
        hits.append(RedactionViolation("email", m.group(0)))
    for m in _PATH_RE.finditer(text):
        hits.append(RedactionViolation("project_path", m.group(0).strip()))
    if repo_root and repo_root in text:
        hits.append(RedactionViolation("project_path", repo_root,
                                       "configured repo root"))
    for m in _INTERNAL_HOST_RE.finditer(text):
        hits.append(RedactionViolation("internal_hostname", m.group(0)))
    for dom in private_domains:
        if dom and dom in text:
            hits.append(RedactionViolation("internal_hostname", dom,
                                           "configured private domain"))
    for m in _MONEY_RE.finditer(text):
        hits.append(RedactionViolation("monetary_amount", m.group(0)))
    for name in customer_names:
        if name and re.search(rf"\b{re.escape(name)}\b", text, re.IGNORECASE):
            hits.append(RedactionViolation("customer_name", name))
    for ident in sql_identifiers:
        if ident and re.search(rf"\b{re.escape(ident)}\b", text):
            hits.append(RedactionViolation("sql_identifier", ident))
    for m in _CODE_FENCE_RE.finditer(text):
        hits.append(RedactionViolation("long_code_excerpt",
                                       m.group(1)[:40] + "…",
                                       f"{len(m.group(1))} chars"))
    return hits


def redact_low_impact_entry(
    text: str,
    *,
    repo_root: str | None = None,
    private_domains: Iterable[str] = (),
    customer_names: Iterable[str] = (),
    sql_identifiers: Iterable[str] = (),
) -> RedactionResult:
    """Run the privacy floor over ``text``. Returns clean or refused.

    The redactor never auto-rewrites the entry — that would be a soft
    privacy gate. It refuses + surfaces what to rephrase, which keeps
    the user in the loop and the audit trail honest.
    """
    violations: list[RedactionViolation] = []
    violations.extend(_check_secrets(text))
    violations.extend(_check_patterns(
        text, repo_root, private_domains, customer_names, sql_identifiers,
    ))
    return RedactionResult(ok=not violations, violations=tuple(violations))
