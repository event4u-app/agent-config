---
model_tier: inherit
name: command-writing
description: "Use when creating or editing a slash command in .agent-src.uncondensed/commands/ — frontmatter, numbered steps, safety gates — even when the user just says 'add a /command for X'."
domain: process
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

<!-- cloud_safe: degrade -->

# command-writing

## When to use

* Creating a new slash command in `.agent-src.uncondensed/commands/{name}.md`
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

## Commands ARE Claude skills (projection reality)

Every command in `.agent-src.uncondensed/commands/{name}.md` is projected
into `.claude/skills/{slug}/SKILL.md` by `scripts/condense.py`
(`generate_claude_commands`). Nested commands flatten with `-`
(`council/default.md` → `council-default`). Skills and commands share the
**same `.claude/skills/` namespace** — Claude does not distinguish them.

Consequences for authoring:

* The frontmatter `description` is the **routing surface** Claude reads.
  Polite or generic phrasing causes undertriggering even with
  `disable-model-invocation: true` set, because the in-host command
  suggester, fuzzy search, and any tooling that scans `.claude/skills/`
  rank by description match.
* `disable-model-invocation: true` blocks **automatic** invocation. It
  does NOT remove the command from discovery surfaces. A weak description
  means the command is invisible to the suggester even when the user's
  intent matches.
* Trigger phrasing must follow the same Iron Law as skill descriptions:
  name 2+ trigger classes (domains, symptoms, user phrasing), end with
  the `... even when the user just says ...` tail, ≤ 200 chars. See
  `skill-writing` § 1b for the canonical before/after.
* The `suggestion.trigger_description` and `suggestion.trigger_context`
  blocks are **separate** from the frontmatter `description` — they
  drive the in-host suggester (`command-suggestion-policy`), not Claude's
  skill router. Both matter, both must be precise.

Bottom line: write the command's `description` as if a skill router will
read it — because one will.

## Procedure

### 0. Run the Drafting Protocol

Creating or materially rewriting a command **must** go through Understand →
Research → Draft from the
[`artifact-drafting-protocol`](../../rules/artifact-drafting-protocol.md) rule.

* **Understand** — what user-facing problem does `/{name}` solve in one
  session? What are the inputs, outputs, side effects?
* **Research** — **inspect** `.agent-src.uncondensed/templates/command.md`,
  grep `commands/` for overlap, and **analyze** 1–2 peer commands
  (e.g. `create-pr`, `commit`).
* **Draft** — propose frontmatter (`name`, `description`) first, then the
  step skeleton. Only fill bodies after both are confirmed.

### 1. Use the template

Canonical source: `.agent-src.uncondensed/templates/command.md`.

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
[`agents/settings/contexts/command-suggestion-eligibility.md`](../../../agents/settings/contexts/command-suggestion-eligibility.md).
Add or revise entries there before changing a command's `suggestion` block.

When iterating on the description, delegate to the
[`description-assist`](../description-assist/SKILL.md) skill — approval-gated,
no silent edits, max two rounds.

### 2. Structure the body

Required sections in this order:

1. `# /{name}` heading + one-line summary
2. **Source of truth note** — works on `.agent-src.uncondensed/`, never on
   generated directories
3. `## Steps` — numbered sub-headings `### 1.`, `### 2.`, ...
4. Final step **presents findings** and asks the user before destructive
   changes (numbered options per `user-interaction` rule)
5. Optional `## Rules` — short, command-specific constraints

### 3. Enforce safety gates

* No auto-apply of destructive actions without user confirmation.
* Every step with side effects (git push, file delete, PR merge) asks first.
* If the command calls external APIs, list required keys / permissions.
* If the command edits agent files, target `.agent-src.uncondensed/` only.

### 3b. Path conventions in command body

