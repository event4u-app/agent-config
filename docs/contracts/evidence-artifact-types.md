---
stability: beta
keep-beta-until: 2026-11-24
---

# Evidence artifact types

> One definition of what a file under `agents/evidence/` **is**, so a reader
> never has to infer it from a filename, a directory, or the shape of the prose
> inside it.

Status: active · Owner: maintainer · Introduced by `road-to-release-review-p0`
Phase 2.

## The failure this closes

A release review found that a **historical input reads the same as a live
binding**. Both are markdown under `agents/evidence/`, both describe findings,
and nothing on the artifact says which one still asserts something. A reader
who opens `agents/evidence/reviews/<slug>.review-input/` sees a review; what
they cannot see is that its stored diff no longer reproduces the scope hash its
sibling artefact binds — measured at **20 of 28** directories in
`agents/evidence/analysis/review-binding-drift.md`. The record was always
honest; the artifact never said what kind of record it was.

## Scope, stated before the type set

This contract defines a **vocabulary and where it is declared**. It is
deliberately not a migration.

`check_completion_review.ts` already refused to make even one optional marker
field required, on the stated ground that *"a REQUIRED field would have been a
migration event for the whole evidence corpus"* (`:88-92`). That reasoning is
adopted here rather than overturned.

Measured by `lint_evidence_artifacts --all` at the time of writing — a count,
not an estimate: **332** tracked markdown artifacts under `agents/evidence/`,
of which **188 already resolve a type** through the grammars below and **144
do not**. The untyped remainder is prose in `analysis/`, `reports/`, `audits/`
and `investigations/`. Retrofitting a marker onto those 144 would be a large,
low-value diff whose main effect is to make the next `git blame` harder.

The typed figure moves as artifacts land and the untyped one does not, which
is the whole design: run `--all` for today's numbers rather than trusting this
paragraph.

So the obligation is forward-looking: a **newly written** evidence artifact
declares its type. `lint_evidence_artifacts.ts` enforces exactly that and
nothing wider.

## The six types

| Type | What it asserts | How it is declared |
|---|---|---|
| `original-review` | A review as it was produced, bound to the scope that existed then. Historical by nature — it does **not** assert anything about the current tree. | `<!-- evidence-type: original-review -->`, or membership in a `*.review-input/` directory |
| `current-binding` | This artifact asserts something about the tree **right now**, at a named scope hash. | The existing `<!-- completion-review: v1 \| … \| scope: <64-hex> \| … -->` marker |
| `declared-skip` | A completion deliberately not reviewed, with the reason recorded. | The existing `**Skipped:** no code surface for this completion — <reason>, scope <hash\|none>, declared <date>` line |
| `honest-null` | A review that ran and found nothing. Distinct from a skip: the work happened. | The existing `**Honest-null:** 0 findings, scope <64-hex>, reviewed <date>` line |
| `analysis` | A measurement, census, investigation, or report. Asserts what was true when it was written and is never re-bound. | `<!-- evidence-type: analysis -->` |
| `feel` | A perceptual check on shipped motion — the class for "technically correct and still wrong", which every type above is blind to because every one of them is mechanical or textual. | `<!-- evidence-type: feel -->` **plus** a `**Feel:** <method> — <outcome>` line |

### `feel` carries a method, not an adjective

`feel` is the one type whose result may be **unbacked** and whose declaration
may not be **absent**. A perceptual judgement is not reducible to a measurement
— that is why it needs its own class rather than being squeezed into `analysis`
— but "it felt fine" is not a check that ran, and an evidence class nothing can
emit is a vocabulary entry rather than a control.

So the floor is the **method token**, from a closed set of four, each naming how
the motion was actually looked at:

| Method | What it means |
|---|---|
| `slow-motion` | played back below real time, where an easing curve and an overshoot are visible |
| `frame-step` | stepped frame by frame, where a dropped or duplicated frame is visible |
| `device` | watched on a real target device rather than a desktop preview |
| `next-day` | looked at again after a break, which is the only check that catches motion you have habituated to |

The grammar, parsed by `lint_evidence_artifacts.ts`:

```markdown
<!-- evidence-type: feel -->
**Feel:** slow-motion — the modal exit still reads abrupt at 0.25x
```

An outcome of `unbacked` is legal and is not a failure: it records that the
method ran and settled nothing. A missing line, or a method outside the four, is
a finding — the check refuses the word without the method, which is exactly the
cheap satisfaction it exists to prevent.

**What it does NOT claim.** Nothing verifies that the method was really used;
the gate reads a declaration, not a video. It makes the OMISSION impossible, not
the answer true — the same honest limit every declaration-shaped gate in this
tree carries.

### Three of these were already enforced grammars

`current-binding`, `declared-skip` and `honest-null` are not new. Each is an
exact line grammar parsed and gated by `check_completion_review.ts`
(`MARKER_RE`, `SKIP_RE`, `HONEST_NULL_RE`), with a typed result in its
`ParsedArtifact` union. Measured over the 66 `*.findings.md`: **51** carry the
marker plus a `context-manifest: v1` block, **15** carry a skip declaration.

This contract does not re-declare them under a second syntax. An artifact
carrying one of those grammars **already has a type**, and the linter reads it
from there. Introducing a parallel `evidence-type:` marker for the same three
would be the ambiguity this document exists to remove, wearing a new hat.

**Reading a declaration is not inferring a type.** The roadmap step that
motivated this says the type must be set at creation "rather than inferring it
later from filename or location". A grammar the author wrote deliberately is a
declaration; a directory name is not. The one filename-derived case below is
called out as exactly that.

### The re-bind event has no type, deliberately

