<!-- evidence-type: analysis -->
<!-- invocation-surface-census: v1 | commit: 98da5a7ae5c95f6413fd0826734134116321ecc2 | commit-date: 2026-09-29T13:46:02+02:00 -->

# Invocation-surface census

Emitted by `src/scripts/report_invocation_surface.ts`. **Read that script’s module
header before reading a number here** — it defines the counting unit, and the unit is
the whole disagreement with the figures this roadmap started from.

**A placeholder occurrence is a token in PROSE** — outside fenced code blocks, indented
code blocks and inline code spans. A skill teaching Terraform contains `${local.x}`; a
skill teaching Playwright contains `${viewport.name}`. Counting those measures how many
skills teach a templating language, not how this package declares invocation.

- **Commit pin:** `98da5a7ae5c95f6413fd0826734134116321ecc2` (2026-09-29T13:46:02+02:00)
- **Corpus:** `dist/agent-src/commands/**/*.md` — 203 command(s); `src/skills/*/SKILL.md` — 299 skill(s)

## Declaration coverage

- Artifacts declaring a structured `inputs:` block: **2** of 502.
- Commands carrying an `argument-hint`: **160** of 203 — 43 carry none.

## Prose placeholder occurrences

| syntax | role | occurrences | files |
|---|---|---|---|
| `${…}` | plurality form | 5 | 2 |
| `<UPPER>` | foreign | 3 | 1 |
| `{{…}}` | foreign | 0 | 0 |

### Which files, and what they actually contain

| file | syntax | n |
|---|---|---|
| `dist/agent-src/commands/agent-status.md` | `${…}` | 4 |
| `dist/agent-src/commands/memory/promote.md` | `${…}` | 1 |
| `src/skills/llm-provider-knowledge/SKILL.md` | `<UPPER>` | 3 |
