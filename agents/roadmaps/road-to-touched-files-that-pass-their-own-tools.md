---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "lane of road-to-leading-every-row; the set's growth is declared there. No active, parked or stub roadmap plans a post-edit quality pass at stop (grep across agents/roadmaps for formatter|typecheck at stop returns only unrelated archive mentions), and it adds no hook concern."
relates:
  - slug: road-to-leading-every-row
    relation: depends
    note: "the programme; this lane owns its post-edit hygiene row"
  - slug: road-to-a-stop-that-holds
    relation: disjoint
    note: "its verification_runs field on the same record landed; this lane adds a sibling field and never feeds verification"
depends: [road-to-leading-every-row]
---
# Road to touched files that pass their own tools

> **Source:** `agents/tmp.old/inbox-2026-10-b/` — a code-level comparison against a
> curated host-config collection whose stop-time formatter-and-typecheck batch supplied
> the shape; every anchor re-read at `9bc8cd4`. Class: external comparison corpus.

## Goal

A turn that edited files ends with those files having been run, in shadow, through the
quality commands the project's own toolchain resolver already lists — by the stop concern
that already watches the turn, never by a new concern and never as a verification. At
`9bc8cd4`: `grep -c 'format\|prettier\|typecheck' src/scripts/hook_manifest.yaml` → 0;
`verify-before-complete` "never blocks" (`src/scripts/before_complete_hook.ts:25`, exit
always 0 at `:52`) and records verification runs only (`verification_runs[]`, `:180`);
`resolve_toolchain` (`src/agent-src/templates/scripts/work_engine/stack/runner.ts:208`)
already computes a `quality` list per stack (`:142`; PHP `:425-435`, JS/TS `:437-453`) and
nothing at stop calls it; the touched paths already exist as `files_touched_this_turn`
(`src/scripts/minimal_safe_diff_hook.ts:24,236-251`). Done: in shadow, the resolver's
quality commands run against the touched files, their result is a field on the existing
record, one release of readings decides whether it warns, and a quality run never counts
as verification.

## Phase 1 — Run it, record it, refuse nothing

- [ ] **1.1 A pure `touched_file_quality` module over the resolver's real list.** The
      list at `9bc8cd4` is `npx tsc --noEmit`, `npx eslint .`, `vendor/bin/phpstan analyse`,
      `vendor/bin/pint`, `ruff check`, `mypy .`, `go vet`, `cargo clippy` — no formatter.
      Rules: a command is run only if the resolver lists it; a command that writes files
      (`vendor/bin/pint` without `--test`) runs only in its check form or is recorded
      `skipped: mutating`; a command with no file-scoped form is recorded
      `skipped: unscoped` (the resolver carries no cost field, so nothing is guessed
      cheap); ENOENT / exit 127 is `skipped: absent`. Output per command: command, exit
      code, first 20 output lines. `corrected-from-reproduction` — the supplied list
      named formatters and a "cheap" flag the resolver does not have.
      verify: `npx vitest run tests/scripts/touched_file_quality.test.ts` -> 0
- [ ] **1.2 The stop concern calls it, off by default.** `verify-before-complete` gains
      `touched_file_quality: off | shadow | warn` (template default `off`); in `shadow` it
      writes `quality_runs[]` to the record at `agents/state/verify-before-complete/<sha>.json`
      (`before_complete_hook.ts:32`), defaulted in `_empty_state` (`:157-184`). Exit stays
      0 on every path.
      verify: fixture — `shadow` with one failing check writes `quality_runs[0].exit=1` and the hook exits 0
- [ ] **1.3 A quality run is not a verification.** `quality_runs` is a field the
      classifier (`src/scripts/_lib/verification_command.ts`) never reads; a negative
      fixture pins that `npx tsc --noEmit` recorded by this module does not set
      `verified_this_turn`.
      verify: `npx vitest run tests/scripts -t 'quality run is not verification'` -> 0
