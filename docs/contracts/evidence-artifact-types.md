---
stability: beta
keep-beta-until: 2026-09-17
---

# Evidence artifact types (v1)

**Purpose.** One definition of what a stored evidence artifact *is*, so a reader
can tell whether it still asserts anything. Today it cannot: a review this repo
received in July and a findings artifact binding a diff at this minute are both
markdown under `agents/evidence/`, carry no declared kind, and read the same.

**Scope.** The `evidence-type:` marker grammar, the five type values, the
agreement rules that tie a declared type to the body it sits above, and what
this contract deliberately does **not** change. The validator
([`lint_evidence_artifacts.ts`](../../src/scripts/lint_evidence_artifacts.ts))
implements exactly what this file defines; a divergence is a validator bug,
never a contract reinterpretation.

## 1 · The failure this closes

An evidence artifact is read at two very different moments, and the reader's
question is different each time:

- *Does this still hold?* — asked of a **binding**, and answerable only against
  the scope the binding names.
- *What did somebody observe once?* — asked of an **input**, and answerable
  without reference to the current tree at all.

Nothing in the stored form distinguishes the two. The observable consequences,
all of them recorded in this repo's own corpus: a superseded round read as
current; a declared skip indistinguishable from a review that ran and found
nothing; an artifact whose binding had been moved read at its pre-move verdict.
Each is a reader mistaking an input for an assertion, or a stale assertion for a
live one.

## 2 · Marker grammar (exact)

One HTML comment, on its own line, anywhere in the artifact — conventionally the
line below the title:

```markdown
<!-- evidence-type: v1 | type: <type> | declared: YYYY-MM-DD -->
```

- `v1` is the grammar version. An unknown version is a violation, never a
  silent skip — a marker the validator cannot read is worse than none, because
  it looks satisfied.
- `type` is exactly one value from § 3. An unknown value is a violation.
- `declared` is the ISO date the type was **set**, which is the date the
  artifact was created or the date its type legitimately changed (§ 4). It is
  not a freshness stamp and never re-dated to look current.
- Exactly one marker per artifact. Two markers is a violation: a reader has no
  rule for which one wins, and neither does the validator.

## 3 · The five types

| Type | Asserts | Binds a scope |
|---|---|---|
| `original-review` | what its author observed at its own pin | no |
| `current-binding` | a verdict about one named review scope | yes |
| `honest-null` | that a review ran over one named scope and found nothing | yes |
| `declared-skip` | that the review gate was declared skipped for one scope | yes |
| `rebind-event` | a verdict, plus that this artifact's binding has moved | yes |

**`original-review`** — a non-binding record. Either a review this repo
*received* (an external review, an inbox artifact, a third-party audit) or an
analysis this repo *produced* (a measurement report, a census, an
investigation). Both are historical: they say what was true at their own pin and
bind nothing, so no later change can make them stale — only irrelevant. This is
the type most existing artifacts under `analysis/`, `reports/`, `audits/` and
`investigations/` carry.

**`current-binding`** — a findings artifact bound to a review scope via the
`completion-review:` marker of
[`plan-review-gates`](plan-review-gates.md) § 2.1. It asserts a verdict about
that scope and **stops asserting the moment the scope moves**. That is the
property § 5 refuses to weaken.

**`honest-null`** — a review that ran and found nothing, carrying the § 2.3
honest-null line in place of a findings table. Separated from `current-binding`
because the two are read differently: a null is evidence that looking happened,
and collapsing it into "no findings recorded" loses exactly that.

**`declared-skip`** — the gate was declared skipped for this completion,
carrying the § 2.4 skip declaration. Separated from `honest-null` because a skip
means *nobody looked, and here is why that was legitimate*, which is not the
same claim as *somebody looked and saw nothing*. Conflating them is the single
most consequential ambiguity in the current corpus.

**`rebind-event`** — an artifact whose binding was moved to a new scope after
it was first committed, and which records the move. It is a *specialisation* of
`current-binding`, not a disjoint class: the artifact still binds, and the type
additionally tells a reader that an earlier reading of this same file may have
been taken at a different scope.

> **Recorded deviation.** The originating roadmap lists `rebind-event`
> alongside the other four as if all five were disjoint. In this tree a re-bind
> is performed **in place** on the findings artifact, so a disjoint re-bind
> artifact does not exist and inventing one would create a second file to keep
> in sync — a new drift source guarding a failure that has not occurred. The
> type is therefore kept, with its relationship to `current-binding` stated
> rather than left for a reader to infer.

