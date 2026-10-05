---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "A dozen signals in the tree say something the code beside them does not do: a loop flag that fires on ordinary work, a reader of that flag pointed at a file nothing writes, two settings comments, eighteen citations of a budget its rule no longer states, a roadmap lint that is red on the trunk, a verify form that is green when the test it names does not exist, a turn marker read from a path its writer left, and a resume reason the resolver was changed away from. Each is small and none has an owner; the parked observation roadmap owns the continuation hook, not the tool-call counter. Merging them into the parked carry-over of the trunk-gates roadmap was considered and rejected: that file waits on one owner decision about a user type, which this file names and does not take, and its parent was archived on 2026-10-02 while the roadmap lint was already red — red on main since 2026-10-01 and kept red by the two files named here after the first offender was archived on 2026-10-05. Adds no hook concern, no script and no setting."
estate_growth_exempt: "Grows active_roadmaps by one: the owner asked on 2026-10-05 for this round's roadmaps to land as ready in one change; the parked carry-over that could hold it waits on an owner decision this file does not take."
relates:
  - slug: road-to-run-continuation-observation
    relation: disjoint
    note: "Later. Owns the continuation hook and its dated withdrawal; nothing here depends on either."
  - slug: road-to-adversarial-verification-and-long-runs
    relation: extends
    note: "Its step 4.1 moved the rule to a bound of ten, and the evidence under its AC-4 records that no escalation path maps a count to an owner ask. Steps 2.3 and 2.4 here find six shipped lines that still do, correct them, and leave one dated note under that criterion saying so."
  - slug: road-to-a-trunk-whose-own-gates-are-green-carried
    relation: disjoint
    note: "Later. Owns the open product call behind the second red aggregate step. Nothing here takes it or resets its clock."
---
# Road to signals that mean what they say

> **Source:** an external comparison round against an autonomous-runtime tree
> (opaque id S1), in whose documents this round counted nineteen figures its
> code does not bear out, and three field implementations of repeated-call
> detection (S3–S5) that agree a repeat is a property of a call's arguments,
> not of its tool. The same reading was then turned on this tree. Every anchor
> re-read at `main` @ `df377ca64` on 2026-10-05 and re-run by an independent
> pass; the replay figure is this round's own. A second round on the same day,
> against a parallel proposal for a run-state protocol and a progress breaker,
> added the last two items of Phase 2 and 3 and all of Phase 4: where that
> proposal planned new state, this tree turned out to have state whose reader
> and writer had drifted apart. Class: external comparison corpus.
>
> Round `agents/tmp.old/inbox-2026-10-d/`. Re-verified anchor by anchor at
> `main` @ `975d03d01` on 2026-10-05 by five independent read-only passes;
> the one commit since the pin moved no anchor, and their corrections are in.

## Goal

A flag named for a loop is not true after two thirds of the calls in an
ordinary session; a command that reports that flag reads the file the hook
writes; a settings comment describes the value under it; the trunk passes its
own roadmap lint; and a verify clause that names a test nobody wrote is listed
as such. A budget cited from a rule is the budget the rule states; a marker
for "this turn" is read from the file its writer writes; and the reason given
for resuming after a compaction is what the resolver does. Each is a sentence,
a field, a path or a listing made true, and nothing new is built to make it so.

## Context

At `df377ca64`:

- **The loop flag.** `src/rules/context-hygiene.md:76` — "**\"Similar
  parameters\" is the load-bearing word — an enumerated set is not a loop.**"
  The hook the rule names as its enforcement compares the tool name only:
  `consecutive_same_tool` increments when the name repeats
  (`src/scripts/context_hygiene_hook.ts:138-139`) and `loop_detected` is that
  count against `LOOP_THRESHOLD = 3` (`:48`, `:152`).
