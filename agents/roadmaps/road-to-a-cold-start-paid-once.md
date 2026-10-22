---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Round inbox-2026-10-r verified at 9a943f30c that every subagent leg starts cold (median first-call written-or-uncached 242,891 tokens, agents/evidence/analysis/downshift-vs-cache.md:51) while the tree carries zero references to the host's resume primitive, rate-limit events or concurrency cap (grep over src, docs and agents/roadmaps for SendMessage, StopFailure, rate_limits, CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS returns nothing). No active roadmap owns spawn economics. Parking costs more because the owner asked for this to stop rate-limit refusals now; merging into later/road-to-worker-generation-recycling would wake a parked file whose Phase 2 waits on a primitive that does not exist and whose own posed owner question this plan only hands an answer to; merging into road-to-an-installed-layer-that-is-thinned would mix how many times a payload is paid with how big it is, which that file explicitly does not own."
estate_growth_exempt: "+1 concern_count on 2026-10-22: step 4.3 binds the host's StopFailure to the quota_parked writer, and no existing concern listens on agent_error — the slot had no binding at all — so the record-only host-rate-marker concern is the step itself, not a side effect; it exits 0 on every path. Earlier claim, unchanged: +0 open_blockers, both owner-reserved blockers this round raised were answered by the owner on 2026-10-14 (D11, D12)."
relates:
  - slug: road-to-worker-generation-recycling
    relation: extends
    note: "later/. Its Phase 0–1 capsule is the handoff format here (3.4); its Phase 2 waits on `host-worker-respawn`. Step 6.4 hands it an answer to its posed owner question and a correction to its Context; nothing here edits its plan."
  - slug: road-to-an-installed-layer-that-is-thinned
    relation: disjoint
    note: "Owns how large the standing layer is and its owner-gated default. This file owns how many times a task pays it. Step 2.5 measures what a worker sheds and hands the reading over (6.5); it never thins the layer."
  - slug: road-to-a-setup-that-decides-itself
    relation: disjoint
    note: "Carries the owner directive of 2026-10-12 — no new lean settings, form decided by default. No step here adds a settings key."
  - slug: road-to-billing-cliff-detection
    relation: disjoint
    note: "later/. Its S-1 prior expects no rate signal in the status line. Step 4.6 hands it the observation; that file keeps the billing-class question."
  - slug: road-to-compaction-survival-census
    relation: disjoint
    note: "Stub, unmeasured. Condition (e) in 3.1 treats a compacted worker as non-resumable instead of trusting survival."
---
# Road to a cold start paid once

> **Source:** `agents/tmp.old/inbox-2026-10-r/` — one transcript of three user
> turns and four supplied plans from two parallel sessions (two from each), all
> pinned at `main@9a943f30`, which is the tree this file was verified against
> on 2026-10-14. Zero commits separate the pin from the verification, so no
> claim below is stale; every figure carries its file and line.
>
> **The owner's question, turn 1 of the transcript:** can subagents be kept
> alive with memory released, so the full package context is not loaded again
> on every spawn — because the providers now refuse too many requests in a
> short window. Turns 2 and 3 asked for the analysis and the plan.
>
> **Owner turn of 2026-10-22 (`inbox-2026-10-z`), answered here:** start minimal setups and
> targeted workers — sessions or agents carrying only the rules and skills they need, the rest
> loaded on demand — so subagent runs cost fewer tokens. The highest-yield answers in the tree
> are this file's 2.5 (instruction skip) and 5.1 (lighter council seat launch); they are
> recommended ahead of the Phase 3 shadow window. No step changes. A per-task profile engine and
> headless sessions as the default worker form stay killed (K3, K4); the tier half of the same
> turn is `road-to-a-tier-the-dispatch-carries`.

## Goal

On a host where a re-task is observed to be cheaper than a fresh spawn, the
orchestrator re-tasks a warm worker instead of booting a cold one, never boots
one cold into a rate-limit event, and keeps concurrent workers under a count the
host enforces — every reuse decision taken by one pure function, every behaviour
change shipped first in shadow, and every saving either proved against a
pre-registered threshold or published as a null. A host without the observed
primitives behaves exactly as today.

## Prerequisites

| Building block | Evidence | Role here |
|---|---|---|
| Cold-start instrument, legs keyed by `agentId` | `src/scripts/cache_realization_report.ts:87-107` | Baseline; segmented in 1.1 |
| Cold start measured: first-call cache-read share 2.8 %, median written-or-uncached 242,891 tokens, 611 legs, host 2.1.233 | `agents/evidence/analysis/downshift-vs-cache.md:35-51` | The figure every gate compares against |
| Standing layer paid per spawn: 351,894 bytes unconditional, with its own bias note | `agents/evidence/analysis/per-spawn-standing-2026-10.md:11-13,29,59-68` | What `omit_project_instructions` would shed |
| Subagent ledger with hashed `ref`, never the host's id | `src/scripts/hooks/subagent_ledger_hook.ts:25-33`; `hook_manifest.yaml:1365` | Run boundaries, burst baseline |
| `spawn-guard-shadow` on `Agent`/`Task`, never blocks | `hook_manifest.yaml:1411-1417`; `src/scripts/hooks/spawn_guard_shadow_hook.ts:1-50` | The one carrier extended here |
| Its own window already shows bursts: `would_deny` at the widest candidate (≥ 8 open) in 96 of 325 records | `agents/roadmaps/archive/road-to-subagent-lifecycle-integrity.md` § Falsifier (Step 1), evaluated 2026-08-20 | Evidence the concurrency failure is real |
| Activation ladder: shadow → blocking, four flip conditions, reverse trigger | `docs/contracts/concern-activation-policy.md:28-36,67-92` | How anything here becomes blocking |
| Worker budgets 15k / 60k / 150k, capsule watermark 0.8 | `src/scripts/_lib/worker_budget.ts:27-29,49` | Retirement condition (d) |
| One capsule schema, three variants | `src/scripts/_lib/subagent_capsule.ts:144-147` | Handoff on retirement (3.4) |
| Skill-set signature | `src/scripts/mcp_server/metadata.ts:56` | Staleness condition (f) |
| Installed-package record | `src/scripts/_lib/installed_lock.ts:228` | Policy-epoch condition (h) |
| Judge Iron Law: no judge on the same model and context | `src/skills/subagent-orchestration/SKILL.md:41-50` | Freshness classes (2.4) |
| Lookup rung: lookups never spawn; ambiguous shape stays in-session | `src/agent-src/contexts/execution/auto-dispatch-classification.md:212-223`; `SKILL.md:110-111` | The in-session rung, unchanged |
| Host-env allow table, two size-cap rows, a third is a governance change | `src/scripts/_lib/host_env_write.ts:11-33` | Concurrency lowering (4.1) |
| `quota_parked` marker, record-only | `src/scripts/_lib/quota_parked.ts:1-31` | Host-sourced rate marker (4.3) |
| Observation protocol: a capability row needs host, version, transcript reference and date, never documentation | `src/agent-src/contexts/execution/host-capability-manifest.md:109-130` | Every Phase 1 row |

## Context — read at `main@9a943f30`

