---
recommended_model: inherit
name: ghostwriter:show
tier: 2
cluster: ghostwriter
sub: show
description: Render a single ghostwriter profile in full — identity, style fingerprint, voice samples, taboos, source URLs. Read-only.
suggestion:
  eligible: true
  trigger_description: "show ghostwriter profile, inspect public-figure voice, view ghostwriter details, what does this profile contain"
  trigger_context: "user wants to inspect a single captured ghostwriter profile before writing with it or deciding to refresh / delete it"
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /ghostwriter:show

Read-only render of a single `agents/reference/ghostwriter/<slug>.md` profile.
Surfaces every field needed to decide whether to consume the voice
(`/ghostwriter:write`), refresh it (`/ghostwriter:fetch <slug>
--force-refresh`), or delete it (`/ghostwriter:delete`).

## Steps

### 1. Resolve target

Argument shapes:

- `/ghostwriter:show <slug>` → positional slug.
- `/ghostwriter:show <n>` → numeric index from the most recent
  `/ghostwriter:list` ordering (re-derive by listing slugs sorted
  ascending; index is 1-based).
- `/ghostwriter:show` → interactive — print the same numbered table
  as [`/ghostwriter:list`](list.md) and ask the user to pick one
  by number or slug, one question per turn.

Resolution table:

| State | Action |
|---|---|
| File missing | Abort. Print: *"No profile at `agents/reference/ghostwriter/<slug>.md`. Run `/ghostwriter:list` to see what exists."* |
| File present, `fictional: true` | Print a one-line warning before rendering: *"⚠️ This is a package-side fixture, not a real-person profile."* Then render normally. |
| File present, real | Render (Step 2) |

### 2. Render

Print the profile as fenced sections in the user's language. Sections,
in order:

1. **Header** — name, slug, public-figure category.
2. **Identity** — `role_or_title`, `era`, source URLs as a bullet list,
   `fetched_at`, `attestation_recorded_at`, `confidence`.
3. **Source provenance** — `count`, `last_fetched_at`, `types` (bullet
   list), `verification`. If `verification: user-asserted`, prefix the
   section header with `⚠️`.
4. **Style fingerprint** — `sentence_length_avg`, `vocab_register`,
   `opener_patterns`, `closer_patterns`, `hashtag_rules`, `emoji_rules`,
   `paragraph_cadence`.
5. **Free-form notes** — `style.free_form_notes` verbatim.
6. **Voice samples** — each sample as a fenced quote block with the
   source URL underneath. Truncate samples > 200 words with `[…]` and
   note the cap.
7. **Taboos** — bullet list.
8. **Body — `# Notes`** — the in-file Notes section, verbatim (may be
   empty for fresh fetches).

### 3. Footer hints

After the rendered profile, print the available next actions:

```
Next:
  /ghostwriter:write --as=<slug>           # draft in this voice
  /ghostwriter:fetch <slug> --force-refresh  # rebuild from scratch
  /ghostwriter:delete <slug>               # hard-delete the file
```

### 4. Stale + user-asserted surface

If `last_fetched_at` is > 90 days old, append a one-line warning:

```
⚠️  Last fetched YYYY-MM-DD (>90 days). Consider /ghostwriter:fetch <slug> --force-refresh.
```

If `verification: user-asserted`, append:

```
⚠️  Profile is user-asserted (no host-fetched verification). Style fidelity may be lower.
```

Non-blocking.

## Rules

- **Read-only.** Do not modify, move, or write the file.
- **Do NOT commit, push, or open a PR.** No git ops.
- **Do NOT redact voice samples by topic.** The whole sample (capped at
  200 words per `ghostwriter-schema`) is part of the schema contract;
  partial rendering would mislead the consumer about the captured
  style.
- **Do NOT auto-trigger a re-fetch on stale profiles.** Surface the
  warning and let the user run `/ghostwriter:fetch <slug>
  --force-refresh` explicitly.
- **Do NOT consume `personas/*.md` or `.agent-user.md`.** Wrong
  primitive — those are not ghostwriters.

## See also

- [`/ghostwriter`](../ghostwriter.md) — parent cluster.
- [`/ghostwriter:list`](list.md) — index of profiles (use first to pick a slug).
- [`/ghostwriter:fetch`](fetch.md) — refresh path; `--force-refresh` rebuilds from scratch.
- [`/ghostwriter:delete`](delete.md) — hard-delete the profile.
- [`/ghostwriter:write`](write.md) — consume the rendered voice.
- [`ghostwriter-schema`](../../../docs/contracts/ghostwriter-schema.md) — field definitions used here.
