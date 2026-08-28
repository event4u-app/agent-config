---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
owner: maintainer
review_by: 2026-11-28
research_pin: "agent-config @ 905087463 (origin/main, 2026-08-28). Every gap below was re-measured at this pin by the /analyze:inbox verification pass; two of the four were reported as absent by the source analysis and are in fact PARTLY SHIPPED, which is why their steps are scoped to the missing half rather than to a build."
relates: []
# relates: grepped every active, later and archived roadmap for `prefix`,
# `observation-only`, `daemon`, `resident` and `cache`. Two active roadmaps are
# adjacent and neither owns these floors: road-to-runtime-governance-flip
# (repeals the doctrine, carries no floor) and road-to-supervised-telemetry-
# collector (the first resident process, blocked on the flip's Phase-1 ADR).
# archive/road-to-cache-economy resolved C-1..C-5 and built the measurement
# primitives this roadmap consumes; it does not carry a standing floor.
estate_growth_exempt: "Charges +1 active. Warranted on a measurement: the suite has two active roadmaps that together land the first resident process in this tree, and neither carries a runtime floor for it. Re-measured at 905087463: an observation-only contract for a resident collector does not exist anywhere in src/ or docs/ (0 hits), the loss-class vocabulary does not exist (0 hits), and cache read:write ratio appears in no metric contract (0 hits). The prefix guard that does exist is authoring-time only. A floor that lands after the process it bounds is not a floor. Measured, not predicted: on the committed change `check_estate_count` reads `+5 active / -0 disposed, 5 exempt` and `open_blockers 31 to 42`, of which this file contributes +1 active and +2 open blockers."
estate_offset_exempt: "No archive move is available in this change: the /analyze:inbox run that authored this file consumed only gitignored inbox artefacts and archived no roadmap, so no disposed file can serve as its offset. The two adjacent active roadmaps are draft with open owner blockers and are not this run's to dispose."
---
# Road to runtime context floors — the bounds land before the first resident process, not after it

> **Source:** `agents/tmp.old/context-economy/` — a two-session analysis round
> (2026-08-27) whose external inputs are recorded in the round's own intake
> note and named nowhere here, per `source-confidentiality`. Every claim below
> was re-verified against the tree at `905087463`; two of the source round's
> load-bearing gap claims were **wrong in the direction that matters** and are
> corrected inline rather than carried.

## Goal

Before this suite runs its first resident process, three bounds exist as
contracts with gates behind them: nothing mutates a prefix-stable surface
mid-session without a named re-arm event, a resident observer cannot change
what the dispatch path does, and every transform that loses information
declares what class of loss it is and how the original is recovered. A fourth
piece — cache read:write ratio as a mandatory metric field — exists so the
first two can be shown to be working rather than asserted.

The ordering is the whole point. `road-to-runtime-governance-flip` repeals the
no-runtime doctrine and `road-to-supervised-telemetry-collector` is the first
Class-B process; both are active, both are `draft`, and neither carries any of
these bounds. A floor written after the process it bounds is a description, not
a floor.

## Context

### What the source round got wrong, and why it changes the scope

The analysis that produced this workstream reported all four items as absent
from the tree. Two of them are not, and the correction narrows two phases from
a build to a gap-fill:

| Source claim | Verdict at `905087463` | What actually holds |
|---|---|---|
| "No prefix-stability contract exists" | **partly already-fixed** | `src/scripts/check_kernel_prefix_stability.ts` ships a byte-stability guard over the kernel prefix, snapshotted in `internal/bench/reports/kernel-prefix.json` and re-anchored in the same PR that changes it. `src/scripts/_lib/payload_hash_drift.ts` joins `payload_hash` × `cache_hit` per dispatch so prefix drift is measurable. **Both are authoring-time or after-the-fact.** What is missing is the *runtime* half: no contract says a hook, a script or a resident process may not mutate a prefix-stable surface **mid-session**, and no gate could see it if one did. Phase 1 is scoped to that half only. |
| "No observation-only floor exists" | **still-true** | 0 hits for `observation-only` across `src/` and `docs/`. The collector roadmap does not carry one. |
| "No loss-class type system exists" | **still-true as a vocabulary, false as a practice** | 0 hits for `recoverable-lossy` / `loss_class`. But `src/scripts/fold_intake.ts:13-16` already implements recoverable-lossy with link-backs and never mutates children, and `src/scripts/hot_context_hook.ts` deliberately drops redacted content unrecoverably for privacy. The tree practises loss classes implicitly. Phase 3 names what exists before it constrains what comes next. |
| "Cache economics are unmeasured" | **partly already-fixed** | `src/scripts/cache_realization_report.ts` ships `billable_input = input + cache_read + cache_creation` and resolved C-1..C-5 (`agents/roadmaps/archive/road-to-cache-economy.md:464-468`, C-5 **falsified**). `docs/contracts/ai-council-config.md:1213-1218` already gates model downgrades on `downgrade_savings > lost_cache_savings`. Missing: read:write ratio as a **mandatory field** in the benchmark and cost report contracts — 0 hits. |

