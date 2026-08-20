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

## Outcome — read this before the phases

**Archived does not mean achieved.** This section exists so nobody reads a
closed roadmap as a solved problem. All six open blockers were decided on
2026-08-20 by an AI council (2/2 quorum, anthropic + openai; record:
`agents/evidence/council/drain-blocker-dispositions-b.md`), every one of them
disposition **D — decide now**. Four of the six were split verdicts and every
dissent is recorded at its blocker and inline at the step it touches.

| Phase | State | What that means |
|---|---|---|
| **0** — falsify or localise | **open** | 0.1 / 0.2 / 0.3 need the AFFECTED MACHINE and nobody here has it. Not deferred, not cancelled: genuinely blocked on access. § 3 already records that the best candidate for what the colleague hit is not in this file at all — it is the activation flip owned by `road-to-mixed-trigger-activation-cost`. |
| **1** — serialize once | **satisfied, null result** | 1.2 measured it: ten of eleven stringifies removed, latency unmoved. 1.1 stays `[-]`. The null stands. |
| **2** — payload opt-in | **satisfied, null result + two spin-offs** | 2.1/2.2 landed and moved nothing either. What the phase's AUDIT produced outlived it: `ship-diff-volume`'s dead unwrap (fixed earlier), `injection-scan`'s accidental one (fixed here), and the read+parse attribution now measured. |
| **3** — spawns off the hot path | **satisfied** | 3.1 and 3.2 landed. Unchanged by this pass. |
| **4** — register the number | **narrowed** | 4.1 registered the composite; 4.3 refreshed the census. 4.2 stays `[~]` **by decision**: the bar is observe-only for one release with a recorded arming procedure and precondition. There is no ceiling on the per-turn number today, and that is deliberate rather than forgotten. |
| **5** — host-native prefiltering | **abandoned (5.1) + narrowed (5.3)** | 5.1's zero-dispatch goal is abandoned outright — the guard tool filter is declined. 5.3 stays `[~]`: the sequence is fixed, P3 landed, and the split itself does not ship. |

### What actually landed in the closing change

- **P3 of the async-split prerequisites**, in full, and it is the largest piece:
  three state files that were unsafe under concurrent dispatch are now safe.
  `dispatch-issues.jsonl` (was unlocked, corruption-capable — 3 of 96 lines
  survived pre-fix), `rule-trips.json` (read outside the lock — 3 of 24
  increments survived), `summary.json` (single path, lossy overwrite — 1 of 8
  rollups survived). Numbers measured by restoring each pre-fix writer.
- **The stdin read-failure deny**, option (c): a failed read on a block-capable
  slot carrying a fail-closed blocking guard now refuses instead of allowing.
- **`injection-scan`'s output contract**, written down first, then the unwrap
  narrowed against it, with 14 fixtures and one existing test rewritten because
  it asserted the defect.
- **The transport-isolation cell**, which produced the number the roadmap had
  been assuming: ~70 % of the large-payload delta is the dispatcher's own read
  and parse.
- **The composite's arming procedure**, recorded on the row itself.
- **A merge convergence that the clean auto-merge hid.** `origin/main`
  (`bcbb0380b`) changed the read-modify-write lock primitive under this branch
  while P3 was being written: FILE-keyed instead of directory-keyed, on a
  measured argument, and a three-state `written`/`skipped`/`failed` return in
  place of a boolean. The merge produced no conflict, which is precisely the
  case where a clean merge is not evidence of compatibility —
  `update_text_under_lock` still held the directory lock and still returned a
  boolean. Converged, with the caller comparing the return LITERAL rather than
  testing falsiness, because every member of that union is truthy. P3's
  regression was then re-verified against the merged primitive instead of being
  trusted from the pre-merge run.

### What is still open, and where it goes

Nothing here is closed by the archival, and none of it has a home yet:

