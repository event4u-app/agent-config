---
proposed_by: claude-opus-5/drain-failed-command-recorder-20261001
implemented_by: claude-opus-5/drain-failed-command-recorder-20261001
reviewed_by: council/anthropic+openai-2026-10-01-failed-command-recorder-ratification
providers:
  - anthropic
  - openai
verdict: ratified
effective_after: merge
---

<!-- evidence-type: ratification -->

# Ratification — binding `PostToolUseFailure` on claude

`check_kernel_edit_ratified` fires on this branch because the diff edits
`src/scripts/hook_manifest.yaml`, which sits on its `PLUMBING_SOURCE_RE` list.
No other gated surface is touched: no kernel rule, no `block_*` governance hook,
no budget file, and not the ratification mechanism itself.

## What was proposed

A verification command that FAILED on Claude Code left no run record at all — not
rarely, never. An observed probe (three one-shot sessions, claude 2.1.286,
2026-10-01) established that a failing `Bash` call fires `PostToolUseFailure`, a
passing one fires `PostToolUse`, and each call fires exactly one of the two. That
native event was bound nowhere in the tree, so the recorder never ran on a red
command and `verification_runs` could only ever contain passes.

Five parts:

1. One row in `native_event_aliases.claude` lowering `PostToolUseFailure` onto
   the EXISTING canonical slot `post_tool_use`. No canonical event is added and
   no concern list changes membership. claude-only.
2. `build_claude_hook_matrix` iterates the alias map instead of inverting it.
   The inversion kept one native per canonical event, so the new row would
   otherwise have UNBOUND `PostToolUse`.
3. The recorder reads the failure envelope's own fields — `error`
   (`Exit code N`, no `Error:` prefix) and `is_interrupt` — and records
   `platform` on the witness.
4. A read-only per-host instrument-gap reporter, two evidence files, and the
   regenerated `hooks/hooks.json`, `hook_manifest.json` and
   `dist/install/install.mjs`.
5. Everything in § What the review changed, which is most of the risk.

## Why `ratified` rather than `confirmed-non-expanding`

The final round's passing verdict named the distinction and it is worth keeping
in the reviewer's terms:

> "The change repairs the verification instrument without expanding its decision
> authority. However, the proposal explicitly says that 'sixteen concerns now run
> on an event they were not written for', so the observable execution surface has
> expanded. Under the supplied verdict definitions, calling that non-expanding
> would be inaccurate."

Three earlier rounds returned `confirmed-non-expanding`. That label was available
and is not taken. No *decision* authority is added — every concern on the slot is
`severity: advisory` and `fail_closed: false`, which is now asserted by a test
rather than argued — but the set of events sixteen concerns execute on is larger
than it was, and `confirmed-non-expanding` is a classification whose misuse the
contract names as review error. The conservative label is the honest one.

## The review did not converge, and the shape of that matters

Four council passes, two providers, 2/2 present in the first and the last:

| Pass | anthropic | openai |
|---|---|---|
| 1 | `confirmed-non-expanding` | `non-convergent` |
| 2 | `confirmed-non-expanding` | absent (`os_error: ENOBUFS`) |
| 2b | `confirmed-non-expanding` | `non-convergent` |
| 3 | `non-convergent` | `ratified` |

**The seats swapped sides in the last pass**, which is the single most useful
thing this record can report: the dissenting position moved between providers
while the arguments stayed put, so the split tracks the critic seat rather than a
stable finding about the diff. Both providers have, in some pass, returned a
passing verdict; neither ever returned `refused`.

Every `non-convergent` was explicitly bounded — both times by the reviewer saying
it could not reach the branch — and each named requirements rather than
objections. All of the requirements that named an observable were met; the three
that remain are named below rather than treated as satisfied.

## What the review changed — the part that justifies four passes

Three defects were found by the review, two of them by writing the test a
reviewer demanded and would not have been found otherwise.

