---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
owner: maintainer
relates:
  - slug: road-to-a-question-that-survives-the-turn
    relation: extends
    note: >
      That roadmap shipped the `pending-decision` detector and the
      `review-baseline` concern, and parked three blockers. This one corrects a
      false premise in one of those blockers, closes a second inertness path the
      detector inherited, and states in the contract what the stop slot actually
      does. It changes no detector logic and adds no concern.
  - slug: road-to-residual-interruption-measurement
    relation: disjoint
    note: >
      That parked roadmap owns the wall-clock axis of the interruption
      measurement, which is genuinely still underpowered. This one only corrects
      its contact-axis reading, which was taken in a checkout whose gitignored
      runtime state was empty. Neither waits on the other.
estate_growth_exempt: "Grows active_roadmaps by one and open_blockers by two while resolving one, for a net of +1 on each. The two new blockers are each a decision this round could not take for itself: whether an advisory `warn` on `stop` extends the turn on the live host, which only a recorded session can answer and which the predecessor roadmap already needs for its own open blocker; and whether the dispatcher gains a `continue: false` precedence rule, which is an architecture decision about verdict ordering across every concern on every event. Recording them is the alternative to writing a contract line this tree cannot verify and to letting one concern emit a turn-ending primitive with no stated precedence. The resolved blocker is `user-interaction-third-iron-law`, parked on the premise that the file is a kernel rule; `src/scripts/_lib/kernel_rules.ts:17-27` lists nine ids and `user-interaction` is not among them, so the amendment it waited for is writable and ships in Phase 4."
estate_offset_exempt: "Offsets nothing, and the one candidate is held by a decision this roadmap does not take. `road-to-a-question-that-survives-the-turn` carries fifteen of fifteen steps done and three open blockers; Phase 4 resolves one of them on evidence, and the remaining two — whether an advisory warn on `stop` extends the turn, and whether a re-presented options block contaminates a pre-registered claim in `docs/CLAIMS.md` — need a recorded live session and an owner decision about a claim definition respectively. Archiving it to buy the slot would dispose of two recorded decisions to make room for a roadmap that names one of them as its own blocker. No other active roadmap is closeable: `check_roadmap_trackable` reports thirteen active files and every one carries open steps."
capability_gap: none
design_validated: "Claim verification at HEAD against the supplied source set: twenty of twenty-two defect claims reproduce, one is already fixed by the predecessor roadmap, and one is void because the reading behind it was taken in a worktree. Four cited line ranges had drifted and are corrected at the step that uses them."
review_by: 2026-12-11
---
# Road to a stop slot that knows it continues

> **Source:** `agents/tmp.old/round-c4e08a/` — a session transcript plus one
> supplied plan, analysed 2026-09-11. Second arrival of the same source; the
> first produced `road-to-a-question-that-survives-the-turn`. Claim verification
> at HEAD: twenty of twenty-two defect claims **still-true**, one
> **already-fixed**, one **void** (measured in an empty worktree). One claim the
> *predecessor roadmap* makes about this tree is **never-true** and is corrected
> in Phase 4.

## Goal

Three things are true when this is finished. The exit-code contract no longer
tells a reader that an advisory `warn` on `stop` has no effect on the turn, and
the one concern whose header states that in its own words says instead what it
actually proved. The shipped `pending-decision` detector reads the closing reply
from the field the host hands it rather than from a file the host writes
asynchronously, so a lagging transcript can no longer make it silent. And the
rule the detector's own refusal message cites states the obligation the detector
enforces, because the premise on which that amendment was parked — that
`src/rules/user-interaction.md` is a kernel rule — is false.

Someone else can tell whether this happened by reading the census artifact
Phase 1 writes, running the Phase 2 fixture in which the transcript lags the
payload, and grepping `src/rules/user-interaction.md` for a third Iron Law.

## Non-goal, stated so no step can grow into it

