---
complexity: structural
status: ready
parent_roadmap: road-to-rule-coherence
---

# Roadmap: Follow-up to road-to-rule-coherence

> The rule layer's transport, scoping and arbitration defects are fixed; what
> remains is the one class an agent may not decide — what a consumer install
> receives by default — plus the measurement that should precede it.

> **Blocked until** the maintainer rules on the default-flip gate. Every open
> item below changes what ships to a consumer, or needs spend, or is owned by
> another roadmap. None is agent-startable.

## Context

This roadmap collects the items deferred from
[`agents/roadmaps/archive/road-to-rule-coherence.md`](archive/road-to-rule-coherence.md).
See the parent's archive entry for the original rationale and the two council
rounds behind it.

The parent closed 14 of 20 steps and cancelled 2 on measurement. It did **not**
close these four, and the reason is uniform: this repo treats a
projection-default flip as a human release gate, and the settings template says
of the relevant key, verbatim, **"Do not set this from automation."** An agent
preparing the evidence is in scope; an agent flipping the default is not.

## Prerequisites

- [ ] Read `AGENTS.md` and the parent archive entry.
- [ ] Confirm the parent's P0–P2 work is merged and has soaked — the whole point
      of the sequencing the council imposed was validate-then-flip.

## Phase 1 — The default flip (human release gate)

- [ ] **F1.1 Flip the shipped `discipline_profile` default to the measured
  configuration.** The template already documents the evidence: `essential`
  carries a significant discipline lift (+0.458, p=0.0135) while `full`'s
  residual over it is **not** significant (p=0.37) — and `full` is what ships.
  The agent's job is the diff plus the census; the decision is the
  maintainer's.
  - Acceptance: fresh-install census — always-on rule prose ≤ 30k tok
    (pre-registered; measured ~163k as loaded at audit time).
- [ ] **F1.2 `essential-plus` preset, if F1.1 lands.** The 30-rule whitelist
  formalized and versioned, diffable against `essential`. **Mandatory
  addition: `agent-authority`** — the whitelist as used excludes the only
  conflict arbiter while loading conflicting absolutes.
- [ ] **F1.3 `projection.rule_packs: auto`.** Verified by the parent's P1.6
  sweep to drop **exactly the 8 rules** the template names (~8,308 GPT tok
  measured today vs the archived 8,110 — ~3% drift, directionally confirmed).
  This is also what pack-scopes `ui-audit-gate`, and it is what the parent's
  three self-claimed-pack-gated safety floors need
  (`finance-safety-floor`, `legal-safety-floor`, `strategy-safety-floor`).
- [ ] **F1.4 `projection.scope_dedup: true`.** Mechanism, measurement and a
  doctor health check all already exist; only the default is off. Verified live
  at audit time: **109 shared basenames** between the user-global and project
  rule scopes on a real install.

## Phase 2 — Measure, with the comparison that is actually open

- [ ] **F2.1 A/B bench: zero vs `essential-plus`.** Pre-register thresholds in
  this file *before* the run: non-inferiority Δ ≥ −0.05 at ≤ 1.4× tokens.
  Explicitly **not** `essential` vs `full` — the council killed that as
  already-measured (p=0.37) and `full` will never ship.
  - Honest-null clause: if `essential-plus` is not non-inferior, it is demoted
    to documentation rather than narrated as a win.
  - No lift language may attach to any LLM-judged probe set of the size the
    parent considered — that was ruled smoke-test-only.

## Phase 3 — Architecture, owned elsewhere

- [ ] **F3.1 `thin` projection viability.** Do **not** fork it here; it is owned
  by `road-to-thin-flip-under-anchor-scoring.md`. The parent flagged it as the
  only plausible path to restoring subagent delegation (a spawn failed at
  ~207,664 tokens against a 200,000 limit while `delegation-policy` mandates
  delegating). If `thin` cannot restore delegation for a validated set, the
  rule-count ceiling is a hard architectural cap — and that finding deserves a
  real multi-provider council, not subagents.

