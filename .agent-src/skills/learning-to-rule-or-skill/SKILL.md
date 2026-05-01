---
name: learning-to-rule-or-skill
description: "Use when a repeated learning, mistake, or successful pattern should be turned into a new rule or skill. Also use after completing a task to capture learnings from the work."
source: project
execution:
  type: assisted
  handler: internal
  allowed_tools: []
---

# learning-to-rule-or-skill

## When to use

Use this skill when:

* A repeated mistake appears across multiple tasks
* A successful pattern should be reused in the future
* A new constraint or workflow should be captured permanently
* Reviewing post-task learnings or retrospectives
* Deciding whether a learning belongs in a rule or a skill
* After completing a task — reflecting on what worked or caused friction

Do not use this skill when:

* The learning is one-off and unlikely to repeat
* The issue is too vague to turn into guidance
* The content already exists in an equivalent rule or skill

## Goal

* Turn repeated learnings into reusable project guidance
* Decide correctly between rule, skill, or update to an existing one
* Prevent the same mistakes from happening again
* Keep the system small, clear, and non-duplicative

## Preconditions

* A concrete learning, mistake, or successful pattern exists
* The learning can be stated clearly in one or two sentences
* Existing rules and skills can be checked for overlap

## Decision matrix

| If the learning is... | Then... | Action |
|---|---|---|
| An always-true constraint ("never X", "always Y") | **Rule** | Create/update rule |
| A repeatable workflow with steps and validation | **Skill** | Create/update skill |
| A coding convention or reference material | **Guideline** | Create/update guideline |
| Baseline model knowledge or standard tool usage | **Nothing** | Do not create anything |
| A refinement of existing guidance | **Update** | Extend the existing file |

### Decision hints

* Same issue appeared at least twice → strongly consider codifying
* One-off or too narrow → do not create anything yet
* Standard tool knowledge (jq, docker, git basics) → **Nothing** — the model knows this
* If unsure between skill and guideline: does it need step-by-step decisions? → Skill. Just conventions? → Guideline

## Procedure

### 0. Promotion Gate (mandatory)

Before proceeding, the learning MUST pass all gates:

| Gate | Question |
|---|---|
| Repetition | Occurred 2+ times OR clearly generalizable? |
| Impact | Improves correctness, reliability, or consistency? |
| Failure pattern | Prevents a real, observed failure? |
| Non-duplication | No existing rule/skill/guideline/command covers this? **Verify via § 4 search protocol — a negative grep alone is not proof.** |
| Scope fit | Fits rule, skill, or guideline? |
| Minimal | Update existing preferred over creation? |

If ANY gate fails → **stop**. Do not create or update anything.
→ See `capture-learnings` rule for rejection criteria.

### 1. State the learning clearly

Write as a concrete sentence.

Good:
* Nested triple backticks break copyability in generated markdown
* Route inspection is more reliable via JSON and jq than text parsing

Bad:
* Markdown is annoying
* Routing was confusing

### 2. Identify the pattern type

Classify by type:
* Constraint
* Workflow
* Anti-pattern
* Quality check
* Environment-specific convention

Tag with feedback category (for tracking/aggregation):
* `skill-weakness` — skill gave wrong or incomplete guidance
* `rule-weakness` — rule was too vague or missed a case
* `routing-issue` — wrong skill was selected
* `assumption-issue` — agent made bad assumptions
* `verification-gap` — verification step was missing or weak
* `optimization-overreach` — optimize command suggested harmful change

### 3. Decide the target

Choose one:
* New rule (always-true constraint)
* Update existing rule
* New skill (step-by-step workflow)
* Update existing skill
* New guideline (coding convention / reference)
* Update existing guideline
* **Nothing** (baseline knowledge, standard tool usage, one-off)

### 4. Check for overlap — search protocol (mandatory)

A grep that returns zero hits is **not** proof of no overlap. Knowledge in
this package is distributed across **four surfaces** — `skills/`, `rules/`,
`guidelines/`, `commands/`. Skip any of them and recall drops to ~25 %.
Run all four steps before declaring "no overlap":

**Step 1 — list all four surfaces.** Directory taxonomy is free evidence:

```bash
ls .agent-src.uncompressed/skills/ \
   .agent-src.uncompressed/rules/ \
   .agent-src.uncompressed/guidelines/ \
   .agent-src.uncompressed/commands/
```

Sub-directories matter — `guidelines/php/patterns/`, `guidelines/agent-infra/`,
etc. carry topic taxonomies a flat file scan misses. Always descend one level.

**Step 2 — grep with both vocabularies.** Search for **solution-words** *and*
**problem-words**. Solution-only grep is confirmation bias — the existing
artifact may name the *symptom*, not the cure.

| Vocabulary | Example for "agents miss Strategy pattern, write switch chains" |
|---|---|
| Solution-words | `strategy`, `registry`, `polymorph`, `interface` |
| Problem-words | `discriminator`, `enum.*match`, `switch.*on`, `if.*else.*chain` |

