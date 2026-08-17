---
complexity: structural
execution:
  mode: phase-checkpoints
---

# Road to per-turn hook economy — the latency tax no registered budget can see

> **Source:** `agents/tmp.old/mixed-trigger-cleanup/road-to-per-turn-hook-economy.md`
> — external analysis session, 2026-08-17, drafted against `de76c38b932d1612d36cfc85d6b9fbaff4832350`,
> with an A/B reference worktree at tag `11.0.0` and both hook bundles rebuilt from
> source in the same environment. Adopted 2026-08-17 via `/analyze:inbox` after
> per-claim verification against `origin/main` @ `097ab6549`.

---

## 0. The defect, stated first

The hook suite carries a **structural per-turn latency tax that no registered
budget can represent**, and part of it is **proportional to tool-result size**.
Neither is a 12.x regression — the same numbers reproduce at 11.0.0 — but both are
real, and both compound with agentic turn length.

### D-1 — Per-turn summation is invisible to the budget

`hook-latency-budget.json` gates **per slot**. A single tool call fires both
`PreToolUse` and `PostToolUse`, each with its full concern chain. A ten-tool-call
turn therefore pays twenty dispatcher cold starts plus `UserPromptSubmit` plus
`Stop` — while every individual event stays green against its own slot budget. The
budget structure cannot represent the number the user actually experiences.

### D-2 — Payload-proportional JSON churn, once per concern

The in-process concern runner re-serialises the **full envelope including the tool
result** once per concern, and each concern that reads stdin re-parses it. On
`PostToolUse` with a full chain bound, that is one stringify per concern plus up to
one parse per concern of the same multi-megabyte payload, per tool call.

### D-3 — Two per-event spawns that escape the in-process table

`roadmap-progress` (PostToolUse) re-shells the dashboard regenerator through
project-local or `npx` tsx on **every** roadmap-file write — a cold tsx start per
write, in exactly the roadmap-heavy maintainer workflow this repo runs.
`end-review-nudge` (Stop) runs a `git diff --numstat` plus one `git diff
--no-index` spawn **per untracked non-doc file**.

## 1. Verified provenance

Verified 2026-08-17 against `origin/main` @ `097ab6549`.

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| 1 | Claude binds a full concern chain on both `pre_tool_use` and `post_tool_use` | **still-true, count moved** | `src/config/hook_manifest.yaml` claude block. The draft's "11 and 11" is **overtaken**: the merge of the ship-diff-volume concern took `pre_tool_use` to twelve. The argument strengthens rather than weakens |
| 2 | Slot budgets are per-event, not per-turn | **still-true** | `src/config/hook-latency-budget.json` `budgets_ms` |
| 3 | The envelope is re-serialised once per concern | **still-true** | the `setHookStdinOverride` call inside the in-process concern runner in `src/scripts/hooks/dispatch_hook.ts` |
| 4 | An in-process registry replaced the old spawn-per-concern path | **still-true** | `src/scripts/hooks/concern_registry.ts` header |
| 5 | An escape hatch back to spawn-per-concern still exists | **still-true** | `AGENT_CONFIG_HOOKS_ISOLATED=1` handling in `dispatch_hook.ts`. This alone restores the retired ~1.6 s/event class, which is why Phase 0 checks for it |
| 6 | `roadmap-progress` re-shells tsx per roadmap write | **still-true** | `src/scripts/roadmap_progress_hook.ts` header |
| 7 | `end-review-nudge` spawns one `git diff --no-index` per untracked non-doc file at Stop | **still-true** | `src/scripts/hooks/end_review_nudge_hook.ts` header, diff-source section |
| 8 | `turn-end-gate` reads a large transcript slice per Stop | **still-true** | the transcript read cap in `src/scripts/hooks/turn_end_gate_hook.ts` |
| M-1 | Per-event and per-slot timings from the analysis container | **unverifiable here — environment-bound** | container measurement 2026-08-17, method in § 2. Explicitly **not** a repo fact; re-measure on target hardware before citing it anywhere |
| M-2 | 11.0.0 and 13.0.0 statistically identical on all four hot slots | **honest null, environment-bound** | same container A/B. This is the null that makes the whole "12.1 is slower" latency framing wrong, and it is why Phase 0 exists |
| 9 | The shipped hook registration uses no `matcher` and no `if` — every registered event fires the dispatcher unconditionally | **still-true** | `hooks/hooks.json`: all entries are bare `hooks` arrays |
| 10 | The host supports a per-handler `if` in permission-rule syntax, and a non-matching `if` skips the spawn entirely | **still-true, external** | host hooks reference, fetched 2026-08-17. External documentation, so it carries the host version it was read at and re-opens on a host bump |
| 11 | The `if` filter is best-effort and fails **open** on unparseable commands | **still-true, external** | same source. Load-bearing: it makes `if` usable as a prefilter and unusable as enforcement |
| 12 | `async` / `asyncRewake` command hooks run without blocking the loop | **still-true, external** | same source |

