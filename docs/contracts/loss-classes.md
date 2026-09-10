# Loss classes — names for what the tree already does

> Owner: maintainer · Status: active · Landed by `road-to-runtime-context-floors`
> Phase 3 · Machine-readable half: `src/scripts/_lib/loss_class.ts` · Gate:
> `src/scripts/check_loss_class_declared.ts`

## Why a vocabulary before a constraint

This tree has practised loss classes for a while without naming them, and the two
practices look identical from outside:

- `fold_intake` folds intake batches into an **additive** archive page carrying a
  per-child `<file>:<first-line>-<last-line>` link-back, and never mutates a
  child. The original is right there.
- `hot_context_hook` **dropped** any line the low-impact redactor refused — and
  dropped it on a redactor *error* too, fail-closed per line — then capped the
  result at 400 words. The dropped content was gone. That transform was retired
  on 2026-09-09 with the concern's cache half; it stays here as the exemplar the
  vocabulary was written against, in the past tense.

Both are "compression". One promises recovery and one promises the opposite, and
before this contract nothing in the tree distinguished them. So the five classes
below are written **against those two first**, and checked against their own
source docblocks. Neither transform's behaviour changed in the phase that named
them; the names went into the files, nothing else.

## The five classes

Each is defined by the **recovery it guarantees**, never by how much it removes.

| Class | Guarantee | Owes a locator |
|---|---|---|
| `exact` | output is byte-identical to input | no |
| `lossless` | output differs; input is fully reconstructible from the output alone | no |
| `recoverable-lossy` | output is smaller; the original is retrievable via a declared **recovery locator** | **yes** |
| `ephemeral-lossy` | output is smaller; the dropped content is gone, deliberately | no |
| `forbidden` | this transform must not run on this path at all | n/a |

`recoverable-lossy` is the only class that owes a locator, and it owes one because
without it the class is **indistinguishable from `ephemeral-lossy` by anything
except its author's intention**. That is why the gate rejects a `recoverable-lossy`
declaration with no `loss_recovery:` line rather than warning about it.

## The two classifications, and why each is the class it is

### `fold_intake` — `recoverable-lossy`

Locator: the fold page's per-child `<file>:<first-line>-<last-line>` link-backs.
The children are still on disk, byte-identical, and addressable. Declared at
`src/scripts/fold_intake.ts`, in the same docblock that already stated
"Children never mutated".

### `hot_context_hook` — `ephemeral-lossy` (retired 2026-09-09)

**`recoverable-lossy` would be the wrong class here even though the transcript
still exists**, and that is the sharpest test of whether this vocabulary is worth
having. The class describes what *this transform* guarantees *its consumer* — and
this one guarantees nothing about the dropped content, on purpose. Storing a
recovery for a line dropped for privacy would defeat the reason it was dropped.

## Declaration shape

In the module's own docblock, never in a sidecar registry — a class describes what
that code does to its input, and an entry beside it is a second statement that can
drift from the first:

```
 * loss_class: recoverable-lossy
 * loss_recovery: agents/knowledge/intake/<file>:<first-line>-<last-line>
```

## Where the gate fails, and where it warns

**Council 2026-08-28 — anthropic + openai, 2 rounds, 2/2 convergent.** Option (b):
fail on transforms whose output reaches the model, warn elsewhere.

- (a) *fail everywhere in `src/`* was rejected: it buys a first-run backlog whose
  usual answer is a broad allowlist, and this repository has a measured history of
  an allowlist emptying a gate.
- (c) *warn everywhere, ratchet later* was rejected: it is the shape this
  repository has measurably never ratcheted.

Both seats added the same refinement, adopted: **unknown reachability is
classified as model-reaching.** Ambiguity must not become an accidental exemption.

Dissent, recorded by both seats: a transform that is not model-facing today can
become so without being reclassified. That is the `revisit-if`.

### What "model-facing" is measured as

A hook concern bound on a slot whose output can reach the model, whose script
**both** emits a context payload **and** applies a lossy operation to content —
read from **code with comments stripped**. That single-file requirement is what
the reachability walk below replaced; the two halves are now read from an
emitter and the modules it reaches.

The comment-stripping is not a detail. The first cut of this detector matched
`truncat` inside three docblocks that *describe* truncation without performing
any, and reported a corpus of four. Three of those four were prose. A gate that
fires on writing about a defect rather than on the defect is how a real corpus of
one becomes a pro-forma corpus of four, each carrying a declaration nobody meant.
Comments are now found by the same single pass that finds literals, so a
trailing `// truncate the rows` is prose too — two regexes guessing at each
other's boundaries got that wrong in both directions.

