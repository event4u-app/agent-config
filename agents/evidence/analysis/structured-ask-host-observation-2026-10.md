<!-- evidence-type: analysis -->
<!-- analyzed: 2026-10-05 | commit: 92027a20c | files: 1257 -->
<!-- The two header fields answer different questions and the pairing reads as
     one scope if that is not said: `commit` is the tree this analysis was
     written against; `files` is the size of the corpus it measured, which is
     the host's transcript store across every project directory and is not in
     this repository at all. -->


# Structured-ask capability — the first observed `true` row

[`structured-ask-host-observation-2026-09.md`](structured-ask-host-observation-2026-09.md)
recorded `structured_ask: false` for `claude` and said in its own closing
section what would overturn it: "A later session that observes a picker writes
the `true` row over this one, with its own four-part citation." This is that
citation.

The observation is written under
[`host-capability-manifest.md` § Observation protocol](../../../src/agent-src/contexts/execution/host-capability-manifest.md),
whose criterion for this field is the host's **delivered tool surface in a real
session** — never a vendor's documentation, and never another host by analogy.

## The observation

| Part | Value |
|---|---|
| Host | `claude` (Claude Code) |
| Host version | 2.1.284 at the most recent call; the full observed range is 2.1.252, 2.1.268, 2.1.269, 2.1.270, 2.1.277, 2.1.284 |
| Transcript reference | session `88f1e86b-6d49-4c4a-aefe-f43a8b3aee09`, `tool_use` block `605548de-5b27-43d0-8de2-cc9e3e08a368` — the most recent of **48** such blocks |
| Date | 2026-10-02 (most recent); earliest observed call 2026-09-01 |
| Result | **`structured_ask: true` — observed present** |

The delivered surface carried a tool named `AskUserQuestion`, which matches
`STRUCTURED_ASK_TOOL_NAME_RE` in `src/scripts/_lib/structured_ask.ts`. It was
not merely offered: it was **called**, 48 times, and 47 of those calls returned
a non-error `tool_result`. A delivered-and-exercised tool is a strictly stronger
observation than a delivered one, because the host's acceptance of the payload
is itself in the transcript.

## Why the 2026-09 row read `false`, and why both readings are honest

The September row is not refuted as a reading. It is refuted as a statement
about the host, and the difference is the whole finding.

That artefact lists the surface it saw: `Agent`, `Artifact`, `Bash`, `Edit`,
`Read`, `Skill`, `ToolSearch`, `Write`, plus a deferred set (`EnterWorktree`,
`ExitWorktree`, `Monitor`, `NotebookEdit`, `SendMessage`, `TaskStop`,
`WebFetch`, `WebSearch`). That is a **subagent's** delivered surface. A subagent
on this host does not receive the question picker, because a subagent has no
user to ask. The main session does.

So the September session observed, correctly, that *its own* surface carried no
picker — and the inference from there to "no host's delivered surface has been
observed carrying a picker" crossed a boundary the protocol does not license.
The 2026-09-01 call recorded here is on version **2.1.252**, six days and eleven
patch versions *before* the 2026-09-07 `false` reading on 2.1.263: the picker
was already being delivered and called while the row saying it was absent was
being written.

The lesson that generalises past this field: **which leg of a session the
surface was read from is part of the observation**, and an artefact that does
not say so invites exactly this substitution. The rows below record it.

## The shape, and which numbers are ceilings

`StructuredAskShape` asks for four fields. Two are observed facts about the
payloads, and two are **observed maxima over 48 calls, not host ceilings** —
stated as such so a later reader does not promote a sample maximum into a limit
the host was never asked for.

**Two different 47s appear below and they are not the same 47.** The question
and option figures are over the **47 calls whose payload parsed** (48 minus the
one `__unparsedToolInput`); `free_text` is over the **47 `tool_result` payloads
that were not errors** (48 minus the one `is_error`). Whether those two
exclusions fall on the same call is not established here, so the two
denominators coincide in size by arithmetic and are not asserted to coincide in
membership.

| Field | Value | Basis |
|---|---|---|
| `tool` | `AskUserQuestion` | the only name seen; 48/48 calls |
| `max_questions` | `1` | **observed maximum.** 47 calls carried exactly one question; 1 call carried an unparsed payload (`__unparsedToolInput`) and no question array. No call carried two, so the host was never asked to accept two and its ceiling is unmeasured. `1` is also the shape this repo wants — `ask-when-uncertain`'s one-question Iron Law — so the guard's threshold does not depend on this number being the host's limit |
| `max_options_per_question` | `4` | **observed maximum.** Distribution over 47 questions: 4 with 2 options, 34 with 3, 9 with 4 |
| `free_text` | `true` | 10 of the 47 non-error `tool_result` payloads carried an answer containing **none** of the labels that call offered, at lengths from 291 to 4361 characters. **Derived by negation, which is weaker than the three above and is flagged rather than smoothed over:** a cancelled or interrupted ask also produces a payload carrying no label, so the 10 is an upper bound on free-text answers, not a count of them. What makes `true` the honest value anyway is the lengths — a cancellation does not produce 4361 characters. A reader wanting the stronger form should pin one payload to a user utterance |

