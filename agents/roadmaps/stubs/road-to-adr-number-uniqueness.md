---
complexity: lightweight
review_by: 2026-12-08
---

# Stub: road to an ADR number that cannot be claimed twice

> **Stub — not active work.** Found 2026-09-08 by the owner-delegated drain run while
> holding `road-to-delivery-on-hook-hosts`, whose step 4.2 owes a sentence to "the
> predecessor's ADR" and names ADR-262 as that ADR. An AI council (2 seats, unanimous)
> asked for the durable fix below and said in as many words that implementing it "exceeds
> the immediate disposition", so it is recorded here rather than built drive-by.

## The defect, reproduced

Two open pull requests each shipped a different architectural decision record numbered
262, and neither was merged:

| PR | Branch | File |
|---|---|---|
| #1923 | `drain/delivery-for-every-host` | `ADR-262-delivery-default-for-claude-code.md` |
| #1926 | `drain/abolish-carrier-gate` | `ADR-262-carrier-status-deleted-no-repo-authored-human-gate.md` |

Both branches carry an identical ADR-260 and ADR-261, so 262 was simply the first free
number each lane took independently. Neither lane can see the other from inside itself.

## It recurred, once, within a day — recorded 2026-09-08 by drain run 22

The disposition above was *record and defer*. **That disposition did not hold.** The
same defect fired again on the very next drain run, at the next number:

| PR | Branch | File |
|---|---|---|
| #1923 | `drain/delivery-for-every-host` | `ADR-263-delivery-default-for-claude-code.md` |
| #1932 | `drain/skill-surface-option-b` | `ADR-263-skills-are-explicitly-invoked-reference-material.md` |

Three things make this more than a repeat count, and they are why the recurrence is
written here rather than left to a third discovery:

1. **`#1923` is in both collisions.** It was one of the two ADR-262 branches above, and
   its head commit is literally `4788ba195` — *"Merge origin/main into
   drain/delivery-for-every-host, and renumber ADR-262 -> ADR-263"*. So the branch
   dodged the first collision by taking the next free number and **landed directly in
   the second one**. Renumbering is not a fix; it is the defect moving.
2. **The stub predicted the mechanism exactly** and the prediction cost nothing to
   verify: a lane takes the first free number it can see, and it cannot see the other
   lane. Recording that and waiting produced a second instance with the same shape.
3. **The interval was under 24 hours.** Both collisions are dated 2026-09-08.

Per [`recurring-criticism`](../../../src/rules/recurring-criticism.md), a recurrence is
evidence about the **system**, not only about the item — and the burden shifts to
whoever keeps the deferral. Which of the three outcomes applies is not settled here,
because run 22 did not have the authority to settle it and guessing would repeat the
error: the disposition may have been wrong, or right-but-unreachable, and the difference
matters for what gets built. What run 22 can say is that "record and defer" has now been
falsified once by observation.

**Run 22 did not renumber either branch**, and the reasoning is worth keeping because it
is the same trap: #1932 was green and #1923 stalled, so pre-emptively yielding 263 to a
stalled branch would leave 263 unused and 264 taken if #1923 is abandoned. Both PRs were
commented instead, so neither merges into the collision unaware. That is mitigation, not
a fix — the fix is still the durable one this stub asks for.

## It recurred a THIRD time, same PR, next number — recorded 2026-09-08 by the merge that hit it

| PR | Branch | File |
|---|---|---|
| #1923 | `drain/delivery-for-every-host` | `ADR-265-delivery-default-for-claude-code.md` |
| merged | `main` (from the iron-law-reserve lane) | `ADR-265-iron-law-reserve-refused-verifier-inside-the-change.md` |

**The sequence on one branch is now 262 → 263 → 265, three collisions in three
renumbers**, which is the stub's own prediction landing for the third time: *"Renumbering is
not a fix; it is the defect moving."*

Four things are new, and they are why this is written here rather than left to a fourth
discovery:

1. **One side is MERGED this time.** The two earlier instances were open-PR-vs-open-PR, so
   the council's tie-break — *the earlier-opened PR keeps the number* — had two movable
   candidates. Here `main` already carries its 265, and renumbering a landed record would
   rewrite the identity of a decision every other branch already cites. **The direction is
   therefore forced by evidence rather than chosen**, and the tie-break above does not apply:
   its precondition (both unmerged) is gone.