## Phase 4 — Re-adjudicate what the audit left open

- [ ] **F4.1 Re-adjudicate the 9 remaining `real-conflict` pairs** from
  [`agents/evidence/analysis/rule-conflict-audit-2026-08-06.md`](../evidence/analysis/rule-conflict-audit-2026-08-06.md).
  Four of them are `context-hygiene`'s read-loop against a mandated multi-read
  protocol and were materially reduced by the parent's declared-protocol cap of
  8 — re-run them against the **new** rule text before writing any further
  rewrite. Two more share the reply-position root cause already declared for
  the other two.

## Phase 5 — Retire the two provisional numbers

Both are plausible figures without a reproducible derivation — the failure class
the parent roadmap exposed in the "17 rules carry absolutes" claim and then
committed twice more itself.

- [ ] **F5.1 Set the declared-protocol read cap from data, not from n=1.** The
  cap of 8 in `context-hygiene` comes from a single observed run and is marked
  provisional in the rule body with a revisit trigger. Record declared-protocol
  read counts across real sessions, then set the cap at p95 and drop the note.
  - Acceptance: the cap cites a distribution and an n; the provisional note is
    removed in the same change.
- [ ] **F5.2 Decide what the absoluta figure is FOR, then cite accordingly.**
  `src/scripts/measure_rule_absoluta.ts` now re-derives all three readings
  (strict 79 · loose 97 · structural 94 of 111). Nothing currently depends on
  the number — the lattice it refuted is already cut — so the open question is
  whether any future artefact should cite it at all, and if so which reading.
  - Acceptance: either a named consumer with a stated reading, or a decision
    that the census stays a diagnostic with no cited figure.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-06 | reviewer: claude/host -->
| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Flip lands without the soak | product | F1.1–F1.4 change what every consumer receives. Shipping them before the parent's transport and scoping fixes have soaked reproduces exactly the sequencing the council rejected — ship-then-patch | The blocked-until line gates the whole roadmap on the maintainer ruling, and the prerequisite step requires the parent merged AND soaked before Phase 1 opens | Phase 1 — The default flip (human release gate) |
| 2 | Bench runs without pre-registered thresholds | implementation | A post-hoc threshold turns a null result into a narrated win, which is the failure the honest-null discipline exists to stop | Thresholds are written into F2.1 in this file before any run, with the demotion path stated in the same bullet | Phase 2 — Measure, with the comparison that is actually open |
| 3 | thin gets forked here | implementation | Two roadmaps editing one projection mode diverge silently, and the existing owner already carries the measured honest-null | F3.1 states the ownership and forbids the fork rather than restating the work | Phase 3 — Architecture, owned elsewhere |
| 4 | Stale re-adjudication | implementation | Re-running the 9 open pairs against the OLD rule text would re-derive conflicts the parent already fixed, wasting the audit and possibly reverting good changes | F4.1 names the changed text explicitly as the input, not the audit's original quotes | Phase 4 — Re-adjudicate what the audit left open |

## Blockers

### blocker: default-flip-release-gate
- **Status:** open
- **Owner:** maintainer
- **Blocks:** Phase 1
- **What to do:** rule on whether the measured configuration becomes the shipped
  default. The evidence is prepared and cited in F1.1–F1.4; the settings
  template's own comment on `rule_packs` — "Do not set this from automation" —
  is why this cannot be an agent decision.
- **Resolved when:** the maintainer merges the flip with the census attached, or
  records a decision to keep the current default and ship the preset as opt-in.

### blocker: bench-spend-and-methodology
- **Status:** open
- **Owner:** maintainer
- **Blocks:** Phase 2
- **What to do:** authorize the A/B run and confirm the methodology. The council
  was explicit that an LLM-judged probe has no power against the original
  human-judged production measurement, so a real claim needs human judging at
  adequate N.
- **Resolved when:** thresholds are pre-registered here and the run is
  authorized, or F2.1 is cancelled and the preset ships documentation-only.
