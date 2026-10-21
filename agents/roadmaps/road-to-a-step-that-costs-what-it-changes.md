---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Round inbox-2026-10-u verified at 553e58dfb that every roadmap step runs the same ceremony regardless of what it changes: classify_change_risk exists and its header says nothing consumes it (src/scripts/classify_change_risk.ts:25-32), `complexity:` has 0 references in roadmap-process-loop.md, process-full, pr/create and plan-review-gates.md, and probe_turnaround cannot split a step's time into change versus ceremony (src/scripts/probe_turnaround.ts:85,533). No active roadmap owns per-step depth: road-to-agent-throughput-recovery owns night-level throughput and waits until 2026-11-17; road-to-an-installed-layer-that-is-thinned owns the size of the standing layer, not how often a step pays for ceremony. Parking was rejected because this is the owner's third arrival of the slow-run subject and Phase 0-1 are floor-neutral work that can start now."
estate_growth_exempt: "+1 open_blockers: class-depth-flip-reopens-the-risk-null, added in this change. Lowering ceremony depth by change class re-uses the mechanism whose consumer phase was cancelled on a pre-registered null on 2026-08-23 (archive/road-to-target-project-assurance-readiness Phase 2); the decision-revisit gate requires that reopening be routed, not taken, so it is recorded as a blocker on the flip only. Every other phase runs."
relates:
  - slug: road-to-a-review-that-ends
    relation: disjoint
    note: "Sibling from the same round. Owns the completion-review round cap; the depth table here cites it for R2/R3 and does not re-plan it."
  - slug: road-to-agent-throughput-recovery
    relation: disjoint
    note: "Owns the night-level reading, the foreground CI wait (3.1/3.2), the -n guard misfire and the language-refusal split. Step 0.1 here adds a per-step reading beside its per-night one; nothing here edits its steps or its two windows."
  - slug: road-to-an-installed-layer-that-is-thinned
    relation: disjoint
    note: "Owns thinning ~/.claude/rules behind its own owner-gated default. Step 4.2 here decides rule depth per step class at run time and touches neither the installed layer nor its default."
  - slug: road-to-a-setup-that-decides-itself
    relation: disjoint
    note: "Carries the owner directive of 2026-10-12: no new lean/projection settings, form decided by default, only if AC does not get worse. No step here adds a settings key."
  - slug: road-to-a-cold-start-paid-once
    relation: disjoint
    note: "Owns warm workers and the concurrency cap. Its spawns get cheaper when Phase 3 here shrinks what a step loads; nothing here re-plans spawn economics."
  - slug: road-to-a-retro-the-merge-runs
    relation: disjoint
    note: "Merged #2541. Its per-merge retro is one row of the depth table (3.2) once the flip lands; nothing here edits its switch."
---
# Road to a step that costs what it changes

> **Source:** `agents/tmp.old/inbox-2026-10-u/` — one transcript of one owner
> turn (2026-10-20) and two externally drafted plans from parallel sessions,
> both pinned at `main@418a09379d`, re-verified against `main@553e58dfb` on
> 2026-10-21. One plan is adopted here with the corrections listed under
> *What verification changed*; the other is mostly satisfied or owned
> elsewhere (Decisions D4-D9).
>
> **The owner's demand, turn 1:** a step takes hours, roadmaps sized for two
> hours take days; it should not skip anything that is needed and not use
> anything that is not; AC must become effective again.

## Context — why a step costs the same whatever it changes

