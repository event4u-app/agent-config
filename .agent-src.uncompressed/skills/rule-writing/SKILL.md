---
name: rule-writing
description: "Use when creating or editing a rule in .agent-src.uncompressed/rules/ — trigger wording, always vs auto classification, size budget — even when the user just says 'add a rule for X'."
source: package
---

# rule-writing

## When to use

* Creating a new rule in `.agent-src.uncompressed/rules/{name}.md`
* Rewriting an existing rule (not a typo fix)
* Deciding whether something should be a rule at all
* Converting a learning from `learning-to-rule-or-skill` into a concrete rule

Do NOT use this skill when:

* The content is a multi-step workflow → use `skill-writing`
* The content is reference material agents cite → use `guideline-writing`
* The content is a user-invoked action → use `command-writing`

## Rule vs skill vs guideline — critical test

| Intent | Artifact |
|---|---|
| "Agent must always/never do X" | **Rule** |
| "When Y happens, run these steps" | **Skill** |
| "Here is knowledge the agent may cite" | **Guideline** |

A rule is a **constraint** — it states a boundary, not a workflow. If the
content needs numbered steps, it is a skill.

## Procedure

### 0. Run the Drafting Protocol

Creating or materially rewriting a rule **must** go through Understand →
Research → Draft from the
[`artifact-drafting-protocol`](../../rules/artifact-drafting-protocol.md) rule.

* **Understand** — which agent behavior is wrong today? What should change?
  Can you point to a concrete incident or repeated pattern?
* **Research** — **inspect** `.agent-src.uncompressed/rules/` for overlap
  and **analyze** `rule-type-governance`, `size-enforcement`,
  `skill-quality` before drafting.
* **Draft** — propose frontmatter (`type`, `description`) first, wait for
  confirmation, then fill the body.

### 1. Classify type — `always` vs `auto`

Normative source: [`rule-type-governance`](../../rules/rule-type-governance.md).

* `always` — universal behavior (language, scope, safety, verification)
* `auto` — triggered by description match on domain/symptom

Default to `auto`. `always` must be justified — if >50% of conversations
don't need it, it is `auto`.

### 2. Write a trigger-style description

The `description` field **is** the trigger. Describe **when** the rule
applies, not **what** it contains. Soft cap: **200 characters**.

```yaml
# Bad — describes content, won't match reliably:
description: "PHP coding standards"

# Good — trigger-shaped, names domain + symptoms:
description: "Writing or reviewing PHP code — strict types, naming, comparisons, early returns, Eloquent conventions"
```

When iterating on phrasing, delegate to the
[`description-assist`](../description-assist/SKILL.md) skill — approval-gated,
no silent edits, max two rounds.

### 3. Write the rule body

* Short, constraint-only, easy to scan.
* Bullet lists, tables, do/don't blocks — not paragraphs of prose.
* No numbered procedures — if you need steps, it is a skill.
* Link out to guidelines for deep reference instead of inlining them.

### 4. Enforce the size budget

Normative source: [`size-enforcement`](../../rules/size-enforcement.md) +
`guidelines/agent-infra/size-and-scope.md`.

| Category | Target |
|---|---|
| Ideal | < 60 non-empty lines |
| Acceptable | < 100–120 lines |
| Hard limit | < 200 lines |

Linter emits `long_rule` above ~80 non-empty lines. Above that, justify in
the PR or split by responsibility.

### 5. Validate

* Run `python3 scripts/skill_linter.py .agent-src.uncompressed/rules/{name}.md`
  → must report **0 FAIL**.
* Run `task sync` to regenerate `.agent-src/rules/{name}.md`.
* Run `task generate-tools` to project into `.claude/`, `.cursor/`, `.clinerules/`, `.windsurfrules`.
* Run `task ci` — must exit 0 except for tolerated warnings.

## Frontmatter shape

```yaml
---
type: "auto"              # or "always"
description: "Trigger-shaped sentence — domain + symptoms — soft cap 200 chars"
alwaysApply: false        # true only if type: always
source: package           # or project for consumer-local rules
---
```

## Output format

1. Complete rule file at `.agent-src.uncompressed/rules/{name}.md`
2. Frontmatter fully populated, no placeholders left
3. Linter output showing 0 FAIL
4. Confirmation that `task sync` + `task generate-tools` ran clean

## Gotchas

* Writing a rule that duplicates an existing one — always grep first.
* Defaulting to `always` "just in case" — token cost is real, `auto` is default.
* Description like "Rule about X" — it must describe *when*, not *what*.
* Pasting a workflow into a rule — if it has numbered steps, split into a skill.
* Forgetting to run `task generate-tools` — downstream tools stay stale.
* Editing `.agent-src/rules/` or `.augment/rules/` directly — those are generated.

## Do NOT

* Do NOT inline long procedures
* Do NOT exceed the hard size limit without an explicit waiver
* Do NOT edit projections (`.agent-src/`, `.augment/`, `.claude/`, etc.)
* Do NOT skip the linter
* Do NOT create a rule when a guideline or skill is the right shape

## Examples

Good description (trigger-shaped, names domain + symptoms):

> "Git commit message format, branch naming, conventional commits, committing, pushing, or creating pull requests"

Bad description (no trigger, too vague):

> "Commit conventions"