```bash
grep -rl -E "<solution-words>|<problem-words>" .agent-src.uncompressed/
```

**Step 3 — taxonomy scan.** For any topic with a likely sub-folder
(`patterns/`, `php/`, `laravel/`, `agent-infra/`), `ls` that folder
*before* reading any file. Filename alone often answers the overlap question.

**Step 4 — sample, do not just list.** On *any* keyword overlap from
steps 2–3, **open and skim the 3 nearest matches** — read § headings, the
"When to use" / "Overview" block, and the examples list. Listing filenames
is not enough; semantic overlap hides behind unrelated keywords.

Only after all four steps return clean → declare "no overlap" and proceed.
Citation in the proposal: *"Reviewed before drafting: <files skimmed>"* —
this is the audit trail § 0's Non-duplication gate verifies against.

→ When the parent task is "create a new artifact", `artifact-drafting-protocol`
Phase B (Research) requires this same protocol — single source of truth.

### 5. Draft the content

If rule:
* Short, durable constraint
* General, clear, always applicable

If skill:
* Focused workflow
* Include: When to use, Procedure, Output format, Gotchas, Do NOT

### 6. Validate usefulness

* Will this improve future outputs?
* Specific enough to act on?
* Different from existing guidance?
* Likely to matter more than once?

### 7. Keep only the smallest effective change

Prefer:
* Update over duplicate
* Small focused skill over broad skill
* Short rule over long rule

### 8. Write the proposal (if scope ≠ nothing)

The output of this skill is a **curated proposal** under
`agents/proposals/<proposal_id>.md`, using the template at
`.augment/templates/agents/proposal.example.md` (shipped by the
package). This is the input to the five-stage pipeline
(capture → classify → propose → gate → upstream); see
[`self-improvement-pipeline`](../../guidelines/agent-infra/self-improvement-pipeline.md).

Mandatory fields the draft MUST fill:

* `proposal_id` — stable kebab-case slug, unique in this repo
* `type` — `rule` | `skill` | `command` | `guideline`
* `scope` — `project` (stays in `agents/overrides/`) or `package`
  (contributed upstream via `upstream-contribute`)
* `source_learning` — path to the `agents/learnings/<date>-<slug>.md`
  file this proposal was captured from
* `evidence` — **at least two independent** references (PR, issue,
  incident, review-comment, test-failure); entries that all resolve
  to the same PR are rejected by the gate
* `Proposed artefact` (§4) — the full draft body, no `TODO` / `TBD`
* `Success signal` (§7) — one metric, one baseline, one target, one
  evaluation date

Run `./agent-config proposal:check agents/proposals/<id>.md`
before handing to `upstream-contribute`. The
gate is hard: non-zero exit = the proposal does not move
to stage `gated`.

## Output format

For the **decision step** (what this skill prints to the user):

1. Learning summary
2. Decision: rule, skill, update, or no action
3. Rationale in one to three lines
4. If decision ≠ "no action": path of the written proposal
   (`agents/proposals/<proposal_id>.md`) and gate status
   (`./agent-config proposal:check` exit 0 = ready for review)

The **proposal file itself** follows
`proposal.example.md` verbatim — all ten sections, YAML frontmatter
complete, draft body in §4.

## Core rules

* Capture repeated patterns, not random observations
* Prefer updating existing guidance over creating duplicates
* Rules are for durable constraints
* Skills are for repeatable workflows
* Keep new guidance as small and focused as possible

## Gotchas

* Model tends to create new files when a small update is enough
* Model tends to turn vague frustrations into bad guidance
* Model may write documentation instead of reusable instructions
* Over-capturing weak learnings creates noise and reduces quality

## Do NOT

* Do NOT create a rule or skill for one-off problems
* Do NOT duplicate existing guidance
* Do NOT create broad "catch-all" skills
* Do NOT write vague learnings without a concrete behavioral consequence

## Auto-trigger keywords

* learning
* retrospective
* repeated mistake
* recurring issue
* create rule from learning
* create skill from learning
* codify this
* capture this pattern
* after task
* what did we learn
* post-mortem

## Anti-patterns

* Creating a skill for every minor annoyance
* Rule that says "be careful" without concrete constraint
* Skill that duplicates an existing one with slightly different wording
* Capturing a learning before it has repeated

## Examples

Learning: "Nested triple backticks broke markdown copyability twice this week."
Decision: Update existing markdown rule + add markdown-safe skill if none exists.

Learning: "Route checks keep failing when done via text parsing."
Decision: Create focused skill for Laravel route inspection via JSON and jq.

Learning: "I forgot to run PHPStan once."
Decision: No action — one-off, already covered by verify-before-complete rule.

## Environment notes

Prefer updating existing rule/skill when possible.
Create new files only when the learning introduces a clearly distinct pattern.
