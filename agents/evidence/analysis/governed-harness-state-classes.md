<!-- evidence-type: analysis -->

# Governed harness evolution — state classes

`road-to-governed-harness-evolution` step 0.3: *"name the state classes without
touching any claim."* Measured at `origin/main`, 2026-08-30.

**E8 is decided here: FIVE classes, option (c).** AI council, anthropic +
openai, both converging on (c) over (a) and (b) — five classes with
`production-adaptive` defined as **empty and prohibited**, and the emptiness
carried as a sequencing invariant rather than as a sentence.

## The five classes

| Class | What it is | Deleting it costs | Who may write it |
|---|---|---|---|
| **authoritative** | The tracked source of truth — `src/`, `docs/`, the roadmaps. | Everything. It is the only thing not reproducible. | Humans, through review. |
| **derived** | Regenerated from authoritative state: `dist/`, per-tool projections, indexes, manifests. | A build. | Generators, never by hand — the source-of-truth rule already says so. |
| **evidence** | Append-only records of what happened: run records, evidence artefacts, the audit log. | History, irreversibly — which is why it is append-only. | Anything, by appending. Correction is a new `type=supersede` line (`docs/contracts/audit-log-v1.md:26`), never an edit. |
| **experiment-adaptive** | State a self-improvement loop writes and reads **inside one experiment**: candidate variants, trial results, scores, a frontier. | A re-run, and nothing else. | The harness, freely. |
| **production-adaptive** | State that changes what the **shipped** system does for a user: a runtime-read weight, a learned routing table, a promoted artefact the runtime consumes without a human commit. | — | **Nobody. The class is empty and prohibited.** |

## Why five and not four

Four gives one name to a thing that is freely deletable and a thing that is
governed. Both council seats read that as the conflation the governance exists
to prevent: openai's put it as *"every future producer and consumer must
independently rediscover that prose"*, and anthropic's agreed that mixing
freely-deletable experiment state with governed runtime state under one label is
a governance hole.

Naming a prohibited class is not authorising it — both seats said so
independently, and this repository already has the pattern: a contract can name
a state it forbids, and the naming is what makes the prohibition checkable.

## `production-adaptive` is EMPTY — and what "empty" has to mean

The council's condition, and it is the load-bearing half of option (c): **empty
prohibits creating runtime DEPENDENCIES, not merely populating a labelled
directory.** An empty folder with a consumer pointed at it is not an empty
class.

So, as a falsifiable statement about this tree on 2026-08-30: **no state in this
repository is production-adaptive.** Nothing in selection, routing, or any
shipped runtime path reads state that a self-improvement loop wrote. A change
that makes that false is a change that populates this class, whatever it calls
the file.

**The gate is not this document.** `road-to-experience-loop-broadening` carries
an OPEN OWNER DECISION on exactly this question — may selection or routing read
experience data at runtime — held in neither direction, with experience treated
as report-only until an owner answers. This class exists so that decision has
something to be about; it does not pre-empt it in either direction.

## Which promotion transitions are legal today

openai's seat refused to approve the taxonomy without this, and the refusal is
right: *"may promote a candidate"* hides several materially different
architectures, and only one of them preserves the boundary.

| Transition | Legal today | Why |
|---|---|---|
| A human-reviewed commit copies a proposal into `src/`, after which it is **authoritative** | **yes** | The promoted thing stops being adaptive state at the moment of the commit. This is the only promotion path this roadmap plans, and Phase 7 routes it through the existing admissions gate rather than a second governance system. |
| A deployment process updates a runtime-readable pointer | **no** | The runtime would read state no human committed. That is production-adaptive by the definition above. |
| The runtime directly consumes learned weights or candidate state | **no** | Same, in its purest form, and it is the shape ADR-124 classifies as its prohibited class. |

Phase 7 remains gated on the `merge-authority` blocker regardless: who may
perform even the legal transition is ADR-239 § Decision 3, still open, still
owner-reserved.

## The sequencing invariant, which is what makes this more than a label

**Every later step that introduces state or a consumer of state names its class
in this table.** Without that, a step can add a runtime-readable projection
while calling it `derived` — the exact silent-introduction path both seats
identified as the real risk. anthropic's seat put it plainly: the danger is not
whether five classes are named, it is whether a future step can populate
`production-adaptive` without a review that checks the open owner decision.

This is a standing obligation on Phases 1–7, in the same shape as 0.1's *"every
later phase names a row"*, and it is stated here because a taxonomy that binds
nothing is a glossary.

## What this document does NOT do

- **It touches no claim.** 0.3's guard is measured: `grep -c
  'claim:no-runtime-daemon' README.md` returns **0**, and `docs/CLAIMS.md` has no
  diff attributable to this roadmap. The claim was retired by
  `road-to-runtime-governance-flip` under ADR-249, and this step neither restores
  nor re-litigates it.
- **It enforces nothing.** No gate reads these labels. Both council seats named
  enforcement as the missing piece and disagreed only on whether step 0.3 must
  ship it; anthropic's seat argued the taxonomy plus the sequencing invariant is
  enough for a labelling step **if** the taxonomy does not pre-authorise, which
  the empty-and-prohibited definition is designed not to do. Saying so is
  cheaper than implying a check that does not exist.
