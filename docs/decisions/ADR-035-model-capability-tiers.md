---
adr: 035
status: accepted
date: 2026-05-30
decision: model-capability-tiers
supersedes: 034
superseded_by: —
phase: model-capability-tiers
type: structural
review_date: 2026-08-30
---

# ADR-035 — Vendor-neutral model capability tiers (supersedes ADR-034)

## Status

**Accepted** · 2026-05-30. Supersedes **ADR-034**. AI Council
(anthropic/claude-sonnet-4-5 + openai/gpt-4o, deep, design lens, 3 rounds,
2026-05-30) converged on the design below.

## Context

ADR-034 shipped a per-skill `recommended_model` field with **vendor-specific
values** (`opus | sonnet | gpt | inherit`). In use this produced a cross-vendor
nonsense: a **Claude** user was recommended **`gpt`** for analysis-heavy skills.
The values are also version-brittle (model names churn) and couple the portable
source to specific vendors' line-ups. The fix is to recommend a **capability
band**, not a model, and let each agent resolve the band to its own best model.

## Decision

1. **Tiers — `lite | medium | high` (+ `inherit`).** Pure capability descriptors
   (reasoning horsepower), not use-case names. A 4th `frontier` tier is rejected
   — it would map sparsely (one vendor's outlier) and break vendor-neutrality.
   `inherit` = "no opinion, keep the session model".

2. **Field rename `recommended_model` → `model_tier`.** The semantics changed
   from a model identifier to an abstract band; keeping the old name "is lying in
   code" (council). The 354-artefact rename is mechanical and worth the honesty.

3. **Mapping ownership — the generator owns the Claude mapping, exclusively.**
   This is the load-bearing decision. Exactly one place resolves a tier to a
   concrete model: `scripts/condense.py`, because Claude Code is the only surface
   that consumes a native `model:`. The mapping is `high → opus`,
   `medium → sonnet`, `lite → haiku`. **Non-Claude agents are suggestion-only** —
   the `model-recommendation` rule surfaces the tier *name* and the agent/user
   maps it to their own line-up. The package maintains **no per-vendor runtime
   table**; that would create the "two-clocks" drift failure (generator table vs
   runtime table diverging as vendors rename models).

4. **Long-context is orthogonal — optional `context: large` modifier.** Reasoning
   horsepower and context length are independent (a 500-page-log summary is
   low-reasoning + high-context). Model the rare long-context need as a sparse,
   optional `context: large` frontmatter modifier, never as a tier. Most skills
   omit it. It is metadata — it does not change the native Claude `model:` (the
   tier owns the model choice).

5. **Migration map.** `opus → high`, `sonnet → medium`, `gpt → high`,
   `inherit → inherit`. The `gpt` band (large-context analysis) collapses into
   `high` reasoning + an optional `context: large` modifier on the genuinely
   long-context skills. A re-runnable classifier additionally routes
   clearly-trivial mechanical work to `lite`.

6. **`model.auto_switch` toggle unchanged** (`auto | suggest | off`, default
   `suggest`). `suggest` emits no native `model:` and never overrides a user's
   `/model` — the conservative staged-rollout default.

## Consequences

- No vendor model name leaves the band abstraction in source; a Claude user is
  never recommended `gpt`.
- The native `model:` exists only in the Claude projection, from a single map.
- Other agents get a tier-name suggestion they resolve themselves — zero
  per-vendor maintenance burden in the package.
- Adding a vendor or renaming a model touches **one** mapping (the generator's
  Claude row), not 354 artefacts.

## Periodic staleness audit (council guard)

The tier→model mapping is a contract that drifts as vendors rename/retire models.
Guard: on each model-line-up change, update the single generator-owned Claude
mapping (`high/medium/lite → model`). No artefact re-tagging is needed — the band
is stable; only its resolution moves. Audit cadence: review at each release that
touches model pricing/availability, and whenever a tier's mapped model is
deprecated upstream.

## Alternatives

- **Keep concrete model names (ADR-034).** Rejected — the cross-vendor bug this
  ADR fixes.
- **Per-vendor runtime table consumed by the rule.** Rejected — the two-clocks
  drift failure; suggestion-only is simpler and self-maintaining.
- **Context length as a tier (`high-context`).** Rejected — conflates two
  orthogonal axes; handled by the sparse `context: large` modifier instead.
- **4th `frontier` tier.** Rejected — sparse cross-vendor mapping.

## References

- `agents/roadmaps/road-to-model-capability-tiers.md` (charter).
- ADR-034 (superseded) — the concrete-model design this corrects.
- `docs/contracts/multi-tool-projection-fidelity.md` (updated Phase 3).
- `contexts/model-recommendations.md` (task→tier table; seeds the migration).
- Council convergence: anthropic/claude-sonnet-4-5 + openai/gpt-4o, deep design
  lens, 2026-05-30.
