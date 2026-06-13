---
model_tier: medium
name: readme-writing-package
description: "Use when creating or rewriting a README for a reusable package or library. Focus on installability, minimal usage example, compatibility, and developer onboarding."
domain: process
execution:
  type: assisted
  handler: internal
  allowed_tools: []
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# readme-writing-package

## When to use

- Creating a README for a package, library, SDK, or framework extension
- Rewriting a package README after major changes (new API, version bump, new registry)
- Improving a weak package README (missing install, no example, no compatibility info)
- Documenting a package for Packagist, npm, or internal registries

Do NOT use when:

- Documenting a full application, CLI tool, or internal team repo → use `readme-writing` instead
- Only fixing minor typos or updating a single section
- Writing deep reference docs that belong in `/docs`

## Goal

Package README that makes adoption easy. A developer should know within 30 seconds:
what it does, whether it fits their stack, how to install it, and how to use it.

## Core principles

- **User adoption over internal architecture** — consumer first, maintainer second
- **Install + first example = most important sections** — everything else is secondary
- **Compatibility must be explicit** — don't imply broad support without evidence
- **First code example must be real, minimal, and verified** — no pseudo-code
- **README = onboarding, /docs = reference** — keep README focused
- **Re-analyze every time** — never write from cached knowledge; verify the manifest, source, and CI matrix in this session
- **Preserve existing visual identity** — banner, badges, hero images, and logo lockups stay byte-identical unless the user explicitly asks to change them

## Procedure

### 0. Re-analysis gate — MANDATORY before any writing

Before drafting, produce an evidence ledger from a fresh inspection of
the package — manifest, source, CI, examples. Do not rely on prior turns
or the existing README prose.

```
ledger:
  package:       <name + version from manifest>
  description:   <verbatim from manifest>
  install_cmd:   <verified against the manifest's package manager>
  requirements:  <language version, framework version, ext-*, services>
  public_api:    <entry classes / functions / exports from source>
  test_command:  <real command from manifest scripts / Taskfile>
  doc_targets:   <list of /docs files actually linked from the new draft>
  visual_keep:   <line range of existing README header / banner / badges to preserve>
```

If any cell is unknown, run `ls`, `grep`, `find`, or read the file before
writing — never invent. When the user asks to keep the existing banner
or badge row, reproduce it byte-for-byte from the source.

### 1. Identify package type and audience

| Type | Audience | README focus |
|---|---|---|
| **Library** | Any developer | Install → Usage → API surface |
| **Framework extension** | Framework users | Requirements → Install → Register → Use |
| **Plugin** | Plugin host users | Compatibility → Install → Config → Use |
| **SDK** | API consumers | Auth → Install → First request → Response handling |
| **Internal shared package** | Team members | Purpose → Install → Integration → Dev workflow |

### 2. Inspect package truth sources

Read and **verify** files that define actual package behavior (confirm each claim against the source — never paraphrase from memory):

- Manifest: `composer.json`, `package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`, or `*.gemspec` — name, description, requirements, scripts
- Source entrypoints — public API surface, main classes/functions
- Config files — publishable configs, defaults
- CI workflows — what gets tested, supported versions matrix
- Tests — reveal actual API usage patterns
- `CHANGELOG.md` / releases — current state, breaking changes
- Examples directory — if present

Extract: package name, purpose, install command, runtime requirements,
supported versions, public API, setup steps, test/lint commands.

### 3. Choose sections

Priority order for packages:

1. **Title + one-line summary** — always
2. **Why / what problem** — if not obvious from name
3. **Requirements / compatibility** — always (versions, extensions, frameworks)
4. **Installation** — always (exact command, post-install steps)
5. **Minimal usage example** — always (most important section)
6. **Configuration / setup** — if config publish, env vars, or registration needed
7. **More examples / common use cases** — if API has multiple entry points
8. **Development / testing** — for maintainers/contributors
9. **Contributing** — if open or team project
10. **License** — if applicable

Skip sections that have no real content. Never pad.

### 4. Write requirements and compatibility

State only what is tested and supported. Pull the values from the package's manifest, not from memory. Examples per stack:

```
## Requirements (PHP)

- PHP ^8.2
- Laravel 11.x (optional integration)
- ext-json
```

```
## Requirements (JS / TS)

- Node.js >= 20
- TypeScript >= 5.4 (for typed consumers)
- npm / pnpm / yarn / bun
```

```
## Requirements (Python)

- Python >= 3.11
- pip / poetry / uv
- Optional: `fastapi >= 0.110` for the FastAPI integration
```

```
## Requirements (Go)

- Go >= 1.22
```

```
## Requirements (Rust)

- Rust >= 1.78 (stable)
- `cargo` workspace member or standalone crate
```

```
## Requirements (Ruby)

- Ruby >= 3.2
- Bundler >= 2.5
- Optional: Rails 7.1+ for the Rails integration
```

Do NOT imply broad compatibility if only tested in a narrow range.
Include language version, framework version, required extensions, and services.

### 5. Write installation that actually works

Document the exact install command and any required follow-up. Use the
package manager native to the stack — never edit manifests by hand.

```bash
# PHP / Composer
composer require vendor/package
# Optional Laravel integration:
php artisan vendor:publish --tag=package-config
```

```bash
# JS / TS — pick whichever the consumer uses
npm install <package>
pnpm add <package>
yarn add <package>
bun add <package>
```

```bash
# Python
pip install <package>
poetry add <package>
uv add <package>
```

```bash
# Go
go get github.com/<owner>/<package>@latest
```

```bash
# Rust
cargo add <package>
```

```bash
# Ruby
bundle add <package>
# or, for a standalone gem:
gem install <package>
```