This roadmap builds **no** pending-decision record, **no** new concern, **no**
new detector, and touches **no** detector logic. The supplied plan proposes a
`PendingDecision` store keyed by `prompt_id` and a `continue: false` verdict that
ends the turn; the first is the object `road-to-decision-closure` owns and the
predecessor roadmap already declared a non-goal, and the second is recorded as a
blocker below rather than smuggled into a step. Phase 2 changes **where the
closing text comes from**, not what is done with it.

It also does not narrow the `stop_hook_active` guard at
`src/scripts/hooks/turn_end_gate_hook.ts:1194`. That narrowing is the wedge risk
the predecessor roadmap recorded as `detector-e-under-stop-hook-active`, it is
governed by `docs/contracts/turn-end-detector-demotion.md`, and it stays with its
owner.

## Phase 1 — The stop slot's own account of what it does

- [x] **1.1 Write the stop-slot continuation census.**
      `src/scripts/hook_manifest.yaml:1324` binds fourteen concerns on `claude`'s
      `stop` slot; exactly two are `severity: blocking` (`turn-end-gate` at
      `:980`, `run-continuation` at `:1077`) and twelve are advisory. Every
      advisory verdict reaches the model through
      `claudeAdditionalContext` (`src/scripts/hooks/host_semantics.ts:253-258`),
      and the contract describes that path as carrying no control-flow effect.
      Write one artifact under `agents/evidence/analysis/` listing all fourteen
      with severity, `fail_closed`, `skip_on_refusal_retry`, and whether the
      concern's own header makes a claim about its effect on the turn. State
      plainly which column is measured and which is read off the manifest.
      verify: the file exists, opens with `<!-- evidence-type: analysis -->`, and
      `grep -c '^| ' agents/evidence/analysis/stop-slot-continuation-census-2026-09-11.md` returns at least 15 (header plus fourteen rows).
- [x] **1.2 Say in the exit-code contract what the warn row does not establish.**
      `docs/contracts/hook-architecture-v1.md:124` describes exit 2 as "logs
      `reason` to stderr, sets `additionalContext` if platform supports it" —
      three mechanical facts and no statement about whether the turn ends. A
      reader takes the silence for "no effect", which is the reading that let a
      twelve-concern advisory slot be treated as inert. Add one sentence under
      the table: whether `additionalContext` on `stop` / `subagent_stop` extends
      the turn is **not established by this tree**, name the blocker that would
      establish it, and say that until it is, an advisory verdict on those two
      events is not known to be free.
      `corrected-from-reproduction`: the supplied plan's W0 asks for the row to
      *state the continuation effect*. Reproduced against the tree — nothing here
      establishes that effect, and the plan's own basis for it is an external
      reference this tree cannot check. Writing the stronger sentence would trade
      one unverified claim for its opposite.
      verify: `grep -n 'not established by this tree' docs/contracts/hook-architecture-v1.md` resolves within 15 lines of the exit-code table, and the sentence names the blocker id.
- [x] **1.3 Correct the one concern whose header states the opposite contract.**
      `src/scripts/hooks/end_review_nudge_hook.ts:219-220` reads "CONTRACT: never
      blocks THE ACTUAL TURN", and the proof it cites (`:180` onward) reasons
      entirely about exit codes — 2 versus 0, `fail_closed`, "never 1/BLOCK".
      The exit code was never the question. Amend the contract line to say what
      the proof actually proves (the host-facing exit is 0, so the concern never
      *refuses*) and to state that whether its `additionalContext` payload
      *extends* the turn is a separate, unestablished question pointing at the
      same blocker.
      `corrected-from-reproduction`: the supplied plan cites `:211-213`; the text
      is at `:219-220` and the proof block opens at `:180`.
      verify: `grep -n 'never refuses' src/scripts/hooks/end_review_nudge_hook.ts` resolves, and `grep -c 'never blocks THE ACTUAL TURN' src/scripts/hooks/end_review_nudge_hook.ts` returns 0.

**Exit criteria:** the census exists, and neither the contract nor the concern
asserts a control-flow property this tree has not established.

## Phase 2 — The gate reads the message the host hands it

