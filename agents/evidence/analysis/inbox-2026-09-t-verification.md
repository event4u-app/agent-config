<!-- evidence-type: analysis -->
# Inbox round 2026-09-t — verification and disposition

> Analysed 2026-09-06 against `main@d949ef374`. One topic folder, 5 files, 4,130
> lines: the owner prompt, two proposals from two parallel sessions, and two
> consolidated masters. The proposals pin `10c24a4`, 25 commits behind HEAD;
> `git diff --stat` over the eight continuity implementation files between the
> two pins is **empty**, so the pin delta costs their factual base nothing.
>
> The owner's question was not "what should we build" but "should all three of
> these exist". Both sessions answered **subtraction**, and the leading master
> makes a lower surface count its success measure. That is the right shape, and
> most of what did not survive is the machinery each proposal wanted to add on
> the way there.

## Triage

| file | genre | age | drafted-against | recurrence | lineage | disposition |
|---|---|---|---|---|---|---|
| owner prompt (360) | transcript | same day | unstated | the four questions are the ask | n/a | read; two chat URLs stay in the gitignored tree |
| roadmap (1,729) | external-review | same day | `10c24a4`, real, 25 behind | continuity: 28 rounds | n/a | deep-read, delegated |
| deep-final (1,503) | external-review | same day | `10c24a4` | same | n/a | deep-read, delegated |
| master (221) | external-review (consolidated) | same day | `10c24a4` | same | complete — both parents declared and present | verified here |
| master parent (317) | external-review | same day | `10c24a4` | same | is one of the declared parents | confirmed as parent |

`lint_consolidation_lineage`: 3 roadmap files, **no findings**. The first round
of four whose consolidation lineage is clean on the first pass.

## What did not survive

| claim | verdict | evidence |
|---|---|---|
| envelope and handoff model the same semantics twice — the central thesis | **never-true as stated** | Three different things are called envelope: `OutcomeEnvelope` (`outcome_envelope.ts:88-121`, a run terminal outcome, seven fields, no session/repo/task field), `MainSessionRecycleEnvelope` (`subagent_capsule.ts:283-350`) and `WorkerCapsule` (`:69-92`). Field-by-field the session envelope and the handoff overlap on **5 of ~18 axes**, and on each of the five the provenance is opposite — one is model-authored and schema-validated, the other regex-derived from a transcript. Two collection methods with some shared output fields, not one semantics modelled twice. |
| `capsule` is a new word to avoid | **never-true** | It is the shipped discriminator: `CAPSULE_SCHEMA_VERSION = 3` (`subagent_capsule.ts:112`), `CAPSULE_VARIANTS = ['worker','main_session']` (`:115`). |
| `PreCompact` is "a key missing opportunity" | **never-true** | Bound on claude: `pre_compact: [language-mirror, hot-context, rule-inject, journal-record]`. `hot-context` writes there deliberately. The accurate residue is narrow — no *continuity record* is flushed there. |
| `--file` is a handoff CLI flag to remove | **never-true** | `cmd_handoff.ts:43,56` lists `--list --json --session --print --launch --llm --root`; a grep for `'--file'` on that file returns 0. It exists only at the slash-command layer. |
| the handoff already carries `Failed approaches` and `Feedback history` | **never-true** | The generator emits exactly seven sections (`handoff_generate.ts:385-392`); neither is among them. |
| `journal.sqlite` in the common dir is the proposed long-term authority | **never-true as a proposal** | It is the shipped, normatively-described path (`runtime_journal.ts:31,618-619`). Proposed as future, already present. |
| a host with compaction hooks carries the architecture | **never-true for this tree** | That host is not among the nine platforms in `hook_manifest.yaml`; it appears only as a `handoff --launch` target, explicitly with no hook surface. |
| drift detection, consume-once, 48-hour staleness, data-never-instruction wrapping, PreCompact flush must be built | **already-fixed**, five times over | `envelope_grounding.ts:74-89,220`; `handoff_context_hook.ts:8-15,52`; `ENVELOPE_BOUNDARY_OPEN/CLOSE` + `wrapAsPriorSessionData` + `scanEnvelopeDirectives` (`subagent_capsule.ts:482-486`); `hot_context_hook.ts:460-472`. |
| `session_id` / `repository_id` / `worktree_id` / `episode_id` must be added | **already-fixed** in the journal (`runtime_journal.ts:653-654,667,967,973`); absent only on the capsule. |

