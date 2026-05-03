---
name: skill-writing
description: "Use when deciding 'should this be a skill or a rule?', creating/improving/reviewing agent skills, SKILL.md frontmatter, or procedure sections — even without saying 'skill-writing'."
source: project
---

# skill-writing

## When to use

Use this skill when:

* Creating a new skill from scratch
* Improving an existing skill
* Reviewing skill quality
* Deciding what belongs in a skill vs a rule

Typical examples:

* "Create a skill for X"
* "This skill needs improvement"
* "Should this be a skill or a rule?"

Do not use this skill when:

* Writing rules (rules are constraints, not workflows)
* Writing commands (commands are direct invocations)

## Goal

* Create executable skills, not documentation
* Ensure every skill answers: When? How? What output?
* Prevent common mistakes: too broad, too generic, missing validation

## Preconditions

* Clear understanding of the intended task
* Distinction: rules = always apply, skills = triggered workflows
* Access to a skill template or existing reference skill

## Decision matrix: What goes where?

Before creating anything, classify the content:

| If the content is... | Then it is... | Action |
|---|---|---|
| An always-true constraint ("never X", "always Y") | **Rule** | Create/update `.augment/rules/` |
| A step-by-step workflow with decisions and validation | **Skill** | Create/update `.augment/skills/` |
| A coding convention or reference material | **Guideline** | Create/update `.augment/guidelines/` |
| Baseline model knowledge (how jq works, what `docker exec` does) | **Nothing** | Do not create anything |
| Simple tool usage without complex workflow | **Nothing** | Do not create anything |
| Already covered by an existing skill/rule/guideline | **Update** | Extend the existing file |

### The critical test

Ask: **"Does the model need this to do its job correctly?"**

* If the model already knows it → **Nothing**
* If the model knows it but does it wrong in THIS project → **Rule or Guideline**
* If the model needs a multi-step workflow to get it right → **Skill**

### When "Nothing" is the right answer

Do NOT create a skill or rule for:

* Standard tool usage (jq, grep, docker exec, git commands)
* Framework basics the model already knows
* Single-command operations without decision logic
* Knowledge that belongs in a skill's procedure as a step, not as its own skill

### Size and structure hints

→ See `docs/guidelines/agent-infra/size-and-scope.md` for full limits.

* Target: 300–900 words. Review for split above 1200 words. Strongly consider split above 1500 words.
* If multiple workflows exist → split into multiple skills
* If two skills overlap heavily → merge
* If a skill becomes "read the guideline" → it lost its purpose, restore the workflow

## Procedure

### 0. Inspect, then run the Drafting Protocol

Before writing, **inspect** the landscape: grep
`.agent-src.uncompressed/skills/` and `rules/` for duplicates or
near-matches, and **analyze** 1–2 gold-standard peers (e.g. `pest-testing`,
`php-coder`) to anchor shape and tone. If requirements are unclear or
incomplete, stop and ask — do not assume.

Then run the Understand → Research → Draft sequence from the
[`artifact-drafting-protocol`](../../rules/artifact-drafting-protocol.md)
rule. Skip only on explicit *"just do it"* bypass or trivial edits
(typo, link, single-line clarification).

### 1. Define the trigger

Write "When to use" first. This is the in-body trigger — it documents the
workflow's entry conditions for anyone reading the skill.

Good:
Use when creating Laravel middleware for request filtering

Bad:
Use when working with Laravel

### 1b. Write a pushy frontmatter description

The `description:` field is what Claude reads at routing time. Polite or
generic descriptions cause **undertriggering**. Normative source:
`skill-quality` rule § *Description Triggering*.

Three rules: name 2+ triggers (domains, symptoms, user phrasing), end with
`... even if they don't explicitly ask for \`<skill-name>\`.`, and stay
**≤ 200 characters** (`skill_linter.py` warns `description_too_long` above
that). When trimming to fit, drop adjectives or the second example phrasing
before you drop a trigger class or the `even if ...` tail.

Canonical before/after (2026-04-21 audit baseline):

```yaml
# Bad (138 chars, polite, single trigger class):
description: "Use when writing Playwright E2E tests — browser automation,
  visual regression testing, Page Objects, fixtures, and reliable test
  patterns."

# Good (pushy, second trigger class, explicit tail):
description: "Use when writing Playwright E2E tests — locators, assertions,
  Page Objects, fixtures, CI, and flaky test prevention — even if the user
  doesn't say Playwright."
```

The *good* version routes correctly on *"my E2E keeps flaking on CI"*
without naming Playwright. Run `python3 scripts/audit_skill_descriptions.py`
after writing; if flagged `too-short` or `no-trigger-prefix`, rewrite
before commit.

