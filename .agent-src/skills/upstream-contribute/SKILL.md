---
name: upstream-contribute
description: "Use when a learning, new skill, rule improvement, or bug fix from a consumer project should be contributed back to the shared agent-config package."
source: package
execution:
  type: assisted
  handler: internal
  allowed_tools: ["github"]
---

# upstream-contribute

## When to use

- A new skill was created in a project that should be shared across all projects
- A rule or skill improvement was discovered that benefits all consumers
- A bug was found in a shared skill, rule, or command
- The `learning-to-rule-or-skill` skill identified something worth upstreaming
- An override was created locally and should become the new default
- A project-specific skill/rule could be **generalized** to benefit all consumers
- The `upstream-proposal` rule suggested a contribution and user agreed

Do NOT use when:

- **The user has NOT given explicit consent** — this is the #1 rule
- The content already exists in the shared package
- The learning is truly one-off and cannot be generalized

## Goal

Contribute a learning, skill, rule, or fix from a consumer project back to the
shared `agent-config` package — with correct file placement, quality gates, and PR structure.

## Core principles

- **⛔ Consent first** — NEVER create a PR, branch, or any upstream action without explicit user approval
- **Universality first** — the contribution must work for ALL consumers, not just one project
- **Generalize when possible** — project-specific content CAN become universal with adaptation
- **Evidence-based** — learnings must have occurred 2+ times or be clearly generalizable
- **Complete pairs** — both uncompressed and compressed versions required
- **Quality verified** — must pass linter before PR creation
- **Local benefit immediately** — use override for instant project benefit while PR is pending

## Package repository

The shared agent-config package lives at:

```
git@github.com:event4u-app/agent-config.git
```

GitHub: `https://github.com/event4u-app/agent-config`

## Procedure

### 0. Mandatory consent gate

**This step is NON-NEGOTIABLE. No exceptions.**

Before ANY upstream work (branch, files, PR), ask the user:

```
> 🔄 This [skill/rule/guideline] could improve the shared agent-config package.
> [Brief explanation of what would be contributed and why it's valuable]
>
> 1. Yes — create an upstream PR
> 2. No — keep it project-local only
```

- **If user picks 2** → STOP. Do not mention upstream again for this item.
- **If user picks 1** → continue with the procedure below.
- **If `project.upstream_repo` is empty in `.agent-settings.yml`** → ask the user to configure it first.
- **NEVER skip this step**, even if the user previously agreed to other contributions.

### 1. Determine contribution type

| Type | Uncompressed path | Compressed path |
|---|---|---|
| **New skill** | `.agent-src.uncompressed/skills/{name}/SKILL.md` | `.augment/skills/{name}/SKILL.md` |
| **New rule** | `.agent-src.uncompressed/rules/{name}.md` | `.augment/rules/{name}.md` |
| **New command** | `.agent-src.uncompressed/commands/{name}.md` | `.augment/commands/{name}.md` |
| **New guideline** | `.agent-src.uncompressed/guidelines/{category}/{name}.md` | `.augment/guidelines/{category}/{name}.md` |
| **Update to existing** | Same path as original | Same path as original |

### 2. Apply locally as override (immediate benefit)

Create an override so the project benefits immediately:

```
agents/overrides/{type}/{name}.md
```

With frontmatter:

```yaml
---
overrides: {type}/{name}
mode: replace  # or extend
---
```

This step is optional if the change is low-urgency.

### 2b. Generalize project-specific content (if needed)

If the content is project-specific but could be made universal:

1. **Identify project-specific parts** — domain names, local paths, project conventions
2. **Abstract them** — replace with generic patterns, configurable values, or examples
3. **Show the user the diff** — original vs. generalized version
4. **Get approval** — user must confirm the generalized version is correct

Example: A project-specific "import-csv" skill → generic "file-import" skill with configurable format.

### 3. Prepare the upstream contribution

The agent needs access to the package repository. Ask the user:

```
> The improvement should go to the shared agent-config package.
> I need to create a PR in `event4u-app/agent-config`.
>
> 1. I have the package repo cloned locally — tell me the path
> 2. Clone it for me into a temp directory
> 3. I'll handle the PR manually — just give me the files
```

**Option 1:** User provides path → work directly in that repo.

**Option 2:** Clone into temp directory:

