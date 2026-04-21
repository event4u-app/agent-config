---
name: description-assist
description: "Use when polishing a skill/rule/command/guideline frontmatter description — pushier phrasing, trigger coverage, undertrigger audit — even if the user just says 'make this pushier'."
source: package
---

# description-assist

## When to use

* The user says "make this description pushier", "this description is weak",
  "will this ever fire", "rewrite the description".
* Called from within the Draft phase of one of the writing skills
  (`skill-writing`, `rule-writing`, `command-writing`, `guideline-writing`).
* Auditing a skill flagged by `audit_skill_descriptions.py` as `too-short`,
  `no-trigger-prefix`, or `description_too_long` in `skill_linter.py`.

Do NOT use this skill when:

* The user wants to change the body, name, or procedure — one field per turn.
* The content is not an agent artifact (READMEs, docs, commit messages).
* The user explicitly asked for a fresh description — write it, don't audit.

## The contract

* **No silent edits.** Every proposed variant is a suggestion presented
  with numbered options; the user picks before anything is written.
* **No Claude API grading loop.** You reason from your context only. No
  separate AI pass evaluates your suggestions.
* **Max two rounds.** Propose → reject → refine → reject → stop. If the
  second round is rejected, ask one clarifying question and exit.
* **One field per turn.** Only `description`. Trigger phrases, name, and
  body belong to their own turns.

## Procedure

### 1. Read the current description

Open the target file. Read the `description:` value in full. If the value
is missing, abort and route to the relevant writing skill instead.

### 2. Inspect the description against four criteria

Normative source: [`skill-quality`](../../rules/skill-quality.md) § *Description Triggering*.

| Check | Pass when… |
|---|---|
| **Length** | ≤ 200 characters (soft cap; linter warns `description_too_long`) |
| **Trigger prefix** | Starts with "Use when …" or equivalent trigger phrasing |
| **Trigger classes** | Names ≥ 2 of: domain, symptom, user phrasing, tool, file type |
| **Undertrigger tail** | Ends with "… even if the user doesn't say `{name}`" or equivalent |

Report which checks pass / fail in one compact line — **not** a long essay.

### 3. Propose 2–3 alternatives

Each variant:

* Fixes at least one failed check from step 2.
* Stays under 200 characters.
* Has a one-line rationale ("adds symptom trigger", "tightens length",
  "adds undertrigger tail").
* Is numbered (per [`user-interaction`](../../rules/user-interaction.md) rule).

Format:

```
Current (156 chars, missing undertrigger tail):
  "Use when writing Playwright E2E tests — browser automation, visual
   regression, Page Objects."

> 1. Adds undertrigger tail, 189 chars
>    "Use when writing Playwright E2E tests — browser automation, visual
>     regression, Page Objects — even if the user doesn't say Playwright."
> 2. Adds symptom trigger 'flaky CI', 193 chars
>    "Use when writing Playwright E2E tests — flaky CI, Page Objects,
>     fixtures, visual regression — even if the user doesn't say Playwright."
> 3. Skip — keep current
```

### 4. Wait for the user

Do not edit the file yet. Wait for the user's numbered pick or free-text
counter-proposal.

### 5. Apply the picked variant

Only after the user picks:

* Edit the frontmatter in `.agent-src.uncompressed/{kind}/{name}.{md,SKILL.md}`.
* Re-copy / re-sync as the target artifact's writing skill prescribes.
* Run `python3 scripts/skill_linter.py {path}` — must report 0 FAIL.
* Report the diff and exit.

### 6. Max two rounds

If the user rejects all variants twice, ask **one** clarifying question
(e.g. "What symptom phrase best captures when this skill should fire?")
and stop. Do not loop further.

## Output format

1. One-line inspection verdict ("3/4 pass, missing undertrigger tail")
2. 2–3 numbered variants with rationale + char count
3. A "skip — keep current" option
4. On apply: diff snippet + linter verdict

## Gotchas

* Proposing variants longer than 200 characters — linter will reject.
* Changing anything except `description` — out of scope, separate turn.
* Running a secondary AI pass to grade your own proposals — forbidden.
* Applying a variant without explicit numbered pick from the user.
* Skipping the linter after apply — must be 0 FAIL.
* Looping beyond round 2 — the rule caps at two rounds, then clarify and stop.

## Do NOT

* Do NOT call the Claude API to score proposals
* Do NOT edit the file before the user picks
* Do NOT propose more than 3 variants in one turn
* Do NOT change the skill name, body, or trigger phrases in the same turn
* Do NOT silently strip or reword quotes inside the description value

## Examples

Inspection verdict (good — compact):

> 2/4 pass. Missing: trigger prefix ("Use when …"), undertrigger tail.
> Length OK (142), trigger classes OK (domain + symptom).

Inspection verdict (bad — essay):

> After reviewing the description, I noticed it has several areas that
> could be improved. For instance, the length is fine, but the phrasing
> could be stronger. Additionally, we should consider…
