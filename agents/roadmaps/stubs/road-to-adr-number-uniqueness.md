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