Validate each step against the actual codebase.
Include post-install steps (config publish, service / module / provider
registration, env vars, codegen, migrations) if the package requires them.

### 6. Write the minimal working example

**This is the most critical section.** Rules:

- Smallest possible working example — one use case, one result
- Real API calls, not pseudo-code
- Copy-pasteable without hidden setup
- Show expected result or effect if helpful
- Must match the actual package API (verify against source)

Bad: abstract, large, requires unexplained setup.
Good: 5-15 lines, directly relevant, immediately runnable.

### 7. Keep architecture out of README — use reference-split

Move deep content to dedicated docs. Recommended layout for packages:

```
README.md              ← entry: what, why, install, minimal usage
docs/
  installation.md      ← full install matrix, post-install steps
  usage.md             ← extended examples, common patterns
  architecture.md      ← internal design, decisions
  api.md               ← full API reference
  migration.md         ← version upgrade guides
```

For multi-platform install (> 5 variants), prefer a single table with
deep links over stacked inline blocks. For occasionally-needed detail
(long platform quirks, troubleshooting), use `<details>` — never for
install, first example, or requirements.

→ See `docs/guidelines/docs/readme-size-and-splitting.md` for thresholds,
deep-link-table pattern, collapsibles, and anti-patterns (premature
splitting, duplication between README and `/docs/`).

#### Per-AI catalog pattern (multi-platform AI / CLI packages)

For packages that target many AI assistants or platforms (CLI installers,
agent-config tools, language SDKs with 10+ targets), prefer a flat per-AI
catalog over a giant matrix. One line per target, install command on the
left, aligned trailing comment naming the platform:

```bash
npx <package> init --tools=claude-code      # Claude Code
npx <package> init --tools=cursor           # Cursor
npx <package> init --tools=windsurf         # Windsurf
# ... one line per supported target
```

Pair the catalog with a separate "Global install" subsection (same flags
plus `--global`) and an "Other commands" subsection. Reference example:
[`README.md § Pick specific AIs`](../../../README.md#pick-specific-ais) in
this repository — or any well-structured external skill README that
lists per-target install commands in a flat catalog.

Use the catalog when the package's primary install action varies by
platform; use a matrix table (Tool / Rules / Skills / Commands) for
capability comparison. They serve different jobs — install vs. coverage.

README = enough to adopt. Docs = enough to master.

### 8. Validate links and detect orphans — MANDATORY

For every internal link in the new draft:

1. Resolve the path. `test -f` files, `test -d` directories. Strip
   `#anchor` and `?query` before the check.
2. For every anchor link, grep the target for the heading slug.
3. Build the **link-delta** vs. the old README — `kept` / `added` /
   `dropped`. For every `dropped` target, search the rest of the repo
   (`grep -r` over `AGENTS.md`, `docs/`, `dist/agent-src*/`, `packages/`).
   No other reference → mark **orphan-candidate**.

Surface the orphan-candidate list to the user — never delete silently.

### 9. Validate

- [ ] Install command is correct and complete
- [ ] Compatibility/requirements match the manifest (`composer.json`, `package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`, `*.gemspec`) and the CI matrix
- [ ] First example matches real API (verified against source code)
- [ ] All documented commands exist in repo
- [ ] No invented features or capabilities
- [ ] Consumer can get started without reading source code
- [ ] Deep content is in docs, not README (see size guideline)
- [ ] Multi-platform install uses a table, not stacked blocks
- [ ] No duplication between README and `/docs/`
- [ ] **First screen contract** — within ~40 lines: name, one-sentence pitch, install command, requirements (or pointer)
- [ ] Banner / badges / hero from Step 0 visual_keep are byte-identical to source
- [ ] Every internal link resolved per Step 8 — zero broken file or anchor links
- [ ] Orphan-candidate list produced even if empty

## Output format

1. Full README draft
2. Detected package type + audience
3. Compatibility summary
4. **Link delta** — `kept` / `added` / `dropped` with orphan-candidates flagged
5. Evidence ledger (Step 0) so the user can audit assumptions
6. Uncertainties needing confirmation
7. Suggested follow-up docs if README would become too large

## Gotcha

- Model writes package READMEs like app READMEs (too much architecture, not enough install/usage)
- Model tends to invent compatibility claims or setup steps
- First example is often too large, too abstract, or uses pseudo-code
- Model over-explains internals before showing how to use the package
- Existing README may be outdated — verify against the actual manifest (`composer.json`, `package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`, `*.gemspec`) and source, not the old prose
- Model forgets post-install steps (config publish, service / module / provider registration, env vars, codegen, migrations) — list whichever the stack requires

## Frugality Standards

Apply the [Frugality Charter](../../contexts/contracts/frugality-charter.md)
to every package README you author.

**Examples in this artifact:**
- Per the charter's default-terse rule, the package README opens
  with one sentence: what installs, what it does.
- Per the cite-don't-restate principle, link upstream docs for
  advanced topics; ship the minimal usage example only.
- Per the post-action summary suppression, no "What's new" block —
  that belongs in `CHANGELOG.md`.

**Pre-save self-check:**
1. Does the opening pitch include marketing adjectives?
2. Is the minimal usage example over 10 lines when 5 would suffice?
3. Are CI badges shipped without verifying that they resolve?
4. Does the doc duplicate CHANGELOG content?

## Do NOT

- Do NOT invent package capabilities or compatibility
- Do NOT skip the minimal working example
- Do NOT prioritize internal architecture over user onboarding
- Do NOT document commands not present in the repo
- Do NOT hide requirements or version constraints
- Do NOT write a giant example when a 10-line one would do
- Do NOT overload README with reference material — link to /docs
