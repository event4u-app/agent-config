<!-- evidence-type: analysis -->

# Phase 5.1 of `road-to-a-setup-that-decides-itself` — which cases the pre-registration's primary endpoint reads

Repository `event4u/agent-config`. Answer with one option letter and a short rationale. Do not restate the question.

## Context

The roadmap lets the package compute whether a machine's rule layer is `full` or `thinned` from evidence. Phase 5 must show "no regression" before thinning is enabled for consumers (5.3). Step 5.1 is the pre-registration, to be hashed before the first run and reviewed by the council before it is frozen. Its text:

> Arms per host: today (0.1) vs computed (Phase 3). Primary: host-graded and conformance cases with D2's margin fixed before the run; repeated runs; an evaluator independent of the implementation; interval reported. Critical: zero regressions on safety-floor, consequence-class and obligation cases — one observed critical failure blocks enablement until fixed and re-run.

Decision D2 (contested-technical, to be reviewed by the council at 5.1): non-inferiority margin zero on safety-floor, consequence-class and obligation cases; at most one regressed case per hundred elsewhere as a candidate, valid only with a powered pre-registration; an uncertain reading means stay full.

Step 0.2 built the comparison manifest, `src/config/layer-form-comparison-corpus.json`, with five sources:

| Source | State | Cases |
|---|---|---|
| routing matrix (`tests/eval/routing-matrix`, positives + near-misses) | present | 593 |
| trigger-corpus train slice (sealed holdout never opened) | present | 1,307 |
| obligation class (consequence class + `tier: safety-floor`) | present | 31 |
| conformance | absent — `tests/conformance/` holds only an envelope-schema set with no prompt and no expectation | 0 |
| host-graded | absent — no such artefact exists; a sibling roadmap declared its own host-graded primary unmeasurable on 2026-10-20 | 0 |

The manifest's own `reopens_when` for `host-graded` reads: "A host-graded case set is committed … Until then Phase 5's primary reads the three present sources and says so." No producer of host-graded cases is scheduled.

Running the comparison (5.2) additionally needs an observed effect row for the first host, owned by another roadmap; that is not this question.

## Options

(a) Pre-register now with the primary reading the three present sources under D2's margin, stating that host-graded and conformance cases are absent and what would change if they appeared.

(b) Do not pre-register until a host-graded case set exists.

(c) Pre-register now with the present sources, but as a secondary/interim endpoint only, leaving the primary undefined until host-graded cases exist.

(d) Something else — state it.

## What a usable answer contains

1. One option letter and the strongest reason for and against it.
2. If (a) or (c): whether D2's "one per hundred" candidate margin is usable with these sources, or must change.
3. **Routing:** is this decision council-decidable, or owner-reserved? Owner-reserved covers: changing the project's purpose or a declared non-negotiable outcome; lowering a security/privacy/safety floor; irreversible or destructive transitions; spend above a delegated threshold; creating/removing/weakening a legal, contractual, compatibility or public commitment; governance self-amendment; anything that cannot be bounded from evidence. Answer `council-decidable` or `owner-reserved` with one sentence.
4. The one condition that would reopen the choice.
