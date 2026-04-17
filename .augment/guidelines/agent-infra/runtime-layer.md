# Runtime Layer

Defining and using execution metadata on skills.

## Execution block

Optional `execution` block in YAML frontmatter:

```yaml
execution:
  type: manual | assisted | automated
  handler: none | shell | php | node | internal
  timeout_seconds: 30
  safety_mode: strict
  allowed_tools: []
```

## Execution types

| Type | Meaning | Default |
|---|---|---|
| `manual` | Instructional only — no automated actions | ✅ default |
| `assisted` | Prepares actions for human confirmation | |
| `automated` | Executes safely without confirmation | |

No `execution` block = `manual`.

## Handler types

| Handler | When to use |
|---|---|
| `none` | Manual skills |
| `shell` | Shell commands (linting, testing) |
| `php` | PHP/artisan commands |
| `node` | Node.js scripts |
| `internal` | Internal agent capabilities only |

## Safety mode

Only `strict` allowed. All safety checks enforced, no bypass.

## Allowed tools

Explicit list of external tool identifiers. `[]` = no tools.
Names must match tool registry.

## Rules for authors

1. Default `manual` — omit block for instructional skills
2. Prefer `assisted` over `automated`
3. `automated` requires handler ≠ `none`
4. `automated` requires `safety_mode: strict`
5. Undeclared tool usage → linter error
6. Timeout advisory only (not enforced this phase)

## Migration

Existing skills without execution block remain valid. Purely additive.

## Validation (linter)

- `execution.type` ∈ {manual, assisted, automated}
- `execution.handler` ∈ {none, shell, php, node, internal}
- `automated` + `handler: none` → error
- `automated` without `safety_mode: strict` → error
- `allowed_tools` entries must be strings
- Unknown execution fields → warning

## Anti-patterns

- `automated` on skills modifying files without verification
- `shell` handler without specifying safe commands
- `allowed_tools` without matching registry entry
- `timeout_seconds: 0` (use positive value or omit)
