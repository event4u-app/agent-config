---
complexity: structural
status: ready
parent_roadmap: road-to-subagent-value-realization-followup
---

# Road to orchestration scope decision — one falsifiable minimal claim, or an honest exit from the front

> **Standalone by council decision** (claude-sonnet-4-5 + gpt-4o, 2026-07-08,
> 2 rounds — converged in round 2): this is an ADOPTION claim requiring a
> public falsifiability gate, categorically distinct from the parent's
> internal telemetry work; merging would bury the prove-or-drop decision in
> someone else's Phase 3. Dependency on the parent's telemetry is stated in
> Phase 2's prerequisites, not resolved by merger. Phases 1 (pre-registration)
> and 4 (positioning draft) can run before/parallel to the telemetry blocker.
>
> Decide, on evidence, whether agent-config competes on orchestration at all —
> and if so, on exactly one narrow, measured claim rather than a swarm feature
> race. The subagent-v1 contract (ADR-109) and telemetry path are built; the
> A3 production-validator Gate-A eval is an honest null. `subagents.auto`
> defaults to `on` since ADR-117 (2026-07-09) — a bounded-downside flip,
> explicitly NOT a passed benchmark; `resolveShippedDefault()`/`gateVerdict()`
> is retained as the telemetry-driven demotion gate back to `ask`. This
> roadmap converts the standing null into a decision on the PUBLIC claim:
> prove a minimal orchestration win, or remove the surface from the public
> value proposition and keep it as an internal contract only.
> <!-- reconciled 2026-07-12 with ADR-117 via road-to-opt-portfolio-consolidation
>      Phase 1 (default was described as `ask` — stale since 2026-07-09). -->

## Outcome — closed 2026-08-20, and closed is not achieved

```
ARCHIVED DOES NOT MEAN ACHIEVED. NOT ONE PHASE OF THIS ROADMAP WAS SATISFIED.
THE PRE-REGISTERED CLAIM IS STILL `unbacked` AND WAS NEVER EVALUATED.
```

Every open item is `[-]` **transferred**, none is `[x]`. Disposition **B** per
[`agents/evidence/council/drain-blocker-dispositions-a.md`](../evidence/council/drain-blocker-dispositions-a.md),
which merged this roadmap's `real-orchestration-usage` with the sibling's
`telemetry-sample-size` — one evidence gap under two names — into one shared
stub: [`stubs/road-to-task-completion-observability.md`](stubs/road-to-task-completion-observability.md).

| Phase | State | One-line honest reading |
|---|---|---|
| Prerequisites | 2 satisfied, 1 **transferred** | The build work was always done. The third prerequisite's literal text (≥20 lines) is MET at 570 and was deliberately **not** marked `[x]`: marking a satisfied proxy `[x]` is the exact defect the 2026-08-17 Resolved-when rewrite removed. |
| Phase 1 — pre-commit the claim | **satisfied** (already `[x]` before this run) | The claim is pre-registered, deterministically scored, negative control defined. `docs/CLAIMS.md:259-264`, status `unbacked`. This phase is the one thing this roadmap actually delivered. |
| Phase 2 — accumulate telemetry | 1 satisfied, 1 **transferred** | The deterministic half (classifier recall 2/2, FP 0) was done 2026-07-11. The real-telemetry half is transferred, and is **doubly** unexecutable: the settings keys its text names no longer exist, and the count it gates on is already met while every quality column is null. |
| Phase 3 — prove or drop | **all 3 transferred** | Neither branch is reachable. PROVE has no held-quality input (`first_pass_success` null on 570 of 570) and no fan-out population (`spawn_count >= 2` on 0 of 570). DROP is premise-stale in clause 1 and maintainer-owned in clause 2. |
| Phase 4 — position the minimalism | **both transferred** | Gated on Phase 3 by its own heading. Additionally maintainer-owned: both steps change what the package publicly claims. The `docs/proof.md` row cannot be added as worded at all — see below. |

**What this run did add, and it is a narrowing rather than a resolution.** The
probe the merged criterion asks for was run and is published at
[`agents/evidence/analysis/orchestration-task-completion-payload-probe.md`](../evidence/analysis/orchestration-task-completion-payload-probe.md).
It splits the single question into three answers instead of one:

