<!-- evidence-type: analysis -->

# Council question — two record conflicts (road-to-records-that-match-their-code 2.1, 2.2)

Two pairs of records in this repository contradict each other. For each pair,
say which record is wrong today, what the minimal correction is, and whether that
correction is a record correction the council may make or a transition reserved
to the owner (it lowers a floor, changes governance, or reverses an owner
decision). Name the evidence each answer rests on. If the facts below are not
enough to decide, say what is missing.

## Item A — the active-roadmap cap

- `docs/decisions/ADR-287` D1: "There is no work-in-progress cap on the active
  roadmap estate. Not 12, not 8, not any number. The count of active roadmaps is
  not a budget and no gate may treat it as one." `superseded_by: —`.
- `agents/evidence/owner-directives/2026-10-24-throughput-over-ceremony.md`
  item 3, the owner's later directive: "At most five active roadmaps. A new inbox
  round creates no active roadmap … A new roadmap is pulled only when an active
  one completes."
- `src/scripts/_lib/estate_wip.ts:7` implements `WIP_CAP = 5`, and
  `check_estate_count` refuses an unrecorded exemption above it.
- ADR-287 does not cite the 2026-10-24 directive anywhere.

## Item B — the T3 tier and the project registry

- `docs/contracts/runtime-persistence-tiers.md`: "T3 IS NOT WRITTEN BY ANY CODE
  IN THIS REPOSITORY, AND OPENING IT IS AN ADR, NEVER A COMMIT." T3 is defined
  as "indefinite, aggregated, cross-repo"; the contract does not mention a
  project registry or ADR-299.
- `src/scripts/_lib/project_registry.ts` (ADR-299): "The one user-global list of
  projects this machine has worked in", file `runtime/projects/registry.json`
  under the user-global home, keyed per repository checkout, kept indefinitely.
- `agents/roadmaps/later/road-to-a-memory-the-consumer-owns.md` § Declined:
  "A global project registry keyed by remote, worktree and UUID — the council's
  2026-07-29 cut rejected any global project namespace on the enumeration
  argument."
- The T3 prohibition in the contract points at
  `docs/contracts/resident-process-governance.md` P3 (cross-session persistent
  state store: "PROHIBITED, unchanged").
