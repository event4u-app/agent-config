---
complexity: lightweight
parent_roadmap: road-to-inbox-harvest-2026-08-b.md
---

# Road to estate lifecycle reporting

> Answer the estate's two unanswered questions — which artefacts nothing has
> touched in six months, and which nothing points at — as two sections of reports
> the tree already generates, adding zero frontmatter fields and moving no cap.

> Source (consumed inbox): `agents/tmp.old/ac-hermes-harvest`,
> `agents/tmp.old/chief-of-staff.txt`, `agents/tmp.old/ac-truthful-introspection`,
> `agents/tmp.old/agent-config-fremon-harvest` — part of the 2026-08-10 batch
> triaged by [`road-to-inbox-harvest-2026-08-b.md`](road-to-inbox-harvest-2026-08-b.md).

## Context / What is verified

**This roadmap opens as a decision-revisit offer against a same-day lock, not as
fresh work.** The shrink mandate for the maintained estate is owned by
[`later/road-to-cost-parity-1-rule-payload-diet.md`](later/road-to-cost-parity-1-rule-payload-diet.md) —
`:8` "the maintained estate shrinks where nothing else owns it", `:10` "289 skills
and 116 rules must all stay true, **reviewed** and non-contradictory". It is
`status: later` (`:3`), parked `:17-30` "**2026-08-10 — AI-council convergence,
maintainer pick**", and its Context is headed `:52` "verified against the tree
2026-08-10, **do not relitigate**". Its Phase 5.1 already contemplates the
semantics this subject would need: `:286-289` "A pack marked `maintained: false`
is best-effort: **no review dates, excluded from estate caps**". Per
[`decision-revisit-gate`](../../src/rules/decision-revisit-gate.md), the offer is
surfaced (Phase 1), never planned around silently.

**A second lock the inbox never found, and it decides the flagship item outright.**
[`docs/governance.md`](../../docs/governance.md) § Skill lifecycle policy (`:44`)
already declares the states `active · dormant · sunset` (`:46`) and already chose
the mechanism: `:49-53` "**Dormancy is commit-based, not review-date-based.** A
solo maintainer does not hand-maintain `last_reviewed:` timestamps (busywork that
drifts). Dormancy signal = no commits touching a skill's files in 6 months
(`git log --since='6 months ago' -- src/skills/<name>/`). Derivable — so it is
*not* stored in the spine". `:54-55` "Dormancy triggers review, never
auto-deprecation." `:58-59` a `last_reviewed:` field is "**deferred until a second
maintainer** exists". So the sidecar-versus-frontmatter question the source asks is
already answered as **neither**: derive it, store nothing.

Re-derived estate: **116 rules** (`ls src/rules/*.md`), **289 skills**
(`ls -d src/skills/*/`). Two lifecycle vocabularies are live and disagree:
`lifecycle:` is `active|deprecated|experimental|archived`
(`build_discovery_manifest.ts:152`, `schemas/rule.schema.json:143`,
`command.schema.json:231`, `subagent.schema.json:80`, `skill.schema.json:254-263`
with `"default": "active"`), while skills also carry a separate `status:` enum
`active|deprecated|superseded` (`skill.schema.json:64-71`). Coverage is thin —
**15 of 289** skills declare `lifecycle:`, **66 of 289** declare `status:` — and
neither is a runtime lifecycle: both are static declarations, and nothing computes
dormancy.

Shipped precedents every step extends rather than replaces:
`src/scripts/janitor.ts:1-16` (TTL sweep, `:10` "NEVER auto-sweeps `agents/tmp/`" —
the archive-not-delete precedent); `src/config/recycle-threshold-budget.json:4-6`
(`registered_at`/`owner`/`review_by` — the review-metadata triple, already
sidecar-shaped); `src/scripts/hook_manifest.yaml:213,223` (`profile-staleness`,
`wrapper-freshness`, both `severity: advisory` + `fail_closed: false` — the
soft-warn shape); `src/scripts/discovery_graph.ts` (the artefact relation graph:
content-addressed to the manifest checksum, version-namespaced cache, atomic write,
`:10-14` typed relations, `:23-25` `build`/`affected`/`explain` with `--out`);
`build_discovery_manifest.ts:103` (`DEFAULT_ORPHAN_REPORT`) and `:915-920`
(`_deprecation_report`). Standing staleness gates: `sweep_dead_scan_roots.ts`,
`check_corpus_staleness.ts`, `lint_one_off_age.ts`, `check_reach_staleness.ts`.