| # | Finding | Evidence at `553e58dfb` |
|---|---|---|
| C1 | No step-level reading. The probe classes tool calls over 60 s as blocking; model time and ceremony share are not classes. | `src/scripts/probe_turnaround.ts:85` (`BLOCKING_SECONDS = 60`), `:533`; `meanBatchSize` already exists at `:529` |
| C2 | A deterministic change classifier exists and nothing consumes it. | `src/scripts/classify_change_risk.ts:25-32`; callers are measurement only (`measure_risk_class_drift.ts`, `.github/workflows/risk-class-drift.yml`) |
| C3 | Its R3 share is above its own defect line: 0.536 (14 days) and 0.477 (30 days) against ≤ 0.40. | `agents/roadmaps/stubs/road-to-human-risk-corpus.md` § Promotion criterion |
| C4 | Ceremony depth is uniform: `complexity:` is read by none of the run procedures. | 0 hits in `roadmap-process-loop.md`, `process-full/command.md`, `pr/create/command.md`, `plan-review-gates.md` |
| C5 | A full run reads ~200 KB of procedure. | `wc -c`: `roadmap-process-loop.md` 66,475 · `process-full/command.md` 38,659 · `pr/create/command.md` 31,784 · `pr/merge/command.md` 43,511 · `roadmap-execution-contract.md` 16,114 |
| C6 | Steps are work packages; Decisions are read whole. | Active-roadmap steps p50 ~80 words, p90 ~270-320, max > 1,300 (two independent counts); largest active roadmaps > 140 KB; "Read it whole" at `roadmap-process-loop.md:162-173` |
| C7 | Record prose rivals the change: 1.0-1.1 lines of evidence/roadmap/ADR per line of code+test, first-parent 2026-10-06..20, generated `.patch/.json` excluded (two counts: 0.94 supplied, 1.10 re-derived; bucketing differs). | `git log --first-parent --numstat` over the window |
| C8 | Seven post-tool concerns are `effect: telemetry` and inject nothing, yet run in the foreground: chat-history, context-hygiene, orchestration-record, telemetry-usage, mcp-usage-observation, tool-result-bytes, journal-record. | `src/scripts/hook_manifest.yaml`, `platforms.claude` |
| C9 | Stop walks up to 8 MB of transcript every turn, because the turn ordinal cannot be answered from a tail. | `turn_end_gate_hook.ts:248`; `src/scripts/_lib/turn_end_transcript.ts:101-106` |
| C10 | Standing rules: 122 in `src/rules/`, none with `paths:`. The benchmark's measured lift sits in the kernel plus `downstream-changes` (3.3× tokens, +0.458, p = 0.0135); the full package adds 11.7× for a non-significant residual. | `docs/benchmark.md:104-112` (n = 24, two tasks, stated underpowered) |

The hook cost is real but small in wall-clock; the multiplier is the number of
turns per step — review rounds (sibling roadmap), uniform ceremony (C4),
procedure and roadmap reads (C5-C6), and record prose (C7). That multiplier is
what turns two hours into days.

This roadmap relaxes no Hard Floor, kernel rule, safety guard, review
independence or required CI context. Every ceremony it makes conditional keeps
a written trigger, and no depth is lowered before a shadow phase has measured
what the lowered depth would have missed.

## Goal

A roadmap step costs in proportion to its change, and nothing a step needs is
skipped. Finished means: over five consecutive drains after the flip in Phase 4,
p50 wall-clock per closed step is at most half the Phase 0 baseline; the
would-have-escaped rate measured in shadow (2.3) and the sampled escape rate
after the flip (4.3) on lowered-depth classes stay at or below the threshold
pre-registered in 0.2; and no R3 change runs below today's depth.

## Phase 0 — Read a step before cutting it