1. **Cost and latency ARE visible to a hook and already read** — `post_tool_use`
   on a **sync** completion (`orchestration_record_hook.ts:120`, `:193-199`;
   8/8 agent-shaped transcript results carry `usage`; 40 of 570 audit rows
   numeric). The first clause of the criterion is therefore partly **YES**, and
   has been all along.
2. **For a background dispatch one candidate slot is now named and unverified** —
   `subagent_stop` is bound on this host and `transcript_path` is in the binary's
   string table, so the open question narrows from "does any slot see it" to one
   decidable pair of facts. It still needs the host env
   (`raw-capture-needs-host-env`), which is not a repository act.
3. **The quality columns are NOT payload-derivable at any slot, by
   construction** — `orchestration-telemetry.md:86-107` defines both over the
   parent's *subsequent* rework and re-dispatch, events that have not happened
   at task completion; and no hook in the tree writes either field. So the
   criterion's second clause cannot be satisfied by the first clause's success.
   That is the finding that makes this a transfer rather than a wait.

**Three things that must not be read out of this closure.**

- The evidence gate this roadmap committed to was **never passed and never
  evaluated** — the 2026-08-14 note in Phase 3 says so and is not softened here.
  Always-on orchestration shipped the capability unconditionally and made the
  gate unreachable; that structural decision stands and is not reopened, but it
  did not satisfy anything on this page.
- The Phase-4 `docs/proof.md` row — "orchestration value is measured before
  default-on (or absent), not asserted" — is **contradicted by the shipped
  default** and cannot be added as worded even after the stub clears. Writing it
  would publish a false claim. Re-cutting the sentence is maintainer-owned.
- `status: ready` in the frontmatter is left untouched deliberately: only
  `ready` / `draft` / `proposed` are in use across the estate, and inventing a
  fourth value to signal closure would be a schema change smuggled in as
  bookkeeping. This section is the closure record.

Nothing was abandoned. Nothing was narrowed by weakening a criterion — the only
criterion restatement on this page (the 2026-08-17 Resolved-when rewrite) made
the blocker **harder** to resolve, not easier.


## Goal

