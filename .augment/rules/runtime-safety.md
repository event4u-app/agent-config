---
type: auto
source: package
description: "When a skill declares execution metadata — enforce safety constraints for assisted and automated execution types"
---

# Runtime Safety

Execution extends skills, not replaces reasoning or review.

## Constraints

- Default type `manual` — no execution block = instructional only
- `assisted` must produce proposal, never execute silently
- `automated` requires:
  - `handler` ≠ `none`
  - `safety_mode: strict`
  - Explicit `allowed_tools` (can be `[]`)
  - Verification path in procedure
- No arbitrary code execution — handlers are allowlisted only
- No bypass of rules, linter, or reviewer standards
- No execution without declared intent in frontmatter

## Allowed handler values

`none`, `shell`, `php`, `node`, `internal`

Other values → linter error.

## Escalation

1. Default to `manual`
2. Ask user before assuming `assisted` or `automated`

## Not covered

- Tool registry/permissions (tool-integration)
- Runtime hooks/error handling (runtime hooks)
- Async execution (not in scope)