| # | Defect | Evidence |
|---|---|---|
| D1 | No warm-reuse path: every dispatch is a fresh leg and re-pays the cold start | `SendMessage`: 0 hits in `src/`, `docs/`, `agents/roadmaps/`; manifest fields `host_capability.ts:117-129` |
| D2 | Continuation is modelled only as kill-and-respawn, and the recycling roadmap is parked on that primitive | `host_capability.ts:69`; `later/road-to-worker-generation-recycling.md:14-20` |
| D3 | The recycling roadmap says workers "already carry only the kernel floor"; the per-spawn reading says every non-built-in subagent receives the full hierarchy | `later/road-to-worker-generation-recycling.md:83` vs `per-spawn-standing-2026-10.md:11-13` |
| D4 | The subagent schema is closed and its tool pattern admits nine names; no package worker can declare the host's reuse or loading knobs, nor be granted `SendMessage` | `src/scripts/schemas/subagent.schema.json:7,52` |
| D5 | The fork guidance states forking "changes the tool set and invalidates the very prefix"; host documentation now says the opposite. Unverified either way until observed | `SKILL.md:119-121` |
| D6 | On HTTP 429 the steering contract retries once, at once, one tier lower — a new model, a new cache and a fresh cold start while the limiter is saturated | `src/agent-src/contexts/execution/subagent-steering.md:34-40` |
| D7 | `subagents.max_parallel` is read by the model; "no code counts spawns against it" | `src/server/schemas/settings.ts:371`; `src/agent-src/contexts/subagent-configuration.md:13` |
| D8 | Host rate signals are unread; `StopFailure` is absent from the Claude event map | `hook_manifest.yaml:1765-1778`; `StopFailure`, `rate_limits`, `api_retry`: 0 hits in `src/` |
| D9 | No subagent cache TTL is set anywhere | `subagentPromptCacheTtl`: 0 hits |
| D10 | The instrument cannot see a resume: a resumed run shares its leg's `agentId`, so its first call folds into the original leg | `cache_realization_report.ts:87-107` |
| D11 | Council seats boot a full user environment per call and per round; the second provider runs a fresh `exec` per round | `src/scripts/ai_council/clients.ts:1701-1736,1844` |
| D12 | Resume needs an address and the ledger deliberately stores no agent id; names are the only address that may touch disk | `subagent_ledger_hook.ts:25-33` |
| D13 | The default posture adds spawns: parallel async dispatch "by default" | `SKILL.md:52-56` |
| D14 | Every steering rule this topic needs is prose; the tree measured that advisory carriers do not move behaviour | `concern-activation-policy.md:38-52` |

**Host surface, present in the installed binary.** Every host token this plan
leans on is present as a string in the installed host binary, version 2.1.296
(read 2026-10-14, offline): `SendMessage`, `omitClaudeMd`,
`subagentPromptCacheTtl`, `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS`,
`StopFailure`, `rate_limits`, `api_retry`, `quota_auto_resume_fired`,
`compact_boundary`, `safe-mode`, `setting-sources`. Presence is not behaviour:
none of these is an observation under the protocol, and Phase 1 exists because
of that difference.

**Two figures read with their bounds.** The 242,891-token median comes from
every project under the host's transcript root, not this repository alone
(`downshift-vs-cache.md:37`); it is the right scale for a cold start and the
wrong number to subtract from. Cached input on the second provider reportedly
still counts toward its token limits — an unverified community statement — so
for that provider the levers here are call count and concurrency, never payload
reuse.

## Phase 1 — See a resume before trusting one

Nothing in Phases 2–6 that reads a capability starts before its row exists.

- [x] **1.1 Segment a leg into runs.** `cache_realization_report` splits a leg at
      every `SubagentStart` that carries an already-seen ledger `ref`, and
      reports first-call metrics per run with an ordinal. Closes D10; without it
      no later claim is checkable.
      verify: `npx vitest run tests/scripts/cache_realization_report.test.ts -t resumed-run-gets-its-own-first-call --reporter=verbose` -> /✓.*resumed-run-gets-its-own-first-call/
      Done 2026-10-16: `segmentLegsIntoRuns` + `readLedgerStarts` in the report, `subagent_runs` in its JSON and text, new `--ledger-dir` flag; joins on `refFor` from the ledger hook, so no second hash.
- [x] **1.2 Burst baseline from the ledger that exists.** Spawns per 10 s and per
      60 s, maximum overlap, per session, over the current ledger window — no
      new capture. Filed with its window and its bound: `spawn_guard_shadow`
      lines carry no `session_id`, so per-session figures come from the
      start/stop lines only.
      verify: `ls agents/evidence/analysis/` -> /spawn-burst-baseline/
      Done 2026-10-16: `agents/evidence/analysis/spawn-burst-baseline-2026-10.md`, ledger window 2026-08-13 to 2026-10-16, with the open-record bound on the overlap rows.
- [x] **1.3 Council seats measured as their own population.** First-call
      written-or-uncached tokens per seat launch, separated from subagent legs,
      so Phase 5 has a baseline of its own.
      verify: `grep -c 'council seat' agents/evidence/analysis/spawn-burst-baseline-2026-10.md` -> /^[1-9][0-9]*$/
      Done 2026-10-16: same file, n=4 joined seat launches, filed as a scale and not a subtrahend; Phase 5 should re-read.
- [x] **1.4 Observe `worker_resume`.** In a real session: a finished leg receives
      a follow-up by name, its next `SubagentStart` carries the same ledger
      `ref`, and that run's first call reads more than half its input from
      cache. Also record the cache-read share after a gap longer than five
      minutes, which is the run the plan expects to be cold.
      verify: `grep -c 'worker_resume' agents/evidence/investigations/host-continuation-observations-2026-10.md` -> /^[1-9][0-9]*$/
      Partial 2026-10-17, left open: on Claude Code 2.1.302 a resumed leg kept its ledger `ref` and read 99.7 % of its first call from cache; after a 6 min 51 s gap the resumed run read 0 % and rewrote the whole transcript. The resume was addressed by the host's per-run id, not by a durable name — the dispatch surface offered no name at spawn — so the by-name half is unobserved and `worker_resume` stays out of the registry row.
      Re-read 2026-10-21 on 2.1.305: the subagent tool still has no name parameter (`description, effort, isolation, model, prompt, run_in_background, subagent_type`), so the by-name half remains unreachable from the dispatch surface.
      Done 2026-10-21 on 2.1.306: with `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` set before the session, a spawn named `probe-worker` was re-tasked by that name, the resume's `SubagentStart` carried the same host agent id (so the same derived ledger `ref`), and its first call read 99.8 % from cache. The by-name half holds only under that experimental flag, so the registry row is left unedited — whether `worker_resume` may be recorded as conditional is a separate decision. Rows in the observation file's second 2026-10-21 addendum.
- [x] **1.5 Observe the resume admission point.** Whether `PreToolUse` fires on
      the `SendMessage` call that resumes a worker, and whether a deny there is
      honoured; and whether a resumed worker counts against
      `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS` or can push the running count past
      it. One supplied plan reads the host documentation as saying the cap
      checks new spawns only; that is the claim this row settles.
      verify: `grep -c 'SendMessage pre_tool_use' agents/evidence/investigations/host-continuation-observations-2026-10.md` -> /^[1-9][0-9]*$/
      Done 2026-10-21 on 2.1.306: `PreToolUse` fires on the `SendMessage` that resumes a worker, and a deny there is honoured (no `SubagentStart` follows). With `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS=1` the host refused a second fresh spawn while one subagent ran, but admitted a resume in the same window, so two ran under a cap of one: the cap checks new spawns only. Risk 1, observed.
- [x] **1.6 Observe fork cache sharing.** A fork's first call reads the parent
      prefix (share above half) and keeps the parent tool pool. Decides the D5
      correction text and nothing else.
      verify: `grep -c 'fork_shares_cache' agents/evidence/investigations/host-continuation-observations-2026-10.md` -> /^[1-9][0-9]*$/
      Done 2026-10-17: a fork's first own call read 99.8 % of its input from cache and reported the parent's tool list, on Claude Code 2.1.302; `fork_shares_cache: true` written into the `claude` registry row with that citation.
- [x] **1.7 Observe what skipping project instructions sheds.** Paired spawns,
      same task and model, with and without the host's skip flag: first-call
      written-or-uncached tokens **net of** the kernel floor and verbatim
      constraints the dispatch must then carry, and whether the installed
      `~/.claude/rules` layer is skipped too — the documentation names
      `CLAUDE.md` files only.
      verify: `grep -c 'net delta' agents/evidence/investigations/host-continuation-observations-2026-10.md` -> /^[1-9][0-9]*$/
      Done 2026-10-21 on 2.1.306, one pair via `--agents` with `omitClaudeMd: true` on one side: first-call total input 143,354 against 1,854, gross delta about 141,500 tokens; net of a floor-carrying definition of 3,582 bytes, about 140,000 tokens, roughly 58 % of the median cold start. The skip also drops `~/.claude/rules` (canary readback and token collapse), not only `CLAUDE.md`. n = 1, and most of the delta is the operator's user-level layer.
- [x] **1.8 Observe naming under agent teams.** A named spawn with the agent-teams
      flag set and unset; record which yields a resumable subagent and which a
      teammate.
      verify: `grep -c 'agent teams' agents/evidence/investigations/host-continuation-observations-2026-10.md` -> /^[1-9][0-9]*$/
      Done 2026-10-21 on 2.1.306: flag unset, the spawning tool takes no name and a send to the chosen name fails as unreachable; flag set, the name is accepted and the spawn is a resumable subagent (not a teammate) that answers to it. Neither arm produced a teammate.
