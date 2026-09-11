<!-- evidence-type: analysis -->
# Stop-slot continuation census — `claude`, 2026-09-11

Every concern bound on `platforms.claude.stop`, with the two properties that
decide whether it can end a turn and the one property the tree does **not**
establish. Written for step 1.1 of
`agents/roadmaps/road-to-a-stop-slot-that-knows-it-continues.md`.

## Method, and which column is which kind of fact

| Column | Source | Kind |
|---|---|---|
| concern, severity, `skip_on_refusal_retry`, script | `src/scripts/hook_manifest.yaml` — the `stop` list at `:1324` and each concern's own block | **read off the manifest**, mechanical |
| header claim | first 260 lines of each concern's `script`, matched against `never blocks` / `never fails a turn` / `always returns 0` / `CAPTURE ONLY` | **read off the source**, mechanical |
| effect on the turn | — | **not established by this tree**, see below |

The fourth column has no source, and that absence is the finding. Nothing in
this repository records what the host does with an advisory verdict on `stop`.

## The fourteen

| # | Concern | Severity | `skip_on_refusal_retry` | Script | Header claim about its own effect |
|---|---|---|---|---|---|
| 1 | `chat-history` | advisory | no | `src/scripts/chat_history.ts` | none in the header; the manifest comment at `:53` says "Never blocks." |
| 2 | `verify-before-complete` | advisory | no | `src/scripts/before_complete_hook.ts` | `:25` — "itself never blocks — it is observability infra, not control flow" |
| 3 | `team-review-gate` | advisory | no | `src/scripts/team_review_gate_hook.ts` | `:43` — "Contract: never blocks, exit 0 on every path" |
| 4 | `end-review-nudge` | advisory | **yes** | `src/scripts/hooks/end_review_nudge_hook.ts` | `:219` — "CONTRACT: never blocks THE ACTUAL TURN", proved at `:180` entirely in exit codes |
| 5 | **`turn-end-gate`** | **blocking** | no | `src/scripts/hooks/turn_end_gate_hook.ts` | none — it is the one concern that refuses on purpose |
| 6 | `self-repair` | advisory | no | `src/scripts/self_repair_hook.ts` | none |
| 7 | `session-register` | advisory | no | `src/scripts/session_register_hook.ts` | `:899` — inline `// never blocks` |
| 8 | `session-eol` | advisory | no | `src/scripts/hooks/session_eol_hook.ts` | `:46` — "Never blocks: exit 0 on every path" |
| 9 | `interruption-ledger` | advisory | **yes** | `src/scripts/hooks/interruption_ledger_hook.ts` | `:4` — "CAPTURE ONLY … never emits context, never warns, and always returns 0" |
| 10 | `roadmap-progress` | advisory | no | `src/scripts/roadmap_progress_hook.ts` | none |
| 11 | `design-pass-stop` | advisory | no | `src/scripts/hooks/design_pass_hook.ts` | none |
| 12 | `suggestion-capture` | advisory | no | `src/scripts/hooks/suggestion_capture_hook.ts` | none |
| 13 | `journal-record` | advisory | no | `src/scripts/hooks/journal_record_hook.ts` | `:26` — "It never blocks and never fails a turn" |
| 14 | **`run-continuation`** | **blocking** | no | `src/scripts/hooks/run_continuation_hook.ts` | none |

Twelve advisory, two blocking. Every one carries `fail_closed: false`, stated
deliberately at `hook_manifest.yaml:975-979` for `turn-end-gate`: a crash in a
turn-end gate must let the turn end, because failing closed there wedges the
session rather than degrading it.

## What the census establishes, and what it does not

**Establishes.** Twelve of fourteen concerns on this slot deliver through one
path — `host_semantics.emitFor`'s `warn` branch at
`src/scripts/hooks/host_semantics.ts:253-258`, which returns exit 0 plus
`claudeAdditionalContext(event, reason)` unconditionally, with no `stop`-specific
branch. Six of the fourteen carry a header sentence asserting they never block,
and every one of those sentences is an argument about the **exit code**.

**Does not establish.** Whether `additionalContext` delivered at `Stop` /
`SubagentStop` causes the host to run the agent again. `docs/contracts/hook-architecture-v1.md:124`
describes exit 2 as three mechanical facts — exits 0, logs to stderr, sets the
field — and says nothing about the turn. A sweep of that document for `warn`
(`:108, 124, 172, 250, 272, 278, 320, 518, 522`) and for `additionalContext`
(`:110, 124, 253, 511`) finds no line ascribing a control-flow effect in either
direction.

Two consequences follow, and both are why this census exists rather than a
correction:

1. **"Never blocks" and "never extends" are different claims**, and only the
   first is proved anywhere in this tree. Six headers assert the first; none
   addresses the second.
2. **The absence is load-bearing on this slot specifically.** On a slot where a
   verdict reaches the model at the end of a turn, "no effect on control flow" is
   an assumption about the host, not a property of the dispatcher.

## The one primitive that would end a turn is unused

`grep -rn 'stopReason' src/scripts/hooks/` returns nothing; `continue: false`
appears nowhere in the hook layer. The only `stopReason` occurrences in `src/`
are five lines of an unrelated provider-replay module
(`src/scripts/ai_council/replay_route.ts:76, 91, 114, 144, 199`). So every stop
verdict this suite emits either lets the turn end by default or — if the
unestablished behaviour above holds — extends it. There is no verdict for *end
it now*, and whether that is a decision or an omission is recorded as blocker
`continue-false-precedence`.

## The retry turn has no instruments

`src/scripts/hooks/dispatch_hook.ts:419` drops every concern flagged
`skip_on_refusal_retry` on a refusal-retry turn. Exactly two carry it —
`end-review-nudge` (`hook_manifest.yaml:921`) and `interruption-ledger`
(`:1126`) — and both are on this slot, rows 4 and 9. Separately,
`src/scripts/hooks/turn_end_gate_hook.ts:1194` returns `EXIT_ALLOW` on
`stop_hook_active` before any detector runs, with no per-detector carve-out.
The manifest states the flag's rationale as **cost**, not correctness
(`:915-920`, `:1120-1125`), which was defensible while the slot was believed
inert.

The consequence is recorded rather than resolved here: the one turn in which a
pending decision can disappear is the one turn with no detectors and no ledger
line. Narrowing that guard is governed by
`docs/contracts/turn-end-detector-demotion.md` and stays with its owner, as
blocker `detector-e-under-stop-hook-active` in
`agents/roadmaps/road-to-a-question-that-survives-the-turn.md`.

## Reach

Only `claude` binds any of this. The `stop` slot on `augment`, `cowork`,
`cursor`, `cline` and `gemini` carries six concerns (`chat-history`,
`verify-before-complete`, `self-repair`, `session-register`, `roadmap-progress`,
`design-pass-stop`), `windsurf` five, and `copilot` is `fallback_only: true` and
binds nothing. `turn-end-gate`, `end-review-nudge`, `interruption-ledger` and
`run-continuation` appear on no other platform's `stop` list.