## 4 · Agreement rules — why the type is not decorative

A declared type that nothing cross-checks is a field authors fill in and readers
learn to distrust. Each type therefore has to agree with the body it sits above,
and the validator reuses the parsers `check_completion_review.ts` already
exports rather than re-deriving the grammars:

| Type | Required in the body | Forbidden in the body |
|---|---|---|
| `original-review` | — | a `completion-review:` marker (an input does not bind) |
| `current-binding` | a `completion-review:` marker, ≥ 1 findings row | an honest-null line, a skip declaration |
| `honest-null` | a `completion-review:` marker, the § 2.3 honest-null line | any findings row, a skip declaration |
| `declared-skip` | the § 2.4 skip declaration | any findings row, an honest-null line |
| `rebind-event` | a `completion-review:` marker, a `re-bound at` trace | a skip declaration |

**Set the type at creation, never infer it later.** An inferred type reproduces
the ambiguity it was meant to remove: inference reads filename and location,
which are exactly the signals that already fail to distinguish the five. The
scaffolding writer sets `current-binding` when it creates a findings artifact,
because that is what the artifact is from its first byte — whether its table
ends up empty is a *result*, and a reviewer that returns zero findings changes
the type to `honest-null` in the same edit that replaces the table.

A type change is legitimate in exactly three transitions, each of which
re-dates `declared`:

- `current-binding` → `honest-null` — the review ran and found nothing.
- `current-binding` → `rebind-event` — the binding moved.
- `rebind-event` → `rebind-event` — it moved again.

No transition ever leaves a binding type for `original-review`: an artifact that
bound something does not become an input by being old. It becomes a *stale
binding*, which is the state the reader has to be able to see.

## 5 · What this does NOT change

```
TYPING CLARIFIES WHAT STORED EVIDENCE MEANS. IT NEVER WEAKENS WHEN A
BINDING MUST BE RE-BOUND. A TYPE IS NOT A CURRENCY EXEMPTION.
```

The binding rule of [`plan-review-gates`](plan-review-gates.md) § 2.6 is
untouched: a findings artifact is relevant only to the review scope its marker
names, and a change to the reviewed content forces a re-bind. Nothing in this
contract lets a `rebind-event` marker, a recent `declared` date, or any type
value stand in for a scope hash that matches.

This is a deliberate refusal, not an oversight. The originating release review
measured that segment-aware currency — re-binding only the segments a diff
actually touched — would save roughly a tenth of re-binds while introducing
integrity risk, because a segment boundary is a judgement and a scope hash is
not. A tenth of a cheap operation is not worth a judgement call in the one place
the corpus needs to be mechanical. So the decision is to make stored evidence
*legible*, and to leave *when it must be re-bound* exactly as strict as it was.

## 6 · Enforcement scope — honest

[`lint_evidence_artifacts.ts`](../../src/scripts/lint_evidence_artifacts.ts) is
**changed-files scoped**: it requires a marker on every evidence artifact this
change adds or modifies, and it does not require one on the ~330 artifacts that
predate it. Two reasons, and the second is the load-bearing one.

Retro-typing the existing corpus would mean classifying several hundred files
from filename and location — the inference § 4 forbids, applied at scale, and
the result would be a corpus of guesses that looks authoritative. And a
baseline file listing the untyped set would add a suppression surface whose only
content is "everything that already exists", which is a ratchet that measures
nothing.

The consequence, stated rather than hidden: an existing artifact stays untyped
until something touches it, and a reader of an untyped artifact is exactly as
badly served as before. The population shrinks as files are touched, and
`--all` reports the remaining count on every run so the shrink is observable
instead of assumed.

## See also

- [`plan-review-gates`](plan-review-gates.md) — the `completion-review:` marker,
  honest-null (§ 2.3) and skip (§ 2.4) grammars this contract cross-checks, and
  the § 2.6 binding rule § 5 refuses to weaken.
- [`adversarial-review-protocol`](adversarial-review-protocol.md) — the review
  dispatch that produces `current-binding` artifacts.
- [`evidence-based-pruning`](evidence-based-pruning.md) — sibling contract on
  what stored evidence licenses a deletion.