- [x] **0.1 Step anatomy in `probe_turnaround`.** Done 2026-10-21: `probe_turnaround --steps [--json]` over `src/scripts/_lib/step_anatomy.ts`; `--store` takes a comma list (drains write to worktree stores); classes sum per step (exit 1 if not); `unknown` fell from 53 % to 0 % once metadata rows stopped anchoring gaps; 7 tests, a sabotage of the ceremony branch reds 3 of them. Per closed step: `model`, <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/step_anatomy.ts -->
      `change` (edits/tests on the step's own paths), `verify`, `ceremony`
      (roadmap, evidence, review, council, PR text, archive), `wait` (CI, push,
      user, sleep), `refusal`; joined on the roadmap checkbox flip. Rows sum to
      the step total, `unknown` printed. `meanBatchSize` split per class.
      verify: a fixture with a planted ceremony turn classifies it; the sum
      check goes red with one class neutralised.
- [x] **0.2 Pre-register, then baseline.** Done 2026-10-21: thresholds committed as D14 first, then the reading as a `subsequent_readings` entry in `turnaround-budget.json` — 75 closed steps over 7 days, p50 4.2 min / p90 33.6 min per step; wait 53.5 %, model 30.3 %, ceremony 9.5 %, verify 3.9 %, change 2.8 %, unknown 0 %; R0/R1 only 9 of 75. D14's revisit-if fired (fewer than 30 R0/R1 steps a week): the threshold stays, the shadow window becomes as many weeks as 30 steps per class take. Commit the Goal's thresholds and the <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/turnaround-budget.json -->
      would-have-escaped threshold before reading. Then record p50/p90 per class
      and per change class as a `subsequent_readings` entry in
      `src/config/turnaround-budget.json` over the last 10 drains or 7 days,
      whichever comes first.
      verify: the threshold commit predates the reading commit.
- [x] **0.3 Classify the last 100 merged PRs.** Done 2026-10-21: PRs #2444-#2552 — R0 24, R1 5, R2 35, R3 36; R3 rate 0.36, under the 0.40 line; the largest R3 driver is `gate-violation-baselines.json` (8); `agents/evidence/analysis/change-class-last-100-prs-2026-10-21.md`. R0-R3 split and R3 rate. C3 <!-- receipt: class=R0 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural -->
      says the R3 share is near half; if it stays above 0.40 here, the depth
      table cannot speed up most steps and the override list is the first
      defect to fix.
      verify: one table, rows sum to 100, R3 rate stated beside C3's figures.

## Phase 1 — Floor-neutral speedups

- [ ] **1.1 Run the seven telemetry post-tool concerns `async`.** Measured 2026-10-21, not built: the telemetry concerns cost 1.2 ms p50 together per tool call (`bench_hook_latency --runs 30` with `AGENT_CONFIG_HOOK_TIMINGS`), against a ~68 ms post_tool_use dispatch; an async split saves ~1.2 ms and adds a second node start per call. Cancelling it is an owner call (D15). Only
      concerns whose `effect` is `telemetry` and that never emit
      `additionalContext` (C8). Hosts without an async hook form keep
      today's binding.
      verify: a census row per concern; a fixture shows no injected byte lost;
      `chat-history` still records every call.
- [ ] **1.2 Answer the Stop ordinal from state, then read the tail.** Measured 2026-10-21, not built: `readTranscriptTail` walks a 6.5-7.6 MB real transcript in 13-18 ms, once per turn; stored state would add risk to the turn-end gate for ~15 ms a turn. Cancelling it is an owner call (D15). Keep the
      turn ordinal and byte offset in the per-session state file so the
      design constraint at `turn_end_transcript.ts:101-103` is met without a
      full walk; fall back to the full walk when the state is missing or the
      file shrank.
      verify: detector verdicts identical on a 30-session replay; Stop p95
      lower; the fallback path covered by a test.
- [ ] **1.3 Read the current phase, `## Decisions` and `## Blockers` per step.** Contract changed 2026-10-21, verify pending: `--steps` counts roadmap text returned to `Read` and to shell reads per step (R2 finding 4 — an early tick on `Read` alone was withdrawn). Over 242 steps p50 0 KB, p90 33.7 KB; but the largest active roadmap had a step read 86.2 KB and the second 46.8 KB, over the target. The loop's § 5 step 1 now says: the step's own section by `grep -n` plus a ranged read, never the whole roadmap. Closes on the first drain over the largest roadmap reading < 40 KB per step.
      Other sections are read on demand. Decisions stay whole, as
      `roadmap-process-loop.md:162-173` requires.
      verify: a drain over the largest active roadmap reads < 40 KB of it per
      step (0.1 `ceremony` input bytes).

## Phase 2 — The class decides, in shadow

- [x] **2.1 Compute the class at step start and before the PR.** Done 2026-10-21: `step_receipt --range|--paths [--raise]` prints the marker (class, binding path, would-skip); the loop's § 5 flip appends it; 4 tests; the 8 steps ticked before it carry back-filled receipts from their commits. <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/step-depth-table.json --> The agent may
      raise it, never lower it; unknown resolves upward (the classifier already
      does). Nothing changes depth yet.
      verify: the step receipt carries the class and the paths it came from.
- [x] **2.2 One depth table, one file.** Done 2026-10-21: `src/config/step-depth-table.json`, `mode: shadow`; `process-full`, `pr/create` and `pr/merge` each name the row their ceremonies read (the § 9a danger gate deliberately has none). <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/step-depth-table.json --> Per class R0-R3: review (R0
      deterministic gates only; R1 one round; R2/R3 the sibling's cap; R3 plus
      a parallel independent seat), council (R3 or owner-reserved only),
      evidence (R0/R1 commit message and PR body; R2/R3 artefact), retro (R0/R1
      batched per drain), revalidation (deterministic stale check; council only
      on detected drift).
      verify: every ceremony in `process-full`, `pr/create`, `pr/merge` names
      its row.
- [x] **2.3 Receipt and would-have-escaped, in shadow.** Done 2026-10-21, re-scoped by the council (D16): `probe_depth_shadow` reports receipt coverage per class over ticks since 2026-10-21 and, with `--reviews`, the review row's would-have-escape per class from the review corpus — today R0 has no reviews at all (docs-only skip), R1 9 high/critical rows and 0 escaped, n = 4 reviews; the blocking check moved to 4.0, before anything is lowered. `agents/evidence/analysis/depth-shadow-retrospective-2026-10-21.md`. <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/probe_depth_shadow.ts --> Each step's receipt
      lists every ceremony run and the ones the table *would* skip. Where a
      would-skip ceremony ran anyway and found a high/critical row, that row
      is a would-have-escape.
      verify: receipt coverage and the would-have-escape count are reported per
      class (`probe_depth_shadow --reviews`).

## Phase 3 — Load what the step needs

- [ ] **3.1 Progressive disclosure for the five run procedures.** Partly done 2026-10-21 (D17): 198 KB of procedure became 76 KB of core plus eleven branch files, each under the 16,000-char depth ceiling; three cores are ≤ 15 KB, `roadmap-process-loop` (16,144) and `pr/merge` (15,698) are not; `procedure-core-budget.json` ratchets all five; the pinning tests read core plus branches. Each keeps a
      core path ≤ 15 KB; branches (conflicts, council, red CI, archive) move to
      references loaded on that branch.
      verify: core sizes in a ratchet; the run-loop fixtures pass unchanged.
- [x] **3.2 Steps ≤ 150 words, Done is one line.** Done 2026-10-21: folded into `lint_roadmap_complexity` via `_lib/roadmap_step_size.ts`; 104 of today's steps held in `roadmap-step-size-baseline.json` (106 after main's cold-start 2.5 and 3.3 arrived over the cap in the merge) (shrink-only, stale keys warned); template rule 29; a planted 400-word step fails, today's tree passes, raising the cap reds 2 tests. <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/roadmap-step-size-baseline.json --> Evidence goes to the commit
      and, for R2/R3, the artefact. A lint ratchet holds today's oversized steps
      and refuses new ones.
      verify: the lint fails a planted 400-word step and passes today's tree.