## 2. Measurement method — so the numbers are re-runnable, not trusted

Environment: Linux container, node from the repo toolchain, hook bundle built at
each tree, warm page cache, three to four runs per cell, wall clock around the
dispatcher invoked directly per event with a fixture payload on stdin. Payloads:
a minimal `PostToolUse`; a `PostToolUse` with a multi-megabyte tool response; a
`Stop` with a multi-megabyte synthetic transcript; a `UserPromptSubmit` against a
workspace carrying the full projected skill catalogue.

The absolute numbers are **container numbers**. What transfers is the *shape*: the
payload cell costs materially more than the small cell, the Stop cell scales with
transcript size, and the delta between the two tags is approximately zero.

## 3. Honest null, stated before any fix

The reported "fast before 12.\*, slow since 12.1.\*" **does not reproduce at the
dispatcher level** between 11.0.0 and 13.0.0 in that environment. The hot-slot
binding deltas across the window are small and named. Every fix below is
justified by the **structural** cost, not by a version regression. Phase 0 exists
to find what the colleague actually hit — and the current best candidate is not in
this file at all, it is the activation flip owned by
`road-to-mixed-trigger-activation-cost`.

## Phases

### Phase 0 — Falsify or localise the report

This phase is a blocker on citing "a 12.1 latency regression" anywhere.

- [ ] **0.0** Cheapest decisive probe first: the rule-activation census from
      `road-to-mixed-trigger-activation-cost` step 1.0. **Use the census, not the
      `grep -l '^paths:'` one-liner** — that one-liner is refuted as a
      discriminator (it returns zero on a maintainer machine regardless of the
      flip, because the local projection emits no `paths:` for any rule). If the
      census shows the flip is live locally, the behavioural roadmap is the fix path
      and this latency matrix is secondary.
      `verify:` the census output, recorded with the projection scope it ran at.
- [ ] **0.1** On the affected machine, record: the prior installed version
      (lockfile history), the node version, the OS, and whether
      `AGENT_CONFIG_HOOKS_ISOLATED=1` is set anywhere — env, shell profile, or CI.
      That flag alone restores the retired ~1.6 s/event class, which would explain
      the entire report by itself.
      `verify:` a one-page note per machine with all four values filled in.
- [ ] **0.2** Run the § 2 matrix on that machine at the installed version and at
      11.0.0. Decidable outcome: a per-event p50 delta above a declared threshold
      across two or more slots means the regression is confirmed and localisable;
      otherwise the latency claim closes as environment or workload, and the
      investigation moves to turn shape (`road-to-stop-gate-honesty`) and context
      (`road-to-standing-context-40k`).
      `verify:` the matrix table, both versions, at least three runs per cell.
- [ ] **0.3** Read the turn-end-gate refusal state for the affected sessions and
      count refusals per session. A median above one refusal per session means the
      perceived slowness is extra model turns rather than hook wall clock.
      `verify:` the per-session counts, with the split before and after the local
      12.1 install date.
- **AC-0:** a one-page evidence note naming which of {env flag, hardware, version
  jump larger than one major, stop-gate refusals, activation flip, none}
  reproduced, with the matrix numbers inline.

### Phase 5 — Host-native prefiltering (runs first, deliberately)

> **Sequenced before Phases 1–3 on purpose.** Phase 5 removes *events*; Phases 1–3
> cheapen the events that remain. Because Phase 5 changes the denominator every
> later benchmark divides by, it lands first and pre-registers its own A/B.

- [ ] **5.1** Split the monolithic per-event registration into matcher groups:
      pre/post concerns that only care about one tool family get a `matcher`, and
      command-shaped guards additionally get an `if` prefilter. The dispatcher
      contract is unchanged — the same bundle runs, it just runs on fewer events.
      `verify:` the dispatcher receives no event for a non-matching payload, proven
      by an absent invocation record rather than by a fast one.
- [ ] **5.2** Safety invariant, stated because claim 11 demands it: `if` is a
      **prefilter, never the enforcement**. It fails open on unparseable commands —
      which is exactly right for fail-closed guards, because unparseable means the
      hook runs and the hook decides — and wrong as a replacement for the in-hook
      check. **No guard's own detection logic is removed in this phase.**
      `verify:` each fail-closed guard's own test suite is untouched and green.
