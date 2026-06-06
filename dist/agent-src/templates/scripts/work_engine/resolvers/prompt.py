"""Prompt resolver — wrap a raw user prompt as an :class:`Input` envelope.

The resolver is intentionally minimal. It accepts a raw string, validates
that it contains non-whitespace content, and returns
``Input(kind="prompt", data={"raw": <text>, "reconstructed_ac": [],
"assumptions": []})``. The empty AC + assumptions lists are placeholders
that the ``refine-prompt`` skill (R2 Phase 3) fills in once the engine
runs the deterministic ``refine`` gate against the raw text.

Why split the resolver from the refiner:

- The resolver runs at command boundaries (the ``/work`` entrypoint
  builds an envelope, then hands off to ``work_engine``). It must stay
  side-effect-free and dependency-light so the command shell can call
  it without touching the LLM-facing skill harness.
- The refiner runs inside the dispatcher loop and is allowed to halt
  (medium-confidence assumptions report, low-confidence one-question
  block) per :doc:`docs/contracts/implement-ticket-flow.md`. That
  control-flow surface does not belong in a resolver.

Future R3 resolvers (``diff``, ``file``) follow the same pattern: thin
normalisation, no interpretation, one envelope shape per kind.
"""
from __future__ import annotations

from ..state import Input

KIND = "prompt"
"""Wire value carried in :attr:`work_engine.state.Input.kind`."""

_MIN_PROMPT_LEN = 1
"""Minimum non-whitespace character count for a resolvable prompt.

Set to 1 by design — the resolver is not a quality gate. It only
rejects literally empty / whitespace-only payloads (which cannot be
distinguished from missing input). Quality judgment (is the prompt
clear? is it tractable?) is the ``refine-prompt`` skill's job, surfaced
through the confidence band, not the resolver's."""


class PromptResolverError(ValueError):
    """Raised when a payload cannot be resolved into a prompt envelope."""


def build_envelope(raw: str) -> Input:
    """Return an :class:`Input` carrying the raw prompt + empty refinement slots.

    Parameters
    ----------
    raw:
        The user-supplied prompt text. Leading/trailing whitespace is
        preserved verbatim — the refiner reads the original casing and
        spacing when scoring goal clarity, so collapsing whitespace
        here would lose signal.

    Returns
    -------
    Input
        Envelope of shape
        ``{"kind": "prompt", "data": {"raw": <raw>,
        "reconstructed_ac": [], "assumptions": []}}``. The two empty
        lists are placeholders the ``refine-prompt`` skill writes into
        on the rebound from the ``refine`` step.

    Raises
    ------
    PromptResolverError
        If ``raw`` is not a string, or contains no non-whitespace
        characters (the only case where the envelope would carry no
        actionable signal at all).
    """
    if not isinstance(raw, str):
        raise PromptResolverError(
            f"prompt must be a string; got {type(raw).__name__}",
        )
    if len(raw.strip()) < _MIN_PROMPT_LEN:
        raise PromptResolverError(
            "prompt is empty or whitespace-only — nothing to resolve",
        )
    return Input(
        kind=KIND,
        data={
            "raw": raw,
            "reconstructed_ac": [],
            "assumptions": [],
        },
    )


__all__ = ["KIND", "PromptResolverError", "build_envelope"]
