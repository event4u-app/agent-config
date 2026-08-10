---
complexity: lightweight
parent_roadmap: road-to-inbox-harvest-2026-08-b.md
---

# Road to release-surface integrity

> Reduce the release surface's unbacked-claim count to zero on the one flow that
> ships them: the curated CHANGELOG head, the carrier-divergence figure, and the
> four report gaps five independent reviews asked for.

> Source (consumed inbox): `agents/tmp.old/feedback-9.30.0-1.txt` — part of the
> 2026-08-10 batch triaged by [`road-to-inbox-harvest-2026-08-b.md`](road-to-inbox-harvest-2026-08-b.md).

## Context / What is verified

Five independent reviews plus one scorecard over the identical commit; the scores
disagree with each other (taste, not signal). ~400 assertions reduce to 44
checkable claims. What survived verification at HEAD `9e999d64e`:

- **The recurring defect is real.** `CHANGELOG.md:329` (v9.32.0) still reads
  `_auto-derived, rewrite before merge:_` in its Behaviour-changes head line;
  v9.31.0's head is clean (`CHANGELOG.md:379-384`), and
  `src/scripts/check_release_highlights.ts:205` prints `— advisory, not blocking.`
- **The loudest P0 rests on a false premise, and the real number is 78% smaller.**
  "109 divergent carrier pairs, binding undefined" is wrong:
  `road-to-carrier-layer-convergence.md:24-42` records all 109 as
  **byte-identical prose** — the whole difference is frontmatter — leaving **24**
  rules whose copies disagree on `paths:`, where the global copy **un-scopes** a
  project-scoped rule. Over-delivery only, never a missing obligation. The
  instrument bug behind the original figure was fixed in `c48b6c88c`.
- **Two cited figures are withdrawn by our own tree.** "87,677 of 230,556 tokens
  = a measured ~15% lever" is a **38.0% reduction against a pre-registered 15%
  bar** (a bar is not a lever), recorded unreachable for production installs,
  "the recipient set is empty" (`docs/proof.md:82`, `docs/CLAIMS.md:350`). The
  language-detector rates were withdrawn by `313e66535`, then moved twice more
  under their own corrections; best-founded reading A 2.7% / B 25.4% over 30
  sessions, 185 turns, 2252 entries, still provisional
  (`archive/road-to-conformance-round5.md:427-435`).
- **The command surface is at 196** (`docs/proof.md:51`), so every new capability
  below is a **flag** on an existing verb, never a 197th command.

## Phase 1 — The release head cannot ship its own placeholder

The exclusive alternative to a hard block is rewriting the head comment to document
retro-curation as the real cadence, making the placeholder legitimate until
curation. Both cannot be done, and the script argues against the flip itself:
`check_release_highlights.ts:196-200` keeps the exit code owned solely by the
`_none_` check because "a warning that reds the build is the guaranteed-red failure
mode this whole change exists to remove". So the flip is a decision revisit, not a
fix.

- [ ] **1.1 Rewrite the shipped placeholder line by hand.** `CHANGELOG.md:329` is
      wrong today whichever cadence wins — the release is out and the line still
      says rewrite-before-merge. Curate it from `1f01490`, `e05de77`.
- [ ] **1.2 State the cadence question in the contract, both branches.** Neither
      `docs/contracts/release-pr-gating.md` nor
      `docs/contracts/CHANGELOG-conventions.md` says whether the curated head is a
      merge precondition or a retro-curation surface. Record both readings and the
      one the blocker picks — no behaviour change.
- [ ] **1.3 Pin the current advisory behaviour with a fixture.** Extend
      `tests/scripts/check_release_highlights.test.ts` so a placeholder head
      produces exit 0 plus the advisory line, making the decision a one-line diff
      either way.
      <!-- verify: task test -- --filter=check_release_highlights -->
- [~] **1.4 Flip the placeholder check to blocking for the final release head.**
      Deferred behind `release-head-cadence-decision`. The gate is constructible
      despite *a measurement is not a gate*: the placeholder string is emitted by
      our own generator into our own file, so the false-positive class is **empty
      by construction** — no third party can produce that byte sequence in a
      curated head. The argument holds; wanting the gate is the maintainer's call.

## Phase 2 — The carrier remainder, with its premise corrected

- [-] **2.1 Cancelled: re-planning the carrier fix.** Already
      [`road-to-carrier-layer-convergence.md`](road-to-carrier-layer-convergence.md)
      Phase 3 (`:152`), 2 open steps, blocked on `b-convergence-machine` (`:178`).
- [-] **2.2 Cancelled: making the 24-of-109 split visible in the report.** Shipped:
      `src/scripts/report_carrier_divergence.ts:320` prints the `paths:` subset as
      ACTIONABLE under the frontmatter-only count, and
      `tests/scripts/report_carrier_divergence.test.ts` pins `pathsScopeDiff`.