- [x] **1.9 Observe the rate surfaces.** On one subscription session: status-line
      `rate_limits` after the first response, `StopFailure` with matcher
      `rate_limit`, `api_retry` in a print-mode stream, the `quota_auto_resume_*`
      notifications. Each gets `present`, `absent` or `not reached` with a date;
      `not reached` is a valid row, and no step forces a limit to get one.
      verify: `grep -c 'StopFailure' agents/evidence/investigations/host-continuation-observations-2026-10.md` -> /^[1-9][0-9]*$/
      Done 2026-10-21 on Claude Code 2.1.305, two print-mode child sessions on a subscription login: all four named surfaces **not reached** (print mode runs no status line; no limit was hit, so `StopFailure`, `api_retry` and `quota_auto_resume_*` had nothing to fire on). One unnamed surface was present: each print-mode stream carried a structured `rate_limit_event` with five-hour and seven-day utilisation. Rows in the observation file's 2026-10-21 addendum.
- [x] **1.10 Version floors.** Every observed field carries the host version it
      was seen on; resume, the skip flag, the cap and the subagent TTL arrived in
      different releases.
      verify: `grep -c '2\.1\.' agents/evidence/investigations/host-continuation-observations-2026-10.md` -> /^[1-9][0-9]*$/
      Done 2026-10-21: every observed field is tabled with the host it was seen on (2.1.302, 2.1.305, 2.1.306) in the observation file's § Version floors. These are seen-on versions, not first-shipped releases — no earlier host was probed — and the subagent cache-TTL setting itself was never exercised, only the default TTL's effect.

**Exit:** one baseline file and one observation file, every row in the
protocol's four-part citation. **Rollback:** both are evidence files only.

**Screen 2026-10-18 (drain lane, Claude Code 2.1.302).** 1.5, 1.7, 1.8 and 1.9
were not reachable from a dispatched leg: the project `PreToolUse` binding
records nothing per tool, so a `SendMessage` admission leaves no trace without a
temporary hook binding, which is a settings change a lane may not make; 1.7
needs an observed skip flag and 1.8 an environment flag set before the session
starts. 1.4's by-name half stays unobserved for the same reason as on
2026-10-17. 1.10 stays open until those rows exist. No row was written from
documentation.

The same screen, for the later phases. 3.3 needs per-worker state at
`PreToolUse` time (transcript tokens, last request, workspace facts) that the
ledger does not carry, plus the resume addressing 1.4 left unobserved; 3.5, 3.6
and 6.2 wait on its window. 4.3 and 4.5 bind hook surfaces and 4.6 waits on 1.9.
Phase 5 edits the council modules, an owner-gated surface for a lane. 2.5 and
6.5 wait on 1.7; 2.6 on its own holdout re-pin change.

**Screen 2026-10-21 (drain lane, Claude Code 2.1.305).** Each open step's
condition was executed rather than read from its status line. 1.9 closed from
two print-mode child sessions in an empty scratch project, and 4.6 with it. A
child session built to settle 1.5 — a `PreToolUse` hook on `SendMessage` bound
through `--settings`, then one spawn and one re-task — was refused by the
host's auto-mode permission classifier and not re-attempted in another form, so
1.5, 1.7 and 1.8 still need an operator-run session. The open rest, by what each
waits on:

- **1.5 → 3.3, 3.6's resume half, 4.2.** 3.3 also needs the 1.4 by-name half:
  on 2.1.305 the dispatch surface still offers no name, so a `would_resume`
  verdict would name a worker no call can address. Building stop-time worker
  state into the ledger before that exists would be a register nothing reads.
- **1.7 → 2.5, 6.5.** 2.5's fixture half (a dispatch that carries the kernel
  floor and the user's constraints) is only needed if skipping ships on, which
  the missing 1.7 reading cannot decide.
- **1.9 rows not reached → 4.3 → 4.5, 5.3.** `StopFailure` was not observed
  firing, so binding it would read a capability whose row is `not reached`;
  4.5 and 5.3 read the host-sourced marker 4.3 would write.
- **5.1, 5.2.** Change how council seats launch and resume — the reviewer every
  ratification here depends on — and need measured child-session launches of
  the kind the classifier refused for 1.5.
- **3.5 → 3.6 → 6.2.** A shadow window of at least 100 calls or two weeks after
  3.3 lands.
- **1.10** stays open until the 1.5, 1.7 and 1.8 rows exist.

**Screen 2026-10-21, second pass (Claude Code 2.1.306).** The operator left auto
mode and approved each probe at its prompt, so 1.4, 1.5, 1.7, 1.8 and with them
1.10 closed from operator-approved child sessions. That moves the downstream
waits:

- **3.3** is unblocked: the guard can bind `pre_tool_use` on `SendMessage`, and a
  named, resumable worker exists under the agent-teams flag. Its count must
  include resumes, because the host cap does not.
- **4.2** is unblocked: the row now states that the host cap does **not** bound
  a resume. Its two texts still say the resume half is unobserved.
- **2.5**'s measured half holds, at about 58 % against a 10 % bar. Its fixture
  half — a dispatch that carries the kernel floor and the user's constraints
  verbatim — is still unbuilt. 6.5 follows 2.5.
- Not changed by this pass: 4.3, 4.5 and 5.3 (`StopFailure` still not
  reached), 5.1 and 5.2, and the 3.5 → 3.6 → 6.2 window.

## Phase 2 — Workers that load what their role needs

- [x] **2.1 Two capability atoms with a reader.** `worker_resume` (read by 3.1)
      and `fork_shares_cache` (read by the D5 correction), both safe-default
      `false`, set `true` only from a Phase 1 row. `worker_respawn` stays
      untouched: no derivation, no deprecation.
      verify: `npx vitest run tests/scripts/_lib_host_capability.test.ts -t worker-resume-defaults-false --reporter=verbose` -> /✓.*worker-resume-defaults-false/
      Done 2026-10-16: both atoms in `host_capability.ts`, the contract table and the observation criteria; no registry row sets either.
- [x] **2.2 Open the subagent schema** with vendor-neutral fields —
      `omit_project_instructions`, `preload_skills`, `max_turns`, `background`,
      `cache_ttl`, `reuse` (`continuity` or `never`) — and `SendMessage` in the
      tool pattern. Host spelling lives only in the projector, as `model_tier`
      already does.
      verify: `npx vitest run tests/scripts/subagent_contract.test.ts -t reuse-field-projects-to-host-spelling --reporter=verbose` -> /✓.*reuse-field-projects-to-host-spelling/
      Done 2026-10-18: six fields in `subagent.schema.json`, `reuse` required; host spelling in `_lib/subagent_native_fields.ts`. `reuse` and `cache_ttl` are not projected — the host has no per-definition key for either. `omit_project_instructions` maps to the binary string `omitClaudeMd`, unobserved until 1.7, and no definition sets it.
- [x] **2.3 Two package workers, fixed at install.** `ac-worker`
      (`reuse: continuity`) and `ac-researcher` (`reuse: continuity`, read-only),
      each with the kernel floor in its body and a durable domain name. No
      per-task definition is ever generated. `preload_skills` ships empty: the
      host injects a preloaded skill's full body into every cold start, so a
      preload is added only for a skill a paired measurement shows the worker
      needs on almost every run. `cache_ttl` ships unset (decision D7).
      verify: `npx vitest run tests/scripts/subagent_contract.test.ts -t package-workers-preload-nothing --reporter=verbose` -> /✓.*package-workers-preload-nothing/
      Done 2026-10-18: `src/subagents/ac-worker.md` and `ac-researcher.md`, each carrying the generated safety floor (now kept current by `generate_subagent_floor`), shipped through `docs/wedge/` like `production-validator`. `ac-worker` holds no shell: an unscoped `Bash` grant is the over-broad grant the frontmatter-safety lint refuses, and a portable suite cannot scope it, so the dispatcher runs the check the worker names.
