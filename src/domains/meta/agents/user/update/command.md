---
model_tier: medium
name: agents:user-update
pack: meta
tier: 2
cluster: agents
sub: user
description: Open .agent-user.md in the user's IDE for manual edit; validates schema and 100-line cap on save.
suggestion:
  eligible: true
  trigger_description: "edit user persona, update .agent-user.md, change nickname, change language, refresh voice sample"
  trigger_context: "user wants to manually edit the persona file rather than answer interview questions"
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /agents user update

Open `.agent-user.md` in the user's IDE for a manual edit, then
validate against the locked v1 schema on save.

Use when:

- The user knows exactly what they want to change (nickname, language,
  voice sample) and doesn't need the interview flow.
- The user wants to edit the freeform `# Notes` body.
- `/agents user show` flagged a malformed field.

For agent-driven changes from buffered observations, use
[`/agents user review`](review.md) → [`/agents user accept`](accept.md).

## Steps

### 1. Precondition

```bash
ls .agent-user.md 2>/dev/null
```

Missing → print "No `.agent-user.md` found. Run `/agents user init`
first." and stop.

### 2. Open in IDE

Use the [`file-editor`](../../../../.agent-src/skills/file-editor/SKILL.md)
skill — reads `personal.ide` from `.agent-settings.yml` (vscode,
phpstorm, cursor, etc.) and opens the file.

If `personal.ide` is unset or `auto_open_files: false`, print:

```
ℹ️  Open .agent-user.md in your editor and re-run /agents user update --validate when done.
```

### 3. Wait for save → validate

When called with `--validate` (or after the user confirms "done"):

1. Read `.agent-user.md`.
2. Parse frontmatter; check every required field per
   [`agent-user-schema § Field reference`](../../../../docs/contracts/agent-user-schema.md#field-reference).
3. Check file size ≤100 lines.
4. Run the privacy-floor scan (same as `init` step 4): credentials,
   third-party PII, financial figures, health/legal status.

| Result | Action |
|---|---|
| All checks pass | Bump `last_updated` to today; print one-line confirmation |
| Schema violation | Print the offending field + line, ask user to fix |
| >100 lines | Print line count, ask user to trim |
| Privacy-floor hit | Print the suspect line, ask user to redact |

### 4. Bump `last_updated`

On successful validation, rewrite the `last_updated` field with
today's date (ISO `YYYY-MM-DD`). Preserve all other content
verbatim.

### 5. Confirm

```
✅  .agent-user.md validated ({n} lines, last_updated: YYYY-MM-DD).
```

Do NOT commit. Do NOT chain to another `/agents user *` command.

## Rules

- Never edit `.agent-user.md` directly from this command except for
  the `last_updated` bump in step 4. All other edits go through the
  user's IDE.
- Never write third-party PII even if it appears in the user's edit —
  re-surface and ask for redaction.
- Mirror the user's language for all prompts per
  [`language-and-tone`](../../../../.agent-src/rules/language-and-tone.md).

## See also

- Schema: [`agent-user-schema`](../../../../docs/contracts/agent-user-schema.md).
- Parent: [`/agents user`](../user.md).
- Sibling: [`/agents user init`](init.md), [`/agents user show`](show.md), [`/agents user review`](review.md).
