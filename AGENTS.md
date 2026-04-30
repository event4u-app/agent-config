# event4u/agent-config

**Shared agent configuration** — skills, rules, commands, guidelines, and templates
for AI coding tools (Augment Code, Claude Code, Cursor, Cline, Windsurf, Gemini CLI,
GitHub Copilot).

This file is the AGENTS.md **of the package itself**. It gives an agent that is
working **on this repository** (adding skills, fixing the installer, improving
the linter) the context it needs. Consumer projects get their own AGENTS.md
generated from [`.augment/templates/AGENTS.md`](.agent-src/templates/AGENTS.md)
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
| `.agent-src/` | Compressed output — shipped in the package, consumed by agents | ❌ No — regenerated |
| `.augment/` | Local projection of `.agent-src/` for Augment Code (gitignored) | ❌ No — regenerated |
| `.claude/`, `.cursor/`, `.clinerules/`, `.windsurfrules` | Tool-specific projections | ❌ No — regenerated |
| `agents/` | Package's own roadmaps, contexts, sessions | ✅ Yes |

**Never edit `.agent-src/` or `.augment/` directly.** Edit `.agent-src.uncompressed/`
and run `task sync` (or `task ci`) to compress + regenerate the tool directories.

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
task sync                  # .agent-src.uncompressed/ → .agent-src/, then project → .augment/
task generate-tools        # Regenerate .claude/, .cursor/, .clinerules/, .windsurfrules
task test                  # pytest tests/ + tests/test_install.sh
task lint-skills           # python3 scripts/skill_linter.py --all
task build-cloud-bundles-all  # ZIP every eligible skill → dist/cloud/ (Claude.ai Web / Skills API)
task ci                    # Full pipeline — must be green before PR
```

All checks must pass before a PR: sync-check, consistency, check-compression,
check-refs, check-portability, lint-skills, test, lint-readme.

## Maintainer telemetry (opt-in)

The artefact-engagement telemetry pipeline (`./agent-config telemetry:record`
and `./agent-config telemetry:report`) is **default-off**. Maintainers who
want to measure which skills/rules/commands the agent actually applies set
`telemetry.artifact_engagement.enabled: true` in `.agent-settings.yml`. The
log is local-only JSONL (no upload, no cross-project share) and is bound
by the redaction floor described in
[`agents/contexts/artifact-engagement-flow.md`](agents/contexts/artifact-engagement-flow.md).
The recording rule lives at
[`.agent-src/rules/artifact-engagement-recording.md`](.agent-src/rules/artifact-engagement-recording.md).

## Context-aware command suggestion

When a user's free-form prompt matches a command's purpose, the agent
surfaces matches as a numbered-options block with an always-present
"run the prompt as-is" escape. **Nothing auto-executes** — the user
picks every time. Engine: `scripts/command_suggester/`. Rule:
[`.agent-src/rules/command-suggestion.md`](.agent-src/rules/command-suggestion.md).
Locked eligibility table, scoring contract, and hardening list:
[`agents/contexts/adr-command-suggestion.md`](agents/contexts/adr-command-suggestion.md)
and
[`agents/contexts/command-suggestion-flow.md`](agents/contexts/command-suggestion-flow.md).

## Key rules for agents editing this repo

| Rule | File |
|---|---|
| `.agent-src/` must stay project-agnostic — no project names, domains, stacks | [`augment-portability`](.agent-src/rules/augment-portability.md) |
| Root AGENTS.md + copilot-instructions.md must stay project-agnostic too | [`augment-portability`](.agent-src/rules/augment-portability.md) |
| Edit `.agent-src.uncompressed/`, never `.agent-src/` or `.augment/` | [`augment-source-of-truth`](.agent-src/rules/augment-source-of-truth.md) |
| Skills must declare frontmatter, be self-contained, pass the linter | [`skill-quality`](.agent-src/rules/skill-quality.md) |
| Size budgets for skills, rules, commands | [`size-enforcement`](.agent-src/rules/size-enforcement.md) |
| Keep `.agent-src/` / `agents/` cross-refs in sync on add/rename/delete | [`docs-sync`](.agent-src/rules/docs-sync.md) |
| Creating a new skill/rule/command/guideline runs Understand → Research → Draft | [`artifact-drafting-protocol`](.agent-src/rules/artifact-drafting-protocol.md) |

## Repository layout

```
.agent-src.uncompressed/      ← edit here
  skills/       (125 skills)
  rules/        (51 rules)
  commands/     (75 commands)
  guidelines/   (46 guidelines)
  personas/     (7 personas)
  templates/    (AGENTS.md, copilot-instructions.md, skill.md, …)
  contexts/

.agent-src/                 ← compressed output shipped in the package
.augment/                   ← local projection for Augment Code (gitignored)
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
| Claude.ai Web / Skills API | `dist/cloud/<skill>.zip` | `task build-cloud-bundles-all` (T3-H gated) |

Skills follow the [Agent Skills open standard](https://agentskills.io). Commands
are converted to Claude Code Skills with `disable-model-invocation: true`.
Cloud bundles enforce description budgets and prepend a sandbox note for
T2/T3-S skills — see [`docs/architecture.md`](docs/architecture.md#cloud-bundle-pipeline).

## Contributing

1. Edit inside `.agent-src.uncompressed/` or `scripts/` or `tests/` — never in
   `.agent-src/`, `.augment/`, `.claude/`, `.cursor/`, etc.
2. Run `task ci` locally. It must exit 0.
3. Commit in logical chunks with Conventional Commits.
4. Open a PR against `main`.

See [`README.md`](README.md) for the user-facing story, and
[`docs/architecture.md`](docs/architecture.md) for the package architecture.

## License

[MIT](LICENSE).
