<!-- evidence-type: analysis -->

<!-- The prompt given to the council on 2026-10-24, committed verbatim so the
     verdict beside it can be checked against what was actually asked. It
     tells the seats the asking agent drafted the protocol and would implement
     the result. -->

# Step 7.1: does this producer protocol close the trust boundary the last round named, enough to start fixtures and a report-only schema draft?

You are advising on step 7.1 of an internal governance roadmap. Answer on the
evidence below. Do not assume facts not stated here; where a fact is missing,
say so and say what would settle it. The agent asking you drafted the protocol
below and would also write the fixtures and schema that follow from it, so
treat its framing and its proposals with suspicion and say where they overreach.

## Background

Four earlier rounds (the same two providers) govern this step. The latest,
earlier today (2026-10-24), reviewed an aggregation truth table for per-aspect
CI check results. Both seats said no to fixtures and a schema draft. They kept
"any enforcing aspect blocks" and agreed: a snapshot whose baseline is
unavailable blocks once authoritative and never falls back to "reach zero"; an
improvement below baseline does not block; `excepted` is a disposition, not a
result; report-only needs a completeness status independent of its exit code;
"previous enforced class" is only safe from an authenticated snapshot; a
formerly governed check becoming unregistered is coverage loss. They named
eight points owed first: producer identity and trust; binding to source
revision, target revision, invocation, evaluator version and registry version;
evidence digest and freshness; raw evaluation versus disposition; duplicate,
omission, replay, partial-output and version-skew behaviour; run-level
complete/incomplete/invalid; coverage invariants; the authenticated source of
the previous enforced policy.

They split, and this round is NOT asked to settle these: whether an evaluator
crash blocks every enforcing class or runs against a budget; tolerance
aggregation; how narrow the path for lowering a baseline is; whether
report-only should become per-check shadow, advisory, enforcement.

Owner-reserved and out of scope: the repository has no second principal to
approve changes to the governance surface. Anything that needs authenticated
(not merely immutable) state is tied to that blocker.

## The draft under review, verbatim

## What already exists — read first

Three mechanisms in the tree already solve parts of this, and the draft
extends them rather than inventing a parallel one.

1. **The consumer runs the producer.** `check_gate_coverage` reads
   `src/config/gate-coverage.yml`, invokes each listed gate with the
   CI-identical argv declared there, and reads one machine line
   (`scanned: <N>`) from that run's output. It never reads a result file a
   gate wrote somewhere earlier. A replayed or wrong-revision count cannot
   reach it, because the count only exists inside an invocation the guard
   started on the checkout it is running on.
2. **"Could not measure" is already distinct from "found violations".**
   `src/scripts/_lib/gate_result.ts` classifies a run as `clean`,
   `violations`, `crashed` or `estate_invalid`. `estate_invalid` keys on the
   names of structural error classes the shared primitives throw
   (`DeadScopeError`, `UnaccountedTargetsError`, `BaseRefUnavailableError`,
   and two more), not on prose. A null exit code is `crashed`, never `clean`.
3. **The ratchet has five states** (`checkRatchet`: `unbaselined`,
   `regressed`, `improved`, `stale`, `within`), as the 2026-10-21 draft
   recorded.

What none of them has: a result per aspect, a run-level completeness verdict,
and a binding between a result and the policy row it is evaluated against.

## The proposal

### P1 — Producer identity: the invoker names the producer, the producer does not

The validator starts every producer itself, from the argv the registry row
declares, in the same job and on the same checkout as the decision it feeds.
Producer identity is **computed by the validator**: the script path plus its
git blob hash at the evaluated revision. A record that carries its own
identity claim is not trusted for it; the claim is ignored and the computed one
used.

Trust consequence, stated honestly: this does **not** make a producer's
`pass` more trustworthy than today's exit code 0. It makes it exactly as
trustworthy — the code that emits it is the code reviewed into the tree at that
revision. Raising trust above that needs authenticated approval of changes to
producers, which is the owner-reserved blocker
`external-bootstrap-boundary-for-phases-2-3`. This protocol removes the vectors
that are worse than today (replay, wrong revision, a stray file, a second
writer) and does not claim to remove the one that is the same as today.

