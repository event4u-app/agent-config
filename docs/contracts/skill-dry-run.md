---
stability: experimental
---

# Skill Dry-Run / Preview Contract

> **Status** · v0 / design · 2026-05-30. Phase 5 of `road-to-leaner-core-and-discovery`.
> The council's missing-item catch: with 220 skills, non-dev personas need a non-destructive way
> to see what a skill/command will do **before** running it.

## What "preview" means

A preview reads a skill's **declared intent** — its frontmatter and `## Steps` body — and renders a
plain-language "this skill will…" summary. It surfaces:

- the skill's **declared steps** (the `## Steps` section headings);
- its **execution type** (`manual` / `assisted` / `automated`, default `manual`) and **handler**
  (`none` / `shell` / `php` / `node` / `internal`);
- its declared **`allowed_tools`**;
- any **file or command targets** named in the body (backtick paths, `python3 scripts/…` invocations).

## Explicit non-goals

```
PREVIEW IS NOT A SANDBOX. IT DOES NOT EXECUTE A FENCED COPY OF THE SKILL.
IT IS NOT A GUARANTEE OF SIDE-EFFECT-FREENESS FOR SKILLS WITH AN `execution` BLOCK.
```

Preview reads declared intent — it does not run the skill, does not dry-run its commands, and cannot
prove a skill is harmless. It tells you what the skill *says* it will touch, so you can decide whether
to run it. For `execution: manual` skills (the default), it states plainly: **instructional only — no
automatic execution** (per [`runtime-safety`](../../.agent-src/rules/runtime-safety.md): `manual` is
instructional, `assisted` must propose before executing).

## Surface

- CLI / agent: `/skill:preview <name>` — plain-language summary by default; `--technical` shows the raw
  frontmatter + step list.
- Script: `scripts/skill_preview.py <name> [--technical] [--format text|json]`.

Plain-language mode reuses the plain-explain tone (employee-roadmap Phase 6). A malformed or missing
SKILL.md degrades to a **structured error**, never a crash.

## Implementation

`scripts/skill_preview.py` (≤ 250 LOC). Read-only over `.agent-src/skills/<name>/SKILL.md`. No network,
no execution. Coverage: `tests/test_skill_preview.py`.
