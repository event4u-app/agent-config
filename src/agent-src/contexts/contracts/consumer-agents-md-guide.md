# Consumer `AGENTS.md` — fill-out guide

> Outboard target for the placeholder sections that used to live verbatim
> in the consumer-template `AGENTS.md`. The template is now Thin-Root; this
> guide carries the prose / examples / `<!-- … -->` hints that the
> consumer copies in only when they need them.

After installing `event4u/agent-config`, the consumer project gets:

- `AGENTS.md` at project root — Thin-Root, points here.
- `.augment/`, `dist/agent-src/`, `.claude/`, `.cursor/`, `.clinerules/`,
  `.windsurfrules` — installed artifacts, never hand-edited.
- `agents/` — project docs / roadmaps / sessions / overrides.
- `.agent-settings.yml` — project config consumed by skills.

## Recommended `AGENTS.md` shape

The installed Thin-Root carries: project name + description, layer table,
five-question emergency triage block, pointers to this guide. Copy any of
the sections below into AGENTS.md only when the project actually needs
the content there (e.g. an unusual stack note that no `agents/` doc
covers). Default: leave AGENTS.md thin and put detail under `agents/`.

## Tech-stack section (optional copy-in)

```markdown
## Tech Stack

- **Language:** {{primary_language}}
- **Framework:** {{framework}}        # Laravel 11 / Next.js 15 / Rails 7 / Django 5
- **Database:** {{database}}          # PostgreSQL / MySQL / MariaDB / SQLite
- **Testing:** {{test_framework}}     # Pest / PHPUnit / Jest / Vitest / pytest
- **Code style:** {{code_style_tool}} # ECS / PHPStan / Ruff / ESLint
```

## Development-setup section (optional copy-in)

```markdown
## Development Setup

​```bash
{{dev_start_command}}    # make start / docker compose up / npm run dev / php artisan serve
{{dev_test_command}}     # make test / docker compose exec app bash / npm test / php artisan test
​```

### Environment files

| File | Purpose |
|---|---|
| `.env` | Main environment |
| `.env.local` | Local overrides |
| `.env.testing` | Testing environment |
```

## Project-structure section (optional copy-in)

```markdown
## Project Structure

{{project_structure_notes}}   # Where new features go, module/component
                              # boundaries, namespace conventions.
```

## Testing section (optional copy-in)

```markdown
## Testing

{{testing_notes}}             # Framework quirks, how to run all/targeted
                              # tests, test data strategy (seeders /
                              # factories / fixtures), performance-critical
                              # suites.
```

## Quality-tools section (optional copy-in)

```markdown
## Quality Tools

{{quality_tools_notes}}       # Which linters/formatters run, whether
                              # they auto-fix or report only, CI
                              # enforcement level.
```

## Recommended entry flow

Two entrypoints share the same engine and Option-A loop; pick by input shape:

| You have | Command | Envelope |
|---|---|---|
| Ticket id, URL, or pasted ticket payload | [`/implement-ticket`](.augment/commands/implement-ticket.md) | `input.kind="ticket"` |
| Free-form goal, no ticket | [`/work`](.augment/commands/work.md) | `input.kind="prompt"` |

Both drive the linear flow `refine → memory → analyze → plan → implement
→ test → verify → report` with block-on-ambiguity semantics and no
auto-git.

`/work` adds a confidence-band gate at `refine`: the
[`refine-prompt`](.augment/skills/refine-prompt/SKILL.md) skill scores
the prompt on five dimensions and the engine proceeds **silently** on
`high`, halts with an **assumptions report** on `medium`, or halts with
**one clarifying question** on `low` (per the `ask-when-uncertain` Iron
Law). UI-shaped prompts route through the product UI track (`directive_set`
`ui` / `ui-trivial` / `mixed`) — `audit → design → apply → review →
polish` with a hard audit gate before any `apply`.

Persona comes from `.agent-settings.yml` (`roles.active_role`). Use
`/commit` and `/create-pr` explicitly after the delivery report. The
two flows are mutually exclusive at the state-file level: one
`.work-state.json` carries one envelope at a time; the engine refuses to
switch mid-flight.

## Multi-agent support

| Tool | Rules | Skills | How |
|---|---|---|---|
| **Augment Code** | `.augment/rules/` | `.augment/skills/` | Native (source) |
| **Claude Code** | `.claude/rules/` | `.claude/skills/` | Symlinks + Agent Skills standard |
| **Cursor** | `.cursor/rules/` | — | Symlinks |
| **Cline** | `.clinerules/` | — | Symlinks |
| **Windsurf** | `.windsurfrules` | — | Concatenated file |
| **Gemini CLI** | `GEMINI.md` | — | Symlink → AGENTS.md |

Reinstall agent-config: `composer update event4u/agent-config` (PHP) or
`npm update @event4u/agent-config` (JS). Don't run package-internal
`task` commands from a consumer project; they only work in the
agent-config repo itself.
