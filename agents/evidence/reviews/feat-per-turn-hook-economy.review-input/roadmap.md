<!-- check-refs: skip -->
<!-- verbatim roadmap snapshot for the R2 reviewer; the live roadmap layer is excluded from check_references, and a snapshot must not fail a gate its source is exempt from -->
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
- [ ] **5.3** Move the non-gating Stop concerns to the host's async handler form,
      so turn-end wall clock carries only the concerns that can actually refuse.
      `end-review-nudge` needs its stdout to reach the model, so it stays
      synchronous until measured otherwise.
      `verify:` artifact diff against a synchronous run — every async concern still
      produces its disk artefact.
      <!-- the set membership IS the risky decision here — mis-classifying a
      gating concern as non-gating is the failure mode — so it is named, measured
      at 86cdbf652, and the draft's version of it is corrected on both sides.
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

- [ ] **2.1** Add a manifest field declaring which concerns need the tool-response
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
- [ ] **2.2** `tool-result-bytes` explicitly does not need content — its own header
      says "measured, never read". It needs a length, which the dispatcher can pass
      precomputed.
      `verify:` its tests green against a stub envelope carrying only the length.
- **AC-2:** the large-payload cell lands close to the small-payload cell on the
  § 2 matrix.

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
- **Status:** open
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
- **Resolved when:** one option is recorded at this blocker and — for (a) or (b) —
  the row exists in `hook-latency-budget.json` with its bar or its observe-only
  marker.

### blocker: b-stdin-read-failure-policy
- **Status:** open
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
- **Resolved when:** one option is recorded at this blocker and, for (a) or (c),
  `_readStdin`'s failure path returns a deny for the named slots with a test that
  fails when it allows.

### blocker: b-guard-tool-partition
- **Status:** open
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
- **Resolved when:** one option is recorded at this blocker, and — for (a) — the
  partition ships with a per-class absent-invocation proof and a test that fails
  when a claude tool name is added to no class.

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
