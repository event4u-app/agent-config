---
name: refine-ticket
skills: [refine-ticket]
description: Refine a Jira/Linear ticket before planning — rewritten ticket + Top-5 risks + persona voices, orchestrates validate-feature-fit and threat-modeling, ends with a close-prompt
disable-model-invocation: true
suggestion:
  eligible: true
  trigger_description: "refine PROJ-123, tighten the acceptance criteria, is this ticket clear"
  trigger_context: "ticket key in prompt with vague acceptance criteria"
---

# refine-ticket

## Instructions

### 1. Resolve input (delegate to jira-ticket loader)

Accept one of four input paths:

1. **Explicit key** — `/refine-ticket PROJ-123`
2. **Branch detection** — no arg → `git branch --show-current` + regex `[A-Z]+-[0-9]+`
3. **Pasted text** — markdown block under the command
4. **URL** — `/refine-ticket https://…/browse/PROJ-123`

For paths 1, 2, 4: run steps 1-3 of the [`jira-ticket`](jira-ticket.md) command
(extract ID, fetch `GET /issue/{id}`, scan for Sentry links). For path 3: parse
the pasted markdown.

If no input resolves: ask **one** focused question:

```
🎫 Which ticket should I refine? Paste a Jira key, URL, or the ticket text.
```

### 2. Pick the output language

Apply the skill's language-strategy block. Fallback order, first hit wins:

1. **User-message language** — latest user message decides. Honours
   the global `language-and-tone` iron law.
2. **Ticket body language** — when the invocation is minimal
   (`/refine-ticket PROJ-123` with no prose), mirror the ticket's
   own language (summary + description).
3. **`.agent-settings.yml` default** — fallback when both are silent;
   English when the setting is absent.

Quoted identifiers (keys, paths, commands) stay native; only the
prose mirrors the picked language.

### 3. Run the refine-ticket skill

Invoke the [`refine-ticket`](../skills/refine-ticket/SKILL.md) skill with the
loaded ticket as input. The skill handles detection, orchestration, persona
application, synthesis, and close-prompt.

### 4. Honor flags

- `--personas=<list>` — comma-separated override of the Core-6 default
  (e.g. `--personas=developer,senior-engineer,critical-challenger`)
- `--personas=+qa` — add the QA specialist to the Core-6
- `--fresh-eyes` — reweight toward first-time-reader confusion signals
  (critical-challenger voice gets more lines; less assumed context)

No `--apply` flag in v1. Write-back is user-controlled via the close-prompt
at the end of the skill output.

### 5. Emit output + close-prompt

Render the three-section output template (refined ticket / Top-5 risks /
persona voices) plus the close-prompt. Stop there. Do **not** chain into
`/estimate-ticket` or `/feature-plan` — separate invocations by design.

## Examples

```
/refine-ticket PROJ-123
/refine-ticket                              # uses current branch
/refine-ticket --personas=+qa PROJ-123
/refine-ticket --fresh-eyes https://acme.atlassian.net/browse/PROJ-123
```

## See also

- [`jira-ticket`](jira-ticket.md) — ticket loader this command delegates to
- [`estimate-ticket`](estimate-ticket.md) — sibling command — run after refining if you also need sizing
- [`feature-plan`](feature-plan.md), [`feature-explore`](feature-explore.md) — downstream commands