- Replayed over one real session of ordinary, non-looping work — this round's
  own transcript, 110 main-thread tool calls — the flag turns on 8 times and is
  true after 74 of the 110 calls. A fingerprint of tool name, arguments and
  result size fires 0 times on the same calls. One session shows the
  mechanism; it is not a rate.
- The flag reaches no model. The concern is `effect: telemetry`
  (`src/scripts/hook_manifest.yaml:131`) and its only emission is a verbose
  line on stderr (`context_hygiene_hook.ts:211-216`).
- It has two readers, and one reads a file nothing writes. The hook writes
  `agents/state/context-hygiene.json` (`context_hygiene_hook.ts:45-46`);
  `src/scripts/_cli/cmd_analyze_session.ts:42-47,100` reads
  `agents/runtime/state/context-hygiene.json`. `src/scripts/explain_run.ts:78`
  tries both paths and prints the two fields at `:480`, `:700` and `:702`. A
  third spelling of the path stands in the dispatcher's help text
  (`src/scripts/_dispatch.bash:367`).
- A replacement cannot be tuned from what the tree holds: the transcript store
  behind its own activation claim is 30 sessions (`docs/CLAIMS.md:245`).
- **Two comments.** `src/config/agent-settings.template.yml:183` heads the
  lean-projection block "(experimental, opt-in)" and `:188-189` call
  `eager-all` the "DEFAULT, today's behaviour", above `mode: delivery` at
  `:213`. The same file says of `subagents.max_parallel`, "Hard cap enforced by
  runtime" (`:1068`), and so does the shipped settings template
  `src/agent-src/templates/agent-settings.md:295`;
  `src/server/schemas/settings.ts:446` and
  `src/agent-src/contexts/subagent-configuration.md:13` call it a hard cap, and
  the generated `docs/settings-reference.md:323` repeats the schema. The key's
  only non-test readers are that schema and the installer's key map
  (`src/scripts/install.ts:348`); nothing counts spawns against it.
- **A budget cited from a rule that no longer states it.** The rule's section
  is headed "`execution.fix_loop_max`, default 10, and a ladder"
  (`src/rules/autonomous-execution.md:51`), and its fence says "THE BOUND
  TRIGGERS A STRATEGY CHANGE, NEVER A QUESTION" with attempts one to three as
  the first rung. The string `N=3` does not occur in the rule. It occurs on 18
  lines in 15 other files under `src/` that name the rule as its source on
  the same line, and once more where the attribution wraps
  (`src/domains/analysis-workbench/analyze/inbox/command.md:673-675`).
- **At least six shipped lines still stop or ask at three.** A skill: "stop and
  surface them" (`src/skills/git-workflow/SKILL.md:139`). A hook's output to
  the model: "stop and say so, with the three attempts named"
  (`src/scripts/hooks/push_settle_hook.ts:198-200`). Two contexts: "N=3 stop"
  and "N=3 stop-and-ask"
  (`src/agent-src/contexts/communication/rules-auto/think-before-action-mechanics.md:86`,
  `token-efficiency-mechanics.md:57-58`). ADR-268 § 7 says of the count: "It
  never by itself produces an owner question." The roadmap that moved the
  rule records the matter as settled — "no escalation path maps a count to an
  owner ask"
  (`agents/roadmaps/road-to-adversarial-verification-and-long-runs.md:1235-1238`)
  — and its criterion stays deferred only for a kernel string no agent may
  edit. The four lines say otherwise, and so do two more: the rule
  `context-hygiene`'s 3-Failure Rule ("**STOP** — do not attempt a 4th fix",
  `src/rules/context-hygiene.md:54-58`), which its own mechanics context
  already reframes as epochs (`autonomy-mechanics.md:213-214`), and a skill's
  table row "3 failed attempts | Stop — … ask user for direction"
  (`src/skills/analysis-autonomous-mode/SKILL.md:112`). Neither is a kernel
  rule.
