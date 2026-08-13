## Acceptance criteria

- `npx tsx src/scripts/lint_roadmap_complexity.ts` exits 0.
- `npx tsx src/scripts/check_roadmap_trackable.ts` exits 0.
- `npx tsx src/scripts/check_gate_coverage.ts` reports
  `gate-self-test:registered-non-adopters` at 24 or below, with the baseline
  unchanged or lowered — never raised.
- `agent-config roadmap:progress-check` exits 0.
- The Phase 4 decision is recorded in a durable artefact, including the case
  where the decision is to change nothing.