**Measured at landing: 1 module qualified** — `hot_context_hook`. **Measured
2026-09-09: 0.** Step 3.1 of road-to-continuity-writer-activation retired that
module's cache half, and with it both patterns the detector matched on.
**Measured 2026-09-10 with the walk: 58 scanned, 7 emitters, 5 matched** —
four declaring a lossy class and one declaring `exact`.

MATCHED IS NOT LOSSY, and an earlier version of this line said otherwise. The
detector establishes a match; the module's own declaration says whether anything
is lost, and `exact` says nothing is.

A corpus of one was the honest state of this tree at the time. A corpus of zero
was not: the gate was green over an empty set, which proves nothing about any
transform rather than proving there are none.

## Reachability — how a module one layer below a concern enters the corpus

The declaration lives on the module that transforms; the corpus is the hook
manifest. A transform one module deeper than a concern script therefore sat
outside the corpus, which is how the 30-row cap in
`src/scripts/_lib/session_index_trust.ts` became invisible when the concern
script above it stopped transforming anything.

The gate now REACHES such a module instead of being told about it. An **emitter**
is a concern script whose code emits a context payload. A **target** is any
module that emitter reaches through relative specifiers — transitively, the
emitter itself included — whose code applies a lossy operation. Both halves no
longer have to live in one file, which is the whole reason a `_lib` helper could
hide the transform.

### Specifiers, not import statements

The walk reads relative module SPECIFIERS wherever they appear, not `import`
statements. That is not a shortcut: the hot paths in this tree load through
`createRequire` for bundle safety, so `req('./_lib/session_index_trust.js')` and
a static import are the same reach, and a walk that told them apart would miss
exactly the edge that matters.

### A superseded rejection, and the two premises that changed

A `loss_module:` pointer held this ground between 2026-09-10 and this change: a
concern named the module carrying its transform, and the gate then required that
module to declare. It was chosen over a reachability walk on two measured
grounds, and BOTH were re-measured and no longer hold:

| Premise for rejecting the walk | Re-measured |
|---|---|
| the closure does not contain `session_index_trust.ts` at all, because `hot-context` loads it through `createRequire` | a SPECIFIER walk reaches it; that module is in the corpus |
| 11 applied-lossy modules, of which 9 match on an identifier rather than a transform — a `truncated: boolean` field, a settings key called `knowledge.global_sharing.redaction.enabled`, a regex that *detects* `truncate table` | 5 matched, 0 identifier-only. Literals are blanked on the lossy half, and a marker in a substitution's own arguments is what separates `s.replace(RE, '[REDACTED]')` from `db.exec(q)` |

The first premise measured a static-import closure and generalized it to every
walk. The second measured raw patterns over the reached set without the
literal-blanking the widening itself makes necessary. Neither was wrong about
what it measured; both were about a narrower thing than the conclusion drawn.

**A co-presence rule was tried and dropped on the way.** Asking whether the
module ALSO contains a shortening call anywhere took the corpus from 5 to 8,
admitting settings key names containing `redaction`, a SQLite
`PRAGMA wal_checkpoint(TRUNCATE)`, and length constants used only to validate.
Co-presence in a file is not evidence, and three pro-forma declarations is the
corpus this contract exists to prevent.

### What the walk does not catch

A module loaded through a COMPUTED specifier — the one thing a pointer did catch
that a walk cannot. Nothing in the tree does that today. If something ever does,
the answer is to name the module, not to reason about the walk.

## The passthrough invariant

> A transform that cannot parse its input, cannot store the recovery, or does not
> make the input smaller **returns the input unchanged**. Degradation is never
> silent and never lossy.

Implemented once, in `applyTransform` (`src/scripts/_lib/loss_class.ts`), which
returns the input bytes **and** the reason together so a caller cannot have one
without the other. The two failure directions are equally easy to get half-right:
returning a partial parse is lossy degradation, and returning the input while
reporting success is silent degradation.

The `not-smaller` branch looks pedantic and is not. A "compression" that grew its
input has paid the cost of the transform, lost whatever it dropped, and bought
nothing — keeping the original is strictly better on every axis, so there is no
case where emitting the larger output is right.

## What this contract does NOT claim

- **It does not find undeclared transforms outside what a concern reaches.** A
  helper three imports deep IS visible now — that is what the walk changed, and
  the bullet that used to stand here said the opposite. What stays invisible is
  narrower and named above: a module loaded through a computed specifier, and
  any module no context-emitting concern reaches at all.
- **It does not verify a locator resolves.** It verifies one was *declared*.
  Whether the path it names still exists is a reviewer's judgement, and a gate
  claiming otherwise would be claiming more than it checks.
- **It does not change any transform.** Phase 3 named what the tree does. Changing
  what it does is a separate decision with its own consumer.
