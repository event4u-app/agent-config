"""Sanitize matcher input to prevent self-echo and quoted-code triggering.

The suggestion engine scores against the user's raw message and the
last 2 turns of context. Two adversarial inputs would otherwise
re-trigger the engine on its own output or on user-pasted code:

* **Self-echo** — the previous turn's suggestion block (`> 1. /commit
  — …`) is part of the conversation context. Scoring against it
  re-surfaces the same commands turn after turn.
* **Quoted code** — user-pasted snippets that mention a command
  (`` `/implement-ticket` ``, fenced ``` ```bash\ngit commit``` ```)
  read like real intent signals to the substring matcher.

Both patterns are stripped here before the matcher sees them. The
sanitiser is **conservative**: only well-formed Markdown fences,
inline-code spans, and the engine's own suggestion-line shape are
removed. Plain prose is untouched so legitimate intent ("commit my
changes please") still scores.
"""
from __future__ import annotations

import re
from typing import Iterable

# Triple-backtick fence — handles language hints (```bash …```) and
# unhinted blocks alike. Non-greedy so adjacent fences don't merge.
_CODE_FENCE_RE = re.compile(r"```.*?```", re.DOTALL)
# Inline code span. Excludes empty `` `` `` and respects single-line scope.
_INLINE_CODE_RE = re.compile(r"`[^`\n]+`")
# Suggestion-block line shape from `render.py`:
#   > 1. /implement-ticket — drive ticket end-to-end…
#   > 2. /refine-ticket — tighten the AC…
# Numbered-options lines starting with `>` and a `/command` token.
_SUGGESTION_LINE_RE = re.compile(
    r"^\s*>\s*\d+\.\s*/[A-Za-z][A-Za-z0-9_-]*\b.*$",
    re.MULTILINE,
)
# As-is escape hatch line — recognisable suffix from render.py.
_AS_IS_LINE_RE = re.compile(
    r"^\s*>\s*\d+\.\s*Just run the prompt as-is.*$",
    re.MULTILINE | re.IGNORECASE,
)
# Header line emitted by render.py.
_SUGGESTION_HEADER_RE = re.compile(
    r"^\s*>\s*💡\s*Your request matches a command.*$",
    re.MULTILINE,
)
# Recommendation line right after the block.
_RECOMMENDATION_LINE_RE = re.compile(
    r"^\s*\*\*Recommendation:\s*\d+\b.*$",
    re.MULTILINE,
)


def strip_code_blocks(text: str) -> str:
    """Remove fenced and inline code spans.

    Fenced blocks first (greedy across newlines, non-greedy across
    fences), then inline backticks. Plain text outside code is left
    bit-identical.
    """
    if not text:
        return text
    out = _CODE_FENCE_RE.sub(" ", text)
    out = _INLINE_CODE_RE.sub(" ", out)
    return out


def strip_suggestion_echo(text: str) -> str:
    """Remove lines that look like the engine's own previous output.

    Matches the four shapes `render.py` emits:

    * the `> 💡 …` header
    * `> N. /command — …` numbered options
    * the `> N. Just run the prompt as-is …` escape hatch
    * the `**Recommendation: N — …` follow-up line

    Anything else (including user-authored quotes that happen to
    mention a command) is preserved — only the engine's distinctive
    block shape is filtered.
    """
    if not text:
        return text
    out = _SUGGESTION_HEADER_RE.sub("", text)
    out = _SUGGESTION_LINE_RE.sub("", out)
    out = _AS_IS_LINE_RE.sub("", out)
    out = _RECOMMENDATION_LINE_RE.sub("", out)
    return out


def sanitize_message(message: str) -> str:
    """Apply both filters to a single user message.

    Order matters: strip code first (a `/command` inside a fence is
    code, not an echo), then strip echoes from what remains.
    """
    return strip_suggestion_echo(strip_code_blocks(message))


def sanitize_context(context_lines: Iterable[str]) -> list[str]:
    """Apply `sanitize_message` to each line of recent-turn context.

    Returns a new list — the caller's list is untouched. Empty strings
    after sanitising are kept out of the result so they don't dilute
    token-overlap scoring.
    """
    out: list[str] = []
    for line in context_lines:
        cleaned = sanitize_message(line)
        if cleaned and cleaned.strip():
            out.append(cleaned)
    return out
