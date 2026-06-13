---
model_tier: medium
name: skill-preview
pack: meta
tier: 2
visibility: internal
cluster: skill
sub: preview
description: Non-destructive preview of a skill — its declared steps, execution type, allowed tools, and file/command targets — before you run it. Read-only, no execution.
skills: [file-editor]
suggestion:
  eligible: true
  trigger_description: "what does this skill do, preview <skill> before running, what will it change, is it safe, /skill:preview competitive-positioning"
  trigger_context: "user wants to inspect a skill's declared intent before committing to run it"
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /skill preview

Renders a skill's **declared intent** — its `## Steps`, execution type, handler,
`allowed_tools`, and any file/command targets named in its body — so you can
decide whether to run it. Read-only, no network, no execution. Implements the
[`skill-dry-run`](../../../docs/contracts/skill-dry-run.md) contract.

## Prerequisites

- Python 3.10 + PyYAML on the host.
- A skill name that resolves to `dist/agent-src/skills/<name>/SKILL.md`.

## Steps

### 1. Parse the argument

`/skill preview <name> [--technical]`. The name is the first positional
argument. Missing name → print usage and stop.

### 2. Run the previewer

```bash
./scripts-run src/scripts/skill_preview <name>
```

Add `--technical` for the raw frontmatter + numbered step list; default is the
plain-language summary. `--format json` is machine-readable.

### 3. Present the summary

Show the plain-language preview: the skill's execution type (a `manual` skill
renders **"instructional only — no automatic execution"**; an `assisted` skill
renders its proposed actions), declared steps, tools, and any file/command
targets. End on the contract reminder that preview shows *declared intent*, not
a guarantee of side-effect-freeness.

### 4. Hand back the decision

Preview never runs the skill. After showing it, let the user decide whether to
invoke the skill — that is the safe adoption loop:
`/skills:discover` → `/skill:preview` → run.

## Rules

- **Read-only, no execution.** Preview inspects the SKILL.md; it does not run it.
- **Not a sandbox** — it cannot prove a skill is harmless; it shows what the
  skill *declares* it will touch.
- **Malformed / missing SKILL.md → a structured error**, never a crash.
- **One skill per invocation.**
