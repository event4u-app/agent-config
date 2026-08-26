<!-- evidence-type: analysis -->

# Database inbox drop — verification pass, 2026-08-26

Verification record for the four `road-to-database-*` roadmaps. The inbox
artifact is `agents/tmp.old/database-structure/` (7 files, ~10k lines): four
roadmap proposals from two parallel external LLM sessions, two competing
consolidations, and the chat transcript.

Drafting base `e6fdfd49d`; verification tree HEAD `1899f92b9`. The window
`e6fdfd49d..HEAD` is **one commit**, and it touches none of the cited files, so
no claim below is stale and no line number drifted.

## 1. Defect claims — 24 of 24 tree halves hold

D1–D11 (first register), D12–D21 (second), D22–D24 (the consolidation's own
verification pass) were each re-run independently against this tree, with the
cited command executed rather than trusted. **All 24 tree halves are
`still-true`. Zero `already-fixed`, zero `never-true` at claim level.**

Every cited `file:line` resolves to the claimed content byte-accurately,
including `database/SKILL.md:28,34`, `:82`, `laravel-migration/SKILL.md:76`,
`sql-writing/SKILL.md:33,43,85`, `adapter_raw_sql.ts:6-12`,
`eloquent.md:11,207`, and `wc -l query-tuning.csv == 13`.

**Five engine-behaviour halves are `unverifiable`** and were not accepted: D12,
D15, D16, D18 and D21 each assert what a specific MySQL, MariaDB or PostgreSQL
version does. No network was used and this tree carries no engine
documentation. They are recorded as questions, not facts, and
`road-to-database-relational-modeling` carries
`blocker: engine-facts-need-a-source` so no artefact states one without a
pinned citation or a measurement.

**Zero-hit rigour.** Three negative claims needed a second pass because the
registers' own regexes over-match under `-i`: `LTS` matches `resuLTS`, `GIN`
matches `marGIN`, `INVISIBLE` matches the English word. Each zero was
re-established word-bounded and case-sensitively across `src/`, `docs/` **and**
`dist/agent-src/` before acceptance.

## 2. Five claim wordings needed correction — the tree already carries a fragment

| Claim | As worded | Corrected |
|---|---|---|
| D2 | "relation types and junction-table conventions are described nowhere" | The junction **naming** convention exists — `docs/guidelines/php/naming.md:36`, alphabetical + singular, `project_user`. Relation types are genuinely absent. Extend that row; do not author a competing convention. |
| D3 | the single `erDiagram`-adjacent hit is "no DB context" | It is explicitly DB context: `src/skills/design-intelligence/references/integration-mapping.md:63` routes "a **DB schema / ERD** / entity relations" to "**mermaid**, never hand-placed SVG". The Mermaid format decision was already the tree's position. |
| D4 | "no enum decision aid" | `src/rules/prefer-enums-over-literals.md:49` already names all three options ("an enum/`CHECK`-constrained column or a lookup table + FK"). It carries no criteria and no costs, so the gap is real but it is an extension point. |
| D5 | "no further hit in the entire tree" | Two sites, not one: `laravel-migration/SKILL.md:76` and `docs/guidelines/php/database.md:71` ("proper `onDelete()`" presumes a decision it never states). |
| D9 | "consumer census is missing as a discipline" | Refuted at capability level. `blast-radius-analyzer/SKILL.md:63` enumerates foreign keys, indexes, views and triggers; `:73` the fan-out into migrations, seeders and reports. **Zero** DB-family skills reference it. The defect is a routing gap. |

Two further corrections inside D15/D17/D22/D24:

