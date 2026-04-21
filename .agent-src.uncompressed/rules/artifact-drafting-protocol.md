---
type: "auto"
alwaysApply: false
description: "Use when the user asks to create a new skill, rule, command, or guideline, or to significantly rewrite an existing one — even if they don't explicitly say 'new artifact' or 'drafting protocol'. Runs a mandatory Understand → Research → Draft sequence before anything is written."
source: package
---

# Artifact Drafting Protocol

When the user asks to build or significantly rewrite a **skill, rule,
command, or guideline**, the agent does **not** start writing. It runs
three phases: **Understand → Research → Draft**. Each phase ends with a
numbered-options prompt (per `user-interaction`).

## When this rule fires

Triggers: *"create a new skill/rule/command/guideline"*, *"build me a
skill for …"*, *"refactor this skill from scratch"*, and the DE
equivalents (*"bau mir ein Skill"*, *"neue Regel für …"*).

**Does NOT fire:** typo/frontmatter-only edits, description-only
rewrites with a specific target phrasing, < 10-line edits, or explicit
bypass (*"just write it"*, *"skip protocol"*, *"einfach machen"*).
Fires once per creation task, not once per edit.

## Phase A — Understand

Ask up to **5** clarifying questions (numbered options, each with a
*"skip / I don't know yet"* escape):

1. **Problem** — what does this solve that no existing artifact solves?
2. **Trigger surface** — which user phrasings should fire this?
3. **Should-trigger examples** — 2-3 in the user's words.
4. **Near-miss cases** — 2-3 phrasings that must **not** fire.
5. **Artifact type** — skill, rule, command, or guideline? Offer a
   3-line primer if unsure.

If the user skips Q1 or Q5, stop and surface the ambiguity — don't guess.

## Phase B — Research

Scan `.agent-src.uncompressed/` for overlap. Report the top 3-5
most-similar artifacts and ask (numbered options):

- Extend an existing one?
- Create a new one — gap is real?
- Show overlap first?
- Promote via `learning-to-rule-or-skill` instead?

Carry the summary into the commit message (*"Reviewed before drafting:
X, Y"*).

## Phase C — Draft

Propose **2-3 description variants** — Conservative / Pushy
(per `skill-quality`) / Concrete (embedded trigger example). User picks
or merges. Only then draft the body. Surface every structural choice
(size class, section order) as numbered options if in doubt.

Enforce size live: *"Body is at 420/500 lines. Split?"* (budgets per
`size-enforcement`). New skills also get an `evals/triggers.json` stub
(5 should-trigger + 5 should-not-trigger). See `skill-writing` § 1c.

## Golden rules

- Every phase ends with a numbered-options prompt. No silent progression.
- Zero autopilot — agent proposes, human decides.
- At most two propose → reject cycles; then stop.
- Commit only on approval.
- Bypass is legitimate — *"just write it"* drops the protocol immediately.

Extends (cross-link, don't restate): `ask-when-uncertain`,
`improve-before-implement`, `user-interaction`, `skill-quality`.
