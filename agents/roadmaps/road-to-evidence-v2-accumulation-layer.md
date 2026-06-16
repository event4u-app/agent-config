---
complexity: standard
status: ready
parent_roadmap: evidence-v2-project-intelligence
---

# Roadmap: Evidence v2 — Accumulation Layer (deferred from project-intelligence)

> **Active (2026-06-16).** Spend authorized. Spawned from the two `[~]` deferred
> steps of the completed `road-to-evidence-v2-project-intelligence.md`
> (archived). The remaining hard gate is **evidence**: the accumulation layer is
> still **not built** until a *valid, re-designed* eval (see the council note
> below) passes — a null/saturated signal kills the layer (v2 then ships as
> Class A + the B/C spec + static-consensus). The first executable step is the
> eval redesign, **not** the layer.

**Trigger:** The Evidence v2 base layer shipped Class A (standards-from-config),
the Class-B static-consensus path + storage split, and the full Class-C safety
spec (`project-intelligence.md` + `lesson-card.md`). Two steps were deferred
because they constitute the **accumulation layer** — an agent-driven
capture→intake loop (Class B) and the committed-lessons accumulation (Class C) —
which the council found **premature on the current evidence** and gated on a
*valid* eval plus real spend.

**Mode:** Hard-gated. The accumulation layer is **not built** until BOTH
preconditions below pass. A null/negative or saturated signal kills the layer;
v2 then ships as Class A + the B/C spec + static-consensus, which is an
acceptable outcome (the rollback target in `evidence-discipline`).

> **Council convergence (2026-06-16, claude-sonnet-4-5 + gpt-4o, 2 rounds).** The
> Phase-3 Class-B dogfood eval was **invalid** for the accumulation decision: it
> tested a *linter-enforced* convention (a Class-A constraint disguised as
> Class-B), correctness saturated (both arms 0 errors), and the measured lift was
> "pre-caching linter output". The gate as originally written ("lower the error
> rate at acceptable cost") is unmeetable when correctness saturates and never
> quantified "acceptable cost". Before building any accumulation loop, the eval
> must be **re-designed on a discriminating, non-linter convention** where a
> careful agent does NOT reliably reach compliance, and the static-consensus path
> should be preferred over an agent auto-capture loop unless it proves
> insufficient.

## Goal

Decide — on valid evidence and with explicit spend authorization — whether to
build the v2 **accumulation layer**, and if so, build it behind the existing
guardrails (isolation contract, redaction-on-write, ephemeral tier, context
budget, quarantine→approved storage, anti-calcification). If the evidence does
not support it, kill the layer and ship v2 as the already-built base.

## Gate — two preconditions (both required before Phase 1)

1. **A discriminating eval design exists.** A task where a careful agent does NOT
   reliably reach compliance — a convention with **no linter** (e.g. API response
   shape `{data, meta}`, directory naming `config/` vs `configs/`, section
   ordering the linter ignores), multi-convention, or time-pressured. Arms:
   no-context / v1 / v2-accumulated. Measures error rate **and** cost
   (tokens/turns/wall-time), per the Phase-0 cost schema.
2. **Explicit spend authorization** for the 10+-task multi-arm run (real API
   cost). This is the operator's call.

## Phase 1 — Re-run the gate on a valid design

- [ ] Build the discriminating (non-linter) eval fixture + task per the Gate.
- [ ] Run the 3-arm eval (no-context / v1 / v2-accumulated) across ≥ 10 tasks;
      record efficacy + cost using the mandatory cost schema.
- [ ] **Decision:** accumulated context lowers error rate vs. v1 at acceptable
      cost → proceed to Phase 2/3. Otherwise → **kill the accumulation layer**,
      mark this roadmap closed with "shipped base only", archive.

## Phase 2 — Class B auto-capture (only if the gate passes; prefer static-consensus)

- [ ] **Static-consensus pass first.** Implement the codebase consensus scan
      (dominant-pattern detection + `dominant_share`) feeding `quarantine/`; this
      is the cheaper path the council preferred. Build the auto-capture loop only
      if static-consensus proves insufficient.
- [ ] **(deferred from project-intelligence P3.3) Auto-capture for B.**
      `source-discovery` proposes an intake signal when it sees a recurring
      convention ("I notice X — record as context?"), writes to gitignored intake
      (low-trust, agent-id-suffixed filename, redaction-on-write), **never** treats
      it as fact, **never** silently commits. Promotion is the human gate
      (quarantine→approved). Build only if Phase 1 + static-consensus justify it.

## Phase 3 — Class C accumulation (only if the gate passes)

- [ ] **(deferred from project-intelligence P4.4) Build the accumulation layer +
      wire the anti-calcification CI/periodic pass.** Lessons are written to intake
      per the already-built `lesson-card` schema (symptom/hypothesis split,
      test-tracking `history[]`, decay triggers, subject-not-person floor);
      promotion is human-gated; the anti-calcification pass auto-demotes lessons
      that hit a decay trigger. The schema, template, and privacy floor are already
      built in the base roadmap — this phase only adds the live capture + the CI
      demotion pass, and only if Phase 1 shows the layer nets positive.

## What is already built (do not rebuild)

Class A skill + eval; the v1↔v2 isolation contract; ephemeral/intake/curated
tiers; redaction-on-write contract; multi-agent concurrency contract; context
budget; v1→v2 migration; Class-B static-consensus + deviation-staleness +
quarantine→approved storage; Class-C full safety spec + `lesson-card.md` template;
global-promotion contract; ADR-103 (global default-off). All in
`project-intelligence.md` and the base roadmap (archived).

## Acceptance criteria

- The gate's two preconditions are met before any Phase-1 run.
- The Phase-1 eval uses a discriminating (non-linter) task and records cost.
- Phase 2/3 are built only on a positive, non-saturated signal; otherwise the
  layer is killed and v2 ships as the base, recorded here.
