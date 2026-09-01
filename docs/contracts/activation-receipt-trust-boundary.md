---
stability: beta
keep-beta-until: 2026-11-30
roadmap_ref: road-to-governed-evidence-production.md
---

# Activation-receipt trust boundary and evidence-cost contract

**Purpose.** State, as falsifiable claims, (a) what makes an activation receipt
independent of the thing it reports on, and (b) what a receipt is allowed to
cost. Written under `road-to-governed-evidence-production` step 1.3, whose
verify clause requires both to be written down before a producer writes its
first receipt, and requires step 1.1's producer to **cite** them rather than
restate them.

**Scope.** Governs the producer of the optional `activation` object on an
audit-log-v1 line ([`audit-log-v1.md`](audit-log-v1.md) § Field semantics), the
receipt shape in
[`src/scripts/_lib/activation_ladder.ts`](../../src/scripts/_lib/activation_ladder.ts),
and the receipt-bearing stages of the evaluation cascade
([`src/scripts/_lib/evaluation_cascade.ts`](../../src/scripts/_lib/evaluation_cascade.ts)).
Does **not** define the ladder's rungs, its families, or the aggregation rule —
those are the ladder module's, and duplicating them here would create a second
source of truth for the same enum.

## Why this exists — the failure it is written against

The deterministic cascade excludes `activation` and `adherence` from
`PREFIX_ASSIGNABLE_FAMILIES` because assigning either from a deterministic proxy
manufactures evidence: a holdout leak is not an observation that activation
failed. A receipt producer removes that exclusion — and if the producer reads
the same inputs the classifier reads, the proxy problem returns one layer up,
where it is harder to see. That is
`road-to-governed-evidence-production` § Risk Register row 1, and every claim
below is written so that a reader can check whether it has happened.

Each claim states the observation that would **refute** it. A claim whose
refuting observation cannot be made is not a claim in this contract.

## Trust-boundary claims

### TB-1 — The producer reads no evaluation input

> **Claim.** No rung STATE written by the producer is a function of a candidate
> record, a cascade stage outcome, a metric vector, or a promotion verdict.

**Refuted by:** an import edge from the producer module to
`_lib/evaluation_cascade.ts`, `_lib/candidate_record.ts`,
`_lib/evaluation_vector.ts` or `_lib/paired_verdict.ts`; or any producer code
path whose emitted `RungState` is a function of a value obtained from one of
them.

**Subject and state are separated deliberately, and the word `STATE` is
load-bearing.** *Which* artifact a receipt is about is an INPUT — a caller may
name it from anywhere, including from a candidate record, and doing so decides
nothing. *Whether* a rung was reached is EVIDENCE, and it may come only from an
admitted source under TB-3. A contract that forbade the subject too would forbid
producing a receipt about a candidate at all, which is not the failure being
guarded against: the proxy problem is a state inferred from the evaluator's own
judgement, never a name passed across a function boundary.

**Why an import edge is the refuting observation and not a proxy for one.** The
producer's only inputs are its declared observations; if it imports no
evaluation module, there is no value from the evaluation side it could read.
The direction is deliberately one-way: the cascade MAY import the producer's
receipt type, because consuming a receipt is not the same as producing one.

### TB-2 — An unobserved rung is absent, never negative

> **Claim.** A rung for which the producer holds no observation is omitted from
> the receipt. It is never written as `not-reached`, and never as `reached`.

**Refuted by:** a receipt in which a rung carries `not-reached` while the
producer's observation set names no observation for that rung; equivalently, a
`ladderRate` denominator that grows when a rung goes unobserved.

This is the same absent-versus-empty distinction audit-log-v1 already draws for
`skills_applied`, and it exists for the same reason: a reader that folds "not
recorded" into "recorded, and negative" inflates every downstream rate by
exactly the capture gap.

### TB-3 — Every observation names an admitted evidence source

> **Claim.** Every rung state carries an `evidence_source` drawn from a closed,
> committed set, and each admitted source is a surface the producer can read
> without consulting the evaluation side.

**Refuted by:** a receipt carrying an `evidence_source` outside the committed
set; or an admitted source whose reader imports an evaluation module (which
would also refute TB-1); or an admitted source with no shipped observer, which
makes the set describe a capability that does not exist.

