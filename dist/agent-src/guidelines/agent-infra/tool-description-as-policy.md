# Tool description as policy

Authoring guideline for skills, commands, and MCP tools. Shared block — cited
from [`skill-writing`](../../../src/skills/skill-writing/SKILL.md),
[`command-writing`](../../../src/skills/command-writing/SKILL.md), and
[`mcp-builder`](../../../src/skills/mcp-builder/SKILL.md).

## The principle

Policy that governs *how a tool is used* belongs **inside the tool's own
description**, where it fires at the decision point the model is already
reading — not in always-on prose the model may not have loaded when it reaches
for the tool. The description is the highest-signal, best-timed place to encode
usage policy.

## What to encode in the description

- **Workflow sequencing.** If tool B must follow tool A ("call `memory_lookup`
  with `detail:index` FIRST, then `memory_get` the ids"), say so in B's
  description, not in a separate rule.
- **Preconditions.** What must be true before the tool is called (a built
  artifact present, a prior step run) — stated where the model chooses to call.
- **ID / output provenance.** When the tool returns handles (ids, paths, PR
  numbers), instruct: **copy them verbatim from the tool result, never from
  memory** — context decay silently corrupts a remembered id.
- **A mandatory "why" intent field.** Require the caller to state the intent of
  the call; a tool that forces "why am I calling this" cuts reflexive misuse.
- **Turn-end contracts.** If the tool ends the turn or hands off, the
  description says so — the caller does not discover it after the fact.

## Why here, not as an always-on rule

An always-on rule pays context cost on every turn and may be evicted before the
decision; the description is loaded exactly when the tool is under
consideration. Encode the policy at the point of use.
