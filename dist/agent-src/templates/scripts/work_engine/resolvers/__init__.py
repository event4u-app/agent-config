"""Input resolvers — turn raw user-supplied payloads into envelopes.

A resolver wraps a typed source (a free-form prompt, a diff, a file
reference) into the canonical :class:`work_engine.state.Input` shape so
the dispatcher only ever speaks one schema. The R1 ticket flow does not
need a resolver — ticket payloads arrive pre-structured from
``/implement-ticket``; R2 introduces :mod:`.prompt`; R3 Phase 1 adds
:mod:`.diff` and :mod:`.file` for the UI-improve track ("improve this
screen via diff/PR" and "improve this existing component/page").

Resolvers are deliberately thin: they normalize, they do not interpret.
Reconstruction of acceptance criteria + assumptions + confidence is the
job of the ``refine-prompt`` skill (R2 Phase 3) called from the
``refine`` step, not the resolver. Keeping the split sharp means the
envelope shape stays cheap to round-trip through state and the heavy
lifting stays with the agent-directive halt where it belongs.
"""
from __future__ import annotations

from . import diff, file, prompt

__all__ = ["diff", "file", "prompt"]
