"""Render ranked matches as a numbered-options block.

Output strictly conforms to `user-interaction` Iron Law:
* Every option is one numbered line.
* Options block stays neutral (no inline `(recommended)` tag).
* Exactly one `Recommendation: N — …` line follows the block.
* The last numbered option is the **as-is** escape hatch — always
  present, no exceptions.

The renderer is purely structural — it does not pick a recommendation
based on free judgment. The first match (highest score, most
specific evidence) becomes the recommendation; ties leave the line
out so the agent doesn't fabricate a tie-break the user didn't ask
for.
"""
from __future__ import annotations

from typing import Mapping

from .types import CommandSpec, Match


AS_IS_LABEL = "Just run the prompt as-is, no command"


def render(
    matches: list[Match],
    specs_by_name: Mapping[str, CommandSpec],
    *,
    as_is_label: str = AS_IS_LABEL,
) -> str:
    """Return the numbered-options block as plain markdown text.

    Empty `matches` ⇒ empty string. The rule never emits anything
    when nothing crossed the floor.
    """
    if not matches:
        return ""
    lines: list[str] = []
    for i, m in enumerate(matches, start=1):
        spec = specs_by_name.get(m.command)
        desc = spec.description if spec and spec.description else ""
        # Trim long descriptions for one-line option labels.
        if len(desc) > 120:
            desc = desc[:117].rstrip() + "..."
        slash = f"/{m.command}"
        if desc:
            lines.append(f"> {i}. {slash} — {desc}")
        else:
            lines.append(f"> {i}. {slash}")
    as_is_index = len(matches) + 1
    lines.append(f"> {as_is_index}. {as_is_label}")
    block = "\n".join(lines)
    rec_line = _recommendation_line(matches, specs_by_name)
    if rec_line:
        return block + "\n\n" + rec_line
    return block


def _recommendation_line(
    matches: list[Match], specs_by_name: Mapping[str, CommandSpec]
) -> str:
    """Single-source recommendation per `user-interaction` Iron Law.

    No recommendation when the top two matches are within 0.05 of
    each other — surfacing a winner there would be fabrication.
    """
    if not matches:
        return ""
    if len(matches) >= 2 and (matches[0].score - matches[1].score) < 0.05:
        return ""
    top = matches[0]
    spec = specs_by_name.get(top.command)
    name = top.command
    rationale = _rationale_for(top, spec)
    return f"**Recommendation: 1 — /{name}** — {rationale}"


def _rationale_for(match: Match, spec: CommandSpec | None) -> str:
    if match.matched_trigger == "both":
        why = f"both the request and context match (`{match.evidence}`)"
    elif match.matched_trigger == "description":
        why = f"the request matches its trigger description (`{match.evidence}`)"
    else:
        why = f"the surrounding context matches its trigger (`{match.evidence}`)"
    return f"{why}. Pick the last option to skip the command and run the prompt as written."
