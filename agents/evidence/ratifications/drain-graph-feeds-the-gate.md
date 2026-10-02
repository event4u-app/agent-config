---
proposed_by: claude-opus-5/drain-graph-feeds-the-gate-2026-10-01
implemented_by: claude-opus-5/drain-graph-feeds-the-gate-2026-10-01
reviewed_by: council/anthropic+openai-2026-10-01
providers:
  - anthropic
  - openai
verdict: ratified
effective_after: merge
---

<!-- evidence-type: ratification -->

# Ratification — routing the shell tool to the code-graph context concern

Covers one block in `src/scripts/hook_manifest.yaml`: the `code-graph-context`
concern's per-concern tool filter moves from `[Grep, Glob, Read]` to
`[Grep, Glob, Read, Bash]`, with its comment updated to name the fourth branch
and the host-naming caveat. Nothing else on a gated surface changed — no concern
added or removed, no `fail_closed`, no `severity`, no `script`, no event binding,
no ordering.

## Why the verdict is `ratified` and not `confirmed-non-expanding`

```
THE TWO SEATS SPLIT ON THE LABEL AND AGREED ON LANDING IT.
THE STRONGER LABEL IS RECORDED, BECAUSE ONE SEAT ARGUED IN SUBSTANCE
THAT TRIGGER REACH *IS* PART OF A CAPABILITY BOUNDARY — AND THE
CONTRACT SAYS A MISLABELLED EXPANSION IS REVIEW ERROR, NOT AN OPTION.
```

`anthropic` returned `confirmed-non-expanding`; `openai` returned `ratified`,
opening with *"this is a small, acceptable expansion and should be ratified — not
classified as non-expanding"*. Both approve the change; the disagreement is
entirely about which passing label is honest. The implementer records the one a
reviewer explicitly asked for rather than the one more favourable to the
implementer, which is the only direction this choice may fall in a document the
implementer writes about their own diff.

## What the council decided

Council 2026-10-01, seats `anthropic` and `openai`, 2 rounds with blind peer
review, subscription transport, $0.0000 spent, 2/2 present and concluded.

**Where they agreed.** The concern cannot block, deny or mutate: it is
`severity: advisory`, `fail_closed: false`, and its output is lowered to the
host's structured context envelope at exit 0 or swallowed entirely. Adding the
shell tool grants no permission to execute the inspected command — the concern
reads `tool_input.command`, classifies the head, and emits one line. The `tools:`
key is an in-process dispatcher filter, not a host matcher, so the dispatcher was
already invoked for the event. Missing a host-specific shell alias (`BashTool`,
`launch-process`) reduces coverage rather than disabling a guard, which is the
distinction the manifest's own comment already draws between advisory concerns
and the four blocking guards that deliberately declare no filter.

**Where they disagreed, and it is the load-bearing half.** `openai` held that
defining authority as only execute/block/mutate is *"too brittle for a
constitutional rule intended to prevent self-ratified power growth"*, and that
the change widens two things that count: the concern now receives and classifies
shell-command input it previously did not receive, and its emitted context can
influence agent behaviour during an additional class of tool call. Its words:
*"'Same code, more trigger points' does not imply 'same effective power'; trigger
scope is part of a component's capability boundary."*

`anthropic`'s counter, which is the strongest argument on the other side and is
recorded rather than dropped: authority is what a component *can* do, not how
often it does it, and `needs_payload_bodies: [input]` means the concern never
sees command OUTPUT, so it cannot chain observations or build a picture of system
state. It also noted that the accompanying latch change TIGHTENS the concern —
once per distinct target with a five-line session cap, where it previously spoke
once per session.

**What the blind peer round caught, and it was right.** Both reviewers flagged
that `openai` treated a `git status` probe as pivotal evidence while describing
it as *"apparently"* performing host-side activity — an unverified premise used
as a settled one. The probe is real: step 2.3 of the same change adds
`git status --porcelain` to the staleness read. It is stated here as fact rather
than left as the reviewer's hedge.

## The conditions `openai` attached, and what was done about each

| Condition | Disposition |
|---|---|
| *"Verify that command text is neither persisted nor included in diagnostics."* | **Found a real gap and closed it in this change.** The latch persisted the search TERM — a term that can carry a customer name, a token fragment or an internal hostname. It now persists a truncated SHA-256 digest (`latchKey`), which answers "have I spoken about this one" exactly as well because nothing reads it back. A test writes a sensitive-looking term and asserts the plaintext is absent from the file. Not claimed as a security boundary: a short digest of a short term is guessable by anyone who can enumerate terms. It is PII-exclusion by construction — the plaintext is not there to leak. The emitted line never carried the command and still does not. |
| *"Bound or cache the `git status` probe independently of the message-rate cap; limiting output does not necessarily limit work."* | **Already bound, and the binding is the same latch rather than a second one.** `wouldSpeak` is checked BEFORE `graphState`, and it is false for a repeat and past the cap — so the probe runs at most once per distinct target and at most five times per session, which is a bound on WORK and not only on output. Stated rather than assumed, because the reviewer's objection is exactly that the two can come apart. |
| *"Test unverified-host swallowing, the five-line session limit, deduplication by search target, and non-matching shell aliases."* | Covered: the unverified-host case asserts a `windsurf` emission produces empty stdout at its legacy exit; the cap and the dedup are the step's own fixture (three distinct patterns, a repeat, a sixth); non-matching commands assert `bashSearchToken` returns null for `ls`, `npm test`, `git log` and the empty string, which is also the no-latch path. |
| *"Document that trigger-set widening counts as expansion when it exposes a concern to a new payload category or creates new host activity."* | Recorded here, as the reason this artifact says `ratified`. Not written into a contract by this change — a rule about how future reviewers must classify is a governance edit of its own and would need its own ratification. Named as deliberately deferred rather than silently dropped. |

A second-round reviewer added that broad shell-input visibility *"can expose
secrets, paths, credentials, and operational intent absent from Read, Glob, or
Grep calls."* That is the same concern as the first condition and is why the
digest change landed rather than being argued away.

## What this record does NOT establish

That the reviewer was independent in the platform sense. It was not: the seats
are models the implementing session invoked, and their verdicts are quoted
process evidence, never authentication. The standing qualification from this
repository's earlier ratifications applies unchanged — a committed record is
evidence, not proof that anyone decided. The authorising event is a human's
review and merge of this change.

It also does not establish that the host-naming caveat is harmless. On a host
that calls its shell tool anything but `Bash`, this concern will not route, and
nothing in this change detects that. It is a missed advisory line, which is the
trade the manifest already refuses for a security guard and accepts for a
context line — stated so a later reader does not have to re-derive it.

## Not ratified by this record

- **No change to any blocking guard.** The four blocking PreToolUse guards still
  declare no `tools:` filter and are untouched.
- **No change to `fail_closed`, `severity` or the dispatcher.** The filter's
  semantics are the dispatcher's and were not edited.
- **Nothing about step 3.2's turn-end feeder**, which touches
  `src/scripts/hooks/turn_end_gate_hook.ts` and writes a local record. That file
  is not on the gated-surface list and this artifact makes no claim about it.