- [x] **2.1 Prefer `last_assistant_message` for the closing reply.**
      `src/scripts/hooks/turn_end_gate_hook.ts:1232` takes `transcript_path` and
      `:1246` reads the tail; `grep -n last_assistant_message` over that file
      returns zero. `src/scripts/hooks/suggestion_capture_hook.ts:19-21` already
      records why the payload field is the reliable side — the transcript is
      written asynchronously and the turn-1 blind spot does not arise on the
      field. The gate is the suite's only refusal-capable stop concern and it is
      on the lagging side. Take the closing assistant text from
      `last_assistant_message` when the payload carries it, and append it to
      `assistantTurnTexts` if the transcript tail does not already end with it;
      fall back to the transcript unchanged when the field is absent, and record
      which source was used rather than leaving it silent.
      `corrected-from-reproduction`: this step first said "record it in the
      existing telemetry row". Reproduced — `turn_end_gate_hook.ts` has no
      telemetry sink of any kind (`grep -nE 'telemetry|journal|record\('` returns
      nothing); it is the one stop concern that speaks only through its refusal.
      The source is recorded in the refusal's own evidence string instead, which
      is what reaches a reader.
      **This is a read-source change only.** `detectDroppedDecision`
      (`:825`) is untouched, and so are detectors A–D, which keep reading
      `lastAssistant` exactly as they do today. Detector F (`untested`) landed
      on `main` while this branch was open and reads `lastAssistant` too; it is
      left unchanged deliberately, not overlooked. Every detector reading that
      field inherits the same lag, and widening the fix to all six is a
      behaviour change across five detectors that no fixture here covers — it
      belongs in its own change, gated on the same live measurement as blocker
      `warn-continuation-on-stop`.
      verify: `grep -n 'last_assistant_message' src/scripts/hooks/turn_end_gate_hook.ts` resolves, and `npx vitest run tests/scripts/turn_end_gate_hook.test.ts tests/scripts/turn_end_gate_pending_decision.test.ts` stays green.
- [x] **2.2 Add the lagging-transcript fixture.**
      One case where the transcript tail holds only the FIRST assistant text of
      the turn (the one carrying the options block) and the payload's
      `last_assistant_message` holds the second (carrying none) — today
      `assistantTurnTexts.length < 2` returns null at `:826` and the detector is
      silent in exactly its founding shape. One near-miss where the payload field
      is absent and behaviour is unchanged.
      verify: the positive case refuses naming `pending-decision` and the near-miss allows; both assertions live in `tests/scripts/turn_end_gate_pending_decision.test.ts`, not in prose.

**Exit criteria:** a transcript that lags the payload by one assistant entry no
longer silences the detector, and a host that supplies no such field behaves
exactly as before.

## Phase 3 — Turn identity is recorded from the host, not only derived

- [x] **3.1 Carry `prompt_id` alongside the derived ordinal.**
      `src/scripts/hooks/turn_end_gate_hook.ts:74-80` documents the ordinal
      drifting within a turn because a compaction summary, a `<system-reminder>`
      and a sidechain prompt all arrive in the user role. The host supplies
      `prompt_id`, and this tree already uses it as the suggestion latch key
      (`src/scripts/hooks/suggestion_capture_hook.ts:324`) and as a journal
      column (`src/scripts/_lib/runtime_journal.ts:393`); the gate reads it
      nowhere. Read it from the payload and record it beside the ordinal in the
      per-turn refusal marker, so a later reading can tell an ordinal that
      drifted within one prompt from two genuine prompts.
      `corrected-from-reproduction`: the supplied plan's D16 proposes replacing
      the ordinal with `prompt_id` as the re-entrancy key. Reproduced — the
      ordinal is the marker's filename and its drift history is the reason both
      re-entrancy layers exist; swapping the key is a behaviour change to a
      wedge-critical guard on an axis nothing here measures. The corrected step
      records both and changes no decision.
      verify: `grep -n 'prompt_id' src/scripts/hooks/turn_end_gate_hook.ts` resolves, `npx vitest run tests/scripts/turn_end_gate_hook.test.ts` stays green, and no test asserts a changed refusal outcome.

