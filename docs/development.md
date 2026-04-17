# Development

## Prerequisites

- [Task](https://taskfile.dev/) (task runner)
- Python 3.10+ (for linter, compression tools)
- Bash (for install scripts, tests)

## Editing content

1. **Always edit in `.augment.uncompressed/`** — never in `.augment/` directly
2. Run `task sync` to copy non-`.md` files
3. Use the `/compress` command to compress changed `.md` files
4. Run `task ci` to verify everything passes before pushing

---

## Task Commands

All commands use [Task](https://taskfile.dev/). See `Taskfile.yml` for the full list.

### CI & Verification

```bash
task ci                        # Run ALL CI checks locally (must pass before push)
task consistency               # Verify sync + generated tool outputs are clean
task consistency-fix           # Regenerate all derived outputs from source
```

### Sync & Compression

```bash
task sync                      # Sync non-.md files: .augment.uncompressed/ → .augment/
task sync-changed              # List .md files changed since last compression
task sync-check                # Check if .augment/ is in sync (for CI)
task sync-check-hashes         # Verify compressed .md hashes match source
task sync-mark-done <file>     # Mark a single file as compressed
task sync-mark-all-done        # Mark ALL files as compressed
task sync-clean-hashes         # Remove stale hashes for deleted source files
```

### Tool Generation

```bash
task generate-tools            # Regenerate .claude/, .cursor/, .clinerules/, .windsurfrules, GEMINI.md
task clean-tools               # Remove all generated tool directories
```

### Testing

```bash
task test                      # Run all tests (bash + Python)
task test-install              # Install script integration tests
task test-python               # Compression and linter tests
task test-linter               # Skill linter unit tests
task test-readme-linter        # README linter unit tests
task test-runtime              # Runtime registry + dispatcher tests
task test-tools                # Tool registry + adapter tests
task test-runtime-all          # All runtime, tools, observability, feedback, lifecycle tests
```

### Linting

```bash
task lint-skills               # Lint all skills, rules, and commands
task lint-skills-strict        # Lint with warnings as failures
task lint-skills-changed       # Lint only changed files
task lint-skills-report        # Per-file quality breakdown
task lint-skills-regression    # Compare against main branch (detect regressions)
task lint-skills-pairs         # Check compression quality (source vs compressed)
task lint-readme               # Lint README.md
```

### Quality Checks

```bash
task check-compression         # Verify code blocks, headings, frontmatter preserved
task check-refs                # No broken cross-references
task check-portability         # No project-specific references in shared files
task quality-report            # Per-artifact-type quality scores
```

### Runtime & Lifecycle

```bash
task runtime-list              # List all runtime-capable skills
task runtime-validate          # Validate runtime registry consistency
task runtime-execute -- <skill> # Run a skill through the full pipeline
task tool-list                 # List all registered tools
task tool-validate             # Validate tool declarations
task lifecycle-report          # Skill lifecycle report
task lifecycle-health          # Skill health scores
task report-stdout             # Print health dashboard to stdout
```

### Installation

```bash
task install -- --target <dir> # Run install.sh for a target project
task install-hooks             # Install git hooks (pre-push sync check)
```

---

## Project Structure

```
.augment-plugin/               ← Plugin manifest (Augment CLI + Claude Code)
.claude-plugin/                ← Plugin manifest (Claude Code)
.github/plugin/                ← Plugin manifest (Copilot CLI)

scripts/
├── install.sh                 ← Installer (hybrid sync to target project)
├── setup.sh                   ← One-time Composer hook setup
├── compress.py                ← Compression hash management
├── check_compression.py       ← Compression quality checker
├── skill_linter.py            ← Skill/rule/command linter
├── lint_regression.py         ← Branch regression detection
├── generate_tools.sh          ← Generate tool-specific directories
├── check_references.py        ← Cross-reference validator
├── runtime_pipeline.py        ← E2E execution pipeline
├── runtime_session.py         ← Session + metrics tracking
├── event_schema.py            ← Structured event definitions
├── persistence.py             ← JSON persistence layer
├── report_generator.py        ← CLI health/metrics reports
├── ci_summary.py              ← GitHub Actions job summary
├── feedback_governance.py     ← Feedback → governance proposals
└── tools/
    ├── base_adapter.py        ← Tool adapter contract
    ├── github_adapter.py      ← GitHub API adapter
    └── jira_adapter.py        ← Jira API adapter

tests/
├── test_install.sh            ← Install script integration tests
├── test_skill_linter.py       ← Linter unit tests
├── test_runtime_pipeline.py   ← Pipeline integration tests
├── test_persistence.py        ← Persistence layer tests
├── test_report_generator.py   ← Report generation tests
└── test_ci_and_governance.py  ← CI summary + governance tests

.github/workflows/
├── skill-lint.yml             ← Lint + PR comment workflow
└── consistency.yml            ← Sync + hash + tool verification
templates/consumer-settings/   ← Settings templates for consumer projects

.augment.uncompressed/         ← Source of truth (human-readable, verbose)
├── rules/                     ← Behavior rules
├── skills/                    ← Skill definitions (SKILL.md per skill)
├── commands/                  ← Slash command definitions
├── guidelines/                ← Coding guidelines by language
├── templates/                 ← Document scaffolds
└── contexts/                  ← System knowledge documents

.augment/                      ← Compressed output (token-efficient)
├── (same structure)           ← Compressed .md + copied non-.md files
```
