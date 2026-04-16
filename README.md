# event4u/agent-config

**A governed AI development layer** — not a prompt collection, but a framework that makes AI coding agents consistent, observable, and safely evolvable across projects.

<p align="center">
  <strong>93 Skills</strong> · <strong>31 Rules</strong> · <strong>51 Commands</strong> · <strong>34 Guidelines</strong> · <strong>6 AI Tools</strong>
</p>

---

## What is this?

Most teams paste prompts into `.cursorrules` or `AGENTS.md` and hope for the best. This package replaces that with a **governed system**:

| Problem | How this package solves it |
|---|---|
| Agents behave differently per tool | One source of truth, synced to 6 tools automatically |
| No visibility into agent quality | Lint scoring, regression detection, quality reports in CI |
| Rules get lost during refactoring | Preservation guards, compression quality checks |
| No learning from mistakes | Feedback-driven improvement pipeline with category tags |
| Config grows into unmaintainable mess | Skills, rules, commands cleanly separated with size limits |
| Different projects, same rules | Shared Composer/npm package with per-project overrides |

### Architecture at a glance

```
.augment.uncompressed/          ← Source of truth (verbose, human-readable)
    ↓ /compress command
.augment/                       ← Compressed output (token-efficient, agent-optimized)
    ↓ install.sh
.claude/ .cursor/ .clinerules/  ← Tool-specific symlinks/copies (auto-generated)
.windsurfrules  GEMINI.md
```

### What's inside

| Layer | Count | Purpose |
|---|---|---|
| **Skills** | 93 | On-demand expertise — Laravel, testing, Docker, API design, security, ... |
| **Rules** | 31 | Always-active constraints — coding standards, scope control, verification |
| **Commands** | 51 | Slash-command workflows — `/commit`, `/create-pr`, `/fix-ci`, `/compress`, ... |
| **Guidelines** | 34 | Coding guidelines by language — PHP patterns, Eloquent, Playwright, ... |
| **Templates** | 7 | Scaffolds for features, roadmaps, contexts, skills, overrides |
| **Contexts** | 5 | Shared knowledge about the system itself |

---

## Supported AI Tools

| Tool | Rules | Skills | Commands | Method |
|---|---|---|---|---|
| **Augment Code** | ✅ | ✅ | ✅ | Native (source of truth) |
| **Claude Code** | ✅ | ✅ | ✅ | Symlinks + Agent Skills standard |
| **Cursor** | ✅ | — | — | Symlinks |
| **Cline** | ✅ | — | — | Symlinks |
| **Windsurf** | ✅ | — | — | Concatenated file |
| **Gemini CLI** | ✅ | — | — | Symlink → AGENTS.md |