### P2 — Binding: a per-invocation channel, not a file anywhere

For each invocation the validator creates a fresh, empty channel file and
passes its path in an environment variable, together with a random nonce. The
producer writes one JSON object per line to that path:

```
{"v":1,"nonce":"…","aspect":"<id>","evaluation":"pass|fail|expired|not-evaluated","reason":"<code>","evidence":[{"path":"…","sha256":"…"}],"detail":"…"}
```

then exactly one terminator line `{"v":1,"nonce":"…","end":true,"aspects":<n>}`.
The validator records, outside the channel and from its own knowledge: source
revision, target revision (where the check compares against one), invocation
id, producer blob hash, registry version and the validator's own version.
Those six bindings are never read from the producer.

A record with a wrong nonce, from a path the validator did not create, or
written after the producer process exited, is rejected. That is the replay and
stray-writer defence; it relies on the validator controlling the process, which
P1 already requires.

### P3 — Evidence digest and freshness

`evidence` lists the inputs the aspect read. The validator re-hashes each
listed path itself after the run and rejects a record whose digest does not
match the file at the evaluated revision. Freshness of a time-qualified aspect
(for example the 90-day window in `check_trigger_evals`) is evaluated against
**one clock**: the commit time of the evaluated revision, not the runner's wall
clock, so the same revision evaluates the same way on every runner and on a
re-run next week. Calendar-driven expiry without a tree change therefore shows
up only on a new revision, which is a stated limit (L3).

### P4 — Raw evaluation is separate from disposition

The producer reports only what it measured: `pass`, `fail`, `expired`, or
`not-evaluated` with a reason code (`evidence-missing`,
`prerequisite-unavailable`, `invalid-input`, `unsupported-version`). It never
reports `excepted`. Exceptions, baselines and class are applied **after**, by
the validator, from the registry and from exception records, and every
disposition is stored next to the raw evaluation it was applied to, never in
place of it. A failing aspect under a valid exception reads
`evaluation: fail, disposition: excepted (record <id>, expires <date>)`, so a
failure that persists or worsens stays visible.

A snapshot aspect is the one case where the comparison is not the producer's:
the producer reports the raw count as `detail`, and the validator applies the
baseline. That moves Cell A and Cell B into the validator, where the registry
row says which baseline applies, instead of leaving each check to decide.

### P5 — Duplicate, omission, partial output, replay, version skew

| Condition | Run-level effect | Aspect effect once authoritative |
|---|---|---|
| a registered aspect has no record | `incomplete` | `not-evaluated` (`evidence-missing`), blocks if enforcing |
| two records for one aspect | `invalid` | both discarded; blocks if enforcing |
| a record for an unregistered aspect | `invalid` | registry/CI mismatch; blocks |
| no terminator, or terminator count differs | `incomplete` | every aspect of that check `not-evaluated`; never a partial pass |
| wrong nonce or foreign path | record dropped, counted | as if absent |
| unsupported `v` | `invalid` | every aspect `not-evaluated` (`unsupported-version`) |
| producer exits non-zero with all aspects `pass` | `invalid` | contradiction; blocks |
| producer exits 0 with any `fail` | `invalid` | contradiction; blocks |

The last two rows keep the exit code meaningful during migration: a producer
that emits records must agree with its own exit code, so the legacy gate and
the validator cannot silently disagree.

### P6 — Run-level status

Every validator run ends with exactly one of `complete`, `incomplete` or
`invalid`, printed as its own machine line and written to the run summary,
independent of the exit code. In report-only mode the exit code stays 0 and
the status line is what a reader reads; a report-only run that is not
`complete` is labelled as not evidence of anything. Isolation: one producer's
`invalid` marks that check and the run, but every other producer is still
evaluated and reported, so one malformed producer neither hides other results
nor yields a misleading partial pass.

