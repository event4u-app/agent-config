---
name: analyze-reference-repo
skills: [project-analyzer, learning-to-rule-or-skill]
description: Analyze an external reference repository (competitor, inspiration, peer) and produce a structured comparison + adoption plan for this project.
disable-model-invocation: true
suggestion:
  eligible: true
  trigger_description: "look at how X does this, compare with that other repo, study this competitor's approach"
  trigger_context: "external repo URL or path mentioned in the prompt"
---

# analyze-reference-repo

Analyze a **different** repository (a competitor, a reference implementation, or a
project the user admires) and produce a structured document that:

- maps what the reference does well,
- compares it against **this** project,
- classifies each finding (adopt / adapt / reject / already-have),
- proposes concrete adoption items,
- optionally generates a roadmap draft for the adopt items.

**Not** for analyzing the current project — use `/project-analyze` for that.
**Not** for importing external skills wholesale — out of scope for this
package; fork the reference repo or maintain the content in your own.

## Inputs

The user provides a repository URL. Accept:

- Full GitHub URL (`https://github.com/owner/repo`)
- `owner/repo` shorthand
- A raw archive URL (zip/tar) for private or mirrored repos

Optional arguments:

- `--focus=<area>` — restrict analysis to one axis (e.g. `installer`,
  `skills`, `mcp`, `governance`, `ci`). Default: full-surface.
- `--no-roadmap` — skip the roadmap-draft step.

## Steps

### 1. Confirm scope

Before touching anything, ask:

> Found reference: `<owner/repo>`.
>
> 1. Full comparison — all axes (default)
> 2. Focused — one axis (I'll ask which)
> 3. Quick scan — README + top-level layout only
> 4. Cancel

Wait for the user's choice.

### 2. Fetch the reference surface

Do **not** clone or execute the target repo. Fetch only:

- `README.md`, `AGENTS.md`, `CHANGELOG.md`, `LICENSE`
- `package.json` / `composer.json` / `pyproject.toml` / `Cargo.toml`
- Top-level file listing (1 level deep)
- One level of key directories: `docs/`, `scripts/`, `commands/`, `skills/`,
  `rules/`, `.github/workflows/`
- Any file the README explicitly points to

Use `web-fetch` for rendered files, GitHub REST
(`/repos/{o}/{r}/contents/{p}`) for listings. **Max 40 fetches** — if more is
needed, ask which subtree to expand.

### 3. Extract structured facts

For each axis, record **one line** of verified fact or "not found":

| Axis | What to capture |
|---|---|
| **Distribution** | How is it installed? (npm global / composer / pip / manual) |
| **Scope** | User-scoped, project-scoped, both? |
| **Skill model** | What is a "skill" here? Folder shape, frontmatter, size? |
| **Rule model** | How are rules triggered? Auto / manual / always-on? |
| **Installer** | One script or many? Idempotent? Uninstall? |
| **Multi-tool** | Which AI tools are supported? How is the output generated? |
| **MCP** | MCP server config generation? Secret handling? |
| **Governance** | Linters? Size limits? Quality gates? |
| **External sources** | Can users add third-party skills? |
| **CI** | Auto-sync? Quality checks? Release automation? |
| **Docs** | README structure, examples, architecture docs |
| **Community** | Contribution docs, maintainers, license, activity |

Reject anything you cannot verify from the fetched files — write "not found"
rather than guess.

### 4. Compare against this project

Add a **this-repo** column per axis. Sources of truth:
`.agent-src.uncompressed/` (skills/rules/commands), `docs/architecture.md`
(stable/experimental), `scripts/` (installer), `.github/workflows/` (CI).
Never invent capabilities — if we don't have it, say so.

### 5. Classify every finding

One label per row:

| Label | Meaning |
|---|---|
| **ADOPT** | Clear win. Implement. |
| **ADAPT** | Good idea, must fit our governance. |
| **REJECT** | Conflicts with our principles. |
| **ALREADY** | We already have it (possibly better). |
| **UNCLEAR** | Needs human judgement — flag. |

ADOPT/ADAPT rows must cite the reference source (file/line/URL).

### 6. Write the analysis document

Target: `agents/analysis/compare-<slug>.md`.
Slug rule: `<owner>-<repo>` lowercased, non-alphanumeric → `-`, collapse runs.

Document structure (copy into the file):

```markdown
# Reference analysis: {owner}/{repo}

> One-sentence framing of why this reference matters.

- **Source:** https://github.com/{owner}/{repo}
- **Fetched commit:** {sha} ({date})
- **Focus:** {full | area}
- **Analyst:** agent via `/analyze-reference-repo`

## TL;DR

- Top 3 things to ADOPT
- Top 3 things to REJECT (and why)
- Top 3 things we ALREADY do better

## Comparison matrix

| Axis | Reference | This repo | Label | Notes |
|---|---|---|---|---|

## Findings

### ADOPT
### ADAPT
### REJECT
### ALREADY
### UNCLEAR

## Proposed roadmap items

{Only if --no-roadmap was not set.}

## Open questions for the maintainer
```

### 7. Offer next steps

After writing the file, present:

> Analysis written to `agents/analysis/compare-{slug}.md`.
>
> 1. Draft roadmap from ADOPT/ADAPT — `agents/roadmaps/adopt-{slug}.md`
> 2. Merge findings into an existing roadmap — say which
> 3. Stop here
> 4. Deep-dive on one axis — say which

Never create the roadmap without explicit confirmation.

## Output location

`agents/analysis/` (create if missing, with `.gitkeep`). Same convention as
`project-analyzer`.

## Safety

- Read-only on the reference. Never clone, execute, or submit PRs to it.
- No credentials in fetches. Public GitHub API is enough. For private mirrors,
  take a PAT via env var and never echo it.
- Max 40 fetches without explicit extension.
- No auto-commits — the analysis is a draft until the user accepts.

## When **not** to use

- Analyzing the current repo → `/project-analyze`.
- Importing external skills wholesale → out of scope; fork or maintain your own.
- Security audit of a dependency → `security-audit` skill.
- Framework migration → `project-analysis-*` skill family.

## Related

- Skill: `project-analyzer` — base analysis workflow.
- Skill: `learning-to-rule-or-skill` — turn adopt items into content.
- Skill: `upstream-contribute` — push learnings back to this package.
- Roadmaps: `agents/roadmaps/` — consumers of findings (e.g. `archive/road-to-anthropic-alignment.md`).
