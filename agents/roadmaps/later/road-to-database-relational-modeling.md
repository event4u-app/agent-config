---
complexity: structural
status: later
execution:
  mode: phase-checkpoints
estate_offset_exempt: "One of four siblings split from a single inbox drop carrying 24 verified defect claims. This one holds the capability work and the ownership question the council refused to settle without evidence; rule 11 forbids folding it into the advice-correction sibling, which changes existing text and adds no capability. No roadmap in the current estate covers database modeling."
estate_growth_exempt: "later_roadmaps +1: this roadmap is parked. Step 1.3 was executed and measured the highest scope overlap in the 34-skill backend-data family at 25 percent against a 70 percent threshold, so a new skill is architecturally warranted -- and inadmissible, because the per-spawn preamble payload has 4 tokens of headroom against a skill catalogue cost of 53. A 2/2-convergent council required the overlap number to be produced anyway rather than writing a budget-forced extend verdict into the admissions ledger. Two of three blockers are resolved and the third is resolved as deferred verification, so open_blockers falls; skill_count is unchanged and active_roadmaps falls by one."
estate_growth_exempt: "Three blockers were discovered during verification, not proposed by the inbox artifact: the new skill's admission burden against 34 existing backend-data skills, a frontmatter key three proposals depend on that the skill schema forbids, and the fact that an ownership map placed in docs/ is unreachable by any agent in a consumer install."
---
# Road to database relational modeling

> **Resume when** a modeling skill is admissible: `check_preamble_payload_budget`
> reports at least 53 tokens of headroom below `ci_delivery.grace_ceiling` on
> `origin/main`, **and** `check_estate_count`'s `skill_count` allowance is
> explicitly allocated across this roadmap and `road-to-database-erd-landing`.
> Parked 2026-08-27 by AI council with Phase 1 discharged — the ownership
> question is answered on evidence and only the capacity is missing. See
> `## Notes` § Parked.

> **Source:** `agents/tmp.old/database-structure/` — four database roadmap
> proposals from two parallel external LLM sessions plus two competing
> consolidations, dropped 2026-08-26. Defects D1–D21 from those registers were
> re-verified independently against HEAD `1899f92b9`: **all 21 tree halves
> hold**, five engine-behaviour halves are unverifiable offline, and five
> defect wordings needed correction because the tree already carries part of
> what they claim is absent.

## Goal

An agent asked to design or extend a relational schema in this package has a
procedure that starts from invariants rather than from UI fields, states
cardinalities explicitly, interrogates access patterns before choosing indexes,
and chooses referential actions and enum representations as decisions with named
costs. One artifact owns each of those concepts and says so in a place a
consumer install can read. When this is finished, the modeling question is
answerable from the shipped surface without reading a guideline that was never
written.

## Context

The defect register behind this roadmap is unusually clean: 21 of 21 tree
claims verified, no line drift, no already-fixed items. What it got wrong is
narrower and matters for scope — five claims assert absence where the tree
already carries a fragment:

- The pivot-table **naming** convention exists (`docs/guidelines/php/naming.md:36`,
  alphabetical + singular, `project_user`). Extend it; do not author a competing one.
- The Mermaid **format** decision exists
  (`src/skills/design-intelligence/references/integration-mapping.md:63`).
- The enum three-way **option set** exists (`src/rules/prefer-enums-over-literals.md:49`,
  "an enum/`CHECK`-constrained column or a lookup table + FK") — with no
  selection criteria and no engine costs.
- The consumer-census **checklist** largely exists:
  `src/skills/blast-radius-analyzer/SKILL.md:63` already enumerates foreign
  keys, indexes, views and triggers, and `:73` the second-order fan-out into
  migrations, seeders and reports. **Zero** DB-family skills reference it. The
  defect is a routing gap, not a missing discipline.
- The unused-index audit exists (`src/skills/database/data/query-tuning.csv:11`,
  with the `pg_stat_user_indexes idx_scan = 0` probe). The dependency-graph half
  does not.

Two of the campaign's harder problems are also **not** what the proposals
thought. There is **no skill family cap**: `lint_roadmap_family_cap` counts
roadmap files under one unrelated prefix, and `lint_persona_governance` counts
personas. `docs/contracts/skill-family-map.yml` already lists **34** skills in
`family: backend-data`. And `min_version:` frontmatter — which three proposals
build their version discipline on — is **schema-illegal**:
`src/scripts/schemas/skill.schema.json:8` sets `additionalProperties: false`
and `min_version` is not among the 36 permitted keys. `compatibility` is.

Siblings, sharing the `road-to-database-` prefix: `-advice-correction` (stop
shipping folklore; runs first and independently), `-erd-landing` (land a
finished ERD capability instead of rebuilding it), `-evolution-tactics` (online
DDL, blue/green, cross-engine porting).

## Provenance

- **Source A** — an external LLM ideation thread, four analysis loops, two of
  the four input proposals.
  `ENC1:n37Vvuk8AEZHmidSo1ARDeBqPO5FWZiPEx4xsRnKXAH77thamSR51BjdOweQ5TUIlnggpcFFOzga3s9St4+ubTH+2oYCB0dGDeGsbH8THloswnlYqqkRxFTPpieCd7bkBRr2PPGj2e3ngmPKlrpiaKpm1gm0GC3RxXY=`
