---
type: "auto"
tier: "2a"
description: "A skill exists in the tree but not in the host's catalogue — ask for it by TASK via suggest_skill_for_task, never conclude it does not exist"
triggers:
  - phrase: "skill not found"
  - phrase: "no such skill"
  - phrase: "skill does not exist"
  - phrase: "kein passendes skill"
  - phrase: "which skill"
  - phrase: "welches skill"
applies_to_user_types:
  - "developer"
  - "maintainer"
self_contained: true
workspaces: [engineering]
packs: [meta]
# obligation: line 41
enforced_by:
  - "instruction-only: nothing can observe an agent concluding that no skill exists; the skill-route concern covers only the prompts where the ranker is confident"
obligation_frequency: "per-turn"
---

# Missing-Skill Recovery

The catalogue a host shows you is not the catalogue that exists. Hosts truncate,
and at least one truncates hard: measured 2026-08-16 on a default install, the
host published its own budget event stating it had stripped every description
and dropped **402 entries** from the model-visible skills list
(`agents/evidence/analysis/scoped-projection-host-delivery.md`). Scoping the
projection moved that to 330 and stripped the descriptions anyway.

402 is the **host's own count against the host's own denominator**, which is not
this package's: the same install projects 297 skills, so the figure is a
magnitude, never a subtraction anyone can perform. What it establishes is that
most of the catalogue is not model-visible — which is all this rule needs.

So "I do not see a skill for this" is evidence about the **delivery**, never
about the tree.

## The Iron Law

```
A SKILL MISSING FROM THE HOST CATALOGUE IS NOT A SKILL THAT DOES NOT EXIST.
NEVER CONCLUDE "NO SKILL COVERS THIS" FROM THE LIST YOU WERE SHOWN.
ASK BY TASK — `suggest_skill_for_task` RANKS THE TREE, NOT THE CATALOGUE.
NEVER REBUILD A CAPABILITY BECAUSE ITS SKILL WAS NOT DELIVERED.
```

## What to do

1. **Ask by task, not by name.** A name you cannot see is a name you cannot
   type; a task description always works. The `suggest_skill_for_task` MCP tool
   ranks `SKILL.md` frontmatter over the source tree and returns names, scores
   and personas — no bodies, so a wrong rank costs one read.
2. **Open the winner and check it yourself.** The ranker is deterministic
   keyword scoring, not judgement. A high score is a pointer, not a verdict.
3. **Say which source answered.** "The catalogue had no entry, the ranker
   found `X`" is a different claim from "there is no skill for this", and a
   reader cannot reconstruct which one you meant from silence.
4. **If nothing scores, say that** — and proceed without a skill rather than
   inventing one. A ranked empty list and an unreachable catalogue are
   different answers; the tool distinguishes them (`status: no_catalogue`) and
   so should you.
5. **If the tool is not registered, say THAT — and proceed.** This rule may
   never instruct a call it cannot verify is possible. The tool arrives with
   this package's MCP server, which `agent-config install` registers for the
   `claude-code` tool in the project's `.mcp.json`. No entry there, or the
   server not started, and there is no tool to call: name the gap in one clause,
   proceed without a skill, and — only if the missing catalogue entry actually
   mattered — point at `agent-config mcp:check`, which reports whether
   `.mcp.json` carries the entry. Never retry a call that is not wired, and
   never report "no skill covers this" when what you learned is "no tool
   answered".

## When NOT to fire

- The skill you need was delivered and is in front of you. This rule is for the
  gap, not for routine skill selection.
- The task genuinely has no skill and you already checked by task. Checking
  twice is the loop, not the discipline.
- A host that delivers its catalogue whole — the rule costs nothing there and
  simply never has a gap to close.

## Honest enforcement — `instruction-only`

Nothing can observe an agent concluding "no skill exists". The `skill-route`
concern injects ranked pointers on `user_prompt_submit` when its floor is
cleared, which covers the prompts where the ranker is confident and by
construction covers no others: it is silent on ~86 % of prompts by design. This
rule is the model-carried half for the rest, and it is stated as such rather
than implied to be caught by the concern.

## See also

- [`code-intelligence`](../skills/code-intelligence/SKILL.md) — the same
  shape for source code: query the index first, fall back, name the source.
- [`external-code-graph-interop`](external-code-graph-interop.md) — its rule-side
  twin, and the model this rule's trigger set follows.
- `src/scripts/skill_tools/score_skill_relevance.ts` — the ranker itself, and
  the one place its scoring is defined.
