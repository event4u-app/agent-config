<!-- evidence-type: analysis -->

<!-- The prompt given to the council on 2026-10-24 (twentieth round that day),
     committed verbatim. It does not ask whether step 7.1 is met; it asks the
     seats to fix a closed acceptance standard. The asking agent wrote the
     ledger and its tooling and would carry out the standard. -->

# Step 7.1: fix a closed, finite acceptance standard

You are advising on step 7.1 of an internal governance roadmap. This round asks
for something different from the previous nineteen. Answer on the evidence
below.

## Why this question

Step 7.1's exit criterion is: "every live-tree check pinned red at Phase 7
start carries a classification in 7.1's record." The four classes are
invariant, snapshot, tolerance and observation. The record classifies 16
checks, chosen in a Phase 7 measurement, as 49 aspects under named modes.

Over nineteen rounds today, each round accepted what the previous one asked for
and named a stronger next requirement:

1. classes per check;
2. aspects per check;
3. an independent branch inventory (198 branches, from a separate session);
4. an independent review of the branch-to-aspect mapping (182 agree, 12
   disagree and adopted, 4 unsure and resolved);
5. a mechanical reconciler with pins and a mutation self-test (13 of 13);
6. a branch-level artefact (200 atomic rows) and two byte-identical
   clean-checkout reruns by a separate session;
7. a model-free scan of finding and non-zero sites: 159 sites, 132 inside
   inventoried branches, 27 with dispositions, 0 undisposed, under exact
   containment.

The last round split. One seat said conditionally yes and asked to keep the
standard proportionate: *"rigorous enough to bound risk and fail closed on
discovery, not mathematically complete."* The other said no until two things
are shown: an exhaustive failure-emission vocabulary, through syntax-tree or
control-flow analysis, and a re-derivation proving the 16 scripts are the
complete set the Phase 7 measurement found red among 330 `check_*` and
`lint_*` scripts.

That measurement's record states its method and its counts:

- 330 scripts run on a clean worktree at `bbe5b73be`;
- 3 red only because projections were not built;
- 10 needing an argument;
- 8 needing a build step;
- 16 left genuinely red.

It does not list the excluded scripts by name.

Classification is not enforcement. Step 7.2, not 7.1, decides gate
membership, demotions and any CI enforcement, and 7.2 may rely on 7.1 only
through a fail-closed entry condition that rechecks every pin.

## The question

**Fix one closed list of acceptance items for 7.1.** Write each item as a
concrete, checkable test with a pass condition. Once every item passes, 7.1 is
closed. After that, 7.1 reopens only on a **demonstrated** misclassification or
omission, such as a named branch, aspect or check that is wrong or missing.
New categories of evidence do not reopen it.

For each item, say:

- (a) the test and its pass condition;
- (b) whether it is already met by the evidence above;
- (c) what risk it controls, and what it costs.

Address the two open requests from the last round explicitly. Are they on the
list, and if so in what bounded form?

- an exhaustive failure-emission vocabulary through syntax-tree analysis;
- a re-derivation of the 16 from the 330.

Then answer: given your list, is anything on it owner-reserved?

Give one recommendation, the strongest objection to fixing a closed list at
all, and your confidence.
