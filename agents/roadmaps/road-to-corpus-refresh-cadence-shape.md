---
complexity: lightweight
status: draft
execution:
  mode: phase-checkpoints
parent_roadmap: road-to-corpus-refresh-2026-q3
estate_growth_exempt: "a blocker discovered while doing the work — 1.2's four re-checks cannot share one calendar date, which no prior pass had written down as a structured hold"
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

**Why it is still `draft` after D1 closed the question (2026-09-30).** The
original reason has expired — the question *is* answered. A second reason has
not: Risk 2's only named mitigation is that this file ships `draft` so no
`/roadmap:process-*` run picks it up unprompted, and the remaining work is
precisely the four stamp edits Risk 2 exists to guard. Flipping to `ready` would
remove that guard at the moment the risk is highest, which is a safety-floor
change and therefore the maintainer's, not an agent's. The flip is named in the
blocker's "What to do" so it is a decision the maintainer takes deliberately
rather than one an agent takes by tidying.

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

**1.2 was one checkbox describing four occasions spread over three months, and
split on 2026-09-30 into the four it actually is.** D1's own words are "four
separate occasions, not one edit"; a single box could never record two-of-four
done, so the structure now matches the decision. All four are held by the same
blocker — see [`four-dated-re-checks-are-calendar-bound`](#blocker-four-dated-re-checks-are-calendar-bound).
The order below is a suggestion, not a constraint; what is binding is that no
two land on the same date and all four land before ~2026-12-27.

- [ ] **1.2a Re-check `accessibility-auditor` against its upstream and stamp the
      date the check ran.** <!-- blocked-by: four-dated-re-checks-are-calendar-bound | asked: no — the drain grant that reached this roadmap forbids putting a question to the owner; recorded here for the maintainer instead -->
      Upstream is the W3C ARIA Authoring Practices Guide plus WCAG 2.2.
      Suggested window: early-to-mid October 2026. The check is whether WCAG 2.2
      still carries no supersession note and whether any APG pattern cited in
      `aria-patterns.csv` has been withdrawn or renamed.
      verify: `src/skills/accessibility-auditor/data/manifest.json` carries an
      `upstream.last_checked` equal to the date the check ran, differing from
      the other three, and `./scripts-run src/scripts/check_corpus_staleness`
      exits 0.
- [ ] **1.2b Re-check `api-design` against its upstream and stamp the date the
      check ran.** <!-- blocked-by: four-dated-re-checks-are-calendar-bound | asked: no — the drain grant that reached this roadmap forbids putting a question to the owner; recorded here for the maintainer instead -->
      Upstream is RFC 9110 / 9457 / 7396 / 8288 plus the httpapi WG drafts.
      Suggested window: early November 2026. The check is whether any of the
      four RFCs has been obsoleted or updated since 2026-09-18.
      verify: `src/skills/api-design/data/manifest.json` carries an
      `upstream.last_checked` equal to the date the check ran, differing from
      the other three, and `./scripts-run src/scripts/check_corpus_staleness`
      exits 0.
- [ ] **1.2c Re-check `database` against its upstream and stamp the date the
      check ran.** <!-- blocked-by: four-dated-re-checks-are-calendar-bound | asked: no — the drain grant that reached this roadmap forbids putting a question to the owner; recorded here for the maintainer instead -->
      Upstream is the PostgreSQL 18 and MySQL 9.7 reference documentation.
      Suggested window: late November 2026. Note that the *content* half was
      re-derived on 2026-09-27 (commit `6991eeab9`); per D2 that re-derivation
      does not move the stamp, so this occasion is a fresh check.
      verify: `src/skills/database/data/manifest.json` carries an
      `upstream.last_checked` equal to the date the check ran, differing from
      the other three, and `./scripts-run src/scripts/check_corpus_staleness`
      exits 0.
- [ ] **1.2d Re-check `threat-modeling` against its upstream and stamp the date
      the check ran.** <!-- blocked-by: four-dated-re-checks-are-calendar-bound | asked: no — the drain grant that reached this roadmap forbids putting a question to the owner; recorded here for the maintainer instead -->
      Upstream is MITRE ATT&CK, CWE, the OWASP API Top 10 and ASVS 5.0.
      Suggested window: mid December 2026, and no later than ~2026-12-20 so the
      last occasion lands before the batch expiry. Same D2 note as 1.2c: the
      2026-09-27 content re-derivation does not move the stamp.
      verify: `src/skills/threat-modeling/data/manifest.json` carries an
      `upstream.last_checked` equal to the date the check ran, differing from
      the other three, and `./scripts-run src/scripts/check_corpus_staleness`
      exits 0.

## Blockers

### blocker: four-dated-re-checks-are-calendar-bound
- **Status:** open
- **Owner:** maintainer
- **Blocks:** 1.2a, 1.2b, 1.2c, 1.2d — and AC-2 through them.
- **Why it is a hold and not merely unfinished work.** D1 requires four real
  re-checks on four *separate dates*. One session cannot produce four dates, so
  no single run — agent or human — can close 1.2 however capable it is. This is
  a calendar constraint, deliberately not a capability one: the promoted hold
  records that the work is *spread*, never that it is *hard*. Two further
  reasons put the occasions with the maintainer rather than a drain run: every
  one of the four manifests declares `"owner": "package-maintainer"`, and
  `check_corpus_staleness`'s own header states that row semantics — "does this
  pattern still hold?" — are "the corpus owner's judgement and no offline gate
  can make it".
- **What to do:** run the four occasions on four separate dates before
  ~2026-12-27, one corpus each, in any order — 1.2a through 1.2d carry the
  upstream and the suggested window for each. For each occasion: verify that
  corpus against its upstream, then set only that manifest's
  `upstream.last_checked` to the date the check actually ran, and confirm with
  `./scripts-run src/scripts/check_corpus_staleness`. Separately, decide the
  `draft` question this file's Context raises: (a) leave `status: draft` until
  1.2d lands, keeping Risk 2's guard in place and accepting that the dashboard
  does not carry the deadline; (b) flip to `status: ready` now, gaining
  dashboard visibility and accepting that `/roadmap:process-*` may reach the
  stamp edits; (c) park under `later/` with a wake condition on the expiry date.
- **Recommendation:** (a). Risk 2 names an agent editing these stamps as "the
  most convincing possible form of the wrong answer", and the four open steps
  are exactly those edits. Option (b) trades the guard for visibility the
  gate already supplies: `check_corpus_staleness` reddens every PR at
  ~2026-12-27 whether or not the dashboard carries this file, so the deadline
  announces itself. Option (c) buys the same visibility as (b) at the cost of a
  wake condition nothing reads.
- **If you do nothing:** the four stamps stay at `2026-09-18`, cross the 100-day
  bound together on ~2026-12-27, and redden every open pull request at once —
  the exact 2026-09-18 incident this roadmap exists to prevent, recurring on a
  date that is already known.
- **Resolved when:** `./scripts-run src/scripts/check_corpus_staleness` exits 0
  and the four `upstream.last_checked` values under
  `src/skills/{accessibility-auditor,api-design,database,threat-modeling}/data/manifest.json`
  are four *distinct* dates — not merely not-all-equal, per D3.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|----|-----------|-------------|----------|----------|------------|
| D1 | contested-technical | council:anthropic+openai | **Stagger — reached prospectively, by four real re-checks on separate dates before ~2026-12-27. The four existing `2026-09-18` stamps are NOT edited.** Rejected: (a) keep the batch and record it as intended — the facts establish only that the four were *checked* together, never that they are interdependent or share an upstream, so this would record a coupling nobody has shown to exist; (b) change the gate's severity to warn — changes the blast radius without answering the cadence question, and leaves a required check that no longer checks; (c) stagger by editing the stamps — rejected outright, see evidence. | A `last_checked` stamp asserts that a corpus was verified against its upstream on that date, so moving one without a corresponding verification is fabricated evidence — the identical defect the parent roadmap found in `last_eval`, and precisely the failure mode Risk 2 names. Staggering is the right *shape*; four genuine checks on four separate dates is the only honest way to reach it, and it also produces the re-check work the quarterly cadence exists to force. Council 2026-09-27: 2 of 2 seats, 2 rounds, converged, no billable spend; both seats rejected stamp-editing independently. | The four corpora turn out to share an upstream or a release train (then the batch is real and (a) becomes correct); or four separate re-check sittings a year prove operationally impractical; or corpus freshness is shown to be informational rather than safety-relevant. |
| D2 | contested-technical | council:anthropic+openai, then a deterministic tree check | **D1's "the four existing `2026-09-18` stamps are NOT edited" governs unqualified. The documented 2026-09-27 re-derivation does NOT move `last_checked` on `database` or `threat-modeling`.** The competing reading — that D1 forbids only editing *without* a verification, so a verification that demonstrably happened may be recorded — is rejected. | Raised because both manifests' `upstream.sha` literally begin `"re-derived 2026-09-27 against …"` while `upstream.last_checked` reads `2026-09-18`, which reads as an under-report and invites exactly the one-line edit Risk 2 names. Put to the council 2026-09-30 (2 of 2 seats, 2 rounds, $0.0736). **The council did not converge on a verdict** — it split on whether D1 was time-bound, routed that crux to the maintainer, and ranked one deterministic test first: does the "roadmap note" the commit cites actually exist? Both seats stated the test's consequence in advance — *"if the note exists and says what the commit author claims, Reading A wins by the roadmap's own terms and the case closes"* — and one seat predicted on the record that the grep would fail. **It did not fail.** `agents/roadmaps/archive/road-to-corpus-refresh-2026-q3.md:30` reads: "The date half is already done and is **not re-done here**: all four `last_checked` fields were updated on 2026-09-18 because someone actually looked." The 2026-09-27 pass was therefore scoped to content by an explicit written instruction, and its author followed it rather than misreading it. The pre-registered test settles the question against the reading that motivated it. | The maintainer states that D1's freeze was time-bound to the state of the manifests on 2026-09-27; or the parent roadmap's content/date split is superseded by a later instruction. |
| D3 | reversible-technical | agent, from the Goal's own wording | **1.2's verify is tightened from "no longer all equal" to four *distinct* dates.** AC-2 carries the same tightening. | The former wording passes with three corpora still sharing one stamp — e.g. one check lands and the other three stay at `2026-09-18` — while the Goal requires that "the four no longer expire on the same day". A verify a partial result satisfies is not a test of the Goal it sits under. No trade-off: under D1 the four checks are separate occasions anyway, so four distinct dates is what executing D1 produces, and the tightening only stops a premature close. | The maintainer prefers an outcome test ("no two expiries within N days") over a distinctness test, which would tolerate two corpora genuinely checked on one day. |

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

**Provenance, D2 (2026-09-30).** Same two seats, 2 rounds, $0.0736 billable,
`--mode-override api` because both CLI transports failed the live probe in a
fresh worktree. Recorded honestly: this round produced **no convergent verdict**
and is not cited as one. What it produced was a ranked test with its consequence
stated before the result was known, and the test came back against the reading
the round was convened to examine. The council's remaining open items — whether
Risk 2's wording should distinguish *fabricating* a stagger from *recognising*
a documented one, and whether D1's four-dates *means* or the no-four-way-red
*outcome* is the binding success criterion — are left for the maintainer; D3
settles only the narrow verify-wording half of the second.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-30 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The question is never put, and the four-way red simply recurs | product | A draft roadmap nobody flips to ready is indistinguishable from a dropped one, and the next expiry lands mid-PR exactly as the last one did | The expiry is dated (~2026-12-27 on the current stamps) and is named in the Context above, so the recurrence is predictable rather than a surprise; the parent roadmap's archive entry points here. Strengthened 2026-09-30: the four occasions are now four separate checkboxes with suggested windows, and the hold that carries them states what happens if nothing is done | Phase 1 — Put the question, then apply the answer |
| 2 | An agent answers the maintainer's question by staggering the stamps on its own | implementation | Editing a `last_checked` value is a one-line change an agent can trivially make, and doing so would fabricate a decision while making the gate green — the most convincing possible form of the wrong answer | 1.1's verify demands a RECORDED decision before 1.2 touches any manifest, and this roadmap ships `draft` so no `/roadmap:process-*` run picks it up unprompted. Strengthened 2026-09-30: D2 closes the one reading under which an agent could have believed a stamp edit was authorised, and the `draft` guard is now defended explicitly in Context rather than left as an unexamined default | Phase 1 — Put the question, then apply the answer |

## Acceptance Criteria

- [x] AC-1 — A recorded decision names the chosen shape (stagger, intended
      batch, or gate-severity change) and its reason. *(D1, 2026-09-27.)*
- [ ] AC-2 — The four `quarterly` corpus manifests carry four **distinct**
      `upstream.last_checked` dates (per D3 — not merely not-all-equal), each
      equal to the date its check actually ran, and
      `./scripts-run src/scripts/check_corpus_staleness` exits 0 against them.
