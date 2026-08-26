<!-- evidence-type: analysis -->
# Evolution-kernel decisions — brief for a single-pass answer

**What this is.** `road-to-governed-harness-evolution.md` records fourteen open
maintainer decisions. Five of them (E4, E6, E7, E8, E9) are *kernel* questions:
they fix vocabulary and structure that both that roadmap and
`road-to-experience-loop-broadening.md` would build on, so a program that starts
before they are answered encodes a guess as its foundation.

This brief exists so they can be answered in one pass instead of five. Per
decision: the question, what the tree actually says, both options with their
cost, a recommendation, and what stays blocked if it is left open.

**Not a decision.** Every recommendation below is advisory. Nothing here has
been applied to either roadmap.

**Measured on** `origin/main` @ `3738c23e3`, 2026-08-26. Every tree claim carries
the command or path it came from.

---

## The count is four, not five: E4 and E9 are one decision

`road-to-governed-harness-evolution.md:169-170` sets Phase 1's exit criterion:

> a deliberately failing trigger eval is classifiable as *content* vs
> *activation* vs *adherence* from the recorded receipt alone.

The 9-stage cascade option in E9 has no adherence stage; the 12-stage option
has activation/delivery and adherence as their own. And E4's 4-state activation
ladder (`eligible → selected → injected → consumed/adhered`) collapses
`consumed` and `adhered` into one rung, while its 6-state option splits
`projected/delivered` from `visible` and keeps `adhered` separate.

So the ladder supplies the rungs the cascade needs stages for, and Phase 1's
exit criterion needs the `adherence` rung to exist as its own thing. Answer them
as one question — **how finely is activation observed?** — and the cascade
follows. Answering them separately is what produces a roadmap whose Phase 1
cannot deliver what Phase 4 has no stage to measure.

---

## E4 + E9 — how finely is activation observed?

**Question.** Activation ladder: 4 rungs or 6? Cascade: 9 stages or 12?

**What the tree says.**

- Phase 1's exit criterion (above) requires content / activation / adherence to
  be separable. A 9-stage cascade cannot produce that separation.
- The delivery substrate that Phase 6 measures already distinguishes the two
  rungs the 6-state ladder adds: `src/scripts/_lib/lean_projection_mode.ts:19`
  defines `eager-all | thin | delivery`. Under `thin`/`delivery` an artefact can
  be *projected* without being *visible* in a given turn — which is precisely
  the `delivered ≠ visible` split.
- `road-to-experience-loop-broadening.md` Phase 5 independently requires five
  activation/adherence states (`not available / available-not-activated /
  activated-not-followed / activated-followed / unknown`). Two roadmaps needing
  the same distinction is the kernel argument in miniature.

**Option A — 4 rungs, 9 stages.** Cheaper to build. Requires rewriting Phase 1's
exit criterion to drop the adherence branch, and gives up the ability to tell
"the guidance was wrong" from "the guidance was never followed". The
experience-loop roadmap would then carry a finer vocabulary than the harness
roadmap, and the kernel would have two.

**Option B — 6 rungs, 12 stages.** More stages to build, each cheap on its own
(a stage is a filter, not a subsystem). Keeps Phase 1's exit criterion as
written. Matches the delivery substrate that already ships and the five states
the sibling roadmap needs.

**Recommendation: B.** Not because more is better — because A requires editing
an exit criterion in order to fit, and because the distinction it drops is the
one the delivery experiment exists to measure. If cost is the concern, the
honest lever is building stages 7–12 later, not defining fewer.

**If left open:** Phase 1 and Phase 4 cannot both be written. Phase 5 of the
sibling roadmap proceeds regardless and will fix the vocabulary by default,
which decides E4 without recording it.

---

## E6 — curator operation set: 4 ops or 7?

**Question.** `ADD / MERGE / REVISE / SKIP`, or
`KEEP / ADD / MERGE / REPLACE / SPLIT / RETIRE / SKIP`?

**What the tree says.**

- **`RETIRE` already has a carrier.**
  `src/agent-src/contexts/contracts/artifact-engagement-flow.md:32-33` states:
  "A retirement decision-maker — Phase 4's report surfaces signal; humans decide
  what to retire." So retirement is an existing, human-authoritative surface;
  including the op connects to it rather than inventing it.
- **`SPLIT` has no carrier.** Searched `src/rules/`, `src/skills/` and
  `docs/contracts/` for splitting machinery on artefacts — nothing. It would be
  new.
- `road-to-governed-harness-evolution.md:450` (step 7.6, post-promotion
  re-evaluation) already specifies the verdict set
  `KEEP / REVISE / MERGE / SPLIT / RETIRE`. So the 4-op answer contradicts an
  adopted step in the same roadmap.
- The skipped parent argued the 4-op set is "incomplete … because split and
  retire are first-class anti-sprawl actions".

**Option A — 4 ops.** Smaller surface. Leaves step 7.6 with verdicts the curator
cannot express, so 7.6 needs rewriting or a second vocabulary.

