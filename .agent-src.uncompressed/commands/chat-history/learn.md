---
name: chat-history:learn
cluster: chat-history
sub: learn
skills: [learning-to-rule-or-skill]
description: Pick a prior chat-history session and mine it for project-improving learnings — runs learning-to-rule-or-skill on the picked session, drafts proposal(s) under agents/proposals/
disable-model-invocation: true
suggestion:
  eligible: true
  trigger_description: "extract a learning from a past session, mine chat-history for proposals, what did we learn last session, codify a pattern from a prior session"
  trigger_context: "user wants to derive a rule/skill/guideline proposal from the content of one prior session"
---
<!-- cloud_safe: noop -->

# /chat-history learn

User-driven **learning extraction** from a prior session. Surfaces
prior sessions logged in `agents/.agent-chat-history` as numbered options,
the user picks **one**, the agent reads that session's entries and
runs the [`learning-to-rule-or-skill`](../../skills/learning-to-rule-or-skill/SKILL.md)
workflow on the content — surfacing repeated mistakes, successful
patterns, or constraints worth codifying as a rule, skill, or
guideline proposal.

This is the **project-improvement** counterpart to
[`/chat-history import`](import.md): `import` renders a session
verbatim into the current chat for the user to act on; `learn`
mines a session for proposals that improve the agent or the
project itself.

## When NOT to use

- Pull a prior session into the current chat verbatim — use
  [`/chat-history import`](import.md).
- Capture a learning that originated **in the current** session —
  invoke the [`learning-to-rule-or-skill`](../../skills/learning-to-rule-or-skill/SKILL.md)
  skill directly. `learn` is for prior-session mining only.
- Bulk-mine all sessions — out of scope for v1. One session per
  invocation; multi-pick is v2.

## Steps

### 1. Check if enabled

Read `chat_history.enabled` from `.agent-settings.yml`. If `false`
or the section is missing, say so and stop:

```
> 📒 chat-history is disabled (chat_history.enabled = false).
> Set it to true in .agent-settings.yml to start logging.
```

### 2. List sessions

Run `scripts/chat_history.py sessions --json --limit 20`. The
helper returns an array of `{id, count, first_ts, last_ts, preview}`
sorted by `last_ts` desc. Default excludes empty buckets — only
sessions with at least one body entry are surfaced.

If the array is empty, stop:

```
> 📒 No prior sessions found in agents/.agent-chat-history.
```

### 3. Surface as numbered options

Render each session as a numbered option (per the `user-interaction`
rule — Iron Law: numbered options for any picker):

```
> Pick a session to mine for learnings:
>
> 1. {id}  ·  {count} entries  ·  {last_ts}
>    {preview}
> 2. ...
> ...
> N. abort — do not extract any learning
```

Keep the preview ≤ 80 chars. Always include an explicit abort
option as the last numbered choice.

### 4. Wait for the pick

**One question per turn** (per `ask-when-uncertain`). Do not chain
the listing with anything else; do not auto-pick; do not surface a
default. Wait for the user's response.

If the user picks the abort option, stop without reading.

### 5. Read the picked session

Run `scripts/chat_history.py read --session <id>` with the picked
`id`. Hold the entries in working memory — do **not** render them
verbatim into the chat. The verbatim path is `import`'s job; here
the entries are input to step 6.

### 6. Run `learning-to-rule-or-skill`

Apply the [`learning-to-rule-or-skill`](../../skills/learning-to-rule-or-skill/SKILL.md)
procedure on the session content:

1. **Scan** the entries for candidate learnings — repeated
   mistakes, successful patterns, friction points, or constraints
   stated by the user.
2. **Pass each candidate through the Promotion Gate** (§ 0 of the
   skill): repetition, impact, failure pattern, non-duplication,
   scope fit, minimal. Drop candidates that fail any gate.
3. **For each surviving candidate**, run § 4 (search protocol — all
   four steps), then decide rule / skill / guideline / update / no
   action per § 3 of the skill.
4. **Draft a proposal** for every candidate that warrants one,
   following § 8 of the skill (proposal template under
   `agents/proposals/<id>.md`).

If multiple candidates survive, draft them as **separate**
proposals — do not merge unrelated learnings into one.

### 7. Surface the result

Hand back to the user with a structured summary per surviving
candidate:

```
> 📒 Mined session {id} — {N} candidate(s) surfaced

> 1. {learning title}
>    Decision: {rule|skill|guideline|update|no action}
>    Proposal: agents/proposals/{proposal_id}.md
>    Gate: {pass|fail — reason}
> 2. ...
```

If no candidate cleared the Promotion Gate, say so explicitly:

```
> 📒 Mined session {id} — no candidate cleared the Promotion Gate.
```

Do **not** open a PR, do **not** commit the proposals — proposal
files land in `agents/proposals/` (gitignored or curated per
project policy) for the user to review and route via
`upstream-contribute` or merge into `agents/overrides/`.

## Gotchas

- **Promotion Gate is hard.** A grep miss is not proof of
  non-duplication — § 4 of the skill mandates the four-step search
  protocol. Do not skip it.
- **One pick per invocation.** Multi-pick is v2. If the user wants
  to mine a second session, run `/chat-history learn` again.
- **Read-only on the log.** This command never writes to
  `agents/.agent-chat-history`. It writes proposal drafts under
  `agents/proposals/` only.
- **No auto-promotion.** Drafted proposals stay in `proposals/`
  until the user routes them. `learn` never invokes
  `upstream-contribute` itself.

## See also

- [`/chat-history import`](import.md) — verbatim render of a prior session
- [`learning-to-rule-or-skill`](../../skills/learning-to-rule-or-skill/SKILL.md) — the workflow this command orchestrates
- [`upstream-contribute`](../../skills/upstream-contribute/SKILL.md) — promote a project-scoped proposal upstream
- [`scripts/chat_history.py`](../../../scripts/chat_history.py) — `sessions` and `read --session` CLI surface
- [`user-interaction`](../../rules/user-interaction.md) — numbered-options Iron Law
- [`ask-when-uncertain`](../../rules/ask-when-uncertain.md) — one-question-per-turn Iron Law