- **The work engine's ceiling argues from the dropped figure.** It is 3,
  commented as "Deliberately the `autonomous-execution` N=3 budget rather than
  a fresh number"
  (`src/agent-src/templates/scripts/work_engine/directives/backend/_self_fix.ts:47-54`),
  and no production code outside that file reads it (its suite and
  `loop-surfaces.yaml:55` name it). One contract line repeats the engine's
  attribution (`docs/contracts/implement-ticket-flow.md:366`); a second gives
  the same attribution to a different setting, the review-gate breaker
  `ai_team.review_gate.max_consecutive_blocks`
  (`docs/contracts/settings-classes.md:585`).
- **The trunk's own lint.** `task ci` runs `lint-roadmap-complexity`
  (`Taskfile.yml:185`), and the script exits 1 on this commit:
  `road-to-a-menu-whose-precision-is-measured.md` (723 lines) and
  `road-to-corpus-refresh-cadence-shape.md` (760) are tagged `lightweight`
  against `LIGHTWEIGHT_LINE_CAP = 600`
  (`src/scripts/lint_roadmap_complexity.ts:50`). Both crossed the cap through
  dated evidence paragraphs added to existing steps: 596 to 723 on 2026-10-03
  (`50bec97`), 594 to 760 on 2026-10-05 (`6aa3c36`). The lint was red before either:
  since 2026-10-01 (`db000c50c`), when a third lightweight roadmap reached 604
  lines; that file was archived on 2026-10-05 (`901e8bc`), after these two
  had kept it red. No workflow runs `task ci` (`.github/workflows/consistency.yml:177`),
  which is why a trunk red goes unseen. An agent may not answer
  that by retagging: "The agent must not upgrade a lightweight roadmap to
  structural mid-flight without that opt-in"
  (`docs/contracts/roadmap-complexity-standard.md:71-73`).
- **A second aggregate step is red, and it is not this file's.** `task ci`
  also runs `lint-user-type-axis` (`Taskfile.yml:374`), which exits 1 on this
  commit: its baseline of one "has not moved in 64 days (limit 56)". The
  finding is a user-type value five skills declare with no definition behind
  it, and it has an owner: blocker `legal-user-type-is-a-product-call` in the
  parked carry-over
  (`agents/roadmaps/later/road-to-a-trunk-whose-own-gates-are-green-carried.md:40-52`).
  Resetting the clock with a `reaffirmed` block was considered there and
  refused as "a weakening of a recorded floor, which is owner-reserved"
  (`agents/roadmaps/archive/road-to-a-trunk-whose-own-gates-are-green.md:126-129`).
  By the same 56-day rule a third entry, landed 2026-08-12, turns stale on
  2026-10-08 (`src/config/gate-violation-baselines.json`, entry
  `lint_settings_classes:derivable-surface`).
- **A verify that cannot say no.** `npx vitest run <file> -t <name>` exits 0
  when the file exists and no test in it matches the name: the run reports
  every test skipped. 21 of the 177 `verify:` lines in the 16 active roadmaps
  have that form. Each was run on this commit: 18 match at least one test, and
  three match none — all on open steps of
  `road-to-an-installed-layer-that-is-thinned.md` (`:132`, `:136`, `:144`), so
  each of those steps can be ticked today on a command that ran nothing. No
  ticked step is in that state. `closure_scan` already lists verify clauses
  whose oracle cannot fail, as a listing that never gates
  (`src/scripts/closure_scan.ts:22,41-43`); this form is not among them.

