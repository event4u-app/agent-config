---
complexity: lightweight
review_by: 2026-09-20
probe: none
---

# Stub: append-safety for the ratchet baselines

> **Stub — not active work.** Created 2026-08-21 by
> `road-to-generated-artifact-conflict-drawdown` Phase 4. Two carried items with
> different blockers. Item A is **design-gated**: the AI council (2026-08-21, 2
> seats + blind peer review) refused the shape that was proposed for it and named
> the safe one. Item B is **merge-gated** on another PR. Neither is speculative —
> both are measured conflict paths with a decided direction.

## Item A — extract `baseline_history`, with an explicit record reference

### The measurement that makes it worth doing

`src/config/estate-count-budget.json` conflicts in **every** open `CONFLICTING`
PR and appeared in 11 of the last 50 sessions, at 93 commits / 60 days. Of its
**43** non-merge commits, **40** touch only history-entry lines — the dominant
conflict mode is an append. The file carries **71** `baseline_history` entries,
and exactly one of them is read: `check_estate_count.ts:424` takes
`(budget.baseline_history ?? []).at(-1)` and uses its `why` to validate that a
baseline *lowering* carries a real reason. No reader iterates the array.

### The shape that was REFUSED, and why — read this before proposing it again

The obvious extraction is one file per record with the reader taking the
**lexicographically newest** filename. Both council seats named this their
hardest pushback, independently, and it is a silent authorisation failure:

1. Branch A lowers the baseline 100 → 80 and records justification A
   ("removed dead code").
2. Branch B appends a later-sorting record for a different change
   ("removed duplicate routes").
3. The per-record files merge with **no conflict** — that is the whole point of
   the split.
4. The reader selects the newest by filename and gets B's record.
5. The gate validates A's lowering using B's justification, and **passes**.

The `why` is what *authorises* the lowering. Attaching the wrong one is not a
cosmetic defect: it is the ratchet accepting an unjustified walk-down while
every file merges cleanly and CI stays green. The single-file conflict that
exists today is ugly and it **forces reconciliation**; filename ordering
discards that property.

This is not one of the no-union-merge record's six merge-driver preconditions — it is a separate
**semantic-association** requirement, which is why that record does not already
block it and why this stub has to say so.

### The endorsed shape

An explicit, immutable record reference from the budget itself:

```json
{
  "baseline": 123,
  "lowering_reason_record": "2026-08-21T131109Z-lower-to-123"
}
```

The gate validates that the referenced record exists, identifies the resulting
baseline it justifies, carries a real reason, and is uniquely named and
schema-valid. A concurrent edit to that **pointer** still conflicts — and that
is wanted: two competing baseline transitions require a human to reconcile
which one won.

### Re-entry gate

A change proposing this ships all of:

- **P1 — a concurrent-branch integration test that FAILS on the lexicographic
  design.** Construct the five-step sequence above; assert the gate rejects it.
  A test that has not been observed red against the naive reader proves nothing.
- **P2 — migration equivalence.** The 71 existing entries round-trip, and
  `check_estate_count` reaches the same verdict on the same tree before and
  after.
- **P3 — malformed / missing / ambiguous reference cases**, each a hard failure
  rather than a fallback pick.
- **P4 — proof that no consumer depends on file order or last-record-wins**, per
  precondition 5 of that record, which does transfer to this design.

Baseline at transfer: **0** of P1-P4 exist. The reader is
`check_estate_count.ts:424` and it is unchanged.

### Named producer

Any agent or maintainer — this is ordinary engineering work, not a capability
gap. It is separated only because it changes gate-authorising semantics and the
council asked for it in its own PR with its own test matrix.

## Item B — classify three unclassified ratchet baselines as `REMEASURED`

`src/config/rule-activation-census.json`, `src/config/pack-size-budget.json`
and `src/config/hook-latency-budget.json` each conflicted in one of the last 50
sessions and **none** is classified in `src/scripts/sync_pr_branch.ts`, so the
tool tells the reader to make a human decision about a number. Picking a side on
a measurement is how a ratchet silently loosens; the correct resolution is to
re-run the measurement on the merged tree.

