"""Shared `model_tier` → native Claude `model:` mapping (ADR-034 / ADR-035).

Single source of truth for the tier→model rewrite, used by **both** render
paths so they can never drift:

- the repo generator (`condense.py generate_claude_skills`), which builds the
  package's own `.claude/skills/` tree, and
- the consumer install finalizer (`install.py finalize_claude_model_tiers`),
  which rewrites the installed `.claude/skills/` tree so Claude Code performs
  the per-turn model switch on a consumer with `model.auto_switch: auto`.

Only `auto` triggers the rewrite — `suggest` / `off` keep skills as pure
symlinks so the package never silently overrides a user's explicit `/model`
choice. A skill with `model_tier: inherit` (or no `model_tier`) is never
rewritten.
"""
from __future__ import annotations

import re
from pathlib import Path
from typing import Optional

# Tier → Claude model. The ONLY per-vendor mapping the package maintains
# (ADR-035 § 3); other agents resolve the tier band to their own line-up.
TIER_TO_CLAUDE_MODEL = {"high": "opus", "medium": "sonnet", "lite": "haiku"}

# Matches a `model_tier: <tier>` frontmatter line (quoted or bare).
MODEL_TIER_RE = re.compile(r'^model_tier:\s*"?([a-z]+)"?\s*$', re.MULTILINE)


def read_model_tier(skill_md: Path) -> Optional[str]:
    """Return the `model_tier` frontmatter value, or None if absent/unparsable."""
    if not skill_md.exists():
        return None
    text = skill_md.read_text(encoding="utf-8", errors="replace")
    if not text.startswith("---\n"):
        return None
    end = text.find("\n---\n", 4)
    if end == -1:
        return None
    m = MODEL_TIER_RE.search(text[4:end])
    return m.group(1) if m else None


def render_native_model_md(text: str, tier: str) -> str:
    """Rewrite the first `model_tier: <tier>` line to native `model: <mapped>`.

    The rest of the SKILL.md stays byte-identical. `tier` must be a key of
    :data:`TIER_TO_CLAUDE_MODEL` (callers gate on that).
    """
    model = TIER_TO_CLAUDE_MODEL[tier]
    return MODEL_TIER_RE.sub(f"model: {model}", text, count=1)
