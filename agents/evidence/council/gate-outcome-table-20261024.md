<!-- evidence-type: analysis -->

# The outcome table is not total, and its boundary contradicts itself

AI council, 2026-10-24, the fourth round that day. anthropic/claude-sonnet-4-5 +
openai/codex-default, 2/2 present, 2 rounds with peer review, design mode, CLI
transport, `$0.00`, no chairman synthesis. The prompt is committed verbatim
beside this file as `gate-outcome-table-20261024.question.md`. The draft it asks
about is `agents/evidence/analysis/gate-outcome-table-20261024.md`, written to
discharge D27.

## Verdict: an experimental slice may proceed, a normative v0 may not

- anthropic: *"Do not greenlight as normative v0. Greenlight exploratory
  implementation ONLY with explicit experimental labeling, feature flag, and
  degraded-exit-zero fix."* Owed first: *"Repair the B boundary contradiction
  and specify line framing, THEN draft exploratory schema."*
- openai: *"Permit an explicitly `experimental` schema, collector, reference
  producer, and fixtures as one vertical slice. Do not name or publish it as
  normative v0 yet."* Owed first: *"An executable collector state machine plus
  corrected applicability/precedence rules."*

Both name the same item: B rewritten as an executable collector state machine,
with line framing and the applicability rules corrected. openai adds that the
word *v0* itself creates compatibility expectations, so it should be an
experimental namespace instead. Step 7.1 stays open.

## Defects in the draft both seats found

1. **B3 contradicts B4.** B3 stops reading, closes the read end, *then* drains
   buffered bytes, and a closed descriptor cannot be drained. openai offers a
   boundary that can be implemented: *"Once a terminal collection condition is
   observed, no further read operation is initiated. Bytes returned by reads
   completed before that transition remain accepted."* Event-loop ordering has
   to be stated and tested.
2. **Framing is unspecified.** The draft does not define the line delimiter
   (LF, CRLF), an unterminated final line, a partial UTF-8 sequence at a limit,
   which prefix is accepted when one read crosses the byte limit, or empty
   lines.
3. **P4 is unreachable**, because P3 rejects every unsupported `v` first.
4. **P11 contradicts P1.** An expired row is never started, so it reaches P1 as
   `not-started`. Expiry and a dirty starting tree (P17) are preflight or
   configuration state, not producer protocol observations. A preflight
   dimension is owed. openai rejects folding them into validator health.
5. **P12 has no domain or derivation.** It applies only to `exited(code)` and
   only after structural validation, and the derivation needs to be specified.
   anthropic asks whether the matrix should carry exit codes at all.
6. **P9 conflates two owners.** A declared hash quota exceeded may be a producer
   result. A hashing or I/O failure is validator health.
7. **P8 is justified only if the limits are published before execution**, are
   measured exactly, and fit every registered aspect. The draft supplies none
   of these.
8. **The summary is a shared failure domain.** One write or read-back failure
   still loses every producer's result. Per-producer or checkpointed reporting,
   or a bounded fallback, is owed.
9. **"First event wins" loses information.** The primary stop reason is kept
   separate from the observed termination, the cleanup result, surviving
   descendants and the stream close or error.
10. **fd 3 is a bearer capability.** The pipe stops late writes. It does not
    identify the writer. The claim is framing and bounded collection, **not**
    producer provenance.

## Where the seats split

| Question | anthropic | openai | Taken here |
|---|---|---|---|
| `degraded` with operational exit 0 in report-only | The hardest pushback: fail-open by default | Acceptable in report-only under an explicit mode contract; fail closed in any enforcing mode | Undecided. A mode contract is owed either way, and no enforcing mode exists |
| Atomicity | Per-producer atomicity has a large blast radius; per-aspect is the alternative | The terminator is a defensible commit marker; the registry should bound producer breadth | Per-producer stays; the blast radius is recorded as a cost the registry must bound |
| P8 as `invalid` | Only with limits declared in the registry | Same, plus exact measurement and a sufficient budget | Agreed in substance |

Carried for promotion beyond the experimental slice: a reference producer, the
supported OS and Node matrix, fault injection for reporting and cleanup,
published limits, rollback and kill-switch criteria, and enforcement-mode
semantics.
