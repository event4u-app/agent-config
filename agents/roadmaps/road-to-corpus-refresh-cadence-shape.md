---
complexity: lightweight
status: draft
execution:
  mode: phase-checkpoints
parent_roadmap: road-to-corpus-refresh-2026-q3
---
# Road to corpus refresh cadence shape

> **Source:** the deferred item 2.1 of `road-to-corpus-refresh-2026-q3`, carried
> here under Iron Law 3 of `roadmap-progress-sync` when that roadmap closed on
> 2026-09-27. Its Phase 1 shipped; this question did not, because it is a
> maintainer decision and not an agent call. See the parent's archive entry for
> the original finding.

## Goal

The maintainer has answered whether four grounding corpora sharing one
`last_checked` stamp is a deliberate cadence or an accident of batching, and the
tree reflects that answer — either the stamps are deliberately staggered so the
four no longer expire on the same day, or a recorded decision states that the
simultaneous expiry is intended and acceptable.

## Context

`check_corpus_staleness` is calendar-triggered and its job is a required status
check. On 2026-09-18 all four corpora carrying a `quarterly` cadence
(`accessibility-auditor`, `api-design`, `database`, `threat-modeling`) read
`last_checked: 2026-06-07`, crossed the 100-day bound on the same day, and
reddened every pull request in the repository with no commit involved. The
re-check moved all four to `2026-09-18` — which preserves the batch shape rather
than fixing it, so the same four-way red is due again around 2026-12-27.

This roadmap ships `status: draft` deliberately: it is hidden from the dashboard
and from `/roadmap:process-*` until the maintainer flips it to `ready`. That is
the honest encoding of "the question is open and nobody has decided it" — an
agent must not answer it, and parking it as executable work would imply someone
had.

## Phase 1 — Put the question, then apply the answer

- [x] **1.1 Put the cadence-versus-batch question to the maintainer and record
      the answer.** *(2026-09-27 — delegated by the maintainer to the AI council;
      answered as D1 below. The recorded decision names the chosen shape and its
      reason, which is what this step's verify demands.)* Two options, and the trade-off is real rather than
      cosmetic: staggering the four stamps spreads the re-check work across the
      quarter and means at most one corpus reddens at a time, at the cost of
      four separate re-check occasions a year instead of one; keeping the batch
      means one re-check sitting, at the cost of a four-way repo-wide red every
      time it comes due. A third option exists and should be named when asking:
      leave the stamps alone and instead make the gate warn rather than block
      when a corpus is only days over, which changes the blast radius without
      changing the cadence.
      verify: a recorded decision exists — an entry under `agents/decisions/`,
      an ADR, or a `## Decisions` row on this roadmap — naming which of the
      three was chosen and why.
- [ ] **1.2 Apply the recorded answer to the four manifests.** *(Under D1 this
      step is four separate occasions, not one edit: re-check one corpus against
      its upstream, update only that manifest's `last_checked` to the date the
      check actually ran, and repeat for the other three on different dates
      before ~2026-12-27. Editing any stamp without having run its check is the
      fabrication D1 and Risk 2 both forbid — there is no shortcut here.)* Only the chosen
      option, nothing wider; if the answer was "the batch is intended", this
      step is the one-line note in each manifest saying so, not a no-op.
      verify: for a stagger, the four `upstream.last_checked` values under
      `src/skills/*/data/manifest.json` are no longer all equal and
      `check_corpus_staleness` is green; for an intended batch, each of the four
      manifests carries the note, and the recorded decision from 1.1 is cited.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|----|-----------|-------------|----------|----------|------------|
| D1 | contested-technical | council:anthropic+openai | **Stagger — reached prospectively, by four real re-checks on separate dates before ~2026-12-27. The four existing `2026-09-18` stamps are NOT edited.** Rejected: (a) keep the batch and record it as intended — the facts establish only that the four were *checked* together, never that they are interdependent or share an upstream, so this would record a coupling nobody has shown to exist; (b) change the gate's severity to warn — changes the blast radius without answering the cadence question, and leaves a required check that no longer checks; (c) stagger by editing the stamps — rejected outright, see evidence. | A `last_checked` stamp asserts that a corpus was verified against its upstream on that date, so moving one without a corresponding verification is fabricated evidence — the identical defect the parent roadmap found in `last_eval`, and precisely the failure mode Risk 2 names. Staggering is the right *shape*; four genuine checks on four separate dates is the only honest way to reach it, and it also produces the re-check work the quarterly cadence exists to force. Council 2026-09-27: 2 of 2 seats, 2 rounds, converged, no billable spend; both seats rejected stamp-editing independently. | The four corpora turn out to share an upstream or a release train (then the batch is real and (a) becomes correct); or four separate re-check sittings a year prove operationally impractical; or corpus freshness is shown to be informational rather than safety-relevant. |

**Provenance.** Decided by AI council on 2026-09-27 — 2 of 2 seats present
(anthropic, openai), 2 rounds, converged, no billable spend. The maintainer
delegated this specific question to the council in-session, which is the only
reason an agent-run council answered a question this roadmap reserves to the
maintainer; absent that delegation the reservation stands. Both seats
independently rejected stamp-editing, and both arrived at "create the stagger
through real future checks" without prompting. The council also observed that
this question and the parent's `last_eval` staleness share one principle —
evidence must come from the event that proves it — while needing two different
mechanisms, and asked whether a fixed-cadence gate is the right control at all
for verification work that is episodic upstream; that second question is NOT
answered here and is left open.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-27 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The question is never put, and the four-way red simply recurs | product | A draft roadmap nobody flips to ready is indistinguishable from a dropped one, and the next expiry lands mid-PR exactly as the last one did | The expiry is dated (~2026-12-27 on the current stamps) and is named in the Context above, so the recurrence is predictable rather than a surprise; the parent roadmap's archive entry points here | Phase 1 — Put the question, then apply the answer |
| 2 | An agent answers the maintainer's question by staggering the stamps on its own | implementation | Editing a `last_checked` value is a one-line change an agent can trivially make, and doing so would fabricate a decision while making the gate green — the most convincing possible form of the wrong answer | 1.1's verify demands a RECORDED decision before 1.2 touches any manifest, and this roadmap ships `draft` so no `/roadmap:process-*` run picks it up unprompted | Phase 1 — Put the question, then apply the answer |

## Acceptance Criteria

- [x] AC-1 — A recorded decision names the chosen shape (stagger, intended
      batch, or gate-severity change) and its reason. *(D1, 2026-09-27.)*
- [ ] AC-2 — The four `quarterly` corpus manifests match that decision, and
      `check_corpus_staleness` is green against them.