- **A turn marker read from a path its writer left.** The blocking concern
  `evidence-independence` resets its per-turn count when the authorization
  ledger's `detected_at` changes, and reads that stamp from
  `agents/state/git-authorization.json`
  (`src/scripts/hooks/evidence_independence.ts:202-206`). Its own comment says
  why: without a per-turn stamp "the counter was session-scoped: one
  self-review anywhere in a session blocked every later one" (`:418-423`).
  The ledger's writer uses that path only when it has no session id; with
  one, it writes `agents/state/git-authorization/<sessionSlug(id)>.json`
  (`src/scripts/git_authorization_hook.ts:116-121`, `:1430`; its header
  docstring at `:29` still names the legacy path). With a session id the stamp
  reads empty — or constant, if a stale legacy file exists — so it never
  changes per turn and the marker is the session id again. The
  suite's fixture writes the legacy path by hand
  (`tests/scripts/evidence_independence.test.ts:224`).
- **A resume reason the resolver was changed away from.** The start hook
  injects a continuity record on `compact` because "the resolver keys on
  session id, so what comes back is this session's own record"
  (`src/scripts/handoff_context_hook.ts:343-346`). The resolver's rule, chosen
  by a council on 2026-09-09, is the opposite: "**Own record.** NEVER read"
  (`src/scripts/_lib/recycle_envelope_paths.ts:185-188`), and the code filters
  it out (`:210`). On `compact` the hook can therefore only read, and move
  aside, a record that belongs to some other session — the outcome its own
  comment gives as the reason to inject nothing on `fork`. The one test that
  names `compact` covers the prose handoff, not the record
  (`tests/scripts/handoff_context_hook.test.ts:161`).
- **Three spellings of one more path.** The onboarding latch is written to
  `agents/state/onboarding-gate.json`; two docstrings in the same file say
  `agents/runtime/state/` (`src/scripts/onboarding_gate_hook.ts:13`, `:156`,
  with a note at `:81-84` that the divergence is known), and the dispatcher's
  help says `.augment/state/` (`src/scripts/_dispatch.bash:365`). The
  continuity inventory anchors its row to the docstring
  (`src/config/continuity-surface.json`, row `onboarding-gate.json`) and
  describes `test-results.json` as "read by the verification gates within a
  run"; no production code writes or reads that file.

## Phase 1 — The loop flag

- [ ] **1.1 The session analyser reads the hook's file.**
      `cmd_analyze_session.ts` takes its path from the hook's exported
      `STATE_FILE` instead of spelling one, and its docstring (`:15`) and help
      text (`:256-257`) name that path; the dispatcher's help line names
      the same path.
      verify: `npx vitest run tests/scripts/analyze_session_reads_hook_state.test.ts` -> 0
- [ ] **1.2 The two fields leave their writer and their readers in one
      change.** Remove `loop_detected` and `consecutive_same_tool` from the
      state the hook writes and from its verbose line, from the analyser's
      tool-activity section, and from the three places `explain_run.ts` prints
      them. `LOOP_THRESHOLD` and `last_tool`, which exist only to compute the
      counter, go with them, and `explain_run.ts`'s heading "Hook / loop
      state" becomes "Hook state". The call count, the five-name history and
      the freshness milestones stay, at the same path. The stub
      `road-to-declared-protocol-cap`, which cites the hygiene state's loop
      signal as a template, gains one dated line. The three suites that pin the fields change with
      them (`tests/scripts/hooks/context_hygiene_hook.test.ts`,
      `tests/scripts/cmd_analyze_session.test.ts`,
      `tests/scripts/explain_run.test.ts`; the last has a known local false red
      a stub owns, which this step does not try to fix). The new test searches
      `src/` and `docs/` for both field names and fails on any hit.
      verify: `npx vitest run tests/scripts/hooks/context_hygiene_state_shape.test.ts` -> 0
- [ ] **1.3 The rule and its guideline stop naming a loop signal.** In
      `context-hygiene.md` the header's list of what the hook maintains loses
      "loop signal"; the rule already says the every-turn obligation is
      model-carried (`:36-37`) and gains no sentence. The one paragraph of the
      mechanics guideline that repeats the list (`context-hygiene-mechanics.md:72`)
      loses the same words; the Copilot paragraph's "tool-loop signals" at
      `:74` is a different claim and stays. The
      projected copies are regenerated.
      verify: `grep -c 'loop signal' src/rules/context-hygiene.md` -> /^0$/
      Positive control: the same grep returns 1 at `df377ca64`.

