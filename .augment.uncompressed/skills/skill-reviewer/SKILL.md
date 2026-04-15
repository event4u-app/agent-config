---
name: skill-reviewer
description: "Use when reviewing, auditing, or optimizing existing skills, or when creating a new skill and wanting to validate it before saving. Also triggers on \"check this skill\", \"audit skills\", \"optimize skill descriptions\", \"run the 5 killers check\", or \"is this skill well-written\". Evaluates skills against the 5 Skill Killers checklist and produces actionable fix recommendations."
source: package
---

# Skill Reviewer

Reviews skills against the **5 Skill Killers** — the most common anti-patterns
that waste tokens, cause misfires, or degrade agent performance.

## The 5 Skill Killers Checklist

### Killer 1: Vague or Quiet Description

The description is the **most critical line** — it's a trigger, not a summary.

**Good pattern:**
```yaml
description: >
  Use when the user says "create a DTO", "new data transfer object",
  or asks to convert request/response data into a typed PHP class.
  Also triggers on "map this to a DTO" or "I need a value object".
  Creates DTO classes following project conventions with SimpleDto
  base class, attribute mapping, and validation.
```

**Bad patterns:**
- ❌  `"Creates DTO classes following project conventions"` — no trigger phrases
- ❌  `"Handles DTOs"` — too vague, won't fire
- ❌  Only describes WHAT, never WHEN

**Fix rules:**
- Start with `Use when the user says "..."` or `Use when [situation]`
- Include 3-5 trigger phrases people actually say
- Write in third person (injected into system prompt)
- Be LOUD — models skip past quiet descriptions
- End with 1 sentence describing what the skill does
- For explicit-only skills: `"ONLY when user explicitly requests: [X]. NOT for [Y]."`

### Killer 2: Over-Defining (Railroading)

The skill dictates every micro-step instead of guiding.

**Check:** Are there >15 numbered steps? Does it prescribe HOW to think?
**Fix:** Set degrees of freedom — tight for fragile ops (migrations, deployments),
loose for creative tasks (design, planning). Use bullets over numbered steps
when order doesn't matter.

### Killer 3: Stating the Obvious

Content the model already knows — wasting tokens on every invocation.

**Check:** For each paragraph, ask: "Does the model really need this?"
**Examples of waste:**
- ❌  Explaining what PHP strict types do
- ❌  Describing how Laravel middleware works (in a middleware skill)
- ❌  Listing basic Git commands

**Keep only:** Project-specific conventions, non-obvious patterns, YOUR way of doing things.

### Killer 4: Missing Gotcha Section

The highest-signal content in a skill. Documents failure patterns.

**Check:** Does the skill have a `## Gotcha` or `## Common Mistakes` section?
**Fix:** Add one with real failure patterns:
```markdown
## Gotcha

- Don't assume X — check Y first because Z
- The model tends to forget A when doing B
- Edge case: when C happens, do D instead of E
```

### Killer 5: Monolithic Blob

Everything in one file, >500 lines.

**Check:** Line count > 500?
**Fix:** Extract reference tables, templates, and examples into separate files
in the skill folder. SKILL.md stays under 500 lines.

## Structural Validation (pre-review)

Before scoring the 5 Killers, verify structure:

**Skills** — required sections:
- When to use (with "Do not use when")
- Procedure (numbered steps, Step 0: Inspect, concrete validation at end)
- Output format
- Gotchas
- Do NOT

**Rules** — must be:
- Short and directive
- Always-applicable (no situational triggers)
- Not procedural (no numbered steps — that's a skill)

**Compression safety** (if compressed version exists):
- Trigger clarity preserved
- Decision hints or equivalent present
- Concrete validation still present
- Gotchas/anti-failure protection retained

**Scope check:**
- No overlap with existing skill or rule (name + description)
- Single workflow per file (multiple workflows → split)
- Update existing preferred over creating new file

## How to Review

### Single skill
1. Validate structure (required sections present)
2. Score each killer: ✅ Pass / ⚠️ Weak / ❌ Fail
3. Check compression safety (if applicable)
4. Produce a verdict table + specific fix suggestions

### Batch audit
1. Scan all skills in `.augment/skills/`
2. For each: check description format, line count, gotcha presence
3. Produce a summary table sorted by severity
4. Group fixes by type (e.g., "these 20 need description rewrites")

## Output Format

```markdown
| Skill | K1 Desc | K2 Over | K3 Obvious | K4 Gotcha | K5 Size | Verdict |
|---|---|---|---|---|---|---|
| dto-creator | ❌ | ✅ | ✅ | ⚠️ | ✅ | Fix description |
```

## Gotcha

- Don't rewrite skills unnecessarily — only fix actual killer violations.
- A description that works (triggers correctly) is fine even if not perfect.
- Gotcha sections grow organically — seed them, don't force 10 entries.
- "Stating the obvious" is relative to the MODEL, not to junior developers.
  If the model consistently gets something wrong, it's NOT obvious — keep it.
- Skills under 50 lines rarely have Killer 5 problems — skip that check.
- Flag any "Related skills" section — the agent discovers skills via `<available_skills>` descriptions. Cross-links waste tokens and create maintenance burden. Recommend removal.
