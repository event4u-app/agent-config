---
type: "auto"
alwaysApply: false
description: "Use when the user asks to create a new skill, rule, command, or guideline, or to significantly rewrite an existing one — even if they don't explicitly say 'new artifact' or 'drafting protocol'. Runs a mandatory Understand → Research → Draft sequence before anything is written."
source: package
---

# Artifact Drafting Protocol

When the user asks the agent to build a new **skill, rule, command, or
guideline** — or to significantly rewrite one — the agent does **not**
start writing. It runs a three-phase protocol first: **Understand →
Research → Draft**. Every phase ends with a numbered-options prompt.
The user approves, modifies, or stops at each step.

## When this rule fires

**Triggers (EN):** *"create a new skill / rule / command / guideline"*,
*"build me a skill for …"*, *"I need a rule that …"*, *"add a command
for …"*, *"write a guideline on …"*, *"refactor this skill from
scratch"*.

**Triggers (DE):** *"bau mir ein Skill"*, *"neue Regel für …"*,
*"Command für …"*, *"Guideline zu …"*, *"das Skill neu schreiben"*.

**Does NOT fire for:**

- One-line edits, typo fixes, frontmatter-only updates
- Description-only rewrites that already have a specific target phrasing
- Edits to existing artifacts touching < 10 lines
- Explicit bypass: *"just write it"*, *"skip protocol"*, *"einfach machen"*

Fires **once per creation task**, not once per edit within the task.

## Phase A — Understand (agent asks, user answers)

Ask **up to 5** clarifying questions using numbered options (per the
`user-interaction` rule). Each question gets a *"skip / I don't know
yet"* option:

1. **Problem** — What does this solve that no existing artifact solves?
2. **Trigger surface** — On which user phrasings should this fire?
3. **Should-trigger examples** — 2-3 in the user's own words.
4. **Near-miss cases** — 2-3 phrasings that must **not** fire.
5. **Artifact type** — Skill, rule, command, or guideline? Offer a
   3-line primer if the user is unsure.

If the user answers *"skip"* on Q1 or Q5, stop and surface the
ambiguity — do not guess.

## Phase B — Research (agent reads, reports findings)

Before drafting, scan `.agent-src.uncompressed/` for overlap. Report
back:

- Top 3-5 most-similar existing artifacts by name + description
  similarity
- Which existing rule/skill already covers an overlap, if any
- Whether this should be a `learning-to-rule-or-skill` promotion rather
  than a new artifact

Present the findings as numbered options, e.g.:

```
> Found 3 similar artifacts:
>   • `laravel-validation` — already covers FormRequest rules
>   • `api-testing` — covers contract tests
>   • `api-design` — covers REST conventions
>
> 1. Extend `laravel-validation` — add a section, no new file
> 2. Create new skill — coverage gap is real
> 3. Show me the overlap first
> 4. Cancel
```

The research summary is carried forward into the draft commit message
(*"Reviewed before drafting: laravel-validation, api-testing"*).

## Phase C — Draft (agent proposes variants, user picks)

Propose **two or three** frontmatter description variants, clearly
labeled:

- **Conservative** — short, polite, probably undertriggers
- **Pushy** — follows `skill-quality`'s pushy-description pattern
- **Concrete** — embeds a specific trigger example

User picks one or asks for a merge. Only then does the agent draft the
body. Every structural choice (size class, section order, examples) is
surfaced as a numbered option if the agent has doubt.

Enforce the size budget live: *"Body is at 420/500 lines. Consider
splitting into `foo-basics` + `foo-advanced`."* (Size budgets per
`size-enforcement`.)

## Interaction with existing rules

This rule **extends** — it does not replace:

- `ask-when-uncertain` — the Understand phase is one concrete instance
  of that rule's "ask when in doubt" policy.
- `improve-before-implement` — Phase B Research *is* the
  validate-against-existing-code step, specialized for artifacts.
- `user-interaction` — all numbered-options conventions apply verbatim.
- `skill-quality` — Phase C's description variants must all respect
  the pushy-description pattern.

No duplication. When an existing rule already answers a question,
cross-link instead of restating.

## Golden rules

- **Every phase ends with a numbered-options prompt.** Never silent
  progression.
- **Zero autopilot.** The agent proposes; the human decides.
- **At most two propose → reject cycles per artifact.** If the user
  rejects twice, stop and ask one clarifying question, then stop.
- **Commit only on approval.** Drafts land in the working tree — the
  commit is a separate, user-triggered step.
- **Bypass is legitimate.** *"Just write it"* immediately drops the
  protocol and proceeds with the agent's best-effort draft.
