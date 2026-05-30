# Skill preview — see what a skill does before you run it

With 220 skills and some that run commands, you should not have to run a skill to
find out what it touches. `/skill:preview` reads a skill's **declared intent** —
its steps, execution type, tools, and any file/command targets — and renders a
plain-language summary. Read-only: it never runs the skill.

This is the middle of the safe adoption loop: **discover → preview → run**.

## 1. Discover, then preview

Find a candidate with [`/skills:discover`](skill-discovery.md), then look before you leap:

```
/skill:preview competitive-positioning
```

Under the hood:

```bash
python3 scripts/skill_preview.py competitive-positioning
```

## 2. Read the summary

A **manual** skill (the default) is pure guidance — preview says so plainly:

```
# Preview — `accessibility-auditor`

**Execution: instructional only.** This skill does not run anything automatically —
it guides the agent step by step.

_No tools, commands, or file targets declared — pure guidance._
```

An **assisted** skill proposes actions you approve — preview surfaces the command
and tools it declares:

```
# Preview — `adr-create`

**Execution: assisted** (handler `shell`). It will *propose* actions for you to
approve — it never executes silently.

This skill will walk these steps:
- Pick the next ADR number
- Write the standard template
- Regenerate the index

Declared command: `python3 scripts/adr/regenerate_index.py`
```

Add `--technical` for the raw frontmatter + numbered step list.

## 3. Decide, then run

Preview hands the decision back to you. If the declared steps and targets look
right, invoke the skill. If not, skip it — you have spent zero side effects
finding out.

## What preview is not

- **Not a sandbox.** It does not run the skill or a fenced copy of it.
- **Not a safety guarantee.** It shows what the skill *declares* it will touch —
  it cannot prove a skill with an `execution` block is side-effect-free.

A malformed or missing skill yields a structured error, never a crash.

Contract: [`skill-dry-run`](../contracts/skill-dry-run.md). Pairs with
[`skill-discovery`](skill-discovery.md) as the discover → preview → run loop.