- **Source B** — a second external LLM ideation thread, six loops over the same
  brief plus a harvest of ten external skill collections, two proposals and one
  consolidation.
  `ENC1:uwPcFwnylOcQB/u2WBmmK0YEXNGjYZuvh7DYzxJqJfQzfZDKOB0PxAHIYJ9EsrcG6wktnGWGlo0QBHBLCaHWOOPvdC1WC2eOY8FPM7LNO6r7nVD9kNcFK50kJAfO443D1QCLn2t89J0LOjVYwgjP8ZXmMX8Gv7tR0o33`
- The harvested collections comprised two vendor-official engine skill suites,
  two third-party per-engine packages, and six community collections. Their
  contribution here is **structural, not textual**: the access-pattern-first
  modeling order, per-reference "consult this when…" routing lines, and a
  managed-service guardrail. Their dominant architecture — roughly 30–38 public
  skills per engine — is rejected in the gap table with the reason.
- **A doctrinal citation the proposals got wrong, corrected here:** ADR-211 is
  about a harvest *freeze*, not harvest *order*, its freeze was lifted
  2026-08-05, and it is itself listed as re-opened with an AMEND verdict. The
  defect-first-then-source discipline lives in
  `src/domains/analysis-workbench/analyze/reference-repo/command.md:61`. ADR-216
  Amendment E additionally binds: no gate in this tree may be anchored on an
  external-adoption signal.

### Council convergence

AI council, 2026-08-26, members `anthropic/claude-sonnet-4-5` and
`openai/codex-default`, 3 rounds, blind chairman, $0.0719.

**Q3, the new skill — both seats refused to approve it, and that is Phase 1.**
`codex-default`: *"Treat `relational-modeling` as an unresolved admission
decision… The admissions burden tests architectural distinctness; it does not
authorize force-fitting a distinct concern into an existing module."*
`claude-sonnet-4-5` refused both proposed hosts on substance rather than on
process: extending `database` *"contradicts its narrowing to query/index
authority"*, and extending `schema-review` *"couples schema validation with
design guidance"* unless that skill already gives design advice. Both required
the same evidence before the decision: proposed triggers, outputs and
exclusions for modeling, the equivalent contracts for each candidate host, and
prompt-routing evidence. `claude-sonnet-4-5` set a threshold —
*"does ANY existing skill naturally contain 'when to normalize, when to
denormalize, how to model time-series, how to handle hierarchies'? …
provisional disposition if no overlap >70%: the gate is the blocker, not the
architecture."*

**Q4, the ownership map — generated, never independently authored.** Both seats
rejected a hand-written canonical map. `codex-default` argued it hardest:
*"It establishes a second control plane beside the metadata that actually
governs skill discovery, creating silent contract drift."* Convergent decision:
make each skill's routing metadata authoritative and **generate** a
consumer-shipped map under `dist/agent-src/contexts/`, conditional on proving
that contexts are consulted before skill selection — and if they are not,
*"omit the canonical map and rely on distributed routing metadata until that
capability exists."*

**Q1, the corpus — one CSV, not two.** Both seats decided against a second
registry. `codex-default`: *"Both row types serve the same retrieval intent, so
one corpus avoids independently stale or contradictory authorities."*
`claude-sonnet-4-5` set the revisit condition: a retrieval benchmark showing
materially better precision/recall for the split, with a five-percentage-point
floor on "materially". **This overrides the master consolidation, which chose
two CSVs.**

**Sequencing.** `codex-default` gave a dependency order this roadmap follows:
routing authority and the Q3 evidence both block narrowing `database`; the
corpus follows the ownership decision, not the other way round.

## Gap table