## Phase 4 — Flip, sample, roll back

- [ ] **4.0 A receipt on every newly ticked step, checked PR-locally.** Before
      4.1, a check refuses a ticked line in the PR's own diff that carries no
      receipt; older ticks and other branches are not read. Blocked on the
      same blocker as 4.1 — it exists only to serve the flip.
      verify: red-first test — a PR ticking a step without a receipt fails, a
      PR touching an older unreceipted tick passes.
- [ ] **4.1 Lower depth for R0/R1 per the table.** Blocked on
      `class-depth-flip-reopens-the-risk-null`.
      verify: the council verdict row exists before the flip commit.
- [ ] **4.2 Rule depth by class, behind an A/B.** R0/R1 steps receive the
      kernel plus rules whose triggers match the changed paths; R2/R3 keep
      today's delivery. Paired A/B on the benchmark's frozen tasks: discipline
      score not below the full arm's lower CI bound. No settings key.
      verify: the A/B report is committed before the flip commit.
- [ ] **4.3 Sampled full-depth audit and rollback.** 1 in 10 R0/R1 steps (1 in
      4 for the first 30 per class) gets a full round-1 review after merge,
      seeded and reproducible. If a class's escape rate exceeds 0.2's threshold
      over 30 samples, it returns to full depth automatically and the owner
      report names it. These agent-run audits do **not** feed the human-labelled
      corpus of `stubs/road-to-human-risk-corpus`; an agent label cannot be its
      reference standard.
      verify: a fixture with a planted escape flips the class back.

