---
proposed_by: road-to-a-quota-the-user-sees-coming steps 3.2, 4.3 and 5.x (inbox round 2026-10-ax, owner directive 2026-10-22)
implemented_by: claude-opus-5.5 session on feat/inbox-2026-10-ax
reviewed_by: AI council, 2 seats, provider-diverse (anthropic + openai), round 6 of 2026-10-25
providers: [anthropic, openai]
verdict: ratified
seats:
  anthropic: ratified
  openai: ratified
effective_after: merge
subject: d9832d073a334e54f58689898ae4e4760eb9a5c41768209c141cb98a4b4141fb
---

<!-- evidence-type: ratification -->

# Ratification — quota notices, the metered spawn ask, and the `confirmation` effect

`check_kernel_edit_ratified` gates five hook-plumbing files on this branch:
`src/config/hook-bundle-budget.json`, `src/scripts/hook_manifest.yaml`, its compiled projection
`src/scripts/hook_manifest.json`, `src/scripts/hooks/dispatch_hook.ts` and
`src/scripts/hooks/permission_gate.ts`. The `subject:` digest covers all five, computed with
`./scripts-run src/scripts/ratification_subject --files $(git diff --name-only origin/main...HEAD) --base-ref origin/main`
at revision `eedbcd043d`, the revision round 6 reviewed (prompt:
`agents/evidence/council/quota-notice-ratification-r6-20261025.question.md`, which names this digest).
The header is the output of `ratification_header --seat anthropic=ratified --seat openai=ratified`.

## What was ratified

- **`quota-notice`** (claude `user_prompt_submit`, `effect: notification`): one `user_notice` per
  plan-window state and reset on the machine, one per session at 80 % context fill, one per session
  that may bill per token (key, auth token, Bedrock/Vertex or `apiKeyHelper` present — presence only).
- **`metered-spawn-ask`** (claude `pre_tool_use` and `post_tool_use` on `Agent`/`Task`, the same lazy
  chunk): in a session that may bill per token without a billing grant, the host's native ask on a
  spawn. The ask marks its own call (hashed `tool_use_id`) pending; only that call's completion, within
  eight days, approves the session, and the mark is spent before the approval is written. Only
  `AGENT_CONFIG_NO_SPAWN_ASK=1` or a billing grant silences it; an unanswered ask holds the spawn
  (observed on Claude Code 2.1.310 in print mode, with a control).
- **A new, closed effect `confirmation`.** `permission_gate.ts` hands an `ask` to the host only from a
  `confirmation` concern, as one line without control characters, 300 characters per reason and 600
  joined; every other `ask` still only withholds the allow. `lint_hook_manifest` admits the effect only
  for `CONFIRMATION_CONCERNS` (today `metered-spawn-ask`). `dispatch_hook.ts` passes the concern's
  effect on one existing line.
- **`max_bytes` 1,554,977 → 1,556,670** with a `raise_log` entry (reading 1,556,562 B); 202 B were freed
  first, and the pressure model was moved out of the dispatch path to keep the raise at that size.

**Classification.** Both seats ratified and both said the same thing about scope: this is a
controlled authority expansion — an admitted `confirmation` concern can now put a prompt in front of
the user and hold an unattended call — used to narrow paid spend. It is recorded as `ratified`, not
`confirmed-non-expanding`.

## How it got here

Six rounds, CLI subscription transport, USD 0.00. Prompts committed verbatim as
`agents/evidence/council/quota-notice-ratification-r1-20261025.question.md` through `…-r6-…`. Every
fix below has a test that was seen red with its guard removed.

- **Round 1, refused 2/2:** the session was stamped "asked" when the ask was emitted; any concern's ask
  reached the host; reason text was unbounded; the effect was mislabelled.
- **Round 2, refused 2/2:** any completed metered spawn approved the session, including one under a
  grant or with its ask suppressed. → per-call pending mark redeemed only by that call.
- **Round 3, refused 1 of 2:** the approval's expiry was not checked on read. → age checked in
  `spawnApproved()`; the effect became a closed set in the linter.
- **Round 4, refused 2/2:** CI silenced the ask, so a paid spawn ran without the grant the manifest
  said it needs. → only the explicit opt-out silences it; the host behaviour was probed.
- **Round 5, refused 2/2:** a stale pending mark could still be redeemed. → one age check for both
  marks; the pending mark is spent once.
- **Round 6, ratified 2/2.**

## Non-blocking notes from round 6, and their disposition

- *"Future-dated" is unqualified while `freshMarker()` allows one minute of clock slack.* Taken: the
  comment on `freshMarker()` now says "more than a minute ahead".
- *A project's committed `apiKeyHelper` can trigger the ask as a false positive.* Taken as a stated
  limit: the notice and the ask both say "may bill" and point at `/status`; the ask names only the
  fixed source label, never the helper's content.
- *Coverage is claude-only and `Agent`/`Task` only.* Stated in the manifest comment, the admission row
  and here.
- *Telemetry and rollback owner.* Not built. The measurement stub
  `agents/roadmaps/stubs/road-to-a-quota-notice-that-earned-its-bands.md` owns the numbers; rollback is
  `AGENT_CONFIG_NO_SPAWN_ASK=1` at runtime or reverting the binding, by the maintainer.