**Exit criteria:** the drift the gate's own header describes is observable from
the marker it already writes, and nothing about when it refuses has changed.

## Phase 4 — The rule states the obligation the gate enforces

- [x] **4.1 Add the third Iron Law to `src/rules/user-interaction.md`.**
      The shipped detector's refusal text (`turn_end_gate_hook.ts:850-856`) cites
      "user-interaction Iron Law 1" for a continuity obligation that file does
      not state: a grep of it for `next turn` / `survive` / `cross-turn` returns
      nothing, and its opening line scopes both laws to "every reply that
      contains numbered options". Add Iron Law 3 — a decision handed to the user
      outlives the turn; if the agent runs again without an answer, the options
      block and its recommendation line are re-presented in the same form; a
      subordinate clause is not a re-presentation; a hook's concern may be added
      to a pending decision, never replace one — and change the opening sentence
      from two laws to three.
      verify: `grep -c 'Iron Law 3' src/rules/user-interaction.md` returns at least 1, `./scripts-run src/scripts/check_always_budget` stays green, and `./scripts-run src/scripts/lint_rule_tiers` passes.
- [x] **4.2 Correct the false premise and close the blocker it parked.**
      `agents/roadmaps/archive/road-to-a-question-that-survives-the-turn.md:97-99` and its
      `### blocker: user-interaction-third-iron-law` both state that
      `user-interaction` is a kernel rule whose writes
      `src/scripts/hooks/block_kernel_rule_writes.ts` denies at tool-call time.
      `src/scripts/_lib/kernel_rules.ts:17-27` lists nine ids —
      `agent-authority`, `ask-when-uncertain`, `commit-policy`,
      `direct-answers`, `language-and-tone`, `no-cheap-questions`,
      `non-destructive-by-default`, `scope-control`, `verify-before-complete` —
      and `user-interaction` is not one of them. Correct both passages to say
      what is true, and flip that blocker to `Status: resolved` naming the commit
      from 4.1, since its own resolution condition is a commit adding the third
      Iron Law.
      verify: `grep -c 'is a kernel rule' agents/roadmaps/archive/road-to-a-question-that-survives-the-turn.md` returns 0 (the file archived on 2026-09-12 when that roadmap closed; the verify command follows it rather than breaking), the blocker's `- **Status:**` line reads `resolved`, and `lint_roadmap_blockers` stays green. The three remaining tree-wide hits for that phrase are in THIS file, each naming the premise as false rather than asserting it.

**Exit criteria:** a reader who meets the `pending-decision` refusal finds the
obligation written in the rule it cites, and no roadmap in the tree describes
`user-interaction` as kernel.

## Phase 5 — The measurement that was never empty

- [x] **5.1 Correct the contact-axis reading in the parked measurement roadmap.**
      `agents/roadmaps/later/road-to-residual-interruption-measurement.md:39-44`
      records a 2026-09-06 run reporting `interruptions.jsonl is empty or
      absent`, `n=0` on the contact axis. `agents/runtime/` is gitignored and
      therefore per-checkout: re-run against a checkout carrying live runtime
      state and the same script reports **n=148 runs** on the contact axis, from
      a ledger whose earliest record is 2026-08-17 — three weeks BEFORE the
      reading that called it empty. The contact floor of 20 was already cleared
      when the roadmap recorded it as unreachable. Correct the passage, keep the
      wall-clock finding (`n=4`, floor 20) which survives unchanged, and state
      the reading rule: this instrument is measured with `--root` at a checkout
      with live runtime state, never from a fresh worktree.
      verify: `grep -c 'worktree' agents/roadmaps/later/road-to-residual-interruption-measurement.md` returns at least 1 and the file no longer presents `n=0` as the contact-axis state.
- [x] **5.2 Make the report say why its ledger is empty.**
      `src/scripts/interruption_report` prints `interruptions.jsonl is empty or
      absent` and stops, which reads as "the instrument has no observations" and
      was recorded as exactly that. When the ledger is absent, add one line
      naming the per-checkout property of `agents/runtime/` and the `--root`
      flag the script already accepts.
      verify: running the script against a root with no ledger prints the `--root` hint, and running it against one with a ledger is byte-identical to today.

