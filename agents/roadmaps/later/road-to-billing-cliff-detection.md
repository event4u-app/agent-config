---
complexity: structural
status: draft
execution:
  mode: phase-checkpoints
---
# Road to billing-cliff detection inside Claude Code

> **Source:** carried out of `agents/roadmaps/archive/road-to-billing-cliff-gate.md`
> when that roadmap closed on its deliverable half, 2026-08-22. AI council
> 2/2 convergent on this disposition (`agents/runtime/council/responses/`,
> session of 2026-08-22 — local-only and pruned, so the verdict is recorded
> here rather than linked). Original inbox note:
> `agents/tmp.old/agent-cost-limits.txt`.
>
> **Owner:** maintainer. **Review by:** 2027-02-22. Both are here because the
> council's one refinement on the carry disposition was that a `later/`
> roadmap without a named owner and a review date is how contingent work
> becomes indefinite debt.

## Goal

An autonomous drain that crosses its Claude Code plan quota stops at the next
clean boundary and asks, instead of continuing on metered Extra Usage
unnoticed. When this is finished either a hook-reachable surface has been shown
to carry the billing-class signal and a stop-slot concern acts on it, or five
written verdict files record that no such surface exists and the phases below
are closed as a published null rather than left open.

## Why this is parked and not active

Every probe in Phase 1 needs a live Pro/Max account driven to its actual quota
boundary, and one of them needs an unofficial endpoint. No autonomous run can
produce that evidence, so an active roadmap here would carry steps nobody can
start. The sibling roadmap's council pass took exactly this reading.

## Resume trigger

**All five** verdict files exist under `agents/evidence/billing-cliff/`:
`phase1-s1.md` … `phase1-s5.md`, each naming its surface as gate-grade,
warning-grade, or null. The completeness is the trigger, not any single probe:
a partial set cannot answer "is there a gate-grade surface", and resuming on
one positive would start Phases 2–3 against a signal whose alternatives were
never measured.

## What is NOT in scope

- Reading or changing the account-level Extra Usage toggle or spend cap. Those
  remain the hard floor underneath any gate built here.
- Any unofficial usage endpoint as a shipped dependency. S-5 may be probed to
  establish that a signal exists at all; a shipped gate may not rely on it.
- The council-side fallback. That shipped in the sibling roadmap and is not
  reopened here.

## Blockers

### blocker: billing-cliff-signal-existence

- **Status:** open
- **Owner:** maintainer
- **Blocks:** step 1.1
- **Class:** 3
- **What to do:** pick exactly one — (a) run the Phase 1 surface probes on a
  live Pro/Max account driven to its quota boundary and record one verdict file
  per surface, or (b) close this roadmap as a published null on the review date
  if no maintainer has been at a quota boundary with the time to probe.
- **Recommendation:** (a), opportunistically. The probes are cheap once the
  boundary is reached anyway; what is expensive is manufacturing the boundary.
  (b) is the honest end state if the opportunity never arrives, and the review
  date exists so that outcome is chosen rather than defaulted into.
- **If you do nothing:** the roadmap sits in `later/` past its review date and
  becomes the indefinite speculative debt the council named as the one real
  cost of parking it.
- **Resolved when:** all five verdict files exist under
  `agents/evidence/billing-cliff/`, or this roadmap is closed as a published
  null with that decision recorded at this blocker.

## Phase 1 — Falsification spike: does a hook-reachable surface carry the signal

Expectations are pre-registered here, before probing. A null is a result and is
published as one — the spike's value does not depend on Phases 2–3 ever
running, because "there is no gate-grade signal" is itself what stops the next
attempt from re-deriving it.

- [ ] **1.1 Probe five surfaces and write one verdict file each** under
      `agents/evidence/billing-cliff/phase1-<surface>.md`.
      **S-1 statusline stdin JSON** (the payload `session_eol_hook.ts` already
      parses for `transcript_path`) — expect null; cost fields, if any, are
      cumulative USD rather than billing class.
      **S-2 transcript JSONL** per-turn `usage` blocks across the boundary —
      expect null; token counts with no billing source.
      **S-3 CLI stdout/stderr of a `claude -p` worker** — expect weak positive:
      the banner string is present but unversioned and English-only, so a
      detector on it is a regex over marketing copy. Warning-grade at best.
      **S-4 API error shape with Extra Usage off** — expect positive: a
      rate-limit error is deterministic and machine-readable, and is the one
      hook-visible event known to exist.
      **S-5 the claude.ai usage endpoint** — expect positive but inadmissible
      as a dependency, recorded for evidence only.
      verify: five verdict files exist, each naming its surface as gate-grade,
      warning-grade or null, and each stating whether the pre-registered
      expectation held.

