---
name: agents:user-init
tier: 2
cluster: agents
sub: user
skills: [agents]
description: Interactive interview that creates the project-root .agent-user.md from the locked v1 schema (name, language, role, style, voice_sample).
disable-model-invocation: true
suggestion:
  eligible: false
  rationale: "User-persona bootstrap — only deliberately, never auto-suggested."
workspaces:
  - agent-config-maintainer
packs:
  - meta
lifecycle: active
trust:
  level: core
  confidence: high
  human_review_required: false
install:
  default: true
  removable: false
---

# /agents user init

Short interactive interview that creates **`.agent-user.md`** at the
project root from the locked v1 schema in
[`docs/contracts/agent-user-schema.md`](../../../../docs/contracts/agent-user-schema.md).

Use when:

- The user wants the agent to address them by name / nickname / role.
- A fresh consumer project does not yet have `.agent-user.md`.

Refuses to overwrite an existing file without `--force`.

## Steps

### 1. Precondition checks

```bash
ls .agent-user.md 2>/dev/null
ls docs/contracts/agent-user-schema.md 2>/dev/null
```

| State | Action |
|---|---|
| `.agent-user.md` missing | Proceed |
| `.agent-user.md` exists, no `--force` | Abort; offer `/agents user update` instead |
| `.agent-user.md` exists, `--force` set | Proceed (will overwrite); back up to `.agent-user.md.bak` first |
| Schema contract missing | Abort with "package not installed / out of date" hint |

### 2. Pre-fill from `.agent-settings.yml`

If `.agent-settings.yml` exists, read `personal.user_name` and offer
it as the default for `identity.name`. Do **not** read anything else —
the persona file is a separate primitive.

### 3. Interview (one question per turn, numbered options)

Ask in this order. Each answer drives one frontmatter field.

1. **Name** — required.
   `Wie soll ich dich ansprechen? (Name)` / `What name should I use?`
   Default: pre-fill from step 2 if available.

2. **Nickname** — optional.
   `Bevorzugter Spitzname für den Chat? (leer = wie Name)` /
   `Preferred chat nickname? (blank = same as name)`

3. **Language** — required, BCP-47-ish.
   ```
   > 1. de — Deutsch
   > 2. en — English
   > 3. other — type the code (e.g. "fr", "es")
   ```
   Default: detect from the user's last message.

4. **Role** — required, short free-form.
   `Kurze Rollenbeschreibung (z. B. "founder/engineer", "product manager", "designer")` /
   `Short role label`

5. **Style — pace**. (Formality is not asked — the agent always uses
   informal "Du".)
   ```
   > 1. pragmatic — balanced (default)
   > 2. thorough  — more verification, longer replies
   > 3. rapid     — shorter replies, fewer caveats
   ```

6. **Voice sample** — required.
   `Paste eine typische Nachricht von dir (1-3 Sätze, im normalen Schreibstil)` /
   `Paste one typical message of yours (1–3 sentences, your normal style)`

### 4. Privacy-floor sanity check

Before writing, scan the collected `voice_sample` and `role` for:

- Credentials, API keys, tokens, passwords (regex on common formats).
- Third-party full names that look like contacts (heuristic: capitalized first+last pair near words like "wife", "boss", "kid", "Frau", "Mann", "Chef").
- Financial figures (currency symbols + numbers).
- Health/legal status keywords.

Hit → surface the line and ask the user to redact before proceeding.
Per [`agent-user-schema § Explicit exclusions`](../../../../docs/contracts/agent-user-schema.md#explicit-exclusions).

### 5. Render and write

Render the frontmatter exactly as locked in the schema. Add an empty
`# Notes` body. Set `last_updated` to today (ISO date).

```yaml
---
version: 1
identity:
  name: "..."
  nickname: "..."          # omit if blank
language: "..."
role: "..."
style:
  pace: "...""
voice_sample: |
  ...
last_updated: "YYYY-MM-DD"
---

# Notes
```

Verify the rendered file is ≤100 lines (it will be — empty Notes body)
before writing to `.agent-user.md`.

### 6. Gitignore check

If the consumer `.gitignore` does not yet contain `.agent-user.md`,
print a one-line nudge:

```
ℹ️  .agent-user.md is not yet in your .gitignore. Run /sync-gitignore to add it.
```

The package-managed block adds it automatically; this nudge only
fires when the block is missing or out of date.

### 7. Confirm

Print the file path and a one-line summary:

```
✅  .agent-user.md written ({n} lines).
   identity: {nickname or name} · language: {lang} · role: {role} · style: {pace}
```

Do NOT commit. Do NOT run any other `/agents user` sub-sub-command.

## Rules

- One question per turn. Never batch.
- Numbered options where the answer is enum-like (per
  [`user-interaction`](../../../../.agent-src/rules/user-interaction.md)).
- Never invent fields not in the locked v1 schema.
- Never write third-party PII even if the user pastes it — surface
  and ask for redaction.

## See also

- Schema: [`agent-user-schema`](../../../../docs/contracts/agent-user-schema.md).
- Parent: [`/agents user`](../user.md).
