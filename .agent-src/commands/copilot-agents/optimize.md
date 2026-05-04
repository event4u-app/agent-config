---
name: copilot-agents:optimize
cluster: copilot-agents
sub: optimize
description: Analyzes and refactors AGENTS.md and copilot-instructions.md — removes duplications, enforces line budgets, and ensures both files are optimized for their audience.
skills: [copilot-agents-optimization, copilot-config, agent-docs-writing]
disable-model-invocation: true
suggestion:
  eligible: false
  rationale: "Maintenance refactor; only when the maintainer chooses to run it."
---

# /copilot-agents optimize
Analyzes and refactors `AGENTS.md` and `.github/copilot-instructions.md` against the `.augment/` ecosystem.

## Steps

### 1. Measure current state

```bash
wc -l AGENTS.md .github/copilot-instructions.md
```

Report line counts with budget status:

| File | Lines | Budget | Status |
|---|---|---|---|
| `AGENTS.md` | {n} | ≤ 500 ideal, max 1000 | 🟢/🟡/🔴 |
| `copilot-instructions.md` | {n} | ≤ 500 ideal, max 1000 | 🟢/🟡/🔴 |

### 2. Scan for duplications

Read both files and compare against `.augment/` content:

**Check against rules:**
```bash
ls .augment/rules/*.md
```
For each rule, check if AGENTS.md or copilot-instructions.md duplicates its content.

**Check against guidelines:**
```bash
find .augment/guidelines/ -name '*.md'
```
For each guideline, check if either file repeats the same conventions.

**Check against skills:**
```bash
ls .augment/skills/*/SKILL.md
```
For each skill, check if either file contains domain knowledge that belongs in the skill.

**Check between the two files:**
Compare sections — anything duplicated between AGENTS.md and copilot-instructions.md
that isn't required for Copilot's self-containment.

### 2.5. Scan for legacy identifiers and stack mismatches

Before deduplicating, verify the content still **applies to the current
project**. Files drift in three ways:

- **Legacy leakage** — identifiers from a former, forked, or adjacent
  project (renamed repo, split monorepo, content copied from a sibling).
- **Stack mismatch** — the file claims tech the project no longer uses
  (e.g. "Laravel 11 + MariaDB" in a repo that is now a pure Python
  library).
- **Dead commands** — Make targets, Artisan commands, docker services
  that no longer exist.

**A. Legacy-identifier scan**

Use the package's portability blocklist as the baseline:

```bash
python3 -c "import sys; sys.path.insert(0, 'scripts'); \
  from check_portability import FORBIDDEN_IDENTIFIERS; \
  [print(i) for i in FORBIDDEN_IDENTIFIERS]" 2>/dev/null
```

Plus any identifier from `agents/` module docs that does NOT match the
current project name (see step 2.5.B to determine the current project).

For each identifier, grep both files and report **every** hit:

```bash
for ident in "${forbidden_identifiers[@]}"; do
  grep -n -iE "\b${ident}\b" AGENTS.md .github/copilot-instructions.md
done
```

Every hit is a 🔴 **blocker** — these must be fixed or removed before any
other optimization. Leaking another project's name into the consumer's
own docs is the failure mode that made this step exist.

**B. Stack-coherence scan**

Auto-detect the real stack (same logic as `/copilot-agents-init` step 2):

| Source file | Signal |
|---|---|
| `composer.json` | PHP, Laravel/Symfony, package name, PHP version |
| `package.json` | Node, Next.js/React/Vue, engines |
| `pyproject.toml` / `requirements.txt` | Python + framework |
| `Gemfile` | Ruby on Rails |
| `go.mod`, `Cargo.toml`, `pom.xml`, `build.gradle` | Language |
| `docker-compose.yml` | Service names actually used |
| `Makefile` / `Taskfile.yml` / `package.json` scripts | Dev commands |

Compare each claim in AGENTS.md / copilot-instructions.md against the
detected stack. Flag mismatches:

| Claim in doc | Reality | Severity |
|---|---|---|
| "Laravel 11" | no `laravel/framework` in composer.json | 🔴 |
| "MariaDB" | no DB driver or docker service | 🟡 |
| service name `db` | `docker-compose.yml` has `mariadb` only | 🟡 |
| `make start` | `Makefile` absent OR target missing | 🔴 |
| "PHP 8.2" | `composer.json` requires `^8.1` | 🟡 |

**C. Dead-command scan**

Extract every invoked command from both files:

```bash
grep -oE '(make|task|composer|npm|pnpm|yarn|php artisan|python|./)[a-zA-Z0-9 _:./-]+' \
  AGENTS.md .github/copilot-instructions.md | sort -u
```

For each hit, verify it exists:

- `make X` → `grep -q "^${X}:" Makefile`
- `task X` → `task --list-all` contains X
- `composer X` → `composer.json` `scripts` contains X
- `php artisan X` → `php artisan list --no-ansi` contains X (skip if no
  container — just note "unverified")