When iterating on phrasing with the user (e.g. "make this pushier",
"will this ever fire"), delegate to the
[`description-assist`](../description-assist/SKILL.md) skill — it runs the
approval-gated propose / pick loop with at most two rounds.

### 1c. Propose a trigger-eval stub (new skills only)

When creating a new skill, propose a stub
`.agent-src.uncompressed/skills/{name}/evals/triggers.json` before writing
the body. Draw the queries from Phase A of the drafting protocol (the
user's "should trigger" and "must not trigger" answers).

Stub shape — 5 should-trigger + 5 should-not-trigger queries, first-person,
single-sentence, **no leakage of the skill name** in the queries:

```json
{
  "skill": "{name}",
  "description": "5 should-trigger + 5 should-not-trigger queries. No query mentions '{name}' directly. Near-misses share domain vocabulary without being the actual task.",
  "queries": [
    {"q": "<phrasing from user Phase A that MUST route here>", "trigger": true},
    {"q": "<another should-trigger phrasing>", "trigger": true},
    {"q": "<...3 more>", "trigger": true},
    {"q": "<near-miss sharing vocabulary but different task>", "trigger": false},
    {"q": "<another near-miss>", "trigger": false},
    {"q": "<...3 more>", "trigger": false}
  ]
}
```

Present the stub as a numbered-options prompt (per `user-interaction`):

```
> 1. Accept stub as drafted — commit alongside the skill
> 2. Edit queries before commit
> 3. Skip evals for now — create later
```

Nothing is committed without the user's pick. If the user picks *skip*,
record it in the commit message (`Eval stub: deferred`). Peer examples
for the expected format: `php-coder/evals/triggers.json`,
`eloquent/evals/triggers.json`, `skill-writing/evals/triggers.json`.

Rules / commands / guidelines do **not** get eval stubs — only skills
route through the top-level catalogue.

### 2. Write the procedure

Use numbered, verifiable steps.

Good:

1. Check if middleware exists
2. Create with artisan command
3. Implement logic
4. Register in route or kernel

Bad:

1. Create middleware
2. Add logic

### 3. Add validation

End with concrete validation.

Good:

* Route returns expected status
* Appears in route list
* No static analysis errors

Bad:

* Vague statements like "see if outcome is correct" (no concrete command or assertion)

### 4. Add safe/unsafe example

Show minimal contrast.

Good:

* Typed middleware, correctly registered

Bad:

* Business logic inside middleware

### 5. Define output format

Control response structure.

Example:

1. Code snippet
2. Registration location
3. Gotcha (if relevant)

### 6. Validate against quality checklist

* K1: Description is a trigger ("Use when...")
* K2: Not over-defined
* K3: No obvious content
* K4: Contains gotchas
* K5: Has Output format (numbered, 2-4 deliverables)
* K6: Not pointer-only (executable without opening guidelines)
* K7: Created with analysis (not blind, expected behavior defined)
* Size: Within limits (see size-and-scope guideline)

## Output format

1. Complete SKILL.md file
2. No explanations outside the file
3. Fully copyable
4. No empty sections

## Core rules

* Skills are executable thinking processes
* Always include: When to use, Procedure, Output format, Gotchas, Do NOT
* Steps must be verifiable
* Validation must be concrete
* One skill = one job

### Execution metadata (optional)

Skills may declare an `execution` frontmatter block (`type`, `handler`,
`timeout_seconds`, `safety_mode`, `allowed_tools`). Default is `manual`
(instructional only). See `docs/guidelines/agent-infra/runtime-layer.md` for
the full specification and `assisted` / `automated` semantics.

### When to create a `project-analysis-*` skill

Only if the framework has its own lifecycle producing unique debugging
patterns that `project-analysis-core` cannot explain (e.g. Laravel,
Symfony, Express, React, Next.js). **Not** for Tailwind, CSS frameworks,
utility libs, or simple state managers.

## Gotchas

* Writing documentation instead of executable steps
* Skipping validation — every Procedure MUST end with a concrete verify step
* Including baseline knowledge the model already has
* Description too long or not a trigger
* Renaming a heading to "Procedure:" without numbered steps or `###` sub-headings
* **Always run `python3 scripts/skill_linter.py` before saving — 0 FAIL required**

## Do NOT

* Write documentation-style, pointer-only, or too-broad skills ("Laravel skill")
* Skip Procedure or use vague validation
* Exceed size limits (see `docs/guidelines/agent-infra/size-and-scope.md`)
* Duplicate rules
