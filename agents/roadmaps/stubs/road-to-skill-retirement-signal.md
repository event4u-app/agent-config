---
complexity: bounded
review_by: 2026-09-24
---
# Stub: the skill-retirement signal

> **Stub — not active work, and a DRAIN-RUN TRANSFER** in the sense
> [`README.md`](README.md) § The two classes defines. **Capability-gated:** the
> retirement mechanism is decided, wired and tested; what is missing is the
> **input** — a signal that nominates a candidate. Promoted by its own named
> probe returning true, never by the shared demand-gate criteria.

## What was transferred

From [`archive/road-to-skill-estate-drawdown.md`](../archive/road-to-skill-estate-drawdown.md)
Phase 4, on an AI council verdict of 2026-08-25 (2/2 for option (a); the
maintainer delegated owner-reserved dispositions to the council for that drain
run).

- **4.1** "Retire the candidates Phase 1 ranked, in one reviewable batch."
- **AC-6's objective** — `skill_count` below 299 with every retirement citing its
  ranking row. The criterion itself is recorded **UNMET in the parent**, which is
  not the same as transferred; see § How AC-6 is recorded.

## Why no automation can supply it

**Phase 1.3 published a null, and it is still true.** Re-measured 2026-08-25, on
the tree rather than from the parent's record:

| signal | instrument | reading |
|---|---|---|
| duplicate responsibility | `audit_skill_overlap` | **0 pairs ≥ 70 %** over 299 skills |
| dead cross-skill links | `lint_handoffs` | 18 findings, **all `handoff_tier_mismatch`** — a `tier` backfill backlog on the linked-TO skills. **0 retirement candidates.** |
| no unique outcome | `skill_eval_coverage` | 42/299 = 14 % — silent on the other 257 |
| low relevance score | `src/shared/skillRanking.ts` | a per-query ranker with **no dead-skill threshold** |
| **never triggered** | **`none`** | `grep -cE 'appendFileSync\|writeFileSync' src/scripts/hooks/skill_route_hook.ts` → **0**. No persistence path exists. |

Estate at transfer: **299 skills, 11,461 description tokens, 0 deprecated**.

So a run cannot retire "the ranked set" because there is no ranked set, and it
cannot manufacture one without inventing a criterion nobody pre-registered. Both
council seats refused that route independently: **"no eval coverage" means
UNMEASURED, not unnecessary**, so the 257 skills without an eval are not
candidates — they are the un-instrumented majority.

## The named producer and its probe

**Producer:** whoever builds the never-triggered instrument, plus the maintainer
who approves the tranche. Both seats required **BOTH** gates, and the pairing is
the point: the instrument supplies evidence, the maintainer supplies authority,
and neither substitutes for the other. A prior council call **SPLIT** on whether
an autonomous run may retire consumer-visible capabilities at all; that split
stands and is why the authority half is named separately here.

**Probe — `skill-retirement-candidates-available`.** Returns true only when
**all** of:

1. `skill_route_hook.ts` persists a per-skill route decision to a sink, and the
   sink exists;
2. an observation window has run whose **length, minimum route volume and
   candidate threshold were declared BEFORE the data was collected** — both seats
   insisted on this ordering, so that "no signal" cannot be re-derived after the
   fact from a window chosen to produce it;
3. the window nominates ≥ 1 skill under that threshold;
4. a maintainer-approved tranche exists, or a standing retirement policy the
   tranche falls under.

Conditions 1 and 3 are mechanically checkable. Conditions 2 and 4 are not, and
that is the point rather than a gap: a repository gate cannot see whether a
threshold was chosen before or after the numbers, nor whether a human approved a
removal.

**Entry conditions to declare before any collection** (both seats, and the list
is theirs rather than this file's):

- the persistence format for a route decision;
- the observation window — length AND minimum route volume, because a window
  with too little traffic distinguishes nothing;
- the candidate threshold (e.g. zero triggers over N sessions);
- how a false negative is treated — a skill that never triggered because its
  trigger is broken is a **repair** candidate, not a retirement one;
- the approving authority for the tranche.

**Baseline on the transfer date, so a later reader can tell movement from noise:**
the sink does not exist, the window has never run, and no skill carries
`lifecycle: deprecated`.

## How AC-6 is recorded — the one thing the council split on

Both seats rejected the bare word **failed**: it reads as *the mechanism did not
work*, and the mechanism was never exercised.

They differed on what to say instead. One argued **TRANSFERRED (blocked on 4.1)**,
on the ground that a criterion which could not be *attempted* is blocked rather
than failed, and that calling it failed inverts a positive finding — the estate
was checked and no slimming was indicated. The other argued that a work item may
transfer while an **acceptance criterion records an outcome**: AC-6 says below
299, the measured value is 299, so it is **UNMET in this roadmap** with the
objective carried forward.

**The stricter accounting was adopted**, and it is recorded here because it is
also the one that contains the other's objection: *"UNMET in this roadmap;
objective carried forward"* states the outcome without implying the mechanism
failed. The parent's AC-6 carries that wording; this stub carries the objective.

## What this stub does NOT cover

- **The retirement mechanism**, which shipped and is tested:
  `lifecycle: deprecated` for one release then delete, with `_lib/skill_estate.ts`
  EXCLUDING deprecated skills from both metrics so deprecating one **lowers** the
  count. Without that exclusion the mechanism would be unusable against its own
  gate.
- **The ratchet**, which shipped: `skill_count` and `skill_description_tokens` on
  `check_estate_count`, floors measured on the base ref, both proven red by
  sabotage.
- **The admission and refusal ledger**, which shipped:
  `agents/decisions/skill-admissions.jsonl` + `check_skill_admissions`.
- **Repairing the 18 `handoff_tier_mismatch` findings.** They are a `tier`
  metadata backlog on the linked-TO skills and have nothing to do with
  retirement; treating them as retirement candidates is the exact false-negative
  trap the entry conditions above name.

## The finding this stub preserves

**299 skills, and not one nominated for retirement by any working signal.** One
seat put the consequence plainly: recording that as a failure inverts it — what
happened is *checked, found slimming not indicated by the instruments that
exist*, not *tried to slim and could not*. The gap is instrumentation, not bloat,
and the successor should start from that rather than re-derive it.