Payload keys seen, for anyone extending the shape later: the call carries
`questions`; each question carries `question`, `header`, `multiSelect`,
`options`; each option carries `label`, `description`, `preview`. `multiSelect`
is part of the schema and was `true` in **0** of 47 observed questions — present
but never exercised, which is "never looked" for that sub-field, not "absent".

## Method, and the control that makes the count a measurement

The corpus is every `.jsonl` under the host's transcript store — **1257 files**
across every project directory, not only this repository's. Matching is on
`type: "tool_use"` with a `name` matching `STRUCTURED_ASK_TOOL_NAME_RE`, parsed
per line as JSON, so a tool *name mentioned in prose* or echoed inside a
system-reminder blob cannot be counted as a call.

**The detector was proved to work before its output was believed.**
`./scripts-run src/scripts/probe_unblocked_ask --self-test` passes 7/7 including
the two positive cases `form of [AskUserQuestion] — native` and
`form of [ask_user_question] — native`, so the shared matcher
(`isStructuredAskTool`) recognises the name this corpus carries.

## Why `probe_unblocked_ask` still reports `native: 0`, and why that is not a contradiction

Run against the main store at the same time as this observation:

```
probe_unblocked_ask · 400 most recent session(s)
  hand-back turns          307
  …unblocked asks          3
  form: text               3
  form: native             0
```

Both numbers are right because they measure different things. That probe
partitions **hand-back ask turns** — an assistant turn immediately followed by a
user turn that hands a decision in prose. An `AskUserQuestion` call is answered
by a `tool_result`, not by a free user turn, so it is not a hand-back and was
never in that probe's denominator. Its zero says "no prose hand-back used a
picker instead", which stays true; it never said "no picker exists".

`structured_ask.ts`'s module header predicted `native` would be 0 "on every
corpus this repo can scan today" and attributed that to the capability being
unobserved. The prediction held and its stated reason did not. The header is
corrected in the same change.

## What this row does and does not claim

It claims that on `claude`, across six versions from 2.1.252 to 2.1.284, in
real main-session legs, the agent had a structured-ask tool to call and called
it. It is a statement about the main session's delivered surface.

It does **not** claim that a subagent leg on this host receives the picker — the
September artefact is the evidence that it does not, and that reading stands
unchanged for the leg it measured. It does not claim anything about the eight
other hosts in `docs/enforcement-by-host.md`, which still carry no row at all
and remain "never looked".

## Blast radius of the boolean flip, enumerated rather than assumed

An R2 reviewer asked which consumers of `manifest.structured_ask` the
`false → true` flip reaches, and could not answer it under a branch-scoped tool
allowlist. Answered here, repository-wide:

```
grep -rn "\.structured_ask\|structured_ask:" src/ --include='*.ts' \
  | grep -v "_lib/host_capability.ts\|_lib/structured_ask.ts"
```

**Zero hits.** No production code outside `host_capability.ts` itself branches
on the boolean; the field's remaining readers are its own normalizer, the
registry, the tests that pin the row, and prose. So the flip changes the value
an unwritten consumer would read and changes no behaviour that exists today.
The field doc frames `false` as what keeps the agent from firing a call into a
host with no tool — that guard is still correct, and it now reports a host that
does have one.

The reviewer's second unresolvable risk is answered the same way: whether the
guard is dead on `claude` because the per-concern `tools:` filter omits the
observed name. It does not —
`grep -n AskUserQuestion src/scripts/hook_manifest.yaml` returns one line, and
`AskUserQuestion` is first in that list.

## Consequence

`STRUCTURED_ASK_SHAPES` is no longer empty, so `isStructuredAskTool(name,
'claude')` now matches the observed tool name exactly instead of falling back to
the name-shape pattern, and `one_question_per_ask_hook` on this host is a guard
over a tool that demonstrably exists rather than one held in reserve. Its deny
threshold is unchanged: the rule was always one question per call, and every
observed call already carried one (47 of 48 — the 48th payload was unparsable, so its question count is unknown rather than one).