Skills follow the [Agent Skills open standard](https://agentskills.io).

---

## Requirements

- **Bash** (for install scripts)
- **Python 3.10+** (for linter, compression, and quality tools)
- [Task](https://taskfile.dev/) (task runner — for development only)

No runtime dependencies — this package provides static configuration files only.

---

## Installation

### Composer (PHP projects)

```bash
composer require --dev event4u/agent-config

# One-time setup: adds post-install/update hooks
bash vendor/event4u/agent-config/scripts/setup.sh
```

After setup, `install.sh` runs automatically on every `composer install` / `composer update`.
The setup script is **idempotent** and auto-detects a JSON tool (`php → node → jq → python3`).

### npm (JavaScript/TypeScript projects)

```bash
npm install @event4u/agent-config
```

The `postinstall` hook runs `scripts/install.sh` automatically.

### Git Submodule

```bash
git submodule add git@github.com:event4u-app/agent-config.git .agent-config
bash .agent-config/scripts/install.sh --target .
```

### Manual

```bash
bash path/to/agent-config/scripts/install.sh --target /path/to/your/project
```

> **Note:** `.augment/` content depends on `composer install` / `npm install` having been executed.
> After a fresh clone, run your package manager before expecting agent tools to work.

---

## How It Works

### Hybrid sync strategy

| Directory | Method | Reason |
|---|---|---|
| `.augment/rules/` | **Copy** | Augment Code cannot load symlinked rules |
| Everything else | **Symlink** | Auto-updates on package update, saves disk |

### What gets created

```
your-project/
├── .augment/
│   ├── rules/          ← copies (Augment Code requirement)
│   ├── skills/         ← symlinks → package
│   ├── commands/       ← symlinks → package
│   ├── guidelines/     ← symlinks → package
│   ├── templates/      ← symlinks → package
│   └── contexts/       ← symlinks → package
├── .claude/
│   ├── rules/          ← symlinks → .augment/rules/
│   └── skills/         ← symlinks → .augment/skills/
├── .cursor/rules/      ← symlinks → .augment/rules/
├── .clinerules/        ← symlinks → .augment/rules/
├── .windsurfrules      ← generated (concatenated rules)
├── GEMINI.md           ← symlink → AGENTS.md
└── AGENTS.md           ← project-specific (copied if missing)
```

### install.sh options

```
bash scripts/install.sh [OPTIONS]

Options:
  --source <dir>   Package source directory (default: auto-detect)
  --target <dir>   Target project root (default: $PROJECT_ROOT or cwd)
  --dry-run        Show what would happen without making changes
  --verbose        Show detailed output
  --quiet          Suppress all output except errors
```

---

## Customization

### Per-project overrides

Projects can override shared skills, rules, and commands without modifying the package:

```
agents/overrides/
├── skills/pest-testing.md    ← extends or replaces shared pest-testing skill
├── rules/php-coding.md       ← project-specific coding rules
└── commands/commit.md         ← custom commit workflow
```

### AGENTS.md

Each project maintains its own `AGENTS.md` with project-specific context (tech stack, setup, testing conventions). The package copies a template on first install — customize it freely.

---

## Observability & Quality

### Linting

Every skill, rule, and command is linted for structure, triggers, validation, and anti-patterns.

```bash
task lint-skills                # Lint all artifacts
task lint-skills-strict         # Warnings count as failures
task lint-skills-report         # Per-file quality breakdown
task lint-skills-regression     # Compare against main (detect regressions)
task lint-skills-pairs          # Check compression quality (source vs compressed)
```

### CI integration

The package includes GitHub Actions workflows:

| Workflow | What it checks |
|---|---|
| **skill-lint** | Lint all changed files, post summary as PR comment |
| **consistency** | Verify sync, compression hashes, generated tool output |

PR comments are collapsible, sticky (updated on re-runs), and include regression reports.

### Compression system

Source files in `.augment.uncompressed/` are compressed for token efficiency:

```bash
task sync-changed              # Show files needing compression
# Use /compress command        # Agent-driven compression with quality gates
task check-compression         # Verify code blocks, headings, frontmatter preserved
```

Compression is governed by quality gates — code blocks, headings, and strong language
must survive byte-for-byte. The `check_compression.py` script enforces this automatically.

---

## Development

### Prerequisites

- [Task](https://taskfile.dev/) (task runner)
- Python 3.10+ (for linter, compression tools)
- Bash (for install scripts, tests)

### Common tasks

```bash
task test                  # Run all tests (bash + Python)
task test-install          # Install script integration tests
task test-python           # Compression and linter tests

task sync                  # Sync .augment.uncompressed/ → .augment/
task generate-tools        # Regenerate .claude/, .cursor/, etc.
task consistency           # Verify everything is in sync
task ci                    # Run all CI checks locally
```

### Editing content

1. **Always edit in `.augment.uncompressed/`** — never in `.augment/` directly
2. Run `task sync` to copy non-`.md` files
3. Use the `/compress` command to compress changed `.md` files
4. Run `task consistency` to verify everything is clean

### Quality checks

```bash
task check-compression     # Code blocks, headings, frontmatter preserved
task check-refs            # No broken cross-references
task check-portability     # No project-specific references in shared files
task quality-report        # Per-artifact-type quality scores
```

---

## Project Structure

```
.augment.uncompressed/     ← Source of truth (human-readable, verbose)
├── rules/                 ← Behavior rules
├── skills/                ← Skill definitions (SKILL.md per skill)
├── commands/              ← Slash command definitions
├── guidelines/            ← Coding guidelines by language
├── templates/             ← Document scaffolds
└── contexts/              ← System knowledge documents

.augment/                  ← Compressed output (token-efficient)
├── (same structure)       ← Compressed .md files + copied non-.md files

scripts/
├── install.sh             ← Installer (hybrid sync to target project)
├── setup.sh               ← One-time Composer hook setup
├── compress.py            ← Compression hash management
├── check_compression.py   ← Compression quality checker
├── skill_linter.py        ← Skill/rule/command linter
├── lint_regression.py     ← Branch regression detection
├── generate_tools.sh      ← Generate tool-specific directories
└── check_references.py    ← Cross-reference validator

tests/
├── test_install.sh        ← Install script integration tests
└── test_skill_linter.py   ← Linter unit tests

.github/workflows/
├── skill-lint.yml         ← Lint + PR comment workflow
└── consistency.yml        ← Sync + hash + tool verification
```
