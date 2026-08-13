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

- [x] **1.1 Rewrite the shipped placeholder line by hand.** `CHANGELOG.md:329` is
      wrong today whichever cadence wins — the release is out and the line still
      says rewrite-before-merge. Curate it from `1f01490`, `e05de77`.
      Done: the v9.32.0 Behaviour-changes line now states the bounded self-fix
      loop (`1f01490`, wired in `10c8f7e`) and records that `e05de77` is a
      rule-file edit with no behaviour change.
      `check_release_highlights --version 9.32.0 --from 9.31.0 --to 9.32.0`
      returns `✅ curated head plausible` with no advisory line.
- [x] **1.2 State the cadence question in the contract, both branches.** Neither
      `docs/contracts/release-pr-gating.md` nor
      `docs/contracts/CHANGELOG-conventions.md` says whether the curated head is a
      merge precondition or a retro-curation surface. Record both readings and the
      one the blocker picks — no behaviour change.
      Done: `CHANGELOG-conventions.md` § *Curated-head cadence* records the pick,
      the rejected branch with its reason, and what the pick concedes;
      `release-pr-gating.md`'s `highlight-plausibility` row states that prose
      polish is not gated and points at it.
- [x] **1.3 Pin the current advisory behaviour with a fixture.** Extend
      `tests/scripts/check_release_highlights.test.ts` so a placeholder head
      produces exit 0 plus the advisory line, making the decision a one-line diff
      either way.
      <!-- verify: task test -- --filter=check_release_highlights -->
      Done: `main` is exported (the house pattern — 306 scripts already do) and
      the fixture drives it over a temp changelog with an empty `HEAD..HEAD`
      span, so it needs no tag and behaves the same on a shallow CI checkout.
      Verified by mutation: adding `return 1` to the advisory branch reds the
      fixture, and reverting greens it.
- [-] **1.4 Flip the placeholder check to blocking for the final release head.**
      **Cancelled — the cadence blocker resolved to (b), no gate change**
      (AI-council 2/2, 2026-08-11, anthropic + openai, re-decided after being
      shown the counter-argument a first round never saw). The "empty by
      construction" argument is about *detection*, not about *blocking*: the
      marker is present by construction on every release carrying a substantiated
      category, so blocking it re-creates the guaranteed-first-run red that
      pre-filling was introduced to remove — the failure mode
      `check_release_highlights.ts:196-200` names in its own source. A marked
      line is a prose gap, not a contradiction. Recorded in
      `docs/contracts/CHANGELOG-conventions.md` § Curated-head cadence, including
      what the choice concedes (recurrence), and pinned by 1.3 so reversing it
      stays a one-line diff.

## Phase 2 — The carrier remainder, with its premise corrected

- [-] **2.1 Cancelled: re-planning the carrier fix.** Already
      [`road-to-carrier-layer-convergence.md`](road-to-carrier-layer-convergence.md)
      Phase 3 (`:152`), 2 open steps, blocked on `b-convergence-machine` (`:178`).
- [-] **2.2 Cancelled: making the 24-of-109 split visible in the report.** Shipped:
      `src/scripts/report_carrier_divergence.ts:320` prints the `paths:` subset as
      ACTIONABLE under the frontmatter-only count, and
      `tests/scripts/report_carrier_divergence.test.ts` pins `pathsScopeDiff`.
- [x] **2.3 Promote the corrected premise to a stable context.** It lives only in a
      roadmap (transient) and in
      `agents/evidence/analysis/carrier-layer-divergence-classification.md`. Per
      `no-roadmap-references`, promote the durable conclusion (109 prose-identical,
      24 actionable on `paths:`, over-delivery) into a context under
      `agents/settings/contexts/` — 70 exist, and contexts are that rule's
      sanctioned promote-target — and cite it from the report's header. Five reviews
      re-cited 109 because the correction had no stable surface.
      <!-- verify: ./scripts-run src/scripts/check_context_paths -->
      Done: `agents/settings/contexts/carrier-divergence-109-vs-24.md` carries
      the durable conclusion (109 prose-identical, 24 actionable on `paths:`,
      over-delivery direction, and what it explicitly does not decide);
      `report_carrier_divergence.ts` gained a *BEFORE QUOTING A COUNT* header
      block pointing at it. `check_context_paths` scanned 1275, zero violations.

## Phase 3 — Four flags over data that already exists