**1. A pass could be read out of a failure event.** A reviewer asked what happens
when a command's error text begins `Exit code 0`. It recorded a pass — on an
event the host had already named a failure, from a string the command controls,
manufacturing the strongest possible evidence that a red run was green. The
host's event name is now authoritative over its text: on a failure event a zero
is discarded from all three readings and `null` is recorded, which the classifier
treats as an instrument gap and never as a pass. A real non-zero is untouched.

**2. `error` was on neither payload-body list.** The dispatcher withholds tool
bodies from concerns that did not declare them. `error` carries the failing
command's stdout and stderr, and was unclassified — so the binding delivered raw
command output IN FULL to all sixteen concerns, including the fourteen that never
declared `result`. That is exactly the content the stub mechanism exists to
withhold. `error` is now a `result` body.

**3. `injection-scan` did not read `error`.** It scans a fixed key list, so a
failing `curl` of a hostile page would have reached the model with nothing
scanned — the direction where command output is most likely to be attacker-shaped.
Caught by that concern's own pre-existing coverage test, which pins its key list
as a superset of what the dispatcher serves, the moment defect 2 was fixed.

Two further requirements were met with evidence: the dispatcher-continuation test
(a crashing concern placed ahead of the recorder on the slot, asserting the record
still lands), and the explicit failure-event name set replacing a suffix-only
test.

## What is NOT done, stated rather than smoothed over

- **Cowork is not probed**, and the tree now contains two policies for an
  unmeasured host: this row is claude-only on measured-hosts-only grounds, while
  the neighbouring cowork block duplicates claude's aliases on the reasoning that
  an alias costs nothing if the host never sends the event. Reviewers called
  measured-hosts-only the better policy and the inconsistency non-blocking. A
  tree-wide policy statement is owed and is not in this diff.
- **The suffix fallback is kept** behind the explicit name set. One reviewer
  called it an unbounded acceptance surface. It is retained on an asymmetry
  argument: for an unobserved host a false positive costs a refusal to record a
  zero, a false negative costs a manufactured pass on a red run.
- **Selective routing within the slot** — binding the failure event to only the
  concerns that need it — was raised in the last pass and is not implemented. It
  would be a smaller execution surface and a larger mechanism; no per-concern
  event filter exists today.

## One claim a reviewer made that the code contradicts

The last pass argued that if both events ever fired for one call the witness
would hold contradictory records, because "event name wins over exit code" would
record the `PostToolUse` arrival as a pass. It does not: the seal only ever
REMOVES a zero on a failure event and never forces one on a success event, so a
`PostToolUse` carrying `exit_code: 2` records 2. Both directions are pinned by
test. The duplicate-record concern underneath it is real and is Risk 2 of the
originating roadmap; the probe measured one event per call across three sessions
and the end-to-end run produced exactly one record.

## Independence

Council, two distinct providers (anthropic, openai), meeting
`required_providers: 2`. Both seats subscription-authed; spend $0.0000. The
prompts stated no expected outcome, offered all four verdicts symmetrically, and
put the author's own strongest arguments AGAINST the change in front of the seats
before either spoke — six in the first pass, including the one about sixteen
unanalysed concerns that the final verdict turned on.

The observable evidence that the framing did not steer is that the reviewers
changed the diff four times after speaking, and that two of those changes were
defects neither the author nor the first three passes had seen — found only
because a reviewer refused an argument and demanded a test instead.

Per the ratification-artifact contract § Honest enforcement: this artifact records
who decided and on what basis. It is not proof that they decided, and the trust
anchor is the base revision plus the platform, never these strings. The council
questions are reproduced in the pull-request body, because
`evaluator-independence` requires the prompt to ship with the verdict and
`agents/runtime/council/` is gitignored and auto-pruned, so a link there would
resolve for nobody. The seats' responses are quoted where they carry the argument;
their full text is not reproduced, and this sentence says so rather than implying
a completeness the artifact does not have.
