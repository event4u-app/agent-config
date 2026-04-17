# Runtime Schema

Technical specification for the skill execution metadata model.

## Execution block (YAML frontmatter)

```yaml
---
name: quality-fix
description: "Run quality pipeline and fix all errors"
execution:
  type: automated
  handler: shell
  timeout_seconds: 120
  safety_mode: strict
  allowed_tools: []
---
```

## Field definitions

### `execution.type`

| Value | Description | Requirements |
|---|---|---|
| `manual` | Instructional only, no automated actions | None (default) |
| `assisted` | Prepares actions for human confirmation | Handler recommended |
| `automated` | Executes safely without confirmation | Handler required, safety_mode required |

**Default:** If `execution` block is absent, the skill is `manual`.

### `execution.handler`

| Value | Description |
|---|---|
| `none` | No handler (manual skills) |
| `shell` | Shell command execution |
| `php` | PHP/Artisan command execution |
| `node` | Node.js script execution |
| `internal` | Internal agent capabilities |

**Constraint:** `automated` type requires handler ≠ `none`.

### `execution.timeout_seconds`

Positive integer. Advisory timeout for execution planning.
Default: `30`. Not hard-enforced in this phase.

### `execution.safety_mode`

| Value | Description |
|---|---|
| `strict` | All safety checks enforced |

Only `strict` is valid. Future phases may add more modes.

**Constraint:** Required when `execution.type` is `automated`.

### `execution.allowed_tools`

Array of tool identifier strings. Empty array `[]` means no tools.

```yaml
allowed_tools:
  - github
  - jira
```

Tool names must match the tool registry (future PR).

## Validation rules (linter)

| Condition | Severity | Code |
|---|---|---|
| Invalid `execution.type` value | error | `invalid_execution_type` |
| Invalid `execution.handler` value | error | `invalid_execution_handler` |
| `automated` with `handler: none` | error | `automated_missing_handler` |
| `automated` without `safety_mode` | error | `automated_missing_safety_mode` |
| `automated` without `allowed_tools` | warning | `automated_missing_allowed_tools` |
| Unknown field in `execution` block | warning | `unknown_execution_field` |
| `timeout_seconds` ≤ 0 | warning | `invalid_timeout` |

## Examples

### Manual skill (default)

```yaml
---
name: laravel
description: "Writes Laravel code following conventions"
---
```

No execution block needed — treated as manual.

### Assisted skill

```yaml
---
name: create-pr
description: "Create a GitHub PR with structured description"
execution:
  type: assisted
  handler: internal
  allowed_tools:
    - github
    - jira
---
```

### Automated skill

```yaml
---
name: quality-fix
description: "Run quality pipeline and fix all errors"
execution:
  type: automated
  handler: shell
  timeout_seconds: 120
  safety_mode: strict
  allowed_tools: []
---
```

## Backward compatibility

- Skills without `execution` block remain fully valid
- No migration required
- The execution block is purely additive
- Existing linter checks are unaffected