- [x] **3.1 `doctor --anatomy`.** Render the injection anatomy from
      `src/scripts/preamble_byte_census.ts` and
      `src/scripts/dispatch_economy_report.ts`; `doctor` is already registered
      (`src/cli/registry.ts:41`). No new measurement.
      <!-- verify: task test -- --filter=preamble_byte_census -->
      Done as a flag on `doctor`, composing both reports' existing
      `buildReport` / `renderText` — no new measurement and no threshold. A
      precondition surfaced while wiring it: `preamble_byte_census.ts` carried no
      `__AGENT_CONFIG_BUNDLE__` guard, and `cmd_doctor.ts` is a
      `build:cli-delegate` bundle entry, so importing it would have run the
      census and exited before the command's own `main`. Guard added, same shape
      as the one `dispatch_economy_report.ts` already had. An absent
      dispatch-economy half reports as unavailable with its reason, never as a
      zero. Fixtures in `tests/scripts/_cli/cmd_doctor_anatomy.test.ts`.
- [x] **3.2 `conformance:why <id>`.** A flag on the existing `explain`
      (`src/cli/registry.ts:58`) and `conformance:behavior`
      (`src/cli/registry.ts:44`) verbs — trace why one conformance id fired.
      <!-- verify: task test -- --filter=runtime_registry -->
      Landed as `--why <id>` on `conformance:behavior`, which owns the data:
      what the check detects, whether it fired, and every hit with its session,
      detail and (for `language-pin`) the absent-vs-ignored provenance split.
      An unknown id exits 2 naming the four known ids; a check that did not fire
      prints as a **measured zero**, never as silence.
      **Scope call, recorded rather than silently dropped:** it is NOT also a
      subject on `explain`. That command is a py-parity surface whose `usage:`
      line is byte-compared against a Python twin
      (`tests/scripts/_cli/cmd_explain*`), so a fifth `SUBJECT_CHOICES` entry
      either breaks the parity or drags the twin into a report-flag change. The
      registry synopsis and `_dispatch.bash` help both name the flag, so it is
      discoverable from the surface a reader actually greps.
- [x] **3.3 `recycle:verify` plus envelope mutation tests.** A flag on
      `session:recycle` (`src/cli/registry.ts:71`).
      `src/scripts/_lib/subagent_capsule.ts` already does the version check
      (`:495`), unknown-key rejection (`:489`) and a staleness guard (`:223`); the
      gap is a mutation suite proving each rejection fires.
      <!-- verify: task test -- --filter=_lib_subagent_capsule -->
      Done: `--verify` on `session:recycle` runs every rejection and stops
      before the write — deliberately the SAME code path, since validating
      through a second path would create the keep-in-sync artefact this tree
      refuses. `tests/scripts/recycle_envelope_mutations.test.ts` drives one
      mutation per rejection off a baseline the suite asserts is clean, so a
      green case cannot be green for an unrelated reason: wrong and missing
      `capsule_version`, wrong `variant`, an unknown key, unparseable and
      missing `written_at`, empty `acceptance_criteria`, non-object payloads,
      and the all-violations-at-once case.
