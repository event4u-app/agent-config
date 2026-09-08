---
adr: 264
status: accepted
date: 2026-09-08
decision: grace-ceiling-may-not-rise-iron-law-reserve-designed-not-shipped
supersedes: —
superseded_by: —
type: structural
reopen_policy: owner
protected_dimensions: governance
provenance:
  kind: agentic
  agentic_mode: council
  decision_makers: [council]
  human_directed: true
evidence:
  strength: E2
  basis:
    - src/config/preamble-payload-budget.json
    - src/scripts/check_condensation.ts
    - agents/roadmaps/road-to-a-standing-budget-with-headroom.md
    - src/rules/preservation-guard.md
review_trigger: >-
  A third raise of the grace ceiling occurs, in either direction of this
  decision; or the protected-approval mechanism § The reserve depends on is
  built, at which point the reserve moves from designed to shippable and its
  eight fixtures become the gate; or the milestone-1 date arrives and the design
  ceiling of 107,646 applies, retiring the grace ceiling and this record with it.
---

# ADR-264 — The standing-payload grace ceiling may not rise; the Iron Law reserve is designed and deliberately not shipped

## Status

Accepted 2026-09-08. Decided by an AI council under a written owner delegation
covering an autonomous drain run. **The council split, and the split was resolved
by evidence rather than by preference — see § How the split was resolved.**

## Context

`src/config/preamble-payload-budget.json` contradicts itself. Its
`ci_delivery.why_a_grace_ceiling` (`:86`) says the ceiling is *"set AT the
measurement so growth beyond today reds immediately while today's tree passes"*
and, in the same string, **"It may never move UP."**

A ceiling set at the measurement sits exactly on `HEAD` — `grace_ceiling` is
138,490 (`:81`), which is `main`'s own measurement — so any standing growth in
any PR reds by construction. And `grace_ceiling_history` records it moving up
twice regardless: 138,212 → 138,273 on 2026-09-02, and 138,273 → 138,490 on
2026-09-08, each with a prose justification. The practised resolution is the one
the file forbids in writing.

Three PRs hit the same collision. #1707 (+770 tok) and #1920 (+298 tok) each
escaped by migrating prose out of the standing rule. **#1921 could not**: what
remains after migrating −608 of +786 is two fenced Iron Law blocks — the rule is
+478 chars over `main` and the blocks are ~480 — and `preservation-guard` forbids
condensing a fenced Iron Law further. Migration was the escape hatch for the
first two and does not exist for an Iron Law.

## Decision

**Option B. The "may not move upward" property survives; the contradiction is
resolved against the "set AT the measurement" framing, not against the cap.**

The surviving sentence, in the deciding seat's words:

> The grace ceiling is set at the measured `HEAD` value and may not move upward.

with the cost stated plainly rather than discovered per-PR:

> Standing-rule growth requires a compensating reduction elsewhere, except that
> independently authorized fenced Iron Law content may consume an aggregate
> reserve of at most 128 tokens above the grace ceiling.

**Option A — "the ceiling may rise on a recorded justification" — is rejected by
both seats.** The reasons are worth keeping, because Option A is the option an
autonomous run wants: a structured record improves auditability but still lets
the guarded value grow whenever an author supplies acceptable prose. Structure is
packaging, not consent. An agent that can add an Iron Law block, measure its own
delta, record its own irreducibility claim and promise a future compensation it
does not enforce has been given permission to raise the ceiling at will, as long
as it fills out a form. That is precisely the failure the source roadmap's Risk
Register row 2 names.

**The two historical raises are retained as policy violations caused by
contradictory wording.** They neither falsify this decision nor establish
precedent.

## How the split was resolved

The council reached **quorum 2 of 2 and did not converge.** One seat delivered
Option B with a full mechanism. The other rejected both A and B and proposed a
third reading — *"the ceiling is a measurement, not a policy"*: that
`why_a_grace_ceiling`'s own wording describes a **baseline**, not a cap, so the
raises are re-measurements rather than violations, and both other options design
workarounds around an unverified assumption — that "Iron Law" is a checkable
property at all.

That seat attached a falsifier to its own critique, stating that **if any one of
three conditions holds, it has misread the context and its objection falls
away.** All three were tested against the tree at `60a67a7b1`:

| # | Condition | Result |
|---|---|---|
| 1 | An authorization workflow already exists and was followed for the two raises | **Not met.** `grace_ceiling_history` carries prose `why` fields and no sign-off, approver or reference |
| 2 | `preservation-guard` or another document defines **checkable** criteria for Iron Law status | **MET.** `src/scripts/check_condensation.ts:196` — `IRON_LAW_HEADING = /^(#{2,6})\s+(The\s+)?Iron Laws?\b/`, enforced mechanically over every projection |
| 3 | The "may never move UP" sentence was added **after** the two raises | **Not met.** `git log -S'may never move UP'` returns one commit, `4ef90d350` of **2026-08-24**, which predates both raises (2026-09-02, 2026-09-08) |

