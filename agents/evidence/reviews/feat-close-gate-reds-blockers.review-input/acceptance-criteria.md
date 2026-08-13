## Acceptance criteria

- `npx tsx src/scripts/lint_roadmap_complexity.ts` exits 0.
- `npx tsx src/scripts/check_roadmap_trackable.ts` exits 0.
- `npx tsx src/scripts/check_gate_coverage.ts` reports
  `gate-self-test:registered-non-adopters` at 24 or below, with the baseline
  unchanged or lowered — never raised.
- `agent-config roadmap:progress-check` exits 0.
  **UNMET at archival, and deliberately not forced — 2026-08-13.** It exits 1 on
  `road-to-inbox-harvest-distillation` (9/9 done · **1 deferred**), which is an
  Iron-Law-3 item belonging to a roadmap this one never touched. Verified
  pre-existing by re-running the check at this branch's base: it already failed
  there, on the same roadmap, plus a second finding (release-integrity
  completed-but-unarchived) that this work cleared. So the criterion moved from
  **2 findings to 1**, and the remainder is by rule the user's call — Iron Law 3
  requires the deferred item be surfaced and resolved by a human, never
  auto-archived. Writing a criterion whose satisfaction depends on an unrelated
  roadmap's human decision was the drafting error; the criterion should have been
  scoped to this roadmap's own contribution. Recorded rather than quietly
  dropped.
- The Phase 4 decision is recorded in a durable artefact, including the case
  where the decision is to change nothing.
- `npx tsx src/scripts/check_gate_coverage.ts` reports **no gate red that this
  roadmap opened** — specifically the `check_ci_local_parity` floor of
  § Two more reds is cleared or carries a recorded disposition. Added
  2026-08-13: without this criterion the roadmap could close green while
  leaving a red gate behind, which is the failure it exists to remove.
