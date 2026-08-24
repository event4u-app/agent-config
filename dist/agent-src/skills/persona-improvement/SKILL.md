---
model_tier: inherit
name: persona-improvement
description: "Refine a persona from recent corrections — tightens its Unique Questions, governance-gated; explicit request only. Skill analog → skill-improvement-pipeline."
domain: process
scope:
  write: []
  verification_reason: "execution.handler is internal, so this skill spawns no subprocess — writes happen through the agent's declared allowed_tools. No command can prove a scope the skill never executes."
execution:
  type: assisted
  handler: internal
  allowed_tools: []
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# persona-improvement

The persona analog of [`skill-improvement-pipeline`](../skill-improvement-pipeline/SKILL.md):
feed a persona a sample of recent corrections/failures where its review lens
**should** have caught something and didn't, and tighten its `Unique Questions`
so the lens fires next time. Access ergonomics, not new capability — it only
sharpens an existing persona, never creates one.

## When to use

- The user explicitly says "improve / refine this persona" or "the <persona> lens keeps missing X".
- A correction sample exists (review misses, repeated feedback) that a persona's questions should have surfaced.

Do NOT use for:

- Creating a new persona (that is `persona-governance` + the authoring flow).
- Editing a persona's identity/scope (a breaking change → new id per `persona-governance`).
- A one-off miss with no pattern — one anecdote is not a refinement signal.

## Procedure

1. **Gather the correction sample.** Collect the recent misses/corrections tied
   to this persona's domain (from the conversation, feedback notes, or a review
   log). If fewer than ~3 distinct misses, STOP — no pattern yet; say so.
2. **Locate the gap.** For each miss, name the question the persona *should* have
   asked that would have surfaced it. Cluster the misses into ≤ 2 recurring gaps.
3. **Propose tightened `Unique Questions`.** Rewrite or add questions that close
   the gaps — concrete and answerable-from-the-diff, not vague ("does this add a
   second branch on the same enum?" beats "is the design good?"). Keep the
   section ≥ 3 questions (`persona-governance` schema floor).
4. **Governance gate (mandatory).** Before writing, confirm with
   [`persona-governance`](../../rules/persona-governance.md): the edit is a
   same-id refinement (not a scope/identity change — those need a new id); the
   persona keeps ≥ 1 skill citation; the file still passes the skill linter
   (tier/wing/section/line budget). A scope change is out of scope for this loop.
5. **Apply + verify.** Edit only the `Unique Questions` section; run
   `./scripts-run src/scripts/skill_linter` on the persona file and confirm
   0 errors; show the before/after questions.

## Output format

1. **Correction sample** — the ≥ 3 misses, one line each.
2. **Gaps** — the ≤ 2 recurring gaps the misses cluster into.
3. **Before/after `Unique Questions`** — the diff, with which gap each new question closes.
4. **Governance confirmation** — same-id refinement ✅, ≥ 1 citation intact ✅, linter 0-error ✅.

## Gotcha

- The most common misuse is **scope creep disguised as refinement**: adding
  questions that widen the persona into a second domain. That is a new persona
  (per the per-domain cap), not a refinement — STOP and route to
  `persona-governance`, do not grow the lens sideways.

## Do NOT

- Do NOT refine on a single miss — a pattern needs ≥ 3.
- Do NOT touch identity, scope, tier, or wing — same-id `Unique Questions` only; anything else is a new-id change under `persona-governance`.
- Do NOT drop below 3 `Unique Questions` (schema floor).
- Do NOT commit or push — apply the edit locally, surface the diff.

## Related Skills

- [`skill-improvement-pipeline`](../skill-improvement-pipeline/SKILL.md) — the skill-side analog this mirrors.
- [`persona-governance`](../../rules/persona-governance.md) — the four discipline checks this loop is gated by.
