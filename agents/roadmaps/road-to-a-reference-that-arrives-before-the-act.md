---
complexity: structural
status: ready
tree_pin: c9556b655a
execution:
  mode: phase-checkpoints
relates:
  - slug: road-to-a-session-start-under-the-host-limit
    relation: sibling
    note: Owns the session-start size budget, the law form and the inactive-pack floors. This file owns only the reference duty and the two instruments it needs.
  - slug: road-to-an-installed-layer-that-is-thinned
    relation: sibling
    note: Owns the layer-form decision and the default flip. Nothing here moves the default.
  - slug: road-to-mixed-trigger-activation-cost
    relation: sibling
    note: Owns action-time delivery by file path (unbound by ruling E2). Step 2.2 here only computes what such a delivery would have to carry.
  - slug: road-to-a-map-that-knows-what-happened
    relation: blocked-by
    note: Holds the last byte of hook-bundle headroom; every hook-side step here waits on a shrink or a raise_log entry.
estate_offset_exempt: "Owner search over agents/roadmaps/*.md, later/, stubs/, skipped/ and archive/ for the required-reference gate (`reread_guard`, `read receipt`, `requires`, `load_context` delivery) returned no live owner: only an external suggestion in later/road-to-governed-evidence-production.md:23 and adjacent reread_guard wiring in road-to-a-map-that-knows-what-happened. Active because the invocation carried --process (operator asked for active execution, owner directive 2026-10-24 exception)."
estate_growth_exempt: "+1 active_roadmaps and +2 open_blockers: the inbox invocation carried --process, which executes the emitted roadmap in the same run, so it cannot park in later/; its two blockers (hook-bundle headroom, owner spend) hold the hook-side and paid steps the run will not execute."
---
# Road to a reference that arrives before the act

> **Source:** `agents/tmp.old/inbox-2026-11-z/` — owner transcript plus three supplied
> plans, 2026-11-07, drafted against `9e6e0f0`; claims re-verified at `c9556b655a`.

## Goal

The owner's question, turn 2 of the transcript: *can we collect and determine rule
references, then ensure with a gate that they were read or used?* This file answers it
with an instrument, not an assertion. Done means: for every tool action that a rule's
triggers name, the package can say which references were required, which reached the
context (delivered by a hook, or read whole by the model), and which did not — and the
default behaviour is unchanged until that record says a gate is worth its cost.

The governing constraint, stated by the owner once in the earlier rounds and repeated in
the supplied plans: **AC must not get worse on any host to get lighter on one.** Every
step here is observe-only or measurement-only unless a human-gated step says otherwise.

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

## Phase 1 — Two instruments, at zero model cost

- [ ] **1.1 Split the census hook buckets by visibility.** Key the hook buckets in
      `main_session_census.ts` by attachment type as well as event and hook, and report
      `model_visible_chars` (from `hook_additional_context`) apart from
      `stdout_chars` (from `hook_success`).
      verify: a fixture transcript carrying both types yields two buckets with the
      right totals; the existing census tests stay green.
- [~] **1.2 Prove hooks fire in each bench arm.** Add a per-trial invariant that reads
      the stream-json events and marks an AC arm `instrument-invalid` when no hook event
      arrived. The event shape is not in the tree; one cheap observed run pins it.
      human-gated: spend (one Haiku trial, cents) — `b-owner-spend`.
      verify: unit test over the pinned fixture stream; one real trial shows ≥ 1 hook
      event per bound event type for the package arm and 0 for `vanilla`.

## Phase 2 — Reference duty, observe-only

- [ ] **2.1 Compile the requires table.** A pure script derives, from each rule's
      `triggers` (`command`, `path_prefix`, `file_pattern`) and `load_context`, the
      references an action requires, marked `required` · `conditional` ·
      `informational`, with the referenced file's size in chars and whether it fits the
      8,000-char inject budget. Rule text is never copied into the table.
      verify: test over fixture rules — a `command: git commit` trigger maps to its
      `load_context` file; a keyword-only rule maps to no action; an oversized reference
      is flagged `omitted-budget`; a missing file is reported, not dropped.
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

## Phase 3 — Deliver or block, only measured

- [~] **3.1 Choose the policy by measurement.** Four arms on the same tasks: deliver,
      read-gate (block once per reference), nothing, full layer. Compare violation rate,
      extra turns and cost.
      human-gated: spend and owner ratification of any blocking default, with a
      false-positive ceiling registered before the run.
      verify: pre-registration committed before the first trial.

## Blockers

### blocker: hook-bundle-headroom

Owner: whoever lands the next hook shrink or `raise_log` entry. The hook bundle has 1 B of
headroom (`road-to-a-map-that-knows-what-happened`, step at line 255). Steps 2.2 and 2.3
add hook bytes and wait for it.

### blocker: b-owner-spend

Owner: user. Paid trials are owner-released; 1.2 needs cents, 3.1 needs a budget line.

## Risk Register

| # | Risk | Mitigation |
|---|---|---|
| 1 | The requires table drifts from the rules | Derived at build time from frontmatter, never hand-written |
| 2 | An observe-only ledger is read as a compliance proof | States are delivery facts; compliance stays with outcome checkers |
| 3 | A future gate loops on a large reference | Block at most once per reference per session; deliver when it fits the budget |

## What this roadmap does NOT cover

The session-start size budget, inactive-pack floors and the law form
(`road-to-a-session-start-under-the-host-limit`); the layer-form decision and the default
flip (`road-to-an-installed-layer-that-is-thinned`); action-time delivery by file path
(`road-to-mixed-trigger-activation-cost`); the skill menu (`road-to-skill-menu-economy`).