Eight never-true and eleven already-fixed. The pattern is one shape: both
proposals inventory the tree carefully — all twenty anchor paths in one of them
exist, and its envelope field list is correct field for field — and then plan
work whose premise the same tree already refutes.

## The lock this round had to find

`agents/settings/contexts/continuation-protocol-and-runtime-graph.md:9-31`
records an answer to a near-identical earlier proposal: **one schema,
variant-discriminated, no new format**, with the rule that a version "may add
fields or variants, never repurpose or remove one", and a falsifiable reopen
condition — a consumer whose required fields *contradict* an existing variant.

The larger proposal asks for `SessionContinuityCapsuleV1`, a second schema. It
does not meet the reopen condition; it extends. So the legal path is a `variant`
and a version bump, and the roadmap this round wrote says so and cites the lock.
Neither proposal names the record.

## What survived, reproduced here

| defect | reproduction at `d949ef374` |
|---|---|
| **one path, no session key** | `RECYCLE_ENVELOPE_REL` is exactly `agents/runtime/state/recycle-envelope.json` (`recycle_envelope_paths.ts:11`); `HOT_CONTEXT_REL` is one file "OVERWRITTEN on every `stop`", `loss_class: ephemeral-lossy`. `session_register_hook.ts:5` writes "this session into a register shared by every worktree" — the register models concurrent sessions; the two artifacts model one. |
| **the schema records failure, not success** | 24 keys including `failed_approaches`; `grep -rn "successful_approaches\|what_worked\|worked_well" src/` returns **0**. Of the owner's four questions, exactly one has no carrier. |
| **no lineage** | `grep -rn "predecessor_session\|lineage_id" src/` returns **0**. The reader injects what is lying there, not what the right predecessor would be. |
| **`open_questions` has no field on the session variant** | `open_risks` exists on the worker variant (`subagent_capsule.ts:81`); on the session side it is prose in a template. |
| **orphan artifact** | `HANDOFF.md` appears in three files, with no producer and no consumer in code. |
| **a verb with no subcommand** | `chat-history:checkpoint` is absent from `SUBCMDS` (`chat_history.ts:1825-1838`); the verb is a shell wrapper. |
| **the sediment** | seven runtime artifacts, four hook concerns, three slash commands, four CLI verbs, and **twelve archived roadmaps** on this subject against **zero** active, later or stub owners. Each layer had its epoch; none retired the one before it. |

## The reach inversion — why the elegant architecture is the wrong base

`journal-record` and `session-eol` bind on **claude alone**. `hot-context`
appears in fifteen slot lists and `handoff-context` in seven, across seven
platforms. `user_prompt_submit` is unbound on one host, one host has neither
`session_end` nor `post_tool_use`, one is `fallback_only` with no hooks at all,
and one binds but discards hook stdout by construction, which makes every
context-delivering concern inert there.

So "no command is needed" is a one-host promise stated as a platform-neutral
architecture, and moving continuity into the journal would switch it off on six
hosts to gain it on one. The automation half of the owner's question has a real
ceiling, and the ceiling is the host, not the design.

One more barrier is written in the code rather than inferred:
`session_eol_hook.ts:16-18` records that "hooks cannot inject `/clear`, so the
recycle action itself stays advisory-carried by design". Writing a record is
automatable; clearing the session is not.

## A stub already holds the measurement half

`agents/roadmaps/stubs/road-to-compaction-survival-census.md` — added
**2026-08-20**, so **17 days** old at this round. The hold is recorded outside
any `### blocker:` section, in its own opening note: it was transferred out of
its parent because the work "requires live host behaviour" that repository work
cannot manufacture. Recurrence for this subject: **28** rounds.

Both proposals' shadow-evaluation and predecessor-resolution phases presuppose
exactly that measurement, so they run into a wall a council already recorded.
The roadmap this round wrote does not schedule it.

## The point ledger

```
claims         62 extracted → 40 still-true / 11 already-fixed / 8 never-true / 3 unverifiable
instructions    7 selected  →  5 reproduced /  2 diverged / 0 unexecutable / 0 out-of-bound
                              rest not-attempted (selection)
demands        12 extracted →  4 adopted / 3 already-satisfied / 3 declined / 2 owner-decision
```

