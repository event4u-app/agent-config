---
complexity: structural
status: later
---

# Road to a voice negative lexicon — make "never say X" checkable instead of hoped

> **FREEZE LIFTED 2026-08-05.** The ADR-211 harvest freeze that parked this
> roadmap was anchored on external adoption; that anchoring is struck by
> [`ADR-216`](../../../docs/decisions/ADR-216-restraint-reanchored-to-capacity.md)
> (external adoption is not a project goal and is not a valid gate anywhere in
> this tree). The freeze's real basis was maintainer capacity, and its conditions
> are met — **so nothing external holds this roadmap any more.**
>
> **Resume when** the maintainer decides to spend a slot on it. That is the only
> remaining condition: a sequencing decision, in the maintainer's control, not an
> event to wait for. Per-item evidence discipline is untouched — ADR-211
> Amendment C (the cited failure finding must predate the borrow) and Amendment D
> (red test committed first) still apply to each item on resume.

> **Parked per
> [`ADR-211`](../../../docs/decisions/ADR-211-harvest-freeze-resume-conditions.md)
> (harvest freeze; council disposition 2026-08-03):** additive schema surface
> with no recorded internal failure. The design below is kept because its
> Phase 0 is deliberately cheap and self-killing. Re-audited 2026-08-03:
> STAY (no pre-dating finding, no latent risk beyond style).
>
> **Resume when:** the maintainer spends a slot on it (ADR-216 struck the
> adoption gate; the capacity conditions are met), OR — per ADR-211 Amendment C — a recorded incident with provenance
> shows agent-authored persisted prose (PR bodies, commit messages) violating
> a user's stated voice constraints. On resume, run Phase 0 FIRST — its
> honest-null outcome archives this file with the numbers.

## The gap (verified against 9.9.0 source, 2026-07-30)

The user-identity surface has a positive tone anchor (`voice_sample`) but no
negative one: no `avoid` / `banned` / `never_say` concept exists in
`src/shared/userMd/schema.ts`, the templates, or the meta user commands.
Meanwhile the ghostwriter fixture already carries a richer style shape
(`voice_samples[]` with provenance, opener/closer patterns, emoji rules) that
the everyday identity file never got. A negative lexicon — unlike the prose
`voice_sample` — is deterministically lintable on persisted agent-authored
prose.

## Design preserved for resume (re-verify schema state first)

- **Phase 0 — falsification spike (pre-registered, can kill the file):**
  corpus = last 30 agent-authored PR descriptions + 100 commit messages of
  this repo (the only honestly-labelable corpus); seed lexicon (~20 entries:
  hedge fillers, hype adjectives, emoji classes) frozen BEFORE the scan;
  plain word-bounded matching, no NLP. Decision gate: ≥5 distinct entries
  firing across ≥10 items → build; concentrated in ≤2 entries → schema field
  only, validator YAGNI; ≈0 hits → honest null, archive with numbers.
- **Phase 1 — schema v2:** `style.avoid[]` (max 32,
  `{pattern (1–64 chars), match: word|substring, note?}` — deliberately NO
  regex: injection/DoS surface, kills explainability) +
  `voice_samples: string[]` (max 3 × 1,200 chars) replacing the single
  `voice_sample`, v1-accepting reader. The 100-line hard cap of
  `/agents user accept` vs 3 samples + 32 entries is an explicit contract
  decision, not an implicit code change.
- **Phase 2 — enforcement, two-tier and honestly labelled:** chat surface =
  pre-send gate paragraph only (ephemeral, no `enforced_by`); persisted prose
  = `check_voice_lexicon.ts` over PR title/body + branch commit messages,
  wired through `assertScanned` (empty lexicon → SKIPPED with reason, never
  a green nothing). Opt-in Taskfile target only — a personal style gate in a
  team's default CI is a social bug.

## Non-goals

No style-similarity scoring, no "sounds like you" claim or benchmark, no
regex in user files, no git hooks, no louder onboarding for the voice layer
(adoption surfacing belongs to `road-to-adoption-without-narrative-debt.md`).
