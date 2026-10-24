---
proposed_by: road-to-an-update-that-installs-itself-only-when-it-is-safe step 3.1 (reopened 2026-10-21 for want of a delivery path)
implemented_by: claude-opus-5.5 session on drain/update-installs-itself-20261024
reviewed_by: AI council, 2 seats, provider-diverse (anthropic + openai), round 10 of 2026-10-24
providers: [anthropic, openai]
verdict: ratified
seats:
  anthropic: confirmed-non-expanding
  openai: ratified
effective_after: merge
subject: c839365d473cc162913672f748b4c2558f40f37e613f8ffab623b8c9b0595e5b
---

<!-- evidence-type: ratification -->

# Ratification — a user channel in the dispatcher, and `update-notice` registered on it

`check_kernel_edit_ratified` gates six hook-plumbing files on this branch:
`src/config/hook-bundle-budget.json`, `src/scripts/hook_manifest.yaml`, its compiled projection
`src/scripts/hook_manifest.json`, `src/scripts/hooks/dispatch_hook.ts`,
`src/scripts/hooks/host_semantics.ts` and the new `src/scripts/hooks/user_notice.ts`. The `subject:`
digest covers all six, computed with
`./scripts-run src/scripts/ratification_subject --files $(git diff --name-only origin/main...HEAD) --base-ref origin/main`
at revision `c1363dd22f`. The gated files are byte-identical to the ones round 10 reviewed (commit
`04cd50a64c`); the commit after it touched only the contract prose. The header is the output of
`ratification_header --seat anthropic=confirmed-non-expanding --seat openai=ratified`.

## What was ratified

- **A user-addressed reply field.** A concern may reply `user_notice` (and a `notice_id`, never
  shown). The dispatcher accepts it only from `effect: notification` concerns, cleans it, caps it at
  1,000 Unicode code points, keeps it only if something is left, and records each kept notice as one
  `{concern, text, id}` entry (`collectUserNotice`). On exit 0 and only on `claude` it emits the texts
  as `systemMessage`. That this field stays out of model context was reproduced on Claude Code
  2.1.310 with a positive control (`agents/evidence/analysis/system-message-probe-2026-10-24.md`).
- **Structural composition.** Context, the native emission and the notice are merged as JSON
  structures (`withUserNotice`); without a notice the output is byte-identical to before, and any
  shape the merge cannot extend safely keeps the old output and drops the notice.
- **A receipt bound to one notice.** `writeStdout` writes the output first and only then, for each
  entry actually in it, `user-notice-<concern>.delivered` = `{session_id, notice_id, at}` under the
  user-global root; a throwing write leaves none. It evidences the hand-over to the stdout stream, not
  completed transmission or that the user read it — the contract says so.
- **`update-notice` registered** on `claude` `session_start` only, from its own chunk. Through the host
  it generates a `notice_id` per notice, keeps the report pending, and promotes it only when a receipt
  names that session and that id, so a dropped notice is said again. It installs nothing and starts
  nothing.
- **`max_bytes` 1,551,000 → 1,554,000** with a `raise_log` entry: +2,945 B of own source measured
  against origin/main, 292 B of headroom; both seats accepted the raise. `dispatch_hook.ts` stays under
  its 1,500-line cap because the plumbing lives in the two helper modules.

**Classification.** The seats did not use the same label: one ratified, the other recorded
`confirmed-non-expanding` while describing the change as an authority expansion that is real, bounded
and gated. Across all ten rounds the seats' substantive description is the same: a lifecycle hook can
now put text in front of the user; it cannot install, start a process, or reach the model through this
field. Both asked that any host added to `USER_NOTICE_HOSTS`, and any new `effect: notification`
concern, be reviewed as authority-sensitive.

## How it got here

Ten rounds over the same change, CLI subscription transport, USD 0.00. Prompts committed verbatim:
`agents/evidence/council/update-notice-user-channel-ratification-r1-20261024.question.md` through
`…-r10-20261024.question.md`. Every check below has a test that went red with it removed.

- **Round 1, refused 2/2:** context and emission were concatenated as text. Rewritten as a structural
  merge; the host behaviour was probed rather than read off the binary.
- **Round 2, ratified 2/2,** naming a hardening (wrong-typed fields were replaced), done rather than
  deferred.
- **Round 3, one refused:** the concern counted a notice as reported before the dispatcher could drop
  it. Answered by pinning the slot — which round 4 showed was not enough.
- **Round 4, refused 2/2:** an exit-0 structural fallback also drops a notice. Strategy changed: a
  dispatcher receipt and a pending/confirm record.
- **Round 5, one refused:** another session's same-day receipt throttled a pending notice. Fixed.
- **Round 6, ratified 2/2;** then CI found the dispatcher over its source cap and a missing loss-class
  declaration, so the plumbing moved into helpers and the gated files changed again.
- **Round 7, refused 2/2:** a concern whose text the cleaning erased could still be receipted, and the
  cap could split a surrogate pair. Fixed with coupled entries and a code-point cap.
- **Round 8, refused:** a receipt named only a session, so an older same-session receipt could confirm
  a newer, dropped notice. Fixed with a per-notice id.
- **Round 9, one refused:** the receipt was written before stdout. Reordered; a throwing write leaves
  none.
- **Round 10, both passing.** One seat asked that the asynchronous write be acknowledged; the contract
  now states that a receipt evidences the hand-over to the stream, and that a host dying in that window
  can leave a notice confirmed that it never displayed.

Residuals, named by seats and not built: an automated re-probe of the host's `systemMessage`
behaviour (it needs an authenticated live host; D16's revisit condition is the host ceasing to honour
the field), and confirmation of completed transmission, which the dispatcher cannot observe.
