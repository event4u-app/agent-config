---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
owner: maintainer
estate_growth_exempt: "One active roadmap and one open blocker (realistic-fakes-for-hands), which is an owner turn of 2026-10-22 at odds with N4 of road-to-one-detector-and-the-senders-we-own and therefore cannot be settled by an agent. Everything else in the owner's turns of that day is already owned elsewhere and is folded there (Phase 4), not re-planned."
estate_offset_exempt: "No active roadmap owns whether a dispatch actually runs on the tier the policy names: road-to-a-cold-start-paid-once owns how often a worker pays its standing layer, road-to-free-hands-a-paid-head-checks owns routes the package does not pay for, and the two archived routing roadmaps closed on telemetry, not on realisation. Archiving an unrelated finished file to buy the slot would hide the growth this key exists to show."
relates:
  - slug: road-to-a-cold-start-paid-once
    relation: depends
    note: "Its open steps 2.5 (instruction skip ships on) and 5.1 (lighter council seat launch) are the highest-yield answers to the owner's 2026-10-22 'minimal setup, targeted workers' turn. They are executed there; 4.3 here only records the ordering. Its kills K2, K3, K4 and K5 bind this file."
  - slug: road-to-free-hands-a-paid-head-checks
    relation: extends
    note: "That file owns free routes (rung 0.5). This file owns the paid lite tier on the host vendor (rung 1). Phase 4 here folded an attestation field, an egress canary run, a loopback self-hosted route and the owner's minimal-slice turn into it, in the same change; its phases and blockers are otherwise unchanged."
  - slug: road-to-one-detector-and-the-senders-we-own
    relation: extends
    note: "Blocker realistic-fakes-for-hands poses the owner question against its N4; whichever way it falls, the decision line is recorded there."
  - slug: road-to-placeholders-on-the-wire
    relation: disjoint
    note: "Host channels and the request gateway stay there. Nothing here sends a payload anywhere new."
depends:
  - road-to-a-cold-start-paid-once
---
# Road to a tier the dispatch carries