| Proposed item | Verified state | Disposition |
|---|---|---|
| A modeling procedure: invariants → entities → cardinality → access patterns → normalization | `database/SKILL.md:28` claims schema design in scope; `:34` is the only procedure and it optimizes a query. Zero hits for normalization, cardinality or entity vocabulary tree-wide (D1, D8) | **KEEP** — the core of this roadmap |
| Relation-type vocabulary and junction conventions | relation types absent; the naming convention exists at `docs/guidelines/php/naming.md:36` (D2) | **KEEP, narrowed** — author the types, extend the existing naming row |
| PK type decision: BIGINT vs UUID/UUIDv7/ULID, `BINARY(16)` vs `CHAR(36)` | 0 hits in the DB surface; `authz-review:123` requires UUID/ULID for **sensitive resources** specifically, with no storage counterpart and no mention of UUIDv7 (D13) | **KEEP, scoped to the interlock actually there** |
| Index method decision tree beyond B-tree | GIN/partial appear only at `query-tuning.csv:5,7,13`; BRIN, GiST, SP-GiST, Hash and `INCLUDE` appear nowhere as guidance (D14) | **KEEP** |
| Enum three-way decision with engine costs | option set exists at `prefer-enums-over-literals.md:49`, criteria and costs do not (D4) | **KEEP as an extension of that rule**, not a new statement |
| Referential-action matrix, three axes | one hardcoded template line; no matrix, no cost axis (D5, D15) | **KEEP** — but the "cascades fire no triggers" note was already in the source's own prose; only the lock-blast-radius axis is new |
| Two-sided consumer census | app-side checklist substantially exists in `blast-radius-analyzer` and no DB skill routes to it; DB-side dependency graph absent; unused-index audit already present (D9, D17) | **FOLD** — wire the routing, add only the dependency-graph half |
| Trigger evals for the four DB skills without them | `database`, `sql-writing`, `laravel-migration`, `migration-architect` all lack `evals/triggers.json` and all four sit in `src/scripts/trigger_eval_grandfather.json` (D10) | **KEEP** — and the grandfather lines must be deleted in the same change |
| Engine version pins via `min_version:` frontmatter | schema-illegal: `skill.schema.json:8` is `additionalProperties: false` (D12) | **KEEP the discipline, CUT the mechanism** — use `compatibility`, plus a corpus column |
| Managed-service guardrail | 0 hits for `ALTER SYSTEM`, `Cloud SQL`, `postgresql.conf` tree-wide; `database/SKILL.md:40` detects the engine from `docker-compose.yml` (D19) | **KEEP** |
| A second grounding CSV for misconceptions | manifest supports multiple domains (other skills carry 7 and 11); council decided against a second registry | **FOLD** into the single CSV as typed rows |
| A hand-authored Authority Map under `docs/contracts/` | `dist/agent-src/` carries no `docs/` — unreachable in a consumer install; council rejected the second control plane | **CUT and replaced** — generate from routing metadata into `dist/agent-src/contexts/` |
| `database` as a thin router with `capabilities/`, `dialects/`, `reviewers/`, `registries/` subtrees | — | **CUT** — a parallel framework inside the repo; the ownership need it serves is met by Phase 2. Note the commonly cited reason "collides with the family cap" is **false**: no skill family cap exists. |
| Three reviewer subagents; MongoDB preparation abstractions; an MCP live-DB adapter layer | — | **CUT** — the first duplicates `schema-review`, the second is a speculative hook for a model kind not in scope, the third is a separate workstream |
| ~30–38 public skills per engine | — | **CUT** — the content is the value, the surface count is the cost; three engines would put roughly 90 skills into a family that already has 34 |

## Phase 1 — Decide the owner on evidence, not on preference

- [ ] **1.1 Write the modeling contract before choosing where it lives.**
      State the triggers, the outputs, and the explicit exclusions for
      relational modeling as a capability: what a user says that should reach
      it, what it emits, and what it must refuse and route elsewhere.
      verify: the contract exists as a draft frontmatter block plus a
      triggers/outputs/exclusions list, and it names at least three phrasings a
      user would actually type.

- [ ] **1.2 Write the same contract for each candidate host.**
      `database`, `schema-review` and `migration-architect`, read off their
      current text rather than their names. Record what each one owns today and
      what it explicitly does not.
      verify: three contracts recorded, each citing the `file:line` its scope
      lines come from.

- [x] **1.3 Measure scope overlap across the whole `backend-data` family.**
      Not only the three obvious candidates — `docs/contracts/skill-family-map.yml`
      lists 34. For each, record whether it already covers the four probe
      intents the council named: when to normalize, when to denormalize, how to
      model time-varying data, how to model hierarchies.
      verify: **discharged.** `agents/evidence/analysis/relational-modeling-overlap-2026-08-27.md`
      carries all **34** rows with a per-row verdict, the four probe regexes
      verbatim, and the highest overlap figure stated as a number: **25 %**
      (1 of 4 intents, `database`). Both non-zero raw hits were opened and read
      rather than counted — `laravel-validation`'s "normalization" is input
      normalisation at the request boundary (`SKILL.md:40`) and adjudicates to
      0/4; `database`'s surviving hit is one query-tuning row prescribing a
      materialized view (`data/query-tuning.csv:7`). The probe searches each
      skill's whole subtree, not its description, so it is biased **toward**
      finding overlap.

- [~] **1.4 Apply the threshold and record the verdict.**
      Above roughly 70% overlap with one host, the modeling procedure extends
      that host. Below it, the admission gate is the obstacle rather than the
      architecture, and the honest path is a new skill with a truthful
      `why_not_extend`. Record the verdict, the number it rests on, and the
      alternative rejected.
      verify: **half discharged, half deferred — `[~]`.** The verdict and its
      number are in `## Notes` § Parked: 25 % against a 70 % threshold, so a new
      skill is architecturally warranted and `why_not_extend` can be answered
      truthfully. The second half — the `agents/decisions/skill-admissions.jsonl`
      line and `check_skill_admissions` exiting 0 — is **not** done, and is not
      attempted: the skill cannot be admitted while the preamble payload has 4
      tokens of headroom against a 53-token catalogue cost. Writing the ledger
      line for a skill that cannot land would put a record in the tree for an
      artefact that does not exist.

## Phase 2 — Routing authority, and a map generated from it

