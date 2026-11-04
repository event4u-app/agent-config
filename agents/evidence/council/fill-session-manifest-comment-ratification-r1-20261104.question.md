# Ratification review — two comment corrections in `src/scripts/hook_manifest.yaml`

`check_kernel_edit_ratified` gates `src/scripts/hook_manifest.yaml` as hook plumbing, so
every diff to it needs a ratification record (ADR-268 § 4). This diff is from step 1.4 of
`road-to-a-fill-the-session-sees-coming`.

Gated file: `src/scripts/hook_manifest.yaml` only. The full gated diff against `origin/main`:

```diff
@@ -667,8 +667,10 @@ concerns:
   # 2026-10-22, road-to-a-quota-the-user-sees-coming Phase 3-4). Reads the
   # machine-wide quota ledger the status-line tap writes and emits through the
   # user channel: one notice per (window, state, reset) on the machine at warm /
-  # hot / exhausted, one per session at 80 % context fill, one per session that
-  # may bill per token. Bound on `claude` alone for the reason `update-notice`
+  # hot / exhausted, a context line on every prompt while the session sits at or
+  # above 80 % context fill (since road-to-a-memory-that-arrives 2.1; the band is
+  # `CONTEXT_NOTICE_PCT` in `_lib/pressure.ts`, shared with the status-line
+  # segment), one per session that may bill per token. Bound on `claude` alone for the reason `update-notice`
   # gives. Claim files dedup across sessions. Never blocks.
   # Kill switch: `AGENT_CONFIG_NO_QUOTA_NOTICE=1`.
   quota-notice:
@@ -1210,9 +1212,10 @@ concerns:
-  # FIVE detectors on one guard — promissory closing, language mismatch,
-  # unverified edit, unsettled completion claim, and a decision the turn asked
-  # and then dropped. This said "Two" and named the first pair, which was true
+  # SIX detectors on one guard — promissory closing, language mismatch,
+  # unverified edit, unsettled completion claim, a decision the turn asked
+  # and then dropped, and a behaviour change shipped untested. This said "Two"
+  # and later "FIVE" after `untested` joined; it named the first pair, which was true
   # of the concern on the day it was registered and of nothing since; the
```

Facts for checking the claims in the new text:

- `src/scripts/quota_notice_hook.ts` `noticeLines`: the context line is pushed whenever the
  session's fill is `>= CONTEXT_NOTICE_PCT`, deduplicated per prompt key (prompt id or prompt
  hash plus snapshot ts), not per session.
- `CONTEXT_NOTICE_PCT = 80` is exported from `src/scripts/_lib/pressure.ts` in the same branch
  and re-exported by `quota_notice_hook.ts`; the status-line tap's `contextSegment` reads it.
- `src/scripts/hooks/turn_end_gate_hook.ts:262`: `DetectorId = 'promissory' | 'language' |
  'verification' | 'completion' | 'pending-decision' | 'untested'`.

Questions:

1. Does this diff change any concern's binding, script, args, severity, effect, fail_closed
   value or any other parsed key — i.e. anything beyond YAML comments?
2. Are the corrected comments accurate against the facts above?
3. Your verdict, one of: `ratified`, `confirmed-non-expanding`, `refused`, with the reason.