- ~~**P4**~~ — **CLOSED ON THE TRUNK, not here.** `bcbb0380b`
  ("fix(state): make the lock primitive honest about scope, staleness and
  outcome") replaced the reclaim-after-waiting-5000 ms behaviour with a decision
  read from the COMPANION's own mtime against a 30 s staleness bound, added a
  non-blocking mode, and split the return into `written` / `skipped` / `failed`.
  Verified against the merged tree rather than assumed from the subject line.
  Two consequences worth recording: the P4 half of the adopted sequence is
  already satisfied, so the remaining prerequisite chain is **P1/P2 → P5 → split**;
  and that same commit moved the read-modify-write lock to a FILE key, which this
  change's own `update_text_under_lock` had to converge onto after a CLEAN
  auto-merge that hid the divergence.
- **P1** — `build_claude_hook_matrix` returns ONE command per native event and
  `claude_hook_matrix_parity.test.ts` asserts it; a sync/async split needs two
  `Stop` entries, i.e. a deliberate change to the type that reaches every claude
  consumer's settings.
- **P2** — `turn_end_gate_hook` reads state whose producer is async-capable, so
  the split puts a refusal surface's input behind a race whose losing branch
  makes the gate ALLOW.
- **P5** — the step's `verify:` is a claim about what the HOST does with
  `async: true`, and is not observable from this repository.
- **Phase 0's three steps** — blocked on the affected machine.
- **The per-concern `<concern>.json` feedback files** carry the same
  lossy-overwrite property schema-1 `summary.json` had. Left alone because
  `hooks_doctor._latest_feedback` resolves them by that exact path; noted in
  `docs/contracts/hook-architecture-v1.md`.
- **`injection_scan_hook.main()`** reads `cwd` / `project_root` off the envelope
  ROOT to find `.agent-settings.yml`, where a dispatcher envelope carries
  `workspace_root` at the root and `cwd` under `payload`. Benign today only
  because the dispatcher's own cwd is the workspace.

### The defect-pattern count, re-run

`b-payload-mis-nested-readers` reported **2 of 47** concerns reading tool payload
keys off the envelope root, and it took three predicates to find the second. Both
are now fixed, and the same three predicates re-run over the current tree report
**0 of 47**. Five files still match the crude "never mentions `payload` but names
a payload key" predicate and all five are false positives — prose mentions, or a
read from a transcript entry rather than from the hook envelope.

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
| 1 | Claude binds a full concern chain on both `pre_tool_use` and `post_tool_use` | **still-true, count moved** | `src/scripts/hook_manifest.yaml` claude block. The draft's "11 and 11" is **overtaken**: the merge of the ship-diff-volume concern took `pre_tool_use` to twelve. The argument strengthens rather than weakens |
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
binding deltas across the window are small, and here they are actually named —
the sentence used to assert "named" while listing none, which is the shape risk 6
below gates against: `tool-result-bytes` added to `post_tool_use` and
`hot-context` added to `pre_compact`, both in `bc20d3e6c` ("feat(context): meter
tool results, and capture before compaction", verified present in this tree); and
`skill-route` first binding on `user_prompt_submit` — the binding is live at
`86cdbf652`, while "first appears at 13.0.0" is the source draft's tag-level
claim and is not re-verified here. Every fix below is
justified by the **structural** cost, not by a version regression. Phase 0 exists
to find what the colleague actually hit — and the current best candidate is not in
this file at all, it is the activation flip owned by
`road-to-mixed-trigger-activation-cost`.

## Phases

### Phase 0 — Falsify or localise the report

This phase is a blocker on citing "a 12.1 latency regression" anywhere.

- [x] **0.0** Cheapest decisive probe first: the rule-activation census from
      `road-to-mixed-trigger-activation-cost` step 1.0. **Use the census, not the
      `grep -l '^paths:'` one-liner** — that one-liner is refuted as a
      discriminator (it returns zero on a maintainer machine regardless of the
      flip, because the local projection emits no `paths:` for any rule). If the
      census shows the flip is live locally, the behavioural roadmap is the fix path
      and this latency matrix is secondary.
      `verify:` the census output, recorded with the projection scope it ran at.
      **Ran 2026-08-18 on this machine, both scopes. The flip is NOT live here,
      so this latency matrix does not become secondary.** Source:
      `./scripts-run src/scripts/rule_activation_census` — 117 rule files, 25
      declaring a path-shaped trigger, **17 mixed** and **8 path-only**; emitter
      verdict **8 scoped · 100 unconditional · 9 always**. Projection:
      `--projection .claude/rules` reads **111 files, 8 declaring `paths:`** —
      *equal* to the source's scoped count, which is the discriminator. The
      earlier reading this step was written against (92 files / 0 `paths:`) was a
      stale projection, not a flipped one: the projection is now current and
      agrees with the emitter, and the 17 mixed rules still load every session.
      So "the flip is live locally" is **false** — the flip
      `road-to-mixed-trigger-activation-cost` owns is the conversion of those 17,
      and none of it has happened. The one-liner refutation this step carries is
      unchanged and was not re-tested, because the census supersedes it.
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
      **Fixture sizes, so the run is reproducible rather than merely instructed**
      (from the source draft's own container run): a `post_tool_use` event with a
      2,000,000-character `tool_response`; a `stop` event against a 3.5 MB
      synthetic JSONL transcript; a `user_prompt_submit` against a workspace
      carrying the full projected skill set. The draft's absolute cell values are
      deliberately **not** carried over — § 2's verdict already refuses to treat
      one container's milliseconds as a repo fact — but a comparison needs the
      same fixtures on both arms, and those are specifiable without claiming a
      number.
- [ ] **0.3** Read the turn-end-gate refusal state for the affected sessions and
      count refusals per session. A median above one refusal per session means the
      perceived slowness is extra model turns rather than hook wall clock.
      `verify:` the per-session counts, with the split before and after the local
      12.1 install date.
- [x] **0.4** Same-runner path split, so 0.2 does not have to measure two things
      at once. CI run **32103306843** (job 95607853943, `ubuntu-latest`) measures
      the bundle path and the cli path back to back inside ONE job:
      `pre_tool_use` p95 **146 ms via bundle**, **148 ms via cli**, with the
      gate's own cold cli leg at **150 ms**. The wrapper the consumer pays —
      bash + shim probe + CLI startup — therefore costs **2 ms**, not the tens of
      milliseconds the budget argument on PR #1410 assumed (a local run on
      unrelated hardware measured 4 ms, so the shape replicates). Standing
      diagnostic: the non-gating comparison step added to `tests.yml` in the same
      PR re-measures both legs on every Static Checks run.
      `verify:` run 32103306843's Static Checks log, both `via bundle` and
      `via cli` blocks, plus the gate leg above them.
- [x] **0.5** Settle the magnitude question 0.4 raises but cannot answer.
      `docs/hook-latency.json` records the bundle path at `pre_tool_use` p95
      **81 ms** on 2026-07-27; 0.4 measures the same path at **146 ms**. That is
      **cross-runner** and therefore exactly the comparison § 2 refuses to treat
      as a repo fact — but it is now the only surviving explanation for the gate
      flapping on `main` (151 ms in run 32008629786, 152 ms in 32052289206,
      117 ms in 32060724505, identical code), because 0.4 has excluded the
      wrapper. It also sits in tension with this phase's own opening line
      ("the same numbers reproduce at 11.0.0"), which is a source-draft claim
      this phase exists to test — the two are compatible only if the 81 ms
      record came from a faster runner generation, and nobody has checked.
      Decisive probe: 0.2's two-version matrix run on ONE machine, restricted to
      the **bundle arm only** — 0.4 has already excluded the cli wrapper, so the
      cli arm buys nothing here.
      `verify:` bundle-path p95 per event at the installed version and at
      11.0.0, same machine, at least three runs per cell.
      **Replication, so this is not read off one job:** run **32119695614**
      repeats 0.4's split independently — `pre_tool_use` p95 141 ms via bundle
      against 142 ms via cli, a **1 ms** wrapper cost beside 0.4's 2 ms and a
      local 4 ms. The wrapper exclusion is therefore n=3 across two runners. The
      bundle-vs-record gap is n=2 (146 and 141 against a recorded 81), which
      makes "a faster runner generation in July" thinner but does not exclude
      it — only the same-machine two-version run above can.
      **Ran 2026-08-18. Both halves answered, and the answer is "runner, not
      code".** Method: `bench_hook_latency --runs 15` (bundle arm) against HEAD,
      then the same command with the new `--bundle <path>` override against a
      bundle built from tag `11.0.0` (`e4ca46123`) — `git archive` into
      `/private/tmp`, this tree's `node_modules` symlinked, `npm run
      build:hooks`. One machine, one session, n=15 per cell, identical synthetic
      payload:

      | event | HEAD p50 / p95 | 11.0.0 p50 / p95 | p50 delta |
      |---|---:|---:|---:|
      | `pre_tool_use` | 82 / 87 | 82 / 93 | 0 |
      | `post_tool_use` | 85 / 95 | 81 / 84 | +4 |
      | `user_prompt_submit` | 85 / 89 | 86 / 89 | −1 |
      | `stop` | 123 / 136 | 127 / 138 | −4 |
      | `session_start` | 86 / 92 | 86 / 90 | 0 |
      | `session_end` | 79 / 82 | 81 / 85 | −2 |

      **Result 1 — M-2's honest null replicates here.** Every p50 delta is
      within ±4 ms and the sign is not even consistent; no slot shows a code
      regression across the whole 11.0.0 → 14.1.0 window. The "12.1 is slower"
      framing has now failed on two independent machines.
      **Result 2 — the 81 → 146 ms gap is runner-bound, and risk 8 resolves in
      the direction it feared being cited for.** This machine measures the same
      bundle path at **87 ms p95**, i.e. inside the band of the 2026-07-27
      record (81 ms) and nowhere near the CI readings (146, 141, 151, 152,
      117 ms). Identical code at 87 ms here and ~146 ms there is a hardware
      statement, so `main`'s gate flapping is runner variance and NOT a
      regression this roadmap's levers could remove. The cross-runner comparison
      stays forbidden as a repo fact; what is now a repo fact is the
      **same-machine** null that makes the cross-runner reading unnecessary.
      **Caveat, stated because it bounds the claim:** both arms ran against
      HEAD's `hook_manifest.yaml` (the bench stages a workspace pointing at this
      tree), so the comparison isolates **dispatcher code** with the concern
      chain held constant. It does not measure an 11.0.0-era chain, and it
      cannot prove the older dispatcher executed every concern the current
      manifest declares. That is the right isolation for "did the dispatcher get
      slower" and the wrong one for "did the chain get longer" — the latter is
      D-1, which Phase 4 registers rather than benches here.
      **Reproducer**, now a flag rather than a throwaway script: `--bundle` is
      measurement-only and refuses `--gate` / `--update` / `--baseline`, so a
      foreign bundle's reading can never be written into this tree's budget or
      regression baseline.
- **AC-0:** a one-page evidence note naming which of {env flag, hardware, version
  jump larger than one major, stop-gate refusals, activation flip, none}
  reproduced, with the matrix numbers inline.

### Phase 5 — Host-native prefiltering (runs first, deliberately)

> **Sequenced before Phases 1–3 on purpose.** Phase 5 removes *events*; Phases 1–3
> cheapen the events that remain. Because Phase 5 changes the denominator every
> later benchmark divides by, it lands first and pre-registers its own A/B.

<!-- decision 2026-08-20: b-guard-tool-partition resolved D, option (c) —
     DECLINE the claude-only guard tool filter. Council 2/2 SPLIT on how narrow
     the decline should be: openai (c) outright decline, anthropic (b) partition
     the advisory concerns and leave the guards unscoped. Both seats refuse to
     ship the partition; the narrower was adopted. DISSENT (anthropic, (b)):
     "Finding 2 showed unscoped group buys nothing. Keeps guards safe while
     allowing advisory optimization. Phase 4 measurement is real lever." The
     dissent is preserved because it is the same finding this step recorded —
     an unscoped group in front of the guards still fires on every call — so the
     disagreement was about which non-shipping answer to record, never about
     shipping. Reasoning for (c): a silently-skippable filter in front of the two
     guards that exist because a bypass must be impossible, for a gain that is
     real but unmeasured. The ZERO-DISPATCH GOAL is abandoned; the Phase 4
     measurement and the shipped in-process `tools:` filter are retained.
     Reopen only if Phase 4's composite exceeds its bar. -->
- [-] **5.1** Split the monolithic per-event registration into matcher groups:
      pre/post concerns that only care about one tool family get a `matcher`, and
      command-shaped guards additionally get an `if` prefilter. The dispatcher
      contract is unchanged — the same bundle runs, it just runs on fewer events.
      `verify:` the dispatcher receives no event for a non-matching payload, proven
      by an absent invocation record rather than by a fast one.
      <!-- starting assignment, verified against hook_manifest.yaml at 86cdbf652
      rather than carried from the source draft, which mis-slotted one of them.
      `pre_tool_use` (12 concerns): `block-no-verify` and `block-unauthorized-git`
      are git-command-shaped → `if: "Bash(git *)"`; `rtk-wrap` is Bash-only;
      `design-slop` and `ui-route-nudge` are write-shaped → `matcher: Edit|Write`.
      `post_tool_use` (11 concerns): `edit-shape` is write-shaped → `matcher:
      Edit|Write`. The draft placed `edit-shape` on the pre slot; it binds post,
      so its matcher is a post-slot matcher. Treat this as the input to 5.1, not
      its output — each row still needs its own absent-invocation proof. -->

      **CANCELLED 2026-08-18 — as written this step makes the common case worse,
      and AC-5 is unreachable while three blocking guards stay unscoped.** Three
      findings, each verified rather than reasoned:

      1. **The host runs every matching group, in parallel.** Fetched from
         `code.claude.com/docs/en/hooks` on 2026-08-18 (§ "Hook handler fields"):
         *"All matching hooks run in parallel."* So a group split does not move a
         payload from one group to another — it adds one dispatcher process per
         additional matching group. An `Edit` payload that matches both a
         `matcher: Edit|Write` group and the group carrying the unscoped concerns
         pays **two** cold starts where it pays one today.
      2. **An unscoped group is mandatory on `pre_tool_use`, so nothing can be
         skipped.** **Nine** of the twelve claude `pre_tool_use` concerns declare
         no tool scope at all (`block-no-verify`, `block-unauthorized-git`,
         `evidence-independence`, `block-kernel-rule-writes`,
         `block-config-weakening`, `rtk-wrap`, `design-slop`, `ui-route-nudge`,
         `ship-diff-volume` — only `code-graph-nudge`, `reread-guard` and
         `spawn-guard-shadow` carry `tools:`; the enumeration was right and the
         count said eight, corrected after the R2 review). Any payload must therefore reach a
         group with no `matcher`, and a group with no matcher fires on every tool
         call. AC-5's *"a `PreToolUse` with a non-matching payload costs no
         dispatcher spawn at all"* cannot hold. The same is true of
         `post_tool_use`, where `chat-history` records every call.
      3. **Closing that gap means tool-scoping the blocking guards, which the
         architecture contract refuses on a stated reason.**
         [`hook-architecture-v1 § Optional per-concern tools: filter`](../../docs/contracts/hook-architecture-v1.md)
         ends: *"The filter is deliberately absent from the blocking PreToolUse
         guards, whose tool sets span host naming variants … a list that misses
         one variant silently disables a guard on that host."* A host `matcher`
         inherits that hazard exactly, and adds a second: `matcher` is a plain
         non-match, so a missed variant does not fail open the way `if` does on an
         unparseable command.

      **What is genuinely reachable, and is NOT taken here.** A claude-only
      partition of the *tool space* into disjoint classes, with every concern —
      guards included — assigned per class, would skip the dispatcher for a tool
      no concern can act on (`WebFetch`, `WebSearch`, `TodoWrite`, MCP tools,
      `Skill`) at one spawn for every tool that is covered. That is a real win on
      a real share of calls. It also puts a silently-skippable filter in front of
      `block-no-verify` and `block-kernel-rule-writes`, which is a
      security-surface decision and not the agent's to take: filed as
      `b-guard-tool-partition` below. `5.2`'s invariant is what keeps a future
      attempt honest about it.

      **The cheap half already ships.** The per-concern `tools:` filter skips a
      concern in-process on all eight platforms, where a `matcher` would help the
      two that support one. What it does not do — and what this step wanted — is
      avoid the spawn; finding 2 is why nothing can.

- [x] **5.2** Safety invariant, stated because claim 11 demands it: `if` is a
      **prefilter, never the enforcement**. It fails open on unparseable commands —
      which is exactly right for fail-closed guards, because unparseable means the
      hook runs and the hook decides — and wrong as a replacement for the in-hook
      check. **No guard's own detection logic is removed in this phase.**
      `verify:` each fail-closed guard's own test suite is untouched and green.
      **Landed 2026-08-18 as a contract paragraph rather than as code, because
      5.1 was cancelled and there is no `if` in the tree to constrain.** The
      invariant is now stated in
      [`hook-architecture-v1`](../../docs/contracts/hook-architecture-v1.md)
      beside the `tools:` filter it will be confused with, carrying the host
      version it was verified at. No guard's detection logic was touched — the
      diff adds no code, so every fail-closed guard's suite is untouched by
      construction.
      **Claim 11 is now first-hand and sharper than "fails open".** Same fetch:
      `if` is *"Only evaluated on tool events: `PreToolUse`, `PostToolUse`,
      `PostToolUseFailure`, `PermissionRequest`, and `PermissionDenied`. On other
      events, a hook with `if` set never runs."* That second sentence is the more
      dangerous half and this roadmap did not have it: an `if` typed onto a
      `stop` or `session_start` handler silently disables that handler
      completely. It fails open only on an unparseable **Bash** command, which is
      a narrower guarantee than the roadmap's unqualified wording implied.
<!-- decision 2026-08-20: b-stop-async-split-prerequisites resolved D, option
     (a) — sequence P3 -> P4 -> combined P1/P2 -> P5 live host check -> split. No
     split ships before all three P3 files pass concurrency regression tests.
     Council 2/2 SPLIT: openai (a) sequence, anthropic (c) cancel 5.3 outright
     the way 5.1 was cancelled. (a) adopted because "sequencing preserves the
     outcome; cancelling discards it". DISSENT (anthropic, (c)): "Async split
     requires five prerequisites, three with corruption/safety concerns. Phase 4
     measurement exists as alternative lever. 5.1 cancellation precedent." —
     recorded rather than dropped, and it remains the fallback if P1/P2 turn out
     to cost more than the turn-end wall clock they buy. P3 LANDED in this
     change (dispatch-issues.jsonl locked, rule-trips.json read moved inside the
     lock, summary.json to a capped per-invocation list), because it is a live
     data-integrity defect that does not need the split to matter. P4 turned out
     to be closed on the trunk by bcbb0380b (verified against the merged tree,
     not inferred from the subject line), so the remaining chain is P1/P2 -> P5
     -> split. P1, P2 and P5 remain open and are carried in ## Outcome. This step
     stays [~]: the split itself does not ship here. -->
- [~] **5.3** Move the non-gating Stop concerns to the host's async handler form,
      so turn-end wall clock carries only the concerns that can actually refuse.
      `end-review-nudge` needs its stdout to reach the model, so it stays
      synchronous until measured otherwise.
      `verify:` artifact diff against a synchronous run — every async concern still
      produces its disk artefact.
      <!-- the set membership IS the risky decision here — mis-classifying a
      gating concern as non-gating is the failure mode — so it is named, measured
      at 86bf652, and the draft's version of it is corrected on both sides.
      `stop` binds TEN concerns on claude, not the draft's six: chat-history,
      hot-context, verify-before-complete, team-review-gate, end-review-nudge,
      turn-end-gate, self-repair, session-register, session-eol,
      interruption-ledger. Of those, exactly ONE carries `severity: blocking` —
      `turn-end-gate`. The draft named `team-review-gate` as a second refuser; it
      is `severity: advisory`. Async candidates the draft named and this tree
      confirms as advisory and stop-bound: chat-history, hot-context,
      session-register, self-repair. `session-eol` and `interruption-ledger`
      postdate the draft and are unclassified — classify all ten here, from the
      manifest, rather than inheriting a six-row list. -->

      **DEFERRED 2026-08-18 — the classification was done, and it turned this
      step into a different and larger one. Two named halt conditions fire.** The
      host capability is NOT the blocker and is settled: the installed Claude Code
      2.1.234 binary carries `asyncRewake`, and the current docs
      (`code.claude.com/docs/en/hooks`, fetched 2026-08-18) define `async` and
      `asyncRewake` as command-hook fields. Everything below is about this
      repository, not about the host.

      **The set, classified from source — eleven members, not ten, and THREE
      sync-required, not one.** The comment above is stale in its own roadmap:
      step 3.1 added `roadmap-progress` to this slot after it was written.

      | verdict | concerns |
      |---|---|
      | **SYNC-REQUIRED** | `turn-end-gate` (the gate itself — `EXIT_BLOCK`, stderr is the deciding reason) · `end-review-nudge` (`EXIT_WARN` + `reason` + `additional_context`) · **`session-eol`** (`EXIT_WARN` + both fields on TWO paths, one of which is the warning that the recycle envelope was never written before `/clear` destroys the session) |
      | **ASYNC-CAPABLE** | `chat-history` · `hot-context` · `verify-before-complete` · `team-review-gate` · `self-repair` · `session-register` · `interruption-ledger` · `roadmap-progress` |

      `session-eol` is the correction that matters: the draft's premise was that
      `end-review-nudge` is the only concern whose stdout must reach the model.
      Backgrounding `session-eol` would silently drop the one advisory whose whole
      purpose is preventing total context loss.

      **Why it is not buildable as written — five prerequisites, each verified,
      none in this step's scope.**

      1. **It breaks a pinned parity contract.** `build_claude_hook_matrix`
         returns ONE command string per native event and
         `claude_hook_matrix_parity.test.ts` asserts exactly one group with exactly
         one command per event. The dispatcher's own `tools:`-filter header cites
         that contract as a reason NOT to split groups. A sync/async split needs
         two entries on `Stop`, i.e. a deliberate change to the type that carries
         the hook matrix into every claude consumer's settings.
      2. **A cross-group ordering dependency lands on the turn-end gate.**
         `turn_end_gate_hook` reads `agents/state/verify-before-complete.json`
         for its completion-claim detector, and `verify-before-complete` is
         async-capable — so the producer would run in a parallel process while the
         gate reads it. The order-sensitive case is the session-boundary reset
         (`state["ci_last"] = null`), which can flip the gate from "CI observed
         unsettled" to "no CI observed ⇒ allow" depending on which process wins.
         That is a refusal surface, and a race that makes a gate allow is not a
         latency question.
      3. **Two parallel dispatches collide on disk, and one collision is
         CORRUPTION-capable rather than merely lossy.** `feedback_dir` keys only
         on `session_id`, with no invocation discriminator, so both halves write
         the same directory. `summary.json` is a whole-document overwrite —
         last writer wins, and `hooks:status` would then report a five-member stop
         slot instead of eleven. `rule-trips.json` is a read-modify-write whose
         READ is outside the lock — a classic lost update, and the split puts the
         block-capable and warn-capable concerns on opposite sides, which is
         exactly when both write. `dispatch-issues.jsonl` has **no lock and no
         tmp+rename** — two `writeFileSync` calls can interleave and truncate, and
         it is written precisely when something already went wrong.
      4. **The lock the design would rely on has an escape hatch that this case
         triggers.** `state_io`'s header names "concurrent dispatcher invocations"
         as the case it guards; after a 5000 ms deadline a waiter `rmSync`s the
         other holder's sentinel and proceeds anyway. Under sustained contention
         it stops guarding the one case it was built for.
      5. **The `verify:` is not observable from this repository.** "Artifact diff
         against a synchronous run — every async concern still produces its disk
         artefact" is a claim about what the HOST does with `async: true`. The
         dispatcher-side subset filter is testable here; the host-side half needs a
         live session with the split config installed. Landing the filter and the
         manifest field without the emission would ship a function with no caller,
         which is the antipattern this roadmap's own sibling rejected.

      **Halt conditions, named rather than invented.** Prerequisite 1 is
      `/roadmap:process-full` halt 2 — council-off plus genuine ambiguity on a
      recorded in-tree contract; the council was probed this session and is
      unreachable (both seats skipped pre-run, quorum 0/2, no spend). Prerequisite
      2 is halt 3 — a security-sensitive surface reached. Filed as
      `b-stop-async-split-prerequisites` so the next attempt starts from this
      evidence instead of re-deriving it.

      **What the classification is worth on its own, independent of the split.**
      `roadmap-progress` is the single best async candidate and the only one whose
      cost is a `spawnSync` with a 30 s timeout that `_run_concern_inproc` cannot
      preempt — so if any part of this ever lands first, it is that one, alone, and
      the three sync-required concerns are the set that must never move.

- **AC-5:** on the § 2 matrix, a `PreToolUse` with a non-matching payload costs no
  dispatcher spawn at all, and the Stop cell drops materially on the large-transcript
  payload with every async concern still producing its artefacts.

### Phase 1 — Serialize once (D-2)

- [-] **1.1** Compute the compact envelope **once per event** in the caller and
      pass it down, or better: let the stdin-override surface carry the
      already-parsed object behind the existing read helper, with a lazy stringify
      for the rare concern that wants raw text. The concern contract stays
      identical — concerns keep reading through the same helper.
      `verify:` every concern's own tests green, plus the mutation-isolation test
      from risk 1 below.
      **BUILT, MEASURED, AND REVERTED 2026-08-18 — see 1.2's result.** The hoist
      was implemented (one `_compactJsonDumps` per event, threaded to both the
      in-process and the spawn path) and then taken back out, because 1.2's
      pre-registered bar returned the **kill** outcome. Keeping a mechanism whose
      premise the run falsified is the failure this roadmap's own honest-null
      discipline exists to prevent, so the tree re-serialises per concern exactly
      as before.
      **Two things from the attempt were kept, because neither depends on the
      hypothesis:**
      · `_run_concern_inproc` now carries the falsification in its header, so the
      next reader does not re-derive an "obvious" optimisation that has already
      been tried and did not pay.
      · The risk-1 mutation-isolation test ships
      (`tests/scripts/hooks/dispatch_envelope_isolation.test.ts`, 4 cases). It
      pins the property a re-attempt must preserve — a concern receives TEXT, so
      nothing one concern touches can reach the next — which turns the
      "accidentally an isolation boundary" risk 1 names into a checked one.
      **And the attempt paid for itself anyway**: building 1.2's instrument is
      what surfaced F-1, the large-payload guard bypass.
- [x] **1.2** Pre-registered spike **before** merge: A/B on the large payload cell.
      Register the success and kill bars first — a reduction below the kill bar
      publishes the null in the benchmark doc and stops the phase, because the
      churn was then not where the model said it was.
      `verify:` the benchmark table in the PR, both cells, at least three runs,
      same machine.

      **PRE-REGISTRATION — committed 2026-08-18 with the result section EMPTY,
      before the 1.1 change was written.** That ordering is the only part of a
      pre-registration a later reader can check, so it is the part that is done
      first.

      *Instrument:* `bench_hook_latency --runs 15 --payload-bytes 2000000`,
      bundle arm, one machine, one session. The pre-change arm is the bundle
      built at this commit and kept aside; the post-change arm is the rebuilt
      bundle. Same fixture on both, per § 2's shape-transfers rule.
      *Cell:* `post_tool_use` p50 — the slot that carries eleven concerns on
      claude and therefore eleven serialisations of the same payload.
      *Reasoning behind the bars, stated so they are not arbitrary:* the
      mechanism removes ten of eleven stringifies of a 2 MB envelope. If
      stringify volume is the dominant cost of that cell, the saving should be
      large and obvious; if it is not, the cell is dominated by something else and
      D-2 is mis-attributed.

      | outcome | bar | consequence |
      |---|---|---|
      | success | ≥ **20 %** p50 reduction on the cell | the mechanism is where the cost was; Phase 1's AC is met |
      | inconclusive | **5–20 %** | land it anyway (strictly less work, and risk 1 is not incurred — see 1.1), but do NOT claim the AC, and record that serialisation is not the dominant cost |
      | kill | < **5 %** | publish the null here and in the benchmark doc, and STOP Phase 1 — the churn was not where the model said it was |

      **RESULT — KILL. The bar was not met and the effect does not reproduce.**
      Ran 2026-08-18, one machine, bundle arm, 2 MB `tool_response`. Both arms
      built from THIS tree so the only difference is the hoist: arm A
      re-serialises per concern, arm B once per event.

      | run | cell | arm A (per concern) | arm B (once) | delta |
      |---|---|---:|---:|---:|
      | n=15 | `post_tool_use` p50 | 166 ms | 135 ms | **−18.7 %** |
      | n=25 | `post_tool_use` p50 | 139 ms | 143 ms | **+2.9 %** |
      | n=15 | `pre_tool_use` p50 | 159 ms | 188 ms | +18.2 % |
      | n=25 | `pre_tool_use` p50 | 157 ms | 149 ms | −5.1 % |

      **The two runs disagree in sign on the pre-registered cell, and every
      arm's own p95 spread (190–228 ms at a p50 of ~140) is larger than the
      effect.** Under the registered rule that is < 5 %, i.e. the kill band: the
      null is published, 1.1 is reverted, and Phase 1 stops.
      **Where the churn is NOT.** D-2 asserted that re-serialising a large
      envelope per concern is a material per-turn cost. On the in-process path it
      is not measurable against runner noise, so whatever the 2 MB cell costs
      (and it does cost — ~140 ms against ~85 ms for the minimal cell) is spent
      elsewhere: the per-concern parse, the concern bodies, or the pipe transfer
      itself.
      **One honest limitation of the fixture, stated without using it to rescue
      the hypothesis.** The filler is a single long string, which V8 serialises
      close to a memcpy; a deeply nested 2 MB object would cost more per
      stringify. The pre-registration named this fixture, so this result stands
      as the answer to the question that was asked. A re-attempt must
      pre-register the nested fixture as a NEW question rather than re-running
      this one.
      **Consequence for Phase 2, which is not automatic.** 2.1/2.2 avoid the body
      entirely rather than serialise it once, so they are a different mechanism
      and this null does not falsify them — but their premise is now weaker than
      when they were written, and their AC ("the large-payload cell lands close to
      the small-payload cell") is exactly what this run failed to move. Left open
      as a decision rather than built on a premise that just lost its first test.
- **AC-1:** the table exists and the pre-registered bar is met or the null is
  published. **MET, by the null half** — the table is in 1.2 above and the null is
  published there and in `_run_concern_inproc`'s header.

### Phase 2 — Payload opt-in per concern (D-2, second lever)

<!-- decision 2026-08-20: b-payload-read-parse-dominates resolved D, option (a) —
     add the same-fixture read-and-exit cell. Council 2/2 SPLIT: openai (a) add
     the isolated cell, anthropic C (accept the Phase-2 null as terminal per
     Rule 4). (a) adopted because "the null falsified the earlier attribution; it
     did not show the remaining latency unavoidable". DISSENT (anthropic, C):
     "Measured null — instrument ran, found dispatcher's own read+parse
     dominates. Two independent phases converged. Terminal per Rule 4." What the
     cell then measured makes the dissent mostly right and not entirely: ~70% of
     the large-payload delta IS the dispatcher's own read + parse (69% and 74%
     over two rounds at --runs 50, darwin-arm64, one machine), leaving ~30%
     downstream of the read with an owner rather than a shrug. Evidence:
     agents/evidence/analysis/hook-payload-transport-share.md. Shipped:
     `dispatch_hook --read-exit` and `bench_hook_latency --read-exit-cell`, both
     measurement-only. Phase 2's own steps are unchanged — this is the finding
     the phase's null produced, not a re-opening of the phase.

     decision 2026-08-20: b-injection-scan-unwrap-security resolved D, option (a)
     — write the output-envelope contract and its fixtures FIRST, then narrow
     `_tool_output`. Council 2/2 SPLIT: openai D (a), anthropic B (transfer to a
     maintainer stub pending contract + fixture work). (a) adopted because it IS
     the "establish the contract first" the dissent asks for and is executable
     now. DISSENT (anthropic, B): "Security surface requiring contract fixtures
     before any narrowing change. Current fallback works (albeit broad). Too
     risky without established valid/missing/malformed shapes." — honoured rather
     than overridden: the contract is written in the hook header before the code
     change, and the 14 fixtures are the deliverable. This is the half of
     b-payload-mis-nested-readers that option (b) deliberately did not ship, so
     it closes the pair Phase 2's audit opened. -->

- [x] **2.1** Add a manifest field declaring which concerns need the tool-response
      body; absent means the envelope arrives **without** the result and input
      bodies, with a name-and-sizes stub in their place. Audit every post concern
      against its source before flipping, and record the per-concern verdict in the
      PR — this audit is a merge precondition, not a follow-up. **Start from the
      source draft's first-pass read, which survives verification:** of the 11
      concerns bound to `post_tool_use` at `86cdbf652`, only `tool-result-bytes`
      (a byte count), `edit-shape`, `injection-scan` and `context-hygiene`
      plausibly read result content. All four bind that slot in this tree. The
      audit still covers all 11 — a shortlist orders the work, it does not bound
      it — but four rows already have a hypothesis to confirm or refute.
      `verify:` a counter in the dispatcher records every stub served, so a concern
      that silently depended on the body shows up as a number rather than as a bug
      report.

      **Landed 2026-08-18 — but the field declares CLASSES, not a boolean, and
      the phase AC is refuted. Both changes are forced by evidence and are
      recorded below rather than in a follow-up.**

      **The audit refuted the step's own shape.** Drafted as one flag ("does this
      concern need the tool-response body"). Read against source, only THREE of
      the eleven `post_tool_use` concerns read no tool payload at all
      (`context-hygiene`, `language-mirror`, and `spawn-guard-shadow` which binds
      the pre slot) — a single flag would have bought almost nothing. Six read
      `tool_input` (a path, a command, a range) while reading nothing from the
      multi-megabyte `tool_response`. So `needs_payload_bodies` takes a list of
      body classes — `[input]`, `[result]`, `[input, result]` — and the saving
      lives in the six concerns that keep a small input and lose a large result.
      The draft's own shortlist was wrong in both directions: `edit-shape` reads
      only `tool_input.file_path` (the diff comes from git on disk), and
      `injection-scan` needs the result and is the single most dangerous row.

      | concern (claude `post_tool_use`) | declares | what it reads |
      |---|---|---|
      | `chat-history` | `[result]` | writes the result text into the history entry |
      | `roadmap-progress` | `[input]` | `tool_input.{path,file_path,target_file}` |
      | `context-hygiene` | — | `tool_name` only |
      | `verify-before-complete` | `[input, result]` | classifies the command AND the full output |
      | `minimal-safe-diff` | `[input]` | path set only |
      | `injection-scan` | `[input, result]` | regex-scans the text — see the risk note |
      | `pr-url-reminder` | `[input, result]` | extracts the PR URL from the result |
      | `orchestration-record` | `[input, result]` | named metric fields + `JSON.stringify(result).length` |
      | `tool-result-bytes` | — | a LENGTH, which the stub carries (step 2.2) |
      | `edit-shape` | `[input]` | `tool_input.file_path`; the diff comes from git |
      | `language-mirror` | — | touches no payload field on this slot |

      All twelve `pre_tool_use` concerns declare `[input]` except
      `spawn-guard-shadow`, which reads `tool_name` only. Full per-concern
      evidence with `file:line` per read is in the PR.

      **`injection-scan` is the row that would have failed silently and
      dangerously.** It looks its result keys up at the WRONG nesting level
      (`envelope[…]`, never unwrapping `payload`), so in production it is its
      whole-envelope-serialisation fallback that actually carries the tool output.
      A stub replaces exactly that text, and a security scanner would have become
      a no-op with no error, no exit-code change and no log line. It declares
      `[input, result]`; the mis-nesting is a PRE-EXISTING defect this diff does
      NOT fix — see `b-payload-mis-nested-readers`.

      **A guard can never be stubbed, structurally.** `fail_closed` or
      `severity: blocking` keeps ALL classes regardless of the manifest
      (`_concern_body_classes`), because `block-no-verify` reads
      `tool_input.command` and a stub makes that `undefined`, after which the
      guard has nothing to match and exits ALLOW. That is the same shape as the
      fd-0 bypass Phase 1 fixed, and it must be unreachable by an omitted YAML
      line rather than merely discouraged. `lint_hook_manifest` additionally
      requires every tool-slot guard to declare `input` explicitly, scoped to the
      two tool slots so `turn-end-gate` (blocking, `stop`-bound, no body to
      receive) is not made to declare a need it cannot have.

      **The counter is per concern and in the record.** Each feedback entry
      carries `payload_bodies` (the kept classes) and `payload_stubs` (keys
      omitted); the run summary carries `payload_stubs_served`. Two integers and a
      class list — nothing that can hold the body they stand for.

      **AC-2 is NOT MET, and the null is published rather than the AC claimed.**
      Same instrument as Phase 1 (`bench_hook_latency --payload-bytes 2000000`,
      bundle arm, one machine, one session), `post_tool_use` p50. Arm A is the
      `origin/main` bundle built from a `git archive` of the trunk against the
      same `node_modules`; arm B is this branch. All pairs below are n=25, taken
      alternating in one session, and they are the RE-measurement after the R2
      fix pass — see the correction note under the table.

      | pair | arm A (trunk) | arm B (this change) | delta |
      |---|---:|---:|---:|
      | 2 MB payload, run 1 | 143 ms | 133 ms | −7.0 % |
      | 2 MB payload, run 2 | 131 ms | 130 ms | **−0.8 %** |
      | small payload (0 B) | 82 ms | 82 ms | 0 % |

      The two runs do not reproduce each other, exactly as Phase 1's did not, and
      the large cell (130–143 ms) is nowhere near the small cell (82 ms). AC-2's
      wording — "the large-payload cell lands close to the small-payload cell" —
      is refuted on this machine. The small cell being IDENTICAL across arms is
      the control this pair adds and Phase 1's lacked: it confirms the mechanism
      costs nothing where there is nothing to omit.

      **The first measurement was confounded and is superseded, not quietly
      replaced.** It read 123→112 ms (n=15) and 141→143 ms (n=25) against an arm B
      in which `bodyBytes` re-serialised each omitted body once per keep-set — up
      to four extra full `JSON.stringify` passes over the same 2 MB payload, on
      the hot path, in a change whose subject is serialisation cost. The R2 review
      found it and named the consequence: the added cost may partly explain the
      published null. It was removed (measure once per dispatch, thread the map
      through) and the cell re-measured; the null survives the fix, which is the
      only reason it is publishable.

      **What the measurement DID establish: where the cost actually is.** The
      residual large-vs-small delta is the dispatcher's OWN single read + parse of
      2 MB from fd 0, which happens once per event before any concern runs and
      which a per-concern opt-in cannot touch by construction. D-2 attributed the
      cost to per-concern churn; two independent measurements now say it is not
      there. That is the finding this phase produced, and it is filed as
      `b-payload-read-parse-dominates` rather than left as a sentence.

      **Why it landed anyway, and the condition that removes it.** Unlike Phase
      1's hoist — reverted because it *incurred* the cross-concern isolation risk
      — this change incurs no correctness risk, is strictly less work on the hot
      path, and hands six of eleven concerns a ~120-byte stub instead of file
      contents, command output, or API responses they provably never read. The
      cost is honest: one more manifest field that can be wrong, in a place where
      being wrong is silent. It is bounded by the lint (guards), by the runtime
      refusing to widen on a malformed value, and by the counter.
      *Revisit-if, falsifiably:* **one recorded occurrence of a concern silently
      losing a body it needed** replaces the whole declaration set with "all
      classes for every concern" and deletes the field. Not "if nobody reads the
      counter" — that is unfalsifiable by construction.

      **The runtime counter is an exposure denominator, not a detector — the R2
      review refused the stronger reading and it was right.** `payload_stubs` is a
      function of the declaration and the payload shape, so it rises with tool
      calls and can never say that a concern *wanted* the body it lost. The
      detector therefore lives at authoring time, where the question is decidable:
      `lint_hook_manifest` reads each tool-slot concern's SOURCE and requires the
      matching declaration for every body key it references. Over-detection is
      the deliberate direction — a false positive costs one concern receiving a
      body it does not need, which is the status quo before this phase, while a
      false negative costs silence. The escape hatch is a
      `payload-bodies-waiver: <class> — <reason>` line in the concern's own file,
      and exactly one exists: `tool-result-bytes`, which is what keeps step 2.2
      legal.

      29 cases green in `tests/scripts/hooks/payload_optin.test.ts`, including the
      end-to-end run that reads what a concern actually received on stdin, a
      temp-manifest run proving the new check REFUSES an undeclared body reader,
      a doctored-map case pinning `bytes` to the measurement rather than a fresh
      serialisation, the guard floor in both directions, no-content-leak probed
      with a content-derived object KEY, absent-vs-empty, and byte fidelity across
      string / multibyte / object / array / unserialisable bodies.
- [x] **2.2** `tool-result-bytes` explicitly does not need content — its own header
      says "measured, never read". It needs a length, which the dispatcher can pass
      precomputed.
      `verify:` its tests green against a stub envelope carrying only the length.
      **Landed 2026-08-18.** The stub's `bytes` is computed the way `_resultBytes`
      computes it — `Buffer.byteLength` of the string, else of `JSON.stringify`,
      `null` when unserialisable — and `_resultBytes` reads it back through
      `stubbedBytes`. Without that branch the census would have kept filling with
      the ~120-byte length of the STUB: an instrument reporting a wrong number is
      worse than one reporting none, which is why the branch is first in the loop.
      A test asserts the concern stays UNDECLARED in the shipped manifest — a
      later edit adding `[result]` here would make the census look identical while
      the 2 MB payload flowed again.
- **AC-2:** the large-payload cell lands close to the small-payload cell on the
  § 2 matrix. **NOT MET — null published in 2.1.** 82 ms small vs 130–143 ms
  large, and the two arms do not reproduce each other. The dominant term is the
  dispatcher's own read+parse, filed as `b-payload-read-parse-dominates`.

### Phase 3 — Take the two spawns off the hot path (D-3)

- [x] **3.1** `roadmap-progress`: debounce. Write a cheap dirty marker on
      `PostToolUse`, regenerate once at Stop rather than per write. This preserves
      the "dashboard stays in sync without agent self-discipline" guarantee at
      session granularity; the per-write guarantee was never a stated contract.
      Both Stop and session end flush the marker.
      `verify:` a session with several roadmap writes produces one regeneration and
      a dashboard identical to the per-write result.
      **Landed 2026-08-18.** `post_tool_use` appends the touched repo roots to
      `agents/runtime/state/roadmap-progress/dirty-roots.json`; `stop` and
      `session_end` regenerate once and clear it. Bound on all six hosts that
      carry `roadmap-progress` on `post_tool_use` — windsurf has no such surface,
      so nothing there ever marks the ledger and no flush binding was added.
      **Three decisions the step did not specify, each forced by something that
      would otherwise have broken it:**
      · **The ledger lives under `--project-dir`, not beside the edited file.** A
      touched root may be a sibling worktree, and `stop` carries no roadmap path —
      a marker written at the target would be unfindable at flush time. This
      hook's existing sibling-worktree test is what made that visible.
      · **A ledger that cannot be written regenerates inline.** The debounce is an
      optimisation and must never be the reason a dashboard silently stops
      updating; pinned by a test that puts a directory where the ledger file
      belongs.
      · **The flush clears BEFORE it regenerates.** A regenerator that hangs must
      not leave a ledger that replays the same roots at every later turn end.
      **Both paths share one implementation** (`_regenerate`), so the flush cannot
      regenerate differently from the write path — which is the "dashboard
      identical to the per-write result" half of the verify, by construction
      rather than by comparison. Empirically re-checked in the same session: a
      flush-driven regeneration produced a byte-identical
      `agents/roadmaps-progress.md` to a direct `roadmap:progress` run.
      41 cases green in `tests/scripts/hooks/roadmap_progress_hook.test.ts`,
      including N-writes→one-entry, second-flush-is-a-no-op, both event
      spellings, and replay mode marking nothing.
      **The pre-existing tests were the real cost.** Nine of them asserted the
      per-write regeneration; each now drives write-then-flush through one
      helper, so the property they protected ("does this write reach the
      regenerator for the RIGHT repo?") is unchanged and only the moment moved.
- [x] **3.2** `end-review-nudge`: batch untracked files through a single diff
      invocation or a pure-filesystem line count, and cap the untracked scan with an
      honest "scan truncated" note in the state record rather than unbounded spawns.
      `verify:` Stop on a workspace with many untracked files costs approximately
      the same as Stop on a clean one.
      **Landed 2026-08-18, and the shape is better than the step asked for: not
      one batched diff, but no subprocess at all.** An untracked file's diff
      against nothing is its own content, so `untrackedFileLineCount` now reads
      the file. Nineteen new files used to cost nineteen `git` process starts at
      every turn end; they now cost nineteen `readFileSync` calls.
      **Behaviour is preserved rather than improved, in both directions that could
      move a threshold decision without anyone noticing:** a binary file still
      counts 0 (numstat printed a dash per side and `parseNumstat` mapped that to
      0, so counting newline bytes in image data would have invented mutation
      volume), and a final line with no trailing newline still counts, which a
      plain newline count would have under-reported by one. Both are pinned,
      and one test asserts equality against a real
      `git diff --numstat --no-index` run rather than against my reading of it.
      **The step's "unbounded spawns" premise was already half-fixed and its
      correction survives**: `UNTRACKED_FILE_CAP = 20` and the labelled
      `capped_approximation` already shipped. 3.2 removes the per-file *process*
      below the cap; the cap itself is untouched and still the outer bound.
      54 cases green in `tests/scripts/end_review_nudge_hook.test.ts` (+7).
- **AC-3:** the Stop cell on a heavily-untracked workspace lands within a declared
  band of the clean-workspace cell.

### Phase 4 — Register the number the user feels (D-1)

> **Lands as an extension of `road-to-cost-parity-1-rule-payload-diet` steps 4.3
> and 4.4**, not as a free-standing budget row: the chain-length cap is the count
> half and this composite is the time half of one surface. It carries the baseline
> refresh with it — that step's recorded baseline is stale in the *growing*
> direction, which is the worst direction for a cap's own census to age in.

- [x] **4.1** Add a per-turn row to the latency budget: the derived composite of
      pre and post chains across a representative tool-call count plus the prompt
      and stop slots, benchmarked in CI. Register it **before** Phases 1–3 merge —
      the bar precedes the lever, which is this repo's own budget-ownership
      discipline. **"Representative tool-call count" is specified, not left open** —
      the source draft's definition is `(pre + post) × 10 + ups + stop`, i.e. ten
      tool calls per turn, and it is a *definition* rather than a bar, so it lands
      here rather than in the blocker below. Without it the step is not
      implementable: two people would compute two different composites and both
      would call the row green.
      `verify:` the composite appears in the latency bench output and its CI gate.
      **Landed 2026-08-18.** `per_turn_composite` in
      `src/config/hook-latency-budget.json` carries the definition, the
      `tool_calls: 10`, `aggregation: p50` and `observe_only: true`;
      `bench_hook_latency` derives it from the same `results` the slot rows come
      from and prints it on **every** run, so the local reading and the CI gate
      run (`--gate --via-cli`, `tests.yml`) are the same number. It is written
      into `docs/hook-latency.json` under `--update`.
      **Arming it is a config edit, not a code change** — set `p50_ci` and flip
      `observe_only` to false. `observe_only` is honoured even when a ceiling is
      present, which is what lets 4.2 record a number for one release before it
      starts failing builds (the blocker's recommended option (b)).
      **First observation, and it is not small: 1,864 ms** on this machine
      (pre 83 + post 82) × 10 + ups 84 + stop 130. That is already **above** the
      source draft's candidate p50 ≤ 1.5 s, on hardware that measures every
      individual slot comfortably inside its own budget — which is D-1 stated as
      a number for the first time. It is ONE local reading, so it is an input to
      4.2 and explicitly not the bar.
      **What the composite CANNOT see, stated because the R2 review found it and
      the row would otherwise read as broader than it is:** `bench_hook_latency`
      forces `AGENT_CONFIG_REPLAY=1` so a bench run leaves no session state, and
      `roadmap_progress_hook` short-circuits on replay for **both** its write and
      its flush path. So the composite is blind to step 3.1 in both directions —
      it cannot show the removed `post_tool_use` spawn, nor the `stop`-slot flush
      that replaced it. It measures the dispatcher and the concerns that run under
      replay, which is what it was registered to bound (D-1 is dispatch count, not
      one concern's spawn); a bench fixture that exercises the debounce needs a
      throwaway workspace with a roadmap in it, and is not built here.
      `perTurnComposite` returns **null** rather than a number when a slot the
      definition needs is missing from a run: a composite over a subset reads
      low, and low is the direction that makes a ceiling look met. Pinned by
      `tests/scripts/bench_hook_latency_composite.test.ts` (9 cases).
- [~] **4.2** The bar itself is the maintainer's to pre-register, not this
      document's. Blocked on `b-per-turn-composite-bar`.
      <!-- decision 2026-08-20: b-per-turn-composite-bar resolved D, option (b) —
      observe-only for one release, then derive an absolute ceiling plus a
      pathology net from the observed distribution. Council 2/2, both seats
      convergent, NO dissent. Reasoning: the source draft's p50 <= 1.5 s has no
      empirical prior in this tree, and an invented bar on a metric that
      multiplies two slot readings by ten is the flappiest gate available (risk
      5). What landed is the half that was missing — the row already shipped
      observe-only with step 4.1, so nothing said WHICH release the window
      started in or what "then derive" requires; hook-latency-budget.json now
      carries observe_only_decision, observe_only_since_version 14.6.0, a
      four-step arming_procedure and an arming_precondition of >= 10 CI readings
      from >= 2 runner sessions. The precondition is a STATED minimum, not a
      derived one, and its evidence is this same PR: the transport cell read
      44-157% at n=12 and 69-74% at n=50. This step stays [~] deliberately —
      the bar is not registered, by decision, and calling it done would claim a
      ceiling that does not exist. -->
- [x] **4.3** Refresh the stale chain-length census in cost-parity-1 step 4.3 in the
      same PR, so the cap is measured against the live chain rather than an older
      one.
      `verify:` the recorded counts match a fresh read of the manifest.
      **Landed 2026-08-18 in the same PR, and BOTH halves of the old baseline
      were wrong.** cost-parity-1 step 4.3 read "9 concerns on
      `user_prompt_submit` for claude, 7–8 on other hosts". Fresh read of
      `hook_manifest.yaml`: claude carries **10**, and the other hosts carry
      7–8 only on that one slot — claude is the binding host on *every* slot
      (`pre_tool_use` 12, `post_tool_use` 11, `stop` 11). The full per-host × slot
      table now sits in that step.
      **Corrected once, after the R2 review, and the miss is worth naming:** the
      first table was read BEFORE step 3.1 added `roadmap-progress` to `stop` and
      `session_end` in the same PR, so a refresh whose whole point was a current
      baseline shipped one stale by its own diff. Measure after your own edit.
      **One correction the refresh adds beyond the numbers:** four hosts show no
      `pre_tool_use` chain and copilot shows none anywhere, and those are **not**
      zero-length chains a cap could read as headroom — they are unbound slots and
      a `fallback_only` platform. A cap that treats a missing binding as a count
      of zero would license unlimited growth on exactly the hosts it cannot
      measure.
- **AC-4:** the composite is registered and gated, and the census it shares with
  the chain cap is current as of that PR.

## Findings the phases produced

### F-1 — a measured guard bypass on large payloads, found by 1.2's own instrument

<!-- decision 2026-08-20: b-stdin-read-failure-policy resolved D, option (c) —
     on a read failure, DENY only when the slot is block-capable AND at least one
     selected concern is both blocking and fail_closed: true. Council 2/2, both
     seats convergent on (c), NO dissent. Reasoning: a block-capable slot must
     preserve fail-closed semantics, while denying on an advisory event adds
     availability risk with no enforcement value — exit 2 on post_tool_use
     refuses nothing (the tool already ran) and on stop it would break a turn
     end for a guard that was never there. Option (b), the status quo, leaves a
     documented allow-on-failure on the security path F-1 measured. Shipped:
     host_semantics.isBlockCapable exported, dispatch_hook.stdinReadFailure
     (injectable reader, so EAGAIN exhaustion / EIO / EBADF are reachable) and
     dispatch_hook.denyOnStdinFailure, wired after concern resolution and before
     the chain. The cost is on the record: a transient I/O error on pre_tool_use
     now refuses a tool call the user must retry. -->

**Fixed in this PR, with a mutation-verified negative test.** Recorded here
because it is the most valuable thing this roadmap produced and it was not on any
step's list.

Building 1.2's large-payload cell made `bench_hook_latency` crash with `EPIPE`
above a few hundred KB. The crash was the symptom; the cause is a silent guard
bypass in the shipped dispatcher:

1. `dispatch_hook` guarded its stdin read with `process.stdin.isTTY`. Merely
   READING that property lazily constructs the stdin stream, which puts fd 0 into
   **non-blocking** mode — so the guard broke its own read.
2. `fs.readFileSync(0)` on a non-blocking pipe throws `EAGAIN` once the payload
   exceeds the pipe buffer.
3. `_readStdin`'s `catch { return "" }` converted that into *no input*, so the
   dispatcher built an envelope with an EMPTY payload and exited **0**.

**Consequence, reproduced on the real bundle rather than argued:** a `PreToolUse`
payload carrying `git commit --no-verify` is DENIED at a small size (exit 2,
`block-no-verify`) and **ALLOWED** once the same payload is padded to 300 KB.
With no tool name and no command in the envelope, every `PreToolUse` guard —
`block-no-verify`, `block-unauthorized-git`, `block-kernel-rule-writes`,
`block-config-weakening` — is silently blind. Padding is not an exotic input: a
`PostToolUse` `tool_response` holding a large file read or verbose command output
reaches these sizes routinely, so the same blindness applies to
`injection-scan` and `context-hygiene` on ordinary traffic.

**The class was already known in this repo, and that is the transferable part.**
`_lib/stdin.ts` exists, documents this exact EAGAIN failure from a 2026-08-04 CI
diff, and states the rule the hooks path violated: *never substitute an empty
string for a failed read*. `check_no_new_legacy_path` carries the same comment.
Knowing the read was fragile was not enough, because the **trigger** lived in a
different file — the `isTTY` probe. A defect ledger that records the *read* and
not the *thing that makes the read fail* does not prevent the next instance.

**Fix:** `tty.isatty(0)` instead of `process.stdin.isTTY` (answers the same
question without constructing the stream), and the read delegated to the audited
`readStdinText` (bounded EAGAIN retries, never empty-on-failure). Both halves,
because either alone is a single point of failure. Verified by mutation: the new
test fails on the pre-fix bundle at exactly the two padded sizes and passes on the
fixed one.

**The fix was worse than the defect for two turns, and the interesting part is
WHY the first version looked correct.** The two properties are coupled, and the
old code satisfied one of them *through* the bug that broke the other:

- **A large payload must not truncate** — the bypass above.
- **An idle fd 0 must be cheap.** A concern also runs with fd 0 merely open and
  never written: a child that inherits stdin, or a test calling `main()`
  in-process. A read that blocks there hangs the caller outright.

Reading `process.stdin.isTTY` put fd 0 into **non-blocking** mode, so the
following `readFileSync` failed fast with EAGAIN on an idle fd — and, identically,
on a large one. One property was bought with the other. Removing the probe fixed
the large read and broke the idle case in the worst available way: `fs.readSync`
on a **blocking**, open, unwritten fd does not return EAGAIN, it BLOCKS, so no
retry budget can bound it. Measured 12.4 s per invocation, and it left three
Node-Tests shards `in_progress` for over an hour while shard 3/4 finished in
minutes; the whole Tests workflow was then cancelled on timeout, which reads as
23 "failed" checks that were nothing of the kind.

**A second attempt fixed the wrong layer.** Capping the first-byte wait removed
the *infinite* stall but not the cost, because the fd was still blocking: the cap
could only fire after the read returned, which it never did. Then the same cap at
500 ms with the non-blocking mode restored turned a 416 ms test file into a 5.0 s
one — bounded, and still a 12× regression paid on every in-process concern call.

**The shipped shape makes the coupling deliberate instead of accidental.** fd 0 is
put into non-blocking mode ON PURPOSE (so a read can never block), the read goes
through the retrying `readStdinText` (so EAGAIN mid-stream is retried rather than
reported as empty), and the first-byte wait is capped at **25 ms** — enough to
absorb a scheduling race between the parent's first write and the child's first
read, and nothing more, because the host writes its payload before the child can
run. Once any byte has arrived the full budget applies.

Verified in all three directions rather than the one that was being fixed:
`BLOCKED` at 0 / 300 KB / 2 MB, **239 ms** on the idle pipe (from 12,373 ms), and
`tests/scripts/hooks/` at **26 files / 392 tests / 6.3 s** where it previously
never finished. The shared reader keeps its old behaviour by default — a
`gh pr diff` pipe genuinely can be slow to first byte, and calling that empty
input is the defect `_lib/stdin.ts` exists to prevent — so only the hook path
opts in.

Three process notes, which are the transferable part:

- **The signal was in front of me and I narrowed around it.** A local
  `vitest run tests/scripts/hooks/` had timed out at 400 s earlier in the same
  session; I re-ran a smaller file set instead of asking why.
- **"The shards are slow" would have been the wrong diagnosis.** Three hung while
  one passed, which is a stall, not slowness — only the per-job `startedAt`
  showed it, and only `bucket` distinguished the 23 cancellations from failures.
- **Pristine-main comparison settled authorship in one step.** Restoring the two
  stdin files from `origin/main` in place made the hanging test pass in 416 ms,
  which is what turned "probably mine" into "mine, in these two files".

**Sibling search, reported with its count.** `process.stdin.isTTY`: **19**
occurrences outside the two hook files, all in interactive CLI paths that never
read fd 0 as data (`install`, `release`, `new_skill`, the RDP gates,
`initRouting`, `decision_engine`, `interactiveContext`) — none is this defect,
because none pairs the probe with a data read. `fs.readFileSync(0`: **16** call
sites outside the hooks path and `_lib/stdin.ts`; `check_release_pr_shape:183` carries the exact
`catch { data = '' }` shape that turns an oversized diff into a passing gate over
nothing, which `_lib/stdin.ts`'s own header already names as worse than the crash.
Not fixed here — it is a different surface with no security dimension, and this
PR is already a performance change carrying one security fix.

## Blockers

### blocker: b-per-turn-composite-bar
- **Status:** resolved
- **Owner:** user
- **Class:** 2 — consent-once
- **Blocks:** Phase 4 step 4.2 only. Step 4.1 registers the composite as a measured
  row and 4.3 refreshes the census; both proceed without the bar.
- **What to do:** pre-register the per-turn composite bar. The composite itself is
  defined in step 4.1 — `(pre + post) × 10 + ups + stop` — so only the ceiling is
  open. Options: (a) adopt a composite p50 ceiling on CI hardware, naming the
  number; the source draft proposed **p50 ≤ 1.5 s at ten tool calls** and that is
  a candidate to accept or reject, not a measurement — no run in this tree
  produced it; (b) register the row as **observe-only** for one release and set the
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
- **Answer:** ACCEPTED 2026-08-20 — **option (b), register the composite observe-only
  for one release**, via option (a) of `road-to-estate-drawdown` blocker
  `b-consolidated-decision-sheet`
  ([drain-blocker-dispositions-b](../evidence/council/drain-blocker-dispositions-b.md)).
  Audited conservative and reversible, and it is the option that REFUSES to invent a
  number: no empirical prior exists for a per-turn composite in this tree, so
  observe-only for one release then derive the ceiling from the measured distribution.
  Outcome state `narrowed`.
- **Resolved when:** one option is recorded at this blocker and — for (a) or (b) —
  the row exists in `hook-latency-budget.json` with its bar or its observe-only
  marker.

- **Resolution (2026-08-20): option (b) — the composite is observe-only for one
  release, and the arming procedure is now recorded where the row lives.**
  Decided by council 2026-08-20, 2/2 quorum (anthropic + openai); record: `agents/evidence/council/drain-blocker-dispositions-b.md`. Both seats
  independently returned option (b); the adopted wording is *"mark `(pre + post)
  × 10 + ups + stop` observe-only for one release, then derive an absolute
  ceiling and a pathology net from that distribution"*, with the rationale
  *"the proposed 1.5-second ceiling has no empirical prior and should not become
  a release claim by fiat"*.

  **What landed, and what was already there.** The row itself — `observe_only:
  true`, `p50_ci: null` — shipped with step 4.1, so option (b) was half-satisfied
  before the decision. What was missing is the half that makes it a decision
  rather than a status quo: nothing said WHICH release the observation window
  started in, or what "then derive" concretely requires, so the row could sit
  observe-only forever and look compliant. `per_turn_composite` now carries
  `observe_only_decision`, `observe_only_since_version` (`14.6.0`),
  `arming_procedure` (four steps, absolute cap plus a separate pathology net) and
  `arming_precondition`.

  **The precondition is the load-bearing addition, and it is a stated minimum
  rather than a derived one** — said plainly, because a number with no
  derivation presented as one is the failure this roadmap's own risk 6 gates
  against. It requires ≥ 10 CI readings from ≥ 2 runner sessions before the bar
  is set, and the evidence behind it comes from this same PR: the
  transport-isolation cell added for `b-payload-read-parse-dominates` read
  44-157 % at n=12 and 69-74 % at n=50 on one machine. A summed metric — which
  multiplies two slot readings by ten — set from single-digit samples would
  carry that instability straight into a gate, which is risk 5 exactly.

- **If you do nothing:** the per-turn cost stays structurally invisible — every
  slot green, the number the user feels unrepresented.

### blocker: b-stdin-read-failure-policy
- **Status:** resolved
- **Owner:** user
- **Class:** 2 — consent-once
- **Blocks:** nothing — F-1's trigger is fixed and the residual failure is now
  loud. This records the half that is a policy call rather than a bug fix.
- **What to do:** decide what the dispatcher does when the stdin read **fails**,
  as distinct from stdin being empty. Both `_readStdin` and `readHookStdin` still
  convert any residual failure — an exhausted EAGAIN budget (~10 s), `EIO`,
  `EBADF` — into an empty string, after which the whole chain runs with no
  `tool_name` and the dispatcher exits 0. For a `fail_closed: true`,
  `severity: blocking` guard that is an allow. Options: (a) **deny** on a failed
  read for block-capable events that carry at least one fail-closed concern —
  the honest reading of fail-closed, at the cost of refusing a tool call on a
  transient I/O error; (b) keep allowing but treat the loud stderr line and the
  dispatch issue that now ship as sufficient, which is the current state;
  (c) deny only on the block-capable slot and allow elsewhere, which is (a)
  narrowed to where a guard can actually refuse.
- **Recommendation:** **option (c).** The bypass F-1 records is only consequential
  where a guard can refuse, and `pre_tool_use` is the one block-capable slot on
  this host; denying there costs a retryable refusal on an I/O error the retry
  budget already survived ten seconds of, while denying on `stop` or
  `post_tool_use` would refuse nothing and could break a turn end. Option (b) is
  the status quo and leaves a documented allow-on-failure on a security path;
  option (a) is right in spirit and pays for it on slots where it buys nothing.
- **If you do nothing:** the residual failure stays an allow. It is no longer
  silent — that was the actual defect and it is fixed — but a reader of
  `hook-architecture-v1`'s fail-closed contract would still expect a refusal that
  does not happen, and nothing in the tree records the gap except this blocker.
- **Answer:** ACCEPTED 2026-08-20 — **option (c)**, via option (a) of
  `road-to-estate-drawdown` blocker `b-consolidated-decision-sheet`
  ([drain-blocker-dispositions-b](../evidence/council/drain-blocker-dispositions-b.md)).
  Audited conservative and reversible, and specifically it PRESERVES fail-closed
  semantics where they bite: deny a failed read only on a block-capable slot with at
  least one blocking `fail_closed: true` concern, and do not add availability risk on
  advisory slots where denying would refuse nothing. Tests must cover `EAGAIN`
  exhaustion, `EIO` and `EBADF`.
- **Resolved when:** one option is recorded at this blocker and, for (a) or (c),
  `_readStdin`'s failure path returns a deny for the named slots with a test that
  fails when it allows.

- **Resolution (2026-08-20): option (c) — implemented.** Decided by council 2026-08-20, 2/2 quorum (anthropic + openai); record: `agents/evidence/council/drain-blocker-dispositions-b.md`.
  Both seats returned (c) independently. Adopted wording: *"on a read failure,
  deny only when the slot is block-capable and at least one selected concern is
  both blocking and `fail_closed: true`; test `EAGAIN` exhaustion, `EIO`, and
  `EBADF`"*, on the ground that *"a block-capable slot must preserve fail-closed
  semantics, while denying on advisory events adds availability risk without
  enforcement value"*.

  **What landed.** Three pieces, and the split is deliberate — the trigger and
  the policy are separately testable, which is what makes the three named errno
  classes reachable at all.
  · `host_semantics.isBlockCapable(platform, event)` is now exported. It was a
  private set, and the deny needed the same fact; a copy one module away would
  have drifted in the dangerous direction — denying on a slot that discards the
  deny, i.e. enforcement theatre.
  · `dispatch_hook.stdinReadFailure(read)` isolates the seam where a failed read
  became `''`, with the reader injectable. `EAGAIN` exhaustion, `EIO` and `EBADF`
  cannot be staged against a live fd 0 portably, and a policy whose trigger is
  untestable is a policy nobody can show works.
  · `dispatch_hook.denyOnStdinFailure(...)` is the policy, placed AFTER concern
  resolution because the whole question is whether a fail-closed blocking guard
  was among the ones that ran blind — and before the dry-run branch it would
  have turned a plan printer into a refusal.

  **The regression is red against both neighbouring options, verified by
  building each.** Against the pre-fix behaviour (never deny) 3 cases fail;
  against option (a) (deny on every slot) 4 cases fail, and they are different
  cases. A test that only pinned one direction would have passed against the
  broader policy the council refused.

  **The cost is on the record rather than in a footnote:** a transient I/O error
  on `pre_tool_use` now refuses a tool call the user must retry. The retry budget
  already survived ~10 s of `EAGAIN` before this point, so the class of failure
  that reaches the deny is not "the writer was slow".

### blocker: b-guard-tool-partition
- **Status:** resolved
- **Owner:** user
- **Class:** 2 — consent-once
- **Blocks:** nothing in this roadmap — step 5.1 is cancelled and Phases 1-4
  proceed without it. It records the one reachable form of 5.1's goal so a later
  attempt starts from the decision rather than re-deriving it.
- **What to do:** decide whether the three blocking `pre_tool_use` guards
  (`block-no-verify`, `block-kernel-rule-writes`, `block-config-weakening`) may
  carry a **claude-only** host tool filter. Only that unlocks a zero-dispatch
  path for tools no concern can act on — `WebFetch`, `WebSearch`, `TodoWrite`,
  `Skill`, MCP tools — which is a large share of calls in an agentic turn.
  Options: (a) partition the claude tool space into disjoint classes and assign
  every concern, guards included, per class; (b) partition only the advisory
  concerns and keep one unscoped group for the guards, which keeps the guards
  safe and buys **nothing** (finding 2 of step 5.1 — the unscoped group still
  fires on every call); (c) decline, and D-1 is addressed only by Phase 4's
  measurement plus the in-process `tools:` filter that already ships.
- **Recommendation:** **option (c) — decline, and revisit only if Phase 4's
  registered composite exceeds its bar.** The gain is real but unmeasured, and
  the cost is a silently-skippable filter in front of the two guards that exist
  because a bypass must be impossible: `matcher` is a plain non-match, so unlike
  `if` it does not fail open, and a Claude tool-name addition (a renamed Bash
  variant, a new edit tool) would disable a guard with nothing in the tree
  noticing. Option (a) is the version worth having *after* the composite says the
  dispatch count is the binding cost; option (b) is strictly waste.
- **If you do nothing:** the dispatcher keeps firing on every tool call
  regardless of whether any concern can act, the in-process `tools:` filter keeps
  absorbing the per-concern half on all eight platforms, and Phase 4's composite
  row is what tells anyone whether the remaining per-turn cost is worth a
  security-surface decision at all.
- **Answer:** ACCEPTED 2026-08-20 — **option (c), decline the Claude-only partition**,
  via option (a) of `road-to-estate-drawdown` blocker `b-consolidated-decision-sheet`
  ([drain-blocker-dispositions-b](../evidence/council/drain-blocker-dispositions-b.md)).
  Audited conservative and reversible: declining changes nothing and keeps the two
  bypass-must-be-impossible guards unfiltered. Both council seats refused the partition
  and the adopted value is the narrower of the two refusals; outcome state `abandoned`
  applies to the zero-dispatch goal, and Phase 4 measurement plus the shipped in-process
  `tools:` filter are retained.
- **Resolved when:** one option is recorded at this blocker, and — for (a) — the
  partition ships with a per-class absent-invocation proof and a test that fails
  when a claude tool name is added to no class.

- **Resolution (2026-08-20): option (c) — decline the claude-only partition. No
  code change; the zero-dispatch goal is `abandoned`.** Decided by council 2026-08-20, 2/2 quorum (anthropic + openai); record: `agents/evidence/council/drain-blocker-dispositions-b.md`.
  The two seats split on how narrow the decline should be — openai returned (c),
  outright decline; anthropic returned (b), partition the advisory concerns and
  leave the guards unscoped. **Both refuse to ship the partition**, and the
  narrower of the two was adopted: *"decline the Claude-only partition and cancel
  the zero-dispatch outcome"*, with the rationale *"guard filtering introduces
  host-specific coverage risk for a performance optimization that no active step
  requires"*. The adopted verdict retains *"Phase 4 measurement and the shipped
  in-process `tools:` filter"*.

  **What is abandoned is the GOAL, not the measurement**, and the distinction
  matters for reading Phase 5: the zero-dispatch path for tools no concern can
  act on is cancelled, while Phase 4's composite row and the in-process `tools:`
  filter that already ships both stay. The dissent is preserved for the same
  reason step 5.1's finding 2 is: (b) keeps one unscoped group in front of the
  guards, which still fires on every call and therefore buys nothing — so the
  disagreement was about which of two non-shipping answers to record, never
  about whether to ship.

  **Reopening condition, unchanged from the original recommendation:** revisit
  only if Phase 4's registered composite exceeds its bar. That bar is now
  observe-only for one release with a recorded arming procedure (see
  `b-per-turn-composite-bar`), so the reopening trigger has a date attached to
  it rather than being indefinite.

### blocker: b-payload-read-parse-dominates
- **Status:** resolved
- **Owner:** user
- **Class:** 2 — consent-once
- **Blocks:** nothing — Phase 2 has landed and published its null. This records
  the finding that null produced, so the next attempt at D-2 starts from the
  measurement rather than from the roadmap's original attribution.
- **What to do:** decide whether to open a step against the dispatcher's OWN
  read + parse of the payload, which two independent measurements now name as the
  dominant term of the large-payload cell. Phase 1 removed ten of eleven
  stringifies and moved nothing; Phase 2 removed the body from six of eleven
  concerns and moved nothing (82 ms small vs 130–143 ms large, and the two arm
  pairs do not reproduce each other). What remains between the two cells happens ONCE per event, before any
  concern runs: `readFd0ToEnd` reads the whole payload from the pipe and
  `_build_envelope` `JSON.parse`s it. Options: (a) open a phase to measure that
  step in isolation — a dispatcher that reads and immediately exits, against the
  same fixture, which would say how much of the ~50 ms gap is unavoidable transport;
  (b) accept the cell as host-imposed and close D-2 as mis-attributed, keeping
  the two landed levers as the strictly-less-work outcome; (c) treat it as a
  streaming/incremental-parse question, which is a much larger change than
  anything this roadmap scoped.
- **Recommendation:** **(a) first, and it is cheap.** The read-and-exit
  measurement is one small script plus one bench cell and it settles whether
  option (b) is a conclusion or a shrug. Without it "the host makes us pay this"
  is an assumption of exactly the kind Phase 1 and Phase 2 have each already
  falsified once in this file.
- **Answer:** ACCEPTED 2026-08-20 — **option (a), add the isolated read-and-exit
  measurement cell**, via option (a) of `road-to-estate-drawdown` blocker
  `b-consolidated-decision-sheet`
  ([drain-blocker-dispositions-b](../evidence/council/drain-blocker-dispositions-b.md)).
  Audited conservative and reversible: it adds a measurement, commits to no change and
  can be deleted. Dissent recorded in that session — one seat preferred accepting the
  Phase-2 null — and the adopted reasoning is that the null falsified the earlier
  attribution without showing the remaining latency unavoidable.
- **Resolved when:** one option is recorded at this blocker and — for (a) — the
  read-and-exit cell exists on the § 2 matrix, so the unavoidable transport share
  of the large-payload cell is a number rather than an assumption.
- **If you do nothing:** the large-payload cell stays roughly 60 % above the small one
  with no owner, and D-2's remaining cost keeps being attributed to per-concern
  churn in any future reading of § 0 — which is the specific error two phases of
  measurement have now refuted.

- **Resolution (2026-08-20): option (a) — the cell exists, and it produced a
  number: ~70 % of the large-payload delta is the dispatcher's own read +
  parse.** Decided by council 2026-08-20, 2/2 quorum (anthropic + openai); record: `agents/evidence/council/drain-blocker-dispositions-b.md`. openai returned (a);
  anthropic returned C (accept the Phase-2 null as terminal). (a) was adopted
  with the dissent recorded, on the stated ground that *"the null falsified the
  earlier attribution; it did not show the remaining latency unavoidable"*.
  Adopted wording: *"add a same-fixture dispatcher cell that reads stdin and
  exits immediately, reporting its latency and share of the large-payload
  delta"*.

  **What landed.** `dispatch_hook --read-exit` reads fd 0, builds the envelope
  and returns — before the manifest load, before concern resolution, before every
  concern. `bench_hook_latency --read-exit-cell <bytes>` takes all four readings
  in ONE invocation with alternating arms, so nothing here is compared across
  runs; `benchReadExitCell` / `renderReadExitCell` are the exported seam.

  **It is the real bundle rather than a standalone probe, deliberately.** A probe
  would have to re-implement the audited retrying reader, and that copy is
  precisely the drift `hook_stdin` was consolidated to remove. Bundle load and
  process spawn are in both arms and cancel in the large-minus-small delta, which
  is the number the option asked for.

  **Result** (darwin-arm64, node v26.7.0, one machine, `--runs 50`, two
  consecutive rounds): slot delta 96 / 84 ms, transport delta 66 / 62 ms →
  **69 % and 74 %**. Full table, method and reproduction:
  `agents/evidence/analysis/hook-payload-transport-share.md`. Per § 2 the shape
  transfers and the magnitude does not — these are not CI numbers.

  **What that does to the dissent.** C turns out to be mostly right and not
  entirely: about 30 % of the delta is still downstream of the read, so there is
  a remainder with an owner rather than a shrug. This is the reason the cheap
  measurement was worth taking — "the host makes us pay this" would have been an
  assumption of exactly the kind Phase 1 and Phase 2 each already falsified once
  in this file.

  **A second finding, unasked for and worth keeping.** At `--runs 12` the same
  cell read 44 %, 51 % and 157 % across three rounds. A share above 100 % is
  only reachable as noise, so 12 runs is below the threshold at which this
  estimator says anything — which is now the recorded evidence behind the
  `arming_precondition` on the `per_turn_composite` row.

  **Not closed by this:** whether the ~70 % is irreducible. A streaming or
  incremental parse attacks exactly that term; option (c) names it and it is a
  much larger change than this roadmap scoped.

### blocker: b-payload-mis-nested-readers
- **Status:** resolved
- **Owner:** user
- **Class:** 2 — consent-once
- **Blocks:** nothing in this roadmap. Phase 2's declarations are correct for the
  code as it stands, including for the two concerns below.
- **What to do:** decide whether to fix two concerns that read tool payload keys
  at the WRONG nesting level — off the envelope root instead of `envelope.payload`
  — found by Phase 2's audit and deliberately not touched by it.
  · `injection_scan_hook.ts` reads its result keys off the root, so what it
  actually scans in production is its whole-envelope-serialisation fallback. It
  works by accident, and it declares `[input, result]` so Phase 2 keeps it
  working. Fixing the unwrap changes what a security scanner sees, which is a
  behaviour change on a security surface and not a drive-by edit.
  · `ship_diff_volume_hook.ts` reads `tool_input` / `command` off the root and
  therefore finds NOTHING under the real dispatcher envelope — it returns 0 on
  every dispatcher-path invocation today. It declares `[input]`, which preserves
  the status quo and bakes in nothing new.
  Options: (a) fix both unwraps in one PR with a negative test per concern that
  fails against the current code; (b) fix `ship-diff-volume` only, since it is
  provably dead rather than accidentally-working; (c) leave both and record that
  the scanner's coverage is fallback-dependent.
- **Recommendation:** **(a), as its own PR.** Both are one-line unwraps with a
  cheap negative test, and the pair is exactly the "one instance is a sample"
  case: the audit found two, and nothing has searched the remaining concerns for
  the same construct with a predicate other than the one that found these.
- **Resolved when:** one option is recorded at this blocker and — for (a) or (b) —
  each fixed concern carries a test that fails against the pre-fix unwrap, plus a
  reported count of the same construct across the remaining concerns.
- **If you do nothing:** `ship-diff-volume` stays a concern that runs, costs a
  dispatch, and can never fire; and `injection-scan`'s coverage depends on a
  fallback that any future envelope change could remove without a test noticing.

- **Resolution (2026-08-20): option (b) recorded — `ship-diff-volume` fixed here,
  `injection-scan` split to its own blocker.** Decided by council, 2/2 quorum
  (anthropic + openai, $0.0289, subscription transport). Both seats rejected (a)
  on the same ground and it is worth keeping: the two halves have **different
  contracts and different risk profiles**, so shipping them together buys one
  review for two questions. `ship-diff-volume` is provably dead and its fix is
  verifiable from the envelope contract alone; `injection-scan` works by accident
  and changing its unwrap changes what a security scanner sees in production,
  which needs its own review against fixtures for the valid, missing and
  malformed payload shapes. Both seats also required the regression to sit at the
  dispatcher boundary rather than on the extractor.

  **What landed.** The extraction descends into `payload` before reading
  `tool_input`, and gates on `tool_name` against a `COMMAND_TOOLS` allow-list
  mirroring `block_unauthorized_git`'s. `commandFromStdin` is the only export;
  the extractor stays private, so it cannot be confused at an import site with
  `block_unauthorized_git`'s same-named export, which takes the ENVELOPE and
  returns a nullable string.

  **The descent is local, NOT `envelope.ts`'s shared `unwrap`, and an earlier
  revision of this paragraph claimed the opposite.** It said the fix adopted
  "the same accessor `design-slop` adopted", which is false twice over:
  `design_slop_hook.ts:80` defines its own private `_unwrap`, `ui_route_nudge_hook.ts:72`
  a second local one, and neither imports `hooks/envelope.js`. The claim also
  contradicted this same paragraph's own construct table two dozen lines below,
  which credits those two "via their own `unwrap`". The distinction is
  behavioural, not stylistic: the shared `unwrap` descends only when all four
  `ENVELOPE_KEYS` are present, so a producer emitting a partial envelope would
  have returned this concern to its pre-fix dead state with every test still
  green. A partial-envelope case is now pinned.

  **Making a dead concern live also makes its false positives live**, and that
  was not in the original option text. `SHIP_PATTERNS` are unanchored, so before
  the tool gate any call merely MENTIONING a ship verb — a `grep` for it, a
  heredoc writing this file — would have spawned `git merge-base` plus a
  `git diff --numstat` with a 64 MB buffer on the blocking `pre_tool_use` slot.
  The allow-list has its own cost, pinned in a test rather than left implicit: a
  host shell not in the set goes dark until added. That is the trade
  `block_unauthorized_git` already makes while blocking.

  **The stub path is the concern's second silent-death route and is now loud.**
  `needs_payload_bodies: [input]` is what keeps `tool_input` served whole; if
  that declaration is ever dropped, the body arrives as a `PayloadStub` and a
  plain read returns `''` — indistinguishable from "no ship verb", which is the
  exact failure being fixed. The extractor detects the stub and says so on
  stderr instead.

  **The regression fails against the pre-fix code, verified by restoring it.**
  Against the exact pre-fix extraction, two of the five new cases fail — the
  dispatcher-envelope case and the payload-carries-`command` case — while the
  bare-host-payload case stays green, which is correct: that path worked before
  and still works. The envelope under test is built by the dispatcher's OWN
  `_build_envelope`, so a hand-written fixture cannot drift into agreeing with
  the bug.

  **Construct count across the remaining concerns — 2 of 47, and the count took
  three predicates.** A literal-key grep for envelope-root reads found 8 of the
  47 registered concerns; **7** of those descend into `payload` first with the
  root only as a fallback (`block-config-weakening`, `block-kernel-rule-writes`,
  `code-graph-nudge`, `rtk-wrap`, `tool-result-bytes`, and both
  `design-slop`/`ui-route-nudge` via their own `unwrap`), which is correct — the
  figure read 6 in an earlier revision while naming seven, so the subtraction
  below did not close. That
  predicate **missed `injection-scan`, which reads through a loop variable** — so
  a second predicate asked which concerns never mention `payload` at all (14),
  and a third checked which of those read a key the dispatcher places only under
  `payload`. Result: exactly **two** carried the defect —
  `ship_diff_volume_hook.ts` and `injection_scan_hook.ts`. The other twelve read
  genuine root keys (`event`, `session_id`, `workspace_root`, `cwd`) and are
  right as they stand. The first predicate alone would have reported one.

### blocker: b-injection-scan-unwrap-security
- **Status:** resolved
- **Owner:** user
- **Class:** 2 — consent-once
- **Blocks:** nothing in this roadmap. It is the half of
  `b-payload-mis-nested-readers` that option (b) deliberately did not ship, kept
  as a blocker rather than a prose note so it stays visible to the estate's own
  blocker count.
- **What to do:** decide whether to fix `injection_scan_hook.ts`'s unwrap.
  `_tool_output` reads `tool_response` / `tool_result` / `toolResponse` /
  `output` / `result` off the envelope ROOT, where the dispatcher never puts
  them, and then falls through to serialising the WHOLE envelope. So the scanner
  does run and does see the tool output today — inside a serialisation of
  everything else as well. It works by accident, and nothing tests the accident.

  **Why this is not a drive-by edit.** Fixing the unwrap NARROWS what the
  scanner reads, on a security surface. The current fallback is a superset: it
  can raise a hit on text that is not tool output at all (a false positive that
  currently costs a warning), and the narrowed version could drop a host shape
  nobody enumerated (a false negative that costs coverage). Neither direction is
  decidable without first writing down what the scanner is contractually
  supposed to read.

  Options: (a) establish the intended output-envelope contract with fixtures for
  the valid, missing and malformed payload shapes, then fix the unwrap against
  it; (b) fix the unwrap and keep the whole-envelope serialisation as an
  explicit second pass, trading precision for coverage; (c) leave it and record
  in the concern itself that its production coverage is fallback-dependent.
- **Recommendation:** **(a), as its own PR.** The fixtures are the deliverable,
  not the one-line change — without them the fix is a coverage change nobody can
  review, which is exactly the reason the council split it out of the
  `ship-diff-volume` PR rather than shipping the pair.
- **Answer:** ACCEPTED 2026-08-20 — **option (a), as its own PR**, via option (a) of
  `road-to-estate-drawdown` blocker `b-consolidated-decision-sheet`
  ([drain-blocker-dispositions-b](../evidence/council/drain-blocker-dispositions-b.md)).
  Audited conservative and reversible: it specifies the envelope contract and fixtures
  BEFORE narrowing the scanner input, which raises the security floor rather than
  lowering it. Outcome state `narrowed`. Fixtures must cover each supported output key,
  missing output, malformed envelopes and unrelated root text, with a regression test
  that fails against the old unwrap.
- **Resolved when:** one option is recorded at this blocker and — for (a) or
  (b) — `injection-scan` carries a test that fails against the pre-fix unwrap,
  with the valid / missing / malformed payload shapes named.
- **If you do nothing:** the scanner's production coverage stays a property of
  its fallback rather than of its contract, and the next envelope change can
  remove it with every test still green.

- **Resolution (2026-08-20): option (a) — contract first, then the fix, with a
  regression that fails against the old unwrap.** Decided by council 2026-08-20, 2/2 quorum (anthropic + openai); record: `agents/evidence/council/drain-blocker-dispositions-b.md`.
  openai returned D option (a); anthropic returned B — transfer the whole thing
  to a maintainer stub pending contract and fixture work. (a) was adopted on the
  ground that *"(a) IS the 'establish the contract first' the dissent asks for,
  and it is executable now"*, with the rationale *"the current fallback obscures
  the security contract; narrowing it safely requires executable payload-shape
  definitions first"*. The adopted wording names the fixture set: *"valid
  fixtures cover each supported output key, missing output, malformed envelopes,
  and unrelated root text; then fix `_tool_output`, with a regression test
  failing against the old unwrap"*.

  **The contract is written down before the code.** It is stated in
  `injection_scan_hook.ts`'s `_tool_output` header, in seven numbered points:
  what the scanner reads (tool output, only), where it lives (under `payload`, or
  at the root for a bare-host invocation), which keys (`OUTPUT_KEYS`, now an
  exported constant), how a value is read, missing output → nothing to scan,
  malformed → allow, and a stubbed body → allow loudly.

  **The fixtures are the deliverable**, per the council, and they are
  `tests/hooks/injection_scan_output_contract.test.ts` — 14 cases across the four
  classes the verdict names. Envelopes are built by the dispatcher's OWN
  `_build_envelope`, so a hand-written fixture cannot drift into agreeing with
  the bug, and the assertion is on the extracted STRING rather than on "a hit":
  asserting a hit would have passed pre-fix too, because the whole-envelope
  fallback contains the same text. Both seats required the regression to sit at
  the dispatcher boundary, which is why `toolOutputFromStdin` is the export.

  **The descent is LOCAL, not `envelope.ts`'s shared `unwrap`** — that one
  descends only when all four `ENVELOPE_KEYS` are present, so a producer emitting
  a partial envelope would have returned this concern to reading the root with
  every test still green. A partial-envelope case is pinned. Same reason
  `ship-diff-volume`, `design-slop` and `ui-route-nudge` each carry their own.

  **Both directions of the cost, because only one is an improvement.** Removed:
  false positives on text that is not tool output — a `cwd` containing an exfil
  signature, an injection phrase in the tool INPUT the user typed; two such cases
  are pinned. Accepted: a host putting its output under an unenumerated key is now
  unscanned where the fallback would have caught it. Mitigated rather than
  dismissed — an unrecognised payload shape emits one stderr line naming the
  payload's top-level KEY NAMES (never values, since a value here could be the
  tool output), so a new host spelling surfaces on first contact instead of going
  dark.

  **One existing test asserted the defect and was rewritten, not deleted.**
  `injection_scan_hook.test.ts`'s *"fallback to the whole payload when no
  recognized output key"* expected exit 2 on `{cwd, foo: <exfil>}`. It now
  asserts exit 0, the stderr shape, and that the stderr does NOT echo the value.

  **Sensitivity verified:** restoring the exact pre-fix extraction fails 11 of
  the 14 contract cases.

  **Found and NOT fixed here, noted per the remediation ladder:** `main()` reads
  `cwd` / `project_root` off the envelope ROOT to locate `.agent-settings.yml`,
  where a dispatcher envelope carries `workspace_root` at the root and `cwd` under
  `payload`. It is benign today because the in-process dispatcher's own cwd IS the
  workspace, so the `"."` fallback resolves correctly — but it means the
  default-OFF gate of a security concern is read from a path the envelope did not
  supply. Out of scope for a blocker about `_tool_output`, and it changes which
  settings file arms a scanner, so it needs its own change.

### blocker: b-stop-async-split-prerequisites
- **Status:** resolved
- **Owner:** user
- **Class:** 2 — consent-once
- **Blocks:** step 5.3 only. Phases 1-4 are unaffected and Phase 2 has landed.
- **What to do:** decide whether to open the prerequisite work that makes 5.3
  buildable. The classification it needed is DONE and is recorded at the step —
  eleven concerns on claude's `stop`, three sync-required (`turn-end-gate`,
  `end-review-nudge`, `session-eol`), eight async-capable. The host capability is
  also settled: the installed binary carries `asyncRewake`. What is open is five
  prerequisites, each verified against the tree:
  · **(P1)** `build_claude_hook_matrix` returns ONE command per native event and
  `claude_hook_matrix_parity.test.ts` asserts exactly one group with exactly one
  command; a sync/async split needs two `Stop` entries, i.e. a deliberate change
  to the type that carries the hook matrix into every claude consumer's settings.
  · **(P2)** `turn_end_gate_hook` reads `agents/state/verify-before-complete.json`
  and its producer is async-capable, so the split puts a refusal surface's input
  behind a race whose losing branch makes the gate ALLOW.
  · **(P3)** two parallel dispatches collide on `summary.json` (lossy overwrite),
  `rule-trips.json` (lost update — the read is outside the lock), and
  `dispatch-issues.jsonl` (**no lock, no tmp+rename — corruption-capable**, and
  written precisely when something already went wrong).
  · **(P4)** `state_io`'s lock names concurrent dispatcher invocations as the case
  it guards and then `rmSync`s the other holder's sentinel after a 5000 ms
  deadline, so under contention it stops guarding that case.
  · **(P5)** the step's `verify:` — an artefact diff proving every async concern
  still writes its artefact — is a claim about what the HOST does with
  `async: true` and is not observable from this repository.
  Options: (a) open a phase that lands P3 and P4 first (locking and per-invocation
  discriminators are useful on their own, independent of any split), then P1 and P2
  as one reviewed change, then the split behind P5's live check; (b) land ONLY
  `roadmap-progress` async — the single best candidate, the only concern whose cost
  is a `spawnSync` with a 30 s timeout the in-process runner cannot preempt — which
  still needs P1 and P3 but not P2; (c) cancel 5.3 the way 5.1 was cancelled and
  record that turn-end wall clock is addressed only by Phase 4's measurement.
- **Recommendation:** **(a), and P3 before anything else.** P3 is a live
  data-integrity defect that does not need the split to matter: `dispatch-issues.jsonl`
  already has no lock today, and any second concurrent dispatcher — two platforms
  installed into one workspace, which the manifest supports — can truncate it. Fixing
  it is small, independently valuable, and turns the riskiest part of a future split
  into a non-issue. Option (b) is tempting and is the wrong first move: it pays P1's
  contract change for one concern while leaving the collisions in place. Option (c)
  is defensible only if Phase 4's composite says turn-end wall clock is not the
  binding cost.
- **Answer:** ACCEPTED 2026-08-20 — **option (a), P3 before anything else**, via option
  (a) of `road-to-estate-drawdown` blocker `b-consolidated-decision-sheet`
  ([drain-blocker-dispositions-b](../evidence/council/drain-blocker-dispositions-b.md)).
  Audited conservative and reversible: it sequences two correctness defects ahead of the
  async split rather than shipping the split over them, so it removes a live
  data-integrity exposure instead of creating one. Sequence P3 -> P4 -> combined P1/P2
  -> P5 live host check -> split; no split may ship before all three P3 files pass
  concurrency regression tests. Dissent recorded — one seat preferred cancelling the
  split outright.
- **Resolved when:** one option is recorded at this blocker and — for (a) or (b) —
  P3's three files are written under a lock with a tmp+rename and a test that fails
  against the current unlocked write, before any group split ships.
- **If you do nothing:** turn-end wall clock keeps carrying eight concerns that
  cannot refuse anything, `dispatch-issues.jsonl` stays corruption-capable under any
  concurrent dispatch, and the classification above rots — it is pinned to
  `hook_manifest.yaml` as it stands today, and every added `stop` concern makes it
  less true.

- **Resolution (2026-08-20): option (a) — sequence adopted, and P3 is DONE.**
  Decided by council 2026-08-20, 2/2 quorum (anthropic + openai); record: `agents/evidence/council/drain-blocker-dispositions-b.md`. openai returned D
  option (a); anthropic returned D option (c) — cancel 5.3 outright, the way 5.1
  was cancelled. (a) was adopted with the dissent recorded, on the stated ground
  that *"sequencing preserves the outcome; cancelling discards it"*. Adopted
  wording: *"sequence P3 → P4 → combined P1/P2 → P5 live host check → split. No
  split may ship before all three P3 files pass concurrency regression tests"*,
  with the rationale *"P3 and P4 are correctness defects independent of async
  dispatch; shipping the split before fixing them creates corruption and
  lost-update paths"*.

  **P3 landed here, because it is not really about the split.** The council's
  recommendation said "P3 before anything else" and gave the reason: it is a live
  data-integrity defect that does not need async dispatch to matter. Two
  concurrent dispatchers in one workspace is a supported configuration (two
  platforms installed side by side), and a host that runs tool calls in parallel
  produces one with a single platform.
  · `dispatch-issues.jsonl` — was `readFileSync` outside any lock then
  `writeFileSync` straight onto the target. Now one locked read-append-publish
  through the new `state_io.update_text_under_lock`, tmp+rename included.
  **Measured pre-fix: 3 of 96 lines survived** eight concurrent writers.
  · `rule-trips.json` — the read sat outside the lock while the publish was
  atomic, so two dispatchers both loaded the same counter. Now
  `update_json_under_lock`, the primitive that already existed for this shape.
  **Measured pre-fix: 3 of 24 increments survived.**
  · `summary.json` — the publish was atomic and the PATH was singular, so the
  later rename discarded the earlier rollup whole. Now schema 2: a capped list of
  per-invocation rollups keyed on pid + monotonic clock, cap 20. **Measured
  pre-fix: 1 of 8 rollups survived.**

  **The concurrency test forks 8 real processes, and its sensitivity was
  established the hard way.** `tests/hooks/p3_state_concurrency.test.ts`. The
  first version passed against a deliberately sabotaged lock primitive — the
  classic concurrency test that proves nothing — and two separate defects in the
  HARNESS were the cause: the barrier file was written after spawning, so
  children raced their own tsx startup instead of each other; and the mutator ran
  in microseconds, so the pre-fix read-to-write window was never entered. Both
  are fixed in the test (a wall-clock barrier deadline, and a 25 ms hold inside
  the mutator that changes the workload and not the code under test), and only
  then did the sabotage produce the three numbers above.

  **P4 is already closed, and on the trunk rather than here.** `bcbb0380b`
  replaced the reclaim-after-waiting behaviour with a staleness decision read
  from the companion's own mtime (30 s bound), added a non-blocking mode, and
  moved the RMW lock to a FILE key on a measured argument. Checked against the
  merged tree, not inferred: the old code computed `Date.now() - start > 5000`
  from how long THIS caller had waited, the new code stats the companion. So the
  adopted sequence's remaining chain is **P1/P2 → P5 → split**, one link shorter
  than when the council decided it.

  **Still open, and this resolution does not pretend otherwise:** P1 (the
  hook-matrix type carries ONE command per native event, and
  `claude_hook_matrix_parity.test.ts` asserts it), P2 (`turn-end-gate`'s input
  behind a race whose losing branch makes the gate ALLOW), and P5 (a claim about
  what the host does with `async: true`, not observable from this repository). No
  split may ship before P1/P2 land and P5 is checked live. The remaining work is
  carried in `## Outcome` as the follow-up this roadmap does not close.

  **Scope line, stated rather than left to be discovered:** the per-concern
  `<concern>.json` feedback files carry the SAME lossy-overwrite property as
  schema-1 `summary.json`. They are untouched because
  `hooks_doctor._latest_feedback` resolves them by that exact path and picks the
  newest mtime, so renaming them is a consumer-visible change this pass did not
  take. Recorded in `docs/contracts/hook-architecture-v1.md` beside the schema-2
  note.

### blocker: b-concern-load-taxes-every-slot

- **Status:** resolved
- **Owner:** user
- **Class:** 2 — consent-once
- **Blocks:** the trunk, right now. `main` is RED on the pre-registered
  hook-latency gate and has been since the org-telemetry merge, so every open PR
  inherits the failure and reads as if it caused it.
- **What to do:** decide how to answer a MEASURED cost increase that the
  re-derived 175 ms cap has already caught. This is not the runner-variance case
  the cap re-derivation absorbed; the control measurement separates them.

  Evidence, in the order it was taken:

  1. **CI, trunk.** `main` at `cab529209` (the `feat/org-telemetry-phase1-emission`
     merge) measured `pre_tool_use` p50 **176** / p95 **185** ms and failed the
     175 cap. The immediately preceding green run measured p50 111-148 — the
     window the cap was derived from.
  2. **CI, with a same-run control.** A branch carrying the control row measured
     p50 **181** / p95 184 while `node -e 0` in the SAME job read **26 ms**,
     identical to the 26 and 28 ms of the runs that had measured 143-151. The
     runner is equally fast at process start; every slot is ~30 ms higher.
  3. **Local A/B, one machine, `--runs 50` to match the gate, arms alternated.**
     Merged bundle p50 **103** ms (110/112 p95) against the pre-merge bundle p50
     **91.5** ms (99/105 p95) — **+11 ms, +12.6 %**, same direction in both
     rounds, control constant at 40-49 ms throughout.

  **The mechanism is bundle load, not concern execution**, and that is the part
  worth acting on: the new `telemetry-usage` concern is bound to `post_tool_use`
  ONLY, yet `pre_tool_use` slowed by the same margin. The dispatcher is one
  precompiled bundle, so a concern bound to one slot is parsed and initialised on
  every dispatch of every slot. The bundle grew 16 kb (+1.5 %).

  **Two candidate causes were measured and REFUTED**, so neither is worth
  re-opening: the YAML dependency is lazy by construction (`createRequire` plus a
  type-only import), and `node:crypto` was already in the pre-merge bundle
  (16 occurrences vs 17) and costs ~4 ms.

  **What is NOT established:** which of the added modules dominates the 11 ms.
  The measurement above attributes it to the merge, not to a file.

  Options: (a) bisect the added module graph against the same A/B harness
  (`bench_hook_latency --bundle`, which exists for exactly this) until the
  dominant term has a name; (b) treat the per-slot tax as the real defect and
  load concerns lazily per slot, which removes the class rather than this
  instance — tracked separately, and it makes (a) unnecessary for the gate
  though not for understanding; (c) re-derive the cap a third time, which this
  roadmap's own budget file names as the config-bending its derivation block
  exists to make visible, and which would now bury a confirmed regression rather
  than absorb runner spread.
- **Recommendation:** **(b) for the gate, (a) only if the number itself is
  wanted.** (a) names a file; (b) stops every future concern from raising every
  slot floor, which is the shape that will otherwise return at the next
  concern. (c) is refused on this evidence — the cap is not too low, the cost
  went up.
- **Resolved when:** either the dominant module is named at this blocker with a
  measurement, or the per-slot loading change has landed and a green run measures
  `pre_tool_use` p50 back inside the 111-148 window the cap was derived from.
- **If you do nothing:** the trunk stays red, the standing workaround becomes
  re-running the job by hand — which the cap re-derivation recorded as the
  problem it was fixing — and the next cap raise happens with a real regression
  underneath it.

- **Resolution (2026-08-19):** cause found and fixed, and it was NOT where this
  entry predicted. Option (b) — slot-scoped loading — was measured and
  FALSIFIED before being built: a bundle carrying only the 11 `pre_tool_use`
  concerns loads in 24 ms against the full 45-concern bundle at 23 ms, because
  the bundle is dominated by the shared dependency graph rather than by
  per-concern code. The prize was minus one millisecond.

  The cost was one layer up: `dispatch_hook` parses the 61 kB YAML manifest on
  every dispatch — 8 ms to load the `yaml` module, 12 ms to parse — a fifth of a
  ~103 ms dispatch spent re-deriving a table that does not change between runs.
  A precompiled `hook_manifest.json` sibling (14.7 kB, sub-millisecond parse,
  mtime-guarded, with a test that fails when the two diverge) takes
  `pre_tool_use` p50 from 103 ms to 81 ms — below the 91.5 ms pre-regression
  baseline, and back inside the 111-148 window the cap was derived from.

  Option (a), naming the dominant merged module, is therefore moot and is NOT
  being pursued: the regression was never the added module graph, it was the
  per-dispatch parse the added manifest lines made slightly worse.
  `road-to-slot-scoped-concern-loading` closes on this same measurement.

**A wording hole in the cap file, found by this case and worth closing with it.**
`pre_tool_use_cap_derivation.revisit_if` reads "a GREEN run whose p50 rises above
160 ms". The observed run is p50 176-181 and RED, so the trigger does not fire on
its own wording in exactly the situation it describes. That is the same class of
defect its own `_revisit_if_correction` already fixed once. It needs "a run whose
p50 rises above 160 ms, green or red" — a red run tells you MORE about cost
growth, not less.

## Risk Register

<!-- risk-review: v1 | reviewed: 2026-08-18 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Passing a shared parsed envelope lets one concern mutate it for the next | implementation | The current per-concern re-serialisation is accidentally an isolation boundary; removing it makes cross-concern contamination possible, and such a bug would be intermittent and ordering-dependent | Freeze the hot fields, or hand each concern a copy created lazily on first write; the regression test is explicit — concern A mutates, concern B must not observe it | Phase 1 — Serialize once |
| 2 | Payload opt-in starves a concern that silently depended on the tool response | implementation | The audit is a source read, and a concern could read the body through a path the audit misses; the failure would be a concern quietly doing nothing | The per-concern source audit is a merge precondition, and one release ships a stub-served counter before any default flip, so the failure surfaces as a number | Phase 2 — Payload opt-in per concern |
| 3 | Prefiltering with `if` is mistaken for enforcement | product | `if` fails open on unparseable commands; a reader who treats it as the gate would believe a guard covers a case it does not | Step 5.2 states the invariant and forbids removing any guard's own detection logic in that phase; each fail-closed guard's tests stay untouched | Phase 5 — Host-native prefiltering |
| 4 | Debounced roadmap regeneration leaves the dashboard stale mid-session | implementation | The dashboard is a derived view several rules read; a stale one mid-session could mislead a later step in the same session | Stop and session end both flush the dirty marker, and roadmap writes stay append-safe, so the worst case is a regeneration deferred to turn end rather than a lost one | Phase 3 — Take the two spawns off the hot path |
| 5 | The composite budget flaps on shared CI runners | implementation | A per-turn composite sums many measurements, so it accumulates variance faster than any single slot and would produce red builds unrelated to any change | Same treatment the latency file already records for its slots: an absolute cap plus a pathology net rather than a tight creep window | Phase 4 — Register the number the user feels |
| 6 | The container numbers are cited as repo facts | product | M-1 is environment-bound; quoting it as measured-here would be exactly the unbacked-number failure this repo gates against | M-1 carries its verdict in § 1 and § 2 states the shape-transfers-not-magnitudes rule; Phase 0.2 re-measures on target hardware before any citation | Measurement method |
| 7 | The host's hook semantics change upstream | implementation | Claims 10–12 are external documentation read at one host version; a host bump could change matcher semantics or the fail-open direction | Each carrier records the host version it was verified on, and the fail-open direction is the safe one for advisory paths; no blocking behaviour rides on `if` | Phase 5 — Host-native prefiltering |
| 8 | The 81 → 146 ms bundle delta is quoted as a measured regression | product | It is a CROSS-RUNNER comparison — a 2026-07-27 record against a 2026-08-18 CI job — and this roadmap's own § 2 refuses exactly that shape as a repo fact. It is persuasive because the wrapper has been excluded and nothing else explains `main` flapping on identical code, and persuasive-but-cross-runner is the easiest number in this file to cite carelessly. The same shape already produced one budget relaxation on PR #1410 before it was reverted | Step 0.5 carries the caveat in its own text and names the same-machine two-version run as the decisive probe; the number is stated as tension with this phase's opening line rather than as its refutation. Row 6's rule applies to it unchanged | Phase 0 — Falsify or localise |

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