## Phase 2 — Sentences beside the value they describe

- [ ] **2.1 The lean-projection comment describes the shipped value.** The
      block header no longer says experimental or opt-in, and no line calls a
      value other than the one below it the default.
      verify: `grep -c "today's behaviour" src/config/agent-settings.template.yml` -> /^0$/
      Positive control: the same grep returns 1 at `df377ca64`.
- [ ] **2.2 The parallel cap says who carries it.** The two template
      comments, the schema description and the context table state that the
      value is a limit the model reads from settings and that no code counts
      against it. The settings reference, the round-trip fixture that mirrors
      the template, the MCP content bundle (`internal/workers/mcp/content.json`) and the tracked installer bundle are regenerated in the
      same change. No enforcer is built.
      verify: `cat src/config/agent-settings.template.yml src/agent-src/templates/agent-settings.md | grep -c 'Hard cap enforced by runtime'` -> /^0$/
      Positive control: the same command returns 2 at `df377ca64`.

- [ ] **2.3 A cited budget is the one the rule states.** Each of the 18
      lines, and the wrapped one, cites `execution.fix_loop_max` and the
      ladder instead of a figure the rule dropped. For five of them that is
      more than a citation: five commands state three as their operative
      bound with the rule as its only source
      (`src/domains/git/pr/create/command.md:501`,
      `src/domains/engineering-base/fix/ci/command.md:110`,
      `.../worktree/verify/command.md:69`, `.../mission/upgrade/command.md:173`,
      and line 100 of the deep-optimisation command under `src/domains/meta/`),
      and they follow the rule to its setting and ladder. Two keep three as their own number and say so: the
      work engine's ceiling and the repair-loop skill's `max_attempts`. The
      tracked copies are regenerated.
      verify: `grep -rI 'N=3' src --include=*.md --include=*.ts | grep -c 'autonomous-execution'` -> /^0$/
      Positive control: the same command returns 18 at `df377ca64`.
- [ ] **2.4 No shipped line stops or asks at three.** The six lines say what
      the rule says: after three attempts the strategy changes, and a count is
      not a reason to stop or to ask; the push-settle sentence keeps its branch
      for something only the user can decide. One dated note under AC-4 of the
      roadmap that owns the criterion names the six lines as what its recorded
      reading missed, and lists what this step leaves alone: the two contract
      lines, and the other lines under `src/` that pair `N=3` with a halt
      without naming the rule. The tracked copies are regenerated.
      verify: `cat src/skills/git-workflow/SKILL.md src/scripts/hooks/push_settle_hook.ts src/agent-src/contexts/communication/rules-auto/think-before-action-mechanics.md src/agent-src/contexts/communication/rules-auto/token-efficiency-mechanics.md src/rules/context-hygiene.md src/skills/analysis-autonomous-mode/SKILL.md | grep -cE 'stop and surface|stop and say so|stop-and-ask|do not attempt a 4th fix|3 failed attempts \| Stop'` -> /^0$/
      Positive control: the first three patterns over the first four files
      return 4 at `df377ca64` and `975d03d01`.

## Phase 3 — The trunk's own checks

- [ ] **3.1 Dated evidence leaves the two roadmaps for a page each.** In each
      of the two files, move dated evidence paragraphs verbatim to one page
      under `agents/evidence/analysis/` — with its `evidence-type` marker —
      leaving one line with the date and the page name where each stood. That
      includes evidence appended inside a blocker, as long as the blocker's
      required fields stay where they are. No checkbox, decision, criterion or
      tag is changed.
      verify: `./scripts-run src/scripts/lint_roadmap_complexity` -> 0
