---
name: command-writing
description: "Use when creating or editing a slash command in .agent-src.uncompressed/commands/ — frontmatter, numbered steps, safety gates — even when the user just says 'add a /command for X'."
source: package
---

<!-- cloud_safe: degrade -->

# command-writing

## When to use

* Creating a new slash command in `.agent-src.uncompressed/commands/{name}.md`
* Rewriting an existing command (not a typo fix)
* Deciding whether a request should be a command at all
* Splitting an oversized command into smaller ones

Do NOT use this skill when:

* The content is a constraint the agent must always honor → use `rule-writing`
* The content is reference knowledge agents cite → use `guideline-writing`
* The content is a triggered workflow invoked by the model → use `skill-writing`

## Command vs skill — critical test

| Intent | Artifact |
|---|---|
| "User types `/foo` to explicitly run this" | **Command** |
| "Agent picks this up from description match" | **Skill** |

A command is **user-invoked** and carries `disable-model-invocation: true`.
A skill is model-invoked via description routing. If both audiences apply,
author as a skill and add a thin command that delegates to it.

## Procedure

### 0. Run the Drafting Protocol

Creating or materially rewriting a command **must** go through Understand →
Research → Draft from the
[`artifact-drafting-protocol`](../../rules/artifact-drafting-protocol.md) rule.

* **Understand** — what user-facing problem does `/{name}` solve in one
  session? What are the inputs, outputs, side effects?
* **Research** — **inspect** `.agent-src.uncompressed/templates/command.md`,
  grep `commands/` for overlap, and **analyze** 1–2 peer commands
  (e.g. `create-pr`, `commit`).
* **Draft** — propose frontmatter (`name`, `description`) first, then the
  step skeleton. Only fill bodies after both are confirmed.

### 1. Use the template

Canonical source: `.agent-src.uncompressed/templates/command.md`.

Minimum frontmatter:

```yaml
---
name: {command-name}          # must match filename without .md
description: "Short human-readable summary of what /{name} does"
disable-model-invocation: true
skills: [optional-skill-1]    # optional — skills this command delegates to
suggestion:                   # required (road-to-context-aware-command-suggestion Phase 2)
  eligible: true              # default; set false to opt out of auto-surfacing
  trigger_description: "natural-language pattern, comma-separated examples"
  trigger_context: "concrete signal — branch name, file pattern, recent tool output"
---
```

Or, when opting out:

```yaml
suggestion:
  eligible: false
  rationale: "one-line reason this command must be invoked deliberately"
```

Suggestion-block rules (linter-enforced):

* `eligible` is **required** and must be `true` or `false`.
* `eligible: true` → both `trigger_description` and `trigger_context` must be
  non-empty (≥ 10 chars each); the linter rejects empty or overly generic
  patterns. The suggestion layer never auto-executes; the user always picks.
* `eligible: false` → `rationale` must be non-empty. Use the opt-out for
  intentional-only invocations (settings mutations, destructive actions,
  package-internal tools, niche maintenance).
* Optional `confidence_floor` (0.0–1.0) and `cooldown` (e.g. `10m`)
  override the global settings per command.

Eligibility decisions are tracked in
[`agents/contexts/command-suggestion-eligibility.md`](../../../agents/contexts/command-suggestion-eligibility.md).
Add or revise entries there before changing a command's `suggestion` block.

When iterating on the description, delegate to the
[`description-assist`](../description-assist/SKILL.md) skill — approval-gated,
no silent edits, max two rounds.

### 2. Structure the body

Required sections in this order:

1. `# /{name}` heading + one-line summary
2. **Source of truth note** — works on `.agent-src.uncompressed/`, never on
   generated directories
3. `## Steps` — numbered sub-headings `### 1.`, `### 2.`, ...
4. Final step **presents findings** and asks the user before destructive
   changes (numbered options per `user-interaction` rule)
5. Optional `## Rules` — short, command-specific constraints

### 3. Enforce safety gates

* No auto-apply of destructive actions without user confirmation.
* Every step with side effects (git push, file delete, PR merge) asks first.
* If the command calls external APIs, list required keys / permissions.
* If the command edits agent files, target `.agent-src.uncompressed/` only.

### 4. Enforce the size budget

Normative source: [`size-enforcement`](../../rules/size-enforcement.md) +
`docs/guidelines/agent-infra/size-and-scope.md`.

| Category | Target |
|---|---|
| Ideal | ≤ 120 lines |
| Acceptable | ≤ 200 lines |
| Split signal | > 250 lines |

Commands orchestrate, they do not implement detail. If a step needs a
multi-paragraph explanation, extract it into a skill and call it.

### 5. Validate

* Run `python3 scripts/skill_linter.py .agent-src.uncompressed/commands/{name}.md`
  → 0 FAIL.
* Run `bash scripts/compress.sh --sync` → regenerates `.agent-src/commands/{name}.md`.
* Run `python3 scripts/compress.py --generate-tools` → creates the Claude symlink at
  `.claude/skills/{name}/SKILL.md`.
* Run the full CI pipeline locally (see `Taskfile.yml` in this repo for
  the script list) — must exit 0 except for tolerated warnings.

## Output format

1. Complete command file at `.agent-src.uncompressed/commands/{name}.md`
2. Frontmatter populated, `disable-model-invocation: true` present
3. Linter output showing 0 FAIL
4. Generated Claude symlink verified

## Gotchas

* Forgetting `disable-model-invocation: true` — the model will auto-invoke
  the command as if it were a skill.
* Numbered options without a "skip" / "no change" path.
* Steps that silently apply destructive changes — always show summary + ask.
* Referring to `.augment/` paths for editing — source of truth is
  `.agent-src.uncompressed/`.
* Duplicating another command's workflow instead of delegating via `skills:`.

## Do NOT

* Do NOT set `disable-model-invocation: false`
* Do NOT auto-apply destructive actions
* Do NOT inline skill-level detail — delegate
* Do NOT edit `.agent-src/`, `.augment/`, or `.claude/` projections
* Do NOT exceed the hard size limit without a waiver

## Cloud Behavior

On cloud surfaces (Claude.ai Web, Skills API) the package's
`scripts/skill_linter.py`, `scripts/compress.py`, and the `task`
runner are not available. This skill still applies — but with
prose-only validation:

* Emit the full command file as a copyable Markdown block. Do not
  attempt to write it to disk.
* Self-check the frontmatter against the rules below — `name`,
  `description`, `disable-model-invocation: true` MUST all be
  present.
* Self-check the body shape: numbered steps, explicit safety gates,
  no inline skill-level detail.
* Tell the user to save the file under
  `.agent-src.uncompressed/commands/{name}.md` and run
  `task sync && task lint-skills` locally before committing.
* Skip every reference to running the linter, compressor, or
  generators yourself — they only run on the user's machine.

## Examples

Good description (trigger-shaped, outcome-focused):

> "Create a GitHub PR with structured description from Jira ticket and code changes"

Bad description (vague, no outcome):

> "PR command"
