---
type: "auto"
tier: "2a"
description: "Verify instruction-referenced repository paths exist before routing through them — a root instruction file that names an absent layer is read as fact"
triggers:
  - phrase: "the rules directory"
  - phrase: "the skills directory"
  - phrase: "agent layer"
  - phrase: "as described in AGENTS.md"
  - phrase: "laut AGENTS.md"
  - phrase: "instruction file"
applies_to_user_types:
  - "developer"
  - "maintainer"
self_contained: true
workspaces: [engineering]
packs: [meta]
# obligation: line 30
enforced_by:
  - "instruction-only: nothing observes an agent routing on a path it never resolved; `agent-config doctor --check instruction-path-reach` finds the dangling paths but only when somebody runs it"
obligation_frequency: "per-turn"
---

# Instruction-Path Verification

A root agent-instruction file describes a layer. The layer may not be there.

Measured in three first-party consumer installs: one root file described a whole
agent layer — rules, skills, guidelines — that was **absent from the tree**;
another had the layer but two of its four advertised directories did not exist;
a third carried no agent surface at all while sitting inside the same product
boundary as the other two.

## The Iron Law

```
A PATH NAMED BY AN INSTRUCTION FILE IS A CLAIM, NOT A FACT.
RESOLVE IT BEFORE ROUTING ON IT, AND SAY WHICH SOURCE ANSWERED.
NEVER REPORT A PATH YOU COULD NOT INTERPRET AS ABSENT.
```

## The direction this covers — and the one it does not

This rule is about an instruction surface that **over-reports**: it promises
more than the tree holds. That is the opposite of
[`missing-skill-recovery`](missing-skill-recovery.md), which covers a catalogue
that **under-reports** — a skill that exists in the tree and not in the list you
were shown.

The two are siblings and not one rule, because nothing about them is shared
except the word "missing". Their triggers differ, their causes differ, and —
decisively — **their remedies differ**: the under-reporting remedy is
`suggest_skill_for_task`, an MCP tool that ranks the tree; it has nothing to say
about a path in a markdown file that does not resolve on disk. Combining them
would produce one rule whose named remedy applies to half its content.

| Direction | Symptom | Remedy |
|---|---|---|
| under-reports (`missing-skill-recovery`) | the tree has it, the catalogue does not show it | ask by task — rank the tree |
| **over-reports (this rule)** | the instruction file names it, the tree does not have it | resolve the path, then say which source answered |

## What to do

1. **Resolve before routing.** A directory an instruction file names is checked
   against the filesystem before you route on the names inside it. One `ls` is
   cheaper than a session spent loading artifacts that were never installed.
2. **Say which source answered.** "AGENTS.md names `.agent/rules`, which does
   not exist, so I read the shipped rules instead" is a different claim from
   "the rules say X", and a reader cannot reconstruct which one you meant from
   silence.
3. **Three outcomes, never two.** Present · dangling · *unresolvable, for a
   stated reason*. A path you cannot interpret — a glob, a placeholder, an
   absolute path, a URL — is never reported as absent. Reporting a healthy
   install as broken is worse than not checking, because the next reader stops
   believing the check.
4. **A dangling path is a finding, not a workaround.** Say it out loud rather
   than silently routing around it: the instruction file is wrong and somebody
   has to fix it, and a silent detour means nobody ever will.

## The diagnostic that finds them all at once

```bash
agent-config doctor --check instruction-path-reach
```

It parses the root instruction files, resolves every repository-relative path
they name, and reports each as present, dangling, or unresolvable with the
reason. Its `fail` output names this rule so a consumer reading a dangling-path
report is pointed at the obligation rather than only at the list.

**Running it is not this rule.** The command answers when somebody runs it; this
rule binds mid-session, when an agent is about to route on a path nobody has
checked. That is why the obligation is `instruction-only` — nothing can observe
an agent routing on an unresolved path.

## When NOT to fire

- The path is one you already resolved this session.
- No instruction file is involved — a path from a tool result or a grep hit is
  evidence, not a claim.
- The task is about editing the instruction file itself rather than acting on it.

## See also

- [`missing-skill-recovery`](missing-skill-recovery.md) — the under-reporting sibling; read the table above before deciding which applies.
- [`direct-answers`](direct-answers.md) Iron Law 2 — do not claim what you have not verified; a path is a claim.
- [`source-discovery-gate`](source-discovery-gate.md) — the same discipline for structure: no structural claim without evidence from a real source.
