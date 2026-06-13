---
model_tier: medium
name: agents-user-show
pack: meta
tier: 2
visibility: internal
cluster: agents
sub: user
skills: [agents]
description: Read-only render of .agent-user.md — prints the persona summary the host agent loads at session start.
suggestion:
  eligible: true
  trigger_description: "show user persona, render .agent-user.md, print who the user is"
  trigger_context: "user wants to see what's currently in .agent-user.md without editing"
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /agents user show

Read-only render of the project-root `.agent-user.md` per
[`docs/contracts/agent-user-schema.md`](../../../../../../../../../docs/contracts/agent-user-schema.md).

Use when:

- You want to see what persona the host agent currently loads.
- You want to confirm `last_updated` is fresh (≤90 days).
- You want a paste-ready summary for handoff or onboarding.

Does **not** edit, observe, or buffer anything. Pure read.

## Steps

### 1. Locate the file

```bash
ls .agent-user.md 2>/dev/null
```

| State | Action |
|---|---|
| Present | Proceed |
| Missing | Print "No `.agent-user.md` found at project root. Run `/agents user init` to create one." and stop |

### 2. Parse frontmatter

Parse the YAML frontmatter and the body (everything after the second
`---`). Validate against the locked v1 schema:

- `version` is `1`.
- `identity.name`, `language`, `role`, `style.pace`,
  `voice_sample`, `last_updated` are all present.
- File is ≤100 lines total.

Any violation → print a one-line warning identifying the missing /
malformed field and continue with the render (so the user can fix it
via `/agents user update`).

### 3. Render

Print the persona in this exact shape:

```
.agent-user.md  ({n} lines, last_updated: YYYY-MM-DD{staleness_marker})

  Identity   : {nickname or name}  ({name} if nickname is set)
  Language   : {language}
  Role       : {role}
  Style      : {pace}

  Voice sample
  ─────────────
  {voice_sample, indented 2 spaces}

  Notes
  ─────────────
  {body, indented 2 spaces; "(empty)" if no notes}
```

Where `{staleness_marker}` is:

- empty when `last_updated` is within 90 days.
- ` ⚠️  >90 days` when older (per the schema staleness rule).

### 4. Loader hint

If the host-agent loader has NOT yet picked up the file this session
(detect via session memory if available), print one line:

```
ℹ️  Host agent will load this on next session start. Restart your chat to apply.
```

Otherwise omit — agent already knows.

### 5. Stop

Do NOT chain to other `/agents user *` commands. Do NOT commit.

## Rules

- Read-only. Never write `.agent-user.md` from this command.
- Never print fields the schema does not define — even if they exist
  in the file. (Forward-compat: an unexpected field is a warning, not
  a render target.)
- Mirror the user's language for the rendered labels (`Identity` /
  `Identität`, `Language` / `Sprache`, etc.) per
  [`language-and-tone`](../../../../dist/agent-src/rules/language-and-tone.md).

## See also

- Schema: [`agent-user-schema`](../../../../../../../../../docs/contracts/agent-user-schema.md).
- Parent: [`/agents user`](../user.md).
- Sibling: [`/agents user init`](init.md), [`/agents user update`](update.md).