- [ ] **2.3 Promote the corrected premise to a stable context.** It lives only in a
      roadmap (transient) and in
      `agents/evidence/analysis/carrier-layer-divergence-classification.md`. Per
      `no-roadmap-references`, promote the durable conclusion (109 prose-identical,
      24 actionable on `paths:`, over-delivery) into a context under
      `agents/settings/contexts/` — 70 exist, and contexts are that rule's
      sanctioned promote-target — and cite it from the report's header. Five reviews
      re-cited 109 because the correction had no stable surface.
      <!-- verify: ./scripts-run src/scripts/check_context_paths -->

## Phase 3 — Four flags over data that already exists

- [ ] **3.1 `doctor --anatomy`.** Render the injection anatomy from
      `src/scripts/preamble_byte_census.ts` and
      `src/scripts/dispatch_economy_report.ts`; `doctor` is already registered
      (`src/cli/registry.ts:41`). No new measurement.
      <!-- verify: task test -- --filter=preamble_byte_census -->
- [ ] **3.2 `conformance:why <id>`.** A flag on the existing `explain`
      (`src/cli/registry.ts:58`) and `conformance:behavior`
      (`src/cli/registry.ts:44`) verbs — trace why one conformance id fired.
      <!-- verify: task test -- --filter=runtime_registry -->
- [ ] **3.3 `recycle:verify` plus envelope mutation tests.** A flag on
      `session:recycle` (`src/cli/registry.ts:71`).
      `src/scripts/_lib/subagent_capsule.ts` already does the version check
      (`:495`), unknown-key rejection (`:489`) and a staleness guard (`:223`); the
      gap is a mutation suite proving each rejection fires.
      <!-- verify: task test -- --filter=_lib_subagent_capsule -->
- [ ] **3.4 `surface prune` as a report flag.** Over census data already computed
      in `docs/SKILL_CENSUS.md` and `docs/artefact-census.md`; a flag beats a 197th
      command against a 196-command surface.
      <!-- verify: ./scripts-run src/scripts/check_references -->
- [-] **3.5 Cancelled: the surface-reduction targets themselves.** Owned by
      `road-to-surface-consolidation.md` (92%, 1 open),
      `road-to-solution-minimalism.md` (10 open) and `road-to-tier-removal.md`
      (2 open), bounded by `agents/settings/contexts/surface-consolidation-restraint.md`.

## Phase 4 — Two real contract gaps

- [ ] **4.1 Write the model-ceiling escalation contract.** Genuine gap: a
      case-insensitive `ceiling` grep returns 0 for both
      `docs/contracts/subagent-boundary.md` and `src/rules/delegation-policy.md`,
      so nothing states what a worker does when the ceiling cannot carry the task.
      Extend both: the worker **escalates, never silently degrades**.
      `subagents.model_ceiling` is class C, default `""`
      (`src/config/agent-settings.template.yml:795`,
      `docs/contracts/settings-classes.md:284`) — nothing is capped today.
- [ ] **4.2 Add the funnel's missing Opportunity stage.**
      `src/scripts/report_conformance_funnel.ts` joins delivery to activation to
      compliance (`:128`), prints `NO DATA` honestly (`:187`, `:219`), and carries
      zero hits for `outcome` or `opportunity`. Derive Opportunity from the
      existing transcript store; keep it report-only, as its own header says.
      <!-- verify: task test -- --filter=report_conformance_funnel -->
- [-] **4.3 Cancelled: per-task-class and dollar caps on the ceiling.** No
      over-spend observed and nothing is capped today (4.1), so a cap would be a
      mechanism without a matched failure mode.
- [-] **4.4 Cancelled: outcome-lift and rule A/B on golden tasks.** Collides with
      the terminal activation-red-baseline and thin-projection honest nulls;
      re-running them is relitigation without new evidence.

## Phase 5 — Records, and the asks that need no work