Condition 2 holds, so by the seat's own stated terms its objection falls away and
the split resolves to Option B. Condition 3 additionally settles the substance:
the sentence came first and the raises broke it, so the contradiction is real and
not an artifact of ordering.

**What condition 2 does NOT establish, stated because the dissent was right about
it.** A heading regex is a *syntactic* check. It cannot tell whether prose
genuinely deserves standing Iron Law status, whether an author fenced ordinary
guidance to consume the reserve, or whether a loose guideline was retroactively
elevated. The dissent's deeper point survives its own falsifier, and the winning
design already answers it: the checker must verify **protected approval
metadata** and must not infer semantic importance from fence syntax or from
author-written justification.

## The reserve — designed here, deliberately NOT shipped here

The mechanism, recorded so it is not re-derived:

- `grace_ceiling`: 138,490 · `iron_law_reserve`: 128 · absolute maximum 138,618.
- Only the **net token delta of independently authorized fenced Iron Law blocks**
  may consume the reserve. Ordinary standing growth fails above the grace ceiling.
- The reserve is **aggregate, not per PR**, and never follows `HEAD` — a per-PR
  allowance relative to each new `HEAD` compounds, which is the accounting error
  that makes 107,646 unreachable.
- The ceiling may move **down** when measured payload falls below it, never up.
  Reductions repay outstanding reserve consumption first; further reductions
  ratchet the ceiling downward.
- Neither authors nor reviewing agents may create the approval metadata. It must
  bind approving human identity, commit SHA, block hash, approved delta,
  timestamp and rationale, and must live somewhere the PR author cannot edit — a
  field inside the same PR is not independent authorization.

**It is not shipped, and that is the decision, not an omission.** The deciding
seat was explicit: *"Wording alone creates an exploitable trust gap"*, and
enumerated eight fixtures that must pass before the exception is live — including
that ~120 authorized Iron Law tokens pass without a config edit, that the same
addition **without** protected approval fails, that ~120 ordinary tokens fail,
that two additions aggregating over 128 fail, that relabelling existing prose
into a fence fails, and that any upward edit to either bound fails.

Writing the permissive sentence into the config today, with no protected-approval
store and none of the eight fixtures, would create exactly the gap the seat named
— and would do it in the config the drain run is meant to police. So this record
carries the design and the config carries a citation to it, nothing more.

## Consequences

- `src/config/preamble-payload-budget.json` gains a `decision_record` pointer to
  this ADR in its `ci_delivery` block. **No bound is changed and no permissive
  sentence is added** — the citation is the whole edit.
- `road-to-a-standing-budget-with-headroom` step 1.1 closes. Step 1.2 ("if the
  answer is that it may rise, give the raise a shape") is **not applicable** by
  its own conditional and is cancelled. Step 1.3 ("give the ceiling headroom")
  stays open behind a new blocker naming the missing protected-approval
  mechanism.
- **PR #1921 does not merge under an exception that does not exist yet.** The
  deciding seat stated the ordering directly: enforcement, protected approval and
  fixtures must be active first. Until then #1921's residual 117 tokens need a
  compensating reduction like any other standing growth.
- The design ceiling of **107,646** remains the destination. Nothing here widens
  the tolerated part of the 28.4 % gap.

## Alternatives considered

- **A — the ceiling may rise on a recorded justification.** Rejected by both
  seats; see § Decision.
- **C — the ceiling is a baseline, not a cap.** Withdrawn by its own author's
  falsifier (condition 2), and independently weakened by condition 3.
- **Ship the reserve now with wording only.** Rejected by the deciding seat as an
  exploitable trust gap, and by this record as the one place a budget-policing
  change must not cut a corner.

## Evidence

Verifiable in the tree at `60a67a7b1`.

| Claim | Where |
|---|---|
| The file says both "set AT the measurement" and "may never move UP" | `src/config/preamble-payload-budget.json:86` |
| The ceiling sits on `HEAD` | `:81` — `grace_ceiling: 138490`, `main`'s own measurement |
| It moved up twice with prose justification and no sign-off | `.ci_delivery.grace_ceiling_history` — 138,212 → 138,273 (2026-09-02), 138,273 → 138,490 (2026-09-08) |
| The forbidding sentence predates both raises | `git log -S'may never move UP' -- src/config/preamble-payload-budget.json` → one commit, `4ef90d350`, 2026-08-24 |
| Iron Law status is syntactically checkable | `src/scripts/check_condensation.ts:196` |
| An Iron Law cannot be condensed away | `src/rules/preservation-guard.md` — fenced Iron Law blocks preserved byte-for-byte |
| The council split 2/2 and resolved on evidence | Both seats answered; verdicts and the three-condition falsifier are reproduced in § How the split was resolved |

**What this record does not establish.** That the 128 figure is right — it is the
deciding seat's proposal and no measurement backs the specific number; the second
comparable case would exhaust it, which that seat's critic named as a defect and
this record does not resolve. That a syntactic Iron Law check closes the semantic
question — it does not, and § How the split was resolved says so. And that any
consumer install behaves as measured here; every figure is this tree's.