- [ ] **1.4 A latency reading under `shadow`.** The per-concern bench already measures
      `verify-before-complete` at default; add the `shadow` variant over a five-file
      TypeScript fixture and record its p95 before any default moves.
      verify: the bench output carries a `verify-before-complete` shadow row with a p95 in ms

## Phase 2 — Decide from the readings

- [ ] **2.1 One release of shadow readings, published.** Stops with edits, stops with at
      least one `quality_runs` entry, stops with a non-zero tool verdict, median wall time;
      `skipped:*` entries are counted separately and never as verdicts.
      verify: `grep -c 'median' agents/evidence/analysis/touched-file-quality-readings-2026-Q4.md` -> /[1-9]/
- [ ] **2.2 `warn` emits one advisory line naming the command and the file**, capped at
      200 bytes, never a block.
      verify: fixture — `warn` with a failing typecheck yields exactly one line ≤ 200 bytes and exit 0
- [~] **2.3 Default `shadow` → `warn`.** Deferred: a shipped-default flip is an owner
      decision (`agents/roadmaps/stubs/road-to-discipline-default-flip.md:11-12`) and needs
      2.1's reading first.

## Acceptance criteria

- With `touched_file_quality: off`, the record and the exit code are byte-identical to the base ref (fixture).
- In `shadow`, a stop after a TypeScript edit writes `quality_runs[]` with the resolver's commands and exit 0.
- No mutating command is ever executed in its writing form (fixture with `pint` present).
- A recorded quality run never sets `verified_this_turn`.
- No new hook concern is added; the stop event's concern count is unchanged.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | reversible-technical | agent | extend `verify-before-complete`, add no concern | `hook_manifest.yaml:1434` stop binds 15; `lint_hook_concern_budget.ts:35` default 8 per event | the record outgrows one hook |
| D2 | reversible-technical | agent | only the resolver's commands, check form only | `runner.ts:425-453` is the list; a second list is a second authority | a stack's resolver emits nothing scoped |
| D4 | deterministic | agent | closure pass C1–C2 (2.1 and 2.2 verifies listed unfalsifiable): accepted — 2.1's oracle is the evidence page, 2.2's is the fixture the step writes, whose assertion (one line ≤ 200 bytes, exit 0) is stated | `closure_scan` 2026-10-01; listing family, never a gate | a flip lands without the fixture |
| D3 | contested-technical | evidence | shadow → warn only, never a block | `before_complete_hook.ts:25,52` — the hook's own contract | the stop gate asks for the field as a detector input |

## Risk Register

<!-- risk-review: v1 | reviewed: 2026-10-01 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A project-wide typecheck at every stop makes stop the slowest hook | implementation | `tsc --noEmit` has no per-file form. | Unscoped commands are `skipped: unscoped` by default; 1.4 records p95 before any default moves. | Phase 1 — Run it, record it, refuse nothing |
| 2 | A quality exit code is read as verified | implementation | `eslint` exits 0 on clean files; if that reached verification, completion truth regresses. | 1.3 pins a negative fixture; the classifier is the only reader of verification. | Phase 1 — Run it, record it, refuse nothing |
| 3 | The module mutates the consumer's files | implementation | `vendor/bin/pint` without `--test` rewrites code. | 1.1 runs only check forms and records `skipped: mutating` otherwise; a fixture with `pint` present proves no file changed. | Phase 1 — Run it, record it, refuse nothing |
| 4 | Touched paths from parallel sessions mix | implementation | `agents/state/minimal-safe-diff.json` is one file per project, not per session. | The module filters to paths changed in the working tree at stop time and records which source it used; a cross-session leak is a fixture. | Phase 2 — Decide from the readings |
| 5 | A missing tool reads as a false red | product | Detection is by manifest, not presence. | ENOENT / 127 is `skipped: absent`, counted apart from verdicts in 2.1. | Phase 2 — Decide from the readings |
