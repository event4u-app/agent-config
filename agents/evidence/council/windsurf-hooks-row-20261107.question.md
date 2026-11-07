# Council question — the `windsurf` row of `host_lowering.yaml` after the vendor dropped its hooks page (issue #2805)

The owner delegated this decision to the council on 2026-11-07.

## Context

`src/scripts/hooks/host_lowering.yaml` records, per AI-coding host, which native
hook events this package's installer binds, and which vendor page establishes
them (`verified.docs_url`, `docs_digest`, `docs_at`, `expires`). A weekly watcher
re-fetches each `docs_url` and fails when a token the row claims (each bound
slot's native event name) is no longer on the page. Rows are re-established by
hand after a human reading; an edit to this file needs a two-provider
ratification record. `block_exit: null` on every windsurf slot: this package
has never established a refusal there, it only injects context / runs side
effects.

The windsurf row today:

```yaml
windsurf:
  surfaces:
    any:
      entry_shape: windsurf-hooks-json      # installer writes .windsurf/hooks.json
      json_shape: none
      fail_policy: propagate
      verified:
        docs_at: 2026-10-26
        docs_url: https://docs.devin.ai/desktop/cascade/hooks.md
        docs_digest: 2871edb5…
        expires: 2027-10-26
      slots:
        session_start:      { native: post_setup_worktree,   block_exit: null, answered_at: 2026-09-29 }
        user_prompt_submit: { native: pre_user_prompt,       block_exit: null, answered_at: 2026-09-29 }
        stop:               { native: post_cascade_response, block_exit: null, answered_at: 2026-09-29 }
```

## What a reading on 2026-11-07 found

- `docs.devin.ai/desktop/cascade/hooks.md` (and the older
  `docs.windsurf.com/windsurf/cascade/hooks.md`) now redirect to
  `docs.devin.ai/desktop/devin-local/customizations.md`, a general page about the
  new "Devin Local" agent in Devin Desktop. None of the three bound event names
  appears on it.
- `docs.devin.ai/desktop/cascade.md` — "Cascade (legacy)", described as the
  reference for the legacy Cascade agent in Devin Desktop — documents
  `post_setup_worktree` configured in `.windsurf/hooks.json`. It does not mention
  `pre_user_prompt` or `post_cascade_response`. No other page in the
  `docs.devin.ai` or `docs.windsurf.com` `llms.txt` indexes does.
- Devin Local / Devin CLI hooks live in `.devin/hooks.v1.json` with events
  `PreToolUse`, `PostToolUse`, `PermissionRequest`, `UserPromptSubmit`, `Stop`,
  `PostCompaction`, `SessionStart`, `SessionEnd`; exit 2 or
  `decision: "block"` blocks. Devin's config import from Windsurf covers rules,
  skills and MCP servers — not hooks.
- An enterprise control "Enable Cascade" can disable the legacy Cascade agent.
- Whether legacy Cascade still executes `pre_user_prompt` /
  `post_cascade_response` is not established by any source available; no probe
  has ever been run on this host. An Internet Archive snapshot of the old page
  (2026-10-22) exists in the index, but archive.org was offline during the
  reading, so its content is unverified.

## Options

1. **Keep all three bindings; cite an archive.** `docs_url` → the live legacy
   Cascade page; the two dropped events carry a slot-level `docs_url` to a
   verified archived snapshot of the old page (a slot with its own `docs_url` is
   excluded from the watcher's token check), plus a comment that the live
   vendor documentation no longer names them. Watch turns green once a snapshot
   is verified; until archive.org is reachable this option cannot complete.
2. **Unbind the two undocumented slots.** The installer stops writing
   `pre_user_prompt` and `post_cascade_response`; `post_setup_worktree` stays,
   cited from the live legacy page. Watch green immediately. Windsurf users lose
   the prompt-time and stop-time injections, including if legacy Cascade still
   runs them.
3. **Re-bind windsurf to the Devin hooks contract** (`.devin/hooks.v1.json`,
   new entry shape, installer code, tests) as a separate change with its own
   roadmap; the watch stays red until it lands.

Options may be combined (e.g. one now, another as a follow-up) if you argue for it.

## Question

Which option (or combination) should this package take for the windsurf row,
and why? Name any defect in the framing above. End with one line
`VERDICT: option-1`, `VERDICT: option-2`, `VERDICT: option-3`, or
`VERDICT: option-<n>+<m>` for a combination.
