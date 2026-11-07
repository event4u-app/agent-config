---
complexity: structural
status: ready
tree_pin: 62f4a05044
execution:
  mode: phase-checkpoints
relates:
  - slug: road-to-mixed-trigger-activation-cost
    relation: disjoint
    note: Owns action-time delivery by file path (unbound by ruling E2). This file was its Phase 5 until the owner extracted it on 2026-11-07.
  - slug: road-to-a-session-start-under-the-host-limit
    relation: disjoint
    note: Owns the session-start size budget, the law form and the inactive-pack floors.
  - slug: road-to-a-map-that-knows-what-happened
    relation: disjoint
    note: Holds the hook-bundle headroom that steps 2.2 and 2.3 need.
estate_offset_exempt: "Extracted from road-to-mixed-trigger-activation-cost Phase 5 by owner decision of 2026-11-07, recorded in agents/evidence/owner-directives/2026-11-07-wip-cap-25.md, which names road-to-a-reference-that-arrives-before-the-act; no other roadmap owns the reference duty (owner search over active, later/, stubs/, skipped/ and archive/ in round inbox-2026-11-z)."
estate_growth_exempt: "+1 active_roadmaps: the owner extracted the reference duty into its own active roadmap on 2026-11-07 (agents/evidence/owner-directives/2026-11-07-wip-cap-25.md); its blocker moves with it from road-to-mixed-trigger-activation-cost."
---
# Road to a reference that arrives before the act