## Phase 2 — Stop-slot concern: halt the drain at the cliff

Conditional on Phase 1 producing a gate-grade signal. Unstarted on a null.

- [ ] **2.1 Register a billing-cliff concern after the work-remaining
      concern.** `src/scripts/hooks/concern_registry.ts`, honouring the
      ordering rule at `src/scripts/hooks/run_continuation_hook.ts:21`.
      Severity follows the argument that file's docblock makes at lines
      121–127: a concern that cannot decide must not block. Trigger is the
      gate-grade signal with no `AC_BILLING_GRANT` (the grant shipped in the
      sibling roadmap — `src/scripts/_lib/billing_grant.ts`); verdict is to
      block the continuation and emit the Human Gate question carrying the
      remaining unchecked steps from the roadmap's own `verify:` lines. With a
      grant present it is a no-op, one event per run under the once-guard shape
      at line 77. Warning-grade signals may emit a warning and must never
      block — stated in the concern's own docblock so a later reader cannot
      upgrade it silently.
      verify: tests for both branches (signal + no grant → blocked once;
      signal + grant → allow, no event) and one asserting a warning-grade
      signal never reaches the blocking branch.

## Phase 3 — Spend gate learns the difference between sunk and marginal

Conditional on Phase 1 producing a gate-grade signal. Unstarted on a null.

- [ ] **3.1 Give `CostBudget` and `OverrunEvent` a billing class.** The gate is
      USD-total shaped today (`src/scripts/ai_council/spend_gate.ts`) and
      cannot distinguish USD already paid through plan allocation from USD
      spent on metered overage. A plan seat reads as $0 marginal until the
      cliff and then every token is marginal, and the arithmetic cannot see the
      step. Add `plan_included` per seat and `marginal_usd` alongside
      `spent_usd`; ceilings compare against marginal. Configs without the field
      behave exactly as today.
      verify: a test asserts a plan seat contributes 0 marginal before the
      cliff signal and its full estimate after, and that a config with no
      `plan_included` field produces byte-identical decisions to the current
      gate.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-22 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The roadmap outlives its own usefulness in `later/` | product | Contingent work parked behind an evidence trigger nobody is obliged to satisfy is how a plan becomes debt. The council named this as the single real cost of the carry disposition. | A named owner and a review date in the Source block, and a blocker whose option (b) is an explicit close-as-null on that date rather than a silent extension. | Why this is parked and not active |
| 2 | A partial verdict set resumes the roadmap against an unmeasured field | implementation | Resuming on one positive probe would start Phases 2–3 against a signal whose four alternatives were never compared, which is exactly the pre-registration the spike exists to protect. | The resume trigger names all five files, and the § Resume trigger paragraph states why completeness rather than positivity is the condition. | Resume trigger |
| 3 | The banner detector is promoted past warning-grade later | implementation | S-3 is a regex over unversioned English marketing copy. Promoted to a gate it goes quietly wrong rather than loudly absent. | Step 2.1 fixes warning-grade signals as non-blocking in the concern's own docblock, and the Phase 1 verdict files record the grade per surface so an upgrade contradicts a written record. | Phase 2 — Stop-slot concern: halt the drain at the cliff |

## Acceptance Criteria

- [ ] AC-1 — Five verdict files exist under `agents/evidence/billing-cliff/`,
      one per surface, each naming a grade and whether the pre-registered
      expectation held.
- [ ] AC-2 — If any surface is gate-grade, an autonomous drain crossing the
      cliff without a run-scoped billing grant is blocked once and asks; with a
      grant it is a no-op.
- [ ] AC-3 — If no surface is gate-grade, the null is published and this
      roadmap is closed as such, with the decision recorded at its blocker
      rather than left implicit in an empty file set.