- **D15** overclaims. Its tree half holds, but it lists two missing items and
  its own cited source already carries one ("cascaded actions fire no
  triggers"). Only the lock-blast-radius axis is new.
- **D17** partially overlaps what exists: the unused-index audit with its
  `pg_stat_user_indexes idx_scan = 0` probe is already at
  `query-tuning.csv:11`. The dependency-graph half is genuinely absent.
- **D22**'s parenthetical ("overlooks unique/FK indexes") is half wrong:
  `database.md:15` **does** say to index foreign-key columns. The defect is an
  unresolved contradiction `:15` ↔ `:20`. Unique indexes are absent from the
  whole section.
- **D24**'s "only one gotcha line differentiates" is wrong: there are two —
  `database/SKILL.md:118` and `sql-writing/SKILL.md:69`.

## 3. Four hard blockers neither consolidation found

1. **`min_version:` frontmatter is schema-illegal.**
   `src/scripts/schemas/skill.schema.json:8` sets `additionalProperties: false`
   and `min_version` is not among the 36 permitted keys. Three proposals build
   their version discipline on it. `compatibility` exists and is the legal key.
2. **A new skill is gated twice.** `check_estate_count` carries `skill_count`
   allowance **0** ("no allowance, deliberately"), and
   `check_skill_admissions` requires a ledger line in
   `agents/decisions/skill-admissions.jsonl` with five answers including
   `why_not_extend` — against the **34** skills already in
   `family: backend-data` (`docs/contracts/skill-family-map.yml`). Two roadmaps
   in this campaign each add a skill against that same allowance of zero.
3. **Gate tier needs a spike per rule.**
   `docs/spikes/scale-history-spikes.md:21`: `lint_persistence` gates only where
   a pre-registered pass threshold was met; unspiked rules stay advisory. The
   proposed `-- expand-contract:` waiver is additionally not an allowed kind —
   `WAIVER_KINDS` is a closed `as const`.
4. **A `docs/contracts/` Authority Map is unreachable.** `dist/agent-src/`
   carries no `docs/`, so an ownership map placed there is maintainer-only. The
   council routed it to generated routing metadata projected under
   `dist/agent-src/contexts/` instead.

## 4. Two mechanism claims refuted

- **There is no skill family cap.** `lint_roadmap_family_cap.ts:41-42` counts
  **roadmap files** under `FAMILY_PREFIX = 'road-to-skill-ecosystem-'`, `CAP = 2`.
  `lint_persona_governance.ts:60` counts **personas**. Neither reads
  `src/skills/`. The consolidation's reason for rejecting a router architecture
  ("collides with the family cap") is therefore false; its other two reasons —
  a parallel framework inside the repo, and thin projection — are untouched, and
  the real blockers are the two named in §3.2.
- **ADR-211 is not the inverted-harvest doctrine.** It is about a harvest
  *freeze*, its nearest sentence is "Evidence direction: finding → borrow, never
  the reverse", its freeze was lifted 2026-08-05, and it is itself listed as
  re-opened with an AMEND verdict. The defect-first discipline lives in
  `src/domains/analysis-workbench/analyze/reference-repo/command.md:61`.
  ADR-216 Amendment E additionally binds: no gate here may be anchored on an
  external-adoption signal.

## 5. One exit gate is near-vacuous

`description_route_check` was proposed as an exit gate. `gate-coverage.yml:101-104`
says of it: "it is diff-scoped, so its natural reading on most trees is zero
cases", and `description_route_check.ts:483-487` forces `Exit forced to 0` under
`--dry`, which is how it runs locally and on pull requests. The gates that
actually move are `check_routing_coverage` (against the committed seed
`0.3144`), `check_trigger_eval_presence` (the four grandfather lines in
`src/scripts/trigger_eval_grandfather.json` must be **deleted**, and that list
may only shrink), and `lint_skill_trigger_corpus`.

## 6. One finding neither the artifact nor its sources could have made

**The ERD capability already exists, complete and tested, off-trunk.**

Branch `feat/schema-erd-diff`, 5 commits, **5456 insertions across 33 files**:
`src/skills/schema-erd/SKILL.md` with `evals/triggers.json`, `schema_erd/ir.ts`
(SchemaIR v1, validator, byte-stable canonicaliser), four adapters (DDL, Prisma,
tbls, Laravel), `diff.ts`, `rename_scan.ts`, Mermaid and change-table renderers,
a CLI entry point, and **134 test cases**. Every step and every acceptance
criterion in its own roadmap is `[x]`, and that roadmap is archived on the
branch as fully closed. It has never been pushed to `origin`.

`git merge-tree --write-tree origin/main feat/schema-erd-diff` reports **8
conflicts**, all in regenerated surfaces — `README.md`, `docs/CLAIMS.md`,
`docs/architecture.md`, `docs/featured-skills.md`,
`docs/getting-started-by-role.md`, `docs/governance-advantage.md`, plus
`agents/roadmaps/archive/INDEX.md` and `index.json` which `main` deleted — and
**zero** in `src/scripts/schema_erd/`, `src/skills/schema-erd/` or `tests/`.
Merge base is `release/14.6.0`.

Three of the four inbox proposals contain a phase to build this from scratch.

**Recurrence.** The same requirement arrived 2026-08-19 as
`agents/tmp.old/erd-erp/` — a Revision-2 proposal with its own file:line
provenance. It was consumed, implemented on the branch, and then
`road-to-session-closeout` step 7.2 ("Land or discard the rescue set… verify:
each has a merged change or a recorded disposal") was marked `[x]` with neither
for this branch. Of the three outcomes a recurrence can have, this is the third:
the disposition was right, it was recorded, and the record reached nothing that
acts.

A scan of all local refs for commits absent from `origin/main`, ranked by
database-relevant file count, found `feat/schema-erd-diff` at 25 such files and
nothing else above 3 — the remainder are unrelated language-migration branches.

## 7. One of my own findings, refuted — recorded because it nearly shipped

I read `dist/agent-src/` carrying no `guidelines/` directory, together with 22
skills that say "See guideline `php/…`", as a dangling-pointer defect affecting
every consumer install — which would have downgraded the whole
advice-correction roadmap to maintainer-only scope.

It is wrong. `docs/guidelines/` is in `package.json:files[]`, and
`check_references.ts:74` states the position explicitly: "`docs/guidelines/` is
shipped to a consumer and is the only half that reaches anyone." The guideline
ships. `docs/guidelines/php/database.md` therefore reaches installs, which
*raises* the severity of D22 rather than lowering it, and is why
`road-to-database-advice-correction` runs first.

## 8. Council

AI council, 2026-08-26, `anthropic/claude-sonnet-4-5` and
`openai/codex-default`, 3 rounds, blind chairman, quorum 2/2, $0.0719. Two
decisions went **against** the leading consolidation:

- **One corpus, not two.** Misconceptions become typed rows in the existing
  `query-tuning.csv`, not a second registry. Both seats: the two row kinds serve
  the same retrieval intent, and two registries go stale independently.
  Revisit-if: a versioned retrieval benchmark showing ≥5 percentage points
  better recall for the split without losing precision.
- **Live-engine evaluations stay in scope, non-gating.** Both seats refused to
  park them: five engine claims are unverifiable offline, and parking their only
  credible verification "would turn known uncertainty into permanent debt".

And two the consolidation had not asked:

- **The new skill is not approved.** Both seats refused to authorise
  `relational-modeling` without a scope-overlap study across the 34
  `backend-data` skills, and both rejected the two proposed alternative hosts on
  substance. Threshold: above roughly 70% overlap, extend; below it, the gate is
  the obstacle rather than the architecture.
- **The ownership map is generated, never hand-authored** — otherwise it is a
  second control plane beside the metadata that actually governs discovery.
  Conditional on evidence that a projected context is consulted before skill
  selection; if not, the distributed metadata is the whole mechanism.

On the ERD branch both seats converged on rebase-and-land over re-derivation,
and both named the same risk: stale validation. Green CI at `release/14.6.0`
says nothing about current schema legality, estate limits, packaging projection,
generator invariants, Node version, or adapter contracts. One seat additionally
refused the blanket "take main's side on regenerated surfaces" without proving
each conflicted file is wholly generated.
