# Frontend fidelity — pre-registered falsifiers

Step 2.3 of `road-to-frontend-fidelity-calibration`. Written and committed
**before** any Phase 3 step is checked off, so that the bar a dimension has to
clear was set by someone who did not yet know whether it would clear it.

A dimension whose falsifier fires is **cut in Phase 3 step 3.3**, not defended.
That is the whole point of writing them down here: the argument for keeping a
dimension cannot be invented after the number comes back.

## The three generic falsifiers

Every dimension is subject to all three. They are the roadmap's own wording at
step 2.3, given ids so a null record can name one.

| Id | Fires when | Why it is fatal |
|---|---|---|
| `F1-unstable` | The dimension produces a different number across two runs on **identical input**. | A number that moves on its own cannot ground a verdict. A gate reading it would flake, and a reviewer diffing two sheets would see noise as change. |
| `F2-inert` | No finding can be derived from the number — nothing downstream can act on it. | This is risk #1 in the register: a detector that emits and drives nothing is `token_violation`-consumed-with-no-producer, inverted. |
| `F3-disagrees` | The number disagrees with the agent verdict **more often than it agrees** on the same input. | Not "the number is sometimes surprising" — that is the number doing its job. A majority disagreement means one of the two is measuring something else, and the cheap hypothesis is that the new number is. |

## Per-dimension pre-registration

Dimension ids are the ones Phase 2's schema will carry. Inventory row ids
(`A1`..`A13`) refer to
[`frontend-fidelity-assertion-inventory.md`](frontend-fidelity-assertion-inventory.md).

### `token-literal` — a raw literal where the audit found a token

Covers inventory rows **A5, A6**. This is the dimension step 3.1 scopes to.

| Falsifier | Concretely, for this dimension |
|---|---|
| `F1-unstable` | Scanning the same fixture twice yields a different violation count or a different `(file, line, value)` set. |
| `F2-inert` | A produced `token_violation` does not open a polish round through `directives/ui/polish.ts` — i.e. Phase 5.1 cannot be discharged without adding a gating mechanism beside the existing one. |
| `F3-disagrees` | On the seeded fixture pair, the detector flags values the audit's own token map says are already tokens, more often than it flags genuine literals. |

**Additional, dimension-specific:** `F4-unscoped` — the detector fires on
values that no token exists for. The dimension is *"a raw literal **where the
audit found a token**"*; a detector that flags every literal in the tree is
measuring a wider claim than the one pre-registered, and the wider claim is not
what Phase 1 classified as measurable.

### `viewport-floor` — is the asserted 320 px floor in the measured set

Covers inventory rows **A1, A2, A3**.

| Falsifier | Concretely, for this dimension |
|---|---|
| `F1-unstable` | Not reachable — the measured set is a table in a file, and reading it twice cannot disagree. |
| `F2-inert` | The measured set gains the row and nothing reads it, i.e. the floor stays an assertion in a different table. |
| `F3-disagrees` | Not reachable — there is no competing agent verdict about which viewports a table lists. |

**Pre-registered outcome:** this dimension is a **documented set**, not a
runtime number. It is recorded here so that step 5.2 cannot later claim it as a
"measurement" it is not — the honest form is *the asserted floor is now in the
set a reviewer is told to test*, which is a coverage fix, not a detector.

### `render-diff` — a numeric comparison of two rendered captures

Covers inventory rows **A4, A9, A10, A11**.

| Falsifier | Concretely, for this dimension |
|---|---|
| `F1-unstable` | Untestable here — no capture primitive to run twice. |
| `F2-inert` | Untestable here. |
| `F3-disagrees` | Untestable here. |

**Pre-registered outcome — this dimension is expected to be cut, and the
prediction is recorded before the fact.** `b-page-capture-primitive` resolved
2026-08-23 to option (b): the render-dependent dimensions ship as recorded
nulls. So the falsifier that fires is not one of F1–F3 at all, and inventing an
F1 result for it would be fabrication. It gets its own:

`F0-uncapturable` — **the capability the measurement requires is not available
on the host the fixtures run on, so no run can be attempted.** This is the
honest falsifier for the whole blocked class, and it is stated here rather than
in Phase 3 so the cut is not a post-hoc rationalisation of a measurement nobody
tried.

### `reduced-motion-alternative` — does the surface present something instead of motion

Covers inventory row **A12**.

**Pre-registered as cut before Phase 3 starts.** `grep` proves a
`prefers-reduced-motion` block exists; nothing available here proves the block
*presents an alternative* rather than setting `animation: none`. The falsifier
is `F2-inert` by construction: the only number obtainable is a presence count,
and no finding about the *claim* can be derived from it. Step 9.3 closes the
prose half of this gap deliberately and does not reopen the measurement half.

## What this list does NOT pre-register

- **A7** (an arbitrary value cites its design source) is classified
  `unmeasurable` in Phase 1 and is therefore not a Phase 3 dimension at all. A
  falsifier for a dimension nobody will measure is noise.
- **A13** (persona ownership) is an ownership question, not a fidelity
  dimension. Its null lives in the Phase 1 artefact.

## Prediction, recorded before the measurement

Of the four dimensions above, the prediction at authoring time is that
**exactly one ships**: `token-literal`. `viewport-floor` resolves as a coverage
fix rather than a measurement, `render-diff` is cut on `F0-uncapturable`, and
`reduced-motion-alternative` is cut on `F2-inert`. Recorded so that Phase 3 can
be scored against a prediction rather than narrated after the fact.
