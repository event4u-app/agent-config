---
name: optimize-augmentignore
description: "/optimize-augmentignore"
disable-model-invocation: true
---

# /optimize-augmentignore

Scan project for token-wasting files → create/update `.augmentignore`. Also exclude irrelevant skills/rules from system prompt.

**Source of truth for skills/rules:** `.augment.uncompressed/` — scan there, not `.augment/`.

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
| `_ide_helper.php` exists | `_ide_helper.php`, `_ide_helper_models.php`, `.phpstorm.meta.php` |
| `public/build/` exists | `public/build/` |
| `storage/` exists (Laravel) | `storage/logs/`, `storage/framework/cache/`, `storage/framework/sessions/`, `storage/framework/views/` |
| `docker-compose.yml` exists | `.storage/`, `.composer/` |
| `.env` exists | `.env`, `.env.*` |

### 2. Find large files polluting the index

```bash
# All files >50KB, excluding already-ignored dirs
find . -type f \( -name "*.php" -o -name "*.md" -o -name "*.json" -o -name "*.yaml" -o -name "*.yml" -o -name "*.xml" -o -name "*.neon" \) \
  ! -path "./vendor/*" ! -path "./node_modules/*" ! -path "./.storage/*" ! -path "./storage/*" \
  ! -path "./.idea/*" ! -path "./.vscode/*" ! -path "./public/build/*" \
  -size +50k -exec wc -c {} + 2>/dev/null | sort -rn | head -30
```

Per file: source code (keep) or generated/fixture (ignore)?

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
| `lang/*/validation.php` | Translation files — huge, static, rarely needed |

### 3. Find duplicate content

```bash
# Duplicate roadmaps or docs across modules
find app/Modules -path "*/agents/roadmaps/*" -exec md5 -r {} \; 2>/dev/null | sort | awk '{print $1}' | uniq -d
```

Identical files → ignore all but one copy.

### 4. Find binary/media files

```bash
find . -maxdepth 3 \( -name "*.png" -o -name "*.jpg" -o -name "*.gif" -o -name "*.svg" -o -name "*.ico" -o -name "*.woff" -o -name "*.woff2" -o -name "*.ttf" -o -name "*.eot" -o -name "*.pdf" \) -not -path "*/vendor/*" -not -path "*/node_modules/*" | head -20
```

Many in specific dirs → add directory pattern.

### 5. Check existing .augmentignore

Exists → preserve custom entries, add missing. Not exists → create.

### 6. Whitelist own packages

From `composer.json` `name` + `repositories` → add `!vendor/{org}/` to keep own packages indexed.

### 7. Cross-reference with .gitignore

`.gitignore` entries → also in `.augmentignore`. Plus: lock files, IDE helpers, OpenAPI specs (tracked but useless for retrieval).

### 8. Analyze irrelevant agent skills

Remove irrelevant skills from system prompt (~3 lines saved per skill per request).

1. `AGENTS.md` → tech stack. 2. `composer.json` → packages. 3. `package.json` → frontend. 4. `ls .augment/skills/` 5. Per skill: relevant?

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

**Conservative:** doubt → keep. Skills used by others/commands → never ignore. Meta skills → never ignore.

**Output format in `.augmentignore`:**

```
# === Irrelevant agent skills (not in project stack) ===
# Re-run /optimize-augmentignore to refresh after stack changes
.augment/skills/react/
.augment/skills/nextjs/
.augment/skills/vue/
```

### 9. Analyze irrelevant agent rules

Remove auto-loaded rules that can't trigger. Only rules with `description` frontmatter. **Never ignore always-active rules.**

| Rule | Ignore when... |
|---|---|
| `e2e-testing.md` | No Playwright / no E2E tests in project |
| `lang-files.md` | No `lang/` directory in project |

Most rules are universal. Only ignore when trigger topic **cannot occur**.

### 10. Check for duplicate rule triggers

```bash
# Find rules with identical description triggers
for f in .augment/rules/*.md; do
  desc=$(head -5 "$f" | grep 'description:' | sed 's/.*"\(.*\)"/\1/')
  [ -n "$desc" ] && echo "$desc | $(basename "$f")"
done | sort | awk -F' \\| ' '{descs[$1]=descs[$1] " " $2} END {for (d in descs) {n=split(descs[d], a, " "); if (n>1) print "⚠️  DUPLICATE: " d " →" descs[d]}}'
```

Same description = both load → fix by making unique.

### 11. Present changes

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

Also count ignored skills/rules and show savings.

## Rules

- Preserve existing custom entries
- Never ignore source code, tests, config, docs
- Lock files + IDE helpers → always ignore
- Doubt on files → ignore (easy to fix)
- Doubt on skills → keep (bad output > wasted 3 lines)
- Never ignore always-active rules or meta skills
- Restore ignored skills when stack changes
