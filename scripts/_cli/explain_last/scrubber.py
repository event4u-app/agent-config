"""PII / cost-metadata scrubber for the ``explain last`` trace.

The standard project redactor under
:mod:`scripts.ai_council.redact_low_impact_entry` is a *refusal* gate —
it returns ``ok=False`` and asks the human to rephrase. The explain
surface cannot refuse to produce output; the user already executed the
upstream command and is now asking *why*. So this module mirrors the
same regex patterns but performs in-place masking instead of refusal.

Masks applied (resolution order):

1. Raw-key secret prefixes (``sk_live_…``, ``ghp_…`` etc.) and inline
   ``api_key=…`` shapes → ``<secret>``.
2. Emails → ``<email>``.
3. Absolute file paths (``/Users/…``, ``/home/…``, ``C:\\…``) →
   ``<path>``.
4. URLs → ``<scheme>://<host>/…`` (path / query / fragment stripped).
5. ``*.internal`` / ``*.local`` hostnames → ``<host>``.
6. Monetary amounts (``$1,234``, ``USD 500``) → ``<money>`` — strips
   billing-cost leakage from council token-usage metadata.
7. Long strings (> 200 chars) → ``<NNN chars>`` summary.

Limits mirror the AI-Council privacy floor at
``.augment/rules/low-impact-corpus-privacy-floor.md`` and the regex
sources at :mod:`scripts.ai_council.redact_low_impact_entry` so behaviour
stays in lockstep when that floor evolves.
"""
from __future__ import annotations

import re
from typing import Any

LONG_STRING_THRESHOLD = 200

_RAW_KEY_PREFIXES = (
    "sk_live_", "sk_test_", "ghp_", "github_pat_", "gho_", "ghs_",
    "ghu_", "xoxb-", "xoxp-", "AIza", "AKIA",
)
_RAW_KEY_RE = re.compile(
    "(?:" + "|".join(re.escape(p) for p in _RAW_KEY_PREFIXES) + r")[A-Za-z0-9_\-]{6,}",
)
_API_KEY_RE = re.compile(
    r"(?i)\bapi[_-]?key\b\s*[:=]\s*[A-Za-z0-9+/=_\-]{12,}",
)
_EMAIL_RE = re.compile(r"\b[\w.+-]+@[\w-]+\.[\w.-]+\b")
_PATH_RE = re.compile(
    r"(?:/Users/|/home/|/opt/|/private/|[A-Z]:\\)[\w.\-/\\]+",
)
_URL_RE = re.compile(
    r"\b(?P<scheme>https?|ftp|ws|wss)://(?P<host>[^\s/:?#]+)(?:[^\s]*)?",
)
_INTERNAL_HOST_RE = re.compile(
    r"\b[a-zA-Z0-9][\w.-]*\.(?:internal|local)\b",
    re.IGNORECASE,
)
_MONEY_RE = re.compile(
    r"(?:[\$€£¥]\s?\d{1,3}(?:[,.]\d{3})*(?:\.\d+)?"
    r"|\b(?:USD|EUR|GBP|JPY)\s?\d+(?:[,.]\d+)?)",
)


def _strip_url(match: re.Match[str]) -> str:
    return f"{match.group('scheme')}://{match.group('host')}/…"


def scrub_string(value: str) -> str:
    """Mask every forbidden pattern in ``value`` and return the result.

    Idempotent — running the scrubber twice yields the same string.
    Order matters: secrets fire first because their substrings overlap
    with paths and URLs; URLs come before the generic ``<path>`` sweep
    so a ``https://…`` link is not partially rewritten as a path.
    """
    if not isinstance(value, str) or not value:
        return value
    out = _RAW_KEY_RE.sub("<secret>", value)
    out = _API_KEY_RE.sub("api_key=<secret>", out)
    out = _EMAIL_RE.sub("<email>", out)
    out = _URL_RE.sub(_strip_url, out)
    out = _PATH_RE.sub("<path>", out)
    out = _INTERNAL_HOST_RE.sub("<host>", out)
    out = _MONEY_RE.sub("<money>", out)
    if len(out) > LONG_STRING_THRESHOLD:
        return f"<{len(out)} chars>"
    return out


def scrub_value(value: Any) -> Any:
    """Recursively scrub strings inside lists / dicts / tuples.

    Booleans, numbers, and ``None`` are returned as-is. Dict keys are
    *not* scrubbed (they are schema names, not user payloads); only
    values pass through :func:`scrub_string`. Tuples are normalised to
    lists because the trace lands as JSON.
    """
    if isinstance(value, str):
        return scrub_string(value)
    if isinstance(value, dict):
        return {key: scrub_value(val) for key, val in value.items()}
    if isinstance(value, (list, tuple)):
        return [scrub_value(item) for item in value]
    return value


__all__ = ["LONG_STRING_THRESHOLD", "scrub_string", "scrub_value"]
