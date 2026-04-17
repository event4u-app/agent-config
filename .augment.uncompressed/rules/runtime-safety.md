---
type: auto
source: package
description: "When a skill declares execution metadata — enforce safety constraints for assisted and automated execution types"
---

# Runtime Safety

## Core principle

Execution is an extension of skills, not a replacement for reasoning or review.

## Constraints

- Default execution type is `manual` — skills without an execution block are instructional only
- `assisted` execution must produce a proposal, never execute silently
- `automated` execution requires:
  - `handler` ≠ `none`
  - `safety_mode: strict`
  - Explicit `allowed_tools` declaration (can be empty `[]`)
  - A verification path in the skill's procedure
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
