---
model_tier: inherit
name: persona-writing
description: "Use when creating or editing a persona in .agent-src.uncondensed/personas/ — voice / focus / unique questions / output expectations — even when the user just says 'add a reviewer voice for X'."
domain: process
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

<!-- cloud_safe: degrade -->

# persona-writing

## When to use

* Creating a new persona file in
  `.agent-src.uncondensed/personas/{id}.md`
* Rewriting an existing persona (focus shift, output-expectation
  change — not a typo fix)
* Deciding whether a new reviewer voice should be a persona at all
  (vs. a skill of its own)

Do NOT use this skill when:

* The content is a multi-step workflow → use
  [`skill-writing`](../skill-writing/SKILL.md)
* The content is a hard obligation the agent must always honor → use
  [`rule-writing`](../rule-writing/SKILL.md)
* The content describes the project's role-mode contract → that lives
  in `docs/contracts/role-contracts.md`, not in personas

## Persona vs skill vs role-mode — critical test

| Intent | Artifact |
|---|---|
| "Agent should review through a specific lens" | **Persona** |
| "Agent should run a multi-step workflow" | **Skill** |
| "Agent's closing contract differs by role" | **Role-mode** (contract file) |

A persona is **passive reference content** — it never triggers by
description, never appears in `<available_skills>`. Skills cite
personas via the `personas:` frontmatter key.

## Procedure

### 0. Drafting protocol

Creating or materially rewriting a persona must go through
Understand → Research → Draft per the
[`artifact-drafting-protocol`](../../rules/artifact-drafting-protocol.md)
rule. Inspect existing personas under
`.agent-src.uncondensed/personas/` for overlap before writing a new
one.

### 1. Decide focus, not topic

A persona owns **one focus**: automation-readiness, adversarial
challenge, product-owner priorities, etc. If the focus needs three
sentences, it is two personas.

### 2. Draft the persona file

Required sections:

* `## Focus` — one paragraph, what this lens *cares about* and what
  it *ignores*.
* `## Unique questions` — 4–7 questions only this persona would ask.
  Each question must be decidable against the artifact under review.
* `## Output expectations` — what the persona produces (verdict
  format, severity vocabulary, citation discipline).

Optional: `## Anti-patterns this persona catches` — concrete examples
the persona is calibrated to flag.

### 3. Cite from at least one skill

A persona that is not cited by any skill via the `personas:`
frontmatter key is dead code. Either wire it into an existing skill
or do not ship it.

## Frontmatter shape

```yaml
---
id: <kebab-case-id>
role: <Human-Readable Role>
description: "One sentence: what this voice catches that others miss."
tier: core | specialty
mode: developer | product-owner | qa | stakeholder | none
version: "1.0"
source: package
---
```

The `mode:` field is advisory only — it suggests which role-mode the
persona pairs naturally with; it does not bind.

## Output format

A single Markdown file at `.agent-src.uncondensed/personas/{id}.md`:

1. Frontmatter (`id`, `role`, `description`, `tier`, `mode`,
   `version`, `source`)
2. `## Focus` — one paragraph, what the lens cares about and ignores
3. `## Unique questions` — 4–7 decidable questions
4. `## Output expectations` — verdict format, severity vocabulary

Length: ≤ 80 lines for a tier-core persona; longer signals the focus
is too broad.

## Gotchas

- **Persona without a citing skill** — a persona that no skill
  references via `personas:` never loads. Wire it in or do not ship.
- **Focus drift across rewrites** — adding "and also …" to `## Focus`
  is the first symptom of a second persona hiding inside the first.
- **Vibe-based unique questions** — "Does this feel right?" cannot
  be evaluated against the artifact. Replace with decidable triggers.
- **Restating role-mode contracts** — closing-contract obligations
  belong in `docs/contracts/role-contracts.md`, not in the persona
  body.

## Frugality Standards

Apply the [Frugality Charter](../../contexts/contracts/frugality-charter.md)
to every persona you author.

**Examples in this artifact:**
- Per the charter's default-terse rule, `## Focus` opens with what
  the persona cares about, not "This persona was created to…".
- Per the cite-don't-restate principle, link rules the persona
  enforces; do not paste their text into the persona body.
- Per the cheap-question check, `## Unique questions` lists decidable
  questions only — drop any that read like vibe checks.

**Pre-save self-check:**
1. Does `## Focus` open with the lens, or with persona meta-narrative?
2. Are unique questions decidable against the artifact alone?
3. Are any questions duplicated from another persona?
4. Is the persona cited by at least one skill via `personas:`?

## Do NOT

* Author a persona that nobody cites.
* Restate Iron-Law text from rules inside `## Output expectations`.
* Use ALL-CAPS Iron-Law fenced blocks — those belong in rules on the
  [`kernel-membership`](../../../docs/contracts/kernel-membership.md)
  list.
* Ship a persona that overlaps an existing one's focus by more than
  50 % — merge instead.

## Examples

See `.agent-src.uncondensed/personas/ai-agent.md` (automation
readiness) and `critical-challenger.md` (adversarial review) for
canonical structure.
