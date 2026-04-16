---
name: upstream-contribute
description: "Use when a learning, new skill, rule improvement, or bug fix from a consumer project should be contributed back to the shared agent-config package."
source: package
---

# upstream-contribute

## When to use

- New skill/rule created in a project that should be shared
- Rule or skill improvement that benefits all consumers
- Bug found in shared skill, rule, or command
- Override was created locally and should become the new default

Do NOT use for project-specific changes or one-off learnings.

## Goal

Contribute a learning back to `event4u-app/agent-config` — correct file placement, quality gates, PR.

## Package repository

```
git@github.com:event4u-app/agent-config.git
```

GitHub: `https://github.com/event4u-app/agent-config`

## Procedure

### 1. Determine contribution type

| Type | Uncompressed path | Compressed path |
|---|---|---|
| **Skill** | `.augment.uncompressed/skills/{name}/SKILL.md` | `.augment/skills/{name}/SKILL.md` |
| **Rule** | `.augment.uncompressed/rules/{name}.md` | `.augment/rules/{name}.md` |
| **Command** | `.augment.uncompressed/commands/{name}.md` | `.augment/commands/{name}.md` |
| **Guideline** | `.augment.uncompressed/guidelines/{cat}/{name}.md` | `.augment/guidelines/{cat}/{name}.md` |

### 2. Apply locally as override (optional, for immediate benefit)

```
agents/overrides/{type}/{name}.md
```

```yaml
---
overrides: {type}/{name}
mode: replace
---
```

### 3. Get access to package repo

Ask the user:

```
> The improvement should go to the shared agent-config package.
>
> 1. I have the repo cloned — tell me the path
> 2. Clone it for me into /tmp/agent-config-upstream
> 3. I'll handle the PR manually — just give me the files
```

Option 2:

```bash
git clone git@github.com:event4u-app/agent-config.git /tmp/agent-config-upstream
cd /tmp/agent-config-upstream
```

### 4. Create branch and files

```bash
cd {package-repo-path}
git checkout main && git pull
git checkout -b feat/skills/{name}
```

Create BOTH:

- **Uncompressed** → `.augment.uncompressed/{type}/{name}` (verbose, human-readable)
- **Compressed** → `.augment/{type}/{name}` (token-efficient, 40-60% shorter for skills)

Rules and commands: usually copied 1:1.

Frontmatter must have `source: package` (not `project`).

### 5. Quality gates

```bash
task lint-skills                    # 0 FAIL required
task check-compression              # No errors
task generate-tools                 # Regenerate symlinks
task consistency                    # Everything in sync
```

### 6. Commit and PR

Branch: `feat/skills/{name}`, `fix/rules/{name}`, `feat/commands/{name}`

```
feat(skills): add {name} skill
fix(rules): improve {name} rule — {what changed}
```

PR must pass these gates:

- **Promotion** — 2+ occurrences or clearly generalizable
- **Quality** — linter passes, tests pass
- **Universality** — no project-specific assumptions
- **Completeness** — both versions, symlinks regenerated

### 7. After merge — clean up

```bash
rm agents/overrides/{type}/{name}.md
composer update event4u/agent-config  # or npm update
```

## Output format

1. Summary: type, name, why
2. File contents for both versions
3. If in package repo: branch, commit message, PR title
4. If Option 3: copyable file blocks
5. Reminder to clean up override after merge

## Gotcha

- Agent in consumer project doesn't know the package repo URL — this skill provides it
- Agent may try to edit `.augment/` in consumer project — that's read-only (symlinked)
- Agent may forget the compressed version — both are mandatory
- Agent may include project-specific references — must be universal
- `source` in frontmatter must be `package`, not `project`
- Agent may not have git access — Option 3 handles this gracefully

## Do NOT

- Do NOT edit `.augment/` in the consumer project
- Do NOT submit project-specific content as universal
- Do NOT skip the compressed version
- Do NOT forget to clean up override after upstream merge
- Do NOT bypass quality gates
