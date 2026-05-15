"""Per-provider CLI install hints for ``mode: cli`` members (step-9 P2).

When ``build_members`` cannot construct a ``mode: cli`` member because
the binary is missing on PATH, it records a skip entry of shape
``{"member": <provider>, "reason": "binary_missing", "detail": <msg>}``
in the caller's ``skipped`` list. This module turns that bookkeeping
into an actionable pre-flight banner — one line per skipped member —
so the user sees *which* CLI to install, *where* to get it, and
*how* to disable the CLI route as a fallback.

The table is intentionally small and stdlib-only (no HTTP fetch, no
new dependency): provider → ``(binary, docs_url, one_liner_install)``.
Surfaced by ``scripts/council_cli.py`` in ``cmd_estimate`` / ``cmd_ask``
/ ``cmd_debate`` immediately after the cost-estimate header so missing
CLIs are visible BEFORE the cost decision, not buried in stderr.

Closes PR #150 follow-up **C1** (Claude · UX). See
``agents/roadmaps/step-9-pr150-feedback-hardening.md`` Phase 2.
"""
from __future__ import annotations

from typing import Iterable, Mapping

#: Provider → ``(binary, docs_url, one_liner_install)``.
#:
#: - ``binary``: executable name the CLI client looks for via
#:   ``shutil.which``. Matches ``default_binary`` on the
#:   ``CliClient`` subclass in ``scripts/ai_council/clients.py``.
#: - ``docs_url``: canonical install page. Stable upstream URL —
#:   when a vendor renames the page, update here.
#: - ``one_liner_install``: shortest copy-pasteable install
#:   command. Plain shell, no curl-pipe-bash. Users with stricter
#:   policies are expected to follow ``docs_url`` instead.
#:
#: Vendor-official transports (anthropic, openai, gemini) ship as
#: subscription-authed binaries — install once, ``billable=False``.
#: Community wrappers (xai, perplexity) consume an API key and stay
#: ``billable=True`` even on the CLI route — the hint links to the
#: community project so the user knows what they are installing.
INSTALL_HINTS: dict[str, tuple[str, str, str]] = {
    "anthropic": (
        "claude",
        "https://docs.anthropic.com/en/docs/claude-code/quickstart",
        "npm install -g @anthropic-ai/claude-code",
    ),
    "openai": (
        "codex",
        "https://github.com/openai/codex",
        "npm install -g @openai/codex",
    ),
    "gemini": (
        "gemini",
        "https://github.com/google-gemini/gemini-cli",
        "npm install -g @google/gemini-cli",
    ),
    "xai": (
        "grok",
        "https://github.com/superagent-ai/grok-cli",
        "npm install -g @superagent-ai/grok-cli",
    ),
    "perplexity": (
        "perplexity",
        "https://github.com/perplexityai/perplexity-cli",
        "npm install -g perplexity-cli",
    ),
}


def hint_for(provider: str) -> tuple[str, str, str] | None:
    """Return ``(binary, docs_url, one_liner)`` for ``provider``, else ``None``.

    Unknown providers (community additions not yet table-listed) return
    ``None`` so the caller can fall through to a generic message rather
    than crashing the pre-flight banner.
    """
    return INSTALL_HINTS.get(provider)


def format_install_hints(skipped: Iterable[Mapping[str, object]]) -> str:
    """Render the per-skip pre-flight banner.

    ``skipped`` is the list ``build_members`` populates — each entry
    carries ``member`` (provider name), ``reason`` (``binary_missing``
    or future variants), and ``detail`` (the raw ``CliClientError``
    message). Output shape, one line per entry:

    ::

        council:cli-skip · <provider> · binary not found · install: <one_liner> · docs: <url>

    For providers with no entry in ``INSTALL_HINTS`` (community additions
    not yet listed), falls back to the raw ``detail`` so the user still
    sees the failure mode.

    Returns ``""`` when ``skipped`` is empty so callers can write the
    string unconditionally without a leading blank line.

    Only ``reason == "binary_missing"`` entries get the install line —
    other reasons (future: ``auth_expired``, ``parse_failed`` during
    pre-flight probes) reuse the raw detail without an install hint.
    """
    lines: list[str] = []
    for entry in skipped:
        name = str(entry.get("member", "?"))
        reason = str(entry.get("reason", ""))
        detail = str(entry.get("detail", ""))
        if reason != "binary_missing":
            lines.append(
                f"council:cli-skip · {name} · {reason or 'unknown'} · {detail}"
            )
            continue
        hint = hint_for(name)
        if hint is None:
            lines.append(
                f"council:cli-skip · {name} · binary not found · {detail}"
            )
            continue
        _binary, url, one_liner = hint
        lines.append(
            f"council:cli-skip · {name} · binary not found · "
            f"install: {one_liner} · docs: {url}"
        )
    return "\n".join(lines)