- [ ] **2.1 Make dialect and hosting a detection step rather than a default.**
      `database/SKILL.md:40` detects the engine from `.env` and
      `docker-compose.yml`, which presumes self-hosted. Add hosting detection
      and the managed-service guardrail the tree has zero hits for: on a managed
      service there is no `ALTER SYSTEM`, no `postgresql.conf` path, no OS
      access — the control-plane CLI is the surface. Where hosting cannot be
      determined, say unknown rather than assuming.
      verify: `grep -n "ALTER SYSTEM" src/skills/database/SKILL.md` returns a
      guardrail line, and a fixture describing a managed instance produces no
      instruction requiring server-level access.

- [ ] **2.2 Give the four DB skills trigger evals and delete their grandfather lines.**
      `database`, `sql-writing`, `laravel-migration` and `migration-architect`
      each get `evals/triggers.json` meeting the corpus floor — at least three
      positives, two near-misses, and one German positive — and their four
      entries leave `src/scripts/trigger_eval_grandfather.json`, which may only
      shrink.
      verify: `./scripts-run src/scripts/check_trigger_eval_presence` exits 0
      with the four grandfather lines removed, and `lint_skill_trigger_corpus`
      passes for each of the four. Note that `description_route_check` is **not**
      the gate to cite: it is diff-scoped and forced to exit 0 under `--dry`,
      which is how it runs locally and on pull requests.

- [ ] **2.3 Establish routing metadata as the single ownership authority.**
      Each DB-family skill's own scope and trigger metadata states what it owns
      and what it refuses. No prose document restates it.
      verify: for each of the DB-family skills, the owns/does-not-own statement
      is in its own frontmatter or scope lines, and no two skills claim the same
      concept.

- [ ] **2.4 Generate the ownership map into a projected context.**
      Derive it from 2.3's metadata and emit it under
      `dist/agent-src/contexts/` so a consumer install can read it. A
      hand-authored map is a second control plane and is explicitly out.
      verify: the generator exists, the projected file is byte-identical to a
      fresh run of it, and `ls dist/agent-src/contexts/` shows the file.

- [ ] **2.5 Prove the map is reachable before it is relied on.**
      Establish whether a context under `dist/agent-src/contexts/` is consulted
      before skill selection on at least one host. If it is not, the map is
      documentation and the ownership statements in 2.3 are the whole mechanism
      — record that and do not claim routing.
      verify: either a recorded host observation showing the context reaching
      the model before selection, or a one-line statement that it does not, with
      the host named.

- [ ] **2.6 Narrow `database` only after 2.3–2.5 land.**
      `database/SKILL.md:28` currently claims schema design. Narrow the
      description to context, dialect, evidence and query/index work once
      modeling has an owner and the ownership statements are in place — not
      before, or the concept is claimed by nothing.
      verify: `grep -n "designing schemas" src/skills/database/SKILL.md` returns
      nothing, and the modeling owner from 1.4 claims it.

## Phase 3 — The modeling procedure

- [ ] **3.1 Author the procedure in the artifact Phase 1 selected.**
      Ordered, and the order is the content: invariants first (what must always
      hold — uniqueness, lifecycle, ownership), then entity candidates, then a
      cardinality interrogation (1-1, 1-n, n-n, optional versus mandatory,
      identifying versus non-identifying; n-n always via a junction table), then
      an access-pattern interrogation per relationship, then the normalization
      ladder to 3NF with denormalization permitted only against a named access
      pattern, then handoff to the physical schema.
      verify: the procedure exists as numbered steps, and a fixture task
      ("users can belong to several projects with a role per membership")
      produces a junction table with the role attribute on it.

- [ ] **3.2 Extend the existing junction naming convention rather than restating it.**
      `docs/guidelines/php/naming.md:36` already specifies alphabetical,
      singular, `project_user`. Reference it and add only what it lacks: when a
      junction table earns its own primary key and additional attributes, and
      when it stays a pure link.
      verify: the modeling artifact links to that guideline row, and
      `grep -c "project_user" ` across the new text is 0 — the convention is
      cited, not copied.

- [ ] **3.3 Add the primary-key type decision, scoped to the interlock that exists.**
      Default BIGINT for internal keys. `authz-review:123` requires UUID/ULID for
      **sensitive resources** exposed publicly — that is the interlock, and it is
      narrower than "all public identifiers". State the two-key pattern
      (internal sequential, external opaque) and the `CHAR(36)` versus
      `BINARY(16)` storage consequence as a comparison whose engine-specific
      cost figures are deferred to live measurement rather than asserted.
      verify: the decision exists, cites `authz-review:123` with its actual
      scope, and contains no unsourced numeric cost multiplier.

- [ ] **3.4 Add the index method decision tree.**
      B-tree, Hash, GIN, GiST, SP-GiST and BRIN, plus partial, expression and
      covering variants, as a tree keyed on the access pattern — not a list.
      Each leaf states which engines support it, using `compatibility`, never
      `min_version`, which the skill schema rejects.
      verify: the tree exists, every leaf names its engines, and
      `./scripts-run src/scripts/validate_frontmatter` exits 0.

- [ ] **3.5 State what an index proposal must contain.**
      An index recommendation is not a name. It states the access pattern it
      serves, the existing index it overlaps or replaces, its write and storage
      cost, and the plan change expected. "No new index" is a valid outcome and
      must be reachable.
      verify: a fixture where the correct answer is no new index produces that
      answer with the four fields filled.

