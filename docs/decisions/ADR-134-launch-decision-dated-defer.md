---
adr: 134
status: accepted
date: 2026-07-28
decision: launch-decision-dated-defer
supersedes: —
superseded_by: —
phase: road-to-feedback-9.8.0-followups · Phase 1
type: structural
review_trigger: >-
  Expiry 2026-09-15 — at that date the maintainer either posts (execution
  under road-to-adoption-without-narrative-debt.md) or commits a superseding
  deferral ADR with a signed reason and a new expiry at most 90 days out.
  A lapsed expiry with neither action is an open compliance finding for the
  next review cycle, not a silent extension. Early trigger: both defer
  conditions clear before expiry — decide then, do not wait for the date.
---

# ADR-134 — Launch decision: dated, falsifiable defer (no third undated draft)

> **Arrival history — process metadata:** 27 occurrences; latest:
> `inbox-2026-09-y` (2026-09-11); earlier, most recent first: `inbox-2026-09-r`,
> `inbox-2026-09-q`, `inbox-2026-09-i`, `inbox-2026-09-g`, `inbox-2026-09-e`,
> `inbox-2026-09-c`, `inbox-2026-09-b`, `inbox-2026-09-a`, `inbox-2026-08-g`,
> then fourteen release-feedback rounds each named by the release it read, and
> three further rounds — `hard-feedback-1`, `release-4.10.0`, `ac-compare-1`.
> Counted as distinct top-level round entries under the consumed-inbox tree that
> raise this record's subject, the deferral of the public launch decision:
> detected by an explicit reference to this ADR, to its `decision` slug, or to
> `road-to-adoption-without-narrative-debt.md`, then read one by one to drop
> incidental mentions such as path lists, ADR index dumps and frontmatter
> cross-references (8 of 35 matches dropped that way). The tree is gitignored and
> machine-local, so the count cannot be reproduced from a clone and the ordering
> is the finding rather than the exact figure. It is a floor, strictly: a round
> that raises the subject without naming any of the three is not counted. This
> history triggers review of whether the holding disposition remains effective;
> it does not determine the review outcome. On resolution it is frozen as closed
> provenance rather than erased; on a superseding deferral it is carried forward.

> **The posed owner question — no recommended answer.** The expiry is
> 2026-09-15. This record's own Decision section and
> `agents/roadmaps/stubs/road-to-adr-134-expiry.md` name three outcomes, and
> `agents/evidence/analysis/adr-134-expiry-compliance-finding.md` records that
> none of them has been taken. Exactly one of:
>
> 1. Post the launch decision this record defers, executed under
>    `road-to-adoption-without-narrative-debt.md`; the posting itself stays
>    Hard-Floor-gated at the moment of posting.
> 2. Commit a superseding deferral record with a signed reason and a new expiry
>    at most 90 days out.
> 3. Let the expiry lapse deliberately and record the lapse as this record
>    prescribes — an open compliance finding for the next review cycle, not a
>    silent extension.
>
> None of the three is agent-decidable: each is an owner-reserved public
> commitment under `decision-revisit-gate`'s reserved set, unanimously so per the
> council record of 2026-09-06 cited in the compliance finding above.

## Status

Accepted (2026-07-28). Ends the drafted-not-posted pattern (two announcements,
two months, fifth consecutive review cycle naming non-launch as the single
missing point) by making NON-launch falsifiable. Shaped by AI-council debate
2026-07-28 (anthropic/claude-sonnet-4-5 + openai/gpt-4o, 2 rounds): condition
set + expiry + never-silently-extended, with a **human** forcing function
(public record + deadline) — the council explicitly rejected auto-generated
superseding ADRs and "default to launch on inaction" as governance fantasy in
a no-runtime package where posting is a maintainer Hard-Floor act.

## Context

Posting is and stays a maintainer Hard-Floor call
(`non-destructive-by-default` — an irreversible external action). This ADR is
the RECORD, not the act. What it removes is the third state: launch neither
happening nor being deferred on a recorded, dated, checkable condition.

The pre-registered utilization window elapses ~2026-08-26 and is a named
decision input available before this ADR's expiry.

## Decision

**No public launch before BOTH of the following are true; expiry 2026-09-15.**

1. **Release install E2E green in the release path** — the
   `release-install-e2e` job (`.github/workflows/release-validation.yml`) has
   passed on the most recent release-shaped run (single verifiable check:
   the job's latest run on a `release/*` PR or `workflow_dispatch`).
2. **One real external usage session recorded** — a session record authored
   by (or verifiably involving) a non-maintainer: a wedge-install session per
   `agents/recruit-sessions/_install-friction-runbook.md`, or an equivalent
   GitHub issue/discussion from a non-maintainer account demonstrating a
   successful install plus at least one executed command, with logs or
   screenshots. Self-produced simulations do not qualify.

**Because:** launching on unbacked install claims is the narrative-debt
failure `road-to-adoption-without-narrative-debt.md` exists to prevent — the
launch story's load-bearing claims (installs cleanly, survives a stranger's
machine) must be evidence-backed before they are published, same standard as
every other claim in `docs/CLAIMS.md`.

**At expiry (2026-09-15), exactly one of:**

- the maintainer greenlights posting — execution then runs under
  `road-to-adoption-without-narrative-debt.md` (the posting itself remains
  Hard-Floor-gated at the moment of posting); or
- a superseding ADR records the next deferral with the maintainer's stated
  reason and a new expiry ≤ 90 days out.

Neither happening is an **open compliance finding**: the next review cycle,
`decision-review`, and any roadmap touching launch cite this ADR as violated
— visible, never silent. Both defer conditions clearing early is the
symmetric trigger: decide then, do not sit on the date.

## Consequences

- The recurring reviewer flag ("launch decision missing") closes: either
  outcome is now a recorded, dated decision.
- ADR-133's unblock condition (d) is satisfiable by this ADR while it is
  unexpired.
- Risk accepted: the expiry may force a deferral ADR during a busy period —
  that cost (one short ADR) is the point; it is the price of never having a
  third undated draft.

## Alternatives considered

- **Expiry-only defer ("decide after the utilization window, 2026-08-26")** —
  rejected: an expiry without conditions reproduces the undated-draft problem
  one level up; the window is an input, not a condition.
- **Auto-superseding ADRs / default-to-launch on missed deadline** — rejected
  (council): fictional automation in a no-runtime package; posting cannot and
  must not self-execute.
- **Launching now** — not recordable by this roadmap: posting is a
  maintainer Hard-Floor act; nothing in an autonomous run can green-light it.

## References

- `road-to-feedback-9.8.0-followups.md` — § Council
  convergence (Q7) + Phase 1.
- `agents/roadmaps/road-to-adoption-without-narrative-debt.md` — the
  execution surface once posting is greenlit; its Phase 1 blocker (real
  external participant) is condition 2 here.
- ADR-133 — freeze contract (condition (d) references this ADR).
