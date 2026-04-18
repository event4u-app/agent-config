---
name: skill-improvement-pipeline
description: "ONLY when user explicitly requests: run the skill improvement pipeline after a learning was detected. Orchestrates capture, classify, create, validate, and apply."
source: package
execution:
  type: assisted
  handler: internal
  allowed_tools: []
---

# skill-improvement-pipeline

## When to use

- Triggered by the `skill-improvement-trigger` rule when user picks "Capture & improve"
- Manually when user says "run the improvement pipeline" or "capture this learning"

Do NOT use for:
- Regular skill creation (use `skill-writing`)
- Regular skill editing (use `skill-management`)
- One-off fixes that don't represent a pattern

## Procedure: Run the improvement pipeline

### Step 1: Capture

Use the `learning-to-rule-or-skill` skill to extract 1–3 concrete learnings from the completed task.

Each learning must be:
- **Specific** — not "be more careful" but "always check X before Y"
- **Actionable** — can be turned into a rule constraint or skill step
- **Observable** — you can tell when it's followed or violated

### Step 2: Promotion Gate

For each learning, apply ALL of these checks. ALL must be YES to promote:

| Check | Question |
|---|---|
| Repeated? | Has this pattern occurred 2+ times, or is it clearly generalizable? |
| Prevents failure? | Does it prevent a real observed failure or mistake? |
| Not covered? | Is there NO existing rule or skill that already covers this? |
| Actionable? | Is it a concrete constraint or workflow step (not vague advice)? |

| Result | Action |
|---|---|
| All YES | **Promote** — continue to Step 3 |
| One-off, never seen before | **Reject** — do nothing |
| Seen once, but generalizable | **Note** — use `remember` tool, act on second occurrence |
| Already covered | **Update existing** — skip to Step 4 with the existing skill/rule |
| Vague | **Reject** — not actionable |

Show the user:
```
> Learning: "{summary}"
> Category: {category-tag}
> Repeated: {yes/no} | Prevents failure: {yes/no} | Not covered: {yes/no} | Actionable: {yes/no}
>
> → {Promote / Reject / Note / Update existing}
```

### Step 3: Classify

#### Category tag

Tag each learning with one category for tracking:

| Category | When |
|---|---|
| `skill-weakness` | Skill gave wrong or incomplete guidance |
| `rule-weakness` | Rule was too vague or missed a case |
| `routing-issue` | Wrong skill was selected for the task |
| `assumption-issue` | Agent made bad assumptions instead of asking |
| `verification-gap` | Verification step was missing or weak |
| `optimization-overreach` | Optimize command suggested harmful change |

#### Artifact type

Decide what to create:

| Learning type | Create |
|---|---|
| Behavioral constraint ("always do X", "never do Y") | **Rule** (auto-type) |
| Workflow/procedure ("when X happens, do Y then Z") | **Skill** |
| Existing rule/skill needs update | **Update** (use `skill-management`) |

### Step 4: Create or Update

- **New rule** → create in `.agent-src.uncompressed/rules/`, follow rule conventions
- **New skill** → use `skill-writing` skill, create in `.agent-src.uncompressed/skills/`
- **Update existing** → use `skill-management` skill

After creation:
1. Run `python3 scripts/skill_linter.py {path}` — must pass (0 fail)
2. Copy to `.augment/`
3. Mark hash: `python3 scripts/compress.py --mark-done "{relative_path}"`
4. Regenerate tools: `python3 scripts/compress.py --generate-tools`

### Step 5: Decide scope

Ask the user:

```
> 📦 Improvement ready: {description}
>
> 1. Universal — apply locally + PR to upstream package
> 2. Project-specific — apply locally only (agents/overrides/)
> 3. Review first — show me the changes before deciding
```

### Step 6: Apply

**If project-specific (option 2):**
- Create override in `agents/overrides/{type}/{name}.md`
- Done.

**If universal (option 1):**
1. Read `upstream_repo` and `improvement_pr_branch_prefix` from `.agent-settings`
2. If `upstream_repo` is empty → ask user for the target repo
3. Create branch: `{prefix}{learning-slug}` from `main`
4. Commit changes to `.agent-src.uncompressed/` AND `.augment/`
5. Push branch
6. Create PR with title: `improve(agent): {short description}`
7. Use the agent-improvement PR template if it exists

## Output format

1. Learning summary with promotion gate results
2. Created/updated file path
3. Linter result
4. Scope decision and action taken

## Gotcha

- The promotion gate is the most important step — most learnings should be REJECTED
- "Be more careful" is NOT a valid learning — it must be specific
- Always run the linter before declaring success
- The user controls every step — never auto-commit or auto-push

## Do NOT

- Do NOT skip the promotion gate — it prevents skill/rule bloat
- Do NOT create both a rule AND a skill for the same learning
- Do NOT auto-push without user permission
- Do NOT create project-specific content in `.agent-src.uncompressed/`
- Do NOT run this pipeline for trivial learnings
