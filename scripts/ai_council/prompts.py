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

# Specialised modes — used by /council-pr, /council-design,
# /council-optimize. Selected via `mode_override=` in `/council` so the
# base modes (`prompt`, `roadmap`, `diff`, `files`) keep their v2 byte
# shape for back-compat with existing callers.

PR_MODE = """\
The artefact is a code diff from a pull request. Review with both a
correctness lens AND a shipping-risk lens:
1. Correctness — bugs, off-by-one, null-safety, type drift.
2. Security — injection, secrets, unsafe deserialization, authZ gaps.
3. Test coverage — uncovered branches, missing regression tests.
4. Shipping risk — does this PR mix concerns that should be split?
   Is the blast radius bigger than the title implies?
5. Reviewer fatigue — is anything in the diff that a tired reviewer
   would rubber-stamp but should not?
End with: APPROVE / REQUEST_CHANGES / REJECT, one sentence why, and
the single highest-leverage change the PR author should make before
merge.
""".strip()

DESIGN_MODE = """\
The artefact is a design document, ADR, or architecture proposal.
Critique it as if you were greenlighting it as a senior engineer.
Focus on:
1. Trust boundaries and module coupling the design glosses over.
2. Rollback / kill-switch criteria the design omits.
3. Sequencing risk — does step N really not block step N+1?
4. Open questions disguised as decisions, or decisions disguised as
   open questions.
5. The single architectural call you would push back on the hardest,
   and what evidence would change your mind.
""".strip()

OPTIMIZE_MODE = """\
The artefact is an optimization target — code, a query, a profile,
or an existing optimization report. Produce ranked, evidence-based
suggestions for the metric stated in the user's original ask. You
MUST:
1. Rank suggestions by expected impact on the stated metric, not by
   effort or cleverness.
2. Cite the evidence (line, query plan, profile entry) for every
   suggestion. No hand-wave "this is probably slow".
3. State at least one suggestion you explicitly REJECT as
   low-leverage, so the user does not over-engineer.
4. Mark at least one suggestion as hypothesis (requires measurement
   before committing) versus confirmed (already supported by the
   evidence in the artefact).
""".strip()

ANALYSIS_MODE = """\
The artefact is a local analysis output (from a project analyzer,
audit script, or codebase scan). Critique the **analysis itself**, not
the underlying codebase. You MUST:
1. Flag findings that are restated under different headings —
   deduplicate aggressively. The downstream consumer wants a unique
   Top-N, not a long list with overlap.
2. Score the evidence quality of each finding: confirmed (the
   analysis cites file:line / metric), inferred (plausible from
   stated context), or speculative (no citation, vibes-only).
   Speculative findings must be called out by name.
3. Identify findings that are roadmap-ready (concrete enough to land
   as a phase step) vs ones that need a discovery loop first.
4. Propose 3–5 follow-up actions ranked by leverage — what the next
   roadmap should attack first. Cite the supporting finding(s) by id
   or heading.
End with: a Top-N consensus list (one bullet per finding the
analysis surfaces) plus a single sentence on the strongest blind
spot the analysis itself has.
""".strip()


_MODE_TABLE = {
    "prompt": PROMPT_MODE,
    "roadmap": ROADMAP_MODE,
    "diff": DIFF_MODE,
    "files": FILES_MODE,
    "pr": PR_MODE,
    "design": DESIGN_MODE,
    "optimize": OPTIMIZE_MODE,
    "analysis": ANALYSIS_MODE,
}


# ── Consensus-scoring prompts (Phase 4 / F3) ──────────────────────────
#
# Two-step extraction + scoring round used by the analysis lens. The
# extraction pass asks each member to surface its own top findings in
# a strict JSON shape; the scoring pass asks each member to rate
# anonymised findings produced by the *other* members.
#
# Iron Law of Neutrality applies to both: the extraction prompt never
# names other reviewers, and the scoring prompt strips the source
# author by using `Finding-A` / `Finding-B` labels (see
# `consensus.anonymize_findings`).

FINDING_EXTRACTION_PROMPT = """\
You have just produced an analysis. Re-emit your top findings as a
strict JSON array suitable for downstream tooling. Each item MUST
have:

    {"id": "<short-slug>", "text": "<one-sentence finding>"}

Rules:
- 3-7 findings, ordered by importance (most important first).
- `id` is a 1-3 word kebab-case slug, unique within your array.
- `text` is a single sentence, no markdown, no reviewer self-reference.
- Wrap the array in a ```json``` fenced block. No commentary outside it.
""".strip()

FINDING_SCORING_PROMPT = """\
Below are findings from other independent reviewers, presented with
neutral labels (Finding-A, Finding-B, …). Score each one on its
merits. You MUST emit a strict JSON array, one entry per finding,
in this shape:

    {"finding_id": "Finding-A", "score": 1-10, "agree": true|false,
     "reason": "<one-sentence justification>"}

Rules:
- `score` is an integer 1 (weak / irrelevant) to 10 (load-bearing /
  must-address).
- `agree=true` means you would surface this same finding yourself;
  `agree=false` means you think it is wrong, overstated, or off-topic.
- `reason` is a single sentence, no markdown.
- Wrap the array in a ```json``` fenced block. No commentary outside it.

You may not see your own findings in the list — that is by design.
""".strip()


# ── Synthesis templates (Phase 3 / F2) ────────────────────────────────
#
# Lens-aware synthesis prompts. Each entry maps a lens key onto the
# block the host agent should produce when summarising member responses.
# R4 Q4 split: decision lenses get a Karpathy-structured template;
# creative lenses (design / optimize) stay open-ended prose (empty
# string → renderer falls back to the bare "Convergence / Divergence"
# slot). Input modes (prompt / roadmap / diff / files) map onto the
# `default` decision template via `synthesis_template()`.