- [ ] **3.2 The lint names the remedy.** When a `lightweight` roadmap exceeds
      the line cap, the message says that dated evidence belongs on an
      evidence page and that an agent may not retag; today it suggests
      "tagging structural or trimming" (`lint_roadmap_complexity.ts:156-158`).
      verify: `npx vitest run tests/scripts/lint_roadmap_complexity_message.test.ts` -> 0
- [ ] **3.3 A name-filtered run that matches no test is listed.** The
      `unfalsifiable-verify` family in `closure_scan` gains one case: a clause
      of the form `vitest run <target> -t <name>` where the target exists and
      no test title under it contains the name — a file, or every test file of
      a directory. It stays a listing and exits 0. On `df377ca64` it lists the
      three clauses above and none of the other 18. The family's header, which
      says a test runner is absent on purpose, is reworded: the case reads
      titles and runs nothing.
      verify: `npx vitest run tests/scripts/closure_scan_name_filter.test.ts` -> 0

## Phase 4 — State that is read where it is written

- [ ] **4.1 The turn marker follows the ledger.** `_ledgerStamp` takes the
      session id and resolves the file through the writer's exported
      `ledgerFileFor`. The test runs the writer and the reader with a session
      id, as a host does, and asserts that a second user turn resets the
      count; the fixture that writes the legacy path by hand goes. The count
      itself still lives in one file per project, so two sessions in one
      checkout reset each other as before; that is not changed here.
      verify: `npx vitest run tests/scripts/evidence_independence_turn_marker.test.ts` -> 0
- [ ] **4.2 What a compacted session gets back is decided once.** Two
      records disagree, so the question goes to a council with both in the
      bundle: the archived step that is ticked — "`compact` re-injects this
      session's own record" — and the resolver rule chosen later — an own
      record is never read. With them go the reproduction (own record only:
      untouched; one foreign record: injected and moved aside), the suite's
      note that the source gate covers the record and the prose handoff
      alike, and what is not measured: whether a host keeps its session id
      across a resume. The question: on `compact`, does the session get its
      own record back without consuming it, or nothing; and may either
      consumer take a file another session wrote. The verdict is recorded at
      `agents/evidence/council/compact-resume-2026-10.md` with its
      `evidence-type` marker; code, comment and one fixture per case follow
      it; the archived step gains a dated note saying which reading stands.
      verify: `npx vitest run tests/scripts/handoff_context_compact_record.test.ts` -> 0
- [ ] **4.3 One spelling of the latch path, and an inventory row that is
      true.** The two docstrings, the two lines that place the dispatcher lock
      under the same wrong directory (`:36`, `:158`), and the dispatcher's
      help line name the path the constant holds; the inventory row for the latch anchors to the
      constant; the row for `test-results.json` says that no production code
      writes or reads it, coordinated with step 2.4 of
      `road-to-modules-that-something-calls`; the `context-hygiene.json` row
      stops giving "Read within a session to decide whether to warn" as its
      reason. The same wrong lock path in `context_hygiene_hook.ts:36`,
      `hooks/state_io.ts:12` and `docs/contracts/hook-architecture-v1.md:946`
      is corrected in the same change. No row's disposition or count changes.
      verify: `grep -cE 'runtime/state/(onboarding-gate|[.]dispatcher[.]lock)' src/scripts/onboarding_gate_hook.ts` -> /^0$/
      Positive control: the same grep returns 4 at `df377ca64`.

## What this roadmap deliberately does not do

- No replacement detector. An argument fingerprint is designed and parked
  with its entry condition, because 30 sessions cannot set its thresholds and
  the withdrawal of the continuation hook would leave it without a second
  consumer.
- No per-session state file; the path the registry and both readers know
  stays.
- No change to the hook manifest or to any gated plumbing file.
- No retag of either roadmap and no change to the line cap.
- No gate on verify clauses and no rewrite of the 21 existing ones; the
  listing is what their authors read.
