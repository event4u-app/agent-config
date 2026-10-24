<!-- evidence-type: analysis -->

<!-- The prompt given to the council on 2026-10-24 (fourth round that day),
     committed verbatim so the verdict beside it can be checked against what
     was actually asked. It tells the seats the asking agent drafted the table
     and would implement the result. One addition after sending: the
     `ref-ignore` marker on the "Ordering rationale" line, which the reference
     checker reads as two rule links. -->

# Step 7.1: is this the outcome table and accepted-byte boundary the last round said a normative v0 waits for?

You are advising on step 7.1 of an internal governance roadmap. Answer on the
evidence below. Do not assume facts not stated here; where a fact is missing,
say so and say what would settle it. The agent asking you drafted the table
below and would also write the v0 schema and fixtures that follow from it, so
treat its framing and its proposals with suspicion and say where they overreach.

## Background

Earlier today (2026-10-24) the same two providers reviewed an invocation
envelope for per-aspect CI check producers. Both seats let exploratory,
non-normative adversarial fixtures proceed, and withheld a normative v0 until
one item exists: "a complete outcome table tied to a validator-owned, bounded
definition of the exact accepted byte sequence", over three dimensions:
collection outcome, protocol outcome, validator/reporting health. They asked
that a validator failure never erase another producer's result, that the
terminator stay the producer's atomic commit marker with the rationale stated,
that the compatibility matrix derive the expected exit from the records and
treat an expired row as a configuration error, and that end-state tree
comparison be called drift detection, not mutation proof.

Owner-reserved and out of scope: the repository has no second principal to
approve changes to the governance surface. Producer and validator run as one
principal.

## The draft under review, verbatim

## What changed since the envelope draft — measured, not argued

The exploratory fixture `gate-channel-escape-20261024.md` measured E3. A
`setsid` grandchild wrote a forged `pass` after the producer's process group was
killed. A regular-file channel accepted it in 10 of 10 runs. A validator-owned
pipe that the validator stops reading accepted it in 0 of 10. The same pipe read
until EOF accepted it in 10 of 10. So the boundary is the validator's decision to
stop, and a pipe without that decision is no better than a file. That is
darwin and one Node version only. The fixture stopped 150 ms after the producer
exited; B below drops that grace, because any write inside a grace window is
accepted unseen.

## B — The accepted byte sequence

**B1.** The channel is file descriptor 3, the write end of a pipe the validator
creates. There is no channel path and no channel file, so E3's inode, symlink
and link-count checks are gone.

**B2.** The validator reads fd 3 into memory as bytes arrive. It counts bytes and
lines while collecting, and it stops at the limit. The limit is enforced during
collection, not checked afterwards.

**B3.** Collection stops at the **first** of these events, and the stop is
recorded as the collection outcome:

| Stop event | Collection outcome |
|---|---|
| the producer process exits | `exited(code)` or `signalled(signal)` |
| the wall-clock limit passes | `timed-out` |
| the byte or line limit is reached | `output-limited` |
| the producer could not be started | `not-started` |

There is **no grace period**. At the stop event the validator stops reading,
closes its read end, then signals the producer's process group (`SIGTERM`, then
`SIGKILL` after 2 s). Bytes already in the pipe buffer at the stop event are
drained without blocking and accepted. Nothing written after that is read.

**B4.** The accepted byte sequence is exactly the bytes read between spawn and
B3's stop. Parsing reads only that sequence, after collection has ended.

What B does not cover, stated so it is never read as covered: a descendant that
inherits fd 3 and writes **before** the stop event is indistinguishable from the
producer. The fixture measured late writes only. Same-principal attachment to the
validator is out of scope (L1).

## Dimension 1 — collection outcome

Set by B3. Exactly one of `exited(code)`, `signalled(signal)`, `timed-out`,
`output-limited`, `not-started`.

## Dimension 2 — protocol outcome, per producer

The parser reads the accepted sequence as UTF-8 lines. Rules apply in this order,
and the first rule that matches decides the outcome:

