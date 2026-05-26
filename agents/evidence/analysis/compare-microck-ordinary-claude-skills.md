# Reference analysis: Microck/ordinary-claude-skills

> A 600+ skill aggregator-repo (passive-maintenance, MIT) by a solo
> collector who openly says **"i did not write most of these. i just
> collected them."** It is a re-distribution layer over upstream
> sources (anthropic, ComposioHQ, K-Dense-AI, and others). For us it
> has near-zero direct value as a methodology reference — the
> strategic value is the **markitdown skill it surfaces**, which
> turns out to be a mirror of `K-Dense-AI/claude-scientific-skills`
> wrapping the upstream tool `microsoft/markitdown`. The deeper
> analysis is therefore split: this document covers the
> aggregator-repo question; the markitdown deep-dive lives in
> `compare-microsoft-markitdown.md`.

- **Source:** https://github.com/Microck/ordinary-claude-skills
- **Default branch:** `main`
- **License:** MIT (repo wrapper); per-skill licenses vary
- **Description (self):** "An unappealing collection of Claude
  Skills and resources."
- **Maintenance badge:** `passive` (self-declared in README)
- **Created:** 2025-12-01 · **Updated:** 2026-05-05 (live)
- **Skill count:** "i used to list all 600+ skills here, but it
  made the readme scroll for eternity"
- **Format:** Anthropic-style YAML frontmatter (`name`, `description`)
  + `SKILL.md` + occasional `metadata.json` (author attribution,
  star/fork count, source URL)
- **Distribution model:** clone-and-point — user maps a skill or a
  category folder into their MCP filesystem server, or uploads the
  folder to claude.ai's Custom Skills UI
- **Fetched:** 2026-05-05 (40-fetch budget: 14 used)
- **Analyst:** agent via `/analyze-reference-repo`, autonomy: on,
  council: api (anthropic + openai)

## TL;DR

### What this repo actually is

A **non-curated dump** of skills harvested from elsewhere, sorted into
a `skills_categorized/` tree (backend, web3-tools, etc.) and a flat
`skills_all/` index. The maintainer is open about the model:

> "i dumped everything in here. if it doesnt work i probably havent
> noticed. just let me know and i may or may not fix it."

> "if you own one of these and want me to take it down, just open an
> issue and i will nuke it."

Per-skill `metadata.json` carries the **original author** field and a
star/fork count from the source repo, so attribution is intact even
when the README does not list contributors. Categories: science &
academia, software engineering, infrastructure, data & ai, business,
creative, web3.

### What we get from this repo as a methodology reference

**Almost nothing.** Microck is a republisher; the methodology lives
upstream (anthropic, ComposioHQ, K-Dense-AI, obra/superpowers). We
have already analysed the relevant upstreams in
`compare-anthropics-skills.md` and
`compare-composiohq-awesome-claude-skills.md`. There is no governance,
no linter, no build pipeline, no condensation layer, no portability
checks, no test suite — by design. It is a search-and-clone surface,
not a system.

### Top 3 things to ADOPT

1. **Discover the markitdown skill.** This is the only durable
   takeaway from Microck for us: the aggregator surfaced
   `microsoft/markitdown` as a token-saving tool worth integrating
   ourselves. The Microck wrapper itself is a copy of
   `K-Dense-AI/claude-scientific-skills/scientific-skills/markitdown`
   (per `metadata.json:author = K-Dense-AI`), and the upstream
   *referenced* assets (`scripts/batch_convert.py`,
   `references/document_conversion.md`, etc.) are **not present**
   in the Microck folder. A consumer of Microck cloning the
   `markitdown/` directory gets a SKILL.md that points at files
   that don't exist. Citation: GitHub API listing of
   `Microck/ordinary-claude-skills/contents/skills_all/markitdown/`
   returns exactly two entries — `SKILL.md` and `metadata.json`.
   Decision: deep-dive the upstream
   (`compare-microsoft-markitdown.md`) and ship our own
   senior-tier markitdown skill from first principles.

2. **The metadata.json attribution pattern** — for every skill,
   carry forward `author`, `authorAvatar`, `githubUrl`, `stars`,
   `forks`, `updatedAt`, `path`, `branch`. Cheap to produce, gives
   the consumer a one-glance trust signal. Today our skills carry
   only `name` + `description` + `source` — adding a structured
   provenance block in `agents/settings/contexts/skills-provenance.yml`
   would mirror this without polluting individual SKILL.md files.

3. **Nothing else.** The Microck repo's own contribution stops at
   discovery and aggregation. ADAPT and ADOPT lists are flat.

### Top 3 things to ADAPT

1. **Skill catalog as a static-site browse layer.** Microck ships
   `microck.github.io/ordinary-claude-skills` for search and
   category browse over 600+ entries. Our `agents/settings/contexts/`,
   `agents/roadmaps/`, and skill-tree are markdown-only; a
   consumer cannot browse them without `find` and `grep`. Adapting
   this means a *generated* HTML index from frontmatter, not a
   hand-maintained one. Out of scope for this analysis; capture as
   a discoverability idea for `road-to-distribution-and-adoption.md`
   if the user wants it.

