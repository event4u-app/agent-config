---
stability: beta
keep-beta-until: 2026-11-24
---

# Evaluator output contract

> The machine-readable verdict a mechanical verifier emits so an optimization
> loop can decide keep-or-revert without knowing anything about the verifier.

Schema: [`src/scripts/schemas/evaluator-output.schema.json`](../../src/scripts/schemas/evaluator-output.schema.json).
Gate: `check_evaluator_schema`.
Evidence: [spike s01](../../agents/evidence/eval-findings/metric-loop-s01.md), [spike s02](../../agents/evidence/eval-findings/metric-loop-s02.md).

## The shape

```json
{
  "schema_version": 1,
  "name": "validate_frontmatter",
  "pass": true,
  "score": 0,
  "metric": 0,
  "metric_state": "present",
  "direction": "minimize"
}
```

`schema_version`, `name`, `pass`, `score` are required; `metric`,
`metric_state`, `direction`, `error` are optional. `additionalProperties` is
false — an unknown key is a producer bug, not an extension point.

**`metric` is omitted, never null, when there is no number.** The estate's
Draft-07 subset validator rejects an array-typed `type` outright
(`Unsupported schema type 'number,null'` — measured while landing this schema),
so the field is an optional `number` and absence carries the meaning. Read
`metric_state` for the reason.

## The two invariants

**1. `score` is higher-is-better, always.** A verifier whose natural metric is a
violation count negates it. Every consumer then compares with one operator and no
caller has to know which way a given evaluator runs. `direction` records the raw
metric's orientation for a human reading the register; it is never a comparison
input.

**2. `pass` is sovereign.** A keep-or-revert decision gates on
`pass && score > baseline` — never on `score` alone. This is not a style
preference. Spike s01 ran a change that improved the metric by 67 % and broke the
behaviour it measured; the only thing that reverted it was `pass` being false.
A loop reading `score` alone keeps that change and calls it progress.

## Error semantics — the part that makes the contract usable

The caller distinguishes **four** outcomes, not two. Collapsing any pair is how a
loop ends up trusting a measurement that did not happen.

| Outcome | Signal | What the loop does |
|---|---|---|
| **Verified green** | exit 0, valid JSON, `pass: true` | compare `score` to the baseline; keep on strict improvement |
| **Verified red** | exit 0, valid JSON, `pass: false` | **revert**, continue the loop — this is a result |
| **Evaluator failed** | non-zero exit · absent JSON · unparseable JSON · timeout | **the experiment failed: revert, continue.** Never read a partial score |
| **Degraded measurement** | valid JSON, `metric_state: "unreadable"` | **revert, continue** — a metric that was expected and could not be read is not a zero |

The last two rows are the ones that get written wrong. A non-zero exit is *not*
`pass: false`: the first says the measurement did not happen, the second says it
happened and the tree is red. A loop that folds them together reverts correctly
by accident today and stops doing so the moment a verifier starts exiting 2 for
"could not run".

**Timeout is an evaluator failure, not a red tree.** An evaluator that has not
answered has not answered; treating a timeout as `pass: false` would let an
infrastructure hiccup revert a good change and record the revert as evidence.

## Producer obligations

- **Write the JSON object to stdout**, as the last line, and nothing else that
  parses as JSON. Measured hazard: `check_references` writes its count to
  **stderr**, so a stdout-only reader saw `metric: null` beside `pass: true` — a
  degraded reading that looked like a clean one. A wrapper that reads both
  streams must still emit its own verdict on stdout alone.
- **Set `metric_state` whenever `metric` is omitted.** `absent` and `unreadable`
  are different events and the schema cannot infer which one applies.
- **Never emit `error` for a red tree.** `error` means the evaluator could not
  produce a verdict; a red tree is a verdict.
- **Keep `name` stable.** The register keys its metric series on it, so a rename
  starts a new series rather than continuing an incomparable one.

## What this contract does NOT do

It does not say how the metric is computed, how the loop bounds its iterations,
or where the register lives — those belong to the loop, not to the verifier. The
whole point of the split is that a verifier can be wrapped once and then reused
by any loop, which is what spike s02 demonstrated on three verifiers with zero
changes to any of them.