- [ ] **5.3** Move the non-gating Stop concerns to the host's async handler form,
      so turn-end wall clock carries only the concerns that can actually refuse.
      `end-review-nudge` needs its stdout to reach the model, so it stays
      synchronous until measured otherwise.
      `verify:` artifact diff against a synchronous run — every async concern still
      produces its disk artefact.
- **AC-5:** on the § 2 matrix, a `PreToolUse` with a non-matching payload costs no
  dispatcher spawn at all, and the Stop cell drops materially on the large-transcript
  payload with every async concern still producing its artefacts.

### Phase 1 — Serialize once (D-2)

- [ ] **1.1** Compute the compact envelope **once per event** in the caller and
      pass it down, or better: let the stdin-override surface carry the
      already-parsed object behind the existing read helper, with a lazy stringify
      for the rare concern that wants raw text. The concern contract stays
      identical — concerns keep reading through the same helper.
      `verify:` every concern's own tests green, plus the mutation-isolation test
      from risk 1 below.
- [ ] **1.2** Pre-registered spike **before** merge: A/B on the large payload cell.
      Register the success and kill bars first — a reduction below the kill bar
      publishes the null in the benchmark doc and stops the phase, because the
      churn was then not where the model said it was.
      `verify:` the benchmark table in the PR, both cells, at least three runs,
      same machine.
- **AC-1:** the table exists and the pre-registered bar is met or the null is
  published.

### Phase 2 — Payload opt-in per concern (D-2, second lever)

- [ ] **2.1** Add a manifest field declaring which concerns need the tool-response
      body; absent means the envelope arrives **without** the result and input
      bodies, with a name-and-sizes stub in their place. Audit every post concern
      against its source before flipping, and record the per-concern verdict in the
      PR — this audit is a merge precondition, not a follow-up.
      `verify:` a counter in the dispatcher records every stub served, so a concern
      that silently depended on the body shows up as a number rather than as a bug
      report.
- [ ] **2.2** `tool-result-bytes` explicitly does not need content — its own header
      says "measured, never read". It needs a length, which the dispatcher can pass
      precomputed.
      `verify:` its tests green against a stub envelope carrying only the length.
- **AC-2:** the large-payload cell lands close to the small-payload cell on the
  § 2 matrix.

### Phase 3 — Take the two spawns off the hot path (D-3)

- [ ] **3.1** `roadmap-progress`: debounce. Write a cheap dirty marker on
      `PostToolUse`, regenerate once at Stop rather than per write. This preserves
      the "dashboard stays in sync without agent self-discipline" guarantee at
      session granularity; the per-write guarantee was never a stated contract.
      Both Stop and session end flush the marker.
      `verify:` a session with several roadmap writes produces one regeneration and
      a dashboard identical to the per-write result.
- [ ] **3.2** `end-review-nudge`: batch untracked files through a single diff
      invocation or a pure-filesystem line count, and cap the untracked scan with an
      honest "scan truncated" note in the state record rather than unbounded spawns.
      `verify:` Stop on a workspace with many untracked files costs approximately
      the same as Stop on a clean one.
- **AC-3:** the Stop cell on a heavily-untracked workspace lands within a declared
  band of the clean-workspace cell.

### Phase 4 — Register the number the user feels (D-1)

> **Lands as an extension of `road-to-cost-parity-1-rule-payload-diet` steps 4.3
> and 4.4**, not as a free-standing budget row: the chain-length cap is the count
> half and this composite is the time half of one surface. It carries the baseline
> refresh with it — that step's recorded baseline is stale in the *growing*
> direction, which is the worst direction for a cap's own census to age in.

- [ ] **4.1** Add a per-turn row to the latency budget: the derived composite of
      pre and post chains across a representative tool-call count plus the prompt
      and stop slots, benchmarked in CI. Register it **before** Phases 1–3 merge —
      the bar precedes the lever, which is this repo's own budget-ownership
      discipline.
      `verify:` the composite appears in the latency bench output and its CI gate.
- [~] **4.2** The bar itself is the maintainer's to pre-register, not this
      document's. Blocked on `b-per-turn-composite-bar`.
- [ ] **4.3** Refresh the stale chain-length census in cost-parity-1 step 4.3 in the
      same PR, so the cap is measured against the live chain rather than an older
      one.
      `verify:` the recorded counts match a fresh read of the manifest.
- **AC-4:** the composite is registered and gated, and the census it shares with
  the chain cap is current as of that PR.

## Blockers

### blocker: b-per-turn-composite-bar
- **Status:** open
- **Owner:** user
- **Blocks:** Phase 4 step 4.2 only. Step 4.1 registers the composite as a measured
  row and 4.3 refreshes the census; both proceed without the bar.