DEFAULT_SYNTHESIS = """\
Summarise the council using the structured shape below. Be terse,
cite reviewers by label, and refuse to invent agreement that is not
in the responses.

### Agreement
Points that two or more reviewers converged on, each as a single line.

### Clashes
Points where reviewers disagreed. State both sides with a one-line
reviewer-label citation per side.

### Blind spots
Items that none of the reviewers raised but that the artefact's
context suggests are load-bearing. Maximum three. Mark each as
`needs-verification` when the host agent inferred it rather than
read it directly from a response.

### Recommendation
A single sentence: which course the host agent should advise the
user to take, grounded in the strongest converged point.

### Next step
One concrete next action the user can take in their current turn.
""".strip()

PR_SYNTHESIS = """\
Summarise the council with the PR-review shape below.

### Consensus
Findings where two or more reviewers agreed, each one a single line.

### Conflicts
Findings where reviewers disagreed. State both sides with reviewer
labels; do not pick a winner here — that lives in the recommendation.

### Must-fix before merge
Items at least one reviewer marked `REQUEST_CHANGES` or `REJECT`
and the host agent confirms are load-bearing. Maximum five.

### Recommendation
APPROVE / REQUEST_CHANGES / REJECT and a single sentence justifying
the verdict, anchored on the strongest consensus or must-fix line.
""".strip()

ANALYSIS_SYNTHESIS = """\
Summarise the council with the analysis-lens shape below.

### Top-10 by consensus
Findings ranked by how many reviewers surfaced them. Format each
line as: `N. <finding> — cited by <reviewer labels> · evidence:
confirmed | inferred | speculative · roadmap-ready: yes | needs-discovery`.
Stop at ten or when only single-reviewer items remain, whichever
comes first.

### Supporting
Findings that one reviewer raised and at least one other treated as
plausible but did not independently surface. One line each, same
metadata shape as Top-10.

### Outliers
Single-reviewer findings the others did not engage with. Keep them
— they are signal for a future deeper analysis pass — but mark each
as `unverified-by-council`.
""".strip()

# Creative lenses — open-ended prose, no template. The renderer keeps
# the bare "Convergence / Divergence" slot so the host agent can write
# free-form synthesis.
_CREATIVE_PASSTHROUGH = ""

_SYNTHESIS_TABLE = {
    "default": DEFAULT_SYNTHESIS,
    "pr": PR_SYNTHESIS,
    "analysis": ANALYSIS_SYNTHESIS,
    "design": _CREATIVE_PASSTHROUGH,
    "optimize": _CREATIVE_PASSTHROUGH,
}

# Input modes inherit the `default` decision template. Lens overrides
# (`pr`/`design`/`optimize`/`analysis`) pick their own row.
_INPUT_MODE_TO_SYNTHESIS_KEY = {
    "prompt": "default",
    "roadmap": "default",
    "diff": "default",
    "files": "default",
}


def synthesis_template(mode: str | None) -> str:
    """Return the synthesis-prompt body for a given mode.

    `mode=None` collapses to the `default` decision template (back-
    compat for callers that do not thread the lens through). Unknown
    modes raise ValueError — fail closed, never silently passthrough.

    Returns an empty string for creative lenses (`design`/`optimize`)
    so callers can detect "no template, render bare" without a magic
    sentinel.
    """
    if mode is None:
        return _SYNTHESIS_TABLE["default"]
    if mode in _SYNTHESIS_TABLE:
        return _SYNTHESIS_TABLE[mode]
    if mode in _INPUT_MODE_TO_SYNTHESIS_KEY:
        return _SYNTHESIS_TABLE[_INPUT_MODE_TO_SYNTHESIS_KEY[mode]]
    raise ValueError(
        f"Unknown synthesis mode {mode!r}. "
        f"Expected one of: {sorted(set(_SYNTHESIS_TABLE) | set(_INPUT_MODE_TO_SYNTHESIS_KEY))}"
    )


def all_synthesis_modes() -> list[str]:
    """Return the lens keys that have explicit synthesis templates."""
    return sorted(_SYNTHESIS_TABLE)


def _strip_host_identity(text: str) -> str:
    """Drop any *whole line* containing a host-agent identity substring.

    Strategy (locked by council review, 2026-05-02): a line is dropped
    in full as soon as any host-identity needle (Augment / Claude Code
    / Cursor / Cline / Windsurf, etc.) appears anywhere on it. We err
    toward false-positive — slightly less context — over false-negative
    — a neutrality leak. Substring-only stripping was rejected because
    it can leave dangling clauses that still hint at the host.
    """
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



def build_extraction_user_prompt(original_analysis: str) -> str:
    """User-message body for the finding-extraction pass.

    Pairs the prior analysis text with the extraction-prompt rules so
    the member re-emits its own findings in machine-readable form.
    """
    cleaned = _strip_host_identity(original_analysis or "").strip()
    return f"{FINDING_EXTRACTION_PROMPT}\n\n---\n\n{cleaned}"


def build_scoring_user_prompt(anonymised: dict[str, str]) -> str:
    """User-message body for the scoring pass.

    `anonymised` maps `Finding-A`/`Finding-B`/… → finding text. Author
    identities MUST already be stripped — this function does NOT
    re-anonymise, it just renders.
    """
    lines = [FINDING_SCORING_PROMPT, "", "---", ""]
    for label, text in anonymised.items():
        lines.append(f"### {label}\n\n{text}")
    return "\n\n".join(lines)