- [x] **2.4 Freshness classes are declared, not inferred.** Every judge,
      reviewer and `production-validator` definition carries `reuse: never`, so
      the Iron Law becomes a field a function reads.
      verify: `npx vitest run tests/scripts/subagent_contract.test.ts -t judges-are-never-reusable --reporter=verbose` -> /✓.*judges-are-never-reusable/
      Done 2026-10-18: `production-validator` is the only judging definition in `src/subagents/` (judges and reviewers are skills, not definitions) and declares `reuse: never`; the test fails any judging definition that does not.
- [x] **2.5 Skipping project instructions ships on only when both hold:** the <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/subagent_native_fields.ts -->
      1.7 net delta is at least 10 % of the median cold start, and a fixture
      shows the dispatch for a skipping worker carries the kernel floor and the
      user's constraints verbatim (`subagent-spawn-contract.md:154-156`). Either
      missing, it ships off with the reading attached.
      verify: `npx vitest run tests/scripts/_lib_subagent_spawn.test.ts -t skipping-worker-carries-kernel-and-constraints --reporter=verbose` -> /✓.*skipping-worker-carries-kernel-and-constraints/
      Partial 2026-10-21, left open: both conditions now hold. The 1.7 net delta is about 58 % against the 10 % bar. `composeSpawnBrief` carries the safety floor and the user's constraints verbatim for a skipping worker, and it refuses a skip that has no floor to carry; it went red before green in `_lib_subagent_spawn.test.ts`. The ship-on edit itself — `omit_project_instructions: true` on `ac-worker` / `ac-researcher` — is not made. 1.7 observed the flag only in the `--agents` JSON spelling, and the definition files project it through frontmatter as `omitClaudeMd`, a path never observed. Switching it on through that path would read an unobserved capability.
      Done 2026-10-22: the frontmatter path was observed on Claude Code 2.1.308 — a paired probe (`omitClaudeMd: true` in `.claude/agents/<name>.md` on one side) wrote 2,620 tokens on the skipping definition's first call against 144,138 (observation file § Addendum 2026-10-22). `ac-worker` and `ac-researcher` now declare `omit_project_instructions: true`; `production-validator` does not. Commit d5afdea316; test `package-workers-skip-project-instructions` in `tests/scripts/subagent_contract.test.ts`, red before green.
- [x] **2.6 Correct the fork premise** in `SKILL.md:119-121` from the 1.6 row —
      the premise only; the ordering and the council's cut of "always fork"
      (`SKILL.md:123-125`) stay.
      verify: `grep -c 'fork_shares_cache' src/skills/subagent-orchestration/SKILL.md` -> /^[1-9][0-9]*$/
      Open 2026-10-17, unblocked by 1.6 but reverted from the drain PR: editing this skill brings it into `check_routing_coverage`'s touched-skill scope, so it needs its first `evals/triggers.json`. Adding one moves the routing-coverage seed, the delivery-set and routing-signal published records, the trigger-eval presence ratchet and the sealed holdout pin (`trigger_corpus_holdout_pin`). Re-pinning a sealed holdout belongs in its own change, not in a premise correction.
      Done 2026-10-20: the skill gained its `evals/triggers.json` in #2482, so the routing-coverage obstacle is gone (`check_routing_coverage`: 1 touched skill, 0 without a corpus). The premise now reads from the 1.6 row — a background fork keeps the prefix and tool pool where the host row says `fork_shares_cache: true` — in `SKILL.md`, and the same premise was corrected at its three other sites (`prompts/README.md`, `auto-dispatch-classification.md`, `api-cost-levers.md`). The ordering and the cut of "always fork" are unchanged.

## Phase 3 — One decision function, recorded in shadow

- [x] **3.1 `_lib/worker_reuse.ts`, pure.** It runs only after the existing
      in-session and lookup rungs have declined to stay in-session, and returns
      `resume` only when **all** hold, else `fresh` with the failing reason:
      (a) same domain as the worker's durable name;
      (b) last request younger than the worker's effective cache TTL;
      (c) transcript tokens below the observed fresh cold start for that
          definition — a Phase 1 figure, never a constant;
      (d) below its capsule watermark (`worker_budget.ts:49`);
      (e) no `compact_boundary` in its transcript while the compaction census is
          unmeasured;
      (f) same worktree, branch head and skill-set signature as at its last stop;
      (g) its definition is `reuse: continuity`;
      (h) the installed package version is unchanged since its last stop — the
          policy epoch, so a resumed worker never carries rules the install has
          since replaced.
      The decision object carries every input it read, so no prose sets a
      number.
      verify: `npx vitest run tests/scripts/_lib_worker_reuse.test.ts -t one-fixture-per-refusal-reason --reporter=verbose` -> /✓.*one-fixture-per-refusal-reason/
      Done 2026-10-16: `src/scripts/_lib/worker_reuse.ts`. A missing observed cold start refuses as `no_observed_cold_start` instead of falling back to a constant.
- [x] **3.2 The register is a view, not a store.** Eligibility is computed from
      the ledger and the transcript at decision time; the worker's name is the
      address; no agent id is written anywhere.
      verify: `npx vitest run tests/scripts/_lib_worker_reuse.test.ts -t no-agent-id-reaches-disk --reporter=verbose` -> /✓.*no-agent-id-reaches-disk/
      Done 2026-10-16: `eligibleWorkers` derives the view from caller-supplied state; the module imports no I/O and no field can hold a host id.
- [x] **3.3 Shadow first.** `spawn-guard-shadow` records, on every `Agent` <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/scripts/hook_manifest.json -->
      call, the verdict `would_resume` with the eligible name or `fresh` with
      the reason. Where 1.5 observed `PreToolUse` on `SendMessage`, the concern
      is also bound to that tool and its open-dispatch count includes resumes,
      so one count covers spawn and resume; where it did not, the record says
      the resume half is unobserved. Still exit 0 on every path.
      verify: `npx vitest run tests/hooks/spawn_guard_shadow.test.ts -t records-would-resume-and-never-denies --reporter=verbose` -> /✓.*records-would-resume-and-never-denies/
      Open 2026-10-21, council-refused in three rounds (anthropic + openai seats, CLI, $0). The change was then reverted to the `origin/main` bytes of the manifest, the hook, `worker_reuse.ts` and both test files, under the three-refusing-round cap. What was built:
        - `SendMessage` added to the concern's `tools:`.
        - `shadowReuseVerdict()`, recording `would_resume` with the eligible name or `fresh` with reasons. `host_resume_unobserved` comes first, so a host row without `worker_resume` reads no worker.
        - A send classified by hashing its recipient with the ledger's `refFor`: an open ref is `message_running` (no thresholds); a same-session `subagent_stop`, found in a 1 MiB tail of the current or previous month file, is `resume`; anything else is `message_or_resume`.

      The rounds:
        - Round 1 (confirmed-non-expanding / refused): every send was counted as a resume.
        - Round 2 (refused 2/2): a stop from any session counted, and two whole ledger files were read per send.
        - Round 3 (ratified / refused): one blocking finding, that the tests invented the payload field `tool_input.to` rather than using a real host envelope.

      The probe logs of 2026-10-21 already answer that finding. On 2.1.306 a real `PreToolUse(SendMessage)` carries `tool_input.to` (with `recipient` and `recipient_kind: agent | name` beside it) and a top-level `session_id`. A fourth attempt starts from those three rounds, adds a sanitized verbatim envelope from that log as a fixture, and needs a fresh grant. Prompts: `agents/evidence/council/cold-start-spawn-guard-resume-review-r1-20261021.question.md`, `-r2-`, `-r3-`.
      Done 2026-10-22, fourth attempt (commit c3f7f1a199): the real `PreToolUse(SendMessage)` envelope from the 2026-10-21 probe log is the fixture (`to` is the worker name); `recordNamedSpawn` on `PostToolUse(Agent)` writes a `subagent_named` line carrying only a session-bound digest of the name (names over 128 characters are not recorded), so a send resolves `recipient_kind: name` against this session's spawns only, with no whole-file read. Still exit 0 on every path. Ratified with the run's gated diff (`agents/evidence/ratifications/subagent-system-2583-20261022.md`).
