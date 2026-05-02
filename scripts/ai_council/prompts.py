"""Neutrality system prompts for the council.

Council members must NOT see the host agent's reasoning, internal
state, or framing language. Each prompt asks for an independent
critique on the artefact's own merits.

Anti-patterns guarded against in tests (test_prompts.py):
- No leak of host-agent identity ("Augment", "Claude Code", etc.).
- No "the agent thinks X" framing.
- No instructions that bias toward agreement.
"""

from __future__ import annotations

from scripts.ai_council.project_context import ProjectContext

NEUTRALITY_PREAMBLE = """\
You are an independent reviewer. You have NOT seen any prior reasoning,
agent output, or commentary on the artefact below. Critique it on its
own merits. Disagree if warranted. Cite specific lines or sections.
Do not assume the artefact is correct just because it was sent to you.
""".strip()

# Host-agent identity strings that must never leak into a council member's
# view. Lines containing any of these (case-insensitive substring) are
# dropped before assembly. See `ai-council` skill § Neutrality.
HOST_AGENT_IDENTITY_PATTERNS = (
    "augment",
    "claude code",
    "cursor agent",
    "cursor ide",
    "cline",
    "windsurf",
    "copilot agent",
)

# Per-mode addenda — appended after the preamble.

PROMPT_MODE = """\
The artefact is a free-form question or proposal from a developer.
Respond with:
1. Your honest assessment (agree / disagree / mixed).
2. The single strongest argument for your position.
3. The single strongest counter-argument the developer should consider.
4. Concrete next steps if you agree, or concrete alternatives if you disagree.
""".strip()

ROADMAP_MODE = """\
The artefact is a proposed implementation roadmap. Critique it as if
you were a senior engineer asked to greenlight it. Focus on:
1. Hidden coupling between phases that the roadmap glosses over.
2. Steps that are too coarse to verify ("implement X" vs "X with Y test").
3. Missing rollback or kill-switch criteria.
4. Sequencing risks — does step N really not block step N+1?
5. Open questions disguised as decisions, or vice versa.
""".strip()

DIFF_MODE = """\
The artefact is a code diff. Review it for:
1. Correctness — bugs, off-by-one, null-safety, type drift.
2. Security — injection, secrets, unsafe deserialization, authZ gaps.
3. Test coverage — uncovered branches, missing regression tests.
4. Maintainability — surprise dependencies, naming drift, dead code.
End with: APPROVE / REQUEST_CHANGES / REJECT and one sentence why.
""".strip()

FILES_MODE = """\
The artefact is a set of source files for an architectural review.
Map out:
1. The boundaries you see (modules, layers, trust zones).
2. The strongest design decision present.
3. The weakest design decision present.
4. The single change that would most reduce future maintenance cost.
""".strip()


_MODE_TABLE = {
    "prompt": PROMPT_MODE,
    "roadmap": ROADMAP_MODE,
    "diff": DIFF_MODE,
    "files": FILES_MODE,
}


def _strip_host_identity(text: str) -> str:
    """Drop any line containing a host-agent identity string."""
    if not text:
        return text
    kept: list[str] = []
    for line in text.splitlines():
        low = line.lower()
        if any(needle in low for needle in HOST_AGENT_IDENTITY_PATTERNS):
            continue
        kept.append(line)
    return "\n".join(kept)


def handoff_preamble(
    project: ProjectContext | None,
    original_ask: str,
) -> str:
    """Neutral context-handoff for council members.

    Layout (any block omitted when its inputs are empty):

        Project: <name>
        Stack: <stack>
        Purpose: <repo_purpose>

        The user originally asked:
        > <original_ask>

        <NEUTRALITY_PREAMBLE>

    Iron Law of Neutrality (`ai-council` skill): lines containing a
    host-agent identity string (Augment, Claude Code, Cursor, Cline,
    Windsurf, Copilot agent) are dropped from `project` fields and
    `original_ask` BEFORE assembly so they cannot leak.

    `project=None` and/or `original_ask=""` collapses the output to
    `NEUTRALITY_PREAMBLE` alone (back-compat with v1 callers).
    """
    blocks: list[str] = []

    if project is not None and not project.is_empty():
        ctx_lines: list[str] = []
        if project.name:
            ctx_lines.append(f"Project: {project.name}")
        if project.stack:
            ctx_lines.append(f"Stack: {project.stack}")
        if project.repo_purpose:
            ctx_lines.append(f"Purpose: {project.repo_purpose}")
        ctx = _strip_host_identity("\n".join(ctx_lines)).strip()
        if ctx:
            blocks.append(ctx)

    cleaned_ask = _strip_host_identity(original_ask or "").strip()
    if cleaned_ask:
        quoted = "\n".join(f"> {ln}" for ln in cleaned_ask.splitlines())
        blocks.append(f"The user originally asked:\n{quoted}")

    blocks.append(NEUTRALITY_PREAMBLE)
    return "\n\n".join(blocks)


def system_prompt_for(
    mode: str,
    *,
    project: ProjectContext | None = None,
    original_ask: str = "",
) -> str:
    """Build the full system prompt for one of the four input modes.

    Raises ValueError on an unknown mode — callers must use one of
    `prompt`, `roadmap`, `diff`, `files`.

    When `project` and `original_ask` are both omitted, the result is
    `NEUTRALITY_PREAMBLE` + per-mode addendum (v1 shape, byte-identical
    to pre-2a output). When either is supplied, the neutral handoff
    preamble replaces the bare `NEUTRALITY_PREAMBLE`.
    """
    if mode not in _MODE_TABLE:
        raise ValueError(
            f"Unknown council mode {mode!r}. "
            f"Expected one of: {sorted(_MODE_TABLE)}"
        )
    head = handoff_preamble(project, original_ask)
    return f"{head}\n\n{_MODE_TABLE[mode]}"


def all_modes() -> list[str]:
    return sorted(_MODE_TABLE)
