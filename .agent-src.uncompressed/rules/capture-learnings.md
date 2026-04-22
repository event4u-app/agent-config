---
type: "auto"
description: "After completing a task where a repeated mistake or successful pattern appeared — capture as rule or skill"
alwaysApply: false
source: package
---

# Capture Learnings

When a repeated mistake, successful pattern, or new constraint appears,
evaluate whether to capture as **rule** or **skill**.

## Promotion Gate

A learning may be promoted to rule/skill ONLY if ALL gates pass:

| Gate | Question | Must be YES |
|---|---|---|
| Repetition | Occurred at least twice OR clearly generalizable? | ✅ |
| Impact | Improves correctness, reliability, or consistency? | ✅ |
| Failure pattern | Prevents a real, observed failure? | ✅ |
| Non-duplication | No existing rule/skill/guideline covers this? | ✅ |
| Scope fit | Fits rule (constraint), skill (workflow), or guideline (convention)? | ✅ |
| Minimal | Update existing preferred over creation? | Checked |

**Reject immediately if:**
- Occurred only once and is not clearly generalizable
- Similar guidance already exists (update instead)
- Baseline model knowledge or standard tool usage
- Vague frustration without concrete failure pattern

## Triggers

- Mistake that happened 2+ times
- Pattern that improved outcome and should be reused
- Missing constraint that caused issues
- **User frustration or complaint** — extract the underlying failure pattern, don't ignore or defend
- **New skill/rule/guideline created** — evaluate if it should be contributed upstream (→ `upstream-proposal` rule)
- **Significant improvement to existing skill/rule** — consider upstream contribution

## Do NOT capture

- One-off problems
- Vague frustrations without concrete consequence
- Content already covered by existing guidance

## Rule vs Skill

- **Rule** → always-apply constraint ("never X", "always Y")
- **Skill** → repeatable workflow with steps ("when X, do 1-5")
- **Update** → existing guidance covers topic → extend, don't duplicate

## How

- Smallest effective change
- Update existing over creating duplicates
- Full workflow: `learning-to-rule-or-skill` skill

## Where learnings are written

Captured learnings live in the **consumer project's** `agents/learnings/`
directory, one file per learning:

```
agents/learnings/<YYYY-MM-DD>-<kebab-slug>.md
```

Minimum fields (markdown with a small YAML frontmatter):

```yaml
---
slug: <same as filename>
captured: <ISO date>
occurrences: <integer, ≥2 or note "one-off, clearly generalizable">
type_hint: rule | skill | guideline | update
scope_hint: project | package
---
```

Body: 1-paragraph **pattern** (not anecdote) + 1 concrete example.

A learning file is the input to `learning-to-rule-or-skill`, which
produces a proposal draft under `agents/proposals/`. The proposal is
then gated by `scripts/check_proposal.py`; see
[`self-improvement-pipeline`](../guidelines/agent-infra/self-improvement-pipeline.md).

The `agents/learnings/` and `agents/proposals/` directories are
consumer-owned — the package ships templates and schemas, never the
data.