- [x] **3.4 Retirement is a handoff.** A worker failing (c)–(f) or (h) is not
      re-tasked; its successor is briefed from its `worker` capsule — the
      generation chain the recycling roadmap wanted, reached at task boundaries.
      verify: `npx vitest run tests/scripts/_lib_worker_reuse.test.ts -t retired-worker-briefs-successor-from-capsule --reporter=verbose` -> /✓.*retired-worker-briefs-successor-from-capsule/
      Done 2026-10-16: `briefSuccessor`. (b) also retires, per 4.4 and risk 2; (a) and (g) spawn plain fresh; a missing or invalid capsule falls back to stop-loss.
- [x] **3.5 File the shadow window** — at least 100 `Agent` calls or two
      weeks, the would-resume distribution and the refusal reasons. A window in
      which every reuse was refused is a valid null.
      verify: `ls agents/evidence/analysis/` -> /worker-reuse-shadow-window/
      Built 2026-10-22, waits on its window: `src/scripts/worker_reuse_shadow_report.ts` summarises the window (calls, would-resume names, refusal reasons, resumes, valid null). Read on the maintainer's ledger the same day: 0 reuse-bearing lines, because the recording guard (3.3) is not installed yet. Closes when the report over ≥ 100 `Agent` calls or two weeks is filed as `agents/evidence/analysis/worker-reuse-shadow-window-<date>.md`.
      Done 2026-10-23: `agents/evidence/analysis/worker-reuse-shadow-window-2026-10-22.md` — 107 spawn lines (a manufactured bench of 16 child sessions plus organic review work, labelled apart), 85 complete joins, **0 `would_resume`** (`transcript_over_cold_start` 64, `no_candidate` 21), 22 incomplete joins named by field. Verdicts are reconstructed at report time (council decision 1, D14; bc48e93a91, 9916f6e3d0). The null is the as-implemented result: condition (c) compares a whole transcript with written-or-uncached tokens, which D15 keeps unchanged and reads beside a pre-registered like-for-like second reading (also 0).
- [ ] **3.6 Flip only under the policy's four conditions**
      (`concern-activation-policy.md:67-85`), with a council ratification
      artefact and the reverse trigger shipped in the same change. Blocking form:
      deny the `Agent` call with a reason naming the eligible worker. The resume
      half becomes blocking only if 1.5 observed a deny on `SendMessage` being
      honoured; otherwise documentation says the resume count is observed, not
      enforced.
      verify: `ls agents/evidence/ratifications/` -> /worker-reuse-guard-flip/
      Built 2026-10-22, not flipped: `flipReadiness` in the same module encodes the four conditions — failure observed, false-positive rate measured and ≤ 1 %, economics measured and favourable, window met — and returns `ready: false` while any is unmeasured (`tests/scripts/worker_reuse_shadow_report.test.ts`). The blocking form and its ratification wait on 3.5's window. Owed before a flip: an indexed register, or a measured miss rate for the 1 MiB ledger tail read (ratification 2026-10-22).
      Evaluated 2026-10-23, not flipped: `flipReadiness` over the filed window returns `ready: false`, missing all four — no would-resume was observed (so no failure to catch and nothing to grade for false positives or price for economics), and 85 complete calls over 0.02 days miss the window. Closes when a window of ≥ 100 complete calls or two weeks, read under a decided condition (c) (D15), returns `ready: true`; then the blocking form, `worker-reuse-guard-flip` ratification and reverse trigger land in one change.
      Indexed 2026-10-22 (40786bb420): the ledger writes a digest-keyed index entry at every stop and named spawn, and the guard answers with one read; `spawn_guard_shadow.test.ts` › indexed register (two cases bury the answer under 2 MiB of later traffic) and › the ledger hook's own stop writes the index the guard reads (seen red with the write neutralised). The hook also receives only the five addressing fields it reads (`payload_fields`, e2e04d1aa3).

## Phase 4 — Rate pressure that waits instead of spawning

- [x] **4.1 Lower
      `subagents.max_parallel` into `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS`** as a
      third `WRITABLE_HOST_ENV` row. It bounds how many run at once, never
      whether a call happens, so the table's invariant (`host_env_write.ts:20-21`)
      holds. Default stays `3`; no key is added.
      verify: `npx vitest run tests/scripts/_lib_host_env_write.test.ts -t max-parallel-lowers-into-host-cap --reporter=verbose` -> /✓.*max-parallel-lowers-into-host-cap/
      Done 2026-10-18: third row in `host_env_write.ts`, `settingsKey` now a dotted path; the ADR addendum is `docs/setup/host-traffic-environment.md` § Addendum 2026-10-14, next to the 2026-09-30 decision. Written only when the key is set; the settings template sets it to `3`.
- [x] **4.2 Say what the cap covers.** The `max_parallel` description
      (`settings.ts:371`) and `subagent-configuration.md:13` drop "no code counts
      spawns" once 4.1 lands, and state whether the host cap bounds resumes, from
      the 1.5 row — never "the host enforces concurrency" without it.
      verify: `grep -c 'resume' src/agent-src/contexts/subagent-configuration.md` -> /^[1-9][0-9]*$/
      Partial 2026-10-18, left open: both texts (and the settings template) dropped "no code counts spawns" with 4.1 and now say the resume half is unobserved. The step closes when the 1.5 row states whether the cap bounds a resume.
      Done 2026-10-21: the 1.5 row says it does not. The `max_parallel` description, `subagent-configuration.md` and the settings template now say the host cap bounds new spawns only, and that a resume is neither bounded by the host nor counted by any package code yet (3.3 is unratified). "The host enforces concurrency" is claimed nowhere.
- [x] **4.3 Bind `StopFailure`** in the Claude event map to the `quota_parked` <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/scripts/hook_manifest.json -->
      writer, widened from council-only to host-sourced. Still record-only, per
      `quota_parked.ts:25-31`.
      verify: `npx vitest run tests/scripts/quota_parked.test.ts -t host-stop-failure-writes-marker --reporter=verbose` -> /✓.*host-stop-failure-writes-marker/
      Done 2026-10-22 (commits 8dedad4f8a, 5df71aacd6): a forced `StopFailure` on 2.1.308 carries `error: server_error`/`rate_limit` (addendum in `host-continuation-observations-2026-10.md`); `StopFailure` is aliased onto `agent_error` for claude, the `host-rate-marker` concern writes `quota_parked` with `source: host` on `rate_limit` only, and exits 0 on every path.
- [x] **4.4 Split the transient branch by error class** in
      `subagent-steering.md:34-40`: `rate_limit` causes no same-turn
      re-dispatch, the slice parks until a recovery signal, then re-runs the
      3.1 decision (a wait past the TTL fails (b) and retires the worker with its
      capsule); `overloaded`, 5xx and timeout keep today's single downshift; on a
      subscription `rate_limit` never downshifts. The rule was council-decided,
      so the change lands with its council ratification artefact.
      verify: `npx vitest run tests/scripts/_lib_subagent_steering.test.ts -t rate-limit-never-redispatches-same-turn --reporter=verbose` -> /✓.*rate-limit-never-redispatches-same-turn/
      Open 2026-10-18, council-refused three rounds (anthropic + openai seats, 2026-10-18), not shipped. The split itself was not contested; every round refused the state machine around it. Rounds 1–2 closed a double downshift via the post-recovery path, billing class as discriminator, an undefined recovery signal, unbounded parking, N=3 accounting, turn boundaries, a missing classifier and a helper that returned no next state. Round 3 left four open: a timeout after a partial response is still retried (discarding the late result does not stop the original run, so non-idempotent work can duplicate); "no status and no bytes" is not proof of a transport failure; a `Retry-After` longer than the run conflicts with the overloaded branch's same-turn redispatch; and the function does not refuse an already-exhausted slot. Residue for the next attempt, which starts from those four and needs an explicit idempotency or read-only precondition for a retried subagent. Round 4 (2026-10-18) reviewed a branch that closed those four and added a `retry_safe` precondition test-first (prompt `agents/evidence/council/cold-start-steering-review-r4-20261018.question.md`) and refused 2/2: `response_started` was checked after the status branches, the counters and the time left were not validated at runtime, and the provenance of `retry_safe` was unstated.
      Done 2026-10-20: rounds 5–10 (anthropic + openai seats, CLI, $0), each fixing the previous round's finding test-first — the three round-4 findings (5); a null slot that threw (6); a cast decision state, a non-boolean `retry_safe` and an unchecked classifier, now a discriminated union (7); inherited tier names (8); inherited values, getters and proxy traps, now an own-data snapshot (9); a revoked proxy outside the `try` (10). Round 10 ratified 2/2; artefact `agents/evidence/ratifications/cold-start-rate-limit-steering-20261020.md`, prompts beside the round-4 one, `agents/evidence/council/cold-start-steering-review-r10-20261020.question.md` the last. Non-blocking conditions carried there: no caller, no operational kill criterion beyond `emergency.orchestration_halt`.