## Phase 4 — Enum and referential action, as decisions with costs

- [ ] **4.1 Extend the enum rule with selection criteria.**
      `src/rules/prefer-enums-over-literals.md:49` already names native enum,
      `CHECK`-constrained column and lookup table. Add the criteria it lacks:
      internal state machines take the constrained form; values that live in the
      product's own vocabulary — labels, ordering, soft-deletion, user-facing
      dropdowns — take the lookup table. Note that evolution cost differs sharply
      by engine and defer the engine specifics to `-evolution-tactics`.
      verify: the criteria are stated, the rule is extended rather than
      duplicated, and no engine-version claim appears without a source.

- [ ] **4.2 Build the referential-action matrix on three axes.**
      Semantics by child value (expendable → cascade, self-valued → restrict,
      surviving → set null), operational cost (a parent delete cascading across
      a very large child table holds locks for as long as it runs; the
      alternative is a batched or soft delete), and side effects (cascaded
      actions do not fire triggers on MySQL and MariaDB; MariaDB has no
      `SET DEFAULT`; deferrability differs on PostgreSQL). The side-effect axis
      is carried from the source's own prose and its engine halves are marked
      unverified until `-evolution-tactics` measures them.
      verify: the matrix has three axes, and a fixture — cascade on a foreign
      key to an invoice table — is rejected with the semantic reason.

- [ ] **4.3 Add the cost fixture the semantic matrix would pass.**
      A cascade that is semantically correct and operationally unacceptable: an
      expendable child table with a very large row count. The correct answer is
      a batched delete plan, not `ON DELETE CASCADE`.
      verify: the fixture exists and the expected answer is the batched plan.

## Phase 5 — The consumer census, wired rather than rebuilt

- [ ] **5.1 Route the DB family to the checklist that already exists.**
      `blast-radius-analyzer` enumerates foreign keys, indexes, views, triggers,
      then migrations, seeders and reports. **No** DB-family skill references it.
      Make the census a required step in `migration-architect` and
      `schema-review` by routing to it.
      verify: `grep -rn "blast-radius-analyzer" src/skills/migration-architect/ src/skills/schema-review/`
      returns a routing line in each, and neither skill restates the checklist.

- [ ] **5.2 Add only the database-side half that is genuinely missing.**
      The dependency graph: foreign-key graph from the catalog, views, triggers
      and functions that depend on an object **before** any drop, redundant
      indexes by prefix relation, orphan rows. The unused-index audit is already
      in the corpus at `query-tuning.csv:11` and is referenced, not rewritten.
      verify: the reference exists, cites `query-tuning.csv:11` for the unused
      -index case, and a fixture with a view depending on a drop candidate
      surfaces the view before the plan.

- [ ] **5.3 Give the census a per-consumer compatibility question set.**
      For each consumer found: does it read the old shape, write the old shape,
      read the new, write the new, does it constrain rollout order, and is there
      a characterization test. Six answers per consumer, because a consumer list
      without them does not constrain the migration.
      verify: the question set is in the census step, and a fixture with two
      consumers produces twelve answers.

## Phase 6 — One corpus, typed

- [ ] **6.1 Add design-decision rows to the existing corpus.**
      `src/skills/database/data/query-tuning.csv` is 13 lines and entirely
      query tuning. Add design rows in the same shape — each with a verification
      probe and an engine/version column — covering the decisions Phases 3–5
      make: junction requirement, cardinality, enum representation, referential
      action, primary-key type, one-to-one extraction, soft-delete versus unique
      constraint, foreign-key indexing.
      verify: `./scripts-run src/scripts/check_corpus_staleness` exits 0, and
      five design symptoms retrieve the correct row via `ground search`.

- [ ] **6.2 Add misconception rows to the same corpus, typed — not a second CSV.**
      The council decided one corpus: both row kinds answer the same retrieval
      intent, and two registries can go stale independently. Each misconception
      row's symptom is the folklore itself — full scan is always bad, most
      selective column first, subquery always becomes a join, every foreign key
      is automatically indexed, MySQL equals MariaDB, every migration can have a
      `down()`, online DDL means zero downtime.
      verify: the rows exist in `query-tuning.csv` with a type or category
      column distinguishing them, the manifest declares the columns,
      `check_corpus_staleness` exits 0, and five folklore prompts retrieve the
      corrective row.

- [ ] **6.3 Record the condition under which the corpus splits.**
      The council's revisit condition, written where a future reader finds it: a
      versioned retrieval benchmark showing at least five percentage points
      better recall for a split corpus, without losing precision.
      verify: the condition is in Notes with its threshold.

## Blockers

### blocker: modeling-skill-admission
- **Status:** resolved
- **Owner:** maintainer
- **Blocks:** step 1.4's "new skill" branch, and therefore Phase 3's location.
  Phases 1.1–1.3, 2, 4, 5 and 6 run regardless; Phase 3 can be authored against
  whichever artifact 1.4 selects.