Body links to guidelines / contracts use the verbatim relative form
(`../../docs/guidelines/...`, `../../docs/contracts/...`); the
condense-time rewriter handles depth. Do not pre-rewrite in source. Do
not write `.agent-src.uncondensed/` in any markdown link target — the
file ships into `.augment/commands/` and the prefix breaks consumer
resolution. The only legitimate `.agent-src.uncondensed/` strings in a
command file are prose mentions and step instructions about where to
edit (per § 2 above). Canonical reference: `rule-writing` § 3b.

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

* Run `python3 scripts/skill_linter.py .agent-src.uncondensed/commands/{name}.md`
  → 0 FAIL.
* Run `bash scripts/condense.sh --sync` → regenerates `.agent-src/commands/{name}.md`.
* Run `python3 scripts/condense.py --generate-tools` → creates the Claude symlink at
  `.claude/skills/{name}/SKILL.md`.
* Run the full CI pipeline locally (see `Taskfile.yml` in this repo for
  the script list) — must exit 0 except for tolerated warnings.

### 6. Governance baseline (when introducing a new linter check)

**Advisory, reviewer-checked — no CI gate.** When the same PR adds a
new check to `scripts/skill_linter.py` (or strengthens an existing
one) such that previously-clean commands now warn, the PR body MUST
record the pre-existing violations on `main` in a Markdown table:

```markdown
### Pre-existing baseline (informational)

| Code | Count on main | Bucket |
|---|---:|---|
| {new_code} | N | (a) genuine fix · (b) accept · (c) check too aggressive |
```

Forward-only: the new check applies to **the file under review** and
to **future** edits. The baseline table is informational so reviewers
can spot intent (fix-now vs. backlog) without diffing the full lint
output. See `agents/evidence/analysis/lint-warning-triage.md` for the
3-bucket reference.

## Output format

1. Complete command file at `.agent-src.uncondensed/commands/{name}.md`
2. Frontmatter populated, `disable-model-invocation: true` present
3. Linter output showing 0 FAIL
4. Generated Claude symlink verified

## Gotchas

* Forgetting `disable-model-invocation: true` — the model will auto-invoke
  the command as if it were a skill.
* Numbered options without a "skip" / "no change" path.
* Steps that silently apply destructive changes — always show summary + ask.
* Referring to `.augment/` paths for editing — source of truth is
  `.agent-src.uncondensed/`.
* Duplicating another command's workflow instead of delegating via `skills:`.

## Frugality Standards

Apply the [Frugality Charter](../../contexts/contracts/frugality-charter.md)
to every command you author.

**Examples in this artifact:**
- Per the charter's default-terse rule, command output blocks state
  the action result, not "Now we will execute…".
- Per the post-action summary suppression, the success path emits
  the artifact (PR URL, commit hash) without a wrapping summary.
- Per the cheap-question check, never offer "preview vs. execute"
  as a numbered option when the command's role is to execute.

**Pre-save self-check:**
1. Does any command step prescribe a "Let me…" or "Found it" output
   line?
2. Does the command default to multi-line summaries when a one-line
   outcome suffices?
3. Is a confirmation gate used outside the Iron-Law / Routine /
   Contextual taxonomy?
4. Are template placeholders (`{{var}}`) accompanied by setup prose
   instead of action prose?

## Do NOT

* Do NOT set `disable-model-invocation: false`
* Do NOT auto-apply destructive actions
* Do NOT inline skill-level detail — delegate
* Do NOT edit `.agent-src/`, `.augment/`, or `.claude/` projections
* Do NOT exceed the hard size limit without a waiver

## Cloud Behavior

On cloud surfaces (Claude.ai Web, Skills API) the package's
`scripts/skill_linter.py`, `scripts/condense.py`, and the `task`
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
  `.agent-src.uncondensed/commands/{name}.md` and run
  `task sync && task lint-skills` locally before committing.
* Skip every reference to running the linter, condenseor, or
  generators yourself — they only run on the user's machine.

## Examples

Good description (trigger-shaped, outcome-focused):

> "Create a GitHub PR with structured description from Jira ticket and code changes"

Bad description (vague, no outcome):

> "PR command"