- [x] **4.5 The same guard reads the window.** While a recent host-sourced <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/scripts/hooks/spawn_guard_shadow_hook.ts -->
      `quota_parked` marker exists, the shadow verdict for a new `Agent` call is
      `would_wait`, and after 3.6 a denial whose reason says "resume or run
      in-session". The marker alone is sufficient; a status-line snapshot is an
      optional second input, installed only by an opt-in wrapper that runs the
      user's existing status-line command and never replaces it (decision D4),
      read against the pre-registered threshold (decision D5).
      verify: `npx vitest run tests/hooks/spawn_guard_shadow.test.ts -t recent-rate-marker-yields-would-wait --reporter=verbose` -> /✓.*recent-rate-marker-yields-would-wait/
      Done 2026-10-22 (commit d4c716ba4d): `recentHostMarker` reads host-sourced markers inside the five-hour plan window; the shadow line of a new `Agent` call carries `rate_window: would_wait | clear`. The denial wording waits on 3.6; no status-line wrapper was added (D4 leaves it optional).
- [x] **4.6 Hand the rate-surface rows to their owner.** The 1.9 verdicts are
      appended to `later/road-to-billing-cliff-detection.md` under its S-1
      prior; the billing-class question stays there.
      verify: `grep -c 'host-continuation-observations-2026-10' agents/roadmaps/later/road-to-billing-cliff-detection.md` -> /^[1-9][0-9]*$/
      Done 2026-10-21: appended under its S-1 prior, including that the one present rate surface (`rate_limit_event` on a print-mode stream, with `overageStatus` and `isUsingOverage`) bears on its S-3 row rather than S-1; the billing-class question stays there.

## Phase 5 — Council seats that do not boot a workstation

- [x] **5.1 Probe a lighter seat launch per CLI version** in <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/ai_council/cli_agency_bounds.ts -->
      `src/scripts/ai_council/cli_agency_bounds.ts`: the safe-mode flag (keeps
      subscription login, skips instruction files, hooks, plugins, MCP and auto
      memory per the host documentation) and the setting-sources flag without
      `user`. Record first-call tokens against the 1.3 baseline and whether
      `~/.claude/rules` loaded. The bare flag is excluded: it drops subscription
      login.
      verify: `npx vitest run tests/scripts/ai_council/cli_agency_bounds.test.ts -t light-launch-is-probed-per-version --reporter=verbose` -> /✓.*light-launch-is-probed-per-version/
      Done 2026-10-22 on Claude Code 2.1.308, subscription login: the seat argv's first call carried 145,587 tokens and saw a user rule; `--safe-mode` 2,790 and `--setting-sources project,local` 3,548, neither saw it, both kept the login. Rows in `LIGHT_LAUNCH_PROBES` and `spawn-burst-baseline-2026-10.md` § Step 5.1; the Anthropic seat now launches with the selected flag only on the probed version (commits eaf5811486, b63871b61f). n = 1 per arm.
- [x] **5.2 Non-blind multi-round questions continue the seat session** inside <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/ai_council/clients.ts -->
      the TTL — the first provider's resume flag, the second's `exec resume`.
      Blind rounds keep fresh sessions by construction; resuming one would leak
      the reviewer's earlier position.
      verify: `npx vitest run tests/scripts/ai_council/clients.test.ts -t blind-round-never-resumes --reporter=verbose` -> /✓.*blind-round-never-resumes/
      Done 2026-10-22 (commits be6e3b3a3d, defbc6fdae): `seatResumeArgs` resumes only a non-blind call inside the 5-minute cache TTL. The anonymised debate rounds are blind by construction and stay fresh; the stance repair, which asks a seat about its own reply, resumes. Probed live the same day, n = 1 each: `claude --resume` with the seat flags recalled the planted word with 2,355 cache-read tokens; `codex exec resume` recalled it with 20,224 cached tokens, refuses `--sandbox`, and keeps the bound as `-c sandbox_mode="read-only"`. The codex seat now records `thread.started` as its session.
- [x] **5.3 Above the window threshold, the existing gates decide stricter.** <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/ai_council/necessity.ts -->
      `ai_council/necessity.ts` and `low_impact.ts` apply their stricter bar
      while a host-sourced rate marker is recent. No new throttle.
      verify: `npx vitest run tests/scripts/ai_council/necessity.test.ts -t rate-marker-raises-the-bar --reporter=verbose` -> /✓.*rate-marker-raises-the-bar/
      Done 2026-10-22 (commit 604d512a3b): `classify_necessity` applies the strict bar on every lens while `recentHostMarker` is true; `council_cli` passes it. `low_impact.ts` is left unchanged, recorded here as a deviation: its only lever is the corpus-similarity threshold, and raising it routes more questions to the full council — the opposite of what a rate window wants. No new throttle.

## Phase 6 — Prove it or record the null, then hand off

- [x] **6.1 Pre-register four claims in `docs/CLAIMS.md` before 3.6**, and run
      `build_proof` in the same change: `warm-worker-cold-start-relief` —
      resumed runs' first-call written-or-uncached tokens at most 20 % of the
      same definition's fresh median, over at least 30 resumes across at least
      five sessions; `rate-limit-stops-per-drain` — `StopFailure(rate_limit)` per
      drain run before and after Phases 3–4, same operator, same host version
      band, direction only; `fresh-spawns-per-drain` — direction only;
      `resume-non-inferiority` — verify-pass rate of resumed against fresh tasks
      of the same class, margin from decision D6.
      verify: `grep -c 'warm-worker-cold-start-relief' docs/CLAIMS.md` -> /^[1-9][0-9]*$/
      Done 2026-10-16: four `unbacked` pre-registrations, D6 margin set at -5 pp, `build_proof` run in the same change.
- [x] **6.2 Dated verdicts.** Each claim carries a verdict, positive or null; a
      sample that never fills is a publishable outcome. A cheaper resume that
      fails non-inferiority keeps the reuse half in shadow.
      verify: `grep -c 'resume-non-inferiority' docs/CLAIMS.md` -> /^[1-9][0-9]*$/
      Waits on its window 2026-10-22: the four claims stay `unbacked`. Their instruments now exist (shadow window report, host rate marker, seat resume); none has a sample yet, and a verdict written before one would be invented.
      Done 2026-10-23 (926483b4c5, `docs/CLAIMS.md`, `build_proof` in the same change), all on one manufactured window (O6): `warm-worker-cold-start-relief` **backed** (ratio 0.170, 64 resumes in 8 sessions); `resume-non-inferiority` **backed** (+10.9 pp pooled, +12.5 pp paired); `fresh-spawns-per-drain` **underpowered** (the arm prompts fix the count; revisit on a real drain pair); `rate-limit-stops-per-drain` **underpowered** (0 stops, no before/after pair, no plan-limit `StopFailure` observed). Evidence `agents/evidence/analysis/warm-worker-claims-2026-10-22.md`. The reuse half is non-inferior, so it is not held in shadow on quality grounds.
- [x] **6.3 Correct D3** in the recycling roadmap's Context, citing the
      per-spawn reading.
      verify: `grep -c 'per-spawn-standing-2026-10' agents/roadmaps/later/road-to-worker-generation-recycling.md` -> /^[1-9][0-9]*$/
      Done 2026-10-16: correction sub-bullet under the kernel-floor bullet, citing the per-spawn reading.
- [x] **6.4 Record the
      owner's answer** to the recycling roadmap's posed question on that file,
      with this plan's Phase 3 as the evidence the answer reads.
      verify: `grep -c 'road-to-a-cold-start-paid-once' agents/roadmaps/later/road-to-worker-generation-recycling.md` -> /^[1-9][0-9]*$/
