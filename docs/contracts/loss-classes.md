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
read from **code with comments stripped**.

The comment-stripping is not a detail. The first cut of this detector matched
`truncat` inside three docblocks that *describe* truncation without performing
any, and reported a corpus of four. Three of those four were prose. A gate that
fires on writing about a defect rather than on the defect is how a real corpus of
one becomes a pro-forma corpus of four, each carrying a declaration nobody meant.

**Measured at landing: 1 module qualified** — `hot_context_hook`. **Measured
2026-09-09: 0.** Step 3.1 of road-to-continuity-writer-activation retired that
module's cache half, and with it both patterns the detector matched on.
**Measured 2026-09-10: 1** — `src/scripts/_lib/session_index_trust.ts`, reached
by the pointer described below.

A corpus of one was the honest state of this tree. A corpus of zero was not: the
gate was green over an empty set, which proves nothing about any transform rather
than proving there are none.

## `loss_module:` — how a module one layer below a concern enters the corpus

The declaration lives on the module that transforms; the corpus is the hook
manifest. A transform one module deeper than a concern script therefore sits
outside the corpus, which is how the 30-row cap in
`src/scripts/_lib/session_index_trust.ts` became invisible when the concern
script above it stopped transforming anything.

A concern script brings such a module into scope by naming it:

```
 * loss_module: src/scripts/_lib/session_index_trust.ts
```

**A pointer is a claim, and the gate treats it as one.** A pointed module that
declares nothing, does not exist, or resolves outside the repository is a
finding at the concern's own tier. That polarity is the point: an allowlist
removes things from a gate, and this adds them to it.

### Why not a static-import closure — measured, not assumed

The obvious alternative is to follow each concern script's imports and scan
what it reaches. Measured on this tree, 2026-09-10, that closure returns **11**
applied-lossy modules, of which **9** match on an identifier rather than on a
transform: a `truncated: boolean` field naming file rotation, a settings key
called `knowledge.global_sharing.redaction.enabled`, a regex literal that
*detects* `truncate table` in someone else's command. That is the same
prose-versus-code failure the comment-stripping above exists to prevent, one
layer up — matching writing *about* a transform instead of a transform.

And decisively: the closure does **not** contain `session_index_trust.ts`. The
only concern that reaches it, `hot-context`, loads it through `createRequire`
for bundle safety, so no static walk sees the edge. A widening that misses the
module it was written for, while adding nine it was not, is not a widening.

### What the pointer still does not catch

An **unpointed** lossy transform in a module a concern reaches. The gap is
narrower than the one it replaces — that one was every non-concern module, with
an empty corpus to show for it — and it is real. Closing it needs a lossy
detector that matches an *applied* transform rather than an identifier; the
11-versus-2 measurement above is the evidence for what building that would have
to clear.

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

- **It does not find undeclared transforms outside the hook manifest.** A helper
  buried three imports deep is invisible to the detector unless a concern script
  names it with `loss_module:`. The pointer makes a named module gateable; it
  does not make an unnamed one visible, and nothing in this contract claims
  otherwise.
- **It does not verify a locator resolves.** It verifies one was *declared*.
  Whether the path it names still exists is a reviewer's judgement, and a gate
  claiming otherwise would be claiming more than it checks.
- **It does not change any transform.** Phase 3 named what the tree does. Changing
  what it does is a separate decision with its own consumer.