> **Source:** `agents/tmp.old/inbox-2026-10-z/` — one owner chat on 2026-10-22 (five owner
> turns) and two supplied plans for it (one of them named its architecture "Adaptive Context &
> Session Orchestration"). Tree facts were re-verified at `origin/main@01ae122` on 2026-10-22,
> after PR #2582 merged; the supplied plan's own pin was `447f8fd`. External sources are coded
> S1–S12; their identities stay out of the tree.

> **Owner directives (2026-10-22, chat):**
> 1. Free endpoints only for uncritical work that does not touch data protection; customer
>    data filtered or replaced with fakes ("Max Mustermann"); code reduced to what is needed —
>    the function to build, not what exists; paid or self-hosted models repair and finish.
> 2. The agent may also use smaller, cheaper models of its own vendor; not necessarily as a
>    subagent — a new agent or session it orchestrates, each with only the rules and skills it
>    needs, the rest loaded on demand. Goal: subagent runs that cost less.
> 3. Results stay at the usual quality; cost goes down.

## Goal

A slice that the policy already says is `lite` runs on `lite`, the record shows it ran there,
and quality and paid cost of those legs are measured against the inherit legs before any
default changes. Nothing new decides the tier: the cheapest-sufficient table that exists today
decides; this file makes the dispatch carry its answer and makes the answer observable.

Success is checkable:

1. Every recorded dispatch names the tier chosen, the model requested and the model served;
   a divergence between the last two is visible, never assumed away (1.1).
2. A `lite` slice reaches the host as a per-call model argument, so no agent definition is
   added or changed mid-session (1.2, cold-start K4).
3. Two claims are filed before any default flips; a flip is per slice kind and reverts on the
   existing 0.3 escalation kill (Phase 2).
4. The owner's request for realistic fake data is answered by a dated owner line, not by an
   agent re-reading N4 (blocker `realistic-fakes-for-hands`).

## What this roadmap is not

Not a session runtime, a worker pool, a supervisor, a session broker, a router or gateway, a
learning router, a profile engine, a memory layer or a framework dependency — each is killed
below with the tree fact that already covers it or forbids it. Not a re-plan of the instruction
skip or the council seat launch (owned by `road-to-a-cold-start-paid-once`), nor of free routes
(owned by `road-to-free-hands-a-paid-head-checks`). No new settings key (owner directive
2026-10-12, cold-start K6). No percentage savings target (cold-start K7).

## Context — defects reproduced on this tree

| # | Defect | Evidence | How checked |
|---|---|---|---|
| T1 | The tier policy and the shipped definition disagree. Read-only fan-out is `lite` in both tables (`src/agent-src/contexts/model-recommendations.md:52`; `src/agent-src/contexts/execution/auto-dispatch-classification.md:169`); `ac-researcher` is read-only (`src/subagents/ac-researcher.md:8`) and declares `model_tier: inherit` (`:6`). All three shipped definitions declare `inherit` (`ac-worker.md:7`, `production-validator.md:13`). | files cited | read |
| T2 | The downshift has never been realised in a record. Over 327 `orchestration` records, `session_tier` was non-null 0 times and `tier_chosen` once (`agents/evidence/analysis/downshift-vs-cache.md:136-140`, run 2026-08-16). **Re-counted 2026-10-22** over the maintainer's local audit store (`agents/runtime/state/audit/`, one machine, 2026-07-28 → 2026-10-22): 2,272 records, `tier_chosen` non-null once, `lite` never, `model_requested` and `model_served` never set. The record has fields for both (`src/scripts/_lib/orchestration_record.ts:150-164`); only the rung-0.5 ask line writes them (`src/scripts/ask_transport.ts:113-114`), no spawn dispatch does, and the recount saw no ask that reported a model. The recount reads a gitignored store and cannot be re-run from the tree. | evidence file + schema + local recount | read + count |
| T3 | The only carrier of the tier is a nudge text. `resolveSubagentRouting` has one production caller, the delegation nudge, which injects a "lite, downshifted" recommendation (`src/scripts/hooks/delegation_nudge_hook.ts:22-25`, `:334`, `:340`); nothing records whether the dispatch then carried a model argument. The host's Agent dispatch accepts a model per call and a definition's `model` field accepts `inherit` (S7). | grep + S7 | read |
| T4 | The cost lever has a stale honest-null history. `subagents.auto` has been held at `ask` since 2026-06-26 for want of realised-cost telemetry (`agents/roadmaps/archive/road-to-subagent-value-realization.md:27`); the one measured downshift candidate (`production-validator` inherit→medium, ~16 % cheaper at unchanged outcome) was listed and never flipped (`agents/roadmaps/archive/road-to-cost-aware-model-routing.md:149`). | files cited | read |
| T5 | The owner asked on 2026-10-22 for realistic fakes ("Max Mustermann"); the shipped design refuses them: "A fake IBAN can be someone's real IBAN" (`agents/roadmaps/road-to-one-detector-and-the-senders-we-own.md:106`, N4). The placeholder grammar's 20/20 result (`:118`, D3) measures that a model *copies* the token, not that a draft written around a token is as good as one written around a fake. The quality question is unmeasured. | files cited | read |
| T6 | The host offers a cheap-executor/strong-advisor pairing (a CLI advisor flag and an API advisor tool, S8); the tree has no reference to it — `advisor` appears only as the council's thinking-style advisors (`src/domains/meta/council/command.md`), never as the host's advisor tool. | grep + S8 | grep |
| T7 | A spawn still pays the full standing layer. Custom subagents load the instruction hierarchy by default (S7); the skip measured on 2.1.306 also drops the user-level rule layer (`src/scripts/_lib/subagent_spawn.ts:51-55`) and is worth ≈ 58 % of the median cold start, but ships off because the frontmatter spelling is unobserved (`agents/roadmaps/road-to-a-cold-start-paid-once.md:265-271`). **Owned there (2.5).** | files cited | read |
| T8 | The Claude council seat launches with `--print --output-format json --model … --tools "" --append-system-prompt` and no settings scoping (`src/scripts/ai_council/clients.ts:1696-1733`); a seat's first call writes a median 102,612 tokens, n = 4 (`agents/evidence/analysis/spawn-burst-baseline-2026-10.md:102`). **Owned there (5.1).** | files cited | read |
| T9 | One free-tier provider's terms require paid services as soon as an API client is made available to users in the EEA, Switzerland or the UK (S4). This package is a distributed client. The data-use attestation planned in `road-to-free-hands-a-paid-head-checks` 2.3 records training and retention, not distribution. | S4 + PR #2582 file | read |

**Reused, not rebuilt:** the cheapest-sufficient table and its "never guess down" guard
(`auto-dispatch-classification.md:107-122`, `:162`); `TIER_TO_CLAUDE_MODEL`
(`src/scripts/_lib/model_tier.ts:36-41`); the orchestration record and its validator
(`orchestration_record.ts`); `composeSpawnBrief` with refs-only knowledge, the carried floor and
prefix-stable serialisation (`subagent_spawn.ts:97-190`); `cache_realization_report` and
`orchestration_savings_report`; the 5 pp and 0.3 kills of `src/config/dispatch-economy-metrics.json:37-47`;
the judge-one-tier-up ladder (`src/agent-src/contexts/subagent-configuration.md:15-22`).

## Phase 0 — Read before building

- [x] **0.1 Re-read T2 on the current host.** <!-- receipt: class=R0 · shadow · scope=safe · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural --> Run `cache_realization_report` and
  `orchestration_savings_report` over the last 14 days; record the share of dispatches with a
  non-null `tier_chosen`, the share of `lite` among them, and the share where `model_served`
  differs from `model_requested`. Record in `agents/evidence/analysis/`.
  verify: the analysis states the three shares, the host version and the record count.
  Done 2026-10-22: `agents/evidence/analysis/tier-realisation-2026-10-22.md` § Step 0.1 — host 2.1.308, 435 orchestration records in 14 days, `tier_chosen` 0 %, `lite` share n/a, `model_requested`/`model_served` 0 of 435; transcripts show 14 of 443 legs served on `haiku`, none of them recorded as such.
- [x] **0.2 Probe the carrier (T3).** <!-- receipt: class=R0 · shadow · scope=safe · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural --> Dispatch `ac-researcher` (`model: inherit`) once with a
  per-call model argument naming the `lite` model; read the served model from the transcript.
  A carrier that is silently ignored on some host builds is a known failure mode (S10), so the
  probe result is a row with host version, requested and served id — not a belief.
  verify: the evidence row exists; on `served ≠ requested` Phase 1.2 stops and the null is
  recorded.
  Done 2026-10-22: same file § Step 0.2 — on 2.1.308 `ac-researcher` (`model: inherit`) dispatched with `model: haiku` served `claude-haiku-5-5` on 7 of 7 calls. Green; 1.2 may proceed.

## Phase 1 — The tier rides on the dispatch (T2, T3)

- [x] **1.1 Every suite-recorded dispatch carries the four fields** <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/scripts/hooks/orchestration_record_hook.ts --> `tier_chosen`,
  `session_tier`, `model_requested`, `model_served`; a record with `tier_chosen` and no
  `model_requested` fails validation. No new field.
  verify: a validator test refuses that record; a fixture dispatch writes all four.
  Done 2026-10-22 (commit aa74c70c5f): the validator refuses `tier_chosen` without `model_requested` (`_lib_orchestration_record.test.ts` › refuses tier_chosen without model_requested); the `orchestration-record` hook writes all four from the dispatch's `model` argument, the served id and the head's transcript tail (`orchestration_record_hook.test.ts` › a fixture dispatch writes all four). Live check first: a `model: haiku` dispatch from this session had been recorded with all four null, because the hook never read `tool_input.model`. On this host most dispatches launch async, so `model_served` stays null for them — the ack carries no usage — and only the request half is recorded.
- [x] **1.2 The nudge names the argument, not the word.** <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/scripts/hooks/delegation_nudge_hook.ts --> When the ladder resolves a slice to
  `lite`, the nudge names the per-call model value from `TIER_TO_CLAUDE_MODEL` and the slice
  kind that earned it; it never auto-spawns and never names a tier the table did not produce.
  Runs only on a green 0.2.
  verify: a nudge fixture for a read-only fan-out slice names the mapped model value and
  dispatches nothing.
  Done 2026-10-22 (commit 1f48d0ff15): the tier comes from `inferSliceTier` over the prompt's slice kind; only a read-only fan-out earns `lite` and names `model: "haiku"`, an unknown kind says `inherit`. Test: `delegation_nudge_hook.test.ts` › a read-only fan-out nudge names the mapped model value and dispatches nothing.
- [x] **1.3 A `lite` leg does not climb by itself.** <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/orchestration_record.ts --> It never spawns, and a slice it cannot
  finish returns to the head with a named reason; the head re-dispatches one tier up per the
  existing verify-fail cascade. The escalation is a record, not a retry inside the leg.
  verify: an escalation fixture produces one `lite` record with a reason and one `medium`
  record, never a `lite` record that spawned.
  Done 2026-10-22 (commit de939ddb62): `liteEscalationRecords` (`src/scripts/_lib/subagent_steering.ts`) yields the lite record with its outcome and the head's `medium` record with `escalated_from: lite`; a second failure fails the slice instead. The builder now writes `escalated_from`, which the contract already named. Tests: `_lib_subagent_steering.test.ts` › liteEscalationRecords (three cases, including that neither package worker holds `Agent` or `Task`).

## Phase 2 — Measure, then flip per slice kind (T1, T4)

- [x] **2.1 Two claims filed before any paired run:** <!-- receipt: class=R0 · shadow · scope=safe · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural -->
  `tier-downshift-quality-held` — verify-fail plus escalation rate of `lite` legs is at most the
  inherit legs' rate + 5 pp, and below the 0.3 escalation kill;
  `tier-downshift-limit-relief` — price-weighted billable tokens per *verified* slice, using
  the cache weights the tree already applies (read 0.1×, 5 m write 1.25×), with every
  escalated re-run charged to the `lite` arm. Underpowered means neither is backed.
  verify: both rows exist in `docs/CLAIMS.md` with bars before the first paired run, and
  `check_claims` is green.
  Done 2026-10-22 (commit e61a0db79c): both rows `unbacked` in `docs/CLAIMS.md`, `build_proof` run in the same change, `check_claims` green (117 entries).
- [x] **2.2 Paired run.** <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/tier_downshift_verdict.ts --> Read-only fan-out slices only (the one kind both tables already put
  at `lite`); each slice runs once per arm, both verified; capped at decision A2.
  verify: the ledger shows two arms with a verify result for every slice.
  Done 2026-10-22: 60 read-only fan-out slices, each once per arm in a print-mode child session (subscription, no metered API), against a pinned snapshot; both arms verified 60/60, `lite` cost 0.00152 USD per verified slice against 0.01548 on inherit (`sonnet`). Harness `internal/bench/tier-downshift/run.ts`, verdict as code `src/scripts/_lib/tier_downshift_verdict.ts` (tests `_lib_tier_downshift_verdict.test.ts`), rows `internal/bench/tier-downshift/results.jsonl`, report `agents/evidence/analysis/tier-downshift-paired-run-2026-10-22.md`. Held exactly at the 5 pp margin by the rule of three.
- [x] **2.3 Flip per kind.** <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/tier_downshift_verdict.ts --> A kind that clears both bars gets `lite` as its default
  dispatch; then — and only then — `ac-researcher` declares `model_tier: lite` (T1). A later
  breach of the kill reverts the kind and records the reversion in the claim row.
  verify: a seeded breach above the kill reverts the kind; `ac-researcher.md` changes in the
  same commit as the backed claim, never before.
  Done 2026-10-22: both claims `backed` and `ac-researcher` → `model_tier: lite` in one commit; the test `ac-researcher-tier-follows-the-claim` fails whenever the definition and the claims disagree (seen red by setting `lite` before the backing); `kindTierAfter` reverts a lite kind on a seeded breach (`_lib_tier_downshift_verdict.test.ts` › a seeded breach above the kill reverts a kind already on lite).

## Phase 3 — Advisor pairing, measured or closed (T6)

- [x] **3.1 Probe once per host version** <!-- receipt: class=R0 · shadow · scope=safe · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural --> whether a dispatched worker (not only the main
  session) can run with an advisor, and record what the advisor's calls cost in the usage
  report.
  verify: an evidence row per host version; if no worker path exists, the phase closes as a
  recorded null and K12 applies.
  Done 2026-10-22 (commit f3a3b4dcc7): on 2.1.308 a `haiku` `ac-researcher` dispatched under `--advisor opus` (experimental variable set) consulted the advisor — `advisor_tool_result` in its own transcript; the advisor billed 26,109 uncached input and 1,683 output tokens on `claude-opus-5-5`. Row in `tier-realisation-2026-10-22.md` § Step 3.1. A worker path exists; K12 does not apply.
- [x] **3.2 Only on a green 3.1:** <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/tier_downshift_verdict.ts --> one pre-registered comparison on bounded implementation
  slices — `lite` executor with a `high` advisor against `medium` alone, same two bars as 2.1.
  No adoption step in this roadmap; a backed claim opens its own.
  verify: the claim row precedes the run; the run report names both arms' verified costs.
  Done 2026-10-22 (commit 23428d8b20): claim `advisor-pairing-held` filed (commit a8ac989ea3) before the run; 60 pairs (`internal/bench/advisor-pairing/run.ts`), quality held (60/60 against 58/60) and cost failed — 0.2838 USD against 0.0204 per verified slice, the advisor's input billed uncached. Resolved null; report `agents/evidence/analysis/advisor-pairing-run-2026-10-22.md`. No adoption step, per the step.

## Phase 4 — Folds into the owners (no build here)

4.1–4.3 and 4.5–4.7 were applied in the change that added this file, so the owner files carry
them from day one; only 4.4 waits, on its blocker.

- [x] **4.1 Into `road-to-free-hands-a-paid-head-checks` 2.3 (T9):** the data-use attestation
  records whether the route's terms permit a client distributed to users in the EEA,
  Switzerland and the UK; without it a route is never a consumer default.
  verify: the 2.3 text names the field and the consumer rule.
- [x] **4.2 Into the same file's 3.5:** the owner turn "only what is needed — the function to
  build, not what exists" is quoted as a second rationale; the slice is the function's
  specification plus the signatures it must call (its decision A6), and the hand's system
  prompt carries no project rule, skill or instruction-file text.
  verify: 3.5 quotes the turn with its date.
- [x] **4.3 Into `road-to-a-cold-start-paid-once`:** a dated note that the owner's minimal-setup
  turn is answered by its 2.5 and 5.1, recommended ahead of its Phase 3 shadow window.
  verify: the note exists with the date and both step ids.
- [x] **4.4 Into `road-to-one-detector-and-the-senders-we-own`:** <!-- receipt: class=R0 · shadow · scope=safe · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural --> the decision line of blocker
  `realistic-fakes-for-hands`, either way. The question itself is already pointed to from that
  file's N4.
  verify: the line is in that file's decisions table with a date.
  Done 2026-10-22: D11 in that file and A7 here, option (a), dated; resolved by council 2/2 under the run's delegation and listed for the owner, not by an owner line.
- [x] **4.5 Into the free-hands file's 1.3:** an egress canary run — planted values in payload,
  system prompt and quotable rule text, sent to a loopback mock endpoint — before any free call.
  verify: the 1.3 step exists in that file.
- [x] **4.6 Into the free-hands file's 2.5 and 3.3:** a loopback self-hosted route class (the
  owner's "paid or self-hosted models repair") and a hand's return treated as untrusted data.
  verify: both texts exist in that file.
- [x] **4.7 Into `later/road-to-gateway-harvest`:** its arrival count raised to 5.
  verify: the `Arrivals:` line reads 5.

## Kill register

| # | Not done | Why |
|---|---|---|
| K1 | A package-owned session runtime, worker pool or supervisor that reconciles desired against running sessions (S1) | cold-start K2: the package cannot observe a child's lifecycle; the drive loop that spawned host sessions is frozen (`src/cli/python/workspace_drive.ts:2-3`, ADR-206) |
| K2 | Headless host sessions as the default worker form | each is its own cold start (cold-start K3); the stripped launch flag drops the subscription login (cold-start K5); the lighter launch that keeps it is probed in cold-start 5.1 |
| K3 | A local broker for messages between sessions (S2) | in-memory state, one machine; a teammate mode exists in the host, is experimental and costs grow linearly with teammates (S7) — cold-start K3 |
| K4 | A per-dispatch profile engine assembling rule and skill sets per task | changing the agent set mid-session breaks the main conversation's cache (cold-start K4); `composeSpawnBrief` already carries profile, refs-only knowledge and the floor in a prefix-stable form (`subagent_spawn.ts:97-190`); install-time packs already scope skills |
| K5 | A proxy or router under the host (S5) | the package is not a router (`road-to-host-inputs-the-installer-honours` K4); subscription credentials may not be routed through third parties (S11); tool calls degrade through translation (S5) |
| K6 | A self-learning or classifier router | a static per-dimension table reaches most of the oracle at near-zero overhead (S9); the tree's table is static and stays so |
| K7 | Durable-workflow, memory or agent frameworks as dependencies (S3, S6) | run checkpoints, capsules and the continuity envelope exist; no consumer needs a second schema (cold-start K9) |
| K8 | `production-validator` inherit→medium | it judges; the judge sits one tier above the work it judges (`subagent-configuration.md:15-22`) and the archived roadmap kept the judge asymmetry invariant (`archive/road-to-cost-aware-model-routing.md:150`) |
| K9 | Downshifting an unknown or ambiguous slice | "never guess down" (`auto-dispatch-classification.md:162`) |
| K10 | A percentage savings target, including the illustrative 50.8 % of the supplied plan | cold-start K7; only pre-registered bars with a null exit |
| K11 | A name or address recogniser to find what to fake | declined twice (`road-to-one-detector-and-the-senders-we-own` N2; `road-to-placeholders-on-the-wire.md:672-673`) |
| K12 | An advisor pairing without a worker path observed on the host | 3.1 closes as a null instead |
| K13 | Any redactor that sends the payload to a third-party service to produce placeholders (S12) | the filter becomes a recipient; N5 of the one-detector roadmap |
| K14 | A new settings key for any of this | owner directive 2026-10-12; cold-start K6 |

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| A1 | reversible-technical | agent | A roadmap of its own, not a fold into the cold-start file | that file owns how often a standing layer is paid; tier realisation is a different lever on a different record, and its Phase 3 shadow is already a council-refused step (`road-to-a-cold-start-paid-once.md:305-322`) that this work must not wait behind | the cold-start file closes Phase 3 |
| A2 | reversible-technical | agent | The 2.2 paired run is capped at 60 slice pairs | enough to see a 5 pp difference on a high-pass-rate kind only as a direction; a direction is reported as such, and an underpowered run backs nothing | the per-kind sample is underpowered at the cap |
| A3 | reversible-technical | agent | The tier is carried as a per-call model argument, not by new or edited definitions | cold-start K4; T3 | the host drops the per-call argument (0.2 red) |
| A4 | reversible-technical | agent | The ChatGPT plan's twelve-phase runtime is declined wholesale, its measurement-first ordering kept | K1–K7; its own section 9 asked for an A/B against today's runtime first, which is Phase 0 and 2 here | — |
| A6 | reversible-technical | agent | No hysteresis or turn-by-turn model switching of the main session | the head never switches its own model (the user owns it, `delegation-policy` scope); a per-call tier on a dispatch switches nothing mid-session, so the cache cost a switching router must amortise does not arise | the host adds a per-turn model override for the main session |
| A5 | reversible-technical | agent | Only the read-only fan-out kind enters the first paired run | the one kind both tier tables already assign to `lite` with deterministic verification (`model-recommendations.md:52`) | the kind's sample is too small at the cap |
| A7 | product-owned | owner | Blocker `realistic-fakes-for-hands`: option (a) — keep N4, values leave as tokens; T5 becomes a pre-registered comparison triggered at a 5 pp verify-fail gap. Owner decision O1, dated 2026-10-23, confirms the council's 2/2 default of 2026-10-22 | tokens leak the least; (b) would add a second substitution path before the identifier half of the detector exists | the T5 trigger fires and a privacy review clears independently generated fakes |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-23 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Cheaper legs, more re-runs | product | `lite` legs escalate often enough that the re-runs cost more than the downshift saved. | 2.1 charges every escalated re-run to the `lite` arm; the 0.3 kill reverts the kind. | Phase 2 — Measure, then flip per slice kind (T1, T4) |
| 2 | The served model is not the requested one | implementation | The host ignores the per-call argument on some builds and the record attributes a saving to a model that never ran. | 0.2 probe per host version; 1.1 records both ids; divergence is shown. | Phase 0 — Read before building |
| 3 | Quality drifts below what the verify step catches | product | A `lite` research leg returns a plausible but thinner answer that still passes verification. | Only the deterministic-verify kind enters 2.2 (A5); judges never downshift (K8). | Phase 2 — Measure, then flip per slice kind (T1, T4) |
| 4 | Distributed-client terms breached | product | A free route whose terms forbid distributed clients becomes a consumer default. | 4.1 makes the field mandatory for consumer admission. | Phase 4 — Folds into the owners (no build here) |

## Blockers

### blocker: realistic-fakes-for-hands
- **Status:** resolved — the owner chose (a) on 2026-10-23 (decision O1), confirming the council's 2/2 default of 2026-10-22 (`agents/evidence/council/subagent-system-2583-owner-blockers-20261022.md`); recorded as A7 here and D11 in the one-detector file
- **Owner:** maintainer
- **Class:** 3 — human-only
- **Blocks:** step 4.4 only. Phases 0–3 run without it.
- **What to do:** pick exactly one — (a) keep N4: values leave as `__TYPE_n_fp__` tokens everywhere; record the quality question of T5 as a pre-registered comparison to run if hands' verify-fail rate on token-bearing payloads exceeds the paid arm by more than 5 pp; or (b) admit fakes drawn only from ranges reserved for documentation or test use — domains under `example.*` and `.test`, documentation IP ranges, a fixed list of conventional placeholder names, IBAN shapes with a deliberately failing check digit — on free-route payloads only, each fake reversible through the existing token scope, never on a paid seat, and only after a pre-registered bar shows fakes raise the hands' verify pass rate over tokens.
- **Recommendation:** (a). N4's objection holds for every class without a reserved range (phone numbers, tax ids), the token grammar already survives the model (D3, 20/20), and (b) would add a second substitution path to a detector whose identifier half has not landed (`road-to-one-detector-and-the-senders-we-own` 2.3 open). (b) stays the evidence-gated next step.
- **If you do nothing:** values keep leaving as tokens (today's behaviour); the owner's turn stays unanswered and arrives again.
- **Resolved when:** a dated owner decision line naming (a) or (b) is recorded in this file's `## Decisions` table and in the one-detector file (4.4).

## Acceptance Criteria

- [x] AC-1 The served-versus-requested share and the downshift share are published for the current host (0.1).
- [x] AC-2 A `lite` slice reaches the host as a per-call model argument, observed served (0.2, 1.2).
- [x] AC-3 Every suite-recorded dispatch carries the four tier fields (1.1).
- [x] AC-4 Both Phase 2 claims are filed before the first paired run; any flip cites them and reverts on the kill (2.1, 2.3).
- [x] AC-5 The advisor phase ends as a backed claim or a recorded null (3.1, 3.2).
- [x] AC-6 The four folds are present in their owner files (Phase 4).
- [x] AC-7 The fake-data question carries a dated owner line (blocker). *(2026-10-22: a dated council line, A7, applied as the default under the run's delegation.)* Done 2026-10-23: owner decision O1 confirms option (a); A7 here and D11 in the one-detector file are owner lines.
