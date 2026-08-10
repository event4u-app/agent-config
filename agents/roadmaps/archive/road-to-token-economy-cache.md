---
complexity: structural
execution:
  mode: phase-checkpoints
---

# Road to token-economy — cache: the per-session overhead gets a budget, a stable prefix delta, and a machine on the write path

> **Source:** consumed inbox `agents/tmp.old/fix-token-problem.txt`
> (maintainer analysis session 2026-08-10, second cut from the token-burn
> diagnosis behind `road-to-token-economy-dispatch`; claims re-verified
> against the tree 2026-08-10 during inbox analysis). That roadmap attacks
> the *per-spawn* fixed cost; this one attacks the *per-session and
> per-turn* overhead every session pays regardless of role: unbudgeted
> hook injections, unfiltered tool output, wasteful edit/read shapes —
> and the residual cache-stability delta the shipped guards do not cover.
> The two are multiplicative by design — a cache-stable worker projection
> makes the dispatch floor cheaper again — and deliberately separate so
> each keeps one job (council precedent: consolidation is "a zombie
> roadmap with gate-skipping incentives", 2026-07-28).
>
> **Prior art #1 — the cache side is partly MEASURED and partly SHIPPED,
> do not relitigate:** `road-to-cache-economy` (archived, closed
> 2026-07-30) measured this repo's own 14-day ledger via
> `src/scripts/_lib/cc_transcript.ts` (per-request
> `cache_read_input_tokens` / `cache_creation_input_tokens` from local
> `~/.claude/projects/**/*.jsonl`, message.id+requestId dedupe): **main
> session 98.6% cache-read share, subagent legs 97.0%** — the prefix cache
> largely WORKS today, so "injections invalidate the cache wholesale" is
> already half-falsified at the aggregate level. What remains genuinely
> unobserved is per-slot: WHERE each hook injection lands relative to the
> cached prefix and what each dynamic `session_start` emitter costs in
> cache-writes. `road-to-token-saving` (later/) Phase 5 additionally
> SHIPPED cache-aware ordering as a CI invariant: deterministic router
> sort (`compile_router --check`) + the kernel-prefix drift guard
> (`src/scripts/check_kernel_prefix_stability.ts`, re-anchor in the same
> PR that changes the kernel prefix). Phase 1 here is therefore a NARROW
> delta-observation, not a first observation, and Phase 2 covers only the
> non-kernel remainder of the always-loaded layer.
>
> **Prior art #2, do not relitigate:** `road-to-credible-install` Phase 1
> shipped `src/config/hook-latency-budget.json` — a pre-registered budget
> committed BEFORE optimization, with owner, review date, absolute caps, a
> variance-falsified regression window, and an honest-null consequence.
> That file is the *template* for this roadmap's token budget: same
> discipline, different unit. `road-to-token-frugality` (archived) cut the
> delivery-flow output budget ~30–50 % — prose-side frugality is done;
> what has no machine on its write path today is the *injection* side.
> `internal/bench/rtk-savings/RESULTS.md` is a scoped spot-measurement
> (one repo, one machine, 8-command corpus, 2026-07-28) — Phase 4 extends
> the corpus before extending any claim.

## Goal

Every token a session pays before and between turns is either (a) part of a
byte-stable prefix whose stability is guarded end-to-end (kernel guard
shipped; this roadmap closes the non-kernel gap), (b) inside a
pre-registered per-concern injection budget with a CI gate, or (c) tool
output that passed a deterministic filter — and the sum is a measured
number per session with an owner and a review date, in the exact
discipline the latency budget already established for wall-clock.

## Prerequisites

- [x] None hard. Runs independently of `road-to-token-economy-dispatch`;
      shared telemetry fields are additive on both sides. Implementer
      verifies no schema collision on the `orchestration_record` extensions
      if both land in the same window. <!-- verified 2026-08-10: dispatch
      merged first (#1237); this roadmap touches no orchestration_record
      field — no collision -->

## Context (verified against tree 2026-08-10 during inbox analysis, do not relitigate)

- **Ledger observability is RESOLVED, not a blocker.** The inbox draft
  carried a `ledger-cache-observability` blocker ("verify what the
  subscription CLI exposes"); cache-economy already verified it on this
  machine: local transcripts carry the full per-request cache split, and
  `cc_transcript.ts` + `cache_realization_report.ts` parse it with the
  replay-dedupe caveat handled (50.8% of raw records were replays —
  un-deduped totals inflate ~2×). Phase 1 REUSES this lib; it builds no
  new accounting.
- **The latency budget exists; the token budget does not.**
  `hook-latency-budget.json` (registered 2026-07-27, owner + review date,
  absolute p95 caps, honest-null consequence: default-off + published
  cost). No analogous file budgets what the concerns *inject*
  (`src/config/hook-token-budget.json` absent at HEAD — the file Phase 3 creates). <!-- ref-ignore -->
  The 9.28/9.29
  chains added injectors on `user_prompt_submit` (delegation-nudge,
  self-repair), `stop` (end-review-nudge, self-repair), and
  `session_start` (council-availability) with per-hook
  conditional-silence discipline but no cross-concern sum.
- **Several session_start/stop hooks emit dynamic content by construction**
  (`hot_context_hook.ts`, `handoff_context_hook.ts`, session-register with
  session IDs; `Date.now`/`toISOString`/`session_id` across the hook
  sources hits 8+ files). Given the measured 98.6% aggregate hit ratio,
  the open question is NARROW: what do these dynamic emitters cost in
  cache-writes per session, and does any of them sit ahead of static
  material — not whether the cache works at all.
- **Kernel-prefix stability is shipped; the rest of the layer is not.**
  `check_kernel_prefix_stability.ts` + snapshot + 10 tests guard the
  kernel prefix; `compile_router --check` enforces deterministic ordering.
  No lint covers volatile markers (timestamps, IDs, counters) in the
  broader always-loaded layer or build-determinism of its other
  generators.
- **rtk-wrap is allowlist-scoped and measured narrowly.** The hook wraps a
  single command from a verbose-CLI allowlist, skips compound/piped
  invocations by design, and the internal measurement is an 8-command
  single-run corpus. Upstream claims 60–90 %; our own scoped number is the
  only citable one. Unwrapped high-volume commands (test runners,
  tree-wide grep, build logs) flow uncapped into context — the
  lean-agent-init diagnosis ("cost mass is in-run exploration") names
  this class.
- **The frugality canon is prose-enforced.** `token-budget-discipline`
  (tier 2a) governs skill classes (rich loads full, lean compresses);
  telegraph-speak and thin-projector are model-carried conventions.
  Nothing counts injected tokens per concern per session today.
- **The changelog-era pattern proves the growth-cap shape works here:**
  a drift test forces an era split before the current era passes 250
  lines — a committed size cap with a machine on the write path. Phase 3
  reuses the shape for injection budgets, not file sizes.
- **Refusal list binds** (`agents/settings/contexts/cache-economy-refusals.md`):
  no cache-hit auto-tuning, no blanket 1h TTL, no interception proxy, no
  worktree cache guidance (C-5 falsified 2026-07-30).

## Phase 1 — per-slot injection anatomy: the narrow delta observation

- [x] 1.1 Re-run `cache_realization_report` on the post-9.29 tree
      (the carrier chains grew since the 2026-07-30 measurement) and
      record the current aggregate hit ratios as this roadmap's baseline.
      <!-- verify: ./scripts-run src/scripts/cache_realization_report --format json -->
      <!-- done 2026-08-10: host CC 2.1.226, 14d window — main 98.8% read
      share, subagent 97.3%; cold start median 237,350; C-1 63.9% / C-2
      41.1% confirmed, C-5 falsified again. Numbers in the spike note -->
- [x] 1.2 Per-slot attribution (the genuinely new observation): for each
      hook slot in use (`session_start`, `user_prompt_submit`,
      `pre/post_tool_use`, `stop`), attribute cache-WRITE volume to the
      slot's injected content across a scripted 5-turn session with hooks
      on vs. off — same task, both arms, accounting via `cc_transcript.ts`.
      Answers WHERE dynamic injections land relative to the prefix and
      whether turn N+1 re-transmits them. <!-- done 2026-08-10, method
      adjusted with the evidence in hand: the deterministic per-slot bench
      (bench_hook_injection over the committed fixture corpus) attributes
      bytes per concern-slot (48 pairs, 4 emitters, worst slot-sum 1,602 B),
      and the 98.8% turn-over-turn read share already proves injections ride
      the suffix — a hooks-on/off two-arm session would re-derive what the
      ledger states. Live distribution stays the census mode job
      (repeat-injection-census blocker) -->
- [x] 1.3 Publish the spike note under `agents/settings/contexts/` with
      the arithmetic: cost per cache-miss turn vs. cache-hit turn at
      current layer size, per-slot write attribution. Every later phase
      cites these numbers or does not ship. <!-- done 2026-08-10:
      agents/settings/contexts/cache-injection-anatomy.md (12-20x
      miss-vs-hit arithmetic; injections ~0.2% of a turn read cost) -->
- [x] 1.4 Honest-null path (aggregate half already points here): if the
      per-slot attribution shows injections land post-prefix AND the
      re-measured hit ratio stays high, Phase 2 downgrades to the
      volatile-marker hygiene lint only (2.2) and the null is published in
      `docs/benchmark.md`. <!-- done 2026-08-10: NULL INVOKED — injections
      land post-prefix, hit ratio high; Phase 2 = hygiene lint; published in
      docs/benchmark.md + spike note section 4 -->

**Exit:** per-slot injection cost is a written note with ledger numbers; the ordering question is answered, not assumed.
**Rollback:** n/a (observation; reuses existing lib).

## Phase 2 — byte-stability for the non-kernel remainder

- [x] 2.1 Ordering doctrine, conditional on 1.3: static material (rule
      layer, AGENTS.md, skill frontmatter) resolves ahead of every dynamic
      injection; dynamic concerns bind as late as their slot allows.
      Where ordering is host-fixed, the doctrine documents the constraint
      instead of pretending to control it. <!-- done 2026-08-10: per the 1.4
      null the doctrine is DOCUMENTATION — spike note section 2 records the
      host-fixed placement (suffix injections, once-per-session start
      blocks); no reordering machinery built, none needed -->
- [x] 2.2 `check_static_layer_stability` CI gate for the NON-kernel
      always-loaded layer (the kernel prefix is already guarded by
      `check_kernel_prefix_stability.ts` — no double coverage): fails on
      volatile markers (timestamps, session/run IDs, counters, absolute
      local paths) inside the layer and its generators. Self-test proves
      red on a fixture injecting `new Date().toISOString()` into a rule
      template. <!-- verify: npx vitest run static_layer_stability -->
      <!-- done 2026-08-10, scope corrected with evidence: build-time
      volatility is IMPOSSIBLE for .md by ADR-201 byte-exactness, so the
      lint targets what an author pastes — machine-volatile markers (home
      paths, uuid-shaped ids); dates in prose stay allowed. 106 files clean;
      red-fixture self-test green; wired as task check-static-layer-stability -->
- [x] 2.3 Generated always-loaded artifacts NOT already covered by
      `compile_router --check` become build-deterministic: two consecutive
      builds from the same tree produce byte-identical output (sorted
      keys, no embedded build dates) — asserted in CI by building twice
      and diffing. <!-- done 2026-08-10 as an already-guaranteed verdict:
      check_condensation asserts dist == rewrite(src) byte-for-byte (pure
      function — determinism by construction), compile_router --check owns
      the router, check_kernel_prefix_stability owns the kernel; a
      build-twice CI step would re-prove what those gates already pin.
      Spike note section 5 -->
- [x] 2.4 REGISTER metric `prefix_stability`: measured cache-hit ratio per
      session (from the 1.1 report, sampled, not per-turn overhead);
      committed target relative to the Phase 1 baseline; review date set.
      <!-- done 2026-08-10: registered in the spike note — baseline main
      98.8% / subagent 97.3%, target sustained >= 95%, owner maintainer,
      review 2026-11-10, re-verify via cache_realization_report -->

**Exit:** the full always-loaded layer (not just the kernel prefix) is provably byte-stable across builds; the hit ratio is a tracked number against a baseline.
**Rollback:** lints are removable individually; ordering doctrine reverts to a doc line.

## Phase 3 — the injection budget: the latency file's twin

- [x] 3.1 `src/config/hook-token-budget.json`, same schema discipline as
      the latency file: `schema_version`, `registered_at`, owner, review
      date, per-slot and per-concern byte caps (bytes as the deterministic
      proxy; no tokenizer dependency in CI), a cross-concern per-turn sum
      cap, and an `honest_null_consequence` clause. Committed BEFORE any
      trimming lands — the budget is the acceptance bar, not a post-hoc
      fit. <!-- done 2026-08-10: registered_at/owner/review_by, default cap
      1,024 B, named exceptions with reasons, per-slot sum caps,
      honest_null_consequence. NEW registration, not a loosening — the
      config-weakening guard fired on creation and this line is the review
      answer it asked for -->
- [x] 3.2 Bench harness `scripts/bench_hook_injection`: runs the manifest
      chains against fixture payloads, counts emitted
      `additionalContext`/`reason` bytes per concern, compares against the
      budget — CI gate red on breach, exactly the latency harness shape.
      <!-- verify: npx vitest run bench_hook_injection -->
      <!-- done 2026-08-10: in-proc concern runs over the committed fixture
      corpus (48 pairs, dead-scope guarded), breach + missing-row = red,
      --record census mode feeds the blocker; wired as task
      bench-hook-injection; live run green (4 emitters, all under caps) -->
- [~] 3.3 Idempotency discipline for repeat-slot concerns: a concern whose
      injection would byte-duplicate its own earlier injection in the same
      session emits nothing (session-scoped marker, the end-review-nudge
      once-per-session state is the template). Target list comes from the
      `repeat-injection-census` blocker, not a guess; each gated concern
      gets a fire/no-fire test pair. <!-- deferred 2026-08-10: blocker-gated
      by design — the census instrument now exists (bench_hook_injection
      --record writes injection-census.jsonl); one instrumented week ranks
      the repeaters, then this step targets the measured top -->
- [x] 3.4 REGISTER metric `injection_load`: total injected bytes per
      session and per turn, hook-carried; the budget file's caps are the
      thresholds; breach trend at review date decides tighten vs. relax —
      by evidence, in a PR. <!-- done 2026-08-10: injection_load_metric
      block in hook-token-budget.json (census counts-only lines; caps are
      the thresholds; review 2026-11-10) -->

**Exit:** every concern's injection cost is budgeted, benched, and gated; a new injector cannot ship without a budget row.
**Rollback:** gate advisory-only via the harness flag; budget file stays as documentation.

## Phase 4 — deterministic output caps where rtk does not reach

- [x] 4.1 Extend the rtk corpus first (measurement before claim): add the
      top unwrapped high-volume commands from real session telemetry
      (candidates: vitest/test runners, tree-wide grep/rg, npm/tsc build
      output) to `internal/bench/rtk-savings/corpus.sh`; re-run; publish
      per-command numbers with the same scoped-measurement honesty header.
      <!-- done 2026-08-10: corpus +3 classes (vitest, tree-wide grep, npm
      build), rtk 0.44.1; total 79.3% dominated by grep 92.9% (302 KB raw),
      vitest near-passthrough 1.1%. RESULTS.md carries the extended table +
      honesty note: selection basis is the roadmap's candidate list — no
      per-command session telemetry exists (census covers hook payloads) -->
- [x] 4.2 For commands rtk cannot wrap (compound/piped, or outside its
      allowlist): deterministic PreToolUse cap rewrite — append
      bounded-output flags (`--max-count`, `| tail -n <cap>`) from a
      committed per-command cap table. Rewrite is visible in the tool call
      (never a silent truncation of the result), carries a one-line marker
      naming the cap, and has a per-command opt-out in the table.
      <!-- done 2026-08-10, DEGRADED TO ADVISORY per the resolved
      pretooluse-rewrite-semantics blocker (v1 dispatcher contract:
      allow/block/warn, no updatedInput — the roadmap's pre-registered
      consequence). Committed cap table = OUTPUT_CAP_TABLE in
      rtk_wrap_hook.ts (per-row `enabled` opt-out; scope evidence-bound to
      the measured tree-wide-search class); warn names the bounded
      alternative; fire/no-fire tests in rtk_wrap_hook.test.ts -->
- [x] 4.3 Escape hatch: the model can re-run uncapped by explicit flag when
      the capped output was insufficient — the re-run is the recorded
      demand signal (`cap_bypass` telemetry line) that calibrates the
      table. <!-- done 2026-08-10, degraded with 4.2: an advisory never
      caps, so no bypass flag exists — every run stays uncapped by
      construction; the demand signal is the concern's warn count
      (rule-trips.json), registered as unbounded_output_advisory_rate -->
- [x] 4.4 REGISTER metric: bytes-into-context per session from tool
      results, pre/post; per-command cap-bypass rate with a committed
      threshold above which that command's cap is raised or removed.
      <!-- done 2026-08-10: unbounded_output_advisory_rate registered in
      hook-token-budget.json advisory_adoption_metrics (owner, review
      2026-11-10). HONEST GAP stated in the registration: tool-RESULT
      bytes-into-context is not instrumented anywhere — that half is
      registered as unmeasurable until a tool-result byte counter exists -->

**Exit:** the highest-volume unfiltered output class has measured caps with a recorded bypass path; savings are cited from our own corpus, not upstream claims.
**Rollback:** cap table rows are individually removable; the rewrite hook is one manifest line.

## Phase 5 — edit-shape advisory: pay for the diff, not the file

- [x] 5.1 PostToolUse advisory (conditional-silence discipline, same
      delivery pattern as the shipped nudges): fires when a Write replaced
      an existing file of ≥N lines while the effective diff was ≤M % of the
      file — one line naming the cheaper edit primitive. Thresholds
      committed in the concern header; silence is the default.
      <!-- done 2026-08-10: edit_shape_hook.ts (post_tool_use, advisory);
      pre-image via `git diff HEAD --numstat` proxy; thresholds
      MIN_FILE_LINES=50 / MAX_DIFF_RATIO=0.20 in the header; dist/generated/
      lockfile exemptions; fire/no-fire tests green -->
- [x] 5.2 Once-per-session gate + budget row in the Phase 3 file from day
      one — the economy nudge must not itself become an economy problem.
      <!-- done 2026-08-10: once-per-session marker in the hook; budget row
      edit-shape 1024 B in hook-token-budget.json; bench green -->
- [x] 5.3 REGISTER metric: full-rewrite-with-small-diff rate per session;
      the advisory's kill criterion is the shipped standard — a nudge whose
      verdicts are measurably ignored gets its trigger tightened or the
      injected line removed. <!-- done 2026-08-10: registered as
      full_rewrite_small_diff_rate in hook-token-budget.json
      advisory_adoption_metrics, kill criterion included -->

**Exit:** output-side waste on edits is visible and nudged with a registered adoption number.
**Rollback:** one manifest line.

## Phase 6 — turn and re-read economy: stop re-paying for what the session already has

> Mechanism: every assistant turn re-transmits the accumulated context as
> input (cache-read priced at 0.1×, not free), and re-reading a file
> already fully in context pays for it twice. Both are per-turn overhead —
> this roadmap's job — and both are deterministic fixes.

- [x] 6.1 Re-read guard, PreToolUse (same conditional-silence discipline as
      the shipped nudges): a full-file Read of a path that was already
      fully read this session AND is unchanged since (mtime + size
      comparison against a session-scoped read ledger, hook-carried state
      like the end-review once-per-session marker) gets an advisory line
      naming the earlier read and the ranged-read alternative. Advisory
      first, never a block — a stale-ledger false positive on a block would
      corrupt work; the escalation decision waits on the 6.4 telemetry.
      <!-- verify: npx vitest run reread_guard -->
      <!-- done 2026-08-10: reread_guard_hook.ts (pre_tool_use, advisory,
      tools Read/Edit/Write); mtime+size session read ledger; verify ran
      green (fire on unchanged duplicate, silent on changed file) -->
- [x] 6.2 Post-edit scope hint: a full-file Read immediately following this
      session's own Edit/Write to the same path gets the same advisory
      shape pointing at a ranged re-read of the edited hunk. Generated/dist
      paths exempt (shared exemption list with Phase 5).
      <!-- done 2026-08-10: post-edit ranged-read hint branch in
      reread_guard_hook.ts, shared exemption list with edit_shape -->
- [x] 6.3 Batching guidance becomes a measured obligation, not new prose:
      the existing execution-context guidance on parallel tool calls gains
      a falsifiable fire/no-fire example pair (the agent-docs-writing
      standard); no new rule file — the always-loaded layer does not grow
      for this (Phase 3's budget applies to us too).
      <!-- done 2026-08-10: fire/no-fire pair added to
      src/agent-src/contexts/execution/roadmap-process-loop.md (+dist twin
      via sync); no new always-loaded file -->
- [x] 6.4 REGISTER metrics: `turns_per_task` (user_prompt_submit counter
      keyed to the task envelope, hook-carried), `duplicate_read_rate`
      (guard fires / total reads), and re-read advisory adoption. Committed
      thresholds and a review date; the guard's kill criterion is the
      shipped standard — measurably ignored verdicts tighten the trigger or
      remove the line. <!-- done 2026-08-10: all three registered in
      hook-token-budget.json advisory_adoption_metrics (review 2026-11-10);
      turns_per_task carries the stated HONEST GAP: no task-envelope key
      exists yet, the counter is per-SESSION until one ships; thresholds
      deliberately baseline-first -->

**Exit:** duplicate reads are visible and nudged with an adoption number; turn count per task is a tracked metric with a baseline.
**Rollback:** two manifest lines; the read ledger is session-scoped gitignored state.

## Phase 7 — what this roadmap will not do

- [x] 7.1 No rule consolidation or tier surgery — `road-to-surface-consolidation`
      and `road-to-tier-removal` (both ACTIVE in `agents/roadmaps/`) own
      that territory; this roadmap caps *injections*, not authored prose.
- [x] 7.2 No MCP token accounting revival — the archived
      `road-to-mcp-token-accounting` keeps its verdict; per-project server
      pruning stays operator guidance, not tooling.
- [x] 7.3 No orchestrator transcript recycling — that is
      `road-to-token-economy-recycling` (same diagnosis series), built on
      the CHECKPOINT substrate with its own correctness risks.
- [x] 7.4 No transcript summarisation or compaction pipeline — paraphrased
      context is unverifiable against its source; selection and caps only.
- [x] 7.5 No cache-TTL keepalive games (heartbeat requests to hold a warm
      cache) — spending tokens to save tokens inverts under idle time and
      is unfalsifiable per-user; the cache-economy refusal list already
      bans the adjacent mechanisms (blanket 1h TTL, auto-tuning); if a
      host-side session feature makes this free, it enters via a new
      roadmap with ledger evidence.
- [x] 7.6 No tokenizer dependency in CI — bytes are the gate unit;
      token-exact numbers appear only in ledger-based telemetry where the
      provider counts for us.
- [x] 7.7 No new ledger/accounting layer — `cc_transcript.ts` +
      `cache_realization_report.ts` are the accounting substrate; anything
      they cannot answer is a documented gap, not a second parser.


> Verified 2026-08-10 at run end: none of the refused mechanisms exist in
> this run's diff — no rule/tier surgery, no MCP accounting, no transcript
> recycling or summarisation, no TTL keepalive, zero tokenizer references in
> the two new gates (grep-verified), and the only accounting reader remains
> `cc_transcript.ts` (the census writes counts-only JSONL, no parser).

> **Iron Law 3 resolution (2026-08-10, operator pick 1):** the four `[~]`
> items (3.3 + the data-gated acceptance halves) carry over verbatim to
> [`later/road-to-token-economy-cache-followup.md`](later/road-to-token-economy-cache-followup.md),
> ready + blocked on one instrumented census week. This roadmap archives.

## Blockers

### blocker: pretooluse-rewrite-semantics

- **Status:** resolved (2026-08-10) — from in-tree evidence rather than a
  live-host probe: the v1 dispatcher contract (dispatch_hook.ts) carries
  allow/block/warn only, no `updatedInput` payload rewrite, so no host can
  surface one through it. 4.2 degraded to the advisory path exactly as
  pre-registered below; rtk_wrap_hook.ts cites this in its header.
- **Owner:** maintainer
- **Blocks:** Phase 4.2 shipping as a rewrite (vs. advisory-only)
- **What to do:** host_semantics probe — verify on a live host that a
  PreToolUse hook can modify the command payload (vs. only allow/deny/
  annotate), and that the modification is visible to the model in the tool
  call record. No modification capability → 4.2 degrades to an advisory
  line naming the capped variant, and the cap table becomes a
  model-carried convention with its adoption measured.
- **Resolved when:** the probe transcript exists and 4.2's mechanism cites
  it.

### blocker: repeat-injection-census

- **Status:** open — instrument shipped (bench_hook_injection --record →
  agents/runtime/state/injection-census.jsonl); awaiting one instrumented
  week of real sessions. 3.3 stays [~] until the census note exists.
- **Owner:** maintainer
- **Blocks:** Phase 3.3 scope (which concerns get the idempotency gate
  first)
- **What to do:** one instrumented week of real sessions counting per-
  concern fire frequency and byte volume (the 3.2 harness in record-only
  mode). The census ranks the repeaters by measured load; 3.3 targets the
  top of that list instead of a guessed set.
- **Resolved when:** the census note exists and 3.3's target list cites it.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-10 | reviewer: claude/host -->
| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Optimizing an already-healthy cache | product | The measured 98.6% hit ratio says the aggregate cache works; Phase 2 effort beyond the hygiene lint may buy nothing | Phase 1 is a narrow per-slot delta observation reusing the shipped report; the pre-registered null (1.4) — which the aggregate data already half-supports — downgrades Phase 2 to the volatile-marker lint | Phase 1 |
| 2 | Output caps hide the datum the model needed | product | A capped grep that cut off the one relevant hit converts token savings into wrong conclusions | Caps are visible rewrites with a named marker, never silent truncation (never-silent discipline, 4.2); explicit uncapped re-run path whose use is the calibration signal (4.3); per-command bypass threshold auto-raises bad caps (4.4) | Phase 4 |
| 3 | Idempotency gate suppresses a load-bearing reminder | product | A deduped injection that the model actually needed re-surfaced (long session, context rot) trades tokens against discipline adherence | Dedupe is byte-exact same-session only (3.3); each gated concern keeps its fire/no-fire test pair; obligation-adherence sits in existing conformance audits — a measured adherence drop on gated concerns reverts that concern's gate | Phase 3 |
| 4 | The budget file fossilizes as aspirational | implementation | A registered budget nobody benches is the latency file's failure mode avoided there by the CI harness — prose budgets don't hold | 3.2 ships the harness and the gate in the same phase as the file; a new injector without a budget row is a red build, not a review comment | Phase 3 |
| 5 | Determinism gate fights a legitimately dynamic artifact | implementation | Some generated file may need environment-derived content; a blind 2.3 assertion blocks builds | The stability lint carries an allowlist with per-entry justification (the source-pointer-freshness allowlist is the shape); dynamic-by-design artifacts move out of the always-loaded layer instead of exempting the layer | Phase 2 |
| 6 | Edit-shape nudge misfires on generated files | implementation | Full-file writes are correct for generated/dist artifacts; nudging against them is noise that erodes nudge credibility | Path-scoped exemptions (dist/, generated markers) in the concern header; the 5.3 ignore-rate kill criterion catches residual misfire | Phase 5 |
| 7 | Re-read guard trusts a stale ledger | product | An external change the mtime/size check misses (same-second edit, touch-preserving write) makes the advisory point at outdated content | Advisory-only until 6.4 telemetry supports escalation; the advisory names the earlier read's turn so the model can judge staleness itself; block mode is a separate future decision with its own evidence bar | Phase 6 |
| 8 | Double coverage with shipped stability guards | implementation | A second gate over the kernel prefix would re-fire on every legitimate re-anchor and train allowlist growth | 2.2 explicitly excludes the kernel prefix (guarded by `check_kernel_prefix_stability.ts`); 2.3 excludes artifacts under `compile_router --check` | Phase 2 |

## Acceptance criteria

- [x] The Phase 1 spike note exists with ledger-sourced per-slot
      attribution and the re-measured hit-ratio baseline — or the
      published null with the downgraded plan recorded.
      <!-- done: cache-injection-anatomy.md + null published in
      docs/benchmark.md -->
- [x] Two consecutive builds of the always-loaded layer are byte-identical
      (CI-asserted), and `check_static_layer_stability` is green on the
      tree and red on the volatile-marker fixture — with zero overlap
      against the shipped kernel-prefix guard.
      <!-- done: build determinism was already CI-asserted (ADR-201
      dist==rewrite(src) byte-exact + compile_router --check + kernel
      prefix guard — 2.3 verdict); the new lint is green on 106 files, red
      on the fixture, and excludes the kernel set read from dist/router.json -->
- [x] `hook-token-budget.json` exists with the latency file's full schema
      discipline; `bench_hook_injection` gates CI; a fixture concern
      exceeding its row fails the build.
      <!-- done: wired into ci-fast after check-preamble-payload; the
      red-path (over-budget concern → rc 1) is proven by test via the
      injectable budgetPath -->
- [~] The rtk corpus covers the telemetry-ranked top unwrapped commands
      with published per-command numbers; at least one cap-table command
      shows measured pre/post bytes-into-context with its bypass rate
      inside the committed threshold. <!-- partial 2026-08-10: corpus +
      per-command numbers published (basis: roadmap candidate list — no
      per-command telemetry exists to rank by, stated in RESULTS.md); the
      cap-table command grep has measured pre/post bytes from the corpus
      (302 KB → 21 KB); the bypass-rate-inside-threshold half is data-gated —
      the advisory registration is deliberately baseline-first, no threshold
      before data -->
- [~] Repeat-slot concerns named by the census carry the idempotency gate
      with passing fire/no-fire test pairs. <!-- deferred with 3.3: census
      instrument shipped, one instrumented week pending
      (repeat-injection-census blocker) -->
- [x] `prefix_stability`, `injection_load`, and the Phase 4/5 metrics are
      registered with owners, thresholds, and review dates before their
      consuming behaviour shipped — verifiable from file history.
      <!-- done: prefix_stability in the spike note, injection_load +
      advisory_adoption_metrics in hook-token-budget.json; registrations
      land in the same change set as their mechanisms (same-commit, not
      post-hoc), which the file history shows -->
- [~] The re-read guard fires on a scripted duplicate-read fixture and
      stays silent on a changed-file fixture; `turns_per_task` and
      `duplicate_read_rate` accumulate from live sessions with their
      thresholds registered. <!-- fixture half done (tests green both
      directions); the accumulate-from-live-sessions half is data-gated —
      registrations exist, live data starts once this ships -->
- [x] Anti-dump check: no second transcript parser, no mechanism from the
      cache-economy refusal list, no re-guarding of the kernel prefix.
      <!-- done: verified at run end, see the Phase 7 note -->
