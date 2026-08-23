---
model_tier: inherit
name: skill-improvement-pipeline
description: "Run the skill-improvement pipeline after a learning was detected — capture, classify, create, validate, apply; explicit request only."
domain: process
scope:
  write: []
  verification_reason: "execution.handler is internal, so this skill spawns no subprocess — writes happen through the agent's declared allowed_tools. No command can prove a scope the skill never executes."
execution:
  type: assisted
  handler: internal
  allowed_tools: []
workspaces:
  - agent-config-maintainer
packs:
  - meta
requires_skills:
  - learning-to-rule-or-skill
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

#### Cross-project promotion signal (surfacing only — never an auto-writer)

If the **same learning** has now been observed in **≥ 2 distinct projects**, it
is a strong promotion candidate for a *shared* surface (a global rule/skill or a
`src/patterns/` recipe) rather than a project-local note. **Surface** that signal
to the user — do **not** auto-write it:

```
> Cross-project: this learning was also seen in {other-project}.
> ≥2 projects ⇒ candidate for a shared surface (global rule / skill / pattern).
> → surface for promotion (human decides; no auto-write)
```

This is a *signal*, not a store: there is no auto-write, no decay, no runtime
(the writable per-project learning store stays rejected —
[[council-agent-memory-sunset]]). The human decides whether the cross-project
recurrence justifies promotion.

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

> **Anchor exact commands to the transcript, not the journal.** A session
> journal is a *lossy summary*; a command, path, or flag reconstructed from it
> can be subtly wrong. Before writing a concrete step (a command, a file path, a
> config key) into a rule or skill, confirm it against the anchored source
> transcript — carry a `transcript:` / session anchor on the mined learning so
> the exact wording is recoverable, and verify against it rather than trusting
> the summary.

- **New rule** → create in `src/rules/`, follow rule conventions
- **New skill** → use `skill-writing` skill, create in `src/skills/`
- **Update existing** → use `skill-management` skill

After creation:
1. Run `./scripts-run src/scripts/skill_linter {path}` — must pass (0 fail)
2. Copy to `.augment/`
3. Regenerate tools: `./scripts-run src/scripts/condense --generate-tools`
4. **If the learning came from a knowledge page** (`agents/knowledge/procedures/skill-candidates.md`
   or any `agents/knowledge/` page) — degrade the source to a pointer;
   promotion is not complete otherwise (double-maintenance risk):
   `./scripts-run src/scripts/degrade_to_pointer --source "<knowledge-path>[#<anchor>]" --artifact "{relative_path}" --date "<YYYY-MM-DD>"`

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
1. Read `project.upstream_repo` and `project.improvement_pr_branch_prefix` from `.agent-settings.yml`
2. If `project.upstream_repo` is empty → ask user for the target repo
3. Create branch: `{prefix}{learning-slug}` from `main`
4. Commit changes to `src/` AND `.augment/`
5. Push branch
6. Create PR with title: `improve(agent): {short description}`
7. Use the agent-improvement PR template if it exists

## Classify the missing component BEFORE choosing the artifact

```
ON A FAILURE, NAME WHICH COMPONENT WAS ABSENT. THE CLASS PICKS THE ARTIFACT.
THE DEFAULT ANSWER TODAY IS "ANOTHER RULE". IT IS USUALLY THE WRONG ONE.
```

A failure means something was missing. Which something decides what to build,
and the pipeline's own bias is to answer "a rule" regardless — which is how a
tree accumulates prose for problems prose cannot solve.

| Absent component | What it becomes |
|---|---|
| **Instruction** — nothing said to do it | a rule or a skill section |
| **Source of truth** — the fact was not written down anywhere | a context or contract |
| **Tool** — the step was manual and got skipped | a script |
| **Validator** — nothing checked the result | a gate |
| **Permission rule** — authority was ambiguous | an authority-band edit |
| **Sandbox signal** — the environment did not say what it allowed | a capability probe |
| **Evaluation** — nothing would have caught the regression | a fixture |
| **Recovery path** — the failure had no exit | a runbook step |

Run this before the promotion gate, not after: a validator gap that reaches the
gate as a proposed rule is judged on whether the *rule* is worth adding, which
is the wrong question asked well.

**The escalation threshold applies here too.** A third recurrence of the same
violation class converts an observation into a deterministic gate — and a review
finding never silently becomes a hard gate. Both halves, specified in
[`decision-review` § Removal is a disposition](../decision-review/SKILL.md).

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
- Do NOT create project-specific content in `src/`
- Do NOT run this pipeline for trivial learnings

## References

- **Reflexion** — [arxiv.org/abs/2303.11366](https://arxiv.org/abs/2303.11366)
  Language agents that reinforce from verbal self-reflection on past
  trials. This pipeline adapts Reflexion by gating promotion with a
  human review step — learnings only harden into rules/skills after
  explicit approval, never auto-commit.

