---
adr: 110
status: accepted
date: 2026-07-07
decision: discipline-profile-resolution-locus
supersedes: —
superseded_by: —
phase: road-to-discipline-profile-tiering
type: standing
---

# ADR-110 — `discipline_profile` resolves at runtime (agent-in-the-loop); projection stays configuration-independent

## Status

**Accepted** · 2026-07-07 · maintainer decision implementing two same-day
AI-council verdicts (claude-sonnet-4-5 + gpt-4o, 2-round debates each):
weak-host-lift tiering (`agents/settings/contexts/weak-host-lift-tiering-verdict.md`)
and token-program integration (`agents/settings/contexts/token-program-integration-verdict.md`).

## Context

The cost-factor sweep (`docs/benchmark.md § Cost-factor sweep`) established
that the package's weak-host discipline lift survives at ~3.3x tokens
(kernel + `downstream-changes`) with no significant residual from the full
~11.7x load, and that hosts differ: `claude-sonnet-4-6` is a measured NULL
(discipline ceiling). The councils converged on ONE runtime knob —
`discipline_profile: auto | off | essential | full` — with `auto` gating the
lift layer per host via an evidence-gated NULL-lift disable-list.

The open design question this ADR records: **where does `auto` resolve?**
Projection is static per project, but the host model is a *runtime* fact — a
project is opened by Haiku one session and Fable the next, across vendors
(Claude, GPT, Gemini, open-source). Candidates considered:

1. **Runtime resolution (agent-in-the-loop)** — the agent resolves the knob
   at session start against `src/config/host-capabilities.yml`.
2. **Per-tool projection variants** — emit per-model projections; the host
   picks one. Rejected: no host tool selects projections by model; N×M
   projection matrix; violates the ADR-040 principle that trigger semantics
   stay configuration-independent.
3. **Hook-based rewrite** — a session-start hook mutates the loaded surface.
   Rejected: hooks are deny/warn-only in the cross-host v1 contract (no
   transparent rewrite); Claude-only mechanisms are forbidden here.

## Decision

1. **`discipline_profile` is a runtime knob, resolved agent-in-the-loop** —
   the same enforcement model as `provider-lifecycle-discipline` (the agent
   reads a declared fact at run time and applies the obligation; CI guards
   the facts, not the runtime). Resolution semantics live in ONE function,
   `resolve_discipline_profile()`
   (`src/agent-src/templates/scripts/work_engine/_lib/agent_settings.ts`):
   explicit value wins → `auto` checks the session model id against
   `host-capabilities.yml` (prefix match; measured-NULL → `off`, otherwise →
   `essential` under `unknown_default: lift_enabled`) → absent key maps from
   legacy `rule_loading_tier` (minimal→off, balanced→essential, full→full,
   custom→custom) → both absent → `essential`.
2. **`host-capabilities.yml` is an evidence-gated disable-list, never a
   taxonomy.** Entries name only models with a MEASURED null lift, each with
   `measured:` provenance (date · pinned report · N) or an explicit
   `extrapolated: true` maintainer flag. Unknown models resolve fail-safe to
   the lift (`essential`). Vendor-neutral by construction: any model id can
   be measured onto the list.
3. **Projection is unchanged by this ADR.** Bodies still project per
   `lean_projection.mode` (eager-all today); the knob governs which
   discipline tiers the agent honours at runtime — exactly the semantics the
   legacy `rule_loading_tier` already had. The *physical* per-host token
   saving lands when thin projection un-defers (as a sub-mechanism of
   `essential`, re-swept, per the token-program-integration verdict), at
   which point `lean_projection.mode` is absorbed. This keeps ADR-040's
   guarantee: trigger semantics are configuration-independent.
4. **`discipline_profile` joins `MERGEABLE_KEYS`** (user-global cascade), as
   the successor of the already-mergeable `rule_loading_tier`.
5. **Defaults are evidence-gated.** *(Amended 2026-07-07 after both gates
   ran — original wording: ship commented-out until P1 + P2 pass, flip
   target `auto`.)* P1 passed family-scoped; P2 FAILED on the first
   non-Claude weak host (`docs/benchmark.md § P2 gate`). Per the P2-verdict
   council, the installer presets fill the key per profile (minimal→off,
   balanced→`auto`, full→full) and `auto` resolves vendor-granularly
   (measured-null → off; unmeasured Claude-family → essential; unmeasured
   non-Claude → off) — the lift enables only where measured. Evidence trail:
   `agents/roadmaps/archive/road-to-discipline-profile-tiering.md`.

## Consequences

- One resolution function, unit-tested, shared by scripts and documented for
  agents — no per-tool drift in mapping semantics.
- Strong hosts get an honest `off` the moment their null is *measured*, never
  by vendor folklore; the disable-list only grows by measurement.
- Until thin projection lands, `auto`/`essential` on an eager-projection host
  changes which rules the agent honours, not the loaded bytes — the cost
  claims in the settings docs say so explicitly (the measured 3.3x applies
  where loading is physical: sysprompt injection today, thin projection
  later).
- The legacy `rule_loading_tier` stays readable indefinitely; the wizard and
  presets migrate when the `balanced` cut is retired (roadmap Phase 2).

## Alternatives

Per-tool projection variants and hook rewrites (rejected above); a maintained
strong/weak model registry (explicitly rejected by the tiering council —
speculative, unmaintainable at model-release cadence).

## References

- `agents/settings/contexts/weak-host-lift-tiering-verdict.md`
- `agents/settings/contexts/token-program-integration-verdict.md`
- `docs/benchmark.md § Cost-factor sweep`
- ADR-040 (projection-time filtering), ADR-002 (kernel budget)