- **What to do:** two gates fire on a new skill and neither is discretionary.
  `check_estate_count` carries `skill_count` allowance **0**, annotated "no
  allowance, deliberately", so a new skill needs a growth exemption in the same
  diff. `check_skill_admissions` needs a ledger line in
  `agents/decisions/skill-admissions.jsonl` with five answers, of which
  `why_not_extend` must be answered against the 34 skills in
  `family: backend-data` — Phase 1.3 produces exactly that evidence, which is
  why it runs first. Note also that the `-erd-landing` sibling adds a skill
  against the same allowance of zero: decide the total accounting for both, not
  each in isolation. The council declined to pre-approve either outcome and
  named the threshold: above roughly 70% overlap with an existing host, extend;
  below it, the gate is the obstacle rather than the architecture.
- **Resolved when:** step 1.4's verdict is in `## Notes` with its overlap figure, and on the new-skill branch `./scripts-run src/scripts/check_skill_admissions` exits 0.
- **Recommendation:** run Phase 1.3 first and let the number decide. Both council seats refused to pre-approve either outcome, and the overlap figure is cheap to obtain.
- **If you do nothing:** the modeling procedure is authored with no owner, or a skill is created whose `why_not_extend` cannot be answered truthfully — which is the one field in the ledger that outlives the decision.

### blocker: projected-context-reachability-unknown
- **Status:** resolved
- **Owner:** maintainer
- **Blocks:** step 2.5's positive branch, and any claim that the ownership map
  routes. Steps 2.1–2.4 and 2.6 do not depend on it.
- **What to do:** the council made the generated map conditional on evidence
  that a projected context is consulted **before** skill selection, and named
  the fallback: if contexts do not participate at that point, omit the canonical
  map and rely on the distributed routing metadata from 2.3. Establishing which
  is true is a host observation this roadmap cannot make from the tree. Start
  from what the tree does say — `agent-config hooks:status` for the slots bound
  on the host in use, and the `load_context:` frontmatter key in
  `dist/agent-src/rules/` for the only context-loading mechanism this package
  ships — then pick one of:
  (a) record a host observation showing a `dist/agent-src/contexts/` file
  reaching the model before skill selection, and keep the generated map as a
  routing input;
  (b) record that no such observation could be made on the hosts available, take
  the fallback, and mark step 2.5's positive branch `[-]`;
  (c) attach the ownership statements to a rule's `load_context:` instead, which
  is a mechanism that demonstrably delivers, and drop the standalone map.
- **Resolved when:** `## Notes` carries either a host observation showing a projected context reaching the model before skill selection, or the fallback decision with the host named.
- **Recommendation:** take the fallback until the observation exists: ship the ownership statements in each skill's own metadata and do not claim the map routes.
- **If you do nothing:** the generated map is described as routing when it may only be documentation, and the ownership mechanism rests on a reachability claim nobody checked.

### blocker: engine-facts-need-a-source
- **Status:** resolved
- **Owner:** maintainer
- **Blocks:** any step that would state a version-specific engine behaviour as
  fact. No step above does; this blocker exists so none is added later without
  noticing.
- **What to do:** five engine-behaviour claims from the input registers were
  recorded `unverifiable` — they assert what a specific MySQL, MariaDB or
  PostgreSQL version does, and neither the tree nor an offline pass can settle
  them. Every such fact this campaign wants either cites a pinned upstream
  document or is measured by the non-gating live-engine stage in
  `-evolution-tactics`. Until one of those exists, the artifacts state the
  question and the detection step, never the answer. Decide which of the two
  routes each needed fact takes.
