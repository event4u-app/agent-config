<!-- evidence-type: analysis -->

# Ratification review, round 4 — the full gated set after a bundle-budget raise

Round 3 ratified two comment corrections in `src/scripts/hook_manifest.yaml` and the recompiled `src/scripts/hook_manifest.json` (diffs below, unchanged since round 3). The branch then failed `check_hook_bundle_composition`: the dispatch bundle measured 1,584,627 B against a 1,582,000 B ceiling, so `src/config/hook-bundle-budget.json` now carries a raise with a `raise_log` entry. That file is on the ratification gate's watched set, so the gated set is now three files and the reviewed digest changed.

The bundle growth comes from two hook changes in the same branch. They are not gated files, but the raise exists for them, so their diff is included as context (section 4).

## 1. `src/config/hook-bundle-budget.json`

```diff

diff --git a/src/config/hook-bundle-budget.json b/src/config/hook-bundle-budget.json
index de35900651..703436e770 100644
--- a/src/config/hook-bundle-budget.json
+++ b/src/config/hook-bundle-budget.json
@@ -4,7 +4,7 @@
     "registered_at": "2026-10-01",
     "owner": "maintainer",
     "review_by": "2027-10-01",
-    "max_bytes": 1582000,
+    "max_bytes": 1585400,
     "max_bytes_derivation": "Measured 1,514,715 bytes on origin/main at 213d87055 (the gate's own reading, APFS-cloned node_modules so no worktree path artefacts). The ceiling is that reading plus ~2.3 % of headroom, rounded to 1,550,000, on the same doctrine as the 2026-10-01 registration: a bundle is rebuilt from source on every run, so an esbuild minor that renames symbols moves the figure by hundreds of bytes with no change to this tree, and a ceiling one byte above the reading would red on that. Composition is healthy at this reading and was checked rather than assumed: one YAML package (258,833 bytes) and 1,238,525 bytes of own source, so the growth is own code, not a re-entered dependency. The 1,564,211-byte pre-swap regression this roadmap closed still cannot reappear under it. RAISED to 1,550,500 on 2026-10-23 for the InstructionsLoaded binding (237 bytes against 51 of headroom); the reasoning and the measured alternative are the `raise_log` entry whose `to` is 1,550,500, so this paragraph describes the 1,550,000 registration and the raise is recorded there rather than restated.",
     "shrink_only": true,
     "shrink_only_note": "A RAISE needs a recorded reason in `raise_log` below naming what was added and why it could not be avoided. Enforced since road-to-a-ratification-fence-that-follows-its-imports 3.2: the gate reads `max_bytes` at the base revision, and a working value above it fails unless `raise_log` gained an entry whose `to` equals the new value. A lowering needs no entry. This file is also on the ratification gate's watched set, so a raise carries a record as well as a log entry.",
@@ -181,6 +181,15 @@
             "what_was_added": "PR #2816 (web-launch write-time rows) merged after the 1,581,000 raise and added +885 B to the dispatch bundle, measured per module with the esbuild metafile against e4dc5cfa2a: hooks/design_pass_hook.ts 456 B (routing .html/.css writes to the web-launch rows, the shared withDegradation helper, the degraded-pass reason when the chunk is missing) and hooks/web_launch_rows_loader.ts 423 B (the conditional-chunk loader; the rows, the origin register and the supersession table live in web_launch_rows.chunk.cjs and cost the bundle nothing), 6 B elsewhere. origin/main at 1ac7eebe04 builds to 1,581,318 B, 318 B over.",
             "why_it_could_not_be_avoided": "The rows are already moved into a conditional chunk; what remains in the bundle is the routing and the loader, and the loader reuses the shared loadChunkExport. Main is red on this gate since #2816, so a branch that does not touch hooks cannot push either.",
             "what_would_have_caught_it": "#2816's own CI ran against a main that still carried the 1,578,600 ceiling-era headroom; two PRs that each fit merged within the same hour. Sized to the measurement plus about 700 bytes of rebuild jitter."
+        },
+        {
+            "date": "2026-11-04",
+            "from": 1582000,
+            "to": 1585400,
+            "by": "agent, feat/road-to-a-fill-the-session-sees-coming",
+            "what_was_added": "road-to-a-fill-the-session-sees-coming 2.1 and 2.2, measured per module with the esbuild metafile against origin/main: _lib/quota_ledger.ts 1,153 B and _lib/pressure.ts 397 B (the session-eol hook reads the fill the status-line tap recorded for this session, against the shared CONTEXT_NOTICE_PCT band, so the continuity record is written at the 80 % band and not only past the 800k threshold a 200k window never reaches), handoff_context_hook.ts +799 B (the pointer-and-digest delivery of the record after /clear), hooks/session_eol_hook.ts +222 B, about 700 B of import glue. The gate measures 1,584,627 B with APFS-cloned node_modules; origin/main builds to about 1,581,350 B, 650 B under the old ceiling.",
+            "why_it_could_not_be_avoided": "The band check needs the quota ledger, and quota_ledger.ts is its one reader; a second hand-written parser of the same JSONL inside the hook would save about 1.2 KB and give the ledger format two readers that can drift. pressure.ts is tree-shaken to the band constant and sessionContextFill.",
+            "what_would_have_caught_it": "Nothing missed it: preflight caught it before the push. Sized to the measurement plus about 770 bytes of rebuild jitter, on the doctrine of the previous entries."
         }
     ],
     "chunks": [
```

