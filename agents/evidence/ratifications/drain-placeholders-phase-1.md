---
proposed_by: claude-opus-5.5/drain-placeholders-phase-1
implemented_by: claude-opus-5.5/drain-placeholders-phase-1
reviewed_by: ai-council/anthropic-claude-sonnet-4-5+openai-codex-default-2026-10-15
providers: [anthropic, openai]
verdict: ratified
seats:
  anthropic: ratified
  openai: ratified
subject: 0476a16f388eb7fafca738c30b2335dbfeff8da612974b060d80a62b8089ee04
effective_after: merge
---

<!-- evidence-type: ratification -->

# Ratification — the egress stage in the hook dispatcher

Covers branch `drain/placeholders-phase-1` (Phase 1 of
`road-to-placeholders-on-the-wire`). Named for the branch because the pre-push
gate reads this file before the PR exists.

## The gated surfaces

The base revision's gate classifies four files of the diff as hook plumbing —
two edited, two that arrive in the dispatcher's import closure:

- `src/scripts/hooks/dispatch_hook.ts` — three changed lines: the stage runs
  before the concern loop, the payload planner receives its placeholder view,
  and each concern's envelope is cut from the view `egressViewFor` grants it.
  The file stays at 1,499 lines.
- `src/scripts/hooks/egress_stage.ts` — the stage itself (new).
- `src/scripts/_lib/agent_settings.ts` — one `export` keyword on
  `_resolve_cascade_paths`, which the stage uses for its fast path.
- `src/config/hook-latency-budget.json` — one added note recording the bundle
  delta and the measured runtime cost. No cap, ceiling or threshold moves.

The digest above is `ratification_subject` over those four files, computed with
the base revision's gate (`085ec41ff`) against this tree. It is the same at
`14b3eeef2` (reviewed in round 4) and at the head: no gated file changed after
round 4.

**Correction.** This record first carried a digest over two files
(`7420603b…`), computed with the head checkout's gate. That gate measures import
arrivals against its own checkout, so it could not see `egress_stage.ts` and
`agent_settings.ts` arriving in the closure; CI's base-revision gate did, and
refused the record. Round 5 below showed the three gated files earlier rounds
had shown only in part, before the digest was replaced.

## What the change does to authority

It adds one capability — a dispatcher stage that may later write host rewrite
fields — and removes the same capability from every concern (ADR-285,
`rewrite-concern-refused`). In this branch the stage writes nothing to any host;
it changes only what concerns on this machine receive, and only under
`egress.placeholders.mode` `protect` or `strict`, which ship `off`. Concerns that
decide whether a call runs keep the envelope as received through a closed list
bound to their scripts. Recorded as `ratified` rather than
`confirmed-non-expanding` because the stage is new rewrite authority, however
narrow its first use.

## The review — five rounds, both seats each round

Prompts, committed verbatim:
`agents/evidence/council/placeholders-phase1-review-20261015.question.md` (full
review, 49 KB, omissions named) and the delta-only rounds
`placeholders-phase1-review-r2-20261015.question.md`,
`-r3-20261015.question.md`, `-r4-20261015.question.md`, `-r5-20261015.question.md`
in the same directory.
Every round reached quorum 2 of 2, through the CLI seats, nothing billed.

| Round | Reviewed | anthropic/claude-sonnet-4-5 | openai/codex-default |
|---|---|---|---|
| 1 | `ca0103809` | REQUEST_CHANGES | REQUEST_CHANGES |
| 2 | `0cec5745c` | REQUEST_CHANGES | REQUEST_CHANGES |
| 3 | `a296651f6` | APPROVE | REQUEST_CHANGES |
| 4 | `14b3eeef2` | APPROVE | APPROVE |
| 5 | the complete diff of `dispatch_hook.ts`, `agent_settings.ts` and `hook-latency-budget.json` (byte-identical since `14b3eeef2`) | APPROVE | APPROVE |

Round-4 stances, in the seats' words:

- anthropic: "**APPROVE** — The portable injected-reader regression resolves
  the sole round-3 objection without changing default production behavior."
- openai: "**APPROVE** — the delta resolves the portability finding while
  preserving fail-closed production behavior; highest-leverage change: remove
  the vestigial filesystem write or clarify that the injected reader—not
  filesystem state—is the regression-test boundary."

Round-5 stances, in the seats' words:

- anthropic: "Stance: **APPROVE**" — "JSON: documentation-only, no behavior
  change"; "`agent_settings.ts`: minimal API expansion for necessary
  functionality"; highest-leverage change: a one-line comment at the stage call
  documenting the `off` fast path.
- openai: "**APPROVE** — the displayed changes contain no concrete correctness
  or security defect, the budget note changes no gate behavior, and the helper
  export changes reachability rather than authority; the single
  highest-leverage pre-merge change is a table-driven regression test proving
  default-off equivalence and correct original-versus-placeholder views for
  every concern."

Neither round-5 suggestion was taken in this branch: both are additions to
reviewed content, not findings against it, and either would change a gated file
after its last review.

The seats answered APPROVE / REQUEST_CHANGES; this record maps the final
APPROVE of both to `ratified`.

## Findings and dispositions

| Round | Finding | Disposition |
|---|---|---|
| 1 | Execution-view grant bound to the concern name only; a manifest could borrow a guard's name for a recording script | fixed — the grant maps each name to its script, both must match; the lint refuses a mismatched binding; an end-to-end test shows a borrowed name gets the placeholder view |
| 1 | Settings failures resolved to `off`, silently disabling configured protection | fixed — invalid mode, a naming layer that does not parse, and a throwing reader resolve to `protect` |
| 1 | The fast-path key regex missed flow-style and quoted keys | fixed — the fast path keys on the word `egress` anywhere in a project layer |
| 1 | Mode resolution outside the failure boundary; fallback dispatches not recorded; the per-key catch swallowed every error | fixed — mode read inside a try; the fallback records a `stage-error` refusal; only `EgressRefusedError` withholds one key |
| 1 | The rewrite rule rests on source text | answered, not changed in code — the dispatcher builds the host emission from a fixed set of reply keys, and a new test drives a concern returning `updatedInput` through the dispatcher and asserts the emission carries none |
| 1 | Missing tests: several values, token scope, spoofed name, unexpected failure | added |
| 1 | The reporting fixture might leak the planted value (it was redacted in the prompt) | not a defect — it writes two booleans; stated in round 2 |
| 1 | Default-off cost | kept: 0.25 ms cold / 0.09 ms warm in-process, recorded in `hook-latency-budget.json` |
| 2 | An existing but unreadable layer was treated as absent, so `off` | fixed — only ENOENT/ENOTDIR skip a layer; any other read error is `protect` |
| 2 | The rewrite test could pass if the fixture never ran | fixed — the test reads the fixture's feedback record |
| 2 | `egressViewFor` coerced a missing name | fixed — requires a string |
| 3 | The unreadable-layer test relied on EISDIR, which is platform-dependent | fixed — the reader is an injectable parameter; the test injects EACCES, EIO, EISDIR and ENOENT |
| 4 | The fixture file write looks load-bearing (low) | comment added in `05546ca67` (test-only, after both approvals): the file anchors the cascade, the reader decides each read |

Not taken: explicit object/array mode tests (both seats called them redundant
in round 3) and caching the settings read per process (one dispatch is one
process).

## What this record does not establish

The seat verdicts above are transcribed by the implementing session; the
council responses are gitignored and not committed. The prompts are committed,
so what was asked can be checked; what was answered rests on this transcription.