- [ ] **5.1 Decide Continuation Protocol v1 as a record first.** Is one schema
      right, or are the variants correct? The capsule is already
      variant-discriminated at `CAPSULE_SCHEMA_VERSION = 3`
      (`src/scripts/_lib/subagent_capsule.ts:112`, 2 to 3 in #1255). A decision
      record, never a fourth format — the source file's own negative instruction.
- [ ] **5.2 Record the runtime transition graph and loop detector as deferred,
      with a named revisit trigger.** The loop feared is already bounded: the
      turn-end gate refuses at most once per turn per key
      (`src/scripts/hooks/turn_end_gate_hook.ts:442-446`, "costs at most one extra
      refusal") and `session-eol` is `severity: advisory`, `fail_closed: false`,
      and cannot inject `/clear` (`src/scripts/hook_manifest.yaml:501-505`).
      Trigger: a transcript showing a real block, repair, recycle, same-block cycle.
- [-] **5.3 Cancelled: Runtime Event Model / canonical event bus.** The reviewer's
      own condition was "only if it replaces hooks"; the target is already a single
      in-process dispatcher and the item is recorded as CUT to a maintainer
      decision (`archive/road-to-feedback-9-29.md:77`).
- [-] **5.4 Already shipped: hook fusion plus a latency budget.**
      `src/config/hook-latency-budget.json`, `src/scripts/bench_hook_latency.ts`,
      one in-process dispatcher at ~84 ms p95
      (`src/scripts/hooks/dispatch_hook.ts:272-275`, `:617`).
- [-] **5.5 Already shipped: skill-invocation attestation.**
      `docs/decisions/ADR-220-skill-invocation-attestation.md:3` is
      `status: accepted`, dated 2026-08-09 — before the release under review.
- [-] **5.6 Already satisfied: the re-read-guard staleness caution.**
      `src/scripts/hooks/reread_guard_hook.ts:9,24,111,186-191` keys on an
      `{mtime, size}` ledger and fires only on unchanged paths.
- [-] **5.7 Already pre-registered: worker-recycling automation.**
      `worker-capsule-trigger-arm` in
      `later/road-to-worker-generation-recycling.md`, blocked on 30 shadow capsules.
- [-] **5.8 Cancelled: a compaction-survival obligation class.** Gated on a prior
      unknown — the `pre_compact` re-emit is claude-only, "the sole verified
      platform" (`src/scripts/hook_manifest.yaml:541-547`), and whether it lands
      after a real compaction is stated open. Generalising an unverified re-emit is
      the wrong order.
- [-] **5.9 Cancelled: a numeric stop-concern budget.** The premise is wrong: the
      claude `stop` slot carries **9** concerns, not 8
      (`src/scripts/hook_manifest.yaml:537`), and no numeric budget exists in
      `src/scripts/lint_hook_manifest.ts` to hold a ninth entry against.

## Safety — named, not planned

Found in the source file, deliberately not carried into a step: posting the launch
drafts or obtaining an external session before 26.08 — two of five reviews make it
their single P0 — which is irreversible external publication, and `ADR-216:14-16`
strikes adoption as a valid gate while `ADR-134` already governs it as an accepted,
dated, human-owned decision; flipping the turn-end gate default-on (consumer-facing
default flip); posting a mechanical review-summary comment on the release PR
(conflicts with `no-pr-progress-comments`, `pr_progress_comments: false` at
`src/config/agent-settings.template.yml:307`).

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-10 | reviewer: claude/host -->
| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Flipping the highlights check to blocking | implementation | The script's own header argues the flip re-creates the guaranteed-red failure mode it was written to remove, and the item is already recorded as CUT to a maintainer decision — an agent-side flip would relitigate a lock | The flip is `[~]` behind `release-head-cadence-decision`; 1.3 pins today's behaviour first so the decision is a one-line diff either way | Phase 1 — The release head cannot ship its own placeholder |
| 2 | Acting on the 109-pair figure | product | Four of the five reviews treat 109 divergent pairs as the biggest technical debt; suppressing 109 copies on that premise would drop governed text to fix a defect that is 24 rules wide and over-delivering, not missing | 2.1 and 2.2 mark the work cancelled with citations and 2.3 gives the correction a stable surface, so the next reader does not re-derive 109 | Phase 2 — The carrier remainder, with its premise corrected |
| 3 | Four flags becoming four commands | implementation | The surface is at 196 commands and every one of these renders data another script already computes; adding verbs would grow the surface the same reviews asked to shrink | Each step in Phase 3 names its host verb and its registry line; 3.5 points surface reduction at the three roadmaps that own it | Phase 3 — Four flags over data that already exists |
| 4 | The funnel Opportunity stage drifting into a gate | implementation | A joined funnel with a denominator invites a threshold, and the activation-red-baseline null is terminal — a gate here would fail on absent data rather than on a real defect | 4.2 keeps it report-only and 4.4 cancels the A/B arm outright, both citing the nulls | Phase 4 — Two real contract gaps |

## Blockers

### blocker: release-head-cadence-decision
- **Status:** open
- **Owner:** maintainer
- **Blocks:** step 1.4 only. Steps 1.1-1.3 proceed either way.
- **What to do:** Pick exactly one — (a) hard-block the placeholder string in the
  final release head, or (b) rewrite the head comment in
  `docs/contracts/CHANGELOG-conventions.md` to document retro-curation as the real
  cadence. Mutually exclusive, and hard-block was already CUT to a maintainer
  decision at `archive/road-to-feedback-9-29.md:77`.
- **Resolved when:** (a) or (b) is named here and 1.2 records it in the contract.

### blocker: carrier-install-paths-decision
- **Status:** open
- **Owner:** maintainer
- **Blocks:** the fix for the 24 `paths:` disagreements, which lives in
  `road-to-carrier-layer-convergence.md` Phase 3. Nothing here is blocked — 2.3
  proceeds regardless.
- **What to do:** Decide whether `install.ts` should emit `paths:` — consumer-
  visible install behaviour and a default flip, so an ADR candidate and
  maintainer-only. That roadmap explicitly declines to decide it (`:35`).
- **Resolved when:** An ADR records the decision and that roadmap's Phase 3 cites it.

### blocker: adr-221-acceptance
- **Status:** open
- **Owner:** maintainer
- **Blocks:** nothing here. Named because four of the five reviews already treat
  host-native-first as settled doctrine while the record is not.
- **What to do:** Accept or reject
  `docs/decisions/ADR-221-host-native-first-ladder.md`, `status: proposed` at `:3`.
  No code either way — the cheapest survivor in the source file.
- **Resolved when:** `status` is `accepted` or `rejected` and the index is regenerated.
