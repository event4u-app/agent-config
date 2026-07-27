# Scale & History Discipline — Phase 0 falsification spike verdicts

> Pre-registered in `agents/roadmaps/archive/road-to-scale-and-history-discipline.md`
> § Phase 0. Honest-null commitment: verdicts are published regardless of
> outcome; a FAIL permanently demotes the corresponding rule from CI-gate to
> advice-tier in the shipped default. Run date: 2026-07-27. Detectors live in
> `src/scripts/_lib/persistence/`; runners in `tests/spikes/persistence/`;
> fixtures in `tests/fixtures/persistence/` (designed a priori from the
> failure-class definitions, not tailored to the detectors).

## Verdict table

| Spike | Question | Pre-registered PASS | Result | Verdict |
|---|---|---|---|---|
| S0.1 `spike_n1_detect` | Is N+1 (query-in-loop over query result) pattern-detectable without flagging eager-loaded / bounded-small-loop look-alikes? | ≥9/10 TP, ≤1/10 FP | **10/10 TP, 0/10 FP** | **PASS** |
| S0.2 `spike_index_parity` | Can WHERE/ORDER BY columns be statically joined to migration/schema columns (Eloquent + Prisma)? | ≥80% resolution | **80.8%** (21/26 columns; expected-violation matrix exact: 6/6 Eloquent + 3/3 Prisma found, waivers honored, dynamic/raw refs correctly UNRESOLVED-never-findings) | **PASS** (narrow) |
| S0.3 `spike_migration_lint` | Raw-SQL migration linter: unsafe-op detection + parser robustness on real-world migrations | 15/15 fixtures, 0 safe FPs, 0 crashes on ≥50-file harvest | **15/15, 0 FPs, 163 harvested `migration.sql` files (one OSS document-signing platform, sparse clone), 0 crashes** | **PASS** |
| S0.4 `spike_audit_coverage` | Given a declared audit scope, are uncovered mutation sites detectable? | recall ≥0.9 at precision ≥0.8 | **recall 1.00, precision 1.00** (23 labeled sites: 11 uncovered found, 0 misses, 0 false alarms; mechanisms: trait incl. parent-class, registered + UNregistered observers, inline audit, `DB::table` bypass) | **PASS** |
| S0.5 `spike_offload_detect` | Offloadable-catalog detection (F9/F11), scope-aware, catalog as config | ≥9/10 TP, ≤1/10 FP per stack | **eloquent 10/10 TP · 0/10 FP; ts 10/10 TP · 0/10 FP** | **PASS** |

## Verdict → shipped rule tier

| Rule | Spike basis | Shipped default tier |
|---|---|---|
| R-A1 query-shape (F1) | S0.1 PASS | **gate** |
| R-A2 index-parity (F2) | S0.2 PASS (80.8% — narrow) | **gate**, with the pre-registered constraint honored: unresolved columns (dynamic args, raw SQL) are counted and reported, NEVER findings |
| R-A3 bounded-reads (F3) | not spike-gated (plain pattern presence) | **gate** |
| R-A4 reference-over-copy (F4) | not spiked — heuristic by design | **advice** (permanent, per roadmap architecture) |
| R-A6 migration-safety (F6) | S0.3 PASS | **gate**; CREATE INDEX w/o CONCURRENTLY downgrades to advice when the dialect is not detectably postgres |
| R-A7 growth-budget (F7) | S0.3 PASS | **gate** |
| R-A8 thin-request-path (F9) | S0.5 PASS | **gate** |
| R-A9 event-decoupling (F10) | not spiked — heuristic by design | **advice** (promotion requires a falsifiable detection proposal) |
| R-A10 durable-async (F11) | S0.5 PASS | **gate** |
| R-A11 commit-ordering | not spiked in Phase 0 — DELIBERATE, not an omission: the rule ships normatively in the pack rule; no detector exists yet, so no lint claims it | **advice** until the registered S0.6 spike passes. **S0.6 candidate mechanism (registered 2026-07-27, PR #1016 review):** `dispatch()` / `::dispatch()` of a job class that neither implements `ShouldDispatchAfterCommit` nor chains `->afterCommit()`, occurring inside a `DB::transaction(...)` closure span — statically detectable with the same brace-span machinery as S0.5. Same thresholds as the other spikes (≥9/10 TP, ≤1/10 FP); FAIL keeps R-A11 advice permanently |
| R-B1 audit-coverage (F8) | S0.4 PASS | **gate** (against a DECLARED audit scope only — no scope file, no findings) |

## Honesty notes

- "Deterministic" everywhere means deterministic **pattern detection with an
  auditable waiver process** (council round 2) — instance-level correctness
  stays contextual and waiver-mediated.
- S0.2's 80.8% is a NARROW pass over the fixture corpus — and a
  DETERMINISTIC one: S0.2 runs only on the committed fixture set (the
  real-world harvest belongs to S0.3 and only counts parser crashes), so
  the value is order/seed-independent and reproducible byte-for-byte; the Phase 2
  false-positive verification pass against a real-world codebase is the
  second, independent check before the gate tier is trusted.
- The S0.3 harvest corpus is not committed (third-party code); the spike is
  reproducible against any Prisma-style migration tree via
  `npx tsx tests/spikes/persistence/spike_migration_lint.ts --harvest <dir>`.
- One detector bug was found and fixed by fixture 06 of S0.3 (dialect
  detection read prose comments — the word "postgres" in a fixture header
  flipped the tier) and one by S0.5 (`{id}` inside a route string corrupted
  brace spans). Both fixes are in the detectors; no fixture was relabeled.
- Spend note: four of the five spike builders were interrupted by an org
  API spend limit mid-run; detectors/fixtures they had already written were
  completed and verified in-session. No verdict below is from an
  interrupted run — every number above comes from a fresh full run of the
  committed runner.
