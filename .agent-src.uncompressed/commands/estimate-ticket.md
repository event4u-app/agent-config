---
name: estimate-ticket
skills: [estimate-ticket]
description: Estimate a Jira/Linear ticket before sprint planning — size + risk + split recommendation + uncertainty, sibling to /refine-ticket, ends with a close-prompt
disable-model-invocation: true
---

# estimate-ticket

## Instructions

### 1. Resolve input (delegate to jira-ticket loader)

Accept the same four input paths as [`/refine-ticket`](refine-ticket.md):

1. **Explicit key** — `/estimate-ticket PROJ-123`
2. **Branch detection** — no arg → `git branch --show-current` + regex `[A-Z]+-[0-9]+`
3. **Pasted text** — markdown block under the command
4. **URL** — `/estimate-ticket https://…/browse/PROJ-123`

For paths 1, 2, 4: run steps 1-3 of the [`jira-ticket`](jira-ticket.md) command
(extract ID, fetch `GET /issue/{id}`, scan for Sentry links). For path 3: parse
the pasted markdown.

If no input resolves: ask **one** focused question:

```
📏 Which ticket should I estimate? Paste a Jira key, URL, or the ticket text.
```

### 2. Check estimability first

If the ticket is too vague to size (no concrete AC, no out-of-scope,
no named dependencies), emit a single-line redirect at the top of the
output and stop before the sizing step:

```
> ⚠️  This ticket is underspecified — run `/refine-ticket` first, then re-estimate.
```

Still produce an `Uncertainty: Underspecified` estimate block so the
caller has something to record.

### 3. Run the estimate-ticket skill

Invoke the [`estimate-ticket`](../skills/estimate-ticket/SKILL.md) skill with
the loaded ticket. The skill applies the four-axis sizing heuristic, the
persona cast, and produces the output template.

### 4. Honor flags

- `--personas=<list>` — comma-separated override of the Core-6 default
- `--personas=+qa` — add the QA specialist (regression risk, test surface)
- `--scale=<map>` — override the story-point mapping
  (default `S=2,M=3,L=5,XL=8`; example: `--scale=S=1,M=2,L=3,XL=5`)

No `--apply` flag in v1. Write-back is user-controlled via the close-prompt
at the end of the skill output.

### 5. Emit output + close-prompt

Render the four-section output (estimate / rationale / split points /
persona voices) plus the close-prompt. Stop there. Do **not** chain into
`/feature-plan` — separate invocations by design.

## Examples

```
/estimate-ticket PROJ-123
/estimate-ticket                              # uses current branch
/estimate-ticket --personas=+qa PROJ-123
/estimate-ticket --scale=S=1,M=2,L=3,XL=5 PROJ-123
```

## See also

- [`refine-ticket`](refine-ticket.md) — sibling; run first if the ticket is vague
- [`jira-ticket`](jira-ticket.md) — ticket loader this command delegates to
- [`feature-plan`](feature-plan.md) — downstream planning
