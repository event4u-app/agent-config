---
name: upstream-contribute
skills: [upstream-contribute, skill-writing, learning-to-rule-or-skill]
description: Contribute a learning, skill, rule, or fix from a consumer project back to the shared agent-config package
disable-model-invocation: true
---

# /upstream-contribute

## Input

The user may provide:

- A file path to a new or improved skill/rule/command
- A description of what should be contributed
- Nothing (auto-detect from recent work)

## Steps

### 1. Identify what to contribute

If the user provided a file path → read it.
If not → check for recent overrides or new skills:

```bash
ls agents/overrides/ 2>/dev/null
find .augment/skills -name 'SKILL.md' -newer .augment/rules -maxdepth 3 2>/dev/null
git diff --name-only HEAD~5 -- agents/overrides/ .augment/skills/ 2>/dev/null
```

Ask the user to confirm what should be contributed:

```
> Found these candidates for upstream contribution:
>
> 1. {file1} — {brief description}
> 2. {file2} — {brief description}
> 3. Something else — I'll describe it
>
> Which one?
```

### 2. Check universality

Before proceeding, verify the content is package-worthy:

- [ ] No project-specific references (domain names, local paths, FQDNs, project-specific classes)
- [ ] Benefits ALL consumers, not just this project
- [ ] Learning occurred 2+ times OR is clearly generalizable

If project-specific content is found, ask:

```
> ⚠️ Found project-specific references: {examples}
>
> 1. Remove them — make it universal
> 2. Cancel — keep as project-only override
```

### 3. Determine contribution type and target path

| Type | Uncompressed target | Compressed target |
|---|---|---|
| **Skill** | `.agent-src.uncompressed/skills/{name}/SKILL.md` | `.agent-src/skills/{name}/SKILL.md` |
| **Rule** | `.agent-src.uncompressed/rules/{name}.md` | `.agent-src/rules/{name}.md` |
| **Command** | `.agent-src.uncompressed/commands/{name}.md` | `.agent-src/commands/{name}.md` |
| **Guideline** | `.agent-src.uncompressed/guidelines/{cat}/{name}.md` | `.agent-src/guidelines/{cat}/{name}.md` |

### 4. Get access to the package repo

```
> I need to create files in the agent-config package repo.
>
> 1. I have it cloned locally — I'll give you the path
> 2. Clone it for me into /tmp/agent-config-upstream
> 3. Just output the files — I'll handle it manually
```

**Option 1:** User provides path → verify it's the right repo:

```bash
cd {path} && git remote get-url origin
# Must contain event4u-app/agent-config
```

**Option 2:**

```bash
git clone git@github.com:event4u-app/agent-config.git /tmp/agent-config-upstream
cd /tmp/agent-config-upstream
```

**Option 3:** Skip to Step 7 (output files only).

### 5. Create branch and write files

```bash
cd {package-repo}
git checkout main && git pull
git checkout -b {type}/{name}  # e.g. feat/skills/php-container-discovery
```

Write the **uncompressed version** (full, verbose, human-readable).
Write the **compressed version** (token-efficient, 40-60% shorter for skills; 1:1 for rules/commands).

Compressed version MUST preserve:

- All code blocks (byte-for-byte)
- YAML frontmatter (verbatim)
- All headings
- Validation rules, gotchas, "Do NOT" sections

Frontmatter must have `source: package`.

### 6. Run quality gates

```bash
task lint-skills                    # 0 FAIL required
task check-compression              # No 🔴 errors for this file
task generate-tools                 # Regenerate symlinks
task consistency                    # Everything clean
```

Fix any issues before continuing.

### 7. Present result

**If Option 1 or 2** (working in package repo):

```
> ✅ Files created in {package-repo}:
>
> - `.agent-src.uncompressed/{type}/{name}` (uncompressed)
> - `.agent-src/{type}/{name}` (compressed)
>
> Quality gates: {pass/fail summary}
>
> 1. Commit and push — I'll create the PR
> 2. Commit only — I'll push later
> 3. Review the files first
```

**If Option 3** (manual):

Show both file contents in copyable fenced blocks with full paths as headers.

### 8. Create PR (if user chose Option 1 in Step 7)

```bash
git add .
git commit -m "{type}({scope}): add {name}

{brief description of what it does and why it's universal}"
git push -u origin {branch}
```

Create PR via GitHub API with the package's PR template.
Fill in all gates (Promotion, Quality, Universality, Completeness).

### 9. Remind about local override cleanup

```
> 📝 After the PR is merged and you update the package in this project:
>
> ```bash
> rm agents/overrides/{type}/{name}.md
> composer update event4u/agent-config  # or: npm update
> ```
>
> The shared version will then replace your local override.
```
