<!-- evidence-type: analysis -->

# Ratification review, round 5 — the gated set after rebasing onto origin/main

`check_kernel_edit_ratified` gates hook plumbing (ADR-268 § 4). Earlier rounds on this branch
reviewed three gated files: `src/scripts/hook_manifest.yaml`, `src/scripts/hook_manifest.json`
and `src/config/hook-bundle-budget.json`. After merging origin/main at 504868fe4d, the budget
file is no longer in the diff: origin/main moved the self-repair concern out of the dispatch
bundle, and the gate `check_hook_bundle_composition` now measures this branch's dispatch bundle
at 1,562,807 B against origin/main's unchanged 1,585,000 B ceiling. The budget file is restored
byte-identical to origin/main, so no raise is proposed.

Gated files now: `src/scripts/hook_manifest.yaml` and `src/scripts/hook_manifest.json`. The full
gated diff against origin/main follows.

YAML diff:

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
   # survived a pin that had fired 26-35 seconds earlier. Refusal-capable
   # intercepts enforce; context injection requests.
   #
-  # FIVE detectors on one guard — promissory closing, language mismatch,
-  # unverified edit, unsettled completion claim, and a decision the turn asked
-  # and then dropped. This said "Two" and named the first pair, which was true
+  # SIX detectors on one guard — promissory closing, language mismatch,
+  # unverified edit, unsettled completion claim, a decision the turn asked
+  # and then dropped, and a behaviour change shipped untested. This said "Two"
+  # and later "FIVE" after `untested` joined; it named the first pair, which was true
   # of the concern on the day it was registered and of nothing since; the
   # authority is `DetectorId` in the hook, and the demotion contract carries the
   # per-detector bars. Original note, kept because its reason still holds:
```

JSON diff — one line, everything after the two fingerprint fields byte-identical (23,039 bytes):

```diff
-{"fingerprint":"f25998429e53d9b10a81c622adafa289498561d9ec9c0725df919e488d27995d:118400","body_fingerprint":"cfef2f687407e362a1644a5f978772609f4d2574812fbe5ad797854edff9475e:22846","manifest":{...
+{"fingerprint":"a9d25c1e33f432cb934c069bbe13399be764f6ee295531cb49432fd9169e999d:118671","body_fingerprint":"cfef2f687407e362a1644a5f978772609f4d2574812fbe5ad797854edff9475e:22846","manifest":{...
```

`fingerprint` = sha256 and byte length of the YAML source text. `body_fingerprint` = sha256 and
length of the serialised parsed manifest.

Facts for checking the claims in the new comment text:

- `src/scripts/quota_notice_hook.ts` `noticeLines`: the context line is pushed whenever the
  session's fill is `>= CONTEXT_NOTICE_PCT`, deduplicated per prompt key (prompt id or prompt
  hash plus snapshot ts), not per session.
- `CONTEXT_NOTICE_PCT = 80` is exported from `src/scripts/_lib/pressure.ts` on this branch and
  re-exported by `quota_notice_hook.ts`; the status-line tap's `contextSegment` reads it.
- `src/scripts/hooks/turn_end_gate_hook.ts`: `DetectorId = 'promissory' | 'language' |
  'verification' | 'completion' | 'pending-decision' | 'untested'`.

Questions:

1. Does this diff change any concern's binding, script, args, severity, effect, fail_closed
   value or any other parsed key — anything the dispatcher acts on?
2. Are the corrected comments accurate against the facts above?
3. Your verdict on the gated set, one of: `ratified`, `confirmed-non-expanding`, `refused`,
   with the reason.
