# event4u/agent-config

**Shared agent configuration** — skills, rules, commands, guidelines, and templates
for AI coding tools (Augment Code, Claude Code, Cursor, Cline, Windsurf, Gemini CLI,
GitHub Copilot).

This file is the AGENTS.md **of the package itself**. It gives an agent that is
working **on this repository** (adding skills, fixing the installer, improving
the linter) the context it needs. Consumer projects get their own AGENTS.md
generated from [`.augment/templates/AGENTS.md`](.augment/templates/AGENTS.md)
when they install the package.

## What this repo is

- A distribution package, not an application.
- `type: library` in `composer.json`; no `app/` directory, no Laravel runtime.
- Published to Composer and npm as `event4u/agent-config` / `@event4u/agent-config`.
- Installed into consumer projects via `scripts/install.sh` (Bash) and
  `scripts/install.py` (Python bridge).

## Source of truth

| Directory | Purpose | Editable? |
|---|---|---|
| `.agent-src.uncompressed/` | Authoring layer — full verbose content | ✅ Yes — edit here |
| `.augment/` | Compressed output — consumed by agents | ❌ No — regenerated |
| `.claude/`, `.cursor/`, `.clinerules/`, `.windsurfrules` | Tool-specific projections | ❌ No — regenerated |
| `agents/` | Package's own roadmaps, contexts, sessions | ✅ Yes |

**Never edit `.augment/` directly.** Edit `.agent-src.uncompressed/` and run
`task sync` (or `task ci`) to compress + regenerate the tool directories.

## Tech stack of this package

- **Bash** — install scripts, compression driver
- **Python 3.10+** — linters (`scripts/skill_linter.py`, `scripts/check_portability.py`,
  `scripts/check_references.py`, `scripts/readme_linter.py`), compression tooling,
  test suite (pytest)
- **Markdown** — all content (skills, rules, commands, guidelines, templates)
- **Taskfile** — developer entrypoints (`task ci`, `task sync`, `task test`)
- **GitHub Actions** — CI workflow under `.github/workflows/`

No PHP, no Laravel, no JavaScript runtime dependencies. The `composer.json` /
`package.json` are thin distribution manifests.

## Working on this repo

```bash
task sync          # Regenerate .augment/ from .agent-src.uncompressed/
task generate-tools # Regenerate .claude/, .cursor/, .clinerules/, .windsurfrules
task test          # pytest tests/ + tests/test_install.sh
task lint-skills   # python3 scripts/skill_linter.py --all
task ci            # Full pipeline — must be green before PR
```

All checks must pass before a PR: sync-check, consistency, check-compression,
check-refs, check-portability, lint-skills, test, lint-readme.

## Key rules for agents editing this repo

| Rule | File |
|---|---|
| `.augment/` must stay project-agnostic — no project names, domains, stacks | [`.augment/rules/augment-portability.md`](.augment/rules/augment-portability.md) |
| Root AGENTS.md + copilot-instructions.md must stay project-agnostic too | [`.augment/rules/augment-portability.md`](.augment/rules/augment-portability.md) |
| Edit `.agent-src.uncompressed/`, never `.augment/` | [`.augment/rules/augment-source-of-truth.md`](.augment/rules/augment-source-of-truth.md) |
| Skills must declare frontmatter, be self-contained, pass the linter | [`.augment/rules/skill-quality.md`](.augment/rules/skill-quality.md) |
| Size budgets for skills, rules, commands | [`.augment/rules/size-enforcement.md`](.augment/rules/size-enforcement.md) |
| Keep `.augment/` / `agents/` cross-refs in sync on add/rename/delete | [`.augment/rules/docs-sync.md`](.augment/rules/docs-sync.md) |

## Repository layout

```
.agent-src.uncompressed/      ← edit here
  skills/       (93 skills)
  rules/        (31 rules)
  commands/     (51 commands)
  guidelines/   (34 guidelines)
  templates/    (AGENTS.md, copilot-instructions.md, skill.md, …)
  contexts/

.augment/                   ← generated, read-only
scripts/                    ← install.sh, install.py, compress.py, linters
tests/                      ← pytest (324 tests) + test_install.sh
agents/                     ← this package's own roadmaps / sessions / contexts
.github/workflows/          ← CI
```

## Multi-agent tool support

`task generate-tools` builds:

| Tool | Output | Strategy |
|---|---|---|
| Augment Code | `.augment/` | Native (source) |
| Claude Code | `.claude/rules/`, `.claude/skills/` | Symlinks + Agent Skills standard |
| Cursor | `.cursor/rules/` | Symlinks |
| Cline | `.clinerules/` | Symlinks |
| Windsurf | `.windsurfrules` | Concatenated file |
| Gemini CLI | `GEMINI.md` | Symlink → AGENTS.md |

Skills follow the [Agent Skills open standard](https://agentskills.io). Commands
are converted to Claude Code Skills with `disable-model-invocation: true`.

## Contributing

1. Edit inside `.agent-src.uncompressed/` or `scripts/` or `tests/` — never in
   `.augment/`, `.claude/`, `.cursor/`, etc.
2. Run `task ci` locally. It must exit 0.
3. Commit in logical chunks with Conventional Commits.
4. Open a PR against `main`.

See [`README.md`](README.md) for the user-facing story, and
[`docs/architecture.md`](docs/architecture.md) for the package architecture.

## License

[MIT](LICENSE).
