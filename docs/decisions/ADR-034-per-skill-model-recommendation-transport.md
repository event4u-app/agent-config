---
adr: 034
status: superseded
date: 2026-05-30
decision: per-skill-model-recommendation-transport
supersedes: —
superseded_by: 035
phase: per-skill-model-autoswitch
type: structural
review_date: 2026-08-30
---

# ADR-034 — Per-skill model recommendation: neutral source field, native projection on Claude

> **Superseded by [ADR-035](ADR-035-model-capability-tiers.md)** (2026-05-30).
> The concrete-model field (`recommended_model: opus|sonnet|gpt`) recommended a
> cross-vendor model to Claude users (`gpt`) and was version-brittle. ADR-035
> replaces it with vendor-neutral capability tiers (`model_tier: lite|medium|high`).

## Status

**Accepted** · 2026-05-30. AI Council (anthropic/claude-sonnet-4-5 + openai/gpt-4o, design lens, 2 rounds, 2026-05-30) was convened on the transport fork and the Claude projection shape. The council leaned toward putting a native `model:` key directly in source (its "Option B"); this ADR **overrides that lean on two package-specific facts the council lacked** and adopts the neutral-field transport (Option A). The council's other challenges (haiku floor, the `/model` trust boundary, measurement-first sequencing) are incorporated below.

## Context

`model-recommendation` (tier-2a, `core`) is a dead shell — it routes to `command:set-cost-profile`, which flips `cost_profile` but never selects a model. The task→model intelligence already exists in `contexts/model-recommendations.md` but has no mechanism to act. Claude Code now honours a native skill `model:` frontmatter key — verified against the official skills docs (`code.claude.com/docs/en/skills.md`): the override applies for the rest of the current turn, reverts to the session model on the next prompt, and accepts the `/model` values plus `inherit`. That makes per-skill model selection structural on Claude; Augment has no per-turn override, so a rule surfaces a one-question suggestion there.

The projection constraint: source `SKILL.md` is shared across tools via `.agent-src/`. `.claude/skills/<name>` is a whole-**directory symlink** to `.agent-src/skills/<name>`; `.claude/skills/<slug>/SKILL.md` for commands is a **symlink** inside a real dir. Augment skills symlink the same target. A Claude-only native `model:` therefore cannot live in the shared symlink target without also appearing in Augment.

## Decision

1. **Transport — Option A (neutral source field).** Source carries a tool-neutral `recommended_model:`; the Claude generator rewrites it to native `model:`; Augment keeps the neutral field for the rule to consume. **Council override rationale:** (a) the skill/command schemas are `additionalProperties: false`, so a native `model:` key in source would *fail* `validate_frontmatter` — Option B is not free as the council assumed; (b) the package's portability contract (`augment-edit-discipline`) forbids tool-specific keys in the portable source. Option A also matches the existing projection-transform philosophy (path rewrites, HRR-banner injection, Cursor `.mdc` field-dropping all already transform on projection).

2. **Field + enum.** `recommended_model` with enum `opus | sonnet | gpt | inherit`. `inherit` = "no opinion, use the session model" (named to match Claude's own `inherit` value). `sonnet` is the cheapest tier — **no `haiku`** (see § Deferred). `gpt` has no Claude tier: it emits no native `model:` and only surfaces as a suggestion.

3. **Claude projection shape — Option (b), minimal break.** Keep `.claude/skills/<name>` a real dir, symlink every sub-entry **except** `SKILL.md`, and render `SKILL.md` as a copy with `model:` injected — **only for skills that actually receive a native value** (`opus`/`sonnet`). Skills tagged `inherit`/`gpt`/untagged stay pure directory symlinks. This mirrors the existing command projection (real dir + handled `SKILL.md`), is idempotent on regenerate, and copies only the SKILL.md of model-bearing skills (disk-minimal).

4. **Toggle gates native emission — `model.auto_switch`.** `.agent-settings.yml` `model.auto_switch: auto | suggest | off`, **default `suggest`**. The generator reads it: `auto` emits native `model:` into the Claude projection (auto-switch fires); `suggest` and `off` do **not** emit native `model:` — the rule surfaces a one-question suggestion on every surface instead. This resolves the council's trust-boundary concern: by default the package never silently overrides a user's explicit `/model` choice; native auto-switch is opt-in.

## Consequences

- Source stays portable and schema-valid; only the Claude projection carries `model:`.
- Claude skills with a native recommendation become rendered `SKILL.md` copies (sub-files still symlinked); everything else stays a symlink.
- The rule becomes the surface-aware decision layer (Phase 4); the task→model heuristics stay in the context file (cite, don't restate).
- A coverage linter (Phase 5) makes an explicit recommendation or `inherit` mandatory on every skill/command, preventing silent drift.

## Deferred (council challenges recorded, not dismissed)

- **`haiku` tier.** The council argued the `sonnet` floor is a data-free exclusion and that haiku may suit truly mechanical tasks. Kept out of the enum for this PR (conservative quality guard for a structured-agent suite). Re-evaluation is **gated on the Phase 6 measurement** + per-skill eval data; adding `haiku` later is an additive enum change.
- **Per-skill eval kill-switch.** The council wanted an automated "if eval failure > N%, revert to `inherit`" loop. No per-skill evals exist yet; the manual kill-switch is `model.auto_switch: off` or dropping the field (additive/reversible). Captured as a follow-up.
- **Measurement-first sequencing.** The council preferred instrumenting cost before tagging. Phase 6 provides the before/after token-distribution delta; the ordering is a charter choice, noted.

## Alternatives

- **Option B — native `model:` in source.** Rejected: fails `additionalProperties: false` validation and violates the portability contract.
- **Whole-directory copy for Claude skills.** Rejected: duplicates `evals/`, `schemas/`, etc. for zero benefit; Option (b) copies only `SKILL.md`.

## References

- `agents/roadmaps/road-to-per-skill-model-autoswitch.md` (charter).
- `docs/contracts/multi-tool-projection-fidelity.md` (projection map; updated in Phase 3).
- `contexts/model-recommendations.md` (task→model table; seeds the Phase 5 backfill).
- Council convergence: anthropic/claude-sonnet-4-5 + openai/gpt-4o, design lens, 2026-05-30.
