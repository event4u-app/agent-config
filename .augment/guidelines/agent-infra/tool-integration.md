# Tool Integration

Declaring and using external tool integrations in skills.

## Core principle

Tools are permissions, not abilities. Declare, allowlist, audit.

## Tool declaration

Via `execution.allowed_tools`:

```yaml
execution:
  type: assisted
  handler: internal
  allowed_tools:
    - github
    - jira
```

## Permission model

| Rule | Description |
|---|---|
| Deny by default | No access unless declared |
| Allowlist only | Must match tool registry |
| Read-first | Write requires explicit approval |
| No hidden credentials | No embedded keys/tokens |

## Fine-grained permissions

```yaml
tool_permissions:
  github:
    actions: [read_pr, create_pr]
  jira:
    actions: [read_ticket, search_tickets]
```

## Supported tools

| Tool | Actions | Default |
|---|---|---|
| `github` | read_pr, read_issue, create_pr, list_files | read-only |
| `jira` | read_ticket, search_tickets, add_comment | read-only |

New tools require: adapter in `scripts/tools/`, registry entry, docs in `agents/docs/tools/`.

## Validation (linter)

| Condition | Severity |
|---|---|
| Undeclared tool in allowed_tools | error |
| Tool not in registry | warning |
| Automated + undeclared tools | error |
| Missing permission block for restricted tool | warning |

## Anti-patterns

- Using tools without `allowed_tools` declaration
- Assuming credentials available in environment
- Mixing read/write without explicit separation
- Adding unnecessary tools to skills