- [x] **6.5 Hand the skip reading to the installed-layer owner.** If 2.5 shipped <!-- receipt: class=R0 · shadow · scope=safe · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural -->
      on, the per-spawn reading gets the third row its own text anticipates
      (`per-spawn-standing-2026-10.md:96-104`); if off, the 1.7 reading is
      linked there as the reason.
      verify: `grep -c 'host-continuation-observations-2026-10' agents/evidence/analysis/per-spawn-standing-2026-10.md` -> /^[1-9][0-9]*$/
      Done 2026-10-22: 2.5 shipped on, so the per-spawn reading gained its third row and a paragraph citing both skip observations; no byte figure was invented for it.

## Blockers

### blocker: recycling-question-gets-its-answer
- **Status:** resolved — owner chose (d) on 2026-10-14; written under the posed question in `later/road-to-worker-generation-recycling.md`; recorded as D11
- **Owner:** user
- **Ownership:** product-owned
- **Blocks:** step 6.4 only
- **Question:** The recycling roadmap's posed question — keep the parking, manufacture the sample, lower the floor, or close as an unmeasured null — now has a candidate replacement for its Phase 2: re-task a warm worker at task boundaries and brief a successor from the capsule (3.1, 3.4). Which option does the owner take?
- **Recommendation:** (d) — its option 4: close Phase 2 as an unmeasured null superseded in form by Phase 3 here, keeping the Phase 0–1 schema and capsule standing as this plan's handoff format. Mid-task respawn waits on a primitive no host offers; task-boundary handoff uses one the host documents.
- **If you do nothing:** step 6.4 stays open, every other step proceeds, and the recycling roadmap keeps its parking condition unchanged.
- **What to do:** pick exactly one — (a) keep the parking in `agents/roadmaps/later/road-to-worker-generation-recycling.md` unchanged; or (b) manufacture the Phase 1 sample by running long tasks, recorded as manufactured; or (c) lower its exit-gate floor to the real sample, with the confidence it costs; or (d) close its Phase 2 as an unmeasured null under its step 3.3 and point it at `agents/roadmaps/road-to-a-cold-start-paid-once.md` Phase 3.
- **Resolved when:** the chosen option is written under that file's posed question and this entry's Status reads resolved.