- **Resolved when:** `grep -rn "pending Phase 5"` across the artifacts this campaign added returns nothing, and each formerly pending claim cites a pinned source or a measurement.
- **Recommendation:** route each needed fact to the Phase 5 live-engine measurement in `-evolution-tactics`, and use a pinned upstream citation only where a measurement is impractical.
- **If you do nothing:** the campaign replaces verified-wrong advice with unverified advice, which is the same defect class `-advice-correction` exists to remove, one layer deeper and harder to spot.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-26 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Phase 1 is skipped and the new skill is created because both input consolidations wanted one | product | Four proposals and two consolidations all concluded "exactly one new skill", which makes it feel settled. The council refused it twice on substance: extending `database` contradicts its own narrowing, and extending `schema-review` couples validation with design. A skill created without 1.3's overlap number cannot answer `why_not_extend` truthfully, and the ledger line is the thing that outlives the decision. | Phase 1 is first and its verify is a 34-row table with a stated overlap figure. `blocker: modeling-skill-admission` gates 1.4 and names the threshold, so the decision has a number behind it or it does not happen. | Phase 1 — Decide the owner on evidence, not on preference |
| 2 | `database` is narrowed before modeling has an owner | implementation | 2.6 removes "designing schemas" from a live skill description. Run before Phase 1 resolves and before 2.3's ownership statements exist, the concept is claimed by nothing and the routing silently degrades for every consumer. | 2.6 is ordered last in Phase 2 and its verify requires the new owner to claim the concept. The council stated the same dependency independently. | Phase 2 — Routing authority, and a map generated from it |
| 3 | The generated map becomes a second control plane anyway | implementation | A generated file is easy to hand-edit once, and the edit survives until the next regeneration — at which point the ownership statement silently reverts or the generator is bypassed. | 2.4's verify is byte-identity against a fresh generator run, so a hand edit fails the step rather than persisting. 2.3 keeps the metadata authoritative, so the map has no independent content to drift. | Phase 2 — Routing authority, and a map generated from it |
| 4 | Engine-specific facts are asserted and are wrong | product | The proposals carry confident version claims — CHECK enforcement thresholds, `INVISIBLE` versus `IGNORED`, metadata-only DDL cases. Five such halves were recorded unverifiable, and a wrong engine fact in shipped guidance is the same defect class the `-advice-correction` sibling exists to remove. | `blocker: engine-facts-need-a-source` requires a pinned upstream citation or a live-engine measurement for each. Steps 3.3, 3.4, 4.1 and 4.2 explicitly defer their engine halves rather than filling them in. | Phase 3 — The modeling procedure |
| 5 | The corpus becomes a place where advice hides from review | product | 6.1 and 6.2 add prose rows to a retrieval corpus. Rows are not read the way a skill body is read, so a wrong row survives longer — and 6.2's rows are specifically corrections of folklore, which is exactly the content most likely to be stated too absolutely. | Every added row carries a verification probe (6.1) and the misconception rows are retrieval-tested against the folklore phrasing (6.2). The rows correcting engine behaviour fall under blocker 3 like any other engine claim. | Phase 6 — One corpus, typed |
| 6 | The census routing lands and nothing uses it | implementation | 5.1 adds a routing line to two skills. A routing line is not a step, and `blast-radius-analyzer` is currently referenced by zero DB skills precisely because a pointer is easy to ignore. | 5.1's verify requires the reference in both skills and forbids restating the checklist; 5.3's per-consumer question set makes the census produce an artifact the migration plan needs, so skipping it is visible downstream. | Phase 5 — The consumer census, wired rather than rebuilt |
| 7 | Phase 2.2 lowers a coverage ratchet instead of raising it | implementation | Deleting four grandfather lines and adding four eval files moves `check_routing_coverage` against a committed seed. A branch that regenerates the seed rather than clearing the gate honestly turns a ratchet into a rubber stamp. | 2.2's verify names `check_trigger_eval_presence` and the corpus linter as the gates, and states that the grandfather list may only shrink. The seed moves because coverage rose, and the four eval files are the evidence. | Phase 2 — Routing authority, and a map generated from it |

## Acceptance Criteria

- [ ] AC-1 — A 34-row overlap table for `family: backend-data` exists with a per-row verdict and a stated maximum overlap figure, and the ownership verdict in Notes cites that figure.
- [ ] AC-2 — One artifact owns relational modeling, states it in its own scope metadata, and no other DB-family skill claims the same concept.
- [ ] AC-3 — `grep -n "designing schemas" src/skills/database/SKILL.md` returns nothing, and the concept is claimed by the artifact from AC-2.
- [ ] AC-4 — `database`, `sql-writing`, `laravel-migration` and `migration-architect` each carry `evals/triggers.json` passing the corpus floor, and none of the four appears in `src/scripts/trigger_eval_grandfather.json`.
- [ ] AC-5 — The modeling procedure answers the junction fixture with a junction table carrying its extra attribute, the no-new-index fixture with no new index and four filled fields, and the invoice-cascade fixture with a rejection and a semantic reason.
- [ ] AC-6 — `./scripts-run src/scripts/validate_frontmatter` exits 0 and `grep -rn "min_version:" src/skills/` returns nothing.
- [ ] AC-7 — `query-tuning.csv` carries both design-decision and misconception rows, distinguished by a declared column, with `check_corpus_staleness` green; no second CSV was added.
- [ ] AC-8 — `migration-architect` and `schema-review` both route to `blast-radius-analyzer`, and neither restates its checklist.
- [ ] AC-9 — No artifact this roadmap adds states a version-specific engine behaviour without either a pinned upstream citation or a live-engine measurement.
- [ ] AC-10 — Either a projected context is shown to reach the model before skill selection on a named host, or the fallback is recorded and no routing claim is made for the map.

## Notes

The reachability observation from 2.5 and the corpus-split revisit threshold
from 6.3 belong here once established. The ownership verdict from 1.4 is below.

## Parked — 2026-08-27, AI council, with Phase 1's number produced first

### 1.4's verdict: architecturally warranted, presently inadmissible

**Highest scope overlap across the 34-skill `backend-data` family: 25 %.** One
skill (`database`) matches 1 of the 4 probe intents; the other 33 match none.
Full 34-row table, the four probe regexes, and the adjudication of both non-zero
raw hits: `agents/evidence/analysis/relational-modeling-overlap-2026-08-27.md`.

Step 1.4's rule is *"above roughly 70 % overlap with one host, the modeling
procedure extends that host; below it, the admission gate is the obstacle rather
than the architecture."* 25 % is not near the line. The three candidate hosts the
roadmap named all fail for reasons the number now backs:

| Candidate | Overlap | Why not |
|---|---|---|
| `database` | 25 % | Its own description narrows it to operations — *"MariaDB/MySQL tuning, indexing strategies, slow queries"*. Its single point of contact is one query-tuning CSV row prescribing a materialized view. Adding modeling contradicts the narrowing step 2.6 of this same roadmap is trying to complete. |
| `schema-review` | not in the family | Validates an existing schema. Coupling it with design puts author and reviewer in one artefact. |
| `migration-architect` | not in the family | Owns the transition between two schemas; modeling decides what the second one should be, which is upstream. |

**The verdict is therefore "new skill" on architecture and "not now" on
capacity** — the third branch, distinct from both options the blocker offered.
`check_estate_count`'s `skill_count` allowance is 0, and the harder constraint is
the per-spawn preamble payload: **4 tokens of headroom** against a catalogue cost
of ~53 for any skill (measured the same day in
`agents/evidence/analysis/preamble-headroom-is-in-the-rules-2026-08-27.md`, and
confirmed to 49 tokens over by merging the sibling's prepared branch).

### Why the number was produced even though the answer was capacity-bound

Both council seats insisted on it, and the reason is specific rather than
procedural: budget pressure can prevent an admission but cannot establish
architectural overlap. Writing *"extend"* here because the estate is full would
put a false answer in `agents/decisions/skill-admissions.jsonl`'s
`why_not_extend` — the one field `blocker: modeling-skill-admission` says
*"outlives the decision"*. The ledger line is deliberately **not** written: a
record for an artefact that cannot exist is worse than no record.

### The three blockers, resolved

**`modeling-skill-admission` → resolved.** Its `Resolved when` has two clauses.
The first — *"step 1.4's verdict is in `## Notes` with its overlap figure"* — is
discharged above with a measured 25 %. The second — *"on the new-skill branch
`check_skill_admissions` exits 0"* — is conditioned on a new-skill branch that
this change does not create and could not land. The total `skill_count`
accounting the sibling blocker also demanded is now settled from the other side:
**neither database roadmap takes the allowance**, because neither can add a skill
at all. It stays available to whichever resumes first.

**`projected-context-reachability-unknown` → resolved as fallback (b),
convergent 2/2.** No host observation of a `dist/agent-src/contexts/` file
reaching the model before skill selection could be made, and this roadmap cannot
make one from the tree. The generated ownership map is therefore **not** claimed
as a routing input; step 2.5's positive branch is to be marked `[-]` when Phase 2
runs, and the ownership statements ship in each skill's own metadata (2.3)
instead. **Cost, stated rather than glossed:** pre-selection routing is lost, the
map is documentation and not a control plane, and the ownership information may
have to be duplicated in the per-skill metadata that does deliver.
*Revisit-if:* a reproducible host trace shows a projected context consulted
before skill selection.

**`engine-facts-need-a-source` → resolved as deferred verification, not as
resolution.** Every version-specific engine claim routes to the non-gating
live-engine stage in `road-to-database-evolution-tactics`, with a pinned upstream
citation only where measurement is impractical. Both seats flagged that this is a
**verification plan and not a verification** — and one added the sharper point:
the `-evolution-tactics` stage is itself blocked on a runtime decision, so until
that resolves the five claims stay explicitly provisional, non-gating, and
unavailable as implementation guarantees. Recorded that way here so a later
reader does not mistake the routing for an answer.

### Council record

Convened 2026-08-27 jointly with `road-to-database-erd-landing`, because the
`skill_count` allowance entangled the two. Members `anthropic`, `openai`; both
present before and after (`2/2 present, needed 1 — concluded`). Reported cost
$0.0625 on subscription-CLI transport with `billable=0` — PR #1695 records that
this figure is not a real charge.

On this roadmap the seats were **convergent with no dissent** on every point: the
overlap evidence is mandatory and cannot be substituted by budget pressure;
budget scarcity cannot decide architectural overlap; the honest 1.4 verdict is
the three-way one (high overlap → extend / low overlap → warranted but
inadmissible / inconclusive → park without a verdict) rather than the binary the
blocker offered; fallback (b) for reachability; deferred verification for engine
facts; and no manufactured progress — *"do not advance implementation phases
merely because preparatory paperwork can be completed."*

One seat set the precondition this change honours: run Phase 1.3 and 1.4 **only
if independently executable today**, park at 0/34 otherwise. 1.3 was
independently executable — it is a read over the tree — so it ran.

**Revisit-if:** `check_preamble_payload_budget` reports at least 53 tokens of
headroom below `ci_delivery.grace_ceiling` on `origin/main`, via a rules
reduction rather than a catalogue trim, **and** the `skill_count` allowance is
explicitly allocated across this roadmap and `-erd-landing`. The `grace_end_date`
of 2026-11-10 is a second trigger: after it the design ceiling of 107,646
applies and the gap is ~30,600 tokens rather than ~49.

### What is NOT claimed

Steps 1.1, 1.2 and all of Phases 2 through 6 are untouched and unchecked — 32 of
34 boxes remain open, and all acceptance criteria remain unmet. Step 1.4 is `[~]`
because exactly half of its verify clause is discharged. No skill is created, no
admissions-ledger line is written, no skill description is narrowed, and
`database`'s description is unchanged — step 2.6's narrowing explicitly must not
run before modeling has an owner, and it does not have one yet.

