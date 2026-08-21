# skill-writing — procedure

> Mode body of the [`skill-writing`](../SKILL.md) skill (router-head
> retrofit, 2026-08-20). Content moved VERBATIM from SKILL.md — load this
> file when the mode table in SKILL.md routes here.

## Procedure

### 0. Inspect, then run the Drafting Protocol

Before writing, **inspect** the landscape: grep
`src/skills/` and `src/rules/` for duplicates or
near-matches, and **analyze** 1–2 gold-standard peers (e.g. `pest-testing`,
`php-coder`) to anchor shape and tone. If requirements are unclear or
incomplete, stop and ask — do not assume.

Then run the Understand → Research → Draft sequence from the
[`artifact-drafting-protocol`](../../../rules/artifact-drafting-protocol.md)
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
[capability-boundary matrix](../../../../../docs/contracts/capability-boundary.md): the
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
**≤ 200 characters** (`skill_linter.ts` errors `description_too_long` above
that — a hard cap). When trimming to fit, drop adjectives or the second example phrasing
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
[`description-assist`](../../description-assist/SKILL.md) skill — it runs the
approval-gated propose / pick loop with at most two rounds.

### 1c. Propose a trigger-eval stub (new skills only)

When creating a new skill, propose a stub
`src/skills/{name}/evals/triggers.json` before writing
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

Presence is CI-enforced for new skills: `check_trigger_eval_presence`
fails any skill outside the shrink-only grandfather allowlist that
lacks `evals/triggers.json` — *skip* therefore defers the queries'
quality, never the file itself.

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
src/skills/{name}/evals/
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

**Loop** (orchestrated by `scripts/run_skill_evals.ts`):

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