| # | Observation | Protocol outcome | Reason code |
|---|---|---|---|
| P1 | collection outcome is `not-started` | `absent` | `not-started` |
| P2 | a line is not valid UTF-8 or not JSON | `invalid` | `malformed` |
| P3 | a record has an unknown field, an out-of-enum value, or a `v` other than the supported one | `invalid` | `schema` |
| P4 | records carry more than one `v` | `invalid` | `mixed-version` |
| P5 | two records name the same aspect | `invalid` | `duplicate-aspect` |
| P6 | a record names an aspect this producer's registry row does not list | `invalid` | `foreign-aspect` |
| P7 | more than one terminator, or a record after the terminator | `invalid` | `framing` |
| P8 | collection outcome is `output-limited` | `invalid` | `output-limit` |
| P9 | the evidence hash budget is exhausted for this producer | `invalid` | `hash-budget` |
| P10 | the tree differs between the start and the end of the run (end-state drift only) | `invalid` | `tree-drift` |
| P11 | the producer's compatibility row is expired | `invalid` | `expired-compat-row` |
| P12 | the active compatibility row's expected exit, derived from the records, differs from the observed exit | `invalid` | `exit-contradiction` |
| P13 | no terminator | `incomplete` | `no-terminator` |
| P14 | the terminator's count differs from the number of records | `incomplete` | `count-mismatch` |
| P15 | a registered aspect has no record | `incomplete` | `missing-aspect` |
| P16 | collection outcome is `timed-out` or `signalled` | `incomplete` | `timed-out` / `signalled` |
| P17 | the tree was dirty at the start | `incomplete` | `dirty-tree` |
| P18 | none of the above | `complete` | — |

Ordering rationale. `invalid` rules come before `incomplete` rules because <!-- ref-ignore -->
evidence of a malformed or contradictory stream is a stronger finding than
evidence of a short one. A stream that was cut short **and** carries a duplicate
reports the duplicate. P8 sits with `invalid` because the producer exceeded what
it was granted, and a truncated stream must never be parsed as a short one. P11
is checked before execution as well, and a run never starts a producer whose row
has expired. Here it only records the outcome.

Every rule is evaluated and recorded, and the first match decides the outcome.
So the full set of observations is kept as diagnostic detail, and combinations
such as `timed-out` with `duplicate-aspect` stay visible.

**Atomicity.** The terminator is the producer's commit marker. A producer whose
protocol outcome is not `complete` contributes no `pass` for any aspect. Every
one of its aspects is reported `not-evaluated`, and the reason is the protocol
outcome. The reason, stated so it is not left to inference: without a valid
terminator the validator cannot tell a finished evaluation from one killed
mid-way.

**Exit code after migration.** For a producer with no compatibility row, the
exit code is recorded as collection detail and does not change the protocol
outcome. A `complete` stream with a non-zero exit is reported as `complete` with
a `process-nonzero` note.

## Dimension 3 — validator and reporting health, per run

Separate from every producer, so a validator fault never erases a producer's
result:

| Observation | Health |
|---|---|
| the validator handled every producer and wrote and read back its summary | `healthy` |
| the validator could not handle one producer (an internal exception while parsing or hashing for it) | `degraded`, and that producer's protocol outcome is `unassessed` |
| the validator stopped before starting some producers | `degraded`, and those producers are `not-attempted` |
| the summary could not be written or read back | `failed` |
| the registry could not be read, or its schema version is unsupported | `failed`, before any producer starts |

`unassessed` and `not-attempted` belong to the validator. They are not protocol
outcomes, and a producer never causes them.

## Presentation status, derived

Each producer gets one line, built from its three values:
`<protocol outcome> (<collection outcome>; validator <health>)`.

The run gets one status, derived by precedence:
`failed health > any invalid > any incomplete or absent or unassessed or not-attempted > complete`.

The two exits from the envelope's E7 stay as they were. The evaluation exit is
always 0 in report-only mode. The operational exit is non-zero exactly when
health is `failed`. A `degraded` run is reported, and it does not make the
operational exit non-zero, because the producers it did handle are still
reported truthfully.

## What the next fixtures attack

Each row of P1–P17 and each health row gets one throwaway producer and its
expected outcome. The three combinations the round named get their own
fixtures: a timeout with a duplicate, an output limit with a missing
terminator, and a validator fault on one producer while the next producer
completes. The escape fixture is re-run with a write placed **before** the stop
event, to measure what B admits it does not cover.

## Limits

- **L1.** Producer and validator share a principal. A descendant writing before
  the stop is not distinguished, and same-principal attachment is out of scope.
- **L2.** The table is drafted against one fixture and the envelope draft. No
  producer emits records yet.
- **L3.** The B boundary was measured on darwin and one Node version. D27's
  requirement to run fixtures on every supported CI OS and Node version before
  `v0` is still owed.
- **L4.** Every reason code and every limit is a `v0` value. All of them are
  disposable.

## Questions

**Q1 — The boundary.** Is B a validator-owned, bounded definition of the exact
accepted byte sequence? Is dropping the grace period right, and is the
"descendant writing before the stop" residual stated honestly?

**Q2 — Totality.** Is the protocol-outcome table total and deterministic? Name
any observation with no row, any row in the wrong outcome, or any ordering that
hides a stronger finding.

**Q3 — The three dimensions.** Does the health dimension keep a validator fault
from erasing producer results, and is the run precedence right?

**Q4 — Next item.** May a schema named and versioned as disposable v0, enforcing
nothing, now be drafted against this table, with the listed fixtures? If not,
name the single thing owed first.

Answer each question with a recommendation, the strongest objection to it, and
your confidence.