- No enforcer for the parallel cap.
- No run-state directory, cursor file or event ledger. One record schema and
  no newest-record pointer are recorded decisions; Phase 4 repairs readers.
- No progress detector and no change to the continuation hook, whose dated
  withdrawal is its own roadmap's.
- No gate on lapsed review dates. The stub queue is a query by a recorded
  verdict and its count is on the dashboard.
- No change to the continuity inventory's scan or to its targets.

## Acceptance Criteria

- [ ] AC-1 — A fixture of three consecutive reads of three different files
      leaves no field in the hook's state that names a loop.
- [ ] AC-2 — `analyze-session` on a project where the hook has run prints a
      tool-call count taken from the hook's file.
- [ ] AC-3 — `./scripts-run src/scripts/lint_roadmap_complexity` exits 0 on the
      trunk with both roadmaps still tagged `lightweight`.
- [ ] AC-4 — `closure_scan` run on the thinned-layer roadmap at `df377ca64`
      lists its three name-filtered clauses whose test does not exist.
- [ ] AC-5 — The change adds no file under `src/scripts/`.
- [ ] AC-6 — `task ci` passes its roadmap-complexity step.
- [ ] AC-7 — With a session id and one session in the checkout, a self-review
      in a second user turn is counted from zero.
- [ ] AC-8 — What a session start with source `compact` injects and moves is
      what the council's record says, and one fixture per case pins it.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | deterministic | evidence | Remove the flag; do not repair it here | True after 74 of 110 calls of ordinary work; read by no model; one of two readers reads a path nothing writes | A looping session is recorded, or the transcript store passes 200 sessions |
| D2 | reversible-technical | agent | The analyser imports the hook's path constant | Two spellings of one path already diverged (`cmd_analyze_session.ts:42-47` against `context_hygiene_hook.ts:45-46`) | The hook's state moves to a per-session file |
| D3 | reversible-technical | agent | Correct the four authored sentences about the parallel cap; build nothing | Readers are the schema and the installer's key map only; a shadow spawn guard already records spawn fan-out | A recorded incident shows fan-out above the configured value |
| D4 | deterministic | evidence | Trim by moving evidence out; neither retag nor raise the cap | `roadmap-complexity-standard.md:71-73`; `src/config/preamble-payload-budget.json`, registration note, on raising a bound to clear a red check | — |
| D5 | reversible-technical | agent | List the name-filtered form; do not gate it and do not rewrite existing clauses | The family is a listing by its own header; 18 of 21 clauses match a test as written | A ticked step is found whose named test does not exist |
| D6 | reversible-technical | agent | Citations follow the rule; a stop or an ask at three becomes the rule's strategy shift; the engine's 3 stays, as its own number; contract lines are listed, not edited | The rule states 10 and a ladder; ADR-268 § 7; the engine's ceiling is read only inside its own file; a contract page is not a lightweight roadmap's to change | The owner wants the engine to read the setting |
| D7 | product-owned | owner | The second red aggregate step is named and left with its blocker | The reaffirm route was refused as owner-reserved (`archive/road-to-a-trunk-whose-own-gates-are-green.md:126-129`) | — |
| D8 | deterministic | evidence | The reader takes the path from the writer | `evidence_independence.ts:202-206` against `git_authorization_hook.ts:116-121` | The ledger moves again |
| D9 | contested-technical | council:compact-resume-2026-10 | Whether a compacted session gets its own record back or nothing, and whether a consumer may take another session's file, is one council question | A ticked archived step and a later resolver rule disagree (`archive/road-to-continuity-retirement-sequencing.md:161-165`; `recycle_envelope_paths.ts:185`); reproduced at the pin | The compaction census records what a compacted session keeps |

## Kill register