**Exit criteria:** the number a later reader finds is the instrument's, not the
checkout's, and a fresh-worktree run says so instead of reporting a null.

## Blockers

### blocker: warn-continuation-on-stop

- **Status:** resolved
- **Owner:** maintainer
- **Resolution:** AI council 2026-09-12, 2/2 convergent (anthropic + openai, deep
  depth, blind chairman, three rounds), on the maintainer's standing delegation
  for this run. Verdict **(a-derived)**: the raw `stop_hook_active` byte exists
  nowhere — `AGENT_HOOK_CAPTURE_DIR` has never been set, and Claude Code
  transcripts do not record hook stdin — but the dispatcher drops the two
  `skip_on_refusal_retry` concerns if and only if
  `payload.stop_hook_active === true` (`src/scripts/hooks/dispatch_hook.ts:355-366`,
  `src/scripts/hook_manifest.yaml:921,1126`), so a `stop` invocation missing both
  **is** a recorded `true`. Both seats accepted the derivation on four stated
  properties — one-to-one, deterministic, produced by code in this repository,
  limits stated — and both required that it be reported as *derived, not
  directly captured*. Evidence artifact:
  `agents/evidence/analysis/stop-slot-warn-continuation-2026-09-12.md`. Contract
  updated at `docs/contracts/hook-architecture-v1.md` § Exit-code semantics,
  from "not established by this tree" to a measured-at-n=1 statement pinned to
  `9a0216f4c`.
- **Blocks:** nothing in this roadmap — Phases 1–5 ship regardless. It blocks
  only the stronger sentence Phase 1.2 declines to write, and it is the same
  measurement `road-to-a-question-that-survives-the-turn`'s open blocker
  `detector-e-under-stop-hook-active` needs, so one session answers both.
- **What to do:** pick exactly one — (a) record one live session in which
  `src/scripts/hooks/end_review_nudge_hook.ts` fires on `stop`, capture whether
  the turn continues and whether the following `Stop` payload carries
  `stop_hook_active: true`, and write both into
  `agents/evidence/analysis/`; or (b) record that the question stays open and
  that `docs/contracts/hook-architecture-v1.md` keeps the "not established"
  wording from Phase 1.2 indefinitely.
- **Resolved when:** an artifact under `agents/evidence/analysis/` names the
  observed continuation behaviour and the observed `stop_hook_active` value for
  a real `end-review-nudge` fire, or the maintainer records option (b).
- **If you do nothing:** the contract keeps an honest "unestablished" line, which
  is correct but leaves twelve advisory concerns with an unknown effect on the
  turn, and the predecessor roadmap's detector keeps an unmeasured inertness path
  beside the one Phase 2 closes.
- **Recommendation:** none; this is the owner's call — it costs one live session
  and nothing in this tree can substitute for it.

### blocker: continue-false-precedence

- **Status:** resolved
- **Owner:** maintainer
- **Resolution:** AI council 2026-09-12, 2/2 convergent (same session as
  `warn-continuation-on-stop`). Verdict **(b)** — recorded non-adoption, not a
  precedence rule. Both seats reasoned that a universal precedence rule and a
  single-emitter invariant would be speculative for a primitive the suite
  neither emits nor has a demonstrated need for: verified at HEAD, `grep -rn
  stopReason src/scripts/hooks/` is empty, no concern emits `continue: false`,
  and the string appears nowhere in `docs/`. The row landed in
  `docs/contracts/hook-architecture-v1.md` § Exit-code semantics and is dated
  rather than principled, so a future emitter must reopen it and specify
  precedence, emitter ownership, supported-host behaviour, and the use case
  existing verdicts cannot express.
- **Blocks:** nothing in this roadmap — the subtractive fix the supplied source
  proposes (end the extra turn instead of appending a reminder to it) is out of
  scope here and cannot start until this is decided.
