# Runtime Layer

Guideline for defining and using execution metadata on skills.

## Execution block

Skills can optionally declare an `execution` block in YAML frontmatter:

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
| `manual` | Skill is instructional only — no automated actions | ✅ default |
| `assisted` | Skill prepares actions for human confirmation | |
| `automated` | Skill can execute safely without confirmation | |

If no `execution` block is present, the skill is treated as `manual`.

## Handler types

| Handler | When to use |
|---|---|
| `none` | No handler needed (manual skills) |
| `shell` | Executes shell commands (e.g., linting, testing) |
| `php` | Executes PHP code (e.g., artisan commands) |
| `node` | Executes Node.js scripts |
| `internal` | Uses internal agent capabilities only |

## Safety mode

| Mode | Meaning |
|---|---|
| `strict` | All safety checks enforced, no bypass allowed |

Only `strict` is allowed in this phase. Future phases may introduce `relaxed` for trusted environments.

## Allowed tools

An explicit list of external tool identifiers the skill may access during execution.
Empty list (`[]`) means no external tools.

```yaml
allowed_tools:
  - github
  - jira
```

Tool names must match entries in the tool registry (see tool-integration roadmap).

## Rules for authors

1. **Default is manual** — omitting the execution block means the skill is manual.
2. **Assisted before automated** — prefer `assisted` unless the skill is provably safe.
3. **Handler must match type** — `automated` requires a handler other than `none`.
4. **Safety mode is mandatory for automated** — `automated` without `safety_mode: strict` is invalid.
5. **Allowed tools must be declared** — undeclared tool usage is a linter error.
6. **Timeout is advisory** — used for planning, not hard enforcement in this phase.

## Migration

Existing skills without an execution block remain valid.
No migration is required — the execution block is purely additive.

## Validation

The skill linter validates:

- `execution.type` must be one of: `manual`, `assisted`, `automated`
- `execution.handler` must be one of: `none`, `shell`, `php`, `node`, `internal`
- `automated` type requires `handler` ≠ `none`
- `automated` type requires `safety_mode: strict`
- `allowed_tools` entries must be strings
- Unknown fields inside `execution` block produce warnings

## Anti-patterns

- Adding `automated` to skills that modify files without verification
- Using `shell` handler without specifying which commands are safe
- Declaring `allowed_tools` without a matching tool registry entry
- Setting `timeout_seconds: 0` (use a positive value or omit)
