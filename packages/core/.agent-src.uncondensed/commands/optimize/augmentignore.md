---
skills: [agent-docs-writing]
name: optimize:augmentignore
tier: 2
cluster: optimize
sub: augmentignore
description: Creates or updates .augmentignore based on the project's actual tech stack, large files, generated artifacts, and irrelevant agent skills/rules.
disable-model-invocation: true
suggestion:
  eligible: false
  rationale: "Niche maintenance tool with no recurring NL trigger."
workspaces:
  - agent-config-maintainer
packs:
  - meta
lifecycle: active
trust:
  level: core
  confidence: high
  human_review_required: false
install:
  default: true
  removable: false
---
<!-- cloud_safe: noop -->

# /optimize augmentignore
Scans the project to find files that waste tokens in Augment's retrieval index
and creates/updates `.augmentignore` accordingly. Also identifies irrelevant
`.augment/skills/` and `.augment/rules/` to exclude them from the system prompt.

**Source of truth for skills/rules:** `.agent-src.uncondensed/` — scan there, not `.agent-src/` or `.augment/`.

## Steps

### 1. Detect tech stack

| Check | What to ignore |
|---|---|
| `composer.json` exists | `vendor/`, `!vendor/{project-org}/` (whitelist own packages), `composer.lock` |
| `package.json` exists | `node_modules/`, `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml` |
| `Cargo.toml` exists | `target/` |
| `go.mod` exists | `go.sum` |
| `.idea/` exists | `.idea/` |
| `.vscode/` exists | `.vscode/` |
| `_ide_helper.php` exists (Laravel `barryvdh/laravel-ide-helper`) | `_ide_helper.php`, `_ide_helper_models.php`, `.phpstorm.meta.php` |
| `public/build/` exists | `public/build/` |
| `storage/` exists AND `artisan` exists (Laravel) | `storage/logs/`, `storage/framework/cache/`, `storage/framework/sessions/`, `storage/framework/views/` |
| `docker-compose.yml` exists | `.storage/`, `.composer/` |
| `.env` exists | `.env`, `.env.*` |
| `pyproject.toml` exists | `__pycache__/`, `*.pyc`, `*.pyo`, `.pytest_cache/`, `.mypy_cache/`, `.ruff_cache/`, `.tox/`, `.nox/`, `dist/`, `build/`, `*.egg-info/` |
| `Pipfile` or `Pipfile.lock` exists | `Pipfile.lock` |
| `poetry.lock` exists | `poetry.lock` |
| `Cargo.toml` exists | `target/`, `Cargo.lock` (binaries only — keep for libraries) |
| `go.mod` exists | `go.sum`, `vendor/` (if `go mod vendor` is used) |
| `Gemfile` exists | `.bundle/`, `vendor/bundle/`, `Gemfile.lock` (apps only — keep for gems) |
| `next.config.js` / `next.config.mjs` / `next.config.ts` exists | `.next/`, `out/` |
| `nuxt.config.ts` / `nuxt.config.js` exists | `.nuxt/`, `.output/` |
| `vite.config.*` exists | `dist/`, `.vite/` |
| `astro.config.*` exists | `.astro/`, `dist/` |
| `svelte.config.*` exists | `.svelte-kit/`, `build/` |
| `tsconfig.json` exists | `*.tsbuildinfo`, `.tscache/` |
| `.terraform/` exists | `.terraform/`, `*.tfstate`, `*.tfstate.backup`, `.terraform.lock.hcl` (debatable — keep if collaborating) |

### 2. Find large files polluting the index

```bash
# All files >50KB, excluding already-ignored dirs
find . -type f \( -name "*.php" -o -name "*.md" -o -name "*.json" -o -name "*.yaml" -o -name "*.yml" -o -name "*.xml" -o -name "*.neon" \) \
  ! -path "./vendor/*" ! -path "./node_modules/*" ! -path "./.storage/*" ! -path "./storage/*" \
  ! -path "./.idea/*" ! -path "./.vscode/*" ! -path "./public/build/*" \
  -size +50k -exec wc -c {} + 2>/dev/null | sort -rn | head -30
```