**The two divergences are both about the tree being further along than claimed.**
"No producer runs where context dies" — the slots are bound, by `hot-context`,
`journal-record`, `chat-history` and others; what is absent is a continuity
record, not a producer. And a cited line number for the stale `HANDOFF.md`
reference does not carry it; the collision is real and the citation is off. Both
corrections are carried in the roadmap and tagged.

**The three declines.** Journal-as-authority is declined on reach, not taste — it
binds on one host and would remove continuity from six. A second schema is
declined by the recorded lock, which permits the same content as a variant. And
the thirteen-phase shape is declined because its measurement half is already
stubbed as not producible from a checkout; four phases carry what remains.

## The owner decision, taken

**Answered 2026-09-06: option 1, the full retirement set** — `HANDOFF.md`,
`hot-context.md`, the `hot-context` and `session-eol` concerns,
`session:recycle`, `/chat-history` and `/chat-history import`. The stated ground
was that option 2 halves the effect and leaves standing exactly the commands
named as bloat, and option 3 makes this roadmap the thirteenth layer that
removes nothing. `handoff` and `/agent-handoff` survive as the one verb and the
one command; `chat-history` **capture** survives as input substrate.

Three things came back with the decision and are now in the roadmap.

**The end state is numbers, not a sentence.** "One continuity surface exists" is
satisfiable by a tree that carries one record and still leaves four competing
mental models standing, so the goal now reads `public continuity commands: 0 ·
session resume pickers: 0 · persistent continuity artefacts: 1 · continuity
schemas: 1 · normal-path manual actions: 0`, and Phase 4.2 ratchets them. Hook
concerns are deliberately absent from that list: multi-host adapters may make
one physical concern impractical, and what must be singular is the semantic
writer/reader contract rather than the file count.

**Chat history narrows without being retired.** It stays as the only cross-host
transcript source and stops being a recovery path: input and evidence, never
continuity. `/chat-history import` goes as a *resume mechanism* while the
capture substrate remains — a distinction neither proposal drew.

**A rule the ratchet encodes rather than a count it enforces.** A new continuity
mechanism may be introduced only if it replaces an existing one, or demonstrably
covers a capability the one record cannot. Without it the tree grows
`continuity-v2`, `resume-state`, `smart-handoff` and `session-memory-cache` side
by side within six months — which is precisely what the twelve archived roadmaps
already did once.

## Three corrections this round accepted back

The review returned three fixes to figures this round or its sources carried,
each verified here before it entered the text:

| correction | evidence |
|---|---|
| the schema bump is to **4**, not 3 | `CAPSULE_SCHEMA_VERSION = 3` (`subagent_capsule.ts:112`) — the roadmap now names the target number instead of saying "bump" |
| the stale `lint_handoffs` attribution sits at **`:181`**, not `:180` | read at `src/domains/meta/agent-handoff/command.md:181`; the defect itself is unchanged |
| `hot-context` writes at all three context-ending slots in one branch | `hot_context_hook.ts:472` — `stop`, `session_end` **and** `pre_compact`; this sharpens the round's own correction from "the slots are bound" to naming the line |

## Four review findings, triaged

The critical finding — that Phase 3.2 injects prior-session state with no data
wrapper — is a **false positive in substance and a real gap in wording**. The
step always said the shipped guards are reused; it did not name them, so a
reader checking the step could not see which. It now names
`wrapAsPriorSessionData` and `hasBoundaryMarker` (`handoff_context_hook.ts:70-84`,
constants at `subagent_capsule.ts:482-486`), `scanEnvelopeDirectives`, the
48-hour bound and the consume-once move, and its verify requires the existing
refusal fixture to still pass and to be extended to the new record shape.

The two high findings are closed the same way — by making the step say what it
meant. A first session has no predecessor, so it writes `predecessor: none`, a
stated absence rather than an empty field. And the write race exists only if a
shared `latest` index is introduced, which Phase 2.1 now forbids in its own
words: resolution is by register identity, workspace and branch, never by an
index.

Two verify lines were pulled into Phase 3 rather than becoming a phase of their
own: the reader behaves by `session_start` source (`compact` re-injects the
session's *own* record, `resume` and `fork` inject nothing, an unrecognised
source injects nothing rather than guessing), and
`continuity_written_per_substantive_session` is a counter in the concern's own
state, never a file-presence check.

One addition of this round's own is kept and named: `run_checkpoint` is **not**
on the retirement list and is not retired blind — it is kept only if it carries
semantics the record does not, and Phase 4.1 requires that question to be
answered in writing before it is touched either way.
