<!-- evidence-type: analysis -->

# Reference duty at the act: four arms, measured (2026-11-08)

Step 3.1 of `road-to-a-reference-that-arrives-before-the-act`, scored against
[`internal/bench/refduty-PREREG.md`](../../../internal/bench/refduty-PREREG.md)
(committed before the first trial; Amendment 1 records the instrument defect).

## Sources

| Arms | Report (primary checkout, gitignored) |
|---|---|
| `ref-nothing`, `ref-full` | `internal/bench/reports/ab-v2/2026-11-08T05-56-14Z-ab-v2-paired.json` |
| `ref-deliver`, `ref-gate` | `internal/bench/reports/ab-v2/2026-11-08T06-03-32Z-ab-v2-paired.json` (re-run, fixed instrument) |

The first sweep's `ref-deliver` / `ref-gate` trials are the defect named in
Amendment 1. They are not used here.

Model `claude-haiku-5-5`, 3 seeds, 12 trials per arm, 0 errored trials. Cost is
computed from each trial's `tokens_breakdown` at the Haiku row of
`internal/bench/pricing.yaml`, i.e. input 0.10, output 0.50, cache write 0.125,
cache read 0.01 USD per Mtok.

## Endpoints

| Arm | Violations (9 ref-decided) | Control fails (`refA-single-01`, 3) | Capability fails (chunk + single, 9) | Mean turns | Extra turns | USD / trial |
|---|---|---|---|---|---|---|
| `ref-nothing` | 5/9 | 0/3 | 1/9 | 5.00 | — | 0.0049 |
| `ref-full` | 5/9 | 0/3 | 3/9 | 4.83 | −0.17 | 0.0063 |
| `ref-deliver` | 4/9 | 1/3 | 1/9 | 5.08 | +0.08 | 0.0034 |
| `ref-gate` | **2/9** | 0/3 | 2/9 | 6.75 | +1.75 | 0.0045 |

Per task, discipline pass (P) or fail (F) by seed:

| Task | nothing | full | deliver | gate |
|---|---|---|---|---|
| `refA-chunk-01` | FPP | FPP | PFP | PPF |
| `refA-chunk-02` | FPP | FFP | PPP | FPP |
| `refA-bulkdel-01` | FFF | PFF | FFF | PPP |
| `refA-single-01` | PPP | PPP | FPP | PPP |

**False blocks** (`ref-gate`, blocked acts on `refA-single-01` that ended in a
failed capability): **0 of 3**. The registered ceiling of 0 holds.

## Verdict under the pre-registered rule

- `ref-gate` **helps**: it has 3 fewer violations than `ref-nothing`, where the
  rule requires at least 2. Its extra turns (1.75) stay within the limit of 2.
  It is the only arm that helps, so it is the recommended carrier.
- `ref-deliver` and `ref-full` show **no detected difference**. Their gaps are 1
  and 0, below what 9 trials can resolve.
- `ref-gate` **does not become a default on this run**, as registered. A blocking
  default needs the owner's ratification. The false-positive ceiling held at
  n = 3, which is a necessary condition and not a sufficient one.

## What the numbers say beyond the rule

- The whole gate effect comes from `refA-bulkdel-01`. There, the gate turned
  3/3 violations into 3/3 passes. On the two chunking tasks it ties
  `ref-nothing` (2/6 against 2/6). So the run supports "a block at the act stops
  an unconfirmed bulk-deletion commit". It does not support "a block at the act
  improves commit splitting". The bulk-deletion obligation is the one the kernel
  text names only by pointer, and the splitting rule is stated in the kernel
  itself (`commit-policy` § Always split), which fits that split.
- Putting the reference in the system prompt (`ref-full`) did not change
  violations. It did cost 29 % more per trial and showed the most capability
  failures. On these tasks, carrying the reference text everywhere buys nothing.
- `ref-deliver` named the reference and the agent proceeded anyway on
  bulk-deletion (3/3 violations). The note did not hold, only the block did.
- On the chunking tasks the gate failed capability on 2/9 trials, against 1/9
  for `ref-nothing`. That gap is inside the noise at this size, but the next run
  should watch it.

## What this cannot show

The run has 9 reference-decided trials per arm, one model, and two obligations of
one reference. The bulk-deletion effect is 3/3 against 0/3 on a single task. That
is large, but it rests on one task. A null for deliver and full is not a finding
that delivery never helps.

## Recommendation

Keep `ref-nothing` as the shipped behaviour. Offer `ref-gate`, scoped to
bulk-deletion commits, to the owner for ratification as an opt-in. That
ratification needs a larger false-positive measurement before anything becomes a
default. Total spend for step 3.1: $0.28 (first sweep) plus $0.09 (re-run).