### Why cache read:write ratio and not token count

The source round's strongest empirical argument survives verification as an
argument even though its numbers do not. It compared context-shaping arms and
found the arm that reduced input tokens least was the most expensive overall,
because rewriting a prefix repeatedly pays the cache-**write** rate instead of
the cache-**read** rate. The figures come from a third-party benchmark this
checkout cannot reach and are therefore **not evidence here** — they are
recorded as `unverifiable` and carried as a hypothesis, not a result.

What makes the direction safe to adopt anyway is in-tree and measured: C-1
confirmed cold-start dominance at 69.7 %, and C-5 — the one that assumed a
straightforward token-count win — was **falsified**. Token reduction is not the
objective function; cache-stable, smaller, correct contexts are, and the ratio
is the field that distinguishes them.

## Phase 1 — The runtime half of prefix stability

- [ ] **1.1 Declare the prefix-stable surface set.** One list, in a contract
      document, naming every surface whose bytes sit in the cached prefix:
      the kernel bodies the existing snapshot already covers, the skill
      catalogue, the `CLAUDE.md` hierarchy, and any standing-context carrier a
      hook can write to. The list is data, not prose — the gate in 1.2 reads it.
      verify: the contract exists and its surface list is loaded by the 1.2 gate rather than restated in it; `check_kernel_prefix_stability` still passes unchanged.
- [ ] **1.2 A mid-session mutation of a declared surface is a violation.**
      A gate over the hook manifest and the scripts it binds: any writer whose
      target resolves inside the 1.1 surface set and whose slot fires
      mid-session fails, unless it declares a **named re-arm event** — the
      event after which a rebuilt prefix is expected and paid for once
      (`session_start`, `pre_compact`).
      verify: a fixture hook declaring a write to a prefix-stable surface on `post_tool_use` with no re-arm declaration fails the gate; the same hook with `re_arm: pre_compact` passes.
- [ ] **1.3 The existing drift measurement becomes the after-the-fact check.**
      `payload_hash_drift` is wired into the cost report so a stable-cohort
      read share below its unstable cohort is reported rather than latent.
      verify: the report renders both cohorts and their read shares on a fixture ledger, and states "insufficient data" rather than a number when either cohort is empty.

## Phase 2 — Observation-only, before the observer exists

- [ ] **2.1 Write the observation-only contract.** A resident or long-lived
      module in this suite reads **static, versioned configuration** on the
      dispatch path and nothing else. It may not consult its own accumulated
      state, a learned model, or a live counter to decide what the dispatch
      path does. Anything it concludes lands as an **artefact** — a report, a
      candidate, a finding — consumed at a release or restart boundary, never
      inside the dispatch it observed.
      verify: the contract document exists and states the boundary in one falsifiable sentence; `road-to-supervised-telemetry-collector` cites it as a precondition rather than restating it.
- [ ] **2.2 The daemon anti-pattern checklist.** Five questions every
      resident-process design note answers before it is reviewed: what is the
      failure mode when it is not running · what does it do to a dispatch it
      cannot serve · what is its state on an unclean stop · who supervises it
      and with what privileges · what is the uniqueness namespace when two
      checkouts of the same repository run at once. Unanswered is not a
      warning, it is an unreviewable note.
      verify: the checklist exists in the same contract as 2.1 and the collector roadmap's design note answers all five, or names which are open and why.