> **Source:** `agents/tmp.old/inbox-2026-11-z/` — owner transcript plus three supplied
> plans, 2026-11-07, drafted against `9e6e0f0`. Landed first as Phase 5 of
> `road-to-mixed-trigger-activation-cost` (PR #2905); extracted by the owner the same day.

> **Arrivals:** 2 — latest `inbox-2026-11-za` (2026-11-07): two reviews of #2905 rank
> the 17 unreachable references and the 10 oversized ones as the P0 gap, and ask that
> the ~1,050 chars per `Bash` call not be used as a saving until the census is re-run
> (steps 1.3 and 2.4). Earlier: `inbox-2026-11-z`.

## Goal

Rule references an act requires, measured as delivered, read or missing. The owner's question, turn 2 of the transcript: *can we collect rule references and
ensure with a gate that they were read or used?* Done for this phase means: for every
act a rule's triggers name, the package can say which references were required, which
reached the context (delivered by a hook, or read whole by the model), and which did not
— and no default changes until that record says a gate is worth its cost. Constraint
carried from the round: **AC must not get worse on any host to get lighter on one**;
every step is observe-only or measurement-only unless it says otherwise. Compliance
("used") is never a receipt — it stays with outcome checkers (`turn-end-gate`;
`obligation-settle` in shadow), because ADR-202 closed the evaluator route.

## What the round established (verified, not copied)

- The read ledger exists but cannot carry the duty yet. `reread_guard_hook.ts` records
  `Read` calls with path and sha256 and **skips ranged reads**; it keys on `session_id`
  only (`deriveSessionKey`), is **not reset on compaction**, and does **not see `cat`
  through Bash**. The transcript states all three as present; none is.
- "Used" cannot be proved by a receipt. A model's line "I read and applied rule X" proves
  only that the model wrote it; ADR-202 closed the evaluator route (κ 0.472 vs 0.800).
  Compliance is an outcome check — `turn-end-gate` blocks today, `obligation-settle` runs
  in shadow.
- The census cannot yet say whether the per-`Bash` cost is model-visible.
  `_lib/main_session_census.ts:101-110` merges `hook_success` (dispatcher stdout) and
  `hook_additional_context` (what the model receives) into one bucket keyed by
  `hookName`, so the ~1,050 chars per `Bash` call in `docs/benchmark.md` may be largely
  output the model never sees.
- The bench has no evidence that hooks fire inside its own arms. A general probe exists
  (`agents/evidence/analysis/host-output-rewrite-probe-2026-10-20.md`, hooks fire under
  `claude -p`), but the bench passes `--setting-sources` per arm and nothing in
  `internal/bench` reads a hook event.

## Phase 1 — Two instruments

- [x] **1.1 Split the census hook buckets by visibility.** <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/main_session_census.ts --> Key the hook buckets in
      `main_session_census.ts` by attachment type as well as event and hook, and report
      `model_visible_chars` (from `hook_additional_context`) apart from
      `stdout_chars` (from `hook_success`).
      verify: a fixture transcript carrying both types yields two buckets with the
      right totals; the existing census tests stay green.
      > note: done 2026-11-07 — buckets keyed by attachment type, `model_visible`
      > true for additional context and for `SessionStart` / `UserPromptSubmit` stdout;
      > tool-hook stdout renders `(stdout, not model-visible)`. `docs/benchmark.md`
      > now says the 1,050-char `Bash` figure is open until the census is re-run.
- [ ] **1.2 Prove hooks fire in each bench arm.** Add a per-trial invariant that reads
      the stream-json events and marks an AC arm `instrument-invalid` when no hook event
      arrived. The event shape is not in the tree; one cheap observed run pins it.
      spend released 2026-11-07 (`agents/evidence/owner-directives/2026-11-07-wip-cap-25.md`).
      verify: unit test over the pinned fixture stream; one real trial shows ≥ 1 hook
      event per bound event type for the package arm and 0 for `vanilla`.

- [x] **1.3 Re-run the main-session census on the split buckets.** <!-- receipt: class=R0 · active · scope=safe · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural --> One fresh main
      session, `preamble_byte_census --main-session`, and report the `PostToolUse:Bash`
      figure as model-visible and stdout separately.
      verify: the census table shows both rows; `docs/benchmark.md` replaces the open
      1,050-char sentence with the measured visible figure.
      > note: done 2026-11-07 — 219 `Bash` calls, hook output on 3 (mean 562 chars, all
      > model-visible), ~8 chars per call; no tool-hook stdout recorded.
      > `agents/evidence/analysis/main-session-census-split-2026-11-07.md`.

## Phase 2 — Reference duty, observe-only

- [x] **2.1 Compile the requires table.** <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/rule_reference_requires.ts --> A pure script derives, from each rule's
      `triggers` (`command`, `path_prefix`, `file_pattern`) and `load_context`, the
      references an action requires, marked `required` · `conditional` ·
      `informational`, with the referenced file's size in chars and whether it fits the
      8,000-char inject budget. Rule text is never copied into the table.
      verify: test over fixture rules — a `path_prefix` / `file_pattern` / `command`
      trigger maps to its `load_context` file; a keyword-only rule maps to no act; an
      oversized reference is flagged `omitted-budget`; a missing file is reported, not
      dropped.
      > note: done 2026-11-07 (PR #2905) — 20 rules carry `load_context`; 17 of them are
      > reachable by no act; 10 references exceed the inject budget. Every `command`
      > trigger is a slash command, so no shell command (e.g. `git commit`) can derive
      > a reference today. Run: `task report-rule-requires`.

- [~] **2.2 Make the read ledger fit for the duty.** Key by `agent_id` when present,
      clear on `pre_compact`, and count a whole-file read through Bash (`cat <file>`).
      blocked: `hook-bundle-headroom` (1 B left; `road-to-a-map-that-knows-what-happened`).
      verify: tests for subagent separation, compaction reset and a `cat` read.
- [~] **2.3 Observe the duty.** At `pre_tool_use`, compare the 2.1 table with the
      ledger and record `required-pending` · `delivered` · `read` · `omitted-budget`
      per action, writing nothing into context and blocking nothing.
      blocked: `hook-bundle-headroom`.
      verify: a fixture session records one `required-pending` for `git commit` with no
      prior read, and `read` after a whole-file read.

- [x] **2.4 Classify the unreachable and the oversized references.** <!-- receipt: class=R0 · active · scope=safe · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural --> For each of the 17
      rules whose `load_context` no act reaches, record one of: prompt-only by design
      (the obligation is a disposition, no act shows it) · needs an act trigger (name
      the trigger kind, including a shell-command kind that does not exist yet) ·
      covered by an existing gate (name it). For each of the 10 references over the
      8,000-char budget: split, law-line plus pointer, or accept as read-on-demand.
      verify: a committed table under `agents/evidence/analysis/` with one row for each
      of the 17 rules and each of the 10 references the requires table names, each with
      its disposition and the file:line it rests on.
      > note: done 2026-11-07 — prompt-only 6 · covered by a gate or carrier 6 · needs an
      > act trigger 5 (3 need a shell-command kind that does not exist: commit-policy,
      > non-destructive-by-default, scope-control). Oversized: read-on-demand 6 · split 3 ·
      > law line plus pointer 1. `agents/evidence/analysis/rule-reference-reachability-2026-11-07.md`.

## Phase 3 — Deliver or block, only measured

- [ ] **3.1 Choose the policy by measurement.** Four arms on the same tasks: deliver,
      read-gate (block once per reference), nothing, full layer. Compare violation rate,
      extra turns and cost.
      spend released 2026-11-07; any blocking default still needs owner ratification, with a
      false-positive ceiling registered before the run. Needs 2.2 and 2.3 first.
      verify: pre-registration committed before the first trial.

## Blockers

### blocker: hook-bundle-headroom

Owner: whoever lands the next hook shrink or `raise_log` entry. The hook bundle has 1 B of
headroom (`road-to-a-map-that-knows-what-happened`, step at line 255). Steps 2.2 and 2.3
add hook bytes and wait for it.

### Resolved: b-owner-spend

Released by the owner on 2026-11-07
(`agents/evidence/owner-directives/2026-11-07-wip-cap-25.md`). Steps 1.2 and 3.1 may
spend; pre-registration before a paid run stays mandatory.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-11-07 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The requires table drifts | implementation | The requires table drifts from the rules it describes | Derived from frontmatter on every run, never hand-written | Phase 2 — Reference duty, observe-only |
| 2 | A ledger read as compliance | product | An observe-only ledger is read as a compliance proof | States are delivery facts; compliance stays with outcome checkers | Phase 2 — Reference duty, observe-only |
| 3 | A read gate loops | implementation | A read gate blocks repeatedly on a reference larger than the budget | Block at most once per reference per session; deliver when it fits | Phase 3 — Deliver or block, only measured |

## What this roadmap does NOT cover

The session-start size budget, inactive-pack floors and the law form
(`road-to-a-session-start-under-the-host-limit`); the layer-form decision and the default
flip (`road-to-an-installed-layer-that-is-thinned`); action-time delivery by file path
(`road-to-mixed-trigger-activation-cost`); the skill menu (`road-to-skill-menu-economy`).
