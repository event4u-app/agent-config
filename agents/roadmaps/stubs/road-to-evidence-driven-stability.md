---
complexity: lightweight
review_by: 2026-10-15
---

# Stub: stability is evidence-driven, never age-driven

> **Stub — not active work.** It records a governance principle the owner
> decided on 2026-09-11, and the mechanical change that follows from it, so the
> next contract deadline meets a decision rather than a fresh argument. Created
> by round `inbox-2026-09-y` after `docs/contracts/release-sizing.md` lapsed and
> reddened every pull request in the repository.

## The principle

```
STABILITY IS EVIDENCE-DRIVEN, NEVER AGE-DRIVEN.
`keep-beta-until` SCHEDULES A REVIEW. IT DOES NOT PROHIBIT PROMOTION BEFORE
THAT DATE, DOES NOT REQUIRE CONTINUED BETA AFTER IT, AND MUST NOT TURN CI RED.
```

Elapsed calendar time is not a proxy for maturity, and under AI-driven
development it is an actively misleading one: a contract can accumulate hundreds
of real executions, several releases, replay corpora and genuine consumer
reliance inside a few days, while another sits practically unexercised after
ninety. A date measures neither.

Three consequences, stated so they are checkable rather than admired:

1. **A contract may go `stable` immediately** when the evidence is strong
   enough. There is no minimum beta age, and none may be introduced.
2. **A passed `keep-beta-until` date means "a maturity decision is due"** — read
   the graduation criteria — and nothing more. It is not a finding, not a
   defect, and not a reason to refuse a pull request that touches no contract.
3. **CI may report missing or contradictory stability evidence. It may not go
   red because a contract "ought still to be beta".**

## The graduation criteria, and what they may not contain

A contract is promotable when all three hold, checked on demand rather than on
a date:

| # | Criterion | How it is checked |
|---|---|---|
| 1 | **Active enforcement or real exercise** | a gate, lint or runtime path cites it as its normative source, or a replay/regression corpus exercises it |
| 2 | **Consumer reliance** | it is referenced from a consumer-facing surface, or a tracked artefact records a consumer depending on it |
| 3 | **No known pending incompatible change** | no roadmap, decision record or open discussion proposes a breaking revision |

A major or minor release the contract passed through is **evidence** toward (1)
and (2). It is never a required waiting period, and "shipped through N releases"
may not appear as a criterion in its own right.

```
NO GRADUATION CRITERION MAY CONTAIN AN ELAPSED-TIME TERM.
NOT "30 DAYS", NOT "ONE MAJOR", NOT "A FULL RELEASE CYCLE".
```

## The one legitimate hard block — the inverse

The only stability claim worth failing a build over is a **false** one: a
contract declaring `stability: stable` while an explicitly recorded, objectively
measurable graduation criterion is demonstrably unmet. That block is a
structured fact about the tree, not an administrative proxy.

Keep that criterion set small, and keep elapsed time out of it — otherwise the
inverse gate reintroduces the age rule through the back door.

## What changes mechanically

- [x] `check_beta_review_markers` stops exiting non-zero on a lapsed
      `keep-beta-until`. Done 2026-09-11: `LAPSED_SEVERITY_FRESH` is `warning`,
      the upcoming-lapse advisory no longer promises an error on the date, and
      the gate's three remaining errors are the ones that were never about time
      — no disposition declared, two declared, or a window past the maximum.
- [ ] The frozen 85-entry lapsed baseline is retired with it. **Narrowed, still
      open**: it no longer gates anything, so it is a label rather than a
      ratchet, and the report still uses it to tell cohort debt from a lapse
      that arrived since. Deleting the file removes that distinction from the
      report too, which is a separate call and stays on this stub rather than
      being taken silently inside a change about the blocking half.
- [x] The fresh-versus-inherited distinction stops being the mechanism that made
      one contract's date red every unrelated pull request. It survives as
      reporting only; nothing branches on it for the exit code.
- [ ] The stability policy gains the principle above and the three criteria, so
      a reader learns the rule from the contract rather than from a stub.
- [x] The four contracts lapsing 2026-09-15 — `harness-expectations.md`,
      `install-layout.md`, `install-scopes.md`, `surface-tiers.md` — are each
      evaluated against the three criteria, **with no new deadline set**. Done
      2026-09-11; the record is
      `agents/evidence/analysis/beta-window-2026-09-15-evaluation.md`, and three
      of the four carried a repairable defect that is repaired in the same
      change. `auto-orchestration-v1.md` and `write-engine.md` are still owed.

## Why this is a stub rather than active work

The mechanical change removes a blocking gate. Removing a gate is a governance
decision the owner takes; the owner took the principle on 2026-09-11 and
authorised the removal the same day, so the blocking half is done rather than
planned. The advisory replacement lives in the same script, which was the
cheapest of the three open questions and the only one the change had to answer.

What is still open, and why it is not folded in here: whether the baseline file
is deleted or emptied — it gates nothing now, so the remaining question is about
the REPORT and not about the build — and whether the stability-policy edit wants
a decision record of its own.

## What already happened, so it is not re-derived

`docs/contracts/release-sizing.md` was promoted to `stability: stable` on
2026-09-11 by owner decision, and its `keep-beta-until` line was deleted. The
evidence: unchanged since the day it was written, normative source for the
changelog rollback lint, referenced from the consumer matrix, and carried
through release 15.0.0 without breaking — criteria 1, 2 and 3, all met, none of
them a date.

An AI council was consulted the same day and both seats answered promote. Its
useful residue is recorded on
[`road-to-fresh-beta-lapses-2026-09`](road-to-fresh-beta-lapses-2026-09.md); the
part this stub supersedes is its extend-with-a-60-day-window option, which is
the age rule wearing a falsifiable condition.

## Verification

```bash
./scripts-run src/scripts/check_beta_review_markers; echo "exit=$?"
grep -c 'keep-beta-until' docs/contracts/release-sizing.md
```

The first is 0 today because the one fresh lapse was promoted away; it will be 1
again on 2026-09-15 unless the change above lands first. The second is 0.
