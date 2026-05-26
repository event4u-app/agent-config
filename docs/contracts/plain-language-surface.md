---
stability: beta
keep-beta-until: 2026-08-26
roadmap_ref: road-to-frictionless-employee-workspace.md
---

# Plain-Language Surface Contract

> **Status** · v0 / beta · 2026-05-26. Defines the user-facing
> relabel matrix for non-developer audiences. Phase C of
> `road-to-frictionless-employee-workspace.md`. The matrix is the
> single source of truth; lint enforcement lives in
> `scripts/lint_role_experiences.py --plain-language`.

## What this is

A relabel matrix between the package's **technical vocabulary**
(council, trust, packs, orchestration, contracts, advisory, …) and
the **plain-language labels** non-developer audiences (galabau owner,
sales rep, support agent, team leader, content creator, consultant)
expect to read.

The matrix does **not** rename the technical vocabulary in
developer-facing artefacts (`SKILL.md`, rule files, ADRs,
`docs/contracts/`, `docs/decisions/`, `agents/contexts/`, scripts).
The technical vocabulary earned its place there. The matrix only
governs three user-facing surfaces:

1. **Workspace UI strings** (`src/ui/pages/WorkspacePage.tsx` and its
   child components — buttons, headings, tooltips, banner text).
2. **`docs/getting-started-by-role.md`** — the non-developer entry
   surface. Engineering-lead and developer sections keep the
   technical vocabulary.
3. **Role experience `index.md` bodies** (`agents/roles/<slug>/index.md`)
   — the one-paragraph identity + first-task descriptions. The
   `skills.yml` files are link-targets, not user prose, and keep
   the skill IDs verbatim.

## Why

The 9.3/10 feedback round (2026-05-25) caught six jargon terms a
sales rep / galabau owner / support agent does not parse on first
read: `council`, `trust level`, `pack`, `orchestration`, `contract`,
`advisory`. Replacing them in the non-developer surface lifts the
"Daily workspace UX" score from 5.5/10 toward the ≥ 7.5/10 acceptance
gate; the technical vocabulary survives in the developer-facing
artefacts where reviewers, contributors, and agents continue to read
them.

## Matrix

| Technical term | Plain-language label | Applies to surface |
|---|---|---|
| `council` | `second-opinion check` | Workspace UI · role indices · getting-started |
| `trust level` | `reliability score` | Workspace UI · role indices · getting-started |
| `pack` | `ready-made setup` | Workspace UI · role indices · getting-started |
| `orchestration` | `multi-step workflow` | Workspace UI · role indices · getting-started |
| `contract` | `guarantee` | Workspace UI · role indices · getting-started |
| `advisory` | `recommendation` | Workspace UI · role indices · getting-started |

## Carve-outs — surfaces that keep the technical vocabulary

The matrix MUST NOT apply to:

- `.agent-src.uncompressed/`, `.agent-src/`, `.augment/`, `.claude/`,
  `.cursor/`, `.windsurf/`, `.clinerules/` — all skill / rule /
  command / persona artefacts.
- `docs/contracts/`, `docs/decisions/`, `docs/architecture.md`,
  `docs/getting-started-laravel.md`, every other developer-facing
  doc.
- `agents/contexts/`, `agents/roadmaps/`, `scripts/`, source code,
  test fixtures, golden output files.
- The developer / engineering-lead sections inside
  `docs/getting-started-by-role.md` — those readers are the audience
  for the technical vocabulary.
- `agents/roles/<slug>/skills.yml` — the skill IDs are URL slugs,
  not user prose. The `why:` strings stay neutral so the launcher's
  shortlist rail is informative; both audiences read them.

## Lint enforcement

`scripts/lint_role_experiences.py --plain-language` scans every
`agents/roles/<slug>/index.md` body for the six jargon terms.
Frontmatter and fenced code blocks are excluded. Any hit fails the
lint with a pointer back to this contract. Phase C Step 5 wires the
flag into `task ci`.

## Tone scaffold

When a relabel feels awkward, default to the role's own language:
the galabau owner does not call something a "second-opinion check"
verbatim either, but they understand it instantly. Compare:

- **Technical:** "the council ruled this trust level is `community`."
- **Plain:** "the second-opinion check rated this reliability score
  as community-built (less reviewed than core)."

The plain version is longer; that is the cost of readability for
non-developer audiences. Workspace UI strings stay short by carrying
the relabel without the explanation (the explanation lives in the
plain-explain right-rail toggle).

## Re-audit cadence

Re-audit on each of:
- A new jargon term entering the user-facing surface (caught either
  by lint or by a feedback round).
- A role experience adding a section the matrix does not cover.
- A reviewer round (recruit-session) that names a relabel the matrix
  missed.

## See also

- [`docs/getting-started-by-role.md`](../getting-started-by-role.md) — the entry surface.
- [`docs/contracts/role-experience.md`](role-experience.md) — role artefact shape.
- [`scripts/lint_role_experiences.py`](../../scripts/lint_role_experiences.py) — lint enforcement.
- `road-to-frictionless-employee-workspace.md` § Phase C — the roadmap step.
