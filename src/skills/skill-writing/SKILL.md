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

Skills in `src/skills/{name}/SKILL.md` AND commands in
`src/domains/{domain}/{name}/command.md` both project into
`.claude/skills/` (see `scripts/condense.ts` →
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
* Over the 400-line K6 cap → the **router-head contract** in `templates/skill.md`
  applies: entry head (when-to-use · mode table · routing) plus one `tasks/` or
  `references/` file per mode, and the head never inlines more than one mode's
  procedure. Gated by `lint_skill_router_head` with a shrink-only allowlist.
* If multiple workflows exist → split into multiple skills
* If two skills overlap heavily → merge
* If a skill becomes "read the guideline" → it lost its purpose, restore the workflow

### Progressive disclosure — the directory is `references/`, plural

When a skill needs depth the workflow does not, the depth goes in a
**`references/`** subdirectory beside `SKILL.md` — that exact name, plural. It
was two spellings across nine skills until 2026-08-12 because nothing here
named one; the split cost a rename, not a decision.

* **Body:** the trigger, the workflow, the ownership statement, and every
  heuristic that changes a write decision. A skill whose body is a map to its
  own content is loaded and not applied.
* **`references/`:** corpora, lookup tables, long schemas, worked examples —
  read on the path that needs them, never on every activation.

Splitting is not a size escape hatch. The measured estate (n=289, 2026-08-12):
median 1,077 words, p90 1,867, **only 6 skills above 2,500 and 4 above 3,000**.
So a skill at 1,500 words is ordinary, and moving prose out of the body to hit
a number makes it worse. Split when the material is genuinely
consulted-on-demand; keep the load-bearing part in the body even when that
leaves the file long.

A `references/` split does not change the gates that already apply: a
`token_budget_class: rich` skill still meets its 3,500-token ceiling on the
body alone.

## Procedure

### 0. Inspect, then run the Drafting Protocol

Before writing, **inspect** the landscape: grep
`src/skills/` and `src/rules/` for duplicates or
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
[`description-assist`](../description-assist/SKILL.md) skill — it runs the
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

## Read-only-by-default scripts

A script shipped inside a skill (`scripts/**`) is **side-effect-free by
default** — it inspects, computes, and prints; it does not mutate the
filesystem. Any mutation (writing a file, deleting, rename/copy) must be gated
behind an explicit flag named in this SKILL.md — `--writable` / `--apply` /
`--write` / `--output` / `--fix` — so the default invocation is safe to run
blind. A generator whose *declared purpose* is to write (it emits an artifact
to a caller-supplied path) is allowlisted with a rationale in
`src/scripts/lint_skill_scripts_readonly_allowlist.json` rather than carrying a
redundant flag. `lint_skill_scripts_readonly` enforces this: an ungated,
non-allowlisted write fails the build.

## Description-optimizer loop (U1 — held-out, not vibes)

Descriptions are the trigger surface; tune them like a model, not like prose:

1. Draft 2-3 candidate descriptions for the skill.
2. Ensure `evals/triggers.json` has should- AND should-not-trigger queries
   (grow beyond the 5+5 stub when optimizing — more queries = a real test split).
3. Run the helper: `npx tsx src/scripts/optimize_skill_description.ts
   --skill <id> --candidate "…" [--candidate "…"] [--live]` — it splits the
   queries deterministically into train/held-out, scores every candidate
   (deterministic token-overlap proxy by default; `--live` = haiku judge,
   ~$0.001 per query·candidate), and picks the best **held-out** accuracy.
4. Adopt the pick ONLY if it beats the current description on the held-out
   split — a train-only win is overfitting to the queries you wrote.

## Self-QA loop for output-producing skills (optional pattern)

For skills whose product is a rendered/structural artifact (decks, docs,
diagrams, dashboards, generated UI): **assume there are problems** and have a
fresh-eyes pass find them before handing back. The author-context is blind to
its own omissions; a context-free verifier is not.

1. Produce the artifact.
2. Dispatch a fresh subagent (no authoring context) with ONLY the artifact +
   the acceptance criteria: "list every visual/structural defect; assume at
   least one exists."
3. Fix what it finds; re-run once. Two clean passes → done.

Worked example (deck skill): the author renders 12 slides; the fresh-eyes
pass gets the PDF + "check overflow, contrast, orphaned bullets, broken
images" — it flags a clipped title on slide 7 the author never re-read.
One fix, one re-check, done.

Scope: complements `verify-before-complete` (which gates the completion
claim); this pattern is HOW to get the fresh evidence for artifacts where no
deterministic checker exists. Skip it when a real validator covers the
surface (linter, schema, test) — deterministic checks beat judge passes.

## Known-pitfalls section (optional pattern, tool skills)

Tool/integration skills teach the happy path; the recurring support burden is
the *silent* failures — the ones that cost money, corrupt state, or fail with no
error. For a high-support-burden tool skill, add a `## Known pitfalls` section
in this micro-format:

1. **A Symptom → Root cause → Fix table.** Each row starts from the *observable
   symptom* (what the user sees), not the internal cause — the user greps for
   the symptom, not the fix.

   | Symptom | Root cause | Fix |
   |---|---|---|
   | `<what the user observes>` | `<why it happens>` | `<the concrete action>` |

2. **Optionally, a quick-reference anti-pattern checklist** (Anti-pattern ·
   cost/impact · fix difficulty) for traps worth scanning before shipping — add
   it only when it does not restate the skill's existing `## Gotcha` / `## Do
   NOT`; the table is the load-bearing part.

Sourcing floor — **real, not invented**: every entry names a genuinely common
failure (a high-vote community question, a documented incident class), never a
hypothetical. **≤ 5 entries per skill.** The value is a short, sourced,
high-signal list; a long one is noise. A pitfall is a *section on the existing
tool skill*, **never** a new skill per pitfall and never a generated grid (see
[`size-enforcement`](../../rules/size-enforcement.md) § Per-tool pitfall
content).

## Rationalizations-to-reject section (recommended pattern, security-stop-routed skills)

A skill routed by `security-sensitive-stop` already carries a forbidden-moves or
failure-mode list. Those describe **what is wrong**. They do not answer the
sentence the agent actually produces at the moment it skips the control:
*"this one is internal, so the tenant check is not needed here."*

So those skills add `## Rationalizations to reject`, where each entry is a pair:

- **the shortcut, in the words it will be argued in** — not a label. "It is an
  internal endpoint" beats "insufficient authorization".
- **the mechanism that defeats it** — the concrete fact that makes the argument
  wrong. "Internal is a network claim, not an identity claim; the object id
  still comes from the request."

Writing the shortcut in its persuasive form is the whole point. A list of
labelled anti-patterns is matched against by a reader who has already decided;
a list of *arguments* is matched against by a reader mid-decision, which is when
the skip actually happens.

Keep it to the arguments that have really been made. An invented rationalization
teaches nothing and dilutes the ones that recur.

## Non-negotiable-deliverable section (recommended pattern, adjacent-technology clusters)

Some skills sit next to a technology that is a *tempting wrong answer* — close
enough to look interchangeable, different enough that picking it silently loses
something. The framework-cluster skills the routing rules already disambiguate
pairwise are the standing example.

For those, state the deliverable as a constraint rather than as a preference:

1. **What the output must use.** One sentence, unhedged.
2. **The substitutes to refuse, named.** The agent will meet them; naming them
   is what makes the refusal recognisable rather than a judgement call.
3. **What each substitute loses.** This is the load-bearing line. A prohibition
   without a cost reads as arbitrary and gets argued away the first time the
   substitute is more convenient; a named loss survives that conversation.

The routing rules answer *which skill loads*. This section answers *what the
skill may emit once it has loaded* — a different question, and the one that goes
wrong quietly.

## Destructive-operation gates belong in the description

If a skill performs an operation the user cannot undo — deleting, removing,
publishing, spending — the confirmation gate goes in the **description**, not
only in the body.

The reason is routing order: the description is what the agent reads when
choosing a skill, and the body loads afterwards. A gate stated only in the body
is invisible at exactly the moment the skill is being selected for a task whose
shape the gate might forbid.

One clause is enough — `worktree-lifecycle` carries "safe cleanup that refuses
while unique unmerged commits exist", which tells a router both what the skill
does and what it will not do. Verified by
`./scripts-run src/scripts/lint_skill_descriptions`.

## Upstream-version-notes section (optional pattern, wrapped fast-moving tools)

A skill that wraps an external tool is written against one version of it. When
the tool renames a flag, restructures its report, or drops a subcommand, the
skill does not fail loudly — it fails as **the agent concluding the skill is
wrong**, or, worse, inventing the removed surface so its own instructions still
make sense. Both are silent.

For a skill wrapping a tool that moves faster than this package's release
cadence, add `## Upstream version notes` carrying exactly three things:

1. **The version this skill was written against, and the date it was checked.**
   A version alone rots into a claim nobody can date.
2. **What was renamed** — old → new, one line each. This is the row that stops
   an agent inventing a flag that no longer exists.
3. **How to read older output** — the agent will meet reports from earlier
   versions in logs, issues and fixtures, and needs to know which fields moved
   rather than guessing.

State briefly what is **unchanged** too. "The subcommand set is unchanged since
X" is what lets an agent trust the rest of the skill after finding one stale
flag, instead of second-guessing every instruction that follows.

Scope floor — add it only where drift is **observed**, never anticipated. A
version-notes block on a stable tool is maintenance with no reader, and a stale
one is worse than none: it is a dated claim that is now false.

## Security-constraints section (required pattern, script-bearing skills)

A skill that ships an executable script carries its constraints in the
always-loaded rules — `tool-safety`, `runtime-safety`, `lethal-trifecta-guard`.
That holds while the skill is read inside this suite. It stops holding the
moment the script travels: vendored into a consumer, copied into another
project, or run by an agent whose rule set is not ours. The constraints stay
behind; the script does not.

So a skill with anything under its `scripts/` directory states them **on the
artifact**, in a `## Security constraints` section:

- **What it may touch** — the paths and hosts it legitimately reads or writes.
  Naming the boundary is what makes an overreach reviewable.
- **What it must never do** — the prohibitions specific to THIS script, not a
  restatement of the general rules. "Never writes outside the target directory"
  is checkable; "follows security best practice" is not.
- **Its default-invocation behaviour** — read-only or mutating. A script that
  mutates on a bare invocation already violates the `## Do NOT` list below; if
  it is gated behind a flag, name the flag here.
- **What it sends outbound, if anything** — the egress leg of the lethal
  trifecta. A script with no network access says so in four words, and that
  sentence is the cheapest possible answer to a reviewer's first question.

This duplicates the rules on purpose, and the duplication is the point: the
rules are the enforcement, the section is what survives the artifact leaving
their reach.

## Action-reference split (required pattern, `safety_mode: strict` skills)

`execution.safety_mode: strict` says the skill's execution path may mutate
something. That is a claim made in the frontmatter, and until the body backs it
the claim costs nothing: a reader who follows the procedure top to bottom finds
the mutating step sitting inline with every other step, indistinguishable from a
read.

A strict skill therefore takes one of exactly two shapes, and says which:

- **Gate it inline.** The mutating step carries its precondition in the same
  breath — propose the exact command first, `--dry-run` before the live run, the
  user confirms, verify the effect landed afterwards. The precondition is part of
  the step, never a general reassurance three sections away.
- **Defer it.** The SKILL.md states plainly that it **does not define the
  mutating workflow**, and points the write-path steps at a file under the
  skill's own `references/`. The pointer is the precondition's home: the
  reference opens with what must be true before its first step runs.

Deferring is the better shape once the write path has more than a couple of
steps, and for the reason the split exists at all — the main body stays readable
as the thing an agent loads to decide *whether* to act, while the steps that
change something live behind one deliberate extra read. What it must never
become is a second copy: the reference holds the write path, the SKILL.md holds
the pointer, and neither restates the other.

`skill_linter` nudges (`strict_mode_missing_write_gate`, warning) when a strict
skill's body carries neither shape. It is a warning and it matches on prose, so
treat it as a prompt to check the body rather than a verdict on it — a skill that
gates its write path some third way is doing the right thing and should say so
plainly enough that the next reader sees the gate without running the linter.

Read with § Security-constraints above: that section states what the script may
touch, this one states what must be true before it touches it.

## Mechanism-teaching section (optional pattern, skills whose subject has one)

A procedure tells the agent what to do in the cases you thought of. A
**mechanism** tells it why those steps work, which is the only thing that
transfers to the case you did not. Where a skill's subject has a mechanism worth
one screen — how the cascade resolves, why the queue drops the message, what the
scheduler actually orders — state it in a `## How it works` section, ahead of the
procedure that depends on it.

Keep it to one screen and to mechanisms only: no history, no alternatives-considered,
no restating the procedure in prose. If it takes more than a screen, the skill is
carrying a guideline's worth of material and should point at one instead.

The test for whether it earns its place: name a plausible situation the procedure
does not cover, and check whether this section is enough to answer it. If the
answer is still "read the source", the section is decoration.

Optional, and it gets no gate: "teaches a mechanism" is a prose judgement, and a
predicate over prose is the false-positive class this file's other patterns avoid.

## Illustrative-not-verbatim marker (optional pattern, reference code)

A code block in a skill is read as copy-me by default. When a block is teaching a
*shape* — a signature to mirror, a structure to follow, pseudocode standing in for
the real call — say so on the line above it:

```
<!-- illustrative: shape only, not a working snippet -->
```

One line, immediately above the fence, in the skill's own words if you prefer.
What matters is that the reader can tell shape-teaching code from code that runs,
because the failure mode is silent: an agent pastes the illustration, it almost
works, and the debugging starts from the wrong premise.

The inverse deserves the same care — a block that IS meant to be run verbatim,
where a reader might assume otherwise, says so too. See also `### 4. Add
safe/unsafe example`, which governs a different axis: safe-vs-unsafe, not
runnable-vs-illustrative.

## Headline metric + closing report (optional pattern, optimization skills)

A skill whose job is to make something better — smaller, faster, cheaper, quieter
— has to say **which single number it moves**. Without one, "optimized" is a
claim nobody can check and every run reports success.

So an optimization skill names, up front:

1. **The headline metric.** One number, with its unit and how it is measured.
   "Initial-context tokens, measured by `audit-tokens`" — not "context cost".
2. **The closing report shape.** Before, after, delta, and the command that
   produced both. The same command for both readings, or the delta is not a delta.

State what the metric does **not** capture, in one line. An optimization that
moves the headline number by degrading something it does not measure is the
failure this pattern exists to make visible, and only the author knows where that
edge is.

## Contrastive-example slot (optional pattern, authoring and behaviour skills)

Where a skill's guidance is easy to agree with and hard to apply — tone, phrasing,
question shape, what counts as evidence — a wrong/right pair does what prose
cannot: it shows the near-miss. Six live corpora already carry them:
[`direct-answers-demos`](../../../docs/guidelines/agent-infra/direct-answers-demos.md),
[`asking-and-brevity-examples`](../../../docs/guidelines/agent-infra/asking-and-brevity-examples.md),
[`language-and-tone-examples`](../../../docs/guidelines/agent-infra/language-and-tone-examples.md),
and `autonomy-examples` / `interrupt-examples` / `cheap-question-mechanics` under
`src/agent-src/contexts/execution/`.

Follow one of those rather than inventing a format. The shape they share: the
**wrong** version first, in the form it actually gets written; the **right**
version second; and one line of **why** — which is the load-bearing part, because
a pair without it teaches the specific case and not the rule.

Put the corpus in a guideline or context file and point at it from the skill when
it outgrows a section. A near-miss corpus is reference material read on demand,
not always-loaded prose.

## Do NOT

* Write documentation-style, pointer-only, or too-broad skills ("Laravel skill", "Django skill")
* Skip Procedure or use vague validation
* Exceed size limits (see `docs/guidelines/agent-infra/size-and-scope.md`)
* Duplicate rules
* Ship a skill script that mutates the filesystem on its default invocation — gate it behind a flag or allowlist it with a rationale

## Encode usage policy in the description

Workflow sequencing, preconditions, ID/output provenance ("copy ids verbatim,
never from memory"), a mandatory "why" intent field, and turn-end contracts
belong INSIDE this artifact's description/frontmatter — where they fire at the
decision point — not in always-on prose. See
[`tool-description-as-policy`](../../../docs/guidelines/agent-infra/tool-description-as-policy.md).
