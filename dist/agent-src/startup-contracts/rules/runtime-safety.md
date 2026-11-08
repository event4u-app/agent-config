## Startup contract

- **When:** skill declares/omits execution metadata; not tool registry/permissions, runtime hooks/error handling, async execution.
- **Must:** default type `manual` (no block = instructional); `automated` needs `handler` ≠ `none` + `safety_mode: strict` + explicit `allowed_tools` (may be `[]`) + verification step in steps; `handler` ∈ none/shell/php/node/internal, else linter error.
- **Never:** `assisted` without first producing a proposal, or executing silently; arbitrary code (allowlisted handlers only); bypass rules/linter/reviewer standards; running w/o declared frontmatter intent.
- **Stop:** type/handler unclear → fall back to `manual`, ask user before assuming `assisted`/`automated`.
