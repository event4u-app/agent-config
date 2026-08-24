# Source-led port — adopt the mechanics, do not re-derive them

Pulled when `ui_authority.reference_maturity` is `runnable-artifact`. Contract:
[`ui-authority`](../../../../docs/contracts/ui-authority.md).

When `reference_maturity` is `runnable-artifact`, the artifact's own markup, CSS
and JS is the data basis and adapting it is the DEFAULT. A from-scratch
re-derivation is a deviation and needs the same confirmation as a swapped
control (per [`design-fidelity`](../../rules/design-fidelity.md)).

Account for every mechanic the source carries, in the engine's own vocabulary
(`COVERAGE_BUCKETS`, shared rather than copied — `agent-config ui:audit`
re-exports it):

- **`honoured`** — carried across intact.
- **`translated`** — expressed differently in the target stack, same observable
  behaviour. Name the substitution.
- **`flagged`** — cannot be carried; say so explicitly.

```
A MECHANIC THAT IS PRESENT IN THE SOURCE AND ABSENT FROM THE OUTPUT WITH NO
`flagged` ENTRY IS A SILENT DROP. TARGET: ZERO.
```

`container-type` / `@container`, `clamp()` type scales, `:has()` state
selectors, `IntersectionObserver` reveals and view transitions are the classes
that vanish most often, because each one *looks* like decoration and is
actually behaviour. `tests/eval/frontend-corpus/near-miss/artifact-source-not-rederived`
is the pinned case: three mechanics, and an output that silently becomes a plain
media-query grid fails it.

**Maturity itself is not decided here.** `reference_maturity` arrives on the
authority object, and per-value provenance for a comp belongs to
`road-to-frontend-fidelity-calibration` Phases 0 and 2. This skill adds no
second maturity discriminator.

