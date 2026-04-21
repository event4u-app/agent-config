---
type: "auto"
alwaysApply: false
description: "Use when the user asks to create a new skill, rule, command, or guideline, or to significantly rewrite an existing one — even if they don't explicitly say 'new artifact' or 'drafting protocol'. Runs a mandatory Understand → Research → Draft sequence before anything is written."
source: package
---

# Artifact Drafting Protocol

User asks to build a new **skill, rule, command, or guideline** — or
significantly rewrite one — agent runs **Understand → Research → Draft**
first. Each phase ends with numbered-options prompt. User approves,
modifies, or stops at each step.

## When this rule fires

**Triggers (EN):** *"create a new skill / rule / command / guideline"*,
*"build me a skill for …"*, *"I need a rule that …"*, *"add a command
for …"*, *"write a guideline on …"*, *"refactor this skill from
scratch"*.

**Triggers (DE):** *"bau mir ein Skill"*, *"neue Regel für …"*,
*"Command für …"*, *"Guideline zu …"*, *"das Skill neu schreiben"*.

**Does NOT fire for:**

- One-line edits, typo fixes, frontmatter-only updates
- Description-only rewrites with a specific target phrasing given
- Edits to existing artifacts touching < 10 lines
- Explicit bypass: *"just write it"*, *"skip protocol"*, *"einfach machen"*

Fires **once per creation task**, not per edit within the task.

## Phase A — Understand (agent asks, user answers)

Ask **up to 5** clarifying questions, numbered options (per
`user-interaction`). Each offers *"skip / I don't know yet"*:

1. **Problem** — What does this solve that no existing artifact solves?
2. **Trigger surface** — On which user phrasings should this fire?
3. **Should-trigger examples** — 2-3 in the user's own words.
4. **Near-miss cases** — 2-3 phrasings that must **not** fire.
5. **Artifact type** — Skill, rule, command, or guideline? Offer a
   3-line primer if unsure.

If user skips Q1 or Q5 → stop, surface ambiguity. Don't guess.

## Phase B — Research (agent reads, reports findings)

Scan `.agent-src.uncompressed/` for overlap before drafting. Report:

- Top 3-5 most-similar existing artifacts by name + description
- Existing rules/skills that overlap, if any
- Whether this is a `learning-to-rule-or-skill` promotion case

Present findings as numbered options:

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

Research summary carries into the draft commit message (*"Reviewed
before drafting: laravel-validation, api-testing"*).

## Phase C — Draft (agent proposes variants, user picks)

Propose **two or three** description variants, labeled:

- **Conservative** — short, polite, probably undertriggers
- **Pushy** — follows `skill-quality`'s pushy-description pattern
- **Concrete** — embeds a specific trigger example

User picks one or asks for a merge. Only then draft the body. Every
structural choice (size, section order, examples) surfaces as a
numbered option if the agent has doubt.

Enforce size budget live: *"Body at 420/500 lines. Consider splitting
into `foo-basics` + `foo-advanced`."* (per `size-enforcement`.)

## Interaction with existing rules

This rule **extends** — does not replace:

- `ask-when-uncertain` — Phase A is one concrete instance of its
  "ask when in doubt" policy.
- `improve-before-implement` — Phase B Research *is* the
  validate-against-existing-code step, specialized for artifacts.
- `user-interaction` — numbered-options conventions apply verbatim.
- `skill-quality` — Phase C variants all respect the pushy-description
  pattern.

When an existing rule answers a question, cross-link instead of
restating.

## Golden rules

- **Every phase ends with numbered-options prompt.** No silent progression.
- **Zero autopilot.** Agent proposes; human decides.
- **Max two propose → reject cycles per artifact.** If rejected twice,
  ask one clarifying question, then stop.
- **Commit only on approval.** Drafts land in working tree; commit is
  separate user action.
- **Bypass is legitimate.** *"Just write it"* drops the protocol and
  proceeds with best-effort draft.
