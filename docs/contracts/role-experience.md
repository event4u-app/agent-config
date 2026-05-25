---
stability: beta
keep-beta-until: 2026-08-24
---

# Role-experience contract

**Purpose.** Freeze the on-disk shape of a `role-experience` — the artefact that turns a non-developer persona (galabau owner, content creator, consultant, …) into a first-class entry point with three first tasks, a named prompt library, and a curated skill shortlist. Pins the interface **before** the launcher in Phase 4 reads it, so the launcher and the role authors can move independently.

Last refreshed: 2026-05-24. Roadmap home: `agents/roadmaps/road-to-employee-product-and-external-proof.md` Phase 3.

## What a role experience is

A folder at `agents/roles/<role>/` that contains:

- One **identity index** (`index.md`) — one-paragraph persona, three concrete first tasks, recommended pack list, install-path hint.
- A **prompt library** (`prompts/<name>.md`) — 5–10 named prompts, each a single markdown file with structured frontmatter and a parameterised body the launcher can fill.
- A **skill shortlist** (`skills.yml`) — the existing skills the launcher should surface for this role, in priority order. Cites existing skills only; never duplicates them.

A role experience is **not**:

- A new skill — the shortlist references existing skills under `packages/<pack>/.agent-src.uncompressed/skills/`. The role experience curates; it does not implement.
- A documentation page — `docs/getting-started-by-role.md` is the prose surface and links **to** the role experience, never duplicates it.
- A persona file under `personas/` — personas are review voices the AI Council uses; role experiences are end-user entry points.

## Folder shape

```
agents/roles/<role>/
├── index.md            # identity + three first tasks + recommended packs
├── skills.yml          # skill shortlist (priority-ordered)
└── prompts/
    ├── <name-1>.md
    ├── <name-2>.md
    └── …               # 5–10 prompts
```

`<role>` is a kebab-case identifier; it doubles as the launcher key and the URL slug. Reserved words: `default`, `_template`, `_archive`.

## `index.md` frontmatter (required)

```yaml
---
role: <kebab-case-id>
display_name: "Galabau owner"
tagline: "One-sentence description visible in the launcher rail."
recommended_packs: [core, founder-strategy]   # cites existing packs only
install_path_hint: "MCP recommended (Claude Desktop) · CLI when …"
recruit_session_ref: "agents/recruit-sessions/01-galabau-owner.md"  # nullable until session lands
status: stable | beta | draft
---
```

The body of `index.md` then lists, in this order:

1. **Persona paragraph** (≤ 80 words) — who this role is for, in the role's own language.
2. **Three first tasks** — each a single sentence + the prompt name (`prompts/<name>.md`) that bootstraps it.
3. **Recommended pack list** — referenced from frontmatter, expanded with one-line rationale per pack.

## Prompt frontmatter (required)

Each `prompts/<name>.md` carries:

```yaml
---
name: <kebab-case-id>            # unique within the role's prompts/ folder
intent: "One sentence: what the user gets out of this prompt."
inputs:
  - name: customer_brief
    required: true
    shape: "free-text paragraph"
  - name: tone
    required: false
    shape: "one of [neutral, warm, urgent]"
output_shape: "Markdown — H2 sections, ≤ 600 words, structured offer."
skill_hint: refine-prompt        # which skill the host should foreground; cites existing skill
---
```

The body is the parameterised prompt itself, with `{{input_name}}` placeholders the launcher fills before sending to the host model. Bodies stay ≤ 200 lines; prompts longer than that get split.

## `skills.yml` shape

```yaml
# Priority-ordered. The launcher surfaces the first 5 in its default view; the rest go behind "more".
skills:
  - id: refine-prompt
    why: "Tightens fuzzy customer briefs before any drafting."
  - id: voice-and-tone-design
    why: "Locks the role's voice so emails read consistent across customers."
  - id: doc-coauthoring
    why: "Section-by-section drafting flow for longer offers."
```

Every `id` must resolve to an existing skill under `packages/<pack>/.agent-src.uncompressed/skills/<id>/SKILL.md` — verified by the lint pass in Phase 3 Step 6.

## Versioning + status

- `status: draft` — scaffold only, no recruit-session evidence yet. Launcher hides drafts in the default view.
- `status: beta` — scaffold + at least one recruit session backs the first-task choice. Launcher surfaces with a `beta` badge.
- `status: stable` — at least two recruit sessions concurred on the role's first tasks and the friction-inventory landed at ≤ 3 P0 items.

Status promotion is a maintainer decision, captured in the `recruit_session_ref` frontmatter trail. Demotion (stable → beta) happens when a follow-up recruit session contradicts the existing first-task choice.

## Lint pass (deferred to Phase 3 Step 6)

The lint pass (`task lint-role-experiences`, wired into `task ci`) asserts:

1. Every `agents/roles/<role>/index.md` has all required frontmatter keys + at least 3 first tasks.
2. Every `prompts/<name>.md` has the four required frontmatter keys (`name`, `intent`, `inputs`, `output_shape`) plus `skill_hint`.
3. Every `skills.yml#skills[].id` resolves to an existing skill.
4. Every `recommended_packs[]` entry resolves to an existing pack manifest.
5. Status promotion never happens without a non-null `recruit_session_ref`.

Lint pass code lives at `scripts/lint_role_experiences.py`, ≤ 200 LOC. Until the lint pass ships, the scaffolds in Phase 3 Steps 2–4 are hand-validated against this contract.

## Open questions (Phase 3 optional council pass)

- Per-role default model — should `index.md` carry a `default_model` frontmatter key the launcher honours, or stay at the host's global default? Default in this contract: stay at host default; per-role override is a future ADR.
- Prompt input typing — should `inputs[].shape` be free-text or constrained to a small enum (`text`, `enum`, `file-path`, `url`)? Default: free-text; constraint enum is a future tightening.
- Multi-language prompt bodies — German vs English by role? Default: prompt bodies follow the language policy of the package (English); the host translates at runtime per `language-and-tone`.