### P7 — Coverage invariants anchored outside the mutable registry

The set of governed checks is compared against the set at the merge base, read
from the base revision rather than from the working tree. A check present at
the base and absent now is **coverage loss** and blocks once authoritative,
unless the same change carries a removal recorded through the governed path. A
check absent at the base is new and keeps its legacy CI behaviour until it is
registered. This is the same base-ref pattern `gate_baseline.loadBaselinesAt`
already uses, so the registry cannot shrink its own coverage by editing itself.

What it does not settle: who may approve a governed removal. That is the
owner-reserved blocker again.

### P8 — Source of the previous enforced policy

The previous policy is the registry and baselines **at the merge base**, read
by revision, not a separate store. When an assertion in the change carries bad
provenance, the validator evaluates against the base revision's row. When the
base revision has no valid row either (first activation, or a corrupted
history), policy resolution has failed and the check blocks; it never falls
back to the legacy exit code, which would be a silent downgrade.

This is immutable in the sense that a merged revision cannot change. It is
**not authenticated** in the sense the seats asked for: a revision merged
without a second principal is exactly as trustworthy as the process that merged
it. Authenticated policy snapshots stay behind
`external-bootstrap-boundary-for-phases-2-3`, and this draft does not claim
otherwise.

## Threat model, compressed

| Threat | Covered by | Residual |
|---|---|---|
| replayed or stale result | P1, P2 (validator-started run, nonce, fresh channel) | none known within one job |
| result for the wrong revision | P2 (validator-recorded binding) | none known within one job |
| a second writer or stray file | P2 | a producer that spawns a child and passes the env on |
| partial output read as a pass | P5 terminator, P6 isolation | none known |
| duplicate or contradictory results | P5 | none known |
| fabricated `pass` from the producer's own code | not covered | same as today's exit code 0; needs authenticated review of producer changes (owner-reserved) |
| registry shrinking its own coverage | P7 | approval of a governed removal is owner-reserved |
| bad provenance silently changing class | P8 | base revision is immutable, not authenticated |
| clock disagreement across runners | P3 single clock | calendar expiry lags until a new revision (L3) |

## Limits

- **L1.** This drafts a protocol against three checks and two shared modules.
  No producer emits records today; no fixture was run.
- **L2.** It leaves the four splits the 2026-10-24 round recorded undecided:
  whether `error` blocks, tolerance aggregation, how narrow Cell A's path is,
  and whether report-only becomes shadow → advisory → enforcement. P4 and P6
  are written to work under either answer.
- **L3.** Evaluating freshness at commit time means a stamp that expires on a
  quiet branch is not reported until the next revision. A scheduled run on the
  default branch would close that, at the cost of a second evaluation clock.
- **L4.** Every point that needs *authenticated* rather than *immutable* state
  is marked as owner-reserved, not solved.

## Questions

**Q1 — Coverage of the eight points.** Does the draft address each of the
eight points the last round named? For each it does not, say what is missing.

**Q2 — The trust claim.** P1 says the protocol removes the vectors worse than
today's exit code and does not claim to make a producer's `pass` more
trustworthy than exit 0. Is that the right line to draw before authenticated
approval exists, or does the round's requirement demand more than that before
fixtures and a report-only draft?

**Q3 — Base revision as the previous policy (P7, P8).** Is reading coverage and
previous policy from the merge base acceptable as the immutable, unauthenticated
interim, with authentication left to the owner-reserved blocker? Name any case
where it is worse than no fallback at all.

**Q4 — P5 and P6.** Is the condition table complete and is each effect right,
in particular treating a disagreement between records and exit code as
`invalid`?

**Q5 — Next item.** Given your answers, may round 3's item 3 (three executable
fixtures) and item 4 (a versioned report-only schema draft, enforcing nothing)
now proceed? If not, name the single thing owed first.

Answer each question with a recommendation, the strongest objection to it, and
your confidence.
