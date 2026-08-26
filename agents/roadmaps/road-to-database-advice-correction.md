---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: >
  One of four siblings split from a single inbox drop that carried 24 verified
  defect claims. Rule 11 (one task per file) forbids folding them together and
  rule 1 caps a structural roadmap at 1000 lines, so the split is the template's
  own requirement rather than estate growth by preference. Nothing in the
  current estate covers database advice quality, so there is no sibling to
  archive against.
estate_growth_exempt: >
  Phase 2 rests on a maintainer decision that breaks a shipped Do-NOT line, and
  Phase 1 surfaced an unresolved contradiction inside the same guideline
  section. Both are recorded as blockers discovered during verification, not
  invented scope.
---
# Road to database advice correction

> **Source:** `agents/tmp.old/database-structure/` — four database roadmap
> proposals from two parallel external LLM sessions plus two competing
> consolidations, dropped 2026-08-26 and analysed the same day. Every claim
> below was re-verified against HEAD `1899f92b9` with `file:line`; the
> drafting base `e6fdfd49d` is one commit behind it, so no claim is stale.

## Goal

The database advice this package **ships** no longer states folklore as
absolute rule. A reader following `docs/guidelines/php/database.md` is told
what actually decides an index's column order, when a full scan is the correct
plan, and when a subquery should stay a subquery. The reversibility rule stops
contradicting itself between skill and guideline. MySQL and MariaDB stop being
one syntax world by default. When this is finished, every one of the four
corrected passages answers an adversarial fixture where the folklore answer is
wrong.

## Context

