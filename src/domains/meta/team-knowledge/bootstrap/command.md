---
model_tier: medium
name: team-knowledge-bootstrap
pack: meta
tier: 2
visibility: internal
cluster: team-knowledge
sub: bootstrap
description: One-shot deterministic seed for a fresh project's knowledge layer — stages template pages from real config/directory detection, never LLM-invented claims. Review-then-commit.
skills: []
suggestion:
  eligible: true
  trigger_description: "bootstrap the knowledge base, seed project knowledge, initialize agents/knowledge, onboard this project's knowledge layer"
  trigger_context: "a project has no agents/knowledge/ typed pages yet and the user wants a starting baseline"
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /team-knowledge bootstrap

Seeds a fresh project's `agents/knowledge/` typed pages from
**deterministic static analysis only** — directory names and known
config filenames, never file content, never an LLM-invented claim.
This is the fast first pass; the deeper analyzers
(`project-analysis-*`, `standards-from-config`, `module-detect-on-the-fly`)
remain the tools for filling in what this script cannot know.

## Steps

### 1. Run the detector

```bash
./scripts-run src/scripts/bootstrap_knowledge
```

Writes 5 template pages to the gitignored `agents/.bootstrap-staging/`
directory — never directly to `agents/knowledge/`:

- `concepts/structure.md` — detected package manifest + top-level
  directories (evidence: the manifest filename / directory name)
- `concepts/standards.md` — WHICH lint/format/test config files exist
  (not their content — run `standards-from-config` for that)
- `concepts/modules.md` — empty seed, `[HUMAN: verify]` (module
  boundaries need code reading, which this script never does)
- `procedures/api-conventions.md` — empty seed, fills in from
  `api_shape_learned` events over time
- `sessions/common-mistakes.md` — empty seed, fills in from
  `mistake_made` events over time

### 2. Review with the user

Present the 5 staged pages. Every inferential line carries
`[HUMAN: verify]` — read them together before committing anything:

```
> Bootstrap staged 5 pages under agents/.bootstrap-staging/:
>
> 1. Review each page now
> 2. Move all as-is into agents/knowledge/
> 3. Move selected pages only
> 4. Discard — start knowledge capture organically instead
```

**Never move a staged page into `agents/knowledge/` without this
review** — a bootstrap page moved in blind defeats the "no invented
claims" guarantee just as surely as inventing the claim directly.

### 3. Move approved pages, regenerate the index

For each approved page:

```bash
mkdir -p agents/knowledge/<type>
mv agents/.bootstrap-staging/<type>/<file>.md agents/knowledge/<type>/<file>.md
```

Then:

```bash
./scripts-run src/scripts/generate_knowledge_index
```

The [team-sharing gate](../../../scripts/check_knowledge_sharing.ts)
still applies at commit time — none of these pages should carry
`visibility: private`.

### 4. Discard the rest

Delete `agents/.bootstrap-staging/` once done (or leave it — it is
gitignored and regenerates on the next bootstrap run).

## Rules

- Never reads file CONTENTS beyond checking whether a known manifest
  filename exists — this is what makes the secret/PII exclusion
  structural rather than a redaction pass that could fail.
- Never runs automatically — one-shot, user-invoked.
- Never writes directly to `agents/knowledge/` — staging is mandatory.
- Do NOT commit the moved pages — that is the user's call.

## See also

- [`/team-knowledge consolidate`](../consolidate/command.md) — the ongoing capture loop this one-shot seed feeds into.
- [`standards-from-config`](../../../skills/standards-from-config/SKILL.md) — the full pointer+digest derivation for coding standards.
- [`project-analysis-core`](../../../skills/project-analysis-core/SKILL.md) / [`module-detect-on-the-fly`](../../../skills/module-detect-on-the-fly/SKILL.md) — the deeper analyzers for `modules.md`.
