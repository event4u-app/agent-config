<!-- evidence-type: analysis -->
# Relational modeling has no host in `backend-data`: highest measured overlap is 25 %, and it is one CSV row

**Measured 2026-08-27** at `origin/main` = `830e31aa3`, discharging step 1.3 of
`road-to-database-relational-modeling` and supplying the number its
`blocker: modeling-skill-admission` requires before step 1.4 may record a verdict.

Two council rounds refused to pre-approve either outcome and named the threshold:
**above roughly 70 % overlap with an existing host, extend it; below, the
admission gate is the obstacle rather than the architecture.** This produces the
number that decides between them.

## Method — reproducible, and deliberately generous to the "extend" side

The `backend-data` family is read from `docs/contracts/skill-family-map.yml`;
it lists exactly **34** skills. For each, the probe searches the skill's **whole
subtree** — `SKILL.md`, `references/`, `data/*.csv`, `evals/*.json` — not just the
description, so a skill that covers an intent in a reference file still scores.

The four probe intents are the ones the council named. Patterns, verbatim:

| Intent | Regex (case-insensitive) |
|---|---|
| when to normalize | `\bnormali[sz](e\|ed\|ing\|ation)\b` · `\b(1NF\|2NF\|3NF\|BCNF)\b` · `third normal form` |
| when to denormalize | `\bdenormali[sz](e\|ed\|ing\|ation)\b` · `read model` · `materiali[sz]ed view` · `duplicat\w+ (column\|data) (for\|to) (read\|speed)` |
| time-varying data | `temporal table` · `slowly changing dimension` · `\bSCD[ -]?2\b` · `valid_from` · `effective_(from\|date)` · `bitemporal` · `point-in-time` · `versioned row` · `history table` |
| hierarchies | `\bhierarch(y\|ies\|ical)\b` · `adjacency list` · `nested set` · `materiali[sz]ed path` · `closure table` · `\bltree\b` · `recursive CTE` · `parent_id` |

Overlap = intents matched / 4. **Every non-zero hit was then opened and read**,
because a regex hit is a candidate and not a finding — and both of them turned
out to need adjudication.

## Result

**Highest overlap: 25 % (1 of 4 intents), held by `database`.** After
adjudication, one skill scores 1/4 and the other 33 score 0/4.

| Skill | norm | denorm | time | hierarchy | raw | adjudication |
|---|---|---|---|---|---|---|
| `database` | 0 | 3 | 0 | 0 | 1/4 | 1/4 — TRUE. `data/query-tuning.csv:7` prescribes "materialized view / rollup table refreshed on schedule or trigger" for repeated full-table aggregation. Genuine denormalisation advice, but performance-motivated and one row in a query-tuning corpus, not a modeling procedure.
| `laravel-validation` | 1 | 0 | 0 | 0 | 1/4 | 0/4 after adjudication — FALSE POSITIVE. `SKILL.md:40` reads "use `prepareForValidation()` only when normalization is truly necessary", i.e. INPUT normalisation at the request boundary, not schema normal forms.
| `api-design` | 0 | 0 | 0 | 0 | 0/4 | 0/4 — no probe intent appears anywhere in the skill tree.
| `api-endpoint` | 0 | 0 | 0 | 0 | 0/4 | 0/4 — no probe intent appears anywhere in the skill tree.
| `artisan-commands` | 0 | 0 | 0 | 0 | 0/4 | 0/4 — no probe intent appears anywhere in the skill tree.
| `async-python-patterns` | 0 | 0 | 0 | 0 | 0/4 | 0/4 — no probe intent appears anywhere in the skill tree.
| `composer-packages` | 0 | 0 | 0 | 0 | 0/4 | 0/4 — no probe intent appears anywhere in the skill tree.
| `eloquent` | 0 | 0 | 0 | 0 | 0/4 | 0/4 — no probe intent appears anywhere in the skill tree.
| `form-handler` | 0 | 0 | 0 | 0 | 0/4 | 0/4 — no probe intent appears anywhere in the skill tree.
| `jobs-events` | 0 | 0 | 0 | 0 | 0/4 | 0/4 — no probe intent appears anywhere in the skill tree.
| `laravel` | 0 | 0 | 0 | 0 | 0/4 | 0/4 — no probe intent appears anywhere in the skill tree.
| `laravel-api-endpoint` | 0 | 0 | 0 | 0 | 0/4 | 0/4 — no probe intent appears anywhere in the skill tree.
| `laravel-dto` | 0 | 0 | 0 | 0 | 0/4 | 0/4 — no probe intent appears anywhere in the skill tree.
| `laravel-horizon` | 0 | 0 | 0 | 0 | 0/4 | 0/4 — no probe intent appears anywhere in the skill tree.
| `laravel-mail` | 0 | 0 | 0 | 0 | 0/4 | 0/4 — no probe intent appears anywhere in the skill tree.
| `laravel-middleware` | 0 | 0 | 0 | 0 | 0/4 | 0/4 — no probe intent appears anywhere in the skill tree.
| `laravel-migration` | 0 | 0 | 0 | 0 | 0/4 | 0/4 — no probe intent appears anywhere in the skill tree.
| `laravel-notifications` | 0 | 0 | 0 | 0 | 0/4 | 0/4 — no probe intent appears anywhere in the skill tree.
| `laravel-pennant` | 0 | 0 | 0 | 0 | 0/4 | 0/4 — no probe intent appears anywhere in the skill tree.
| `laravel-pulse` | 0 | 0 | 0 | 0 | 0/4 | 0/4 — no probe intent appears anywhere in the skill tree.
| `laravel-reverb` | 0 | 0 | 0 | 0 | 0/4 | 0/4 — no probe intent appears anywhere in the skill tree.
| `laravel-scheduling` | 0 | 0 | 0 | 0 | 0/4 | 0/4 — no probe intent appears anywhere in the skill tree.
| `laravel-websocket` | 0 | 0 | 0 | 0 | 0/4 | 0/4 — no probe intent appears anywhere in the skill tree.
| `multi-tenancy` | 0 | 0 | 0 | 0 | 0/4 | 0/4 — no probe intent appears anywhere in the skill tree.
| `nextjs-patterns` | 0 | 0 | 0 | 0 | 0/4 | 0/4 — no probe intent appears anywhere in the skill tree.
| `php-coder` | 0 | 0 | 0 | 0 | 0/4 | 0/4 — no probe intent appears anywhere in the skill tree.
| `php-debugging` | 0 | 0 | 0 | 0 | 0/4 | 0/4 — no probe intent appears anywhere in the skill tree.
| `php-service` | 0 | 0 | 0 | 0 | 0/4 | 0/4 — no probe intent appears anywhere in the skill tree.
| `project-analysis-laravel` | 0 | 0 | 0 | 0 | 0/4 | 0/4 — no probe intent appears anywhere in the skill tree.
| `project-analysis-nextjs` | 0 | 0 | 0 | 0 | 0/4 | 0/4 — no probe intent appears anywhere in the skill tree.
| `project-analysis-node-express` | 0 | 0 | 0 | 0 | 0/4 | 0/4 — no probe intent appears anywhere in the skill tree.
| `project-analysis-symfony` | 0 | 0 | 0 | 0 | 0/4 | 0/4 — no probe intent appears anywhere in the skill tree.
| `sql-writing` | 0 | 0 | 0 | 0 | 0/4 | 0/4 — no probe intent appears anywhere in the skill tree.
| `symfony-workflow` | 0 | 0 | 0 | 0 | 0/4 | 0/4 — no probe intent appears anywhere in the skill tree.
## The two hits that needed reading

