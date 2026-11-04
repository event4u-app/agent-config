---
complexity: lightweight
status: ready
tree_pin: 9ed90dbe85
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Operator-invoked `/analyze:inbox` with processing (2026-11-04) writes, executes and closes this roadmap in one PR, so the active estate is unchanged once it lands. Owner search at 9ed90dbe85 (grep -rliE 'rule_loading_tier|scorer epoch|final_diff|verifier-delete|benchmark coverage' over agents/roadmaps, later, stubs, archive) found no owner of these five defects; the paid rerun and the comparison study go to their owners (stubs/road-to-a-rerun-on-the-repaired-scorer, stubs/road-to-assurance-benchmark)."
relates:
  - slug: road-to-a-bench-that-fails-when-nothing-was-done
    relation: extends
    note: "Archived parent: shipped the 2026-10-28 oracle repair. This makes the published claims and future reports say which side of that repair they sit on."
  - slug: road-to-a-rerun-on-the-repaired-scorer
    relation: disjoint
    note: "Stub carrying the paid post-repair rerun this roadmap prepares (Phase 3 makes its runs re-scorable)."
---
# Road to benchmark claims that name their scorer

> **Source:** `agents/tmp.old/inbox-2026-11-bn/` — an owner chat and five
> proposed benchmark roadmaps, drafted against `07e4c192`, verified at
> `9ed90dbe85`. Only the offline, unowned findings land here.

## Goal

Every published benchmark number says which scorer produced it, the docs name
the rule profile that was actually measured, a future scorer repair can
re-score a run instead of discarding it, and the open question "what is still
unmeasured" has one dated answer. No step spends money.

## Evidence at the pin

- `docs/benchmark.md:25-31` — the 2026-10-28 validity note; pinned results
  "were scored before this repair and are not re-scored". Reproduced:
  `check_bench_task_validity` → every synthetic arm 0 passes, `nop` 1.0 on
  23/33, 33 references ok.
- `docs/CLAIMS.md` `discipline-lift-weak-host` and `essential-tier-cost-factor`
  are `status: backed` on those pre-repair reports and carry no scorer epoch.
- `src/scripts/compile_router.ts:276-282` — `balanced` (kernel + tier 1)
  was RETIRED 2026-07-07 after a NULL and maps to `essential`
  (kernel + `downstream-changes`). Yet `docs/getting-started.md:177` and
  `docs/contracts/cost-profile-defaults.md:31` still describe `balanced` as
  "kernel + tier-1 auto-rules", and `docs/benchmark.pinned.yml:24` labels the
  NULL arm "shipped `balanced` profile". A reader joins the two and concludes
  the default profile is the measured null — the owner chat did exactly that.
- Run records hold scores, metrics and an ephemeral `workspace` path, no
  final diff (pinned 2026-06-15 report and a fresh selftest report, read
  2026-11-04). Scorer repairs therefore cannot be replayed on old runs.
- `src/scripts/_lib/bench_task_validity.ts:29-30` — synthetic arms `nop`,
  `touch`, `verifier-exit`, `source-exit`, `noise-ask` plus three oracle
  mutations; no arm deletes a verifier file.

## Phase 1 — Names that match what was measured

Evidence (read): `src/agent-src/templates/scripts/work_engine/_lib/agent_settings.ts:1255`

- [x] **1.1 `balanced` described as what it loads.** <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/agent-settings.template.yml --> `docs/getting-started.md`,
      `docs/contracts/cost-profile-defaults.md`, the settings schema
      description (and the generated `docs/settings-reference.md`) and both
      settings templates say `balanced` resolves to the `essential` cut
      (kernel + `downstream-changes`) and that the size-cut kernel + tier-1
      variant was retired after a measured null. The ADR that introduced the
      cut stays as recorded.
      verify: `grep -rnE "balanced = kernel \+ (router \+ )?tier-1|default — kernel \+ tier-1|Kernel \+ tier-1 auto-rules \(workflow" docs src` -> /^$/
- [x] **1.2 The NULL arm is labelled retired.** <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/bench_ab_arms.ts --> The cost-factor arm label in
      `docs/benchmark.pinned.yml`, its rendered row and the curated finding in
      `docs/benchmark.md`, and the two bench-arm code comments read "retired
      size-cut `balanced`", never "shipped".
      verify: `grep -rnE "shipped .balanced. (router )?profile[)]|the shipped .balanced. profile is a null" docs src` -> /^$/

