# Onboarding — Agent Config Package

Quick-start guide for new team members using this agent configuration package.

## What is this?

A shared package of AI agent instructions (skills, rules, commands, guidelines) that makes
AI coding assistants (Augment, Cursor, Claude Code, Cline, Windsurf, Gemini) work consistently
and effectively across all Galawork projects.

## 3-Step Setup

### 1. Install the package

The package is included as a Git submodule or Composer dependency in each project.
After cloning a project, the `.augment/` directory should already be present.

### 2. Verify setup

```bash
task ci          # Run full CI pipeline locally
task lint-skills # Check skill/rule quality
```

If `task` is not installed: `brew install go-task/tap/go-task`

### 3. Start working

Your AI tool will automatically pick up:
- **Rules** (always-active behavior constraints)
- **Skills** (on-demand expertise, activated by matching your prompt)
- **Commands** (slash-command workflows like `/create-pr`, `/commit`)

## Key Concepts

| Concept | What it does | Location |
|---|---|---|
| Rules | Always-active behavioral constraints | `.augment/rules/` |
| Skills | On-demand expertise (triggered by prompt) | `.augment/skills/` |
| Commands | Workflow automations (`/commit`, `/create-pr`) | `.augment/commands/` (Claude) |
| Guidelines | Reference docs skills link to | `.augment/guidelines/` |

## Most Important Rules

These 5 rules have the highest impact on quality:

1. **think-before-action** — Analyze before coding. No guessing.
2. **verify-before-complete** — Run tests + quality checks before claiming done.
3. **scope-control** — Don't change what wasn't asked. Stay focused.
4. **token-efficiency** — Minimize output, use targeted tools.
5. **skill-quality** — Skills must be self-contained and executable.

## Most Useful Skills

| Skill | When |
|---|---|
| `developer-like-execution` | Any code work (think → analyze → verify → execute) |
| `php-coder` | Writing PHP code following project guidelines |
| `laravel` | Laravel-specific code and patterns |
| `pest-testing` | Writing tests |
| `quality-tools` | Running PHPStan, Rector, ECS |

## How to Run CI

```bash
task ci              # Full pipeline: lint + refs + portability + compression + consistency
task lint-skills     # Skill/rule/command quality only
task check-refs      # Cross-reference integrity
task check-compression # Compression quality
task sync-check      # Source ↔ compressed sync
```

## Editing Rules/Skills

**NEVER edit `.augment/` directly.** The source of truth is `.augment.uncompressed/`.

1. Edit the file in `.augment.uncompressed/`
2. Copy (or compress) to `.augment/`
3. Run `python3 scripts/compress.py --mark-done {path}`
4. Run `python3 scripts/compress.py --generate-tools`
5. Verify: `task ci`

## Where to Find More

| Topic | Document |
|---|---|
| Full infrastructure overview | `.augment/contexts/augment-infrastructure.md` |
| Module system | `app/Modules/README.md` |
| Coding standards | `.github/copilot-instructions.md` |
| Active roadmaps | `agents/roadmaps/` |
| Skill quality rules | `.augment/rules/skill-quality.md` |
