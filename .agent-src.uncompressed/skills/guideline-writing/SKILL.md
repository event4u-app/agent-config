---
name: guideline-writing
description: "Use when creating or editing a guideline in .agent-src.uncompressed/guidelines/ — reference material cited by skills, no auto-triggers — even when the user just says 'write up our naming conventions'."
source: package
---

<!-- cloud_safe: degrade -->

# guideline-writing

## When to use

* Creating a new guideline in `.agent-src.uncompressed/guidelines/{topic}/{name}.md`
* Rewriting an existing guideline (not a typo fix)
* Extracting reference material out of a bloated skill or rule
* Consolidating repeated explanations from multiple skills

Do NOT use this skill when:

* The content is a constraint ("never / always") → use `rule-writing`
* The content is a triggered workflow → use `skill-writing`
* The content is a user-invoked action → use `command-writing`

## Guideline vs rule vs skill — critical test

| Intent | Artifact |
|---|---|
| "Here is knowledge skills and rules may cite" | **Guideline** |
| "Agent must always / never do X" | **Rule** |
| "When Y happens, run these steps" | **Skill** |

A guideline is **reference material**. It is never a trigger. It has no
`description` used for routing — skills and rules link to it.

## Procedure

### 0. Run the Drafting Protocol

Creating or materially rewriting a guideline **must** go through Understand
→ Research → Draft from the
[`artifact-drafting-protocol`](../../rules/artifact-drafting-protocol.md) rule.

* **Understand** — which skills or rules will cite this guideline? If the
  answer is "none", the guideline has no home — stop.
* **Research** — **inspect** `guidelines/` for overlap and grep
  `.agent-src.uncompressed/` for pages that already cover the topic.
  **Analyze** 1–2 peer guidelines in the same topic folder for tone.
* **Draft** — propose location (topic folder + filename) and outline. Only
  fill bodies once the outline is confirmed.

### 1. Pick the right topic folder

Folders under `.agent-src.uncompressed/guidelines/`:

| Folder | Contents |
|---|---|
| `agent-infra/` | Cross-cutting agent-system knowledge (naming, size, output patterns) |
| `php/` | PHP-specific reference (patterns, services, jobs, resources) |
| `e2e/` | End-to-end testing patterns |

If none fits, ask the user before creating a new folder.

### 2. Write frontmatter

Guidelines use a minimal frontmatter — no `type`, no auto-trigger semantics.

```yaml
---
description: "Short human-readable summary — cited by skills, not used for routing"
source: package     # or project for consumer-local guidelines
---
```

If you do want to polish the description for a guideline whose summary
gets surfaced to agents, delegate to the
[`description-assist`](../description-assist/SKILL.md) skill — same
approval-gated flow as for skills and rules.

### 3. Structure the body

* Start with a single `#` heading that matches the filename.
* Organize by topic, not by workflow — no numbered procedures.
* Prefer tables, bullet lists, and short code blocks over prose paragraphs.
* End with explicit "See also" links to related guidelines and the skills
  that cite it.

### 4. Wire it in

A guideline is useless if nothing cites it. Before closing the task:

* Add a link from at least one skill or rule using the pattern
  `→ See 'guidelines/{topic}/{name}.md' for full X`.
* Keep the citing skill/rule **executable** — do not hollow it out into a
  pointer. (Normative source: [`preservation-guard`](../../rules/preservation-guard.md).)

### 5. Enforce the size budget

Guidelines have more room than rules but are not dumping grounds.

| Category | Target |
|---|---|
| Ideal | ≤ 200 lines |
| Acceptable | ≤ 400 lines |
| Split signal | > 500 lines |

Above the split signal, break by sub-topic into sibling files in the same folder.

### 6. Validate

* Run `python3 scripts/skill_linter.py .agent-src.uncompressed/guidelines/{topic}/{name}.md`
  → 0 FAIL (guidelines have relaxed linting but must still parse).
* Run `bash scripts/compress.sh --sync` → regenerates `.agent-src/guidelines/`.
* Run `python3 scripts/check_references.py` → no broken links.
* Run the full CI pipeline locally (see `Taskfile.yml` in this repo for
  the script list) — must exit 0 except for tolerated warnings.

## Output format

1. Complete guideline at `.agent-src.uncompressed/guidelines/{topic}/{name}.md`
2. At least one skill or rule linking to it
3. Linter + `check_references.py` clean
4. `bash scripts/compress.sh --sync` confirmation

## Gotchas

* Creating a guideline nothing cites → dead page, remove or inline.
* Pasting a workflow into a guideline → that is a skill, not reference.
* Duplicating content already present in another guideline or skill →
  extract into the guideline and link from both.
* Hollowing out a skill into "see guideline" — the skill must remain
  executable (see `preservation-guard`).

## Do NOT

* Do NOT add `type:` or `alwaysApply:` to the frontmatter
* Do NOT embed numbered procedures — those belong in skills
* Do NOT create an orphan guideline with no inbound links
* Do NOT edit `.agent-src/guidelines/` or `.augment/guidelines/` — generated

## Cloud Behavior

On cloud surfaces (Claude.ai Web, Skills API) the package's
`scripts/check_references.py`, `scripts/skill_linter.py`, and `task`
runner are not reachable. The skill still applies — with prose-only
validation:

* Emit the full guideline file as a copyable Markdown block. Do not
  attempt to write to disk.
* Self-check the frontmatter: `description` only, no `type`, no
  `alwaysApply`.
* Self-check the body: reference material, no numbered procedures,
  named in a topic folder.
* Tell the user to save under
  `.agent-src.uncompressed/guidelines/{topic}/{name}.md` and run
  `task sync && task lint-skills && task check-refs` locally before
  committing.
* Do not call the linter, ref-checker, or compressor — they only
  run on the user's machine.

## Examples

Good guideline name + description:

> Path: `guidelines/agent-infra/size-and-scope.md`
> Description: "Golden size rules for rules, skills, commands, and guidelines"

Bad:

> Path: **guidelines/stuff** (no topic folder, meaningless stem)
> Description: "Things to know"