## Phase 2 — Claims that carry their scorer epoch

Evidence (read): `docs/benchmark.md:25-31`

- [x] **2.1 Epoch on the two pre-repair claims.** <!-- receipt: class=R2 · shadow · scope=safe · would-skip=revalidation · bound=raised to R2 from R0 --> Both entries gain
      `measured_on` naming the ab-v2 scorer before the 2026-10-28 repair, that
      they were not re-scored, and that per-run diffs were not retained.
      verify: `grep -A6 -E '^### claim: (discipline-lift-weak-host|essential-tier-cost-factor)' docs/CLAIMS.md | grep -c 'measured_on:.*2026-10-28'` -> /^2$/
- [x] **2.2 The ledger refuses an epoch-less benchmark claim.** <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/check_claims.ts --> `check_claims`
      reports a `backed` entry whose `evidence` points into `docs/benchmark.md`
      and whose `kind` is `quant` without a `measured_on` naming a scorer.
      verify: `npx vitest run tests/scripts/check_claims_scorer_epoch.test.ts` -> 0
      verify: `./scripts-run src/scripts/check_claims` -> 0

## Phase 3 — Runs a later scorer can re-score

Evidence (executed): `bench_ab_v2_run --mode selftest — record keys carry no diff`

- [x] **3.1 Final post-state in the record.** <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/bench_ab_scoring_v2.ts --> Every live and selftest ab-v2
      run record carries `final_files` — the post-state of each file the trial
      changed (`null` = deleted), so the pristine fixture plus this map rebuilds
      the clone — capped at 256 KiB with `final_files_truncated`. The
      recursive arm keeps its own output capture; it is a measured null and
      not re-run.
      verify: `npx vitest run tests/scripts/bench_ab_final_diff.test.ts` -> 0

## Phase 4 — One more adversarial control

Evidence (read): `src/scripts/_lib/bench_task_validity.ts:29-30`

- [x] **4.1 `verifier-delete` arm.** <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/bench_task_validity.ts --> Deleting every verifier file the task
      names must not pass a capability oracle.
      verify: `./scripts-run src/scripts/check_bench_task_validity --gate` -> 0

## Phase 5 — What is still unmeasured

Evidence (read): `docs/benchmark.md:994`

- [x] **5.1 Dated coverage table.** <!-- receipt: class=R2 · shadow · scope=safe · would-skip=revalidation · bound=raised to R2 from R0 --> The source's sixteen capability families
      each get one row: owning roadmap, newest measurement, status from
      `measured-live | pilot | built-not-run | not-measured`.
      verify: `grep -cE '^\| M[0-9]{2} ' agents/evidence/analysis/benchmark-coverage-2026-11-04.md` -> /^16$/

## Acceptance

1. No doc names the retired size-cut as the shipped `balanced` profile.
2. A pre-repair benchmark claim cannot be `backed` without its scorer epoch.
3. A run recorded after this lands can be re-scored offline.

## Non-goals

- No paid run, no rerun of the pinned headlines (stub
  `road-to-a-rerun-on-the-repaired-scorer`), no comparison study against
  vanilla, short instruction files or neighbours (stub
  `road-to-assurance-benchmark`).
- No change to which gate decides (stub
  `road-to-bench-gate-capability-non-inferiority`).

## Risk Register

<!-- risk-review: v1 | reviewed: 2026-11-04 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Run records grow too large | implementation | A trial that rewrites many files inflates every report | `final_files` stops at 256 KiB and sets `final_files_truncated` | Phase 3 — Runs a later scorer can re-score |
| 2 | The epoch rule flags claims outside ab-v2 | implementation | A future quant claim citing the page for another study must name a scorer it never used | Scoped to `backed` + `quant` + evidence into `docs/benchmark.md`; the ledger was green at landing | Phase 2 — Claims that carry their scorer epoch |
| 3 | The coverage table is read as a result | product | An owner index looks like a scorecard | Its header says it is an index of owners and readings, not a measurement | Phase 5 — What is still unmeasured |

## Decisions

| ID | Decision | Revisit-if |
|---|---|---|
| D1 | Historical numbers keep their values and gain an epoch; nothing is relabelled as post-repair | the pinned runs' diffs turn up and can be replayed |
| D2 | Coverage is a dated evidence file, not a generated public page | a second refresh is needed — then generate it |
