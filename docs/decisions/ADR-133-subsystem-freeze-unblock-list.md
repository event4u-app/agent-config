---
adr: 133
status: accepted
date: 2026-07-28
decision: subsystem-freeze-unblock-list
supersedes: —
superseded_by: —
phase: road-to-feedback-9.8.0-followups · Phase 1
type: structural
review_trigger: >-
  Any one unblock condition (a)–(d) flips to met — re-check the whole list
  then; when ALL four are met the freeze lifts without a superseding ADR.
  Also reopen if an external consumer files a demand signal that a frozen
  subsystem class would directly serve — that demand is weighed against the
  remaining unblock conditions, never silently absorbed.
---

# ADR-133 — Subsystem freeze in unblock-list form

## Status

Accepted (2026-07-28). Records the freeze all seven independent 9.8.0 review
passes converged on, in the falsifiable form the AI council picked
(2026-07-26, anthropic/claude-sonnet-4-5 + openai/gpt-4o, 2 rounds — Q4):
an **unblock list with yes/no exit conditions**, not a standing WIP cap
(accounting theater for a solo maintainer) and not an undated "1–2 releases"
freeze (no exit condition).

## Context

Release 9.8.0 shipped a large engineering surface (code-graph engine,
enforcement machinery, gated reach, embeddable-GUI groundwork) whose
strongest repeated reviewer signal was: the next quality jump must come from
**field validation and disposition of unproven surfaces, not another
capability**. The same reviews flagged the recurring failure shape — new
subsystems land faster than existing ones get proven, described honestly, or
retired.

## Decision

**No new large subsystem starts while any unblock condition below is open.**
"Large subsystem" means: a new engine class (ADR-124 Class A or B), a new
platform integration, a new persistent service, or a new reach channel.

The freeze lifts when **ALL** of the following are true — each is a yes/no
check against a named artifact:

- **(a) Code-graph benchmark decided** — the 2-arm pre-registered benchmark
  (`road-to-feedback-9.8.0-followups` Phase 2) has a recorded win-or-null
  outcome bound in `docs/CLAIMS.md`.
- **(b) Baselined backstop debt ≤ 25** — `internal/reports/rule-backstop-debt.json`
  total is at or below 25 with the ratchet green.
- **(c) Release install E2E green in the release path** — the
  `release-install-e2e` job exists in `.github/workflows/release-validation.yml`,
  is named in `docs/contracts/branch-protection-policy.md`'s release-PR row,
  and has passed on at least one release-shaped run.
- **(d) One real external usage session recorded** — a wedge-install session
  per `agents/recruit-sessions/_install-friction-runbook.md` — **OR** the
  launch ADR (ADR-134) explicitly defers with an unexpired expiry date.

### Named refusals under this freeze

Explicitly refused while the freeze holds (council-confirmed, 2026-07-26 Q6):

- the **host×task evidence router** — a new subsystem regardless of how thin
  "just wiring existing measurements" sounds; static profiles have not
  measurably failed;
- the **knowledge-security subsystem** — real gap, wrong window; revisit
  after the unblock list clears.

### What the freeze does NOT block

- Fixes, tests, docs, dispositions, benchmarks, and consolidation of
  EXISTING surfaces — the freeze exists to force exactly this work.
- `road-to-feedback-9.8.0-followups` itself — it is the instrument of the
  freeze, not subject to it.
- Class-A engine *maintenance* (pinned-dependency bumps, bug fixes) on
  engines that already shipped.

## Consequences

- Roadmap-authoring and council sessions cite this ADR when a proposed
  track would open a new subsystem; the proposal is parked with a pointer
  here instead of debated fresh each time.
- The unblock list makes the freeze's end observable: each condition is
  checkable in-repo, so "is the freeze over?" is never a judgment call.
- Risk accepted: a genuinely urgent new-subsystem need during the freeze
  costs one ADR-review cycle (the review trigger above) instead of landing
  silently.

## Alternatives considered

- **Standing WIP cap (2+2+1)** — rejected (council Q4): caps measure
  concurrency, not doneness; for a solo maintainer they add accounting
  without changing behavior.
- **Undated freeze ("next 1–2 releases")** — rejected: no exit condition,
  so it either rots or is silently ignored — the exact drafted-not-posted
  pattern this roadmap closes elsewhere.

## References

- `agents/roadmaps/road-to-feedback-9.8.0-followups.md` — § Council
  convergence (Q4, Q6) + Phase 1.
- ADR-124 — embedded-engine doctrine (defines the engine classes the freeze
  gates).
- ADR-134 — launch decision (supplies the (d) alternative condition).