- **What to do:** pre-register the per-turn composite bar. Options: (a) adopt a
  composite p50 ceiling at a representative tool-call count on CI hardware, naming
  the number; (b) register the row as **observe-only** for one release and set the
  bar from the observed distribution, which is the honest choice if no prior exists;
  (c) decline the composite, in which case D-1 stays an unmeasured structural cost
  and this phase closes with that recorded. Note the latency file's existing
  posture: an absolute cap plus a pathology net, not a tight creep window, because
  shared CI runners flap.
- **Recommendation:** **option (b) — register the row observe-only for one release.**
  No prior exists for a per-turn composite in this tree, so any number named today
  would be invented, and an invented bar on a summed metric is the flappiest possible
  gate. One release of observation produces the distribution the bar should come
  from. Option (a) is right afterwards, not now; option (c) leaves D-1 permanently
  unmeasurable, which is the defect itself.
- **If you do nothing:** the per-turn cost stays structurally invisible — every slot
  green, the number the user feels unrepresented — and Phases 1, 2, 3 and 5 land
  with no bar to prove they helped. The budget-ownership discipline this repo
  follows says the bar precedes the lever, so the phases would be shipping against
  no registered target at all.
- **Resolved when:** one option is recorded at this blocker and — for (a) or (b) —
  the row exists in `hook-latency-budget.json` with its bar or its observe-only
  marker.

## Risk Register

<!-- risk-review: v1 | reviewed: 2026-08-17 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Passing a shared parsed envelope lets one concern mutate it for the next | implementation | The current per-concern re-serialisation is accidentally an isolation boundary; removing it makes cross-concern contamination possible, and such a bug would be intermittent and ordering-dependent | Freeze the hot fields, or hand each concern a copy created lazily on first write; the regression test is explicit — concern A mutates, concern B must not observe it | Phase 1 — Serialize once |
| 2 | Payload opt-in starves a concern that silently depended on the tool response | implementation | The audit is a source read, and a concern could read the body through a path the audit misses; the failure would be a concern quietly doing nothing | The per-concern source audit is a merge precondition, and one release ships a stub-served counter before any default flip, so the failure surfaces as a number | Phase 2 — Payload opt-in per concern |
| 3 | Prefiltering with `if` is mistaken for enforcement | product | `if` fails open on unparseable commands; a reader who treats it as the gate would believe a guard covers a case it does not | Step 5.2 states the invariant and forbids removing any guard's own detection logic in that phase; each fail-closed guard's tests stay untouched | Phase 5 — Host-native prefiltering |
| 4 | Debounced roadmap regeneration leaves the dashboard stale mid-session | implementation | The dashboard is a derived view several rules read; a stale one mid-session could mislead a later step in the same session | Stop and session end both flush the dirty marker, and roadmap writes stay append-safe, so the worst case is a regeneration deferred to turn end rather than a lost one | Phase 3 — Take the two spawns off the hot path |
| 5 | The composite budget flaps on shared CI runners | implementation | A per-turn composite sums many measurements, so it accumulates variance faster than any single slot and would produce red builds unrelated to any change | Same treatment the latency file already records for its slots: an absolute cap plus a pathology net rather than a tight creep window | Phase 4 — Register the number the user feels |
| 6 | The container numbers are cited as repo facts | product | M-1 is environment-bound; quoting it as measured-here would be exactly the unbacked-number failure this repo gates against | M-1 carries its verdict in § 1 and § 2 states the shape-transfers-not-magnitudes rule; Phase 0.2 re-measures on target hardware before any citation | § 2 Measurement method |
| 7 | The host's hook semantics change upstream | implementation | Claims 10–12 are external documentation read at one host version; a host bump could change matcher semantics or the fail-open direction | Each carrier records the host version it was verified on, and the fail-open direction is the safe one for advisory paths; no blocking behaviour rides on `if` | Phase 5 — Host-native prefiltering |

## CUT list — do not re-litigate

- **A resident dispatcher daemon.** Ruled out by the repo's own recorded
  honest-null consequence in the latency budget file. Stays cut.
- **Dropping concerns from `pre_tool_use`.** The manifest resolver refuses
  `pre_tool_use` drops structurally; safety guards stay bound on every role. Cut.
- **Caching the skill catalogue inside `skill-route`.** Rejected in that hook's own
  header with a stated reason. Nothing here re-opens it. Cut.
- **Async fire-and-forget for gating hooks.** Breaks blocking-guard semantics — a
  guard that must complete before the tool runs cannot be async. Only the
  non-gating Stop concerns move in 5.3. Cut.

## Honest-null consequence

If Phases 1–3 land and the per-turn composite still exceeds its registered bar,
the post-chain concern list is cut **by evidence** — the per-concern duration
histogram the dispatcher already collects — rather than optimised further, and the
cut is published with the histogram.