**Option B — 7 ops.** One vocabulary across generation and post-promotion
review. `RETIRE` lands on an existing surface; `SPLIT` is genuinely new and is
the only cost.

**Recommendation: B, with `SPLIT` marked as the one new mechanism** so its cost
is visible rather than smuggled in behind six ops that are not new. A defensible
middle exists — 6 ops, deferring `SPLIT` — and it keeps 7.6 nearly intact.

**If left open:** step 7.6 is unimplementable as written, and the anti-monotonic
-growth argument in that roadmap's risk 8 has no mechanism.

---

## E7 — sealed-holdout cadence: every cascade, or promotion candidates only?

**Question.** Does the sealed holdout run on every cascade, or only for
candidates already eligible for promotion?

**What the tree says — this one is greenfield, which changes the question.**

There is **no holdout machinery in this repository at all.** Verified:
`grep -rniE '\bhold[ -]?out\b' src/ docs/contracts/` returns three hits, all
advisory prose in product-strategy skills (`activation-design/SKILL.md:153`,
`onboarding-design/SKILL.md:157`, `churn-prevention/SKILL.md:154`), each saying
"do not change X mid-quarter without an A/B holdout". A fourth apparent hit in
`src/scripts/_lib/eval_publication.ts` is a substring false positive —
`Thres·holdOut·come`, the `ThresholdOutcome` type at `:302`.

So E7 is not "change an existing cadence". Nothing is being preserved, and the
cost argument is therefore the whole argument.

**Option A — every cascade.** Simpler control flow, one path. Each run consumes
holdout signal; the partition degrades as an unbiased set precisely because it is
being consulted repeatedly. One parent killed this option by name for that
reason.

**Option B — promotion candidates only.** Requires the three-partition split
(development / selection / sealed) and a rule for when a candidate becomes
promotion-eligible — which step 3.4's lifecycle enum already supplies
(`promotion-eligible` is one of its states).

**Recommendation: B.** The lifecycle enum makes the gating condition free, and
`paired_verdict`'s discordant-trial floor (`_lib/paired_verdict.ts:54-65`) means
the holdout is only ever read for a verdict that is powered — so reading it
every cascade spends the set on runs that could not have concluded anyway.

**If left open:** step 2.5 freezes a holdout partition with no stated read
policy, which is the "compromised before it is used" failure that step's own
rationale names.

---

## E8 — state-taxonomy arity: 4 classes or 5?

**Question.** Name authoritative / derived / evidence / adaptive state — or split
adaptive into experiment-adaptive and production-adaptive, the latter
prohibited by default?

**What the tree says — the 5th class may already exist under another name.**

`docs/contracts/no-runtime-boundary.md:40` carries the state-store test verbatim:

> if deleting the artifact changes *what* the tool can answer rather than only
> *how fast* it answers, it is a state store and prohibited

and ADR-124 classifies accordingly: Class A embedded/per-invocation
(`ADR-124:110`), Class B resident with its own escalation path (`:153`), Class C
state stores, prohibited (`:170-177`).

Map the proposed 5th class onto that:

- **production-adaptive state** — state that changes what the running system
  does. Deleting it changes *what* is answered → **Class C → already
  prohibited.**
- **experiment-adaptive state** — lives in a candidate clone, gitignored,
  rebuildable, destroyed with the clone → **Class A → already permitted.**

So the split the 5th class proposes is ADR-124's A-versus-C boundary restated in
new words, and the prohibition it wants to add is one that already exists.

**Option A — 4 classes,** citing ADR-124 for the adaptive boundary rather than
restating it.

**Option B — 5 classes,** with a second vocabulary for a boundary the tree
already draws. Its one genuine benefit: a reader of the roadmap sees the
prohibition without opening an ADR.

**Recommendation: A.** Same reasoning the roadmap already applies to its own K7 —
do not open a second governance vocabulary next to a contract that decides the
question. If the readability concern is real, the cheap fix is one sentence in
step 0.3 naming Class C explicitly, not a fifth class.

**If left open:** step 0.3 is written either way and whichever wording lands
becomes the kernel's vocabulary by default.

---

## Summary

| Decision | Recommendation | Load-bearing reason |
|---|---|---|
| **E4 + E9** (one question) | 6 rungs, 12 stages | Option A requires editing Phase 1's exit criterion to fit, and the sibling roadmap needs the finer vocabulary anyway |
| **E6** | 7 ops, `SPLIT` flagged as the one new mechanism | 4 ops contradict adopted step 7.6; `RETIRE` already has a carrier at `artifact-engagement-flow.md:32-33` |
| **E7** | Promotion candidates only | Greenfield — nothing to preserve; the lifecycle enum makes gating free and reading every cascade spends the set on unpowered runs |
| **E8** | 4 classes | The 5th restates ADR-124's Class A/C boundary; the prohibition it adds already exists |

Three of the four recommendations reduce what gets built. E6 is the only one that
adds a mechanism, and it adds exactly one.

**What this brief does not touch.** E1 (merge authority) and E2 (estate
placement) are not kernel questions and are unchanged. E3, E5, E10–E14 are
narrower and can be answered when their phase is reached.