The roadmap's proposed set named a fifth kind — a **re-bind event**. It is not
in the table above, and the reason is a contract, not an oversight:
`plan-review-gates.md` §2.7 makes re-binding an **in-place edit** of the
existing artifact. There is no separate object to type. Re-bind events are
reconstructed after the fact from git history by
`probe_review_binding_drift.ts` (`type RebindCause = 'code' | 'non-code' |
'base-moved' | 'unattributable'`), which has recovered **81** of them.

Typing a re-bind would require the artifact to record its own edit history,
which is what git already does. The honest statement is therefore: four types
are declared on the artifact, the fifth is derived from version control, and
that split is intentional.

### `original-review` and the one filename-derived case

`*.review-input/` directories (**39** of them) predate this contract and carry
no marker. Their type is read from the path, and that is the single exception
the linter makes. It is safe because the directory name is not a heuristic — it
is written by `dispatch_r2_reviewer.ts` and by nothing else, so the path IS the
declaration in the only sense that matters. A new artifact of this kind still
gets the explicit marker.

## The binding is not loosened

The review measured that segment-aware currency would save roughly a tenth of
re-binds while introducing integrity risk. This contract therefore clarifies
**what stored evidence means** and changes **nothing** about when an artifact
must be re-bound. `check_completion_review`'s scope-hash rules,
`dispatch_r2_reviewer --verify-current`, and §2.7's in-place re-bind discipline
are untouched.

Said plainly because the opposite is the attractive misreading: knowing that an
artifact is an `original-review` does not make a stale binding acceptable. It
makes the staleness legible. Those are different things.

## The second axis — execution mode, and the `flaky` outcome

Added 2026-09-04 by `road-to-deterministic-defect-detectors` step 4.2, after an
AI council (anthropic/claude-sonnet-4-5 + openai/gpt-4o, 2 rounds, quorum 2/2,
convergent on option A) was asked whether this belongs here at all and, if so,
as a sixth type or as a separate axis.

**It is a separate axis, and saying so is the whole point.** A *type* answers
"what does this artifact assert". A *mode* answers "how was the verification
run". Fifteen skills mention `flaky` and none of them can record it: a test
that passes on the second attempt has no way to be written down as anything but
green. Making `flaky` a sixth type would conflate the two questions and force
the table to grow a new row for every future combination — the proliferation
the council named as the cost of option B.

### Modes

| Mode | Meaning | How it is declared |
|---|---|---|
| `single-run` | The verification ran once. | **The implicit default.** Never written. Every artifact that predates this section is `single-run` and needs no edit. |
| `repeated:<n>` | The same verification ran `n` times, `n >= 2`, with the per-run results retained. | `<!-- evidence-mode: repeated:5 -->` |

`n >= 2` is required, not conventional: `repeated:1` is `single-run` with extra
syntax, and admitting it would let a single run be presented as a repeat.

### The outcome

`flaky` is a recordable outcome, and it is valid **only** under
`repeated:<n>`. Under `single-run` there is nothing to be flaky between.

> **flaky** — the `n` runs did not agree. At least one passed and at least one
> failed on the same input, the same tree, and the same command.

That definition is deliberately narrow. Runs that all passed are a pass; runs
that all failed are a fail; a run that failed for a *different* reason each time
is not flakiness but an unstable environment, and is recorded as its own failure
rather than laundered into `flaky`.

**Never a silent red, never a silent green.** A `flaky` result is neither. It is
its own outcome and it is reported as itself — the same discipline
`_lib/gate_result.ts` applies when it refuses to let `crashed` read as
`violations`.

### Aggregation and retention — without these, `flaky` is not reproducible

Raised by the council as the refinement neither reviewer stated: an outcome that
records only the aggregate cannot be checked by the next reader.

- **Retain the per-run results.** `repeated:<n>` means `n` recorded verdicts,
  not one verdict with a count beside it. An artifact that kept only "3 of 5
  passed" has recorded a number, not evidence.
- **Aggregate by unanimity, and state it.** All `n` pass → pass. All `n` fail →
  fail. Anything else → `flaky`. There is no threshold and no majority rule: a
  4-of-5 pass is exactly the case this outcome exists to stop being called a
  pass.

### What this does not do

It does not retrofit. It does not make an existing artifact wrong. It does not
change when an artifact must be re-bound. `single-run` being the unwritten
default is what keeps all three true.

## Where the type is written

For the three types with no existing grammar, one HTML comment anywhere in the
first 40 lines:

```markdown
<!-- evidence-type: analysis -->
```

Accepted values are exactly the six in the table. Anything else is a lint
error rather than a warning: a misspelled type reads as untyped to every
consumer, which is the state this contract exists to end.

## Enforcement, and its honest limits

`src/scripts/lint_evidence_artifacts.ts`:

- `--new-only <base-ref>` (the CI mode) — fails when a markdown file **added**
  under `agents/evidence/` relative to the base ref carries no resolvable type.
- `--all` — prints a census of the whole corpus and exits 0. A report, not a
  gate: it exists so the untyped-prose count is a number somebody can watch,
  not a thing they have to re-derive.

What it does **not** do: retrofit, warn about, or block on the pre-existing
untyped corpus. That is the scope decision above, and it is why this check can
ship without a baseline file.

## See also

- [`plan-review-gates.md`](plan-review-gates.md) — §2.1 the marker, §2.3 the
  honest null, §2.4/2.5 the skip, §2.7 archive-vs-rebind, §5 the manifest.
- `src/scripts/check_completion_review.ts` — the three existing grammars and
  the `ParsedArtifact` union.
- `src/scripts/probe_review_binding_drift.ts` — reconstructs re-bind events
  from git.
- `agents/evidence/analysis/review-binding-drift.md` — the 20-of-28 measurement
  that motivated the finding.