- [ ] **2.3 Fail-closed ladder for obligations migrated out of standing context.**
      The delivery migration in the adjacent cost-truth workstream moves rules
      out of the always-loaded prefix onto a runtime carrier. This step states
      what happens when that carrier fails: an obligation classified
      **critical-A** stays standing and is never migrated; **critical-B** may
      migrate but falls back to eager delivery when the carrier is unavailable,
      never to silence. Everything else may fail open.
      verify: the classification field exists in the delivery manifest schema and a fixture carrier failure delivers a critical-B obligation eagerly rather than dropping it.

## Phase 3 — Loss classes get names before they get constraints

- [ ] **3.1 Name the classes over what the tree already does.** Five values —
      `exact`, `lossless`, `recoverable-lossy`, `ephemeral-lossy`, `forbidden` —
      each defined by what recovery it guarantees. The definitions are written
      **against existing behaviour**: `fold_intake` is `recoverable-lossy` with
      link-backs, hot-context redaction is `ephemeral-lossy` on purpose, and
      the classification is checked against those two before it is applied to
      anything new.
      verify: the contract classifies both existing transforms and its classification matches their source docblocks; neither transform's behaviour changes in this phase.
- [ ] **3.2 An undeclared lossy transform fails the lint.** Any module that
      shortens, summarises, redacts or drops content on a path that reaches the
      model declares its class and, for `recoverable-lossy`, the recovery path.
      verify: a fixture transform with no declaration fails; the same transform with `loss_class: recoverable-lossy` and a recovery locator passes.
- [ ] **3.3 The passthrough invariant.** A transform that cannot parse its
      input, cannot store the recovery, or does not make the input smaller
      returns the input unchanged. Degradation is never silent and never lossy.
      verify: four fixtures — unparseable, storage unavailable, no recovery path, output not smaller — each return input bytes unchanged, and each is covered by its own test.

## Phase 4 — The ratio becomes a field, not a footnote

- [ ] **4.1 Cache read:write ratio and stable-prefix share are mandatory
      fields.** Both join the benchmark report schema and the cost report as
      required, not optional. A report that cannot compute them says so with a
      reason; it does not omit them.
      verify: `docs/contracts/benchmark-report-schema.md` lists both as required and a fixture report missing either fails schema validation with a named field.
- [ ] **4.2 `cost-per-solved` becomes an available ranking metric.** Not the
      default and not a replacement — an option, so a future comparison can
      rank on cost at held quality rather than on tokens.
      verify: the ranking option exists and a fixture run ranks two arms differently under the two metrics, demonstrating the choice is not cosmetic.

## Blockers

### blocker: which-surfaces-are-prefix-stable

- **Status:** open
- **Owner:** maintainer
- **Blocks:** Phase 1 only. Phases 2, 3 and 4 proceed under either answer.
- **What to do:** pick exactly one — (a) the declared set is the three buckets
  `check_preamble_payload_budget` already measures (project rules, skill
  catalogue, `CLAUDE.md` hierarchy): the boundary is already measured and the
  gate inherits a maintained list, but a standing-context carrier a hook writes
  to is outside it and stays unguarded; (b) the set is every surface a hook can
  write that reaches standing context, enumerated fresh: complete, and it needs
  a first enumeration nobody has produced; (c) start with (a) and record (b) as
  the reopen condition once the delivery carriers land.
- **Resolved when:** the choice is recorded here and 1.1's contract lists the
  chosen set.
- **Recommendation:** (c). It reuses a maintained measurement instead of
  inventing a second list that will drift from it, and it makes the gap
  explicit rather than accidental — the carriers that would widen the set do
  not exist yet, so enumerating them now would be enumerating a plan.
- **If you do nothing:** the runtime half of prefix stability has no surface
  list, so 1.2's gate has nothing to check and the invariant stays prose.

### blocker: how-strict-the-loss-class-lint-is

- **Status:** open
- **Owner:** maintainer
- **Blocks:** step 3.2 only. 3.1 and 3.3 land under either answer.
- **What to do:** pick exactly one — (a) fail the build on any undeclared
  transform anywhere in `src/`: strongest, and the first run will red on
  transforms nobody has classified yet, so it needs a baseline; (b) fail only
  on transforms on paths that reach the model, warn elsewhere: matches the
  threat — an unrecoverable loss only harms where the model consumes it;
  (c) warn everywhere for one release, then ratchet.