## Phase 5 — Prove both halves

- [ ] **5.1 Read the Goal over five drains.** Speed and escape rate together;
      neither alone closes the roadmap.
      verify: a Decisions row with both figures.
- [ ] **5.2 Independent review of the reading.** One round.
      verify: findings or an honest null over denominators and windows.

## Blockers

### blocker: class-depth-flip-reopens-the-risk-null
- **Status:** open
- **Class:** 3
- **Owner:** user
- **Ownership:** product-owned
- **Routed:** council 2026-10-21 ESCALATE — lowers a recorded safety floor (two seats, anthropic and openai, convergent on owner-reserved): the shadow phase (Phases 0-3, 2.1-2.3) is council-decidable and proceeds now; the flip itself is owner-reserved — one seat under "lowers a recorded safety floor", the other under "cannot be bounded" until the class is validated against human labels or R0/R1 are narrowed to structurally safe paths. Both noted that raise-only use of the class is available immediately (2.1 already does that).
- **Blocks:** steps 4.0, 4.1, 4.2, 4.3; AC-3
- **Question:** Phase 2 of the archived `road-to-target-project-assurance-readiness` let `classify_change_risk` decide what a completion claim must carry, and was cancelled on a pre-registered null on 2026-08-23 because the class was never validated against human labels. Step 4.1 lets the same class lower ceremony depth for R0/R1 steps. Once the shadow of 2.3 has counted would-have-escaped rows on at least 30 steps per class — steps that still ran at full depth, so a high-risk change misclassified as R0 is still reviewed and its findings still count — may depth be lowered, and for what?
- **Recommendation:** (d). It keeps the first flip inside paths whose risk the path itself bounds (documentation, roadmap and evidence prose, test fixtures), which answers the "cannot be bounded" reading without waiting on a human corpus, and widens to (a) only on the same shadow evidence.
- **If you do nothing:** Phases 0-3 run and deliver their savings; depth stays uniform; the shadow keeps counting.
- **What to do:** pick exactly one — (a) flip R0/R1 once 2.3 shows a would-have-escape rate at or below 0.2's threshold over at least 30 shadow steps per class; or (b) flip R0 only and keep R1 at full depth until 4.3 has 30 samples; or (c) do not flip until `stubs/road-to-human-risk-corpus` reaches its promotion criterion; or (d) flip only steps whose changed paths are all documentation, roadmap/evidence prose or test fixtures, on the same shadow threshold, and decide (a) later on 4.3's samples.
- **Resolved when:** the chosen option is recorded in this entry or in `docs/decisions/`, and Status reads resolved.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | reversible-technical | evidence | Hook `matcher` groups are not built here. Rejected alternative: Generate matchers from `tools:` (supplied plan W1.1). | Same mechanism as step 5.1 of `archive/road-to-per-turn-hook-economy`, cancelled: a matcher-scoped guard can silently disable on a host, guard tool-scoping is refused by `docs/contracts/hook-architecture-v1.md`, and an unscoped group still fires on every call. The inbox adds cost figures, not new evidence on the hazard. | The owner decides `b-guard-tool-partition` in that file. |
| D2 | reversible-technical | evidence | Pre-push stays full; it is not scoped to the diff. Rejected alternative: Path-scoped pre-push (supplied plan E6). | `road-to-agent-throughput-recovery` K5: declined 2026-08-30 because drift reaches CI; `install-hooks.sh:321-324` says the same; cost unchanged since. | A measured share of step wall-clock spent in pre-push from 0.1 exceeds 10 %. |
| D3 | reversible-technical | evidence | CI wait to background is not planned here. Rejected alternative: Supplied plan E7. | Owned by `road-to-agent-throughput-recovery` 3.1/3.2 and its pre-registered windows to 2026-11-17. 0.1's per-step wait share is handed to it. | That roadmap's 3.2 closes without a decision. |
| D4 | reversible-technical | evidence | No capability metadata IR, generic router or LLM routing. Rejected alternative: Supplied plan F2/F3, PR-D/PR-E. | The deterministic class (C2) is the cheapest selector that can lower depth; rule routing (`dist/router.json`) and skill ranking are owned by `later/road-to-a-menu-whose-precision-is-measured` and `later/road-to-deferred-rule-retriever`. | 5.1 misses its Goal with the class as the only selector. |
| D5 | reversible-technical | evidence | No CPU/RAM scheduler. Rejected alternative: Supplied plan F5/PR-H. | Rate side owned by `road-to-a-cold-start-paid-once` Phase 4; resident runtime by `stubs/road-to-runtime-orchestration-substrate`. No measurement here points at local resources. | 0.1 shows `wait` dominated by local contention. |
| D6 | reversible-technical | evidence | No canary rollout. Rejected alternative: Supplied plan F6/PR-I. | A package has no fleet to canary; the shadow plus 4.3's rollback is the equivalent. | — |
| D7 | reversible-technical | evidence | No new CLI verb. Rejected alternative: `agent-config perf …` (supplied plan). | `probe_turnaround` is the existing instrument; 0.1 extends it. ADR-041 governs slash-command verbs, not subcommands, so this is a choice, not a ban. | — |
| D8 | reversible-technical | evidence | `runtime_registry` is not cached. Rejected alternative: Supplied plan P1 cache item. | Its only caller is an on-demand CLI (`runtime_dispatcher.ts:33`); it is not on a hook or per-turn path. | A hook starts calling it. |
| D9 | reversible-technical | evidence | No per-step `acceptance_contract` / artefact hashes. Rejected alternative: Supplied plan § 5.2. | Steps already carry `verify:`; the receipt (2.3) records what ran. Adding a contract per step grows exactly the record prose C7 measures. | 5.1 shows revalidation in the `ceremony` class above 20 %. |
| D11 | reversible-technical | evidence | Kept from the supplied plan's kill register: no wholesale deletion of rules or skills; no model call to choose the class; Phase 1 is not gated on a measurement window; no daemon; no smaller model for R3 reviews. | Deletion conflicts with the completeness half of the owner's demand; a model-chosen class is a self-label (`classify_change_risk.ts:6-8`); Phase 1 is floor-neutral; resident runtime is owned elsewhere (D5); cost is the wrong axis at R3. | any of them is proposed again with new evidence. |
| D12 | reversible-technical | evidence | Review patch packets under `agents/evidence/` (~74 MB per the supplied annex) are not addressed here. | They cost clone size, not step wall-clock; nothing in 0.1's classes reads them. | 0.1 attributes measurable `ceremony` time to reading or writing them. |
| D14 | reversible-technical | agent | Pre-registered 2026-10-21, before the 0.2 baseline is read: (1) speed — p50 wall-clock per closed step over five drains after the flip ≤ 0.5 × the 0.2 baseline p50, all classes together; (2) would-have-escaped — per change class, over ≥ 30 shadow steps, at most 1 step in 30 whose would-skip ceremony found a high/critical row, and none critical; (3) the sampled audit of 4.3 uses the same threshold over its 30 samples; (4) CI red-after-merge over the same drains not above the 0.2 window. | Thresholds fixed before any baseline exists so the reading cannot choose them. Disclosed: while building 0.1 the instrument was run once over the main checkout's store alone (13 steps); the baseline reads every store of this repository, so that development run is a subset, not the reading. | the 0.2 reading shows fewer than 30 R0/R1 steps in a week, which makes threshold (2) unreachable in one drain cycle. |
| D13 | critical-technical | council: anthropic, openai (2026-10-21) | Phases 0-3 and the shadow run now; the flip waits on the owner; a fourth option (d) — flip only structurally safe paths first — was added from one seat's proposal. | Both seats: shadow is measurement and council-decidable, the flip is owner-reserved. One seat argued the shadow is selection-biased; rejected, because in the shadow every step still runs at full depth, so a misclassified R0 change is still reviewed and its findings still count as would-have-escaped. | the owner answers the blocker. |
| D17 | reversible-technical | agent | 3.1 stays open at two cores over 15 KB rather than closing on a target it missed: the loop core (16,144) keeps its Iron-Law fences with their headings, and the merge core (15,698) keeps the needs-council clearance check directly before `gh pr merge`. Both ceilings carry their reason in `procedure-core-budget.json`. | Moving a fence or the clearance check behind a pointer would meet the number and put an obligation where a reader stopping at the core never sees it — the pinned danger-gate test caught exactly that ordering. `check_depth_budget` fell from 4 violations to 3 with the loop split, and its baseline was lowered to match. | a later edit frees enough of either core to meet 15 KB without moving a fence or the clearance check. |
| D16 | reversible-technical | council: anthropic, openai (2026-10-21) | Step 2.3 measures without blocking: receipt coverage and the review row's would-have-escape are reported per class by `probe_depth_shadow`; a blocking receipt check arrives as 4.0, PR-local and only before depth is lowered. | Two seats converged on non-blocking now (first round degraded to one seat, the second ran both): a repo-wide check on every tick turns shadow instrumentation into mandatory ceremony before it has shown value, and would fail parallel branches' flips; the audit-trail half of a receipt only matters once something is skipped. One seat asked for class-stratified coverage, which the probe reports. | R0/R1 receipt coverage below half over a month of ticks, or the probe showing misclassified R1 steps. |
| D15 | reversible-technical | agent | Steps 1.1 and 1.2 are measured and not built; both are put to the owner for cancellation. | Async telemetry would move ~1.2 ms of a ~68 ms dispatch off the foreground for a second node start per call; a stored Stop ordinal would save ~15 ms per turn on a correctness surface. The supplied plan's hook and Stop costs (D9, D10 there) are real but not where a step's time goes: the 0.2 reading puts 53.5 % in waits and 30.3 % in model time. | a reading shows post_tool_use or Stop above 250 ms p50 on a real session. |
| D10 | deterministic | evidence | Closure pass ran 2026-10-21: no open decision beyond the blocker. The `typed-op` hits are mentions of the word merge (a sibling slug, the `pr/merge` path, "after merge", red-after-merge); no step here merges, deploys or publishes. Prose verifies on 0.3, 1.2, 1.3 and 3.2 are made command-shaped when each step runs. | `closure_scan` listed six `typed-op` and four `unfalsifiable-verify` rows, the latter non-blocking by its own contract. | a step is executed with its prose oracle unchanged. |

