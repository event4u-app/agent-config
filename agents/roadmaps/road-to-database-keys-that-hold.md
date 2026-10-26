---
complexity: structural
status: ready
tree_pin: 700c41137b
execution:
  mode: phase-checkpoints
---
# Road to database keys that hold

> **Source:** `agents/tmp.old/inbox-2026-10-bc/` — one transcript and two
> competing roadmap proposals on database administration (indexes, keys,
> foreign keys, relations, cascades), both drafted against `c0a271cc0`.
> Re-verified against `700c41137b`; the probe results are in § Context.

## Goal

The database advice this package ships and the deterministic backstop that
checks it agree with each other and with the engine the project runs. When this
is finished: the command `schema-review` teaches runs as written; every shipped
database skill states the rule its own guideline states; `lint_persistence`
names the engine it judged against and counts what it could not judge;
Laravel migrations get the same migration-safety shapes raw SQL already gets,
at advice tier until spiked; and the parked database owners carry every finding
of this round that is theirs, with its arrival recorded.

## Context

The two proposals were 1,719 commits behind. Since then
`road-to-a-map-the-agent-checks-before-it-acts` (archived 2026-10-26) shipped a
replayed schema model per connection and a data lane with drift rules DR-1…DR-13.
Probes re-run at `700c41137b` (fixtures rebuilt from the proposal's P0–P3):

| Proposal claim | Now |
|---|---|
| D1/D4 gate assumes every FK is indexed | **overtaken** — `leadingIndexState` (`src/scripts/_lib/schema/replay.ts:266`) is engine-aware; P1 on pgsql yields F2 on `customer_id`, on mysql none |
| D2 guideline `foreignId()` sentence | **overtaken** — commit `9e163dbd91` |
| D5 schema map is add-only | **overtaken** — P1 yields F2 on `status` after `dropIndex` |
| D6 FK coverage independent of queries | **overtaken** — DR-6 `foreign key without a leading index` (`src/scripts/code_graph/drift_rules.ts`) |
| D15 redundant indexes | **overtaken** — DR-12 (`redundantIndexes`, `lanes/data/read_data.ts:201`) |
| D16/D17 parked siblings cannot wake; ERD branch off-origin | **overtaken** — ERD folded and archived; modeling park wakes on the map roadmap's archive |
| W4.1/4.5/4.7 set-null on NOT NULL, unconstrained `*_id`, cascade into hooks | **overtaken** — DR-7, DR-1/DR-13, DR-8/DR-9 |
| D3 S0.2 oracle has no engine dimension | still true — the fixture has no engine, so FK columns pass via the engine-unknown rule, silently |
| D7 Laravel migrations get no F6 | still true — P1's second migration yields 0 F6 |
| D8 raw-SQL lock hazards | still true for `DROP INDEX` without `CONCURRENTLY`; the other four shapes are `-evolution-tactics` 4.1's |
| D9 taught linter command fails | still true — `unknown argument: --` |
| D10 unconditional `subquery → JOIN` | still true — `src/skills/database/SKILL.md:56` |
| D11 migration template teaches the anti-pattern | still true — `laravel-migration/SKILL.md:82`, `:96-99` |
| D12 `sql-writing` hard-codes MySQL after detecting the engine | still true — `:58`, `:64` |
| D13 nobody owns constraint correctness in review | still true — `data-integrity.md:20-23` |
| D14/D18/D19 relations without constraints, shared-schema tenancy, trigger evals | still true — owned by `later/road-to-database-relational-modeling` |
| new | an unknown engine is silent: no engine in the report, no count of refs judged only by the assumption |

Every text edit here must be byte-neutral or shrinking: the skill bodies are
pinned to their current size (`src/config/skill-body-budget.json`).

## Phase 1 — Stop shipping falsehoods

- [x] **1.1 Repair the taught linter command.** Drop the `--` from the
      `lint_persistence` line in `src/skills/schema-review/SKILL.md`, and add a
      test that extracts that line's arguments and runs them against a fixture.
      verify: the new test fails against the old line and passes against the new one.
- [x] **1.2 Make the subquery rewrite conditional** in
      `src/skills/database/SKILL.md`, pointing at the guideline's subquery table.
      verify: `grep -c 'subquery → JOIN' src/skills/database/SKILL.md` -> 1
      verify: `test $(wc -c < src/skills/database/SKILL.md) -le 5941` -> 0
- [x] **1.3 Fix the migration template.** No index on the boolean; the foreign
      key via `foreignId()->constrained()` with an explicit action; the
      project-specific prefix and command block replaced by a pointer to the
      project's own conventions.
      verify: `laravel-migration/SKILL.md` contains neither `index('is_active')` nor `make:migration:customer` and stays within 8,597 bytes.
- [x] **1.4 De-lock the engine in `sql-writing`.** Validate and Output check the
      syntax against the engine step 3 read, not against MySQL.
      verify: `grep -c 'using MariaDB/MySQL syntax\|Confirm MariaDB/MySQL syntax' src/skills/sql-writing/SKILL.md` -> 1
      verify: `test $(wc -c < src/skills/sql-writing/SKILL.md) -le 3717` -> 0
- [x] **1.5 Give constraint correctness an owner.** `data-integrity` names keys,
      referential actions and cascade blast radius as its own.
      verify: the persona's Focus names constraint correctness and `backend-architect` stays unchanged.

## Phase 2 — The engine is an input the report states

- [x] **2.1 Report engines and the unverified count.** The index-parity result
      carries the engine per connection, and counts WHERE references whose only
      support is a foreign key on a connection whose engine the project does not
      state. `lint_persistence` prints both in text and JSON.
      verify: a fixture with no engine reports `engine_unverified: 1` for a FK-only column; the pgsql fixture reports `engine_unverified: 0` and the F2.
- [x] **2.2 Give the S0.2 oracle its engine dimension.** The fixture's comment
      says why its FK column counts as indexed, and a test pins the three
      outcomes — pgsql finding, mysql silence, unknown counted — on one schema.
      The spike record gets a dated note; its resolution figure is
      engine-independent and stands.
      verify: the engine-split test passes and the S0.2 row carries the dated note.

## Phase 3 — Migration safety where the Laravel migrations are

- [ ] **3.1 Laravel F6 at parity with raw SQL, advice tier.** A detector over
      the replayed DDL operations flags, on a table an earlier migration
      created: drop table or column (destructive), a NOT NULL column added
      without a default (data-dependent), `->change()` (rewrite), and an index
      added on pgsql (blocking). Same waiver as raw SQL (`migration-unsafe`).
      Renames and added foreign keys stay with `-evolution-tactics` 4.1.
      verify: P1's second migration yields three advice findings; a create-only migration yields none; a waived line is counted as waived.
- [ ] **3.2 `DROP INDEX` without `CONCURRENTLY` on postgres, advice tier**, in
      the raw-SQL adapter.
      verify: P2 yields one advice finding for `DROP INDEX`; a `DROP INDEX CONCURRENTLY` line yields none.

## Phase 4 — Hand the rest to its owners

- [ ] **4.1 Land the modeling findings on `-relational-modeling`.** Arrivals
      line; new steps for the relationship → constraint table, DB cascade
      bypassing model events, soft-delete uniqueness, test-engine parity and
      shared-schema tenancy; the `database` description's engine lock joins its
      step 2.1.
      verify: the roadmap carries an `Arrivals:` line and one step per finding.
- [ ] **4.2 Land the evolution findings on `-evolution-tactics`.** Arrivals
      line; 4.1 notes that the Laravel substrate now exists and that `SET NOT
      NULL` is a fourth candidate; a step to spike Phase 3's advice rules
      toward gate; the lock-timeout presence check as advice next to 4.4.
      verify: the roadmap carries an `Arrivals:` line and the four additions.

## Decisions

| ID | Class | Decided by | Decision | Evidence | Revisit if |
|---|---|---|---|---|---|
| DEC-1 | reversible-technical | agent | This roadmap is authored, executed and archived in one change, so the active estate does not grow above the five-roadmap cap. | `src/scripts/_lib/estate_wip.ts:7`; five active roadmaps at `700c41137b` | a step cannot close in this change |
| DEC-2 | reversible-technical | agent | Laravel F6 ships at advice tier: S0.3 measured raw SQL, not Blueprint parsing. | `docs/spikes/scale-history-spikes.md` | `-evolution-tactics` spikes the Laravel shapes |
| DEC-3 | reversible-technical | agent | Descriptions stay untouched here; a routing change without trigger evals is `-relational-modeling` 2.1/2.2's. | `src/scripts/trigger_eval_grandfather.json` | those steps land |

## Kill register

| # | Killed | Why |
|---|---|---|
| K1 | A new database skill | skill bodies and the catalogue are pinned; references and owners carry the content |
| K2 | Live-database connector, health report, backup checks | no live credentials in scope; probes stay SQL text a project runs itself |
| K3 | Shelling out to an external migration linter | dependency weight; the vocabulary is borrowed, not the binary |
| K4 | Doctrine adapter | no reader exists and no defect names it; a new stack is its own roadmap |
| K5 | Auto-applied index changes | recommend only |
| K6 | Default numeric thresholds (rows, indexes per table) | invented numbers; project-declared or stated as an assumption |
| K7 | Re-planning what DR-1…DR-13 already check | shipped 2026-10-26 in the data lane |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-26 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Laravel F6 false positives | implementation | Blueprint reading misses a create in an unusual shape and flags an op on a table the same change created | advice tier only; the replay's `uncertain` and `gap` ops are skipped; fixture triple | Phase 3 — Migration safety where the Laravel migrations are |
| 2 | Skill text grows past its pin | implementation | a correction adds bytes and reds the body budget | every edit measured against the pin before commit | Phase 1 — Stop shipping falsehoods |
| 3 | Findings land in a parked file nobody reads | product | the owners stay parked and the findings age | Arrivals counter on each owner; the modeling park's wake condition already holds | Phase 4 — Hand the rest to its owners |

## Acceptance Criteria

- [ ] AC-1 — The command `schema-review` teaches runs verbatim, and a test fails if it stops running.
- [ ] AC-2 — `database`, `laravel-migration` and `sql-writing` state the same index, foreign-key and engine rules as their guidelines, each at or below its pinned size.
- [ ] AC-3 — `lint_persistence` names the engine per connection and counts references judged only by the unknown-engine assumption.
- [ ] AC-4 — A Laravel migration that drops a column of an existing table produces an F6 advice finding.
- [ ] AC-5 — Every still-true finding of this round has a closed step here or an open step on `-relational-modeling` or `-evolution-tactics`.