| ID | Proposal | Killed by | Note |
|---|---|---|---|
| K1 | An argument-fingerprint detector with a replay bar, wired into the hook | Corpus of 30 sessions against a bar that needs hundreds; the flag has no in-session consumer; the build edits a gated manifest | Second draft of this round planned it; parked with its entry condition |
| K2 | Refuse the fourth identical call | Blocking allowlist, admission row, hottest slot | The comparison runtime owns its loop; this package does not |
| K3 | Classify status-check tools as idle and drop idle turns from history | The host owns transcript replay | — |
| K4 | A per-session hygiene state file | Both readers, one registry row and two stubs name the fixed path | — |
| K5 | Retag the two roadmaps `structural` | `roadmap-complexity-standard.md:71-73` | Second draft planned it |
| K6 | A per-run directory with a cursor, a contract, an event log and a capsule | "one schema, variant-discriminated — no new format" (`agents/settings/contexts/continuation-protocol-and-runtime-graph.md:22`); "**No `latest` index, by decision.**" (`recycle_envelope_paths.ts:61-64`) | Planned in the parallel proposal |
| K7 | A progress breaker that counts evidence deltas and blocks a repeated route | ADR-118 § 3 on new loop surfaces; the transition detector is deferred for "a mechanism without a matched failure mode" (the same context, `:54-61`); the third instrument is deliberately unwired until 2026-12-12 | Same |
| K8 | A failing check on lapsed `review_by` dates | "this is a QUERY, not a gate" (`src/scripts/stubs_due.ts:34`) | 40 of 122 stubs are past their date at the pin; the dashboard shows the count |
| K9 | Widen the continuity inventory's scan to `agents/state/` here | It would move counted rows against recorded targets in a change about comments | Parked with its entry condition |
| K10 | Reaffirm the stale user-type baseline to make the aggregate green | Refused once as owner-reserved; the clock "exists to force this decision" | An earlier draft of this file planned it |
| K11 | Drop `compact` from the injecting sources on this file's own reading | It abandons a ticked step without asking; the same reasoning would have to cover the prose handoff | Same; replaced by the council question of 4.2 |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-05 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Something outside the two named readers reads the removed fields | implementation | The state file is addressed by path, so an import graph does not show its readers. | 1.2's test greps `src/` and `docs/` for both field names after the change and fails on any hit. | Phase 1 — The loop flag |
| 2 | Rewording a stop into a strategy shift changes what a model does at the third failure | product | Four files tell it to stop or ask; after 2.4 they tell it to change approach. | That is the rule's text since its bound moved to ten, and it holds as well for the five lines of 2.3 that stated three as a bound of their own; 2.4 leaves a note with the roadmap that owns the criterion. | Phase 2 — Sentences beside the value they describe |
| 3 | Moving evidence loses what a step was closed on | product | A step's dated paragraph is sometimes its only record of why the box is ticked. | 3.1 moves text verbatim and leaves a dated pointer in place; nothing is summarised or deleted. | Phase 3 — The trunk's own checks |
| 4 | The corrected cap sentence reads as a regression | product | A setting described as a hard cap is now described as advisory. | D3 records that nothing ever enforced it; the sentence changes, the behaviour does not. | Phase 2 — Sentences beside the value they describe |
| 5 | The two roadmaps grow past the cap again within a week | product | Both crossed it in single commits of dated evidence. | 3.2 puts the remedy in the message the next author reads; nothing here limits what a re-read may append. | Phase 3 — The trunk's own checks |
| 6 | A per-turn reset lets a second self-review through | implementation | With the marker repaired, the count starts at zero in every user turn, which is what the hook's comment describes and not what it has been doing. | 4.1's test states the intended behaviour from that comment; the concern's second-dispatch branch is advisory already. | Phase 4 — State that is read where it is written |
| 7 | The council question is answered from the comment instead of the reproduction | product | Until 2026-09-09 the resolver did return an own record, and the hook's comment still describes that. | 4.2 puts the reproduction and both records in the bundle and names the unmeasured point. | Phase 4 — State that is read where it is written |
