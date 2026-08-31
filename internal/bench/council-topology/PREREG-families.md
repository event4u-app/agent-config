# Council topology — benchmark families (pre-registration)

Registered 2026-08-31 · owner: maintainer ·
`road-to-inbox-harvest-2026-08-e-council-topology-evidence` step **2.1**
("Pre-register benchmark families ... verify: the family list and per-family
success criteria are committed before any arm runs").

**This record is written before any arm has run, and that is the point.** The
runner does not exist — both seats of the AI council of 2026-08-31 declined to
greenlight it — and `call-manifest.json` carries `pending` on all 352 eligible
cells. Nothing here can have been fitted to a result, and the ordering is
checkable in the git history rather than asserted: this file's commit precedes
any commit that records an outcome.

Scope: this file fixes **which families are eligible and what counts as success
in each**. It does not fix how a promotion claim is reported (step 2.6, already
pre-registered in [`../council-topology-promotion-stats-PREREG.md`](../council-topology-promotion-stats-PREREG.md)),
and it does not fix the metric set (step 2.3). Those are separate
pre-registrations and neither is bought by this one.

The machine-readable form of this list is `BENCH_FAMILIES` in
`src/scripts/ai_council/topology_bench_manifest.ts`, guarded at arity 12 in
both the type layer and at module load. This document and that constant are the
same list; the constant is what the manifest expands.

## All twelve are quoted, none is derived

Step 2.1 enumerates exactly twelve families in its own prose. Every
`roadmap phrase` below is a **quotation** from that step, in the order the step
lists them. No family here was inferred, split, merged, or invented, and the
count was not adjusted to reach twelve.

Reducing this list is a **weakening of criterion 2.1 and is owner-reserved** —
both council seats refused to approve it, and the runtime arity guard throws
rather than letting the set shrink silently.

## The three labels, and why they are never pooled

Fixed by the resolved `blocker: maintainer-blind-ratings`, option **(b)**:
scope the affected phases to gradeable-only slices and publish the
human-rubric arms as deferred, with the originating rationale intact.

| Label | Meaning |
|---|---|
| `gradeable-confirmatory` | A deterministic key or an executable oracle decides the outcome. String match or a test runner, never a judge. |
| `model-graded-exploratory` | No deterministic oracle and no human rater. A model grades against a fixed key. Named as exploratory wherever it is reported. |
| `human-rubric-deferred` | Needs a blind human rater. None is available; the family is registered in full and runs no arm. |

**These three are never pooled, averaged together, or reported as one number.**
That is the blocker's resolution verbatim: a model-graded arm is defensible
only when named as what it is, and *never* as "the human-rubric arm". A
model-graded substitute is not run in place of the deferred family.

## The twelve families

### 1. `architecture-trade-offs` — `model-graded-exploratory`

> roadmap phrase: *"architecture trade-offs"*

**Success:** a named trade-off axis, both sides costed, and a disposition.
Graded by rubric against a fixed key. No deterministic oracle exists for
"is this the right architecture", so the arm is exploratory and is never pooled
with a confirmatory result.

### 2. `roadmap-critique` — `model-graded-exploratory`

> roadmap phrase: *"roadmap critique"*

**Success:** seeded defects in a synthetic roadmap — a missing `verify:` line,
an unfalsifiable criterion, a step that closes nothing — are named. Recall
against the seeded set is countable; the severity ranking is rubric-judged,
which is what keeps the family exploratory rather than confirmatory.

### 3. `adr-reopening` — `model-graded-exploratory`

> roadmap phrase: *"ADR reopening"*

**Success:** the record is opened before it is cited, the mechanism-match
question is answered, and the routing verdict (council-decidable vs
owner-reserved) is stated. Graded against a fixed key per item.

### 4. `requirements-completeness` — `model-graded-exploratory`

> roadmap phrase: *"requirements completeness"*

**Success:** seeded omissions in a synthetic requirement set are recovered.
Recall against the seeded set is countable; the false-addition rate is
rubric-judged.

### 5. `code-review-seeded-defects` — `gradeable-confirmatory`

> roadmap phrase: *"code review with seeded defects"*

**Success:** each item carries `n` seeded defects at known `file:line`. Primary
metric is recall over the seeded set; secondary is the false-positive count
against a frozen key. Deterministic — string match on the seeded identifier,
no judge in the loop.

### 6. `security-review-seeded-findings` — `gradeable-confirmatory`

> roadmap phrase: *"security review with seeded true/false findings"*

**Success:** each item carries both true findings and decoys at known
locations. Primary metric is the true-positive rate **paired with** the
decoy-acceptance rate: an arm that finds everything by accusing everything
scores zero. Deterministic against a frozen key.

### 7. `debugging-executable-oracle` — `gradeable-confirmatory`

> roadmap phrase: *"debugging with an executable oracle"*

**Success:** a failing test ships with the defect. The arm passes **iff** the
proposed patch turns that test green and breaks no other test in the fixture.
The oracle is the test runner.

### 8. `incident-diagnosis` — `model-graded-exploratory`

> roadmap phrase: *"incident diagnosis"*

**Success:** from a synthetic log-and-timeline bundle with one planted root
cause, the arm names that cause and the first diagnostic step. Cause identity
is checkable against the key; the diagnostic step is rubric-judged, which is
what places the family in the exploratory class.

### 9. `probe-resolvable-factual-controls` — `gradeable-confirmatory`

> roadmap phrase: *"probe-resolvable factual controls"*

**Success:** questions a single cheap probe answers exactly; the control
succeeds when the answer matches the probe output. Its **purpose** is to detect
topologies that spend a debate on a lookup — so a correct answer at high cost
is a finding, not a pass, and the cost column is read alongside correctness.

### 10. `direct-generation-controls` — `gradeable-confirmatory`

> roadmap phrase: *"direct-generation controls where debate is expected to hurt"*

**Success:** tasks with one correct short answer where deliberation is
predicted to degrade it. The **directional prediction is pre-registered here**:
the debate arm scores at or below the single-model arm. A debate arm that wins
falsifies the prediction, and that is published as a falsification rather than
quietly re-read as a win.

### 11. `adversarial-misconception` — `gradeable-confirmatory`

> roadmap phrase: *"adversarial misconception cases"*

**Success:** items whose plausible answer is wrong and whose correct answer is
documented. Primary metric is the rate at which the arm resists the
misconception; majority corruption is measured on the same items, which is what
connects this family to the Phase 5 majority-laundering test.

### 12. `ambiguous-product-decisions-human-rubric` — `human-rubric-deferred`

> roadmap phrase: *"ambiguous product decisions with a human rubric"*

**Deferred, and registered in full anyway.** No human raters are available. Per
the resolved `blocker: maintainer-blind-ratings` option (b), this family runs
no arm and spends no call in Phase 2, and its 32 manifest cells carry
`not_eligible` rather than being dropped — so the exclusion is visible in the
manifest instead of inferable from an absence.

**Had a rater existed, success would have been:** agreement with a blind human
rubric score above a pre-registered threshold, rated without knowledge of which
topology produced the answer.

**No model-graded substitute is run in its place.** The originating rationale
is explicit that *"blind human judgments cannot be substituted with an
architectural choice or inferred from existing nulls"*, and a substitute would
be exactly the substitution that record forbids.

## What a reader must not conclude from a completed Phase 2

That "the council improves quality" in the human-judged sense. Eleven families
run; the twelfth is deferred and says so. Six are confirmatory and five are
exploratory, and those two groups are reported separately. A reader who takes a
pooled headline number away from this benchmark has taken a number this
pre-registration was written to make impossible to produce.