The class that says exactly that — `REMEASURED` — exists, but only on the open
branch `feat/merge-hotspot-drawdown` (**PR #1513**). Implementing it a second
time on `main` would duplicate a written mechanism and guarantee a structural
conflict in the same file, so this waits rather than races.

### Re-entry gate

PR #1513 merges. Then one change adds the three paths to its `REMEASURED` list
with a test asserting each classifies as re-measured — the same shape as the
`GENERATED` additions made for `docs/decisions/INDEX.md` and `dist/router.json`.

Probe: `grep -c REMEASURED src/scripts/sync_pr_branch.ts` on `main` returns 0
today; it returns non-zero once #1513 lands.

## What is explicitly NOT here

**The `gate-violation-baselines.json` split.** Its `gates.<name> -> {count,
landed, note}` dictionary has no cheaper safe append transformation: per-gate
files would assert that independently updated counts form one coherent
aggregate, and whether that holds is the unresolved gate-independence /
measurement-epoch question the no-union-merge record noted a council split on. Both seats
reconfirmed on 2026-08-21 that this path stays conflict-prone until that
question is answered, and that the conflict there is **preserving a meaningful
concurrency boundary** rather than costing anything.

**A back-link from the no-union-merge record to this stub.** It belongs there and
cannot be made here — the record does not exist on `main`; it lands with
the accepted `no-union-merge-for-ratchet-baselines` record.
Two consequences, both deliberate. Its path is never spelled, because a path a
clone of `main` cannot resolve is a broken reference and `check_references` is
right to say so. And it is cited by DECISION NAME rather than by number: while
#1513 was open, `ADR-239` was taken on `main` by the drain-command record, so the
number that branch used will change and any citation of it here would rot. Add the reference in
the same follow-up that discharges Item B.

## Item C — the consumer rollout of the dashboard untrack

Carried here rather than into the cutover stub it belongs in, because that stub
(`road-to-dashboard-untrack-cutover`) does not exist on `main` either — it lands
with PR #1513. Fold this into it when that merges; until then this is the only
copy.

**What Phase 1 of the parent roadmap discharged:** the repository-side blocker.
`--check` now has an explicit tracked/untracked mode, so absence is a
distinguished case rather than a staleness report. That was the one item both
councils agreed an agent could execute.

**What the council ANSWERED that the cutover stub records as an open probe.**
The stub's P2 asks whether the version-skew kill zone can be closed by a guard
in the shipped workflow template. Answered 2026-08-21, both seats: **no, and the
skew does not close by itself either.**

- A guard placed in the *new* template cannot reach a consumer still running an
  *old copied* template — copies in consumer repos are not auto-updated.
- A consumer whose dashboard is *already tracked* keeps working: an ignore entry
  does not untrack a committed file, which narrows the failure but does not
  remove it.
- A consumer that untracks while an old workflow still asserts a committed
  artefact goes red regardless of the new tool's absent-file behaviour.

**Therefore the ordering is fixed, and it is not the one the handover proposed:**
release the tool with explicit untracked mode first (**done** — Phase 1); make
consumer migration opt-in, or migrate workflow and policy together; only then
make untracked the default for new installations. Distributing the entry through
`src/config/gitignore-block.txt` before that is what the council blocked, and
this PR does not touch that file — verified byte-identical to `origin/main`.

**Also refused:** inverting the shipped workflow to *fail-if-tracked*. "Not
tracked" is a migration check, not a correctness check — once untracked it
proves neither that generation succeeds nor that the view is current. A future
consumer workflow must exercise the generator and, if output exists, verify
freshness.

**Still open, unchanged:** the unstage mechanism (P3). Nothing in the repository
runs `git rm --cached`; two checks and one command only *print* it. Automating it
would reverse a deliberate user-owns-git-ops design, so it needs a recorded
decision, not an implementation. The parent roadmap kept the print-only shape.