For each large file, decide: is this **source code** (keep) or **generated/fixture/config** (ignore)?

**Common ignore candidates:**

| Pattern | Reason |
|---|---|
| `phpstan-baseline.neon` | Auto-generated, huge, no code insight |
| `**/Tests/**/stubs/**/*.json` | Test fixture data (often 50KB-500KB per file) |
| `**/Tests/**/stubs/**/*.xml` | Test fixture data |
| `**/Tests/**/Files/**/*.json` | Test fixture data |
| `**/Tests/**/Files/**/*.xml` | Test fixture data |
| `**/Tests/**/snapshots/*.php` | Snapshot test data |
| `**/.docker/**/*.json` | Generated dashboard/config JSONs (Grafana, etc.) |
| `.github/workflows/` | CI YAML — large, rarely relevant for code context |
| `.github/actions/` | CI actions — same reason |
| `lang/*/validation.php` (Laravel) | Translation files — huge, static, rarely needed |
| `locales/**/*.json` (i18next / next-intl / vue-i18n) | Translation bundles — large, mostly static |
| `messages/**/*.{json,po,properties}` (gettext / Java-style) | Same reason |

### 3. Find duplicate content

```bash
# Duplicate roadmaps or docs across modules
find app/Modules -path "*/agents/roadmaps/*" -exec md5 -r {} \; 2>/dev/null | sort | awk '{print $1}' | uniq -d
```

If identical files exist in multiple modules, ignore all but one copy.

### 4. Find binary and media files

```bash
find . -maxdepth 3 \( -name "*.png" -o -name "*.jpg" -o -name "*.gif" -o -name "*.svg" -o -name "*.ico" -o -name "*.woff" -o -name "*.woff2" -o -name "*.ttf" -o -name "*.eot" -o -name "*.pdf" \) -not -path "*/vendor/*" -not -path "*/node_modules/*" | head -20
```

If many exist in specific dirs, add the directory pattern.

### 5. Check existing .augmentignore

- If file exists: read it, preserve custom entries, add missing patterns.
- If file does not exist: create from scratch.

### 6. Whitelist own packages

Detect the project's own organization namespace from whichever manifest is present.
Add a negation pattern after the broad ignore so the agent can still index
first-party packages via `codebase-retrieval`:

| Manifest         | Where the org lives                                         | Negation pattern                          |
|------------------|-------------------------------------------------------------|-------------------------------------------|
| `composer.json`  | `name` (`vendor/pkg`) + `repositories[]` for private repos  | `!vendor/{org}/`                          |
| `package.json`   | `name` (`@scope/pkg`) — derive `@scope`                     | `!node_modules/@{scope}/`                 |
| `pyproject.toml` | `[project].name` + `[tool.poetry].repositories`             | `!**/site-packages/{org}*/` (rare — most Python projects don't vendor) |
| `go.mod`         | `module example.com/{org}/{repo}` — derive `example.com/{org}` | `!vendor/example.com/{org}/` (only if `go mod vendor` is used) |
| `Cargo.toml`     | `[package].name` / workspace members                        | Not applicable — Cargo does not vendor by default; skip |
| `Gemfile`        | Git source URLs pointing to the org                         | `!vendor/bundle/ruby/*/gems/{org-prefix}*/` |

Effect: the broad ignore (`vendor/` / `node_modules/` / `vendor/bundle/`) excludes
thousands of third-party files; the negation keeps first-party packages indexed.

### 7. Cross-reference with .gitignore

Read `.gitignore` — most entries there should also be in `.augmentignore`.
But `.augmentignore` should ALSO include the following — these are typically
tracked in Git (so absent from `.gitignore`) yet useless for the retrieval
index because they are large, generated, or duplicate first-class source:

- Lock files (`composer.lock`, `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, `poetry.lock`, `Pipfile.lock`, `Gemfile.lock`, `go.sum`, `Cargo.lock` for binaries) — tracked but useless for code understanding.
- IDE helpers and codegen artefacts (`_ide_helper.php`, `_ide_helper_models.php`, `.phpstorm.meta.php`, `*.generated.ts`, `*.gen.go`, `__generated__/`) — tracked but huge.
- API contracts that are generated, not authored (`openapi.{yaml,json}` produced by codegen, `schema.graphql` generated from resolvers, `swagger.json`) — keep the source, drop the generated.
- Translation bundles when the project ships them in source control (`lang/`, `locales/`, `i18n/` files larger than ~20 KB).

### 8. Analyze irrelevant agent skills

**Goal:** Remove skills from the `<available_skills>` system prompt list that the project will never use.
Each ignored skill saves ~3 lines of system prompt tokens per request.

**How:**

1. Read `AGENTS.md` — extract tech stack (framework, language, DB, frontend, infra).
2. Read every package manifest present in the project root — extract dependencies:
   - `composer.json` → `require`, `require-dev`
   - `package.json` → `dependencies`, `devDependencies`, `peerDependencies`
   - `pyproject.toml` → `[project].dependencies`, `[tool.poetry.dependencies]`, `[dependency-groups]`
   - `requirements*.txt` / `Pipfile` → package list
   - `go.mod` → `require` blocks
   - `Cargo.toml` → `[dependencies]`, `[dev-dependencies]`, workspace members
   - `Gemfile` → `gem` lines
3. List all skills: `ls .augment/skills/`
4. For each skill, decide: **is this relevant to the detected stack?**

**Decision matrix — ignore when ALL conditions are true:**

| Skill | Ignore when... |
|---|---|
| `project-analysis-react` | No React in package.json |
| `project-analysis-nextjs` | No Next.js in package.json |
| `project-analysis-symfony` | No Symfony in composer.json |
| `project-analysis-zend-laminas` | No Zend/Laminas in composer.json |
| `project-analysis-node-express` | No Express/Node.js backend in project |
| `react`, `nextjs` | No React/Next.js in package.json |
| `vue`, `nuxt` | No Vue/Nuxt in package.json |
| `wordpress` | No WordPress in composer.json |
| `mobile` | No React Native / Swift in project |
| `graphql` | No GraphQL package in composer/npm |
| `cloudflare-workers` | No wrangler.toml, no Cloudflare deps |
| `terraform`, `terragrunt` | No `.tf` files in project |
| `npm`, `npm-packages` | No package.json in project |
| `composer-packages` | Project is an app, not a library (no `type: library` in composer.json) |
| `devcontainer` | No `.devcontainer/` directory |
| `traefik` | No Traefik in docker-compose |
| `microservices` | Single-app monolith (no service mesh config) |

**Conservative approach:**
- When in doubt, **keep** the skill — false negatives are worse than false positives.
- Skills used by other skills or commands should **never** be ignored.
- Meta/agent-system skills (`agent-docs-writing-writing`, `commands`, `context-create`, etc.) are **never** ignored.
- **Always keep** skills matching the detected stack, even if not actively used yet.

**Output format in `.augmentignore`:**

```
# === Irrelevant agent skills (not in project stack) ===
# Re-run /optimize-augmentignore to refresh after stack changes
.augment/skills/react/
.augment/skills/nextjs/
.augment/skills/vue/
```

### 9. Analyze irrelevant agent rules

**Goal:** Remove auto-loaded rules that will never trigger for this project.
Only consider rules with a `description` frontmatter (auto-loaded by topic match).
**Never ignore always-active rules** (no description frontmatter = always loaded).

**Decision matrix:**

| Rule | Ignore when... |
|---|---|
| `lang-files.md` | No `lang/` directory in project |

**Conservative approach:**
- Most rules are universal and should stay.
- Only ignore rules where the trigger topic **cannot occur** in this project.

### 10. Check for duplicate rule triggers

```bash
# Find rules with identical description triggers
for f in .augment/rules/*.md; do
  desc=$(head -5 "$f" | grep 'description:' | sed 's/.*"\(.*\)"/\1/')
  [ -n "$desc" ] && echo "$desc | $(basename "$f")"
done | sort | awk -F' \\| ' '{descs[$1]=descs[$1] " " $2} END {for (d in descs) {n=split(descs[d], a, " "); if (n>1) print "⚠️  DUPLICATE: " d " →" descs[d]}}'
```

If two rules share the **exact same description**, both load simultaneously — wasting tokens.
Fix by making each description unique and specific to that rule's content.

### 11. Present changes to user

Before writing, show the user what will change:

```
## Proposed .augmentignore changes

### New file ignores
- pattern1 — reason
- pattern2 — reason

### Skills to ignore (N skills, ~{N*3} system prompt lines saved per request)
- skill1 — reason
- skill2 — reason

### Skills to restore (previously ignored, now relevant)
- skill3 — reason

### Rules to ignore
- rule1 — reason

> 1. Apply all changes
> 2. Apply file ignores only, skip skill/rule changes
> 3. Let me review — show the full proposed .augmentignore
```

### 12. Write .augmentignore

Organize by category with comments:

```
# === Dependencies ===
# === IDE & Editor ===
# === Generated / Build artifacts ===
# === Lock files ===
# === Static analysis / CI artifacts ===
# === Test stubs / fixtures ===
# === Generated configs (Grafana, CI, etc.) ===
# === Language files (large, static) ===
# === Duplicate content ===
# === Environment files ===
# === OS / system ===
# === Irrelevant agent skills (not in project stack) ===
# === Irrelevant agent rules (not in project stack) ===
```

### 13. Show impact

```bash
# Count lines saved from retrieval index
total=0
while IFS= read -r pattern; do
  [[ "$pattern" =~ ^#|^$ ]] && continue
  count=$(find . -path "*/$pattern" -o -name "$pattern" 2>/dev/null | head -20 | while read f; do
    [ -f "$f" ] && wc -l < "$f" 2>/dev/null
  done | paste -sd+ - | bc 2>/dev/null)
  [ -n "$count" ] && [ "$count" -gt 0 ] && echo "$count lines — $pattern" && total=$((total + count))
done < .augmentignore
echo "Total: ~$total lines excluded from retrieval index"
```

Also count ignored skills and estimate system prompt savings:

```
skills_count=$(grep -c '.augment/skills/' .augmentignore 2>/dev/null || echo 0)
rules_count=$(grep -c '.augment/rules/' .augmentignore 2>/dev/null || echo 0)
echo "Skills ignored: $skills_count (~$((skills_count * 3)) system prompt lines saved per request)"
echo "Rules ignored: $rules_count"
```

## Rules

- **Always preserve** existing custom entries in `.augmentignore`.
- **Never ignore** source code, test files, config files, or documentation.
- **Lock files are always ignored** — they're huge and provide zero code insight.
- **IDE helpers are always ignored** — generated, 20k+ lines, stale quickly.
- **When in doubt, ignore files** — false positive is easy to fix, false negative wastes tokens silently.
- **When in doubt, keep skills** — ignoring a needed skill causes bad output, keeping an unneeded one just wastes ~3 lines.
- **Never ignore always-active rules** — only auto-loaded rules (those with `description` frontmatter) may be ignored.
- **Never ignore meta / agent-system skills** — these are framework-independent and used by every project regardless of stack: `agent-docs-writing`, `agents-md-thin-root`, `check-refs`, `command-routing`, `command-writing`, `condense-memory`, `context-authoring`, `copilot-agents-optimization`, `copilot-config`, `description-assist`, `file-editor`, `guideline-writing`, `learning-to-rule-or-skill`, `lint-skills`, `md-language-check`, `override-management`, `persona-writing`, `project-analyzer`, `project-docs`, `project-health`, `roadmap-writing`, `rule-writing`, `skill-improvement-pipeline`, `skill-management`, `skill-reviewer`, `skill-writing`.
- **Restore previously ignored skills** when the stack changes (e.g., Vue added to project → restore `vue` skill).

## Cloud Behavior

On cloud surfaces (Claude.ai Web, Skills API) this command is **fully inert** —
`.augmentignore` is an Augment-Code-specific retrieval-index config; it has
no equivalent on the cloud surfaces and no file to write. Index pruning is
a local-agent concern.
