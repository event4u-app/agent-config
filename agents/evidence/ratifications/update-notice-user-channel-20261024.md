---
proposed_by: road-to-an-update-that-installs-itself-only-when-it-is-safe step 3.1 (reopened 2026-10-21 for want of a delivery path)
implemented_by: claude-opus-5.5 session on drain/update-installs-itself-20261024
reviewed_by: AI council, 2 seats, provider-diverse (anthropic + openai), round 6 of 2026-10-24
providers: [anthropic, openai]
verdict: ratified
seats:
  anthropic: ratified
  openai: ratified
effective_after: merge
subject: 1bb1747f6abc89263ec9fe5552cc847cd19586340d8dadaaff39ef9c43e0d770
---

<!-- evidence-type: ratification -->

# Ratification — a user channel in the dispatcher, and `update-notice` registered on it

`check_kernel_edit_ratified` gates six hook-plumbing files on this branch:
`src/config/hook-bundle-budget.json`, `src/scripts/hook_manifest.yaml`, its compiled projection
`src/scripts/hook_manifest.json`, `src/scripts/hooks/dispatch_hook.ts`,
`src/scripts/hooks/host_semantics.ts` and the new `src/scripts/hooks/user_notice.ts`. The `subject:`
digest covers all six, computed with
`./scripts-run src/scripts/ratification_subject --files $(git diff --name-only origin/main...HEAD) --base-ref origin/main`
at revision `1d91d15fde`. The gated files are byte-identical to the ones round 6 reviewed (commit
`d292436e73`); the commit after it touched only the concern, its test and the contract prose.

## What was ratified

- **A user-addressed reply field.** A concern may reply `user_notice`. The dispatcher accepts it only
  from `effect: notification` concerns, caps it at 1,000 characters, and emits it — on exit 0 and only
  on `claude` — as `systemMessage`. That this field stays out of model context was reproduced on
  Claude Code 2.1.310 with a positive control
  (`agents/evidence/analysis/system-message-probe-2026-10-24.md`).
- **Structural composition.** Context, the native emission and the notice are merged as JSON
  structures; without a notice the output is byte-identical to before, and any shape the merge cannot
  extend safely keeps the old output and drops the notice.
- **A receipt.** The dispatcher writes `user-notice-<concern>.delivered` (`{session_id, at}`) under the
  user-global root for each notice actually put into the output. It evidences emission into the host's
  output, not that the user read it.
- **`update-notice` registered** on `claude` `session_start` only, loaded from its own chunk. Through
  the host it keeps a report pending until a receipt names that session, so a dropped notice is said
  again; it installs nothing and starts nothing.
- **`max_bytes` 1,551,000 → 1,553,800** with a `raise_log` entry: +2,595 B measured per module; both
  seats accepted the raise over the chunk alternatives already measured as poor trades.

**Both seats classify this as an authority expansion, bounded:** a lifecycle hook can now put text in
front of the user. It cannot install, start a process, or reach the model through this field. Both
asked that any host added to `USER_NOTICE_HOSTS`, and any new `effect: notification` concern, be
reviewed as authority-sensitive.

## How it got here

Six rounds over the same change, CLI subscription transport, USD 0.00. Prompts committed verbatim:
`agents/evidence/council/update-notice-user-channel-ratification-r1-20261024.question.md` through
`…-r6-20261024.question.md`.

- **Round 1, both refused:** context and emission were concatenated as text before the notice was
  merged, so a JSON emission could have been wrapped into model-facing context. Rewritten as a
  structural merge; the host behaviour was probed rather than read off the binary.
- **Round 2, both ratified,** naming one hardening: wrong-typed fields were silently replaced. They now
  keep the old output. Done rather than deferred, which re-opened the gated files.
- **Round 3, one refused:** the concern counted a notice as reported before the dispatcher could still
  drop it on a non-zero exit. Answered by pinning that its slot is not block-capable.
- **Round 4, both refused:** that answer did not cover an exit-0 structural fallback. Strategy changed:
  the receipt, and a pending/confirm record in the concern.
- **Round 5, one refused:** a same-day receipt for another session throttled a notice still pending.
  The throttle now applies only when nothing is pending.
- **Round 6, both ratified.** Two non-blocking notes outside the gated files were taken in the next
  commit: no session id means no notice and no pending record, and an empty receipt confirms nothing;
  the contract says the receipt evidences emission, not reading.

Residual, named by seats and not built: an automated re-probe of the host's `systemMessage` behaviour.
It needs an authenticated live host; D16's revisit condition is the host ceasing to honour the field.
