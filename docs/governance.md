# Governance — own, age, and contract the skill surface

How the 227-skill surface is governed for a **single-maintainer** project, with
forward-structure for a team. Scope + sequencing settled by AI-council
(claude-sonnet-4-5 + gpt-4o, 2026-06-09): build what gives a solo maintainer
real leverage now; defer team-shaped ceremony and Phase-3 discovery conclusions.

## Single Source of Truth rule

```
A GOVERNANCE FIELD LIVES IN EXACTLY ONE ARTEFACT.
DERIVED VALUES ARE DOCUMENTED, NOT STORED.
```

`docs/contracts/skill-family-map.yml` is the machine-readable **spine**. Any
field it carries (`family`, `primary_use`, `activation_scope`) must **not** be
duplicated in another doc — policies and tooling *reference* the spine. A value
that can be computed from other data (e.g. dormancy from `git log`) is
**documented as a derivation, never stored** — stored copies drift.

## `skill-family-map.yml` — the spine

Per skill, three **base** fields (Phase 2):

| Field | Meaning | Source |
|---|---|---|
| `family` | one of the 19 navigation families | the [skill taxonomy](skills-taxonomy.md) (pack + name-pattern) |
| `primary_use` | one-line "use when …" | the skill's frontmatter `description:` (first clause) |
| `activation_scope` | which pack(s) gate the skill, or `core` (always available) | frontmatter `pack:` / `packs:`, per ADR-040 |

**Reserved for Phase 3** (intentionally absent now): `overlaps_with`,
`candidate_for_merge`, `candidate_for_lens`, `candidate_for_internal`. These are
**conclusions of the Phase-3 consolidation scan**, not metadata about a skill —
populating them in Phase 2 would pre-empt Phase 3's "discover, merge nothing"
mandate and anchor the analysis to today's bias.

**Regeneration (reproducible):** the spine is generated from `src/skills/*/SKILL.md`
— `family` via the taxonomy's ordered name-pattern rules (see
[`skills-taxonomy.md`](skills-taxonomy.md) § Derivation), `primary_use` from the
first clause of each `description:`, `activation_scope` from the declared
`pack:`/`packs:` (or `core`). Re-run that logic to refresh; counts track the
[artefact census](artefact-census.md).

## Skill lifecycle policy

States: **active** · **dormant** · **sunset**. Slots beside the
`persona-governance` rule as its skill-side sibling.

- **Dormancy is commit-based, not review-date-based.** A solo maintainer does not
  hand-maintain `last_reviewed:` timestamps (busywork that drifts). Dormancy
  signal = **no commits touching a skill's files in 6 months**
  (`git log --since='6 months ago' -- src/skills/<name>/`). Derivable — so it is
  *not* stored in the spine (Single Source of Truth rule).
- **Dormancy triggers review, never auto-deprecation.** A dormant skill is a
  prompt to ask "still earning its slot?" — the maintainer decides active / sunset.
- **Sunset** is explicit + recorded in the removing commit (cf. `persona-governance`):
  name the successor or the reason; no tombstone files.
- A `last_reviewed:` / human-review field is **deferred until a second maintainer**
  exists (then human review, not commit activity, is the signal worth recording).
  **If that condition ever fires, a sidecar is the precedent, not frontmatter.** A
  review-date field spread across 405 artefacts is diff noise on every unrelated
  edit, and the only review-metadata triple the tree actually ships
  (`registered_at` / `owner` / `review_by` in
  [`recycle-threshold-budget.json`](../src/config/recycle-threshold-budget.json))
  is sidecar-shaped on a single config file.
- **The signal has an instrument.** `build_discovery_manifest.ts` emits
  `dist/discovery/dormancy-report.md` alongside the deprecation, trust and orphan
  reports, from one bounded `git log --since` walk. It is report-only and never a
  gate: a finished artefact and an abandoned one are indistinguishable from commit
  dates, so the false-positive class is not empty. Where history is shorter than
  the window — a shallow clone, which is the CI default — the report **names the
  missing signal and publishes no list**, because an empty list would read as
  "nothing is dormant", a different and false claim.

### Two lifecycle vocabularies, and they are not one field

`lifecycle:` and the skill-only `status:` are distinct fields with distinct
enums, and reading either as the other is a mistake the schemas permit:

| Field | Enum | Declared by |
|---|---|---|
| `lifecycle:` | `active · deprecated · experimental · archived` | 15 of 289 skills |
| `status:` | `active · deprecated · superseded` | 66 of 289 skills |

`lifecycle` carries `"default": "active"` (`skill.schema.json`), so **absent
reads as active** — thin declared coverage is not evidence of an undeclared
estate. Neither field is a runtime lifecycle: both are static declarations, and
before the dormancy report above nothing computed dormancy at all. Reconciling
the two enums is a separate decision and is not taken here; this entry exists so
they stop being read as one field. Counts re-derived 2026-08-11 against
`src/skills/` (289 skills, 116 rules).

## Deferred governance (council-decided, not dropped)

| Item | Why deferred | Lands in |
|---|---|---|
| **Skill ownership map** (maintainer per family) | one maintainer → per-family ownership is ceremony with zero information | when a 2nd maintainer exists; `owner:` would then be a spine column, not a separate CODEOWNERS |
| **`candidate_*` / `overlaps_with`** spine fields | discovery *conclusions*, not metadata | Phase 3 (consolidation scan) |
| **Command `category:` lint — full 125-command categorization** | product-surface judgment; large | Phase 2b / 3 — see [`command-category-governance.md`](contracts/command-category-governance.md) |

## Legacy-path freeze (`.agent-src.uncondensed/`)

The pre-relocation source path `.agent-src.uncondensed/` is dead (ADR-051; source
of truth is `src/`). Existing stale **prose** mentions in `src/` are fixed
**opportunistically** — a large blind sweep was rejected by AI-council
(2026-06-09): the literal is also the *detection subject* of the reference
linters (rewriting it disables them), and historical ADRs are correct as written.

What is enforced instead — the debt cannot **grow**:

```
NO NEW `.agent-src.uncondensed/` REFERENCE MAY BE ADDED UNDER src/.
```

`scripts/check_no_new_legacy_path.py` (CI, PR-scoped via `gh pr diff`) fails on any
**added** line under `src/` containing the literal — except the three files where
it is legitimate forever (`_lib/agent_src.py`'s `LEGACY_SRC`, and the two
`check_*` reference detectors). Existing mentions migrate to `src/` when their
file is touched for another reason. Historical ADRs (`docs/decisions/`) keep their
mentions; `internal/` (glama) + `agents/roadmaps/{archive,skipped}` are out of scope.

## See also

- [`docs/contracts/skill-family-map.yml`](contracts/skill-family-map.yml) — the spine.
- [`skills-taxonomy.md`](skills-taxonomy.md) — the family derivation.
- [`artefact-census.md`](artefact-census.md) — the counted baseline.
- [`command-category-governance.md`](contracts/command-category-governance.md) — the deferred command-category hand-off.
- `persona-governance` rule — the persona-side sibling of the lifecycle policy.