2. **It is no longer silent.** The earlier instances passed `check_adr_frontmatter` (exit 0,
   measured above) and were found by a human. This one **reds CI**:
   `.github/workflows/rule-backstops.yml:403` runs
   `adr/regenerate_index --dir docs/decisions --check`, and the generator fails hard with
   `error: ADR-265 duplicate: … and …`. So the single-tree half of the fix partly exists
   already — in the *index generator*, not in the gate the stub proposed extending.
   `check_adr_frontmatter` still passes on a flat duplicate, so the § What the fix looks like
   analysis stands; what changed is that the collision now reaches a red check instead of
   `main`.
3. **The renumber cost 11 files of prose.** `ADR-265` was cited from 15 files, of which
   **four mean main's record and must not move** (`road-to-iron-law-reserve-activation.md`,
   `council-2026-09-08-iron-law-reserve-store.md`, `check_preamble_payload_budget.ts`,
   `standing_bound_ratchet.ts`). A sweep over the bare string would have silently re-pointed
   four references to the wrong decision — which is exactly the harm § Why nothing catches it
   names, arriving through the *repair* rather than through the collision.
4. **The 264 gap the stub predicted did not open, and 266 nearly did.** A parallel
   uncommitted branch held an `ADR-266`. #1923 took 266 anyway — it is the branch with a live
   PR, and the stub's own reasoning is that yielding a number to a stalled lane leaves the
   number unused and the next one taken. The uncommitted lane moves instead, because an
   uncommitted record is the cheaper one to renumber.

**The entry condition below is met.** *"When: the next time two lanes collide on an ADR
number"* — this is that time, for the third time, and the disposition *record and defer* has
now been falsified twice by observation. Per
[`recurring-criticism`](../../../src/rules/recurring-criticism.md) the burden sits with
whoever keeps the deferral; which of its three outcomes applies is still not settled here,
for the same reason run 22 gave — the merge run that found this owns no authority over how a
lane opens an ADR, and guessing would repeat the error a fourth time.

## Why nothing catches it — measured, not assumed

Two independent reasons, and the second is the one that makes this worth a record.

**Git does not conflict.** The two filenames differ, so both files coexist after a merge.
There is no index conflict to notice.

**The ADR gate does not fail.** Both files were materialised into one tree and
`./scripts-run src/scripts/check_adr_frontmatter` was run over it: **exit 0, "no
errors"**, with both files declaring `adr: 262`. The gate builds a number index — and its
own source comments at `src/scripts/check_adr_frontmatter.ts:960-972` discuss a six-way
per-area collision on `adr: 0001` and the false-negative direction being the dangerous one
— but it does not fail on two *flat* records sharing a number. The probe files were removed
in the same run and neither lane's ADR was committed anywhere.

So a duplicate ADR number reaches `main` silently, and the first reader to notice is
whoever follows a citation to the wrong decision.

## What the fix looks like

A check that rejects two records claiming one number, and — the harder and more valuable
half — one that can see a number claimed on an **unmerged branch**, since that is where
both claims lived. A single-tree check would not have caught this collision before merge;
it would only have caught it afterwards, which is late but still far better than silence.

- **Single-tree half:** extend `check_adr_frontmatter` so the flat number index fails on a
  second record with the same number rather than keeping one. Cheap, and the existing
  per-area `perArea: true` carve-out shows the index already distinguishes the corpora.
- **Cross-branch half:** needs a source of truth for numbers claimed but unmerged — a
  CI job that reads `docs/decisions/` across open PR heads, or a reserved-number ledger a
  lane appends to when it opens an ADR. The second is more reliable and more intrusive.
  Which one is a real design decision and is why this is a stub rather than a one-line fix.

## What was done instead, in the change that found this

Nothing was renumbered — the finding lane owned neither PR, and the council explicitly
foreclosed editing a branch it does not own. `road-to-delivery-on-hook-hosts` step 4.2
carries the collision note, the measurement above, and the council's tie-break as a
recommended owner action: the earlier-opened PR keeps the number, so #1923 keeps ADR-262
and #1926 renumbers to ADR-263 — verified free across `origin/main` and all five open-PR
branches at the time, and to be re-checked at renumber time.

The council also asked for a comment on both PRs to reach their owners.
`personal.pr_progress_comments` resolves to `false` on every settings layer, so that is
gated by `no-pr-progress-comments` and was not done; the council's own stated fallback was
to record the recommendation instead, which is what happened.

## Entry condition

- **What:** a decision on the cross-branch half — CI over open PR heads, or a reserved-number ledger.
- **When:** the next time two lanes collide on an ADR number, or when the single-tree half is wanted on its own.
- **Who:** maintainer, since the cross-branch half changes how a lane opens an ADR.