This is the cheapest and most urgent of the four siblings, and it is first for
one reason: it does not add capability, it stops shipping wrong advice.
`docs/guidelines/php/database.md` is listed in `package.json:files[]`, so it
reaches every consumer install — `check_references.ts:74` states exactly that
("`docs/guidelines/` is shipped to a consumer and is the only half that reaches
anyone"). `src/skills/database/SKILL.md:107` and `src/skills/eloquent/SKILL.md:69`
both defer their indexing, transaction and migration depth to it.

Siblings, sharing the `road-to-database-` prefix: `-erd-landing` (land an
already-built capability), `-relational-modeling` (the modeling capability and
its ownership question), `-evolution-tactics` (online DDL, blue/green, porting).

## Provenance

- **Source A** — an external LLM ideation thread, four analysis loops, produced
  two of the four input proposals.
  `ENC1:n37Vvuk8AEZHmidSo1ARDeBqPO5FWZiPEx4xsRnKXAH77thamSR51BjdOweQ5TUIlnggpcFFOzga3s9St4+ubTH+2oYCB0dGDeGsbH8THloswnlYqqkRxFTPpieCd7bkBRr2PPGj2e3ngmPKlrpiaKpm1gm0GC3RxXY=`
- **Source B** — a second external LLM ideation thread, six analysis loops over
  the same brief plus a harvest of ten external skill collections, produced the
  other two proposals and one of the consolidations.
  `ENC1:uwPcFwnylOcQB/u2WBmmK0YEXNGjYZuvh7DYzxJqJfQzfZDKOB0PxAHIYJ9EsrcG6wktnGWGlo0QBHBLCaHWOOPvdC1WC2eOY8FPM7LNO6r7nVD9kNcFK50kJAfO443D1QCLn2t89J0LOjVYwgjP8ZXmMX8Gv7tR0o33`
- The findings this roadmap acts on are the ones Source B verified against the
  tree and an independent pass re-verified here. The harvested external
  collections contributed nothing to this file: every corrected passage is a
  defect in our own text.

### Council convergence

AI council, 2026-08-26, members `anthropic/claude-sonnet-4-5` and
`openai/codex-default`, 3 rounds, blind chairman. Relevant to this file: both
seats put "correct the shipped PHP database guidance" third in a minimum safe
order, **before** any ownership or capability work, and neither made it
conditional on anything else in the campaign. `codex-default` stated the
dependency explicitly: routing and ownership questions block narrowing
`database`; correcting shipped guidance blocks nothing.

## Gap table

| Proposed item | Verified state | Disposition |
|---|---|---|
| Composite-index rule is stated as "most selective column first" | `docs/guidelines/php/database.md:25`, unconditional, under `### Composite indexes` | **KEEP** |
| `type=ALL` classified as "needs index" | `:37`, in a table whose column heading is "Bad value" | **KEEP** |
| Subquery in WHERE → "Rewrite as JOIN" | `:52`, `### Anti-patterns`, column "Fix", unqualified | **KEEP** |
| "Small tables (< 1000 rows)" under "When NOT to add indexes" | `:20` — and `:15` already says to index foreign-key columns | **KEEP, reframed** — the defect is an unresolved contradiction `:15` ↔ `:20`, not an omission. Unique indexes appear nowhere in the section. |
| `down()` required as dogma | `laravel-migration/SKILL.md:39` "Always include", `:158` "Do NOT forget", against `database.md:74` "when possible" | **KEEP** — the tree already contradicts itself, which is what makes the change cheap |
| MySQL/MariaDB treated as one syntax world | Conflation confirmed (`database:4`, `sql-writing:4,58,64`) | **KEEP, corrected** — *two* differentiating lines already exist (`database:118`, `sql-writing:69`), not one. Promote them, do not author a third. |
| Cascade hardcoded without a decision | `laravel-migration/SKILL.md:76` `->onDelete('cascade')` in the canonical template | **KEEP** — and a second site: `database.md:71` "proper `onDelete()`" presumes a decision it never states |
| Enum three-way decision missing from the DB surface | 0 hits across all DB-family skills | **FOLD** into `-relational-modeling` Phase 4 — `src/rules/prefer-enums-over-literals.md:49` already names all three options and is the anchor to extend |
| "Expand/contract rules already exist in the linter" | `adapter_raw_sql.ts:6-12` encodes R-A6(a)–(d) **migration-safety** rules; the string "expand-contract" does not appear in the file | **CUT** from this file — the claim mislabels what is there; the real work is in `-evolution-tactics` |
| A canonical Authority Map document | `dist/agent-src/` carries no `docs/`, so a `docs/contracts/` page is unreachable by any agent in a consumer install | **CUT** from this file — moved to `-relational-modeling`, where the council routed it to generated routing metadata instead |

## Phase 1 — The four folklore passages in the shipped guideline

- [ ] **1.1 Replace the composite-index rule with the ordering that actually decides it.**
      `docs/guidelines/php/database.md:25` reads "Order matters — most selective
      column first". Equality-predicate columns come before range-predicate
      columns, then columns the query orders by; selectivity is a secondary
      factor within those groups, not the primary key of the decision. Rewrite
      the line and its `$table->index(['customer_id', 'created_at'])` example so
      the example demonstrates the rule rather than coinciding with it.
      verify: `grep -n "most selective column first" docs/guidelines/php/database.md`
      returns nothing, and the replacement line names equality-before-range.

- [ ] **1.2 Stop classifying `type=ALL` as a defect.**
      `:37` sits in a table headed "Bad value" and reads "Full table scan —
      needs index". A full scan is the correct plan on a small table or a
      high-hit-rate predicate. Reword to state the question the reader must
      answer — is a full scan optimal here — and move it out of a column that
      pre-answers it.
      verify: `grep -n "needs index" docs/guidelines/php/database.md` returns
      nothing on the `type`/`ALL` row, and the row states a condition.

- [ ] **1.3 Make the subquery rewrite conditional.**
      `:52` reads "Subquery in WHERE | Rewrite as JOIN" as an unconditional fix
      in an anti-patterns table. Name the cases where the rewrite helps
      (correlated subquery re-executed per row) and where it does not (a
      semi-join the planner already flattens, or a subquery that bounds the
      driving set).
      verify: the row no longer appears in `### Anti-patterns` as an
      unconditional fix; `grep -c "Rewrite as JOIN" docs/guidelines/php/database.md`
      is 0 or the surviving occurrence carries a condition.

- [ ] **1.4 Resolve the small-table contradiction the register missed.**
      `:15` says to index foreign-key columns; `:20` says not to index small
      tables. Both are absolute and they collide on a small child table. State
      the resolution — uniqueness and foreign-key constraints are indexed
      regardless of row count, because they exist for integrity and lookup
      latency, not for scan avoidance — and add the unique-index case, which the
      whole indexing section currently omits.
      verify: `sed -n '10,25p' docs/guidelines/php/database.md` shows the
      exception stated at `:20`, and `grep -c "unique" docs/guidelines/php/database.md`
      is greater than 0 inside the indexing section.

- [ ] **1.5 Add adversarial fixtures where the folklore answer is wrong.**
      One fixture per corrected passage: a range-predicate column that must not
      lead the composite index, a small table where the full scan is the
      cheapest plan, a subquery that must stay a subquery, a 40-row lookup
      table whose foreign key must still be indexed. Each fixture states the
      correct answer and the folklore answer it must not give.
      verify: the fixture file exists, carries four cases, and each case names
      both answers.

## Phase 2 — Reversibility: one contract, two surfaces

- [ ] **2.1 State the recovery contract in one place.**
      Replace the split between `laravel-migration/SKILL.md:39,158` ("Always
      include a reversible `down()`" / "Do NOT forget") and
      `database.md:74` ("Make reversible when possible") with a single
      obligation: every migration declares either a `down()` that restores the
      prior state, or a named roll-forward plan for the cases where it cannot —
      a completed backfill, a destructive drop whose data is gone. Silence is
      the violation, not the absence of `down()`.
      verify: `grep -n "Always include a reversible" src/skills/laravel-migration/SKILL.md`
      returns nothing, and both surfaces state the same two-branch obligation.
      **Gated on `blocker: recovery-contract-breaks-a-shipped-do-not`.**

- [ ] **2.2 Update the fixtures that assert the old dogma.**
      Any fixture or eval asserting `down()` presence as the pass condition
      asserts the recovery contract instead.
      verify: `grep -rn "down()" tests/ | grep -i "requir\|always"` returns
      nothing that asserts unconditional presence.

## Phase 3 — MySQL is not MariaDB, as a discipline rather than a footnote

- [ ] **3.1 Promote the two divergence lines that already exist.**
      `src/skills/database/SKILL.md:118` ("`EXPLAIN` output varies between
      MariaDB and MySQL") and `src/skills/sql-writing/SKILL.md:69` ("MariaDB and
      MySQL have subtle syntax differences") are true and buried. Promote them
      into one stated principle in both skills: the two share a syntax world for
      writing queries and never share one for migration behaviour, online-DDL
      semantics, or feature availability. Do not author a third line — extend
      these.
      verify: both skills state the principle above their gotcha lists, and the
      two original lines are still present or subsumed verbatim.

- [ ] **3.2 Resolve the dialect contradiction between the skill and its own corpus.**
      `src/skills/sql-writing/SKILL.md:33` says "Use MariaDB syntax — Not
      PostgreSQL or MSSQL" while the grounding corpus it points at
      (`src/skills/database/SKILL.md:23-24`) is declared "(PostgreSQL 16 / MySQL
      8-derived)" and its rows carry PostgreSQL vocabulary (`Seq Scan`,
      `EXPLAIN (ANALYZE)`, `gin_trgm_ops`). Replace the default with a detection
      step: read the engine from the project, and where it is unknown say so
      rather than assuming one.
      verify: `grep -n "Use MariaDB syntax" src/skills/sql-writing/SKILL.md`
      returns nothing, and the replacement step reads the engine before choosing
      syntax.

## Phase 4 — Cascade as a decision, at both sites

- [ ] **4.1 Replace the hardcoded cascade in the canonical template.**
      `src/skills/laravel-migration/SKILL.md:76` writes
      `->onDelete('cascade')` into the template a reader copies. Replace it with
      the decision and a pointer: expendable children cascade, self-valued
      children restrict, surviving children null out — and the referential
      action is chosen, never inherited from a template.
      verify: `grep -n "onDelete('cascade')" src/skills/laravel-migration/SKILL.md`
      returns nothing, or the surviving occurrence is inside a labelled example
      of one branch of the decision.

- [ ] **4.2 Fix the second site.**
      `docs/guidelines/php/database.md:71` says "Add foreign keys with
      `constrained()` + proper `onDelete()`" — "proper" presumes a decision the
      guideline never states. Point it at the same decision as 4.1.
      verify: `grep -n "proper \`onDelete()\`" docs/guidelines/php/database.md`
      returns nothing.

## Blockers

### blocker: recovery-contract-breaks-a-shipped-do-not
- **Status:** open
- **Owner:** maintainer
- **Blocks:** Phase 2 only. Phases 1, 3 and 4 ship without it.
- **What to do:** step 2.1 deletes a shipped `Do NOT` line
  (`src/skills/laravel-migration/SKILL.md:158` "Do NOT forget to make migrations
  reversible") and weakens `:39` from "Always" to a two-branch contract. A
  consumer who has read the old line will act on the new one, so this is a
  maintainer call rather than an authoring one. The argument for it is that the
  tree already contradicts itself — `docs/guidelines/php/database.md:74` has
  said "when possible" the whole time — so the change picks one of two positions
  the package already ships rather than inventing a third. Decide one of:
  (a) adopt the recovery contract as written in 2.1;
  (b) resolve the contradiction the other way, hardening the guideline to
  "Always" and accepting that genuinely irreversible migrations have no
  compliant path;
  (c) leave both lines and record the contradiction as accepted, in which case
  Phase 2 is cut and this roadmap closes with three phases.
- **Resolved when:** one of (a), (b) or (c) above is chosen and recorded in `## Notes`; if (c), Phase 2 is marked `[-]` carrying that reason.
- **Recommendation:** (a) — adopt the recovery contract. The tree already ships both positions, so (a) picks one instead of inventing a third, and it is the only option that gives a genuinely irreversible migration a compliant path.
- **If you do nothing:** the guideline keeps saying "when possible" while the skill keeps saying "Always", and a consumer reading either one is following advice the other contradicts. Phase 2 stays unbuildable and step 2.2's fixtures keep asserting the dogma.

### blocker: small-table-fk-contradiction-wording
- **Status:** open
- **Owner:** maintainer
- **Blocks:** step 1.4 only.
- **What to do:** `:15` and `:20` are both absolute and they collide. Step 1.4
  proposes resolving it by exempting uniqueness and foreign-key constraints
  from the row-count guidance. That is a change to advice the package ships, and
  the alternative reading — that the row-count line is the general rule and
  foreign keys are the exception to be listed at `:20` rather than at `:15` — is
  equally defensible and produces different text. Decide which line is the rule
  and which is the exception; steps 1.1–1.3 and 1.5 do not depend on the answer.
- **Resolved when:** `## Notes` records which of `:15` and `:20` is the rule and which is the exception, and step 1.4's wording follows that choice.
- **Recommendation:** exempt uniqueness and foreign-key constraints from the row-count guidance — they exist for integrity and lookup latency, which a row count does not bear on.
- **If you do nothing:** the two absolute lines stay in the same section and keep colliding on every small child table, and step 1.4 cannot be written either way without picking one silently.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-26 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The corrected passages become hedged to the point of uselessness | product | "It depends" is not advice. Replacing four absolute rules with four non-committal paragraphs would leave a reader worse off than the folklore did, because folklore at least decides. | Every corrected passage must answer its Phase 1.5 adversarial fixture with a specific answer, not a condition list. A passage that cannot answer its own fixture is not finished. | Phase 1 — The four folklore passages in the shipped guideline |
| 2 | The engine-behaviour claims behind the corrections were never verified | implementation | Five of the campaign's engine-behaviour halves are unverifiable offline and were recorded as such. If a corrected passage asserts a specific engine or version behaviour, it may replace wrong advice with differently wrong advice. | No corrected passage asserts an engine-specific or version-specific fact. Where one is needed, the passage states the question and defers to detection; the facts themselves are `-evolution-tactics` work, behind live-engine checks. | Phase 1 — The four folklore passages in the shipped guideline |
| 3 | Phase 2 lands and a consumer's migration review silently weakens | product | A reader who took "Always include `down()`" as the gate may read the two-branch contract as permission to skip reversibility, since the roll-forward branch is easier to claim than to plan. | The contract's second branch requires a *named* plan, and step 2.2 rewrites the fixtures so the pass condition is the declaration, not the absence. If the blocker resolves as (c), Phase 2 is cut rather than softened. | Phase 2 — Reversibility: one contract, two surfaces |
| 4 | Phase 3.2 removes a default and leaves nothing behind | implementation | Deleting "Use MariaDB syntax" without a working detection step would leave the skill with no answer at all for a project whose engine is not declared anywhere. | 3.2 requires the detection step to name the unknown case explicitly and say so rather than guessing. The step is not complete while the unknown branch is missing. | Phase 3 — MySQL is not MariaDB, as a discipline rather than a footnote |

## Acceptance Criteria

- [ ] AC-1 — `grep -nE "most selective column first|needs index|Rewrite as JOIN" docs/guidelines/php/database.md` returns nothing, and each replacement passage states the condition or ordering that decides the case.
- [ ] AC-2 — The indexing section of `docs/guidelines/php/database.md` no longer contains two absolute rules that collide on a small child table, and it mentions unique indexes.
- [ ] AC-3 — Four adversarial fixtures exist, one per corrected passage, each naming both the correct answer and the folklore answer; a run over them produces the correct answer in all four.
- [ ] AC-4 — `src/skills/database/SKILL.md` and `src/skills/sql-writing/SKILL.md` each state that MySQL and MariaDB share a query-syntax world and never share migration, online-DDL or feature behaviour, and neither skill selects a dialect without reading the project first.
- [ ] AC-5 — No canonical template in the tree writes a referential action without stating it as a decision: `grep -rn "onDelete('cascade')" src/skills/` returns nothing outside a labelled decision example.
- [ ] AC-6 — Either the recovery contract is stated identically on both surfaces, or `blocker: recovery-contract-breaks-a-shipped-do-not` is resolved as (c) and Phase 2 is recorded as cut with that reason.