**`database` — 1/4, and it survives.** `src/skills/database/data/query-tuning.csv:7`
prescribes *"Pre-aggregate: materialized view / rollup table refreshed on schedule
or trigger; partial indexes for hot subsets"* for repeated full-table
aggregation. That is real denormalisation advice. It is also performance-motivated,
lives in a query-tuning corpus, and says nothing about when a schema *should* be
denormalised as a modeling choice. The `read model` match in
`src/skills/database/SKILL.md:68` is a false positive — it enumerates Eloquent
model attributes (`$table`, `$fillable`, `$casts`), not a CQRS read model.

**`laravel-validation` — 0/4, adjudicated down.** `SKILL.md:40` reads *"use
`prepareForValidation()` only when normalization is truly necessary"* — input
normalisation at the request boundary. Nothing to do with normal forms. Scored
0/4.

## What the number decides

25 % against a 70 % threshold is not near the line; it is a third of the way
there, and the single point of contact is one CSV row about materialized views.
Under step 1.4's own rule this is unambiguous: **a new skill is architecturally
warranted, and `why_not_extend` can be answered truthfully.** The three
candidate hosts the roadmap named score as follows:

| Candidate host | Overlap | Why extending it would be wrong |
|---|---|---|
| `database` | 25 % | Its own description narrows it to *"database architecture, MariaDB/MySQL tuning, indexing strategies, slow queries"* — operational, not design. Adding modeling contradicts the narrowing that step 2.6 of the same roadmap is separately trying to complete. |
| `schema-review` | not in the family | Validation of an existing schema, not design of a new one. Coupling the two puts the reviewer and the author in one artefact. |
| `migration-architect` | not in the family | Owns the *transition* between two schemas. Modeling decides what the second one should be, which is upstream of it. |

## What this does NOT decide

**It does not make the skill admissible.** `check_estate_count` carries a
`skill_count` allowance of 0, and — the harder constraint — the per-spawn
preamble payload has **4 tokens of headroom** against its CI grace ceiling
(measured the same day:
`agents/evidence/analysis/preamble-headroom-is-in-the-rules-2026-08-27.md`).
A skill's catalogue entry costs ~53 tokens. So the honest verdict is the third
branch a council seat named: **architecturally warranted, presently
inadmissible** — which is a different statement from either "extend" or "new
skill lands".

Writing "extend" here because the estate is full would put a false answer in
`agents/decisions/skill-admissions.jsonl`'s `why_not_extend` field — the one
field the blocker says outlives the decision. That is why the number was
produced even though the capacity answer was already known.

**It does not measure quality of coverage, only presence.** A skill could
mention `parent_id` once and score a hit on hierarchies without offering any
guidance. The probe is therefore biased *toward* finding overlap, which makes a
25 % ceiling a stronger result than a neutral method would give.