- **What to do:** pick exactly one — (a) add a precedence rule to
  `docs/contracts/hook-architecture-v1.md` stating that `continue: false`
  outranks every other verdict and that exactly one named concern may emit it per
  event, then open a roadmap for the emitter; or (b) record that this suite does
  not emit the primitive, and add the decision to the exit-code table so the
  absence is a stated position rather than an omission.
- **Resolved when:** `grep -n 'continue: false' docs/contracts/hook-architecture-v1.md`
  resolves to either a precedence rule or a recorded non-adoption.
- **If you do nothing:** `grep -rn stopReason src/scripts/hooks/` stays empty and
  every stop verdict in this suite either extends the turn or lets it end by
  default — there is no verdict for *end it now*, and nothing says whether that
  is a decision or an oversight.
- **Recommendation:** none; this is the owner's call — it is a verdict-ordering
  rule across every concern on every event.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-11 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The payload field disagrees with the transcript and the detector fires twice | implementation | If `last_assistant_message` duplicates a text the transcript tail already carries, the closing reply appears twice in `assistantTurnTexts` and an earlier block could be compared against itself. | The step appends only when the tail does not already end with that text, and the Phase 2.2 near-miss asserts the no-field path is byte-identical to today. The detector's own early return at `:826` still needs two distinct texts. | Phase 2 — The gate reads the message the host hands it |
| 2 | Iron Law 3 changes what the pre-send self-check demands | product | `check_reply_consistency` validates numbered-option blocks within one draft. A third law about cross-turn lifetime could read as a fourth thing that script must check, and it cannot. | The law is written with the honesty clause the file already uses for its own uncheckable half, naming the `pending-decision` detector as the carrier and the script as covering only the within-reply half. | Phase 4 — The rule states the obligation the gate enforces |
| 3 | The corrected measurement is read as a new claim | product | Reporting `n=148` where a parked roadmap says `n=0` looks like a fresh measurement rather than a corrected reading, and a later reader may treat the contact axis as closed when its pre-registered claim was never evaluated. | Phase 5.1 corrects only the reading and explicitly keeps the wall-clock finding; it changes no pre-registered claim and closes no roadmap. The step states the reading rule rather than a verdict. | Phase 5 — The measurement that was never empty |
| 4 | Recording `prompt_id` grows the refusal marker and breaks its readers | implementation | The per-turn marker is written and read by the gate's own re-entrancy layer; an added field could make an existing marker unparseable mid-session. | The field is additive and optional on read, and the Phase 3 verify asserts no test observes a changed refusal outcome. | Phase 3 — Turn identity is recorded from the host, not only derived |

## Acceptance Criteria

- [x] AC-1 — `docs/contracts/hook-architecture-v1.md` states that the
      control-flow effect of an advisory `warn` on `stop` / `subagent_stop` is
      not established by this tree, and names the blocker that would establish
      it; no file in the tree asserts the opposite in either direction.
- [x] AC-2 — `src/scripts/hooks/end_review_nudge_hook.ts` no longer carries the
      string "never blocks THE ACTUAL TURN", and its contract paragraph
      distinguishes refusing from extending.
- [x] AC-3 — A fixture in which the transcript tail carries only the
      block-bearing assistant text and the payload carries the block-free closing
      text produces a `pending-decision` refusal; the same shape with no payload
      field behaves exactly as it does today.
- [x] AC-4 — `src/rules/user-interaction.md` carries a third Iron Law stating
      that a decision handed to the user outlives the turn, and
      `check_always_budget` is green.
- [x] AC-5 — No roadmap in `agents/roadmaps/` **asserts** that
      `user-interaction` is a kernel rule; the only remaining occurrences of the
      phrase are in this file, each naming it as the false premise it was. And
      `road-to-a-question-that-survives-the-turn`'s
      `user-interaction-third-iron-law` blocker reads `Status: resolved`.
- [x] AC-6 — `agents/roadmaps/later/road-to-residual-interruption-measurement.md`
      no longer presents `n=0` as the contact axis's state and records that the
      instrument is read with `--root` at a checkout carrying runtime state.
- [x] AC-7 — The stop-slot census exists under `agents/evidence/analysis/` with
      one row per bound concern and a stated source per column.