## What verification changed

- The plan's histogram said review rounds reach 9; they reach 25 (sibling
  roadmap F2). The finding is stronger, not weaker.
- "Four council rounds on one termination question" was four rounds on four
  questions; the council-cap step moved out (sibling D1).
- 138,212 preamble tokens is a history field in
  `preamble-payload-budget.json`, not a live reading; C10 cites the benchmark
  instead.
- The Stop tail-read step contradicted a stated design constraint; 1.2 meets
  it with stored state and a fallback.
- The sampled audit was proposed as the labelled corpus for the classifier;
  agent labels cannot be that reference, so 4.3 keeps the two apart.
- The class consumer was cancelled on a null once; the flip is now behind a
  shadow phase and a routed blocker instead of shipping directly.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-21 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A lowered-depth class lets a defect through | product | R0/R1 steps skip a ceremony that would have caught a defect. | Shadow first (2.3), routed flip (blocker), sampled audit with automatic rollback (4.3). | Phase 4 — Flip, sample, roll back |
| 2 | Most changes classify R3 and nothing gets faster | product | C3 already reads near half. | 0.3 measures it first; above 0.40 the override list is the defect, and Phases 1 and 3 still deliver. | Phase 0 — Read a step before cutting it |
| 3 | The async telemetry concerns lose records | implementation | A post-tool concern finishing after the turn drops its write. | 1.1's fixture and census; `chat-history` record count compared before and after. | Phase 1 — Floor-neutral speedups |
| 4 | This roadmap is run under the process it fixes | product | Its own steps pay the ceremony it measures. | Steps ≤ 150 words, one PR each, Phase 1 first. | Phase 1 — Floor-neutral speedups |

## Acceptance Criteria

- [ ] AC-1 — The Phase 0 reading is committed after its pre-registered thresholds.
- [ ] AC-2 — No R3 change ran below today's depth; receipts show it.
- [ ] AC-3 — Over five drains after the flip, p50 step wall-clock ≤ 50 % of the Phase 0 baseline and the escape rate on lowered classes ≤ the 0.2 threshold.
- [ ] AC-4 — Required CI red-after-merge rate over the same drains is not above the Phase 0 window.
