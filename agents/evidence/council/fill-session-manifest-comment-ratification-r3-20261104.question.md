<!-- evidence-type: analysis -->

# Ratification review, round 3 — the full gated set in one prompt

Rounds 1 and 2 reviewed the YAML and the JSON separately; round 2 asked for both in one place. This prompt carries the complete gated diff against `origin/main`: `src/scripts/hook_manifest.yaml` and its compiled sibling `src/scripts/hook_manifest.json`. Nothing else in the branch is gated.

## `src/scripts/hook_manifest.yaml` — exact diff

```diff

diff --git a/src/scripts/hook_manifest.yaml b/src/scripts/hook_manifest.yaml
index 2a9e3254ae..8657ef32bd 100644
--- a/src/scripts/hook_manifest.yaml
+++ b/src/scripts/hook_manifest.yaml
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

## `src/scripts/hook_manifest.json` — exact diff

One line of 23,039 bytes; shown up to the first field after the fingerprints, everything after it is byte-identical on both sides (verifiable with `git diff origin/main -- src/scripts/hook_manifest.json`).

```diff

-{"fingerprint":"f25998429e53d9b10a81c622adafa289498561d9ec9c0725df919e488d27995d:118400","body_fingerprint":"cfef2f687407e362a1644a5f978772609f4d2574812fbe5ad797854edff9475e:22846","manifest":{...

+{"fingerprint":"a9d25c1e33f432cb934c069bbe13399be764f6ee295531cb49432fd9169e999d:118671","body_fingerprint":"cfef2f687407e362a1644a5f978772609f4d2574812fbe5ad797854edff9475e:22846","manifest":{...

```

`fingerprint` = sha256 and byte length of the YAML source text. `body_fingerprint` = sha256 and byte length of the serialised parsed manifest.

Questions:

1. Does the combined diff change any parsed manifest key (binding, script, args, severity, effect, fail_closed, or other)?

2. Your verdict on the combined gated set, exactly one of `ratified`, `confirmed-non-expanding`, `refused`, with the reason.