```bash
git clone git@github.com:event4u-app/agent-config.git /tmp/agent-config-upstream
cd /tmp/agent-config-upstream
```

**Option 3:** Output the file contents as copyable blocks for the user.

### 4. Create branch and files

```bash
cd {package-repo-path}
git checkout main && git pull
git checkout -b feat/skills/{name}  # or fix/rules/{name}, etc.
```

Create both files:

- **Uncompressed version** → `.agent-src.uncompressed/{type}/{name}` (full, verbose, human-readable)
- **Compressed version** → `.augment/{type}/{name}` (token-efficient, preserving all code blocks,
  headings, frontmatter, validation, gotchas)

For skills, the compressed version should be 40-60% shorter than uncompressed.
For rules and commands, they are usually copied 1:1 (no compression).

### 5. Ensure file quality

The files must:

- Have correct YAML frontmatter (`name`, `description`, `source: package`)
- NOT contain project-specific references (no domain names, local paths, FQDNs)
- Follow the skill/rule/command template structure
- Have exactly one trailing newline

### 6. Run quality gates (if working in the package repo)

```bash
python3 scripts/skill_linter.py --all          # 0 FAIL required
python3 scripts/check_compression.py            # No errors for this file
python3 scripts/compress.py --generate-tools    # Regenerate symlinks
bash scripts/compress.sh --check                # .agent-src/ in sync with source
bash scripts/compress.sh --check-hashes         # All hashes match
```

If not in the package repo, note that these checks will run in CI after the PR is created.

### 6b. Proposal gate — MANDATORY when a proposal doc exists

If the contribution originates from a proposal under `agents/proposals/`
(produced by `learning-to-rule-or-skill` via the pipeline in
[`self-improvement-pipeline`](../../guidelines/agent-infra/self-improvement-pipeline.md)),
run the Stage-4 gate before opening the PR:

```bash
./agent-config proposal:check agents/proposals/{slug}.md
```

**Hard refusal rule:** if `check_proposal.py` exits non-zero, STOP —
do not create the branch, do not push, do not open the PR. Surface the
findings to the user, ask them to fix the proposal (add evidence,
remove TODO markers, complete required sections), then rerun.

When no proposal doc exists (small fix, typo, pure bug-fix), skip this
step and document the rationale in the PR body under the Promotion
Gate.

### 7. Commit and create PR

Branch naming: `feat/skills/{name}`, `fix/rules/{name}`, `feat/commands/{name}`

Commit message format:

```
feat(skills): add {name} skill
fix(rules): improve {name} rule — {what changed}
feat(commands): add {name} command
```

PR title: Same as commit message.

PR body must use the package's PR template with these gates:

- **Promotion Gate** — learning occurred 2+ times, improves correctness, prevents real failure
- **Quality Gate** — linter passes, tests pass
- **Universality Gate** — no project-specific assumptions, benefits all consumers
- **Completeness Gate** — both versions present, symlinks regenerated

### 8. After merge — clean up override

Once the PR is merged and the package is updated in the project:

```bash
# In the consumer project
rm agents/overrides/{type}/{name}.md
composer update event4u/agent-config  # or npm update
```

The shared version now replaces the local override.

## Output format

1. Summary of what is being contributed (type, name, why)
2. File contents for both uncompressed and compressed versions
3. If working in the package repo: branch name, commit message, PR title
4. If Option 3: copyable file blocks for the user to paste
5. Reminder to clean up local override after upstream merge

## Gotcha

- Agent in consumer project doesn't know the package repo URL — this skill provides it
- Agent may try to edit `.augment/` in the consumer project — that's read-only (symlinked)
- Agent may forget the compressed version — both are mandatory
- Agent may include project-specific references in the skill — must be universal
- The `source` field in frontmatter must be `package`, not `project`
- Agent may not have git access to the package repo — Option 3 handles this gracefully

## Do NOT

- **Do NOT create any upstream artifact without explicit user consent** — this is the #1 rule
- **Do NOT open a PR if `check_proposal.py` blocks** — fix the proposal first (step 6b)
- Do NOT edit `.augment/` in the consumer project — it's managed by the package
- Do NOT submit project-specific content without generalizing it first
- Do NOT skip the compressed version — both files are mandatory
- Do NOT forget to clean up the local override after upstream merge
- Do NOT bypass quality gates — they exist for a reason
- Do NOT assume consent from a previous contribution — ask every time