- [x] **3.4 `surface prune` as a report flag.** Landed as
      `commands ls --candidates`, and the three design decisions the step
      refused to make silently are recorded here rather than in a commit body.
      **Host verb: `commands`** — the step's own named candidate, confirmed
      real (`registry.ts`, `native`, synopsis "List/explain the command
      surface"). Zero new registry verbs, so Risk 3 does not fire.
      **NOT named `--prune`, and that is the finding the step could not see:**
      `prune` is ALREADY a registered verb (`registry.ts`, `delegate`) meaning
      "remove orphaned bridge markers against `installed-tools.lock`". A
      `--prune` flag here would read as "delete commands" — the one thing this
      report must not do, since 3.5 hands the reduction targets to
      `road-to-surface-consolidation`, `road-to-solution-minimalism` and
      `road-to-tier-removal`. The report names all three and decides nothing.
      **Data source changed, with the reason:** the step pointed at
      `docs/SKILL_CENSUS.md` and `docs/artefact-census.md`. Both are DATED
      point-in-time snapshots — measured 2026-07-13 (237 skills) and
      2026-06-09 (227 skills / 150 commands) against a tree now at 289 / 196 —
      and `check_artefact_count_messaging.ts` excludes them **by design**
      ("carry point-in-time counts by design"). `SKILL_CENSUS` states outright
      that no usage evidence backs its Keep/Prune calls. Rendering either as
      current would ship exactly the unbacked claim this roadmap exists to
      remove, so the report reads the **discovery manifest** instead: every row
      traces to a manifest field (`replaces`, `visibility`, `intent`, `pack`)
      a reader can grep. Both snapshots are named in the output with the
      warning not to read their numbers as current.
      **`utilization_report` is named, not imported.** Its D1/REAP verdict is
      the designated usage-backed signal, but its entry guard is an argv
      comparison with no `__AGENT_CONFIG_BUNDLE__` guard, and this file reaches
      the CLI bundle via `main.ts` — the precondition 3.1 hit on
      `preamble_byte_census`. Half-importing it would have run its `main` at
      import time. The report states the evidence gap and its owner instead.
      **Measured on the real manifest:** 196 commands — 5 visible, 17 advanced,
      174 internal; **8 commands that absorbed prior names**; **166 of 196
      carry no `intent`**. Text mode caps the undocumented enumeration at 12 and
      **names the withheld count** ("… and 154 more"); `--json` is never capped.
      **Three defects were found in this step's own first draft and fixed
      before merge — two by probing the diff, one by the neutral review.**
      (a) A `visibility` value outside the three known labels was counted but
      never rendered, so the printed breakdown silently disagreed with the
      printed total; the record's key order was also first-seen, making
      `--json` unstable. (b) The `replaces` bucket was labelled **"deprecation
      shims — the one retirement class"**, which is the exact inverse of the
      field's contract: `command.schema.json` states "`replaces` is set on the
      NEW canonical command pointing back", and the retirement marker is
      `superseded_by`, "set on the OLD shim pointing forward". The first draft
      therefore named `git-commit`, `git-pr-create` and `fix-quality` — tier-0
      daily drivers — as the evidenced cut class, while
      `check_command_count_messaging` publishes the CI-enforced canonical
      figure **0 shims of 196** and `superseded_by` appears in no command file
      and is not emitted into the manifest at all. The bucket is now "absorbed
      prior names", carries an explicit NOT-a-retirement-class line, and the
      real shim class is reported as **not computable from this data** with the
      canonical figure cited. (c) `--candidates` silently discarded `--pack`,
      `--visible`, `--profile` and `--expanded` — a narrowed request printed a
      196-command report, and a typo'd `--profile` exited 0 where plain `ls`
      exits 1; all four are now refused with exit 1.
      30 assertions in `src/cli/commands/commands.candidates.test.ts`. Every
      expectation derives from its input rather than pinning emitted prose,
      with one deliberate exception: the absorbed-name membership is asserted by
      **naming** the expected slugs, because re-deriving the implementation's
      own predicate is what let the inversion pass a green suite.
      ORIGINAL TEXT: Over census data already computed
      in `docs/SKILL_CENSUS.md` and `docs/artefact-census.md`; a flag beats a 197th
      command against a 196-command surface.
      <!-- verify: ./scripts-run src/scripts/check_references -->
- [-] **3.5 Cancelled: the surface-reduction targets themselves.** Owned by
      `road-to-surface-consolidation.md` (92%, 1 open),
      `road-to-solution-minimalism.md` (10 open) and `road-to-tier-removal.md`
      (2 open), bounded by `agents/settings/contexts/surface-consolidation-restraint.md`.

## Phase 4 — Two real contract gaps

- [x] **4.1 Write the model-ceiling escalation contract.** Genuine gap: a
      case-insensitive `ceiling` grep returns 0 for both
      `docs/contracts/subagent-boundary.md` and `src/rules/delegation-policy.md`,
      so nothing states what a worker does when the ceiling cannot carry the task.
      Extend both: the worker **escalates, never silently degrades**.
      `subagents.model_ceiling` is class C, default `""`
      (`src/config/agent-settings.template.yml:795`,
      `docs/contracts/settings-classes.md:284`) — nothing is capped today.
      Done: `subagent-boundary.md` § *The model ceiling* carries the Iron Law
      (escalate, never silently degrade) plus four clauses — the worker returns
      the escalation, the orchestrator decides and never raises the ceiling
      itself (class C, `settings:set` refuses it by construction), absent is
      *uncapped* rather than a low cap, and the per-task-class/dollar caps stay
      cut. `delegation-policy.md` step 2 states the same obligation and routes
      there. Re-measured: the case-insensitive `ceiling` grep that returned 0
      for both files now returns 10 and 4.
- [x] **4.2 Add the funnel's missing Opportunity stage.**
      `src/scripts/report_conformance_funnel.ts` joins delivery to activation to
      compliance (`:128`), prints `NO DATA` honestly (`:187`, `:219`), and carries
      zero hits for `outcome` or `opportunity`. Derive Opportunity from the
      existing transcript store; keep it report-only, as its own header says.
      <!-- verify: task test -- --filter=report_conformance_funnel -->
      Done: an OPPORTUNITY block between DELIVERY and ACTIVATION, derived from
      the SK-2 scan's own `sessionsWithASkill` — no new classifier, so it cannot
      disagree with the COMPLIANCE stage that already prints the same field. It
      supplies the denominator ACTIVATION lacked: `skills.total` is a SUPPLY
      number that can only fall as the catalogue grows. Report-only and
      explicitly threshold-free, with the honest scope stated inline ("in
      context" means loaded, not needed, so it bounds activation from above and
      never calls a missed invocation a defect). Absent store prints NO DATA.
- [-] **4.3 Cancelled: per-task-class and dollar caps on the ceiling.** No
      over-spend observed and nothing is capped today (4.1), so a cap would be a
      mechanism without a matched failure mode.
- [-] **4.4 Cancelled: outcome-lift and rule A/B on golden tasks.** Collides with
      the terminal activation-red-baseline and thin-projection honest nulls;
      re-running them is relitigation without new evidence.

## Phase 5 — Records, and the asks that need no work

- [x] **5.1 Decide Continuation Protocol v1 as a record first.** Is one schema
      right, or are the variants correct? The capsule is already
      variant-discriminated at `CAPSULE_SCHEMA_VERSION = 3`
      (`src/scripts/_lib/subagent_capsule.ts:112`, 2 to 3 in #1255). A decision
      record, never a fourth format — the source file's own negative instruction.
      Done in `agents/settings/contexts/continuation-protocol-and-runtime-graph.md`
      § 1. The decision is **one schema, variant-discriminated** — the shipped
      code already answers it (`CAPSULE_SCHEMA_VERSION = 3` at `:112`, `variant`
      discriminator at `:114` validated at `:498`, both variants through one
      validator), so a v1 document describing a fourth shape would compete with
      it. Reopening condition stated and falsifiable: a consumer whose required
      fields CONTRADICT an existing variant rather than extending it.
- [x] **5.2 Record the runtime transition graph and loop detector as deferred,
      with a named revisit trigger.** The loop feared is already bounded: the
      turn-end gate refuses at most once per turn per key
      (`src/scripts/hooks/turn_end_gate_hook.ts:442-446`, "costs at most one extra
      refusal") and `session-eol` is `severity: advisory`, `fail_closed: false`,
      and cannot inject `/clear` (`src/scripts/hook_manifest.yaml:501-505`).
      Trigger: a transcript showing a real block, repair, recycle, same-block cycle.
      Done in the same context, § 2, with both bounds re-verified in the tree at
      the cited lines. Recorded as a mechanism without a matched failure mode —
      the same test that cut 4.3 — with the transcript as the falsifiable
      revisit trigger.
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
- **Status:** resolved
- **Owner:** maintainer
- **Resolution 2026-08-13 — (b), and the question was already half-answered when
  this blocker was written.** (b) had been picked, argued and shipped on
  2026-08-11 in `docs/contracts/CHANGELOG-conventions.md:48` ("*The cadence is
  retro-curation*"), on an AI-council 2/2 convergence, and step 1.4 is `[-]`
  cancelled citing exactly that. So `Resolved when` was half-met all along: 1.2
  had recorded the pick in the contract; only this `Status:` was never flipped.
  What the 2026-08-13 pass added is the number the concession was missing. Every
  release tagged since the decision shipped marked lines — **3 of 3, 7 lines
  total**: 10.1.0 two fields, 10.2.0 three, 10.3.0 two, against a curated 10.0.0.
  All three tags are published. The rate is now in the contract next to the
  "accepts recurrence" paragraph, together with two pre-registered falsifiers, so
  the next reader inherits a test rather than a habit. **(b) stands**: the rate
  shows curation is not happening, which is not the same as showing a hard block
  would be cheap — the marker is present by construction on every substantiated
  release, so blocking is a guaranteed first-run red regardless of diligence.
- **Blocks:** step 1.4 only. Steps 1.1-1.3 proceed either way.
- **What to do:** Pick exactly one — (a) hard-block the placeholder string in the
  final release head, or (b) rewrite the head comment in
  `docs/contracts/CHANGELOG-conventions.md` to document retro-curation as the real
  cadence. Mutually exclusive, and hard-block was already CUT to a maintainer
  decision at `archive/road-to-feedback-9-29.md:77`.
  **Evidence added 2026-08-12 — the placeholder stopped being hypothetical, twice
  in one day.** It shipped into the released `## [9.36.0]` head (PR #1297), and
  then again into `## [10.0.0]` (PR #1302) — that one in **two** fields,
  Behaviour changes and Honest nulls, plus the fill-before-merge comment. Four of
  five independent external reviews of the 9.30→9.35 span predicted exactly this,
  three of them making a hard block a P0. The 9.29 roadmap curated such a head by
  hand once; it has now recurred twice within hours of that curation being
  discussed. Manual curation not holding across releases is no longer an
  inference — it is two same-day observations. The standing counter-argument is
  unchanged and still in the gate's own source: a derived line "carries real
  evidence … only unpolished-if-unedited", and "a warning that reds the build is
  the guaranteed-red failure mode this whole change exists to remove"
  (`check_release_highlights.ts`). Both facts, one decision, still (a) or (b).
  Routed here rather than re-asked, per `road-to-feedback-9-35.md` Phase 4.1.
- **Resolved when:** (a) or (b) is named here and 1.2 records it in the contract.

### blocker: carrier-install-paths-decision
- **Status:** resolved
- **Owner:** maintainer
- **Resolution 2026-08-13 —
  [`ADR-228`](../../docs/decisions/ADR-228-global-install-does-not-emit-paths.md):
  the global install does not emit `paths:`; the 24 stay as accepted
  over-delivery.** The premise held on re-measurement (109 shared rules, 0
  byte-identical, 0 prose divergence, **24** `paths:` disagreements), but the
  ownership claim below did not: `ADR-226`, accepted the same day, declines this
  roadmap's named remedy (`--layer` suppression) for this repository, which left
  install-time emission as the only remaining lever rather than something already
  owned elsewhere. What decided it is the identity of the 24, not their count —
  at least six are safety or governance floors carrying an Iron Law
  (`lethal-trifecta-guard`, `low-impact-corpus-privacy-floor`,
  `source-confidentiality`, `ui-audit-gate`, `doc-screenshot-hygiene`,
  `image-likeness-and-rights`, and `roadmap-progress-sync` carries three), and
  `ADR-227` records that path-scoped rules are **not re-injected after
  `/compact`**. Scoping them globally would convert a safe over-delivery into a
  silent under-delivery exactly where silence costs most. The second half of
  `Resolved when` is discharged by the citation added to
  `road-to-carrier-layer-convergence` § Non-goals.
- **Blocks:** the fix for the 24 `paths:` disagreements, which lives in
  `road-to-carrier-layer-convergence.md` Phase 3. Nothing here is blocked — 2.3
  proceeds regardless.
- **What to do:** Decide whether `install.ts` should emit `paths:` — consumer-
  visible install behaviour and a default flip, so an ADR candidate and
  maintainer-only. That roadmap explicitly declines to decide it (`:35`).
- **Resolved when:** An ADR records the decision and that roadmap's Phase 3 cites it.

### blocker: adr-221-acceptance
- **Status:** resolved
- **Owner:** maintainer
- **Resolution 2026-08-13 — accepted.**
  [`ADR-221`](../../docs/decisions/ADR-221-host-native-first-ladder.md) is
  `status: accepted`, its § Status carries the acceptance and its reason, and
  `regenerate_index --dir docs/decisions` has re-rendered the row (a one-line
  diff; the generator defaults to `docs/adr`, which does not exist here, so the
  `--dir` is required and a bare run exits 2 without writing). What promoted it
  was not "already practised" — it was that `ADR-226` and `ADR-227`, both accepted
  the same day, argue in the ladder's exact terms while being unable to cite it.
  Acceptance obliges only what § Consequences names: a one-paragraph rung-1/2
  check before new own-runtime machinery, and a per-host retirement judgement on
  touch. No gate ships, because the ADR's own § Alternatives rejects one as
  satisfiable by assertion — that rejection is part of what is accepted.
- **Blocks:** nothing here. Named because four of the five reviews already treat
  host-native-first as settled doctrine while the record is not.
- **What to do:** Accept or reject
  `docs/decisions/ADR-221-host-native-first-ladder.md`, `status: proposed` at `:3`.
  No code either way — the cheapest survivor in the source file.
- **Resolved when:** `status` is `accepted` or `rejected` and the index is regenerated.