- **Resolved when:** the level is recorded and 3.2's fixtures assert it.
- **Recommendation:** (b). The classification exists to protect what the model
  is given; a transform that shortens a log line for a human reader carries no
  such risk, and gating it buys baseline churn instead of safety.
- **If you do nothing:** 3.1 lands a vocabulary nothing enforces, which is the
  weaker half of the item and the half the tree already had implicitly.

## Acceptance Criteria

- [ ] AC-1 — A hook that writes a declared prefix-stable surface on a
      mid-session slot cannot land without a named re-arm event: the fixture
      fails the gate, and the same hook with a declared re-arm passes.
- [ ] AC-2 — The observation-only contract exists and the roadmap that lands
      the first resident process cites it as a precondition, so the floor is
      reachable from the process rather than only from here.
- [ ] AC-3 — Every resident-process design note in the tree answers the five
      checklist questions or names which are open and why; none is silent.
- [ ] AC-4 — A critical-B obligation whose delivery carrier is unavailable
      arrives eagerly in a fixture run; none is dropped.
- [ ] AC-5 — The two existing transforms are classified and their declared
      class matches their behaviour, verified against their own source, not
      against this roadmap's summary of it.
- [ ] AC-6 — A benchmark or cost report that omits cache read:write ratio or
      stable-prefix share fails schema validation naming the missing field;
      one that cannot compute them emits a stated reason instead of a blank.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-28 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The floors land after the process they bound | implementation | Both adjacent roadmaps are active and neither depends on this one; a resident process could land first, at which point every bound here becomes a retrofit against shipped behaviour. | Phase 2 lands the contract before any resident code and step 2.1's verify requires the collector roadmap to cite it, so the dependency is recorded in the file that would otherwise ship first. | Phase 2 — Observation-only, before the observer exists |
| 2 | The prefix-stable surface list drifts from the budget measurement | implementation | Two lists describing the same boundary diverge, and the gate then guards a set the budget gate no longer measures. | The `which-surfaces-are-prefix-stable` blocker's recommendation reuses the measured buckets rather than declaring a second list, and 1.1's verify requires the gate to load the list rather than restate it. | Phase 1 — The runtime half of prefix stability |
| 3 | The loss-class lint reds the tree on day one | implementation | Classifying every transform in `src/` surfaces a backlog nobody budgeted, and the usual response is a broad allowlist that empties the gate. | The `how-strict-the-loss-class-lint-is` blocker scopes the first cut to model-facing paths, and 3.1 classifies the two known transforms before any lint exists to fail on them. | Phase 3 — Loss classes get names before they get constraints |
| 4 | The ratio becomes the number people optimise | product | A mandatory cache read:write field invites tuning the field rather than the cost, which is the Goodhart shape the source round's own falsified C-5 already demonstrates for token count. | 4.2 keeps `cost-per-solved` as the ranking option so the ratio stays diagnostic, and 4.1 requires a stated reason rather than a fabricated number when it cannot be computed. | Phase 4 — The ratio becomes a field, not a footnote |
| 5 | An external benchmark's unverifiable numbers are read as this roadmap's evidence | product | The source round's headline figures come from a third-party run this checkout cannot reach; quoted once without their status they become the justification a later reader cites. | The Context section labels them `unverifiable` and carries them as a hypothesis, and the in-tree C-1/C-5 verdicts are named as the actual basis for the direction. | Context |

## What this roadmap will NOT build

- **A context proxy or any component on the model-call path.** Private data,
  untrusted content and egress on one path is the lethal trifecta; the source
  round proposed it and both of its own consolidators killed it. Not reopened
  here.
- **A general context plane, a content router, or a recovery vault.** Verified
  at the pin: no AC-owned lossy flow in this tree lacks a natural recovery
  source, so these have no defect to attach to. Phase 3 names the classes the
  tree already practises; building machinery for the classes is a separate
  decision with a consumer behind it.
- **A second benchmark framework.** Context shaping becomes a candidate axis in
  the harness that exists, or it does not happen here.
- **Any resident process.** This roadmap writes the bounds. The first process
  is the collector roadmap's, behind the flip's Phase-1 ADR and ADR-124 § 5.
