# Rules-as-skills falsification probe — terminal honest null

<!-- evidence-type: analysis -->

> **Produced by:** Phase 4 of `road-to-request-scoped-rule-load`, executed after
> its resume trigger fired.
> **Observed:** 2026-08-20 (reading), over first-party measurements dated
> 2026-08-08 (Claude Code `2.1.226`) and 2026-08-16 (second host).
> **Verdict:** **honest null — do not adopt.** The locked design's terminal set
> is adopt-or-honest-null; this is the null, and it is reached on the
> destination surface's measured delivery, not on a taste argument.

## Why this ran now

Phase 4 was parked by council verdict 2026-07-07 with its design locked. Its
resume trigger was restated 2026-08-08 and named exactly one precondition:

> Resume when P2.1 of `road-to-rule-delivery-integrity` closes — the
> catalogue-logging falsifier that measures whether a skill's *description*
> reaches the model at all. That is the only precondition the two remaining
> steps actually have: a rules-as-skills falsification probe is uninterpretable
> while the delivery of the surface it moves rules *onto* is unmeasured.

That trigger has fired. `agents/roadmaps/archive/road-to-rule-delivery-integrity.md:241`
carries `- [x] **P2.1 Log the injected skill catalogue once per session**`, and
that roadmap is archived. The header's older `discipline_profile: essential`
trigger is retired in the same block, for reasons recorded there.

The un-park is itself the finding this file opens with: the probe was not
executed because a gate stayed shut, and nothing was watching the gate.

## What the probe asks

Whether a rule body may be moved onto the **skill** surface without losing the
compliance the rule surface delivers. The locked design: a three-rule pilot —
one tier-1 routing rule, one tier-2 discipline rule, safety floors excluded by
design — canary methodology, a length-controlled paired judge, a **skeptical
prior**, terminal on adopt-or-honest-null.

## Why it is answered without building the judge

The design's own precondition is the answer. A paired judge measures whether the
*content* survives the move. It cannot measure, and does not ask, whether the
destination surface **arrives at the model at all** — and that question was
measured first, on the exact host Phase 4 targets.

**Measured, Claude Code `2.1.226`, 2026-08-08**
(`agents/evidence/analysis/skill-catalogue-description-delivery.md`):

| Corpus | Entries | With `description:` on disk | Without |
|---|---:|---:|---|
| `.claude/skills/*/SKILL.md` | 414 | 414 | 0 |

Our projection is complete — hypothesis (A), an artifact defect, is refuted
deterministically. What the model *received* that session is the other half:
of eight sampled entries, **five arrived as bare names** while carrying a
description on disk. The loss is host-side. Against that, the census records
288 skills shipped, **0** with a machine-matchable trigger key, and **12
invocations across 30 sessions covering 4 distinct skills**.

**Measured, second host, 2026-08-16**
(`agents/evidence/analysis/scoped-projection-host-delivery.md`): every
description stripped in both arms; 402 entries dropped at 297 skills, 330 at
226. That file states plainly that it extrapolates nothing to Claude Code,
whose mechanism is a different one — so it is cited here as corroboration of
the *class* of failure, never as the Claude Code number.

## The verdict, under the stated skeptical prior

A rules-as-skills migration trades a surface that is delivered unconditionally
for one whose delivery is measured as lossy on the target host, and whose
selection rate over 30 observed sessions is 12 invocations across 4 skills. A
skeptical prior does not clear on that. **Do not adopt.**

Three things this null deliberately does **not** claim:

- **Not** that rules-as-skills is wrong in principle. It is unmeasurable while
  the destination surface's delivery is lossy, which is a different statement.
- **Not** that a paired judge would have returned a negative. It was never run;
  saying otherwise would be the fabricated measurement this repository's
  disposition framework forbids.
- **Not** that the catalogue observation is a measurement. The 414/414 count is;
  the injected-catalogue sample is a single-session first-party observation and
  its own source says it stays one. The verdict rests on the conjunction of that
  observation with the deterministic invocation census, and is stated at that
  strength.

## What would reopen it

A dated observation that description delivery on Claude Code is no longer lossy
— concretely, a session in which a sampled majority of catalogue entries arrive
**with** the description they carry on disk, plus an invocation census whose
rate is materially above 12-in-30. Either would make the paired judge
interpretable, and the locked design is preserved verbatim in the roadmap for
that case.

## Provenance

- Resume trigger fired: `agents/roadmaps/archive/road-to-rule-delivery-integrity.md:241`
- Claude Code delivery measurement: `agents/evidence/analysis/skill-catalogue-description-delivery.md`
- Second-host corroboration: `agents/evidence/analysis/scoped-projection-host-delivery.md`
- Disposition framework for this run: `agents/evidence/council/drain-blocker-dispositions-a.md`
