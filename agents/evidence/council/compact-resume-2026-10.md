# Council decision — what a `compact` session-start returns from the continuity layer

<!-- evidence-type: analysis -->

Session: 2026-10-06. Members: anthropic (claude-sonnet-4-5), openai (codex-default
on the first attempt, gpt-4o on a mode-override retry). Quorum 2/2 on the
decisive run (subscription transport, $0 billed). Rounds: two deliberation
rounds each. The question put to the council is restated in full below rather
than linked, since the question file itself is a transient, gitignored
artifact.

## Why this file exists

Two records in the tree disagreed about what `source=compact` returns from the
recycle-envelope continuity record:

- An archived, ticked roadmap step (`road-to-continuity-retirement-sequencing`
  3.3, done 2026-09-08): *"`compact` re-injects this session's own record."*
- The resolver rule a later council chose (`resolveContinuityRecord`,
  2026-09-09, 2/2): *"Own record. NEVER read."*

Reproduced before the question was put: with the resuming session's OWN id on
the record, `consume_recycle_envelope` returns `{"action":"absent"}` and the
file is left untouched — the archived step's claim does not hold. With a
DIFFERENT (foreign) session's record on disk, the same call returns
`{"action":"inject"}` and consumes (moves aside) that file.

The one test that exercises `source=compact` end to end
(`tests/scripts/handoff_context_hook.test.ts`) covers only the prose handoff
(`handoff-context.md`), a different consumer gated by the same `sourceGate`
function but never routed through `resolveContinuityRecord` — it proves
nothing about the recycle-envelope path.

Not measured, and named as such in the question: whether a host that fires
`source=compact` reuses the same `session_id` the pre-compaction session
carried, or issues a new one.

## The question

1. On `compact`, should the session get its own record back without
   consuming it, should it get nothing, or should the "own record"
   expectation be retracted entirely (treating `compact` like `resume`/`fork`
   for the record)?
2. May a consumer on `compact` take a file another session wrote, given the
   resolver's own stated purpose is peer isolation?

## Verdict — convergent, 2/2

**`compact` injects nothing for the recycle-envelope record — neither the
reader's own record nor an arbitrary non-own one — until a real
predecessor-identity signal exists.** This is immediately actionable and does
not depend on the unmeasured session-id-preservation question.

Both seats independently reached the safety-critical part of this verdict:

- **openai/gpt-4o** (direct): *"On `source=compact`, the recycle-envelope
  consumer should currently inject **neither** the reader's own record; nor an
  arbitrary non-own record. That should be explicit policy... A non-own
  `session_id` proves only **difference**, not **lineage**."*
- **anthropic/claude-sonnet-4-5** (round 2, after a credit-balance failure on
  round 1 — see Transport note below): agreed the archived claim is
  falsified, the cited test proves nothing about this path, and that if
  session-id changes across compaction "`compact` injects nothing (current
  behaviour is correct for peer isolation)." Where it initially proposed a
  measurement-gated restoration of own-record injection, the second,
  full-quorum round converged with openai: id preservation alone does not
  establish that an own record is *intended* for reinjection, and consuming
  "the one other record" cannot establish lineage either — only an explicit
  predecessor-identity signal (e.g. a `predecessor_session_id` field) would.

Both seats also agreed, independent of the design question:

- The 2026-09-08 "done" verdict on step 3.3 should be **reopened** — its own
  completion criterion (seven test cases) does not exercise the recycle-
  envelope path, so the claim was closed on incomplete evidence.
- The `sourceGate` docblock is internally inconsistent with the resolver's
  actual Rule 1 and needs immediate correction regardless of the design
  outcome.
- The two artefacts (prose handoff, recycle-envelope record) should not share
  one gate decision — openai's refinement, adopted in the fix: split into
  `sourceGate` (handoff) and a new `recycleEnvelopeGate` (record), so a
  `compact`-specific record decision cannot silently change handoff behaviour
  or vice versa.

## What the verdict does NOT decide

Whether `compact` should EVER get predecessor-state restoration, and if so,
through what identity signal (`predecessor_session_id`, a continuation token,
or similar) — both seats flagged this as a separate, larger design question
this round does not resolve. No new mechanism is built here; the record stays
unconsumed on `compact` until that question is answered on its own.

## What followed from this verdict

- `recycleEnvelopeGate` added to `src/scripts/handoff_context_hook.ts`,
  excluding `compact` from its injecting set; `sourceGate` (the prose-handoff
  gate) is unchanged and still injects on `compact`.
- The module docblock corrected to state the true, now-split behaviour.
- `tests/scripts/handoff_context_compact_record.test.ts` — one fixture per
  case: own record only, one foreign record, no record, and a contrast
  fixture proving the same foreign-record file DOES inject under
  `source=startup`.
- `road-to-continuity-retirement-sequencing` 3.3 gains a dated correction note
  pointing at this file.

## Transport note (why two runs were needed)

The first run, forced onto the metered API rung (`--mode-override api`)
because `council:status` reported `openai` CLI-unavailable, failed on the
ANTHROPIC side instead — `HTTP 400: Your credit balance is too low` — while
OpenAI answered. The second run, left on the default (subscription)
transport, reached a full 2/2: `anthropic` answered subscription-authed and
`openai`'s CLI seat (unavailable per the live-probe cache) answered anyway,
unrelated to the attendance-counting cache read. Two independent single-seat
readings plus one full-quorum round, all converging on the same safety
verdict, is stronger evidence than any one of them alone: the pre-run
quorum line is a presence-cache check, not a result, and a DEGRADED run that
still produced a substantive, on-topic answer is not discarded.
