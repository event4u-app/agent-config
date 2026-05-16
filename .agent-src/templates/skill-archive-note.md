# Skill Archive Note Template

> Template for `agents/archived-skills/<slug>.md`. Created during
> [`step-2-skill-inventory-rationalization.md`](../../agents/roadmaps/step-2-skill-inventory-rationalization.md)
> Phase 4 execution. Every skill removed from
> `.agent-src.uncompressed/skills/` MUST have a matching archive note
> here — enforced by `scripts/lint_archived_skills.py`.

## Instructions

1. Create the file: `agents/archived-skills/{slug}.md`.
2. Copy the template body below and fill every required field.
3. Commit alongside the SKILL.md removal in same PR (linter refuses
   to pass if pair drifts).

## Required frontmatter

```yaml
---
slug: {skill-slug}            # the directory name that was removed
archived_on: 2026-MM-DD        # UTC date of the removal commit
last_seen_count: 0             # mentions_30d at archival time (from skill-usage-report.md)
reason: unused                 # one of: unused, merged, superseded, deprecated
replacement: none              # successor slug, or literal "none" if reason ∈ {unused, deprecated}
last_known_callers:            # YAML list — files / commands / rules that cited this slug
  - "none detected"            # or e.g. ".augment/rules/foo.md", "agents/roadmaps/bar.md"
---
```

## Required body

````markdown
# {skill-slug}

## Why archived

{1–3 sentences. Cite the Phase 2 candidates-table row (overlap pair,
activation counts, or both) that justified removal. Link the row.}

## What replaces it

{If `replacement: <successor>`: one paragraph on how the successor
covers the source's triggers, and which trigger phrases it absorbed.
Link the successor's SKILL.md.}

{If `replacement: none`: one paragraph on why the capability is gone —
no successor needed because the workflow itself was retired / merged
into a router decision tree / handled inline by another rule.}

## Last-known callers

{If `last_known_callers:` is non-empty, one bullet per caller with a
short note on whether the caller was updated, redirected, or left
referencing the archive note. The lint gate fails if a caller still
references the removed slug without pointing at this note.}

## References

- Candidates table row: [`skill-rationalization-candidates.md`](../metrics/skill-rationalization-candidates.md#{anchor})
- Activation baseline: [`skill-usage-report.md`](../metrics/skill-usage-report.md)
- Overlap pair (if applicable): [`skill-overlap.md`](../metrics/skill-overlap.md)
````

## Field semantics

- **`slug`** — must match removed directory name exactly. Linter keys
  on this.
- **`archived_on`** — UTC date string `YYYY-MM-DD`. Used for cohort
  reporting (e.g. "skills archived in May 2026 rationalization").
- **`last_seen_count`** — `mentions_30d` value from activation
  report at moment of archival. `0` is dominant case; non-zero
  values demand extra justification in *Why archived*.
- **`reason`** — exactly one of:
  - `unused` — `mentions_30d == 0` over soak window.
  - `merged` — content folded into another skill; trigger phrases
    transferred.
  - `superseded` — thin-redirect successor exists (`replaced_by`
    relationship documented in successor's frontmatter).
  - `deprecated` — capability retired; no successor needed.
- **`replacement`** — successor slug (must exist under
  `.agent-src.uncompressed/skills/`) or literal `none`. Linter
  validates successor's existence.
- **`last_known_callers`** — references found by
  `scripts/check_references.py` at archival time. Empty list is valid
  only when check truly returned zero hits.

## Lint contract

`scripts/lint_archived_skills.py` enforces:

1. Every file under `agents/archived-skills/*.md` (except README)
   has a frontmatter block with the six required fields.
2. `reason` is one of the four allowed values.
3. When `reason ∈ {merged, superseded}`, the `replacement` slug exists
   under `.agent-src.uncompressed/skills/`.
4. Every slug under `agents/archived-skills/` is *absent* from
   `.agent-src.uncompressed/skills/` (no zombies).
5. No SKILL.md present under `.agent-src.uncompressed/skills/`
   references an archived slug as a router target.

Run via `task lint-archived-skills`. Included in `task ci`.
