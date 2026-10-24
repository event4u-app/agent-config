<!-- evidence-type: analysis -->

# The envelope covers the ground; its channel has no acceptance boundary yet

AI council, 2026-10-24, the third round that day. anthropic/claude-sonnet-4-5 +
openai/codex-default, 2/2 present, 2 rounds with peer review, design mode, CLI
transport, `$0.00`, no chairman synthesis. The prompt is committed verbatim
beside this file as `gate-invocation-envelope-20261024.question.md`. The draft
it asks about is `agents/evidence/analysis/gate-invocation-envelope-20261024.md`,
written to discharge D26.

## Verdict: fixtures now, a normative v0 not yet

- anthropic: *"Fixtures yes, immediately. V0 schema yes, but only after the four
  Q1 items and four Q3 outcomes are resolved in this document."*
- openai: *"Greenlight exploratory fixtures and a disposable implementation, but
  not the specification claim."* The single item owed for a normative v0: *"a
  complete outcome table tied to a validator-owned, bounded definition of the
  exact accepted byte sequence."*

anthropic names the same artefact as its alternative to the eight inline items:
*"a normative event-to-status matrix … the eight are the matrix, just in
prose."* So both seats converge on one owed item, and both permit adversarial,
exploratory fixtures that may not become normative evidence. Step 7.1 stays
open.

## Where the seats converge

1. **The draft covers all six areas and every carried request, structurally.**
   It is not yet the finished specification.
2. **E3 does not close the channel.** It says a surviving grandchild cannot
   write, then admits the `setsid` escape that can. Killing one process group
   is cleanup, not a boundary. anthropic: open with `O_NOFOLLOW`, `fstat` the
   descriptor, read from it. openai goes further and calls the regular-file
   channel the design choice to reconsider most: a validator-owned pipe with
   bounded in-memory collection gives an actual acceptance boundary, because
   the validator decides when collection ends.
3. **E1 is a revision manifest, not execution identity.** With a dirty tree the
   executed code differs from the hashed revision. The closure digest's claim
   that it *"cannot claim two runs behaved alike when they did not"* is false;
   it becomes `revision_digest`, and only a differing value proves anything.
4. **E2 mislabels inherited `PATH`, `HOME` and `CI` as controlled.** They are
   recorded, not chosen. `TMPDIR` must not be the channel directory.
5. **E5 is not total.** Output overflow, hash-budget exhaustion, ordinary
   non-zero exit after matrix expiry, validator failure, and combinations such
   as timeout followed by tampering have no defined outcome. Hash-budget sits at
   run level while run status is derived only from producers.
6. **Validator failure must not be attributed to a producer.** anthropic: split
   validator state so a validator bug does not erase other producers' results.
   openai: three orthogonal dimensions (collection outcome, protocol outcome,
   validator/reporting health), with a presentation status derived from them.
7. **E6 needs a direction and an expiry rule.** Derive the expected exit from
   the parsed records, compare with the observed exit. openai: an expired row is
   a configuration error before execution, not a silent semantic change by
   date.
8. **E7 needs an actual CI topology.** Two exit dimensions cannot come from one
   process exit without stated steps, jobs and artifact hand-off; a summary
   write failure is reporter health, not evaluation.
9. **Pre/post `git status` is end-state drift detection**, not proof that no
   mutation occurred. The nonce is a framing check, not authentication.

## Where the seats split

| Question | anthropic | openai | Taken here |
|---|---|---|---|
| Hardest pushback | Precedence suppressing good producers when the validator breaks | The regular-file channel | Both go into the owed outcome table: validator health as its own dimension, and a pipe-collected accepted-byte boundary |
| Suppress an incomplete producer's records | Correct for producer incompleteness; state the rationale in E5 | Correct; the terminator is the producer's atomic commit marker | Agreed in substance; the rationale is written into the table |
| Throwaway implementation | Fixtures only | Fixtures and a throwaway implementation, non-required job | Fixtures only in this change; an implementation is a later item |

Raised by one seat and carried: root and merge commits in E8's clock rule;
measurement sources, windows and re-enable criteria for E10's kill switch; and
running the fixtures on every supported CI OS and Node version before v0.

## What is owed next

A complete observation-to-outcome table over the three dimensions, tied to a
validator-owned, bounded accepted-byte sequence. Adversarial fixtures may run
before it, marked exploratory, to falsify the channel assumptions; they do not
become normative evidence.