Nothing below is gated on the revisit answer except a removal list: every report is
report-only by construction and moves no cap.

## Phase 1 — The revisit offer

- [x] **1.1 Surface the offer to the maintainer, and stop.** State the two locks
      above with their `file:line`, state that Phases 2-4 are report-only and need
      no reopening, and ask the one question the blocker names. Do not edit the
      parked roadmap, and do not reopen `governance.md:49-59` — the commit-based
      choice is the reason Phase 2 costs nothing.

      **Surfaced 2026-08-11; the answer is outstanding, which is why this stays
      open.** Put to the maintainer, unchanged, as the blocker words it:

      > `later/road-to-cost-parity-1-rule-payload-diet.md:3` is `status: later`,
      > parked `:17-30` on 2026-08-10 by council convergence + maintainer pick,
      > with `:52` "do not relitigate". `docs/governance.md` § Skill lifecycle
      > policy separately defers a `last_reviewed:` field "until a second
      > maintainer exists". **Does the maintained-estate framing reopen now, or
      > stay parked on its own resume conditions — and does the
      > second-maintainer condition still hold?**

      Neither lock was edited, and neither needed to be: Phases 2-4 shipped
      report-only, added no frontmatter field and moved no cap, so nothing below
      depends on the answer. What the answer unlocks is only what the blocker
      already scopes — a removal list, a cap change, or a new estate field.

      **ANSWERED 2026-08-13 — it reopens.** The maintainer picked reopen over
      stay-parked. `road-to-cost-parity-1-rule-payload-diet.md` has moved out of
      `later/` into the active tree and its `status: later` frontmatter is gone;
      the parking paragraph is superseded in place rather than deleted, because
      the reasoning it carries is still why the roadmap's *other* phases wait.
      The reopen is resume condition **(c)** — the maintainer authorising the
      consolidation pilot as a standalone tranche, which the council had already
      flagged as available ("the bundling is a choice, not a structural
      necessity"). Conditions (a) and (b) are **not** claimed and remain unmet:
      the utilization sweep is still time-gated to ~2026-08-26 and the live
      trigger eval has not run.

      **The second half of the question was not separately answered, and that is
      recorded rather than inferred.** The question put two things: does the
      framing reopen, and does the second-maintainer condition still hold. Only
      the first was answered. `docs/governance.md` § Skill lifecycle policy is
      untouched by this change, so its deferral of `last_reviewed:` "until a
      second maintainer exists" stands exactly as written — an unanswered
      sub-question leaves the existing state where it was, and reading a reopen
      of one lock as a release of a different one would be precisely the
      inference this step was written to avoid.

## Phase 2 — The dormancy signal governance already mandates

`governance.md:52` names the exact command and calls the signal derivable. Nothing
computes it, so an accepted policy has no instrument. This phase builds the
instrument, not a new policy.

- [x] **2.1 Add a dormancy section to the existing discovery report family.**
      Compute per-artefact last-touch from `git log -1 --format=%cI -- <path>` over
      `iter_artefacts` and emit a section listing everything past the 6-month bar,
      alongside `_deprecation_report` (`build_discovery_manifest.ts:915-920`) and
      `_orphan_artefacts` (`:999-1022`). Report-only: `governance.md:54-55` says
      dormancy triggers review, never auto-deprecation, and a gate would be wrong
      anyway — a finished artefact is indistinguishable from an abandoned one from
      commit dates, so the false-positive class is not empty and no argument makes
      it so.
      <!-- verify: task test -- --filter=build_discovery_manifest -->
- [x] **2.2 Publish the two-vocabulary finding and the coverage figures.** One
      paragraph in `docs/governance.md`: `lifecycle:` and skill `status:` are
      distinct fields with distinct enums, 15 of 289 and 66 of 289 declare them,
      and `lifecycle` defaults to `active` (`skill.schema.json:262`) so absent
      reads as active. Reconciling them is a separate decision; this only stops
      the two being read as one field.
- [x] **2.3 Record the sidecar-versus-frontmatter answer where the question is
      asked.** `governance.md:58-59` defers the field; add the reasoning in one
      line — a review-date field across 405 artefacts is the diff noise the parked
      roadmap's own Phase 3 drift-lint contends with, and the only shipped
      review-metadata triple (`recycle-threshold-budget.json:4-6`) is
      sidecar-shaped on a single config file. If the second-maintainer condition
      ever fires, sidecar is the precedent, not frontmatter.

## Phase 3 — Zero inbound references, on the graph that already exists

`_orphan_artefacts` (`build_discovery_manifest.ts:999-1022`) means "sole declared
member of its pack" — a typo detector, not a reachability one. A zero-inbound
report is an **inverse traversal of `discovery_graph.ts`**, whose edge set is
already deterministic and cached against the manifest checksum (`:143-154`). Not a
new engine.

- [x] **3.1 Add an inbound-degree query to `discovery_graph.ts`.** `Edge` (`:45-50`)
      already carries `from`/`to`/`rel`/`confidence`; invert it once and report
      nodes with zero inbound `EXTRACTED` edges, excluding `member_of` (`INFERRED`
      at `:124,129`, which would make every artefact look reachable via its pack
      node). Additive alongside `affected` (`:195`) and `explain` (`:221`).
      <!-- verify: task test -- --filter=discovery_graph -->
- [x] **3.2 Classify every first-run hit before anything is wired.** The relation
      set is narrow — `replaces`, `routes_to`, ADR path targets, `packs`,
      `workspaces` (`:10-14`) — so a prose-only cross-reference produces no edge and
      a reachable artefact reads as zero-inbound. Classify the hits, then decide
      whether the report is worth publishing at all. **Report, never a gate**:
      `check_references.ts` is the cross-reference gate and this traversal sees a
      strictly narrower graph, so the false-positive class is provably non-empty.
      <!-- verify: ./scripts-run src/scripts/check_references --format=text -->
- [x] **3.3 Point the report at review, not removal.** One line in the emitted
      section citing `governance.md:56-57` — sunset is explicit, recorded in the
      removing commit, no tombstone files — and `janitor.ts:10` as the
      archive-not-delete precedent.

## Phase 4 — The graph's own observability

- [x] **4.1 Add `stats` and per-source try-isolation to `discovery_graph.ts`.**
      `Graph` is exactly four fields (`:51-56`) with no `stats`, `buildGraph`
      (`:95`) runs one loop with no per-relation error containment, and the file has
      **zero** `reportScanned`/`assertScanned` calls. Add
      `stats: Record<string, number | "error">`, wrap each edge-extraction pass in
      its own `try` recording `"error"` for the pass that threw, and emit the count
      via `_lib/scan_scope.reportScanned`, whose contract (`scan_scope.ts:98-120`)
      is that "the emitted number is, by construction, the number the assertion
      just accepted". `schema_version` already exists (`:148`), so this is additive
      and **needs no ADR**.
      <!-- verify: task test -- --filter=discovery_graph -->
- [x] **4.2 Namespace non-artefact node ids.** `pack:` and `workspace:` are the only
      prefixes (`:123,128`); artefact nodes are bare paths (`idOf` at `:99`). A
      zero-inbound report over a mixed id space is ambiguous the first time a path
      collides with a synthetic node. One prefix constant, no format change.
      <!-- verify: task test -- --filter=discovery_graph -->

## What landed — and the two findings that changed the shape

Both report steps built their instrument and then **refused to publish a list**,
in each case because a measurement said the list would not mean what a reader
would take it to mean. Neither refusal was planned; both are recorded here
rather than smoothed over.

- **3.2 — the zero-inbound traversal is correct and its edge set is not.** First
  run: 595 of 759 nodes, i.e. **every** skill (289/289) and **every** rule
  (116/116). Cause, measured: all 119 `routes_to` / `replaces` targets are
  *logical names* (`commit:in-chunks`) while node ids are repo-relative paths —
  **0 of 119 resolve**, so no artefact ever carries an inbound EXTRACTED edge and
  the 595 is arithmetic. `references_adr: 0` is the same defect from the other
  side. `orphans` therefore names the degraded state and prints no list while
  `stats.dangling_targets > 0`; the guard clears itself the moment targets
  resolve. Evidence + the knock-on for the shipped `affected` / `explain`
  traversals: [`discovery-graph-inbound-degree.md`](../evidence/analysis/discovery-graph-inbound-degree.md).
  Fixing the resolution is a behaviour change to two shipped commands and is
  deliberately **not** made here.
- **2.1 — the dormancy window is longer than the available history.** This
  checkout is a shallow clone (`git rev-parse --is-shallow-repository` → `true`)
  whose oldest commit is 2026-05-18 — under three months against a six-month
  bar, and CI clones are shallow by default. A truncated history is
  indistinguishable from a dormant artefact, so the report names the missing
  signal instead of emitting a list; the populated path is unit-tested rather
  than left unexercised.

The shared shape: an empty or maximal list is a *claim*, and neither report is
allowed to make one it cannot support. Both follow the labelled-degraded-path
precedent this roadmap's own Context cites (`check_standing_rule_delivery.ts:15-27`).

## Cancelled — each against a named citation

- [-] **A `SELF.md` / generated self-knowledge doc family.** Closed in
      [`road-to-capability-answerability.md`](road-to-capability-answerability.md)
      (`status: ready` `:3`; **18 of 19** steps closed) plus
      [`capability-answerability`](../../docs/contracts/capability-answerability.md),
      whose `:24-30` table decides carry-vs-name per capability and whose `:40-44`
      sets an **empirical revisit bar** — "Flip a `name` to a `carry` when the same
      wrong guess is observed twice." A successor clears that bar first. The
      AUTO-block-in-a-hand-written-doc mechanism also ships exactly once already, as
      `src/scripts/generate_subagent_floor.ts`, which **derives** its content from
      `_lib/kernel_rules.ts` `:15` "so a second source of truth cannot appear" and is
      `:19` drift-gated.
- [-] **A truthful-reporting doctrine as new prose.** All four clauses are already
      enforced mechanisms: `check_claims.ts:7-15` (a marker must resolve to a
      `status: backed` ledger entry with a resolving evidence pointer);
      `_lib/scan_scope.ts:98-120`; `assertScanned`/`DeadScopeError` with the recorded
      14-gate incident in
      [`gates-that-cannot-fail`](../settings/contexts/gates-that-cannot-fail.md); and
      labelled degraded paths in `check_standing_rule_delivery.ts:15-27` ("always
      NAMES which input it used") and `lint_token_budget_discipline.ts:14-18` ("the
      gate says which"). `ADR-215:170-178` § D5 adopts "structural enforcement or
      deletion, not a **louder restatement**".
- [-] **A usage-count ship bar** ("fewer than two citing decisions per quarter →
      demote the generator"). `ADR-216:14-16` strikes adoption as a gate condition
      outright — "adoption is not a project goal and therefore not a valid gate".
- [-] **A per-skill hard-fail `requires:` field.** Already shipped as
      `requires_skills:` (`skill.schema.json:265-267`; 5 skills declare it) with
      `src/scripts/check_skill_requires.ts:1-13` as its gate — referential integrity
      plus cross-pack co-availability, `assertScanned`-guarded, exit 1 on violations.
      The source's estate claim about it was never counted and is not counted here.
- [-] **Per-skill `last_used` usage timestamps.** No `last_used` exists anywhere, but
      the utilization question is owned and blocked:
      [`road-to-surface-consolidation.md`](road-to-surface-consolidation.md)`:144-155`
      Phase 3 is the KEEP/MERGE/DEMOTE/REMOVE sweep, time-gated to ~2026-08-26, with
      `:313-315` blocking "utilization-driven MERGE/DEMOTE/HIDE/REMOVE of artefacts
      (needs loaded-vs-fired usage over the window)". A second instrument competes.
- [-] **Extending the `code-graph` engine instead.** Different subject, permanent
      lock: `ADR-124:221-229` published the honest null — recall **0.365 vs
      disciplined grep 0.797**, Δ **−43.2 pp** — and set `code_graph.enabled: false`
      permanently, deprecation at the next major. `discovery_graph.ts` is the
      **artefact** relation graph and is unaffected; do not conflate them.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-10 | reviewer: claude/host -->
| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The revisit offer is read as the lock being lifted | product | Two accepted decisions sit under this subject, one parked the same day by council convergence and one live in `governance.md`; a roadmap that opens by offering to revisit them is one step from a session treating the offer as the answer and adding estate metadata nobody approved | 1.1 is the only step in Phase 1 and it ends the turn; every other step is report-only and cites why it needs no reopening; the blocker names what is NOT blocked | Phase 1 — The revisit offer |
| 2 | A zero-inbound report is trusted as a removal list | product | The manifest's relation set is five typed edges and misses prose cross-references entirely, so a reachable artefact can read as unreferenced and get deleted on a report's word | 3.2 classifies every first-run hit before the report is published and states it is never a gate; 3.3 puts the sunset-is-explicit and archive-not-delete citations inside the emitted section | Phase 3 — Zero inbound references |
| 3 | Dormancy dates are read as abandonment | product | A finished, correct artefact and an abandoned one look identical from commit dates, and `governance.md` chose commit-based dormancy precisely as a review prompt | 2.1 emits report-only and quotes `governance.md:54-55` in the step; the false-positive class is stated as non-empty rather than argued away, so the step never becomes a gate | Phase 2 — The dormancy signal |
| 4 | The graph delta changes a cached artefact's shape | implementation | `discovery_graph.ts` is content-addressed with a version-namespaced cache; adding `stats` and an id prefix touches what consumers read | `schema_version` already exists at `:148` so the change is additive by the file's own contract; both 4.1 and 4.2 verify against the existing `discovery_graph` test | Phase 4 — The graph's own observability |

## Blockers

### blocker: estate-lifecycle-revisit-answer
- **Status:** resolved
- **Owner:** maintainer
- **Blocks:** any step that would act on a report — a removal list, a cap change, or
  a new estate metadata field. Phases 2, 3 and 4 are NOT blocked: every step there
  is report-only, adds no frontmatter field, and moves no cap.
- **What to do:** answer whether the maintained-estate framing in
  `later/road-to-cost-parity-1-rule-payload-diet.md` reopens now, or stays parked
  on its own resume conditions (`:24-30`). Separately: `governance.md:58-59` defers
  a `last_reviewed:` field until a second maintainer exists — confirm that
  condition still holds, since it is what makes Phase 2 derive rather than store.
- **Resolved when:** the answer is written into 1.1 with its date, and either the
  parked roadmap moves out of `later/` or 1.1 records that it stays. **Both
  discharged 2026-08-13:** the answer is at 1.1 with its date, and
  `road-to-cost-parity-1-rule-payload-diet.md` has moved out of `later/` into the
  active tree. The `governance.md` half of the "what to do" was NOT separately
  answered; that file is untouched, so its deferral stands as written — recorded
  at 1.1 rather than resolved by inference, since this blocker's own resolution
  clause asks for the reopen answer and the disposition of the parked file, and
  gets both.