### blocker: third-writable-host-env-row
- **Status:** resolved — owner chose (a) on 2026-10-14: the third row is approved; step 4.1 writes the ADR addendum next to the 2026-09-30 decision and adds the row; recorded as D12
- **Owner:** user
- **Ownership:** product-owned
- **Blocks:** step 4.1 only; 4.2 waits on 4.1
- **Question:** May `WRITABLE_HOST_ENV` (`src/scripts/_lib/host_env_write.ts:30-33`), whose two-row shape the owner decided on 2026-09-30 and whose own text calls a third row a governance change, gain a row that writes `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS` from the existing `subagents.max_parallel`?
- **Recommendation:** (a). The row bounds how many workers run at once, never whether a call or an update happens, so the table's stated invariant holds; it adds no key; and the guard's own window already recorded eight or more open dispatches in 96 of 325 records.
- **If you do nothing:** concurrency stays prose the model reads; the shadow guard keeps counting it; nothing else in this plan waits.
- **What to do:** pick exactly one — (a) approve the third row: an ADR addendum next to the 2026-09-30 decision, then step 4.1 adds `{ variable: 'CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS', settingsKey: 'subagents.max_parallel' }`; or (b) refuse it: step 4.1 is cancelled and 4.2 documents that the host default applies.
- **Resolved when:** the chosen option is recorded in `docs/decisions/` or in this entry, and this entry's Status reads resolved.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | reversible-technical | evidence | The plan is built on the latest supplied consolidation and re-derived against the tree; its omitted sibling synthesis is folded in where it adds a mechanism (1.5, 2.3, 2.5, 3.1 (h), 4.5, 1.3, `fresh-spawns-per-drain`) | The latest plan declares a complete parent set of two; a third synthesis over the same two parents was written the same evening and is not in it | a later revision of either plan arrives |
| D2 | reversible-technical | evidence | One carrier: `spawn-guard-shadow`, extended. No prose rule is the mechanism for reuse, waiting or concurrency | `concern-activation-policy.md:38-52` measured advisory carriers unmoved | the shadow window shows the guard cannot see the shape |
| D3 | reversible-technical | evidence | The register is a derived view; no worker store, no `worker:*` CLI namespace — inspection stays with `routing:doctor` | `host-capability-manifest.md:104`; a store would be a second truth beside the ledger | 3.5 shows decision time too slow to compute from the ledger |
| D4 | reversible-technical | agent | The status-line wrapper is opt-in, offered once, never installed over a user's line; admission works from the `StopFailure` marker alone | The status line is the user's single slot | 1.9 finds the marker absent and the status line present |
| D5 | reversible-technical | agent | Five-hour window threshold pre-registered at 80 %, revisited after the first `rate-limit-stops-per-drain` verdict | Reversible, read only by a shadow verdict until 3.6 | the verdict is null |
| D6 | reversible-technical | agent | The non-inferiority margin is pre-registered in 6.1 before 3.6, never chosen after the data | `concern-activation-policy.md` § Deriving a threshold | — |
| D7 | spend-exhaustion | owner | `cache_ttl` ships unset (host default) on both workers. Owner answer 2026-10-14, option (b): `ac-worker` alone moves to a one-hour TTL once Phase 1's reading shows the gaps between re-tasks of the same worker falling mostly between 5 and 60 minutes; never before, never on the other worker | A one-hour write is priced higher and is spend; the host ignores the setting on usage credits, so the saving exists only on the metered path the reading must name | Phase 1's gap distribution does not fall in 5–60 minutes, or the host changes its TTL pricing |
| D8 | reversible-technical | agent | Own file rather than a fold | No active roadmap owns spawn economics; the nearest owner is parked on a missing primitive | an active owner appears |
| D10 | deterministic | evidence | Twelve `verify:` filters (1.1, 2.1–2.5, 3.3, 4.3–4.5, 5.2, 5.3) name test titles that do not exist yet in existing files; each step writes its own titled test, and its `-> /✓.*title/` expectation fails on a run where the filter skipped everything | `closure_scan` 2026-10-14 listed them as `unfalsifiable-verify` because the titles are absent today | a step lands without its titled test |
| D11 | product-owned | owner | The recycling roadmap's Phase 2 closes as an unmeasured null, superseded in form by this plan's Phase 3; its Phase 0-1 capsule stays the handoff format | Owner answer 2026-10-14 to blocker `recycling-question-gets-its-answer` (option d); five arrivals without the Phase 1 sample filling | a host ships a mid-task respawn primitive |
| D12 | product-owned | owner | `WRITABLE_HOST_ENV` gains a third row writing `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS` from `subagents.max_parallel`, via an ADR addendum next to the 2026-09-30 decision (step 4.1) | Owner answer 2026-10-14 to blocker `third-writable-host-env-row` (option a); the row bounds concurrency, never whether a call happens; the guard saw ≥ 8 open dispatches in 96 of 325 records | the host stops honouring the variable, or a resume path is shown to bypass it |
| D13 | product-owned | owner (run invocation, 2026-10-23) | A deliberately created measurement window is admissible when it consists of real, useful work and its evidence file labels it `manufactured` (owner decision O6) | the shadow window and the four 6.1 claims cannot fill from organic traffic in a run | — |
| D14 | reversible-technical | council:agents/evidence/council/subagent-system-2583-rest-decisions-20261022.md | `worker_resume` is a live probe on `claude` under the agent-teams flag; the hook records the precondition and join keys (`name_key`, `agent_type`, commit, directory digest, install epoch at stop and spawn); the 3.5 report reconstructs the full verdict at report time, labelled `reconstructed`, and rejects incomplete joins (decision 1, 2/2 (a)) | the dispatch bundle had 1,113 B of headroom against conditions (b)–(h) needing transcript, commit and package state | reconstruction diverges from the live function, or a transcript is gone before its report runs |
| D15 | reversible-technical | council:agents/evidence/council/subagent-system-2583-rest-condition-c-20261023.md | Condition (c) stays unchanged in `decideWorkerReuse`; the report adds a pre-registered second reading `c_like_for_like` (transcript against the fresh first call's total input) for information only, and a decision on (c) waits for a later window not used to choose it. Council split 1:1 in both rounds; this is the default nearest the status quo, listed for the owner | (c) compares a whole transcript with written-or-uncached tokens; it refused all 64 resumes the claims read as cheaper and no worse | a later window shows the second reading admitting resumes that verify worse, or the owner decides (c) directly |
| D9 | reversible-technical | evidence | The 429 split ships as a rule change with its council ratification artefact (4.4); flipping the guard ships with a ratification artefact under the four conditions (3.6) | Both change council-decided or consumer-visible behaviour | — |

## What this roadmap deliberately does not do

- **K1** "Always resume" — after the TTL a resume replays the transcript at full
  price, as a practitioner report states; Phase 1 observes it <!-- harvest:cold-resume-replays-the-transcript -->.
- **K2** A package-owned worker daemon or process pool — the host persists
  transcripts, and the package cannot observe a child's lifecycle
  (`stubs/orchestrator-spawn-injection.md:21`).
- **K3** Background sessions or agent teams as a rate fix — each is its own cold
  start.
- **K4** Per-task agent definitions mid-session — changing the agent set changes
  the tool's parameters and breaks the main conversation's cache.
- **K5** The bare council launch flag — it drops subscription login.
- **K6** Any new settings key (owner directive, 2026-10-12).
- **K7** Percentage savings targets — only pre-registered thresholds with a null
  exit.
- **K8** "Always fork" — cut by council; 2.6 corrects a premise only.
- **K9** Provider API continuation adapters, managed-agent backends, a hot/warm/
  cold context resolver, a rehydration engine, a new checkpoint schema — no
  consumer in this package, or already one schema with three variants.
- **K10** A reuse kill switch — `emergency.orchestration_halt` is the one audited
  switch (`docs/contracts/settings-classes.md:204`).
- **K11** Projecting the concurrency value to the second provider before a row
  for that host is observed.
- **K12** Re-injecting the full rule layer after compaction — condition (e)
  refuses a compacted worker instead.
- **K13** Changing the built-in one-shot agents (`Explore`, `Plan`) — not
  resumable by host design, and lookups already bypass them via the L0 rung.
- **K14** A bytes-on-wire axis for this mechanism — no instrument in the tree
  reads transfer volume, and the token and stop counts in 6.1 already decide
  the owner's constraint.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-23 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Resumes outrun the cap | implementation | A resumed worker may not count against the host's concurrency cap, so reuse can raise the very burst it was meant to lower. | 1.5 observes it; 3.3 counts resumes in the same open-dispatch figure; 4.2 never claims the host enforces what was not observed. | Phase 1 — See a resume before trusting one |
| 2 | A cold resume during a limit | product | A worker resumed after a long rate wait replays its whole transcript at full price at the worst moment. | Condition (b) retires it after the TTL; 4.4 re-runs the decision after recovery. | Phase 4 — Rate pressure that waits instead of spawning |
| 3 | Stale assumptions or rules in a long-lived worker | product | A resumed worker carries an earlier task's premises or a replaced rule set. | Conditions (a), (f), (h); capsule `assumptions[]` at every handoff. | Phase 3 — One decision function, recorded in shadow |
| 4 | Cheaper but worse | product | A resumed worker verifies less well than a fresh one and the saving hides it. | `resume-non-inferiority` keeps the reuse half in shadow on a miss (6.2). | Phase 6 — Prove it or record the null, then hand off |
| 5 | Skipping project instructions drops an obligation | implementation | A worker without the instruction hierarchy misses a constraint that only arrived through it. | 2.5 ships it on only with the kernel-and-constraints fixture and a net, not gross, delta. | Phase 2 — Workers that load what their role needs |
| 6 | A denial blocks legitimate work after the flip | product | The blocking guard refuses an `Agent` call that was needed. | ≤ 1 % tolerance, reverse trigger, `emergency.orchestration_halt`. Re-reviewed 2026-10-22: `flipReadiness` encodes the four conditions and refuses a flip on any unmeasured one; the 1 MiB tail read must be indexed or measured first. Re-reviewed 2026-10-23: the register is indexed (40786bb420); the filed window returns `ready: false` on all four conditions, and condition (c) is undecided (D15), so no flip is near. | Phase 3 — One decision function, recorded in shadow |
| 7 | Subscription limits count differently from the API | implementation | The token arithmetic of the API documentation may not hold for a subscription window. | Nothing assumes it; `rate-limit-stops-per-drain` counts stops, not tokens. | Phase 6 — Prove it or record the null, then hand off |

## Acceptance Criteria

- [x] **AC-1** Every capability a later phase reads has a dated row under the
      observation protocol, and a host without `worker_resume: true` changes no
      behaviour.
      Done 2026-10-22: every capability row is dated in `host-continuation-observations-2026-10.md`; `host-without-resume-records-fresh-before-reading-any-worker` (`tests/scripts/_lib_worker_reuse.test.ts`).
- [x] **AC-2** The owner's governing constraint holds: the plan reduces requests
      and concurrent cold starts in a short window, not only tokens —
      `rate-limit-stops-per-drain` and `fresh-spawns-per-drain` carry dated
      verdicts beside the token claim.
      Built, waits on its window 2026-10-22: both claims are pre-registered (6.1); the host marker (4.3) and the shadow `rate_window` field (4.5) are the instruments. No drain has run since they landed, so no verdict is written.
      Done 2026-10-23: both carry dated verdicts beside the token claim (6.2) — `rate-limit-stops-per-drain` and `fresh-spawns-per-drain` underpowered with their revisit conditions, `warm-worker-cold-start-relief` backed.
- [x] **AC-3** Every reuse decision comes from one pure function, with a fixture
      per refusal reason (a)–(h); no prose rule re-implements it.
      Done 2026-10-22: `decideWorkerReuse` › `one-fixture-per-refusal-reason`; `shadowReuseVerdict` agrees with it on every single-reason fixture.
- [x] **AC-4** No agent id is written to disk; workers are addressed by name.
      Done 2026-10-22: `no-agent-id-reaches-disk`; the `subagent_named` line stores `refFor(agentId)` and the name, never the id.
- [x] **AC-5** A definition declared `reuse: never` is never resumed or forked
      from an implementer (fixture).
      Done 2026-10-22: the `not_continuity` fixture (`reuse: 'never'`) and the refusal-order test in `_lib_worker_reuse.test.ts`.
- [x] **AC-6** A `rate_limit` failure causes zero same-turn re-dispatches
      (fixture).
- [x] **AC-7** Documentation and telemetry distinguish the guard's open-dispatch
      count, the host's spawn cap and whether resumes are inside it — no claim
      the host caps resumes without a row.
      Done 2026-10-22: `subagent-configuration.md` and the `max_parallel` description say the host cap bounds new spawns only (4.2); the shadow line separates `dispatch_kind: spawn | resume`.
- [x] **AC-8** The guard's shadow window is filed before any flip, and every
      claim in 6.1 carries a dated verdict, positive or null.
      Built, waits on its window 2026-10-22: `worker_reuse_shadow_report.ts` files the window and `flipReadiness` refuses a flip before it; the 6.1 claims are unbacked until the window fills.
      Done 2026-10-23: the window is filed (3.5) and the guard was not flipped (3.6); every 6.1 claim carries a dated verdict (6.2).
- [x] **AC-9** No settings key, no CLI namespace and no schema file beyond the
      opened subagent schema were added.
      Done 2026-10-22: no settings key, CLI namespace or schema file was added; the new concern `host-rate-marker` is a hook registration.

## Notes — how this file was derived

The source set is one transcript and two pairs of plans. The transcript's user
turns are the spine: turn 1 sets the goal and the governing constraint (the
refusals come from too many requests in a short window — so request count and
concurrency, not only tokens, decide done; AC-2), turns 2 and 3 ask for the
analysis and the plan. One supplied answer in turn 1 already noted that a resume
does not change the number of requests; that line is why Phase 4 exists beside
Phase 3.

The latest consolidation is the base. Its claims were re-verified at the pin and
hold, with one citation misapplied: it rejects a worker CLI namespace by citing
the command-verb ADR, which governs visible slash commands, not the CLI — the
rejection stands on D3 instead. It omitted a third synthesis over the same two
parents; that file's mechanisms were read item by item and folded in where they
add one (D1). Its broader ideas — a provider-neutral worker runtime, a context
store, provider continuation adapters, request coalescing, a permit pool as a
new store — were already killed in the base or are carried here as the guard's
single count (3.3).