Ship a single, falsifiable orchestration claim ("on delegable task family X,
contract-governed parallel dispatch nets a token-or-time win at held quality")
backed by real telemetry — or record the renewed null and explicitly scope
agent-config OUT of the orchestration front, positioning minimalism as a stance,
not an unfinished swarm.

## Context (measured, do not relitigate)

- Contract + plumbing exist: ADR-109 subagent-v1 contract,
  `subagent-spawn-contract` / `subagent-response-contract`, native projection to
  `.claude/agents/`, `subagent-orchestration` skill, delegation gates
  (failure-type stop + ordered-slice dependency), `readOrchestrationMetrics`,
  `/cost:report` orchestration summary, `gateVerdict()` in
  `src/scripts/_lib/orchestration_gate.ts`.
- Standing evidence: A3 production-validator Gate-A eval = honest null;
  `subagents.auto` default = `on` since ADR-117 (2026-07-09,
  bounded-downside basis — not evidence of value; demotion gate to `ask`
  retained). The PUBLIC claim stays gated on real telemetry
  (`agents/settings/contexts/orchestration-default-flip-verdict.md`).
- The blocker is structural, not code: real orchestrated dispatches cannot be
  produced by a headless harness — they need real usage (parent followup
  `blocker: telemetry-sample-size`, ≥20 audit lines/month).
- Category reality (publicly observable, no counter-claim): the swarm category
  ships maximal orchestration — 100+ agent types, background daemon, memory DB,
  federation, "SOTA-vs-framework" matrices with no reproducible methodology.
  agent-config's differentiator, if it stays on this front at all, is the
  inverse: a minimal, contract-governed, evidence-gated dispatch — value proven
  before default-on, not asserted.

## Prerequisites

- [x] Telemetry-capture path + aggregator + bench arms built (parent).
- [x] Honest-null recorded; `ask` is the safe default.
- [-] ≥20 real orchestration audit lines (parent followup Phase 1).
      <!-- [-] transferred 2026-08-20 — merged blocker `real-orchestration-usage` +
      `telemetry-sample-size`, disposition B, outcome `transferred`, to the shared stub
      `agents/roadmaps/stubs/road-to-task-completion-observability.md`. The literal text is
      MET (570 orchestration lines) and marking it `[x]` would restore exactly the
      already-satisfied proxy the 2026-08-17 Resolved-when rewrite removed: the gap is the
      quality columns (0 of 570), not the count. -->

## Phase 1 — Pre-commit the falsifiable minimal claim

- [x] Before collecting more data, write the single claim under test into
      `docs/CLAIMS.md` as `unbacked` (pre-registration — no moving the goalposts
      after the numbers land): e.g. "On the ordered-refactor + competitive-impl
      families (`orch-02`, `orch-03`), contract-governed dispatch nets ≥15%
      token-or-wall reduction at non-regressed quality vs single-agent."
      <!-- done 2026-07-11: `### claim: orchestration-dispatch-net-win` added to
      docs/CLAIMS.md § Unbacked inventory, status unbacked, not markered in prose
      (markering an unbacked claim fails check_claims — the binding must come
      first). -->
- [x] Define "held quality" deterministically: reuse `check_quality_regression.ts`
      thresholds so a token win that degrades output fails the claim.
      <!-- done 2026-07-11: baked into the claim's falsification criteria (1) —
      held quality scored by src/scripts/check_quality_regression.ts thresholds;
      a token/wall win below the regression threshold FAILS the claim. -->
- [x] Define the negative control: `pv-02-negative-control` must NOT trigger
      dispatch — a classifier that fires on everything is a cost leak, not a win.
      <!-- done 2026-07-11: baked into the claim's falsification criteria (2) —
      pv-02-negative-control must NOT trigger dispatch. -->

**Exit:** one pre-registered, deterministically-scored orchestration claim in
CLAIMS, `unbacked`.
**Rollback:** delete the ledger line.

## Phase 2 — Accumulate real telemetry (inherits parent followup)

- [-] Run real delegable work with `subagents.enabled: true` under the
      post-ADR-117 default (`subagents.auto: on`) until
      `agents/runtime/state/audit/YYYY-MM.jsonl` carries ≥20 orchestration
      lines (parent followup Phase 1, Steps 1–3).
      <!-- [-] transferred 2026-08-20 — Phase 1 telemetry seeding moved to
      `agents/roadmaps/stubs/road-to-task-completion-observability.md` (disposition B, outcome
      `transferred`). Doubly unexecutable as written: `subagents.enabled` / `subagents.auto`
      no longer exist (always-on orchestration deleted both), and the ≥20-line condition is
      already met at 570 while every quality column stays null. -->
- [x] Measure `parallelizable:` classifier recall AND false-positive rate on the
      corpus (`orch-01..03`, `pv-01`, `pv-02`) — both matter; a leaky classifier
      loses on cost even when it wins on the true positives.
      <!-- done 2026-07-11: deterministic measurement via the regression test
      src/scripts/_lib/auto_dispatch.corpus.test.ts (8 tests, green). Recall 2/2
      on the v1-covered modes (orch-01 → do-in-parallel, orch-02 → do-in-steps);
      false-positive rate 0 (pv-02 negative control NOT dispatched). Scope gap
      recorded: orch-03 (do-competitively) + pv-01 (verdict) are outside
      classifyTask v1's two DispatchModes. NOTE: this is the deterministic half
      of Phase 2; the ≥20 real telemetry lines (line above) stay maintainer-run,
      so the Phase-2 exit is not yet fully met. -->

**Exit:** ≥20 real orchestration lines; classifier recall + FP rate recorded.
**Rollback:** none — measurement only.

## Phase 3 — Gate the claim: prove or drop

- [-] Feed the accumulated real telemetry through `gateVerdict()` /
      `resolveShippedDefault()`. PROVE = the pre-registered claim clears its
      threshold at held quality AND the negative control stayed quiet.
      <!-- [-] transferred 2026-08-20 — Phase 2 evaluation moved to
      `agents/roadmaps/stubs/road-to-task-completion-observability.md` (disposition B, outcome
      `transferred`). RUN ANYWAY for the record, 2026-08-20: `orchestration_savings_report`
      over 570 dispatches returns `first_pass_success_rate: n/a (n=1)`, `escalation_rate: n/a
      (n=1)`, `measured share: 0%`, `MODELED cost reduction: n/a`. Both `gateVerdict()` inputs
      are absent — no counterfactual and no quality column — so this is a reading assembled
      from one July line, not a verdict. -->
- [-] PROVE → mark the CLAIMS entry `backed` with a resolving pointer; the
      ADR-117 `on` default is thereby CONFIRMED for the proven family (the
      bounded-downside basis upgrades to evidence); update the flip verdict.
      <!-- [-] transferred 2026-08-20 — Phase 3's dependent decision moved to
      `agents/roadmaps/stubs/road-to-task-completion-observability.md` (disposition B, outcome
      `transferred`). PROVE is not evaluable: its held-quality input is null on 570 of 570
      lines and the parallel arm has no population (`spawn_count >= 2` on 0 of 570). -->
- [-] DROP → record the renewed honest null; demote the default back to
      `ask` via ADR-117's retained demotion gate; **and** demote the
      orchestration surface from the public value proposition: README/site stop
      listing orchestration as a capability and instead state the honest stance —
      "contract exists, default off, value not established; we do not ship
      unproven orchestration." The contract stays internal.
      <!-- PREMISE-STALE in clause 1, MAINTAINER-OWNED in clause 2, checked
      2026-08-10. Clause 1: there is no `subagents.auto` left to demote to
      `ask` — road-to-always-on-orchestration Phase 1 deleted the key from the
      template, the schema and the production path, and orchestration now
      resolves from a host-capability probe with `emergency.orchestration_halt`
      as the only switch. "Demote the default" therefore names a mechanism the
      tree no longer has; re-cutting it is a scope decision. Clause 2 is a
      change to what the package publicly claims, i.e. decide-what-ships — the
      distinction an AI council drew for a sibling roadmap the same day
      (anthropic/claude-sonnet-4-5 + openai/gpt-4o, 2026-08-10, 2 rounds,
      convergent): an agent may decide whether criteria are met, never what
      ships. It also runs directly against a roadmap that has already shipped
      orchestration as always-on, so the two must be reconciled by a human
      before either is acted on. -->
      <!-- THE GATE WAS BYPASSED, NOT PASSED — recorded 2026-08-14 on an outside
      opinion (1 seat, anthropic/claude-sonnet-4-5, 2 rounds; the second seat
      failed to start, so this is a single-model judgement admitted on its
      checkable merit and NOT a convergence).

      The note above is accurate and stops one sentence short of the thing that
      matters. It records that clause 1 names a mechanism the tree no longer has.
      It does not record what happened to the *evidence gate* that clause was
      guarding, and the difference sets a precedent.

      This roadmap's Phase 3 committed to a gate: evidence first, then the
      default. A later roadmap (always-on orchestration, Phase 1) made the
      capability unconditional and deleted the switch **without ever evaluating
      that evidence**. So the honest record is not "the question became moot when
      the later decision superseded it" — it is:

        1. The later roadmap's structural decision STANDS. That is not reopened
           here, and this note is not an argument to reopen it.
        2. The evidence gate this roadmap committed to was **never passed**. It
           was never evaluated at all. Nothing in the later decision references
           or satisfies the criterion stated above.
        3. The telemetry exists and is uninterpretable (see the blocker below).
           The question is therefore **unanswered**, not answered-and-obsolete.

      Why the distinction is worth a paragraph: "superseded, therefore moot"
      licenses the next roadmap to walk past its own evidence gate by shipping
      something that makes the gate unreachable. "Superseded, gate never passed"
      licenses nothing — it leaves the debt visible and named. Two different
      claims, two different precedents, and only one of them is true here.

      Left open by this note, deliberately: whether a bypass of a
      previously-committed evidence gate should require an explicit written
      justification, or whether "the later decision wins" is sufficient
      governance on its own. That is a doctrine question about how this tree
      records superseded commitments; it is maintainer-owned and is not settled
      by recording one instance of it. -->
      <!-- [-] transferred 2026-08-20 — Phase 3's dependent decision moved to
      `agents/roadmaps/stubs/road-to-task-completion-observability.md` (disposition B, outcome
      `transferred`). Also NOT agent-executable on its own terms, as the two notes above
      already record: clause 1 is premise-stale (no `subagents.auto` left to demote) and
      clause 2 is maintainer-owned (it changes what the package publicly claims). -->

**Exit:** a `backed` scoped claim + scoped flip, OR a recorded null + a public
demotion of the front. No middle state where marketing implies a swarm the
evidence doesn't support.
**Rollback:** revert to `ask` (safe default) on any regression.

## Phase 4 — Position the minimalism (only after Phase 3 resolves)

- [-] Write `docs/orchestration-stance.md`: whichever way Phase 3 went, state <!-- ref-ignore -->
      the category contrast honestly — agent-config offers evidence-gated
      minimal dispatch (or none), explicitly not a swarm platform; each claim
      binds to a resolvable pointer, the category is described only by what is
      publicly observable, never a named competitor.
      <!-- [-] transferred 2026-08-20 to
      `agents/roadmaps/stubs/road-to-task-completion-observability.md` (disposition B, outcome
      `transferred`). NOT in the council's move-list, which names Phases 1-3; transferred on
      this phase's own stated gate ("only after Phase 3 resolves") plus the fact that a public
      stance document is decide-what-ships. Stated as this run's reading, not the council's. -->
- [-] Add the `docs/proof.md` § 4 row: "orchestration value is measured before
      default-on (or absent), not asserted."
      <!-- [-] transferred 2026-08-20 to
      `agents/roadmaps/stubs/road-to-task-completion-observability.md` (disposition B, outcome
      `transferred`), and it cannot be added AS WORDED even after the stub clears: always-on
      orchestration shipped the capability unconditionally without evaluating this roadmap's
      gate, so "measured before default-on" would publish a false claim. Re-cutting the
      sentence is maintainer-owned. -->

**Exit:** the stance doc exists and is CI-drift-checked like the rest of the
proof surface.
**Rollback:** none — positioning only.

## Acceptance criteria

- Exactly one orchestration claim is pre-registered, deterministically scored,
  and resolved to `backed` or honest-null — never left ambiguous.
- The ADR-117 `on` default is confirmed or demoted only on real,
  family-scoped evidence; `ask` remains the demotion floor.
- If dropped, the public value proposition no longer implies orchestration; the
  contract survives internally, unadvertised.
- The negative control (`pv-02`) is part of the pass condition — a classifier
  that over-fires cannot pass on true positives alone.

## Blockers

### blocker: real-orchestration-usage
- **Status:** resolved — transferred 2026-08-20 (disposition B, outcome `transferred`)
- **Owner:** user
- **Class:** 3 — human-only
- **Blocks:** Phase 2, and thereby Phase 3's decision and Phase 4. All seven open items are now `[-]` transferred; nothing here was satisfied.
- **Merged pair — this entry is ONE HALF of two.** Its sibling is
  `telemetry-sample-size` in
  [`road-to-subagent-value-realization-followup.md`](road-to-subagent-value-realization-followup.md),
  and the two were found to be **one evidence gap wearing two names** by
  [`agents/evidence/council/drain-blocker-dispositions-a.md`](../evidence/council/drain-blocker-dispositions-a.md):
  "Line count is already satisfied and no longer diagnostic; the shared gap is
  whether a hook can observe task completion and populate quality fields." Both
  halves were rewritten off the count and onto the quality columns (this one
  2026-08-17, the sibling 2026-08-16) and both now point at ONE shared stub. The
  sibling roadmap's own checkboxes are owned elsewhere and were **not** touched
  by this closure — only this half is closed.
- **Resolution (2026-08-20) — transferred to
  [`stubs/road-to-task-completion-observability.md`](stubs/road-to-task-completion-observability.md),
  with the probe RUN and its answer recorded.** The criterion's first clause was
  probed and is now partly answered; its second clause is structurally
  unreachable from the first, which is what makes this a transfer and not a wait.
  Full measurement:
  [`agents/evidence/analysis/orchestration-task-completion-payload-probe.md`](../evidence/analysis/orchestration-task-completion-payload-probe.md).

  **(a) A hook slot DOES see the task-completion payload — for a sync
  completion, and it already reads it.** `orchestration_record_hook.ts:120` reads
  `tool_response`, takes `totalTokens` at `:193` and falls back to
  `usage.input_tokens + usage.output_tokens` at `:194-199`. Measured over the 40
  most-recent transcripts of this project: 8 agent-shaped `toolUseResult`
  entries, **8 of 8** carrying a populated `usage` object, union keys
  `agentId, agentType, content, prompt, resolvedModel, status, toolStats,
  totalDurationMs, totalTokens, totalToolUseCount, usage`. Corroborated on the
  output side by `dispatch_tokens` numeric on 40 of 570 rows.

  **(b) For a BACKGROUND dispatch the candidate slot is now named, and
  unverified.** `subagent_stop` is bound on this host (`hook_manifest.yaml:926`,
  `:967`; alias at `:1062`) and has been observed 3410 times, but
  `subagent_ledger_hook` reads no usage field, so the ledger shows only that
  nobody looked. `transcript_path` is present in the installed binary's
  exact-token string table (count 1, host `2.1.237` — a fresh read; the prior
  pin was `2.1.229`). Presence is not arrival: the open question narrows from
  "does any slot see it" to *does `transcript_path` reach `SubagentStop` stdin,
  and does the entry it points at carry the usage object for a background
  dispatch*. Instrument shipped (`dispatch_hook.ts:578`), env not a repository
  act — the standing `raw-capture-needs-host-env` dependency.

  **(c) The QUALITY columns are not payload-derivable at ANY slot, by
  construction — and this is the decisive finding.**
  `orchestration-telemetry.md:86-107` defines `first_pass_success` over whether
  the parent later adopted the return without rework, and `escalated` over
  whether the parent later re-dispatched to a higher tier. Both are facts about
  events strictly AFTER completion, so no completion payload can carry them.
  Confirmed on the write side: `grep --line-number -rE
  'first_pass_success|escalated' src/scripts/hooks/` returns **nothing**. The
  only producer is the model-carried CLI (`orchestration_record.ts:136`), whose
  measured capture rate before the hook existed was 1 of 370. Consequence: even
  a fully successful (b) fills cost and latency and leaves the quality columns
  as `null`. Clause 2 of the criterion is therefore not downstream of clause 1
  at all.

  **Re-measured corpus, 2026-08-20** (was 367 orchestration lines on
  2026-08-17): `2026-08.jsonl` holds 579 lines, **570 orchestration**.
  `first_pass_success` / `escalated` / `task_class` / `dispatch_mode` non-null on
  **0 of 570**. `dispatch_tokens` numeric on **40 of 570** — the same 40 as three
  days ago, so no sync completion has landed since. `wall_clock_ms` 570/570.
  `token_delta_provenance` `estimated` 570/570. `spawn_count >= 2` on **0 of
  570** (1 in 569, 0 in 1) — across 570 dispatches the corpus has never produced
  a fan-out, which blocks the claim's parallel arm independently of the columns.
  `orchestration_savings_report`: `first_pass_success_rate: n/a (n=1)`,
  `escalation_rate: n/a (n=1)`, `measured share: 0%`, `MODELED cost reduction:
  n/a`. **203 new orchestration lines moved not one field verdict** — the third
  consecutive reading to confirm the recommendation below.
- **What to do:** the build work is done; only real delegable work produces the
  telemetry. Use the agent on genuinely parallel/ordered multi-file tasks under
  the post-ADR-117 default (`subagents.auto: on`), then check
  `wc -l agents/runtime/state/audit/$(date +%Y-%m).jsonl`. Resume at ≥20.

  **Measured 2026-08-10 — the literal condition is MET (99 orchestration lines
  in `2026-08.jsonl`) and Phase 3 is still not decidable.** The count moved
  because the `orchestration-record` `post_tool_use` concern now emits per
  dispatch; it did not move because usage habits changed. But all 99 lines
  carry `token_delta: 0` / `estimated` and `null` for `dispatch_tokens`,
  `first_pass_success`, `escalated` and `task_class`, which is correct at that
  layer for a **background** dispatch (the host attaches usage only to a sync
  completion) — so "at held quality" has no input and PROVE cannot be
  evaluated. The full field-level measurement and why this is a live-host probe
  rather than an emitter bug is recorded once, in the sibling's
  `telemetry-sample-size` blocker; this roadmap's Phase 2 inherits it per the
  Notes section there.

  Two consequences worth stating before anyone reads the cleared count as a
  green light. **(1)** Feeding today's telemetry through `gateVerdict()` yields
  a null-or-worse reading assembled from one July line, not a verdict — the
  aggregate currently reports a net of tokens *added* at a 1 % measured share.
  **(2)** The DROP branch below is premise-stale in its first clause and
  maintainer-owned in its second, so a DROP is not an agent-executable
  outcome either.

  **Correction (2026-08-17) — two of the numbers above have moved, and one of
  them falsifies the mechanism claim rather than just the count.** Re-measured
  against `2026-08.jsonl` at 368 lines / **367 orchestration** (July still holds
  1): `token_delta: 0` and provenance `estimated` remain **367/367**, and
  `first_pass_success`, `escalated`, `task_class` and `dispatch_mode` remain
  `null` **367/367** — so the "at held quality has no input" conclusion stands
  unchanged and PROVE is still not evaluable. What does **not** hold is the
  parenthetical reason: `dispatch_tokens` is **numeric on 40 of 367** (327 null),
  i.e. the sync completions the clause said we have none of are now landing, and
  `wall_clock_ms` is numeric on **367/367**. The absolute-cost side therefore
  exists; what is still missing is the counterfactual and the quality columns,
  which is a narrower gap than the prose above describes. `spawn_count ≥ 2` is
  still **0 of 367**, so the corpus has never produced a fan-out.
- **Recommendation:** **(agent-drafted 2026-08-18 — this entry predates the
  field; drafted from the roadmap's own text for the consolidated decision
  sheet, not from a maintainer decision.)** Run the payload probe FIRST and
  treat its answer as the decision, rather than accumulating more usage. The
  entry's own re-measurement is decisive on this: at 367 orchestration lines
  the quality columns are `null` 367/367 and `spawn_count ≥ 2` is 0 of 367, so
  more of the same telemetry cannot populate the columns PROVE needs. If no
  hook slot sees the task-completion payload, Phase 3's verdict is an **honest
  null** and this roadmap terminates on that finding instead of waiting; only
  if a slot does see it is the ≥ 20-populated-line window worth opening.
- **If you do nothing:** 6 steps wait on a window that the entry's own numbers
  suggest may never fill, and the roadmap keeps reading as resumable to every
  feasibility screen — the exact misreading the 2026-08-17 rewrite of the
  Resolved-when was written to stop. A blocker whose condition cannot be
  reached is a park or a null, not a wait.
- **Answer:** NOT COVERED by option (a) — 2026-08-20, disposition **transferred**. The
  rendered default (run the payload probe FIRST, rather than accumulating more usage) is
  accepted as the ORDERING and is what batch A's rationale rests on: line count is
  already satisfied and no longer diagnostic. The probe itself is a named live-host
  task-completion observation, so Rule 3 in
  [drain-blocker-dispositions-a](../evidence/council/drain-blocker-dispositions-a.md)
  assigns it `B`, merged with `telemetry-sample-size` into ONE task-completion
  observability stub. Batch A carries the three-point check verbatim: original criterion
  for both entries, Phase 1 telemetry seeding / Phase 2 evaluation / Phase 3's dependent
  decision moved, re-entry producer the subagent-observability maintainer.
- **Resolved when:** a probe result records whether any hook slot sees the
  task-completion payload, and — if one does — the current-month audit log
  carries ≥ 20 orchestration lines whose **quality** columns are populated
  rather than `null`. **Rewritten 2026-08-17.** The bare line-count condition
  this field carried until today (*"the current-month audit log holds ≥20
  orchestration lines"*) was satisfied at 99 lines when it was written and
  stands at **367** now, while the blocker never stopped being open — a
  resolution test that is already met cannot resolve anything, and every
  feasibility screen that trusted it read this roadmap as resumable. The
  sibling `road-to-subagent-value-realization-followup` had the identical
  defect repaired on 2026-08-16; this one was missed in the same pass.

  **Carried forward unchanged, 2026-08-20.** This criterion is not weakened and
  not withdrawn — it now lives as P1 (the `SubagentStop` payload capture) and P2
  (≥ 20 rows with populated quality columns) in
  [`stubs/road-to-task-completion-observability.md`](stubs/road-to-task-completion-observability.md),
  both measured FAILING at transfer, alongside a P3 the criterion never named:
  one row with `spawn_count >= 2`, also 0 of 570. The probe half of the sentence
  has been discharged; the ≥ 20-populated-lines half has not, and the probe's
  own finding (c) is why it cannot be discharged by a hook at all.