## 2. `src/scripts/hook_manifest.yaml`

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

## 3. `src/scripts/hook_manifest.json`

One line of 23,039 bytes; everything after the two fingerprint fields is byte-identical.

```diff

-{"fingerprint":"f25998429e53d9b10a81c622adafa289498561d9ec9c0725df919e488d27995d:118400","body_fingerprint":"cfef2f687407e362a1644a5f978772609f4d2574812fbe5ad797854edff9475e:22846","manifest":{...

+{"fingerprint":"a9d25c1e33f432cb934c069bbe13399be764f6ee295531cb49432fd9169e999d:118671","body_fingerprint":"cfef2f687407e362a1644a5f978772609f4d2574812fbe5ad797854edff9475e:22846","manifest":{...

```

## 4. Context — the hook code the raise pays for

```diff

diff --git a/src/scripts/handoff_context_hook.ts b/src/scripts/handoff_context_hook.ts
index 452eecf781..50c05517b4 100644
--- a/src/scripts/handoff_context_hook.ts
+++ b/src/scripts/handoff_context_hook.ts
@@ -34,6 +34,7 @@
  * (`{platform, event, payload, workspace_root, …}`).
  */
 
+import { createHash } from 'node:crypto';
 import * as fs from 'node:fs';
 import * as path from 'node:path';
 import process from 'node:process';
@@ -153,6 +154,19 @@ export function consume_handoff_context(root: string, now: Date = new Date()): C
     return guardedInjection(block, `handoff consumed (session=${sourceSession})`);
 }
 
+/**
+ * How the continuity record reaches the successor: the whole body, or a pointer
+ * to the consumed file plus a digest (road-to-a-fill-the-session-sees-coming
+ * 2.2). `/clear` gets the pointer — the user cleared to get a small context
+ * back, and the body re-injected would undo part of that; the consumed file
+ * stays on disk at the pointer. Every other injecting source keeps the body.
+ */
+export type RecordDelivery = 'body' | 'pointer';
+
+export function recordDelivery(source: string): RecordDelivery {
+    return source.trim() === 'clear' ? 'pointer' : 'body';
+}
+
 /**
  * Consume the one-shot RECYCLE ENVELOPE (road-to-token-economy-recycling
  * Phase 2.3) — the main-session sibling of the handoff file above, same
@@ -185,6 +199,7 @@ export function consume_recycle_envelope(
     root: string,
     now: Date = new Date(),
     session_id: string | null | undefined = undefined,
+    delivery: RecordDelivery = 'body',
 ): ConsumeDecision {
     // Phase 2.1: which record belongs to THIS session is a resolution, not a
     // path constant. `resolveContinuityRecord` returns `null` with a reason
@@ -215,12 +230,10 @@ export function consume_recycle_envelope(
         return { action: 'absent', reason: 'no recycle envelope' };
     }
 
+    const consumedPath = path.join(path.dirname(target), path.basename(recycle_consumed_rel(sessionId)));
     const consume = (): void => {
         try {
-            fs.renameSync(
-                target,
-                path.join(path.dirname(target), path.basename(recycle_consumed_rel(sessionId))),
-            );
+            fs.renameSync(target, consumedPath);
         } catch {
             try {
                 fs.unlinkSync(target); // fallback — never let it survive
@@ -320,8 +333,21 @@ export function consume_recycle_envelope(
     // notice — surfaced, never executed, never silently stripped.
     const warnings = scanEnvelopeDirectives(envelope);
     const focus = (process.env.AGENT_RESUME_FOCUS ?? '').trim();
-    const block = wrapAsPriorSessionData(JSON.stringify(envelope, null, 2), {
-        kind: 'recycle-envelope',
+    const remaining = Array.isArray(envelope['remaining']) ? envelope['remaining'] : [];
+    const payload =
+        delivery === 'pointer'
+            ? {
+                  pointer: path.relative(root, consumedPath) || path.basename(consumedPath),
+                  summary: envelope['summary'],
+                  task: envelope['task'],
+                  next: remaining[0] ?? null,
+                  remaining_count: remaining.length,
+                  sha256: createHash('sha256').update(text).digest('hex').slice(0, 12),
+                  read: 'Read the pointer for the full record before acting on anything it would carry.',
+              }
+            : envelope;
+    const block = wrapAsPriorSessionData(JSON.stringify(payload, null, 2), {
+        kind: delivery === 'pointer' ? 'recycle-envelope-pointer' : 'recycle-envelope',
         source: path.relative(root, target) || path.basename(target),
         warnings: [
             ...drift,
@@ -355,7 +381,8 @@ export function consume_recycle_envelope(
  *
  *   - `startup` (and an ABSENT source) — a fresh session. Both gates inject:
  *     this is the ordinary case and the one every existing fixture exercises.
- *   - `clear` — the operator wrote the record and cleared. Both gates inject.
+ *   - `clear` — the operator wrote the record and cleared. Both gates inject,
+ *     the record as a pointer and digest ({@link recordDelivery}), not its body.
  *     This is the recycle path the record was built for, and suppressing it
  *     would defeat the mechanism. Note that hot-context DISCARDS on the same
  *     source, and the two are right for opposite reasons: hot-context is a
@@ -521,6 +548,7 @@ export function main(): number {
                       root,
                       new Date(),
                       String(envelope['session_id'] ?? '').trim() || env_session_id(),
+                      recordDelivery(source),
                   )
                 : { action: 'absent', reason: recycleGate.reason };
             const blocks: string[] = [];
diff --git a/src/scripts/hooks/session_eol_hook.ts b/src/scripts/hooks/session_eol_hook.ts
index 777447b287..66bd4e02ca 100644
--- a/src/scripts/hooks/session_eol_hook.ts
+++ b/src/scripts/hooks/session_eol_hook.ts
@@ -76,6 +76,8 @@ import {
     run_checkpoints_enabled,
 } from '../_lib/continuity_writer.js';
 import { publishContinuityRecord } from '../_lib/continuity_slot.js';
+import { CONTEXT_NOTICE_PCT, sessionContextFill } from '../_lib/pressure.js';
+import { hashSessionId, readQuotaLedger } from '../_lib/quota_ledger.js';
 import { current_branch } from '../_lib/git_common_dir.js';
 import { derive_session_tag } from '../_lib/session_tag.js';
 import { localDay, pruneStaleMarkers, pruneStalePointers, writeSessionPointer } from '../retro_queue.js';
@@ -463,6 +465,20 @@ export function writeRetroPointer(
 /** The `probe_throttle` stamp for the once-a-day retro store prune. */
 const RETRO_PRUNE_STAMP = 'retro-prune';
 
+/**
+ * Is this session at or above the context band the per-prompt notice warns at?
+ *
+ * road-to-a-fill-the-session-sees-coming 2.1. The 800k recycle threshold is an
+ * absolute count that a 200k window never reaches, so a session the user clears
+ * at the warning left no record. The fill the status-line tap reported for this
+ * session is the only measured percentage there is; without the tap there is no
+ * reading and the threshold lane alone decides, as before.
+ */
+export function atContextBand(rawSessionId: string): boolean {
+    const fill = sessionContextFill(readQuotaLedger(), hashSessionId(rawSessionId));
+    return fill !== null && fill >= CONTEXT_NOTICE_PCT;
+}
+
 /**
  * The continuity-record handler — one of the three lifecycle handlers this
  * concern carries, and independently switchable from the other two.
@@ -484,6 +500,10 @@ const RETRO_PRUNE_STAMP = 'retro-prune';
  * successor reads is always the newest state, and the write rate is still
  * bounded to the end phase of a session rather than every turn of it.
  *
+ * The end phase now also starts at the context band ({@link atContextBand}),
+ * because on a 200k window the threshold is never reached and the user clears
+ * at the warning instead; the same supersede-per-Stop policy applies there.
+ *
  * Best-effort throughout, like the checkpoint above it: a continuity record is
  * a recovery aid, and a recovery aid that can fail a Stop is a liability.
  */
@@ -494,10 +514,12 @@ function writeContinuityRecord(
     threshold: number | null,
     tokens: number | null,
 ): void {
-    if (threshold === null || tokens === null || tokens < threshold) return;
+    // `threshold === null` is the emergency off switch and stays one for both lanes.
+    if (threshold === null || tokens === null) return;
     const sessionId = String(rawSessionId ?? '').trim();
     if (sessionId === '') return;
     try {
+        if (tokens < threshold && !atContextBand(sessionId)) return;
         if (!auto_record_enabled(workspaceRoot)) return;
         const slug = read_claimed_slug(workspaceRoot, sessionId);
         const decision = buildContinuityRecord({
```

Questions:

1. Does the combined gated diff change any parsed manifest key?

2. Is the raise_log entry an accurate account of the growth, given the code in section 4, and is the raise size proportionate?

3. Does the code in section 4 widen what any hook is permitted to do (write, deny, emit to the model or the user), beyond when the existing continuity-record write fires and what shape the existing injection takes?

4. Your verdict on the combined gated set, exactly one of `ratified`, `confirmed-non-expanding`, `refused`, with the reason.

