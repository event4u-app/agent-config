---
type: "auto"
tier: "2a"
alwaysApply: false
description: "Creating a new skill/rule/command/guideline or significantly rewriting one — runs mandatory Understand → Research → Draft first"
triggers:
  - intent: "create new skill"
  - intent: "create new rule"
  - intent: "create new command"
  - intent: "create new guideline"
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# Artifact Drafting Protocol

```
NEVER START WRITING WITHOUT THE UNDERSTAND → RESEARCH → DRAFT PHASES.
EVERY PHASE ENDS WITH A NUMBERED-OPTIONS PROMPT. NO SILENT PROGRESSION.
ZERO AUTOPILOT. AGENT PROPOSES, HUMAN DECIDES. COMMIT ONLY ON APPROVAL.
```

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

Run the **search protocol** from
[`learning-to-rule-or-skill` § 4](../skills/learning-to-rule-or-skill/SKILL.md#4-check-for-overlap--search-protocol-mandatory)
— `ls` all four surfaces (`skills/`, `rules/`, `guidelines/`, `commands/`),
grep with **solution-words AND problem-words**, scan sub-directory
taxonomies, then **open and skim** the 3 nearest matches. A negative grep
alone is not proof of no overlap. Report the top 3-5 most-similar
artifacts and ask (numbered options):

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

## Roadmap-run batch mode — the ONE structured bypass

When a `/roadmap:process-*` run starts under an **accepted execution
contract** ([`roadmap-execution-contract`](../contexts/execution/roadmap-execution-contract.md))
whose pre-scan detected artifact-authoring steps, the protocol runs in
batch mode for exactly those artifacts:

- **Phase B (Research) runs ONCE at contract time, against the CURRENT
  artifact state** — one overlap scan covering every artifact the
  roadmap plans; results (nearest matches, extend-vs-create verdicts)
  are surfaced inside the contract summary the user accepts. This is
  why authoring-time-only checking is not enough: a sibling roadmap may
  have landed overlapping artifacts between authoring and execution.
- **Phases A (Understand) and C (Draft) run non-interactively during
  the run** — the roadmap step text is the Understand input; the
  contract acceptance is the approval that the per-phase prompts exist
  to obtain.
- **Scope is the batch, nothing more.** An artifact NOT declared in the
  roadmap (discovered mid-run) triggers the full interactive protocol —
  or, under the contract, the scope-out-of-roadmap halt.
- Batch mode never skips the Research pass itself — it relocates and
  batches it. `artifact_protocol: skip` does not exist.

## Golden rules

- Every phase ends with a numbered-options prompt. No silent progression.
- Zero autopilot — agent proposes, human decides. (In roadmap-run batch
  mode the human decision is the contract acceptance; the per-phase
  prompts are pre-satisfied for the declared batch.)
- At most two propose → reject cycles; then stop.
- Commit only on approval.
- Bypass is legitimate — *"just write it"* drops the protocol immediately.

Extends (cross-link, don't restate): `ask-when-uncertain`,
`improve-before-implement`, `user-interaction`, `skill-quality`.