- `npm/pnpm/yarn X` → `package.json` `scripts` contains X

Commands that no longer resolve are 🟡 stale — propose a replacement or
removal.

### 3. Present findings

Show a table of issues found, **grouped by severity**. Blockers from
step 2.5 come first:

| # | File | Section | Issue | Severity | Action |
|---|---|---|---|---|---|
| 1 | AGENTS.md | "Quick Setup" | Mentions a forbidden identifier from the blocklist | 🔴 | Replace or remove |
| 2 | copilot | "Tech stack" | Claims Laravel 11, project is Python | 🔴 | Full rewrite |
| 3 | AGENTS.md | "Commands" | `make start` target not in Makefile | 🟡 | Update or remove |
| 4 | AGENTS.md | "Coding Standards" | Duplicates `.augment/rules/php-coding.md` | 🟢 | Remove, add reference |
| 5 | copilot | "SOLID Principles" | Duplicates `.augment/rules/architecture.md` | 🟢 | Keep (Copilot needs it) |
| 6 | copilot | "Trailing commas" | Auto-enforced by ECS | 🟢 | Remove |

Classify each issue:

| Action | Meaning |
|---|---|
| **Replace** | Legacy identifier → swap for the correct current name |
| **Rewrite** | Entire section no longer matches reality — rewrite from stack detection |
| **Remove** | Content exists in `.augment/` and the file can reference it, or command is dead |
| **Keep** | Content is needed self-contained (copilot-instructions.md) |
| **Compress** | Content is valid but too verbose — shorten |
| **Extract** | Move to a dedicated file in `agents/` and link |
| **Update** | Content is outdated or references have changed |

If the 🔴 blockers exceed a reasonable rewrite effort (e.g. the entire
"Tech stack" and "Commands" sections are wrong), offer
`/copilot-agents-init` as an alternative instead of patching in place:

> ⚠️ Detected severe drift: {N} blockers, including a completely wrong
> tech stack.
>
> 1. Continue optimizing (patch in place — may require large rewrites)
> 2. Back up current files and run `/copilot-agents-init` for a clean scaffold
> 3. Abort

### 4. Ask for confirmation

> Found {n} optimizations:
> - {x} duplicates to remove (AGENTS.md)
> - {y} sections to compress
> - {z} sections to extract to `agents/`
>
> 1. Apply all changes
> 2. Confirm each change individually
> 3. Only optimize AGENTS.md
> 4. Only optimize copilot-instructions.md

### 5. Apply changes

For each approved change:

1. **Remove duplicates** — Delete the section, add a reference line if needed
2. **Compress** — Rewrite verbose sections as concise tables/bullets
3. **Extract** — Create file in `agents/`, move content, add link in original
4. **Update** — Fix outdated references, paths, or descriptions

After each file is modified, verify:
- Line count is within budget
- No broken references
- Self-containment preserved for copilot-instructions.md

### 6. Verify cross-references

Check that all references in both files are valid:

```bash
# Find all markdown links in both files
grep -oE '\[.*\]\(.*\)' AGENTS.md .github/copilot-instructions.md
```

For each link, verify the target file exists.

### 7. Report results

> ✅  Optimization complete:
>
> | File | Before | After | Δ |
> |---|---|---|---|
> | `AGENTS.md` | {old} lines | {new} lines | -{diff} |
> | `copilot-instructions.md` | {old} lines | {new} lines | -{diff} |
>
> **Removed duplicates:** {n}
> **Compressed sections:** {n}
> **Extracted content:** {n} (to `agents/`)

### 8. Suggest follow-ups

If issues were found that need manual attention:

> ⚠️ Manual review recommended:
> - {issue description}

If `.augment/` content is missing that both files reference:

> 💡 Missing `.augment/` content:
> - {missing skill/rule/guideline}

## Rules

- **Step 2.5 is mandatory.** Never skip the portability + stack scan —
  that is the step that catches the "legacy identifier from another
  project" failure mode. Duplication cleanup without this scan means the
  command approves stale, wrong content.
- **🔴 blockers are fixed first.** Don't deduplicate a section that is
  about to be rewritten anyway.
- **NEVER strip strong language** — "Do NOT", "NEVER", "MUST" are load-bearing words.
  See the Iron Laws in `/optimize-agents` — they apply here too.
- **NEVER remove examples** from `copilot-instructions.md` — Copilot Code Review cannot
  read other files, so examples must be self-contained.
- **`copilot-instructions.md` MUST remain self-contained** — it cannot reference `.augment/`
  files because Copilot Code Review has no access to them. Only Copilot Chat can read other files.
- **`AGENTS.md` MAY reference `.augment/`** — it is read by tools that can follow links.
- **Ask before removing** — present findings first, apply after approval.