**The last clause is a real constraint and it costs coverage.** An adherence
observation would need a source that reads what a reply actually did. No such
source is admitted today, so the producer cannot emit the `adhered` rung, and
real receipts therefore read `unknown` at that rung rather than claiming
adherence either way. Admitting a source with no observer would make the
coverage gap invisible instead of closing it — the same "check that scans a
population of zero exits green" failure the roadmap flags for
`assertCheapestFirst`.

### TB-4 — Receipts append; they never rewrite

> **Claim.** The producer only appends lines. A correction is a new line with
> `type=supersede` naming the prior `id`, per audit-log-v1 § Append-only
> invariant.

**Refuted by:** a producer code path that opens an audit file in a mode other
than append, that truncates one, or that emits a line reusing an existing `id`
without `type=supersede`.

## Evidence-cost claims

### EC-1 — Producing a receipt costs zero model calls

> **Claim.** The producer and its dependency closure contain no transport
> import, no network call, no subprocess spawn, and no API-key environment read.

**Refuted by:** any of those four appearing in the producer module or in a
module it imports. This is the same shape as the survival-bar assertion in
`tests/scripts/proposer_survival_bar.test.ts`, and it is checkable by reading
source rather than by counting calls at runtime — a counter can be wrong about
a call that did not happen on the path under test.

**Consequence, stated so it cannot be read as narrower than it is.** Receipt
production is admissible under the `metered-backend-park` blocker. The park
forbids a live model harness; it does not forbid observing a filesystem.

### EC-2 — No receipt-bearing stage runs before the free prefix

> **Claim.** In the committed stage enumeration, every receipt-bearing stage has
> a higher index than every stage of the deterministic prefix that precedes the
> measurement stage.

**Refuted by:** a committed enumeration in which a `receipt-*` stage index is
lower than the index of `schema-validity`, `path-ownership`,
`holdout-disclosure`, `budget` or `near-duplicate`.

The cascade's ordering rule is cheapest-first and abort-on-first-failure. A
receipt is cheap, but it is not free of *precondition*: classifying how far an
artifact climbed is meaningless for a candidate that is not even well-formed, so
the receipt stages sit after the record-only and plan-only stages and before the
measurement stage, whose evidence is the most expensive to obtain.

### EC-3 — A missing observation is never bought

> **Claim.** When an evidence source yields nothing for a rung, the producer
> records absence. It does not trigger work to obtain the observation.

**Refuted by:** a producer code path that, on a missing observation, calls an
observer a second time, spawns a process, or performs any I/O beyond the read
that already returned nothing.

**Why this is separate from EC-1.** EC-1 forbids a *model* call. EC-3 forbids
the cheaper version of the same mistake: a producer that quietly escalates from
observing to investigating, whose cost is unbounded even though no token is
spent. `unknown` is the intended output of a missing observation, not a
degraded one.

## What this contract does not claim

- **It does not claim coverage.** Every claim above is about the producer's
  discipline; none asserts that any particular rung is observable today. The
  shipped observer set and the rungs it leaves unobserved are recorded in the
  producer module, where they can change without amending this contract.
- **It does not claim the receipt is correct.** An observer that reads the wrong
  file produces a wrong receipt that satisfies TB-1 through TB-4. Observer
  correctness is each observer's own test's problem.
- **It does not gate the classifier.** `classifyFailure` is unchanged by this
  contract and keeps its own short-circuit-on-unknown rule.

## Cross-references

- Receipt shape, rungs, families, aggregation:
  [`src/scripts/_lib/activation_ladder.ts`](../../src/scripts/_lib/activation_ladder.ts).
- The line the receipt rides on, and the absent-versus-empty rule TB-2 mirrors:
  [`audit-log-v1.md`](audit-log-v1.md).
- The prefix exclusion this contract makes it safe to lift:
  [`src/scripts/_lib/evaluation_cascade.ts`](../../src/scripts/_lib/evaluation_cascade.ts).
- Privacy floor the producer's input type is bound by:
  [`audit-log-v1.md`](audit-log-v1.md) § Privacy floor.
