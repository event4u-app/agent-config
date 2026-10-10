---
type: auto
tier: "2b"
consequence_class: "security-boundary"
description: "Skill declares execution metadata — enforce safety constraints for assisted/automated execution types"
triggers:
  - keyword: "execution"
  - keyword: "automated"
  - keyword: "assisted"
  - keyword: "handler"
self_contained: true
workspaces: [agent-config-maintainer, engineering]
packs: [meta]
obligation_frequency: "per-edit"
---

# Runtime Safety

## The Iron Law

```
EXECUTION EXTENDS A SKILL; IT NEVER REPLACES REASONING OR REVIEW.
NO EXECUTION WITHOUT DECLARED INTENT IN FRONTMATTER. THE DEFAULT IS `manual`,
AND A SKILL WITH NO EXECUTION BLOCK IS INSTRUCTIONAL ONLY.
`assisted` PRODUCES A PROPOSAL AND NEVER EXECUTES SILENTLY.
`automated` REQUIRES ALL FOUR: A HANDLER OTHER THAN `none`,
`safety_mode: strict`, AN EXPLICIT `allowed_tools` (EMPTY IS LEGAL),
AND A VERIFICATION STEP IN THE SKILL'S OWN STEPS.
ALLOWED HANDLERS ARE `none`, `shell`, `php`, `node`, AND `internal`;
EVERY OTHER VALUE IS A LINTER ERROR. NO ARBITRARY CODE EXECUTION.
NEVER BYPASS RULES, LINTER OR REVIEWER STANDARDS.
UNCLEAR TYPE OR HANDLER → `manual`, THEN ASK.
```

## Core principle

Execution is an extension of skills, not a replacement for reasoning or review.

## Constraints

- Default execution type is `manual` — skills without an execution block are instructional only
- `assisted` execution must produce a proposal, never execute silently
- `automated` execution requires:
  - `handler` ≠ `none`
  - `safety_mode: strict`
  - Explicit `allowed_tools` declaration (can be empty `[]`)
  - A verification step defined in the skill's steps
- No arbitrary code execution — handlers are allowlisted values only
- No bypass of rules, linter, or reviewer standards
- No execution without declared intent in frontmatter

## Allowed handler values

`none`, `shell`, `php`, `node`, `internal`

Any other value is a linter error.

## Escalation

If a skill's execution type or handler is unclear:
1. Default to `manual`
2. Ask the user before assuming `assisted` or `automated`

## What this rule does NOT cover

- Tool registry and permissions (see tool-integration roadmap)
- Runtime hooks and error handling (see runtime hooks PR)
- Async execution (not in scope for this phase)
