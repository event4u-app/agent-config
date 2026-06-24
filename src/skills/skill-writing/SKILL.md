---
model_tier: inherit
name: skill-writing
description: "Use when deciding 'should this be a skill or a rule?', creating/improving/reviewing agent skills, SKILL.md frontmatter, or procedure sections — even without saying 'skill-writing'."
source: project
domain: process
meta_skill: true
workspaces:
  - agent-config-maintainer
packs:
  - meta
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

### Skills and commands share the `.claude/skills/` namespace

Skills in `.agent-src.uncondensed/skills/{name}/SKILL.md` AND commands in
`.agent-src.uncondensed/commands/{name}.md` both project into
`.claude/skills/` (see `scripts/condense.py` →
`generate_claude_skills` + `generate_claude_commands`). Claude treats
the whole directory as native skills.

Implications for skill authors:

* If a same-name command already exists, the skill takes priority and
  the command is skipped (`generate_claude_commands` honors this).
  Don't reuse a command's slug for a skill unless the command should
  retire.
* Both artifacts compete on `description` for routing. A weak skill
  description is shadowed by a stronger same-domain command — and vice
  versa. Make trigger phrasing precise (§ 1b below).
* When the workflow has both a "user types `/foo`" path AND a "model
  picks this up from intent" path, author the skill first and let the
  command delegate (`skills:` frontmatter). Two artifacts with the same
  trigger surface fight each other in the router.

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
`.agent-src.uncondensed/skills/` and `rules/` for duplicates or
near-matches, and **analyze** 1–2 gold-standard peers (e.g. `pest-testing`,
`php-coder`) to anchor shape and tone. If requirements are unclear or
incomplete, stop and ask — do not assume.

Then run the Understand → Research → Draft sequence from the
[`artifact-drafting-protocol`](../../rules/artifact-drafting-protocol.md)
rule. Skip only on explicit *"just do it"* bypass or trivial edits
(typo, link, single-line clarification).

### 0b. Skill-growth gate (new skill only)

The skill count keeps climbing; nothing forces *"should this be a new skill at
all?"*. Before creating a **new** skill, answer these in the PR body — a new
skill that cannot answer them is a merge / guideline / no-op in disguise:

1. **Family** — which capability family does it join? (engineering, product, …)
2. **Capability** — what does it do that no existing skill does? Name the gap.
3. **Why not extend / merge** — which nearest skill did you consider folding into, and why is a separate skill better?
4. **Why not a guideline** — is this executable workflow (skill) or reference material (guideline)? Guideline-shaped content does not become a skill.
5. **Visibility tier** — `core` or `lab`? Which pack?

**Surface overlap before deciding** — run `./scripts-run src/scripts/skill_overlap`
(or `audit_skill_overlap`) and read the nearest matches; a high-overlap hit is a
merge signal, not a green light. This gate is the authoring-time companion to the
[capability-boundary matrix](../../../docs/contracts/capability-boundary.md): the
matrix governs packs, this governs the skills inside them.

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
without naming Playwright. Run `./scripts-run src/scripts/audit_skill_descriptions`
after writing; if flagged `too-short` or `no-trigger-prefix`, rewrite
before commit.

When iterating on phrasing with the user (e.g. "make this pushier",
"will this ever fire"), delegate to the
[`description-assist`](../description-assist/SKILL.md) skill — it runs the
approval-gated propose / pick loop with at most two rounds.

### 1c. Propose a trigger-eval stub (new skills only)

When creating a new skill, propose a stub
`.agent-src.uncondensed/skills/{name}/evals/triggers.json` before writing
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

### 7. Run + iterate evals (quantitative loop)

Triggers (`evals/triggers.json`) check **routing**. A separate
`evals/evals.json` checks **behavior** — does the skill make the agent
produce a better answer than baseline? Add this layer for any skill
where the procedure has measurable output (commands, artifacts,
structured text). Skip for evergreen heuristics with no falsifiable
output (e.g. `direct-answers`, `language-and-tone`) unless the user
asks for it.

**Workspace layout** (all under `.gitignore`):

```
.agent-src.uncondensed/skills/{name}/evals/
  triggers.json              # tracked — routing eval (§ 1c)
  evals.json                 # tracked — behavior eval definitions
  runs/                      # gitignored — per-iteration outputs
    {timestamp}-baseline/    # sub-agent run without the skill
    {timestamp}-with-skill/  # sub-agent run with the skill
    {timestamp}-benchmark.json
```

**`evals.json` shape** — 3–10 scenarios, each with prompt + grading
rubric:

```json
{
  "skill": "{name}",
  "scenarios": [
    {
      "id": "happy-path",
      "prompt": "<full user-shaped task that exercises the skill>",
      "assertions": [
        {"kind": "contains", "value": "<expected substring in output>"},
        {"kind": "file_exists", "path": "<artifact path the skill should create>"},
        {"kind": "rubric", "criterion": "<one-line judgement, e.g. 'output includes a numbered procedure'>"}
      ]
    }
  ]
}
```

`contains` / `file_exists` grade deterministically. `rubric` items grade
via a fresh sub-agent reading the output against the criterion — keep
each criterion to one falsifiable sentence.

**Loop** (orchestrated by `scripts/run_skill_evals.py`):

1. **Scaffold** — `./scripts-run src/scripts/run_skill_evals scaffold {skill}`
   creates `runs/{timestamp}-{baseline,with-skill}/` and seeds each
   scenario's `meta.json`.
2. **Baseline run** — spawn one sub-agent per scenario **without** the
   skill loaded. Capture stdout + any artifacts into
   `runs/{timestamp}-baseline/{scenario-id}/`.
3. **With-skill run** — same scenarios, same sub-agent harness, **with**
   the skill loaded. Capture into `runs/{timestamp}-with-skill/{scenario-id}/`.
4. **Grade** — for each scenario, write a `grade.json` file with
   per-assertion pass/fail. Deterministic assertions auto-grade;
   rubric assertions need a grader sub-agent.
5. **Aggregate** — `./scripts-run src/scripts/run_skill_evals aggregate {skill}
   --run {timestamp}` produces `runs/{timestamp}-benchmark.json` with
   pass-rate, timing, token deltas baseline-vs-with-skill.
6. **Report** — `./scripts-run src/scripts/run_skill_evals report {skill}
   --run {timestamp}` prints the diff. Iterate on the skill body
   until `with-skill` outperforms `baseline` on every scenario.

The script ships with sub-agent spawning **stubbed** — the orchestration
layer is per-environment (Claude Code, Augment, council). Implement
the spawn function once for your environment, the rest of the loop
(aggregate / report / scaffold) works out of the box.

**Exit criterion** — every scenario passes with-skill, at least one
fails baseline (proves the skill earns its slot). Commit the
`evals.json` alongside the skill; never commit `runs/`.

Neighbors:
* `description-assist` — iterate on the trigger phrasing
* `skill-reviewer` — structural 7-Killers audit
* `lint-skills` — static checks (frontmatter, sections, size)
* `skill-improvement-pipeline` — production-learning capture

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

### Cross-references and paths

* Body links to guidelines / contracts use the verbatim relative form
  (`../../docs/guidelines/<group>/<name>.md`,
  `../../docs/contracts/<name>.md`). The condense-time rewriter
  resolves them to depth-aware single-up form — do not pre-rewrite in
  source.
* Skills do **not** declare `load_context:` / `load_context_eager:`;
  those frontmatter keys are rule-only. If a skill needs to point at a
  context, link to it inline (`[context-name](../../contexts/<area>/<file>.md)`).
* Never write `.agent-src.uncondensed/` in any skill body link or
  example — it ships into `.augment/skills/` and breaks consumer
  resolution. See `rule-writing` § 3b for the canonical reference.

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
* **Always run `./scripts-run src/scripts/skill_linter` before saving — 0 FAIL required**

## Frugality Standards

Apply the [Frugality Charter](../../contexts/contracts/frugality-charter.md)
to every skill you author.

**Examples in this artifact:**
- Per the charter's default-terse rule, the SKILL.md `## Procedure`
  opens with the action ("Run the linter"), not "Let me walk you
  through…".
- Per the cheap-question check, only emit numbered-options output
  when consequences differ — never as a stylistic choice.
- Per the post-action summary suppression, the example output ships
  the artifact, not a wrapping `## Status` / `## Summary` block.

**Pre-save self-check:**
1. Does any procedure step open with "Let me", "Now I will", "Found
   it", "OK", or "Alright"?
2. Does the skill prescribe numbered-options output without a real
   consequence trade-off?
3. Does the example output include a post-action summary block?
4. Does the description carry filler ("comprehensive", "advanced",
   "powerful")?

## Do NOT

* Write documentation-style, pointer-only, or too-broad skills ("Laravel skill")
* Skip Procedure or use vague validation
* Exceed size limits (see `docs/guidelines/agent-infra/size-and-scope.md`)
* Duplicate rules
