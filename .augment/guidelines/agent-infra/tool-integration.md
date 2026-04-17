# Tool Integration

Guideline for declaring and using external tool integrations in skills.

## Core principle

Tools are permissions, not abilities. Every tool access must be declared, allowlisted, and auditable.

## Tool declaration in skills

Skills declare tool usage in the `execution.allowed_tools` field:

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
| Deny by default | No tool access unless explicitly declared |
| Allowlist only | Only registered tools can be used |
| Read-first | Prefer read-only actions; write actions require explicit approval |
| No hidden credentials | Tools must not embed or assume credentials |

## Tool permissions

Skills can declare fine-grained permissions per tool:

```yaml
tool_permissions:
  github:
    actions:
      - read_pr
      - create_pr
  jira:
    actions:
      - read_ticket
      - search_tickets
```

## Supported tools

| Tool | Available actions | Default |
|---|---|---|
| `github` | read_pr, read_issue, create_pr, list_files | read-only |
| `jira` | read_ticket, search_tickets, add_comment | read-only |

New tools require:
1. An adapter implementation in `scripts/tools/`
2. Registration in the tool registry
3. Documentation in `agents/docs/tools/`

## Validation rules (linter)

| Condition | Severity |
|---|---|
| Undeclared tool in allowed_tools | error |
| Tool listed but not in registry | warning |
| Automated execution with undeclared tools | error |
| Permission block missing for restricted tool | warning |

## Anti-patterns

- Using tools without declaring them in `allowed_tools`
- Assuming credentials are available in the environment
- Mixing read and write actions without explicit separation
- Adding tools to a skill that doesn't need them
