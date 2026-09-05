# Development

## Prerequisites

- [Task](https://taskfile.dev/) (task runner)
- Node.js >= 20.11.0 (the linter, condensation and every gate are TypeScript;
  `no-python-in-src.yml` asserts there is no Python left to install)
- Bash (for install scripts, tests)

## Editing content

1. **Always edit in `src/`** — never in `dist/agent-src/` or `.augment/` directly
2. Run `task sync` to copy non-`.md` files
3. Use the `/condense` command to condense changed `.md` files
4. Run `task ci` to verify everything passes before pushing

---

## Task Commands

All commands use [Task](https://taskfile.dev/). The root `Taskfile.yml` orchestrates
`ci`/`_ci-*` and includes the four task groups under `taskfiles/`
(`ci-fast.yml`, `content.yml`, `engine.yml`, `release.yml`) with `flatten: true`,
so every task stays in the root namespace. Run `task --list` for the full list.

### CI & Verification

```bash
task ci                        # Run ALL CI checks locally (must pass before push)
task consistency               # Verify sync + generated tool outputs are clean
task consistency-fix           # Regenerate all derived outputs from source
```

### Sync & Condensation

```bash
task sync                      # src/ → dist/agent-src/, then project → .augment/
task sync-changed              # List .md files whose projection is out of date
task sync-check                # Check if dist/agent-src/ is in sync (for CI)
```

### Tool Generation

```bash
task generate-tools            # Regenerate .claude/, .cursor/, .clinerules/, .windsurfrules, GEMINI.md
task clean-tools               # Remove all generated tool directories
```

### Testing

```bash
task test                      # Full surface: bash installer tests + the TS suite
task test-ts                   # Vitest only
task test-install              # Install script + orchestrator bash tests
task test-install-local        # Installer against a local checkout
task test-triggers             # Trigger-set checks (offline)
task test-cost-budget          # Cost-budget assertions
npx vitest run <file>          # A single file — stays native, no task wrapper
```

#### CI test matrix

`tests.yml` declares 6 job keys that matrix-expand to 23 jobs, all on
Node 20:

| Job | Expansion |
|---|---|
| `install-tests` | 4 shards × 2 OS |
| `install-aux-tests` | 2 OS |
| `node-tests` | 2 OS × 4 shards (`tests/golden/**` and the workspace suite excluded) |
| `static-checks` | ubuntu only — ESLint, `tsc --noEmit`, prepack |
| `golden-tests` | 2 OS |
| `workspace-tests` | 2 OS |

Both OS legs are `ubuntu-latest` and `macos-latest`. Windows is not in
the matrix — consumers on Windows use WSL2 (see
[installation guide](installation.md#windows)). There is no Python leg:
the toolchain moved to TypeScript, and `no-python-in-src.yml` now asserts
the absence rather than testing versions.

Per-job wall-clock figures and the 5-minute ceiling live in
[`contracts/ci-cost-budget.md`](contracts/ci-cost-budget.md).

#### Spawning a CLI in a test — prefer the in-process runner

Many suites exercise a CLI twin by spawning it (`spawnSync` on
`./scripts-run` or `./agent-config`). Each spawn pays roughly **350 ms of
tsx cold start**, and the cost lands on whichever vitest shard the file
hashes into — vitest shards by file *count*, not duration, so a cluster of
spawning files makes one shard several times slower than its siblings.

`tests/_lib/run_in_process.ts` replaces the spawn with a direct call to the
script's exported `main(argv)`:

```ts
import { runInProc, runInProcAsync, ProcessExit } from '../_lib/run_in_process.js';

const res = runInProc(main, ['--json'], { cwd: tmp, env: { CI: '1' } });
expect(res.status).toBe(0);
expect(res.stdout).toContain('…');
```

It returns `{ status, stdout, stderr }` and handles all three exit styles:
a numeric return from `main`, a `process.exitCode` assignment, and a real
`process.exit(N)` (caught as `ProcessExit`). `RunOpts` covers `cwd`, an
`env` overlay, and `stdin`. It is safe because vitest forks per test file
and runs tests within a file sequentially, so the save/restore of process
globals cannot race.

**Keep spawning where the process boundary is the thing under test.** argv
parsing, exit codes and stdio behaviour are properties of the boundary, not
of `main` — converting every last one deletes that coverage. The rule of
thumb is one spawning test per CLI entry point, in-process for the rest.
The known limitation is module-level mutable state in the imported script,
which is shared across calls; module-level constants are fine.

### Linting

```bash
task lint-skills               # Lint all skills, rules, and commands
task lint-skills-strict        # Lint with warnings as failures
task lint-skills-changed       # Lint only changed files
task lint-skills-report        # Per-file quality breakdown
task lint-skills-regression    # Compare against main branch (detect regressions)
task lint-skills-pairs         # Check condensation quality (source vs condensed)
task lint-readme               # Lint README.md
```

### Quality Checks

```bash
task check-condensation         # Verify code blocks, headings, frontmatter preserved
task check-refs                # No broken cross-references
task check-portability         # No project-specific references in shared files
task quality-report            # Per-artifact-type quality scores
```

### Runtime & Lifecycle

```bash
task runtime-list              # List all runtime-capable skills
task runtime-validate          # Validate runtime registry consistency
task runtime-e2e               # Dispatch each pilot skill (CI gate)
task tool-list                 # List all registered tools
task tool-validate             # Validate tool declarations
```

### Installation

```bash
task install -- --target <dir> # Run the installer orchestrator on a target
task install-hooks             # Install git hooks (pre-commit marketplace lint, pre-push consistency gate, chat-history bridges)
```

The **pre-push hook runs `task consistency`** — the exact local mirror of the CI
"Sync + Generate Tools Consistency" gate (sync-check + sync + generate-tools +
router + corpus + `git diff --quiet`). Any derived-output drift (counts, dist,
generated tool trees) is blocked **before** the push instead of failing remote
CI; the fix is `task consistency-fix`, stage, re-push. The hook auto-installs on
`npm install` in a git clone (the `prepare` script); run `task install-hooks`
manually if you skipped install scripts. Bypass a genuine WIP push with
`git push --no-verify`.

#### One manual install is required, and nothing installs it for you

`npm install` in a git clone runs the `prepare` script, which runs the
installer. **That is the only automatic path.** A clone made with install
scripts skipped, a fresh worktree on a machine that never ran `npm install`, or
a checkout where `.git/hooks` was cleared has **no hooks**, and no gate in this
repository can tell — CI never sees your `.git/`. Run it once:

```bash
task install-hooks
```

#### The installed hooks go stale, and now they say so

The installer WRITES `.git/hooks/*`; it does not link them. Between two runs of
the installer the installed copy drifts from the source that writes it.
Measured on 2026-09-05: the installed `pre-push` in this repository was 146
lines against a 189-line source body, missing the entire base-freshness gate
merged five days earlier — a gate that read as live in the source, in CI, and in
the skill documenting it, and did not exist on the checkout that ran it.

`check_installed_hooks_fresh` closes that. It renders what `install-hooks.sh`
would write into a scratch directory and byte-compares it against what is
installed, so it reports the drift rather than a person noticing it. Two
carriers, both installed by the same installer:

| Carrier | Behavior |
|---|---|
| `pre-push`, after the base-freshness gate | Prints the mismatch. **Advisory — it does not refuse.** Silence it with `AGENT_CONFIG_SKIP_PREPUSH_HOOKFRESH=1`. |
| `post-merge` / `post-checkout` | Prints on stderr at the pull or branch switch that caused the drift. |

**Neither carrier repairs, and neither refuses.** Linked worktrees **share one
`.git/hooks`** through the common dir, so "the installed hooks match the
checked-out tree" has no unique referent: a repair would let one checkout
silently redefine the gates every other worktree runs, and a refusal would fire
on ordinary parallel work until the skip variable became routine. An AI council
(`claude-sonnet-4-5` + `codex-default`, 2026-09-05, three rounds, 2 of 2 seats)
reached both conclusions unanimously. Either returns with a single-referent
design — per-worktree hook isolation via `core.hooksPath`, or a
branch-independent dispatcher installed once in the common dir — see
[`push-closes-its-loop`](../src/skills/git-workflow/references/push-closes-its-loop.md).

The notice deliberately does **not** prescribe a re-install as universally
correct. A mismatch proves difference, never which side is newer: from a
behind-base checkout a re-install writes the OLDER hook set over the shared
directory, and against a sibling worktree it only moves the mismatch. That is
also why it runs AFTER base freshness, which exits first and names the merge.

Both carriers skip themselves when the gate is not runnable on the checkout —
no `node_modules`, no `./scripts-run`, or a branch that predates the gate —
because the shared `.git/hooks` also runs on all of those.

#### Git hooks are maintainer-only — consumers get none

A consumer who installs `@event4u/agent-config` as a dependency receives **no
git hooks**. `src/install/` references `.git/hooks` nowhere, and `prepare` does
not run for a registry dependency. This is a decision, not an oversight: the
pre-push chain runs `task consistency` and `task preflight`, which depend on
this repository's Taskfile, its `./scripts-run` shim and its generated trees —
none of which exist in a consumer project. Shipping hooks on dependency install
would also establish persistent repository execution from a package install,
which is not a thing a dependency should do silently.

Decided 2026-09-05 by AI council (`claude-sonnet-4-5` + `codex-default`, 2 of 2
seats, unanimous). *Revisit-if* a consumer-native gate set is designed with its
own opt-in command and consent step — a separate product feature, not an
extension of this installer.

### Local dev install (no release)

Use these tasks to run the working tree as if it were a published
release — useful for testing changes before `task release` cuts an npm
version.

```bash
task dev:install-global        # Refresh ~/.claude, ~/.cursor, ~/.augment, … from this working tree (--force)
task dev:link                  # Symlink this repo as the global @event4u/agent-config (npm link)
task dev:unlink                # Remove the global symlink
```

**Switch the global install between dev and release** — one-shot toggles
that flip BOTH the `agent-config` bin on PATH and the user-scope content:

```bash
task install:use-dev           # global = THIS working tree (npm link + dev-build content)
task install:use-release       # global = latest npm release (npm i -g @latest + release content)
```

Run `install:use-dev` to test the working tree as the live global install,
then `install:use-release` to switch back to the published version. They are
symmetric — whichever you run last is the active global `agent-config`.

**Typical flow:**

1. In this repo: `task dev:link` — once. The `agent-config` bin on PATH
   now resolves into the working tree.
2. In this repo: `task dev:install-global` — every time you want
   user-scope content (`~/.claude/rules`, `~/.cursor/`, …) refreshed.
3. In a consumer project that uses `@event4u/agent-config` from npm,
   opt in to the linked dev tree:

   ```bash
   cd /path/to/consumer-project
   npm link @event4u/agent-config
   ```

   `npx @event4u/agent-config …` and `node_modules/.bin/agent-config`
   in that project now resolve into the dev tree. Undo with
   `npm unlink @event4u/agent-config` (project) and `task dev:unlink`
   (this repo).

**Caveat — npx outside a linked project:** `npx @event4u/agent-config`
in a directory without a linked `node_modules/@event4u/agent-config`
fetches the published version from the registry. Either run `npm link
@event4u/agent-config` in that project first, or call the global
`agent-config` bin directly (which `task dev:link` puts on PATH).

---

## Project Structure

```
.augment-plugin/               ← Plugin manifest (Augment CLI + Claude Code)
.claude-plugin/                ← Plugin manifest (Claude Code)
.github/plugin/                ← Plugin manifest (Copilot CLI)

setup.sh                       ← Curl-door entrypoint (repo root, public URL)

src/scripts/
├── install                    ← Primary installer (bash orchestrator)
├── install.sh                 ← Payload sync stage (hybrid copy + symlink)
├── install.ts                 ← Bridge files stage (.agent-settings.yml, JSONs);
│                                ships pre-bundled as dist/install/install.mjs
├── install-hooks.sh           ← Git-hook installer (npm `prepare`)
├── check_condensation.ts      ← dist == rewrite(src) byte-exactness gate
├── skill_linter.ts            ← Skill/rule/command linter
├── lint_regression.ts         ← Branch regression detection
├── condense.ts                ← Projection; `--generate-tools` emits the tool trees
├── check_references.ts        ← Cross-reference validator
├── ci_summary.ts              ← GitHub Actions job summary (dispatcher runs)
└── tools/
    ├── base_adapter.ts        ← Tool adapter contract
    ├── github_adapter.ts      ← GitHub API adapter
    └── jira_adapter.ts        ← Jira API adapter

tests/
├── test_install.sh            ← install.sh payload-sync integration tests
├── test_install_orchestrator.sh ← src/scripts/install end-to-end tests
└── scripts/                   ← vitest unit tests, 1:1 with src/scripts/*.ts

.github/workflows/
├── skill-lint.yml             ← Lint + PR comment workflow
└── consistency.yml            ← Sync + tool verification
src/templates/consumer-settings/   ← Settings templates for consumer projects

src/                            ← Source of truth (human-readable, verbose)
├── rules/                     ← Behavior rules
├── skills/                    ← Skill definitions (SKILL.md per skill)
├── domains/                   ← Slash command definitions (per pack)
└── agent-src/                 ← Contexts, templates, profiles, personas, …

dist/agent-src/                    ← Condensed output (token-efficient, shipped)
├── (same structure)           ← Condensed .md + copied non-.md files

.augment/                      ← Local projection for Augment Code (gitignored)
├── rules/                     ← Real file copies (Augment cannot load symlinked rules)
└── skills/, commands/, ...    ← Symlinks → ../dist/agent-src/<sub>
```

---

← [Back to README](../README.md)
