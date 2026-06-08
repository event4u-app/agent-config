---
adr: 066
status: accepted
date: 2026-06-08
decision: skill-body-prerendering
supersedes: —
superseded_by: —
phase: employee-product Phase 8 (road-to-employee-product-and-external-proof)
type: structural
---

# ADR-066 — Skill-body pre-rendering for host hand-off (v0)

## Status

**Accepted** · 2026-06-08. Design converged via AI-council (claude-sonnet-4-5 +
gpt-4o, design mode, 2026-06-08). Resolves the skill-body pre-rendering ADR-065
(and ADR-024) deferred.

## Context

A role prompt carries one `skill_hint` (e.g. `doc-coauthoring`). Hosts without
skill resolution — Codex / Gemini (Tier-1, no skill surface per ADR-024) and
every Tier-3 host — cannot follow that reference, so the workspace must
**pre-render the skill body** into the hand-off prompt. Skills live at
`<skills-root>/<id>/SKILL.md` (YAML frontmatter + body); roots are
`.agent-src.uncondensed/skills/` then `dist/agent-src/skills/` (only the latter
exists in a consumer checkout). `skill_hint` is **package-controlled** (it comes
from a shipped role prompt, not user input).

## Decision

### K1 — include the body **+ a one-line header** (option c)

`workspace_skills.resolve_section(skill_hint)` returns a
`## Skill context: <name>` section: the skill `name`, its one-line
`description` (both from frontmatter), then the procedure **body** (frontmatter
stripped). Body-only loses the skill's identity; the whole SKILL.md leaks
metadata noise into the host prompt.

### K2 — a dedicated resolver module

`workspace_skills.py` owns skill → prompt-section rendering; the inbox store
imports it and appends the section when `--skill-hint` is passed. The skill
domain owns its own rendering syntax. *(Debt: the section markup lives in the
skill module rather than a pure-data resolver + caller-side formatter. Accepted
for v0; revisit if a second consumer needs a different format.)*

### K3 — trust + bounds

`skill_hint` is package-controlled but hardened anyway: charset-validate
`^[a-z0-9][a-z0-9-]*$` (rejects path traversal), resolve **strictly under** a
skills root (a `relative_to` guard backs the charset check), and the
**existence-under-root** check is the de-facto allowlist (only real skill dirs
resolve). A missing / invalid / unreadable skill **degrades to a one-line inline
note** ("skill `<id>` not found — proceed without it"), never a crash. The body
is **size-capped** at 64 KB (≫ the 912-line max). **No transitive resolution** —
a skill body is included verbatim, it never pulls other skills → no cycles.
*(Debt: a generated skill-id manifest allowlist is deferred to v1; the
existence check covers v0.)*

### K4 — scope

v0 wires pre-rendering into the **Tier-3 inbox hand-off only** (the surface
shipped in ADR-065): `workspace_inbox.py write --skill-hint <id>` +
`POST /api/v1/workspace/inbox {skill_hint}`. Codex/Gemini Tier-1 pre-rendering
rides the host-agent launch loop, which is unbuilt → out of scope. Ships dark
behind the existing `AGENT_CONFIG_TIER3_INBOX` flag (no new flag).

## Consequences

- A Tier-3 hand-off now carries the skill context inline; a host with no skill
  resolution can act on it.
- Plaintext (the inbox is plaintext per ADR-065); no cryptography dependency.
- Deferred to v1 (recorded debt): manifest-based skill-id allowlist, a
  `--dry-run` resolve mode, and success / kill-switch metrics
  (e.g. missing-skill rate). The feature ships dark, so these are not v0
  blockers.

## Alternatives

- **Body-only / whole-SKILL.md** (K1 a/b) — rejected: identity loss vs metadata
  noise.
- **Resolver returns pure data, Node formats** (K2) — cleaner layering, deferred
  as over-scoped for a single v0 consumer.
- **Manifest allowlist in v0** (K3) — deferred; existence-under-root suffices
  for package-controlled ids.

## References

- ADR-065 — Tier-3 inbox (the hand-off surface this renders into).
- ADR-024 — notes Codex/Gemini lack skill resolution.
- `src/cli/python/workspace_skills.py`, `workspace_inbox.py`, `src/server/routes/workspace.ts`.