2. **Skill folder as the unit of upload.** Microck's onboarding
   path 1 ("for claude.ai: go to your profile, hit `custom skills`,
   and upload the specific folder for the skill you want") matches
   what `task build-cloud-bundles-all` already produces in our
   repo — but Microck's pitch makes the user-facing flow visible.
   We can sharpen our own README's quickstart with the same two-
   sentence framing.

3. **Nothing else worth adapting.** The non-curated, passive-
   maintenance model is the *opposite* of our governance contract;
   adapting any of it would break our Iron-Law floor.

### Top 3 things we ALREADY do better

1. **Curation and governance.** Microck is explicitly non-curated;
   we have `skill-quality`, `size-enforcement`,
   `rule-type-governance`, `check-portability`, `check-references`,
   `lint-skills`, plus 324+ tests. Microck has zero of these.

2. **Self-contained skill assets.** Our skills either ship the
   referenced files or do not reference them. Microck's markitdown
   skill references `scripts/batch_convert.py` and
   `references/document_conversion.md` that **are not in the
   folder** — a copy-paste-broken skill. Our linter would refuse
   to ship such a skill.

3. **Multi-tool projection.** Our skills land in 7 host agents
   (Augment, Claude Code, Cursor, Cline, Windsurf, Gemini,
   GitHub Copilot) via deterministic generation from one source.
   Microck targets claude.ai + generic MCP filesystem servers
   only — and even that is "point your MCP client at the folder
   and hope".

## Critical lenses

### Lens 1 — Provenance and breakage risk

Microck is a **mirror without a sync mechanism**. The `metadata.json`
records `updatedAt` (a Unix timestamp from the source repo at the
time of harvest) but there is no automation that re-syncs when the
upstream changes. Consequence: a skill with apparent provenance
(`stars: 1609`, `K-Dense-AI`) may be months out of date relative to
its upstream. For a token-savings skill that needs to track the
upstream tool's CLI surface, this is a real hazard. We must take
the upstream as our reference, not the mirror.

### Lens 2 — Maintainer model

> "maintenance: passive — if you own one of these and want me to
> take it down, just open an issue and i will nuke it."

This is honest and low-friction, but it is not a stable layer to
build on. For a *consumer* who needs a skill once, fine. For a
*distribution package* that wants to import patterns, it is too
unstable to vendor. We use Microck as a **discovery surface** only.

### Lens 3 — License posture

Repo wrapper is MIT. Per-skill licenses are inherited from the
upstream and are not centralised. The README says "anthropic
skills: mit license (mostly)" — the "(mostly)" is doing a lot of
work. Any adoption of an individual skill must re-verify the
license at the upstream source, not at the Microck mirror. For our
markitdown work this resolves cleanly: `microsoft/markitdown` is
MIT, our package is MIT, and the K-Dense-AI mirror is also MIT —
checked across all three sources.

### Lens 4 — Structural malice floor

The Microck markitdown SKILL.md is **prompt-only** — no Python,
no shell, no embedded credentials, no network calls in the skill
itself. It teaches the user to install and call the upstream tool.
The malice surface is therefore at the upstream tool layer, not
the skill layer. Pass on the skill text; the surface analysis
moves to `compare-microsoft-markitdown.md`.

## Comparison matrix

Legend: **mc** = Microck/ordinary-claude-skills, **us** = this repo.

| Axis | mc | us | Label | Notes |
|---|---|---|---|---|
| Skill count | 600+ | ~134 | n/a | We don't compete on volume; we compete on depth + governance. |
| Skill format | Anthropic YAML frontmatter | Anthropic YAML frontmatter + senior-tier blocks (Context-First, Related Skills, Loading triggers, Output) | DIVERGE | Our format is a superset; theirs validates as ours minus the senior blocks. |
| Provenance metadata | `metadata.json` with author + stars + source URL | `source` field in frontmatter only | **ADAPT** | Add a project-level provenance index, not per-skill JSON. |
| Linting | none | `skill_linter.py`, `check_portability.py`, `check_references.py`, `readme_linter.py` | OURS WINS | n/a |
| Condensation / authoring split | none | `.agent-src.uncondensed/` → `.agent-src/` | OURS WINS | n/a |
| Multi-tool projection | claude.ai + generic MCP filesystem | 7 host agents via `task generate-tools` | OURS WINS | n/a |
| Test suite | none | 324+ pytest + bash tests | OURS WINS | n/a |
| Maintenance model | passive, solo, "may or may not fix it" | governed, multi-pipeline, CI-gated | DIVERGE | Different goals. |
| Discoverability surface | static site `microck.github.io/...` | repo + AGENTS.md + per-tool injection | **ADAPT** | Optional discoverability roadmap item. |
| Curation | non-curated dump | skill-quality + Iron-Law floor | OURS WINS | n/a |
| markitdown skill | references-only stub, broken paths | (not yet shipped) | **ADOPT-from-upstream** | Build our own from `microsoft/markitdown`, not from Microck's wrapper. |

## Adoption recommendation

**Reject Microck as a methodology reference. Adopt only the
discovery signal it produced — namely, that markitdown is worth
integrating.** All real engineering work for our markitdown skill
sources from `microsoft/markitdown` upstream; the Microck wrapper
is a starting prompt, not a code dependency. Optional follow-up:
add a project-level skill-provenance index (see ADAPT #2) — small,
cheap, gives consumers a trust signal — but only if a future
roadmap-task surfaces it as a discoverability requirement.

The deep-dive on the upstream tool, including the security and
token-savings analysis, lives in
`compare-microsoft-markitdown.md`. The adoption plan, including
phases and acceptance criteria, lives in the sibling roadmap
file (filename per package convention, located alongside the
other Wing-1 roadmaps).

## Fetch budget

14 of 40 fetches used. Remaining budget transferred to the
markitdown deep-dive document.
