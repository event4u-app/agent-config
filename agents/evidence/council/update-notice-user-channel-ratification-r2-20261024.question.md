<!-- evidence-type: analysis -->

# Ratification review — a user channel in the dispatcher, and `update-notice` registered on it (road-to-an-update-that-installs-itself-only-when-it-is-safe step 3.1) — round 2

You are an independent reviewer for a change in the `event4u/agent-config` repository. The change edits files on the ratification gate's hook-plumbing list (`src/scripts/hook_manifest.yaml`, its compiled `hook_manifest.json`, `src/scripts/hooks/dispatch_hook.ts`, `src/scripts/hooks/host_semantics.ts`, the new `src/scripts/hooks/user_notice.ts`, `src/config/hook-bundle-budget.json`), so it needs a two-provider verdict under ADR-268 § 4: an agent may change the hook plumbing but may not ratify its own change.

## Background

`update-notice` is a `session_start` concern that tells a user their global install of this package is behind, or has just moved. It was registered on 2026-10-20, then taken out of the manifest after council rounds on 2026-10-21. The reasons recorded then: it could spawn `upgrade --unattended` (an authority expansion; that capability was removed — `activate` is `null` on every path); it reported on stderr, and every host runs the dispatcher on pipes and shows no stderr, so registered it "would say nothing anywhere"; and unbound definitions were refused as dead surface.

## What the change does

1. **A user-addressed reply field.** A concern may reply `{"user_notice": "<text>"}`. The dispatcher collects it only from concerns whose manifest `effect` is `notification`, caps each at 1,000 characters, passes it through the same egress placeholder engine as other injected text, and joins them with `\n`. On a host listed in `USER_NOTICE_HOSTS` (today only `claude`) whose native emission is verified, it emits the joined text as Claude Code's top-level `systemMessage` field. The Claude Code 2.1.310 binary documents that field as "`systemMessage` - Display a message to the user (all hooks)" and "Warning shown to user in UI". On any other host the notice is dropped, never rerouted. It is emitted only when the dispatcher's exit code is 0, because the host parses stdout only then.
2. **One stdout object, merged as structures.** `withUserNotice(platform, event, context, emission, notice)` composes the three parts. Without a notice, or on a host without the field, the output is byte-identical to before (context then emission). With one: the native emission is parsed as one JSON object and kept; `session_start` plain context joins its `hookSpecificOutput.additionalContext` (`\n\n`); the notice is appended to any existing `systemMessage` (`\n`). Plain context on any other event, or an emission that is not one JSON object, is never reinterpreted — the notice is dropped and the old output stands.
3. **`update-notice` registered.** `effect: notification`, `severity: advisory`, `fail_closed: false`, bound on `claude` `session_start` only, loaded from its own chunk (30,571 B, ceiling 33,600) through `LAZY_CONCERNS`. Under an envelope whose `platform` has a user channel it treats the session as interactive and writes its lines as one `user_notice` reply instead of stderr. It still writes only its own user-global day stamp and its last-reported version (a CI assertion holds that no other module reads them), installs nothing, and is silenced by `AGENT_CONFIG_NO_UPDATE_CHECK=1`, `update.mode: off`, CI, a source checkout and an ephemeral run. Every other host keeps the CLI banner. `update-auto-invite` (the stop-slot invitation) is NOT registered.
4. **Bundle ceiling.** `max_bytes` 1,551,000 → 1,553,000 with a `raise_log` entry: +1,813 B measured with the same esbuild invocation on base and branch (host_semantics +973, dispatch_hook +403, user_notice +248, lazy_concern +152), against a base 249 B under the ceiling. Room was not re-tried; the two previous entries measured the narrow-event chunk candidates as a quarter-megabyte require per event to buy a few hundred bytes.
5. **Records.** The concern-admission row for `update-notice` is rewritten to the new binding; `docs/contracts/hook-architecture-v1.md` documents the field.
6. **Tests.** A new file drives the real dispatcher with fixture manifests: a notification concern's notice reaches claude as `systemMessage` and appears nowhere in `hookSpecificOutput`; a concern with another effect cannot use the field; copilot receives nothing; context and notice combine into one object. The concern's tests assert its registration and binding, and an end-to-end run where a claude envelope yields a `user_notice` reply while a copilot envelope says and writes nothing. The effect gate and the platform check were each removed once and the corresponding test went red.

Omitted from the diff below as generated or bookkeeping: `src/scripts/hook_manifest.json` (compiled from the YAML), the roadmap file, and two council records about an unrelated blocker. `git diff origin/main...drain/update-installs-itself-20261024` shows the full change.


## Round 1 and what changed

Round 1 (prompt committed as `agents/evidence/council/update-notice-user-channel-ratification-r1-20261024.question.md`) refused 2/2 on one defect: plain `session_start` context was concatenated with the native emission before the notice was merged, so a JSON emission could have been wrapped whole into model-facing `additionalContext`. Changes since, each in commit `2b41cd60f3`:

- Structural composition as described in point 2. Tests: context + an existing JSON emission + a notice merge into one object with both `additionalContext` parts and the `systemMessage`; an existing `systemMessage` is appended to, not replaced; a non-object emission (`not json`, `[1]`) is returned untouched; plain context on `stop` is returned untouched. The append and the `session_start`-only guard were each removed once and their tests went red.
- A real-dispatcher test proves the concern reads the platform the dispatcher was invoked with (`--platform claude`), from the envelope the dispatcher builds, not from a field the test injects. The real `update-notice` cannot show a notice under a dispatcher run from a source checkout — it suppresses itself there by design (`origin === 'source-checkout'`) — so propagation is shown with a fixture concern that echoes the envelope's `platform`.
- That `systemMessage` stays out of model context is now reproduced, not only read off the binary: a real Claude Code 2.1.310 session with a `SessionStart` hook carrying `MARKER-SYS-7Q2` in `systemMessage` and a positive control `MARKER-CTX-4K9` in `additionalContext` named only the control when asked to list every marker in its context; the system marker appeared only in the stream's `hook_response` diagnostic event (`agents/evidence/analysis/system-message-probe-2026-10-24.md`). The probe does not show that the user sees the message; that rests on the host's documentation.
- The bundle was re-measured and the raise entry corrected (point 4).
- On authority, one seat called the change "a bounded hook-authority expansion" because a hook may now cause a visible notification. Stated plainly so this round can rule on it: the new capability is that a `notification` concern's text reaches the user's UI on claude; before, it reached nobody. The concern's writes are unchanged from the version reviewed on 2026-10-21: its own user-global day stamp and last-reported version, read by no other module. It installs nothing and starts no process.

## What to answer

1. Does the diff contain a defect — in the user channel, the stdout merge, the concern's change, the binding, the tests or the budget entry? Name file and line for each.
2. Does the change expand any agent's or hook's authority — what an agent may do or decide, or what a hook may cause? Is `effect: notification` an accurate description of `update-notice` as changed?
3. Is the `max_bytes` raise, as recorded, an acceptable resolution, or should room be made instead (name how)?

End with exactly one verdict line: `VERDICT: ratified`, `VERDICT: confirmed-non-expanding`, or `VERDICT: refused — <reason>`.

## The diff (`git diff origin/main`, generated and bookkeeping files excluded)

```diff
diff --git a/src/config/hook-bundle-budget.json b/src/config/hook-bundle-budget.json
index 790d89d5f9..de1a8882eb 100644
--- a/src/config/hook-bundle-budget.json
+++ b/src/config/hook-bundle-budget.json
@@ -7 +7 @@
-    "max_bytes": 1551000,
+    "max_bytes": 1553000,
@@ -17,2 +17,2 @@
-            "what_was_added": "Nothing in this commit. The 1,500,000 ceiling was red on the very commit that registered it: measured 1,511,489 bytes at 22b19e520, which is the merge of the PR that introduced the budget. Its derivation read 1,469,738 bytes on the PR branch, whose base predated three PRs that had merged meanwhile \u2014 the failure-event binding of #2160 (sixteen concerns on a new slot), the touched-file quality pass of #2152, and the evidence classification of #2153 \u2014 and #2162 landed after it. The gate ran on each PR's pre-merge tree and never on the merge result, so every one of those PRs was green alone and the trunk was red the moment they were together.",
-            "why_it_could_not_be_avoided": "The bytes are deliberately merged capability, not an accident to trim: the composition check above shows one parser and no duplicate dependency, so there is nothing to remove that would not remove a feature. The alternative \u2014 reverting a merged lane to fit a ceiling derived against a base that no longer exists \u2014 would discard working code to satisfy a number that never described this tree.",
+            "what_was_added": "Nothing in this commit. The 1,500,000 ceiling was red on the very commit that registered it: measured 1,511,489 bytes at 22b19e520, which is the merge of the PR that introduced the budget. Its derivation read 1,469,738 bytes on the PR branch, whose base predated three PRs that had merged meanwhile — the failure-event binding of #2160 (sixteen concerns on a new slot), the touched-file quality pass of #2152, and the evidence classification of #2153 — and #2162 landed after it. The gate ran on each PR's pre-merge tree and never on the merge result, so every one of those PRs was green alone and the trunk was red the moment they were together.",
+            "why_it_could_not_be_avoided": "The bytes are deliberately merged capability, not an accident to trim: the composition check above shows one parser and no duplicate dependency, so there is nothing to remove that would not remove a feature. The alternative — reverting a merged lane to fit a ceiling derived against a base that no longer exists — would discard working code to satisfy a number that never described this tree.",
@@ -47,0 +48,9 @@
+        },
+        {
+            "date": "2026-10-24",
+            "from": 1551000,
+            "to": 1553000,
+            "by": "agent, drain/update-installs-itself-20261024 (road-to-an-update-that-installs-itself-only-when-it-is-safe 3.1)",
+            "what_was_added": "A user-addressed channel in the dispatcher: a `notification` concern may reply `user_notice`, and on claude the dispatcher emits it as `systemMessage`, the field the host documents as shown to the user and not added to model context (hooks/user_notice.ts, host_semantics.withUserNotice, which merges context, the native emission and the notice as structures rather than concatenating text). Plus one LAZY_CONCERNS row for `update-notice`, whose 30,571-byte body ships in its own chunk. Measured with the same esbuild invocation on the base and on this branch: +1,813 bytes (host_semantics +973, dispatch_hook +403, user_notice +248, lazy_concern +152), so 1,552,564 B against 1,551,000. The first measurement, +1,391 B, predated the structural merge a council round asked for.",
+            "why_it_could_not_be_avoided": "The channel is what step 3.1 was reopened for: every host runs the dispatcher on pipes, so a notice on stderr reached nobody, and a council round refused the registration for exactly that. The bytes are dispatcher code on the emission path of every event, so a chunk cannot carry them; the concern body is already in one. Room was not re-tried: the 2026-10-23 and 2026-10-24 entries measured the two narrow-event chunk candidates (`session-eol`, `handoff-context`) as buying a few hundred bytes for a quarter-megabyte require on every event, and nothing in this tree has changed that trade. Own code was compacted first (1,545 -> 1,391 B).",
+            "what_would_have_caught_it": "Nothing earlier: the base sat 249 bytes under the ceiling. Sized to this change plus about 430 bytes."
@@ -67 +76 @@
-            "derivation": "Measured 209,890 bytes on 2026-10-20, with `yaml` external (inlined it is 472,201 \u2014 a second copy of the parser the dispatch bundle already carries). The ceiling is that reading plus about 10 %, rounded, because this chunk carries a 2,300-line concern plus the memory lookup and FTS index it reads, all of which still grow.\n\nWHY IT WAS MOVED \u2014 AND THE REASON FIRST GIVEN WAS FALSE, which is recorded here rather than corrected silently. This entry said `chat-history` is bound on `session_start` and on no other event, and called it the largest narrow-event module the metafile ranks. An independent provider review of 2026-10-20 checked the manifest and refused the change on it: `chat-history` is bound on FIVE events \u2014 `session_start`, `session_end`, `stop`, `post_tool_use` and `user_prompt_submit` \u2014 across seven hosts. It is close to the widest-bound concern in the tree, not the narrowest. The claim came from reading the `session_start:` rows of the manifest and never the others.\n\nWHAT SURVIVES THE CORRECTION, stated as narrowly as the evidence allows: the move takes 120,586 bytes out of a bundle every hook event parses (1,549,961 -> 1,429,414 B) and pays for them with one `require` of a 209,890-byte CJS file on the events that actually need the concern. Whether that is a latency WIN is UNMEASURED, and the 2026-10-18 council that chose this mechanism asked for exactly that proof inside `src/config/hook-latency-budget.json`. Until it exists this chunk is a byte-budget move with an unproven wall-clock effect, and the honest narrow-event candidates the same metafile ranks are recorded for whoever re-does it: `turn-end-gate` 71,928 B on `stop` alone, `injection-scan` 46,660 B on `post_tool_use` alone, `skill-route` 31,183 B and `git-authorization` 30,761 B on `user_prompt_submit` alone, `session-eol` 27,708 B on `stop` alone, `handoff-context` 25,220 B on `session_start` alone.\n\nUNLIKE THE OTHER TWO CHUNKS this one carries a CONCERN, so there is a correct path behind the fast one: `_run_concern` tries the static registry, then `loadLazyConcern`, then the historical spawn-per-concern path. A missing or mis-digested chunk costs latency, never the concern's effect \u2014 which the same review confirmed, noting it holds because `src/scripts/` ships in the package."
+            "derivation": "Measured 209,890 bytes on 2026-10-20, with `yaml` external (inlined it is 472,201 — a second copy of the parser the dispatch bundle already carries). The ceiling is that reading plus about 10 %, rounded, because this chunk carries a 2,300-line concern plus the memory lookup and FTS index it reads, all of which still grow.\n\nWHY IT WAS MOVED — AND THE REASON FIRST GIVEN WAS FALSE, which is recorded here rather than corrected silently. This entry said `chat-history` is bound on `session_start` and on no other event, and called it the largest narrow-event module the metafile ranks. An independent provider review of 2026-10-20 checked the manifest and refused the change on it: `chat-history` is bound on FIVE events — `session_start`, `session_end`, `stop`, `post_tool_use` and `user_prompt_submit` — across seven hosts. It is close to the widest-bound concern in the tree, not the narrowest. The claim came from reading the `session_start:` rows of the manifest and never the others.\n\nWHAT SURVIVES THE CORRECTION, stated as narrowly as the evidence allows: the move takes 120,586 bytes out of a bundle every hook event parses (1,549,961 -> 1,429,414 B) and pays for them with one `require` of a 209,890-byte CJS file on the events that actually need the concern. Whether that is a latency WIN is UNMEASURED, and the 2026-10-18 council that chose this mechanism asked for exactly that proof inside `src/config/hook-latency-budget.json`. Until it exists this chunk is a byte-budget move with an unproven wall-clock effect, and the honest narrow-event candidates the same metafile ranks are recorded for whoever re-does it: `turn-end-gate` 71,928 B on `stop` alone, `injection-scan` 46,660 B on `post_tool_use` alone, `skill-route` 31,183 B and `git-authorization` 30,761 B on `user_prompt_submit` alone, `session-eol` 27,708 B on `stop` alone, `handoff-context` 25,220 B on `session_start` alone.\n\nUNLIKE THE OTHER TWO CHUNKS this one carries a CONCERN, so there is a correct path behind the fast one: `_run_concern` tries the static registry, then `loadLazyConcern`, then the historical spawn-per-concern path. A missing or mis-digested chunk costs latency, never the concern's effect — which the same review confirmed, noting it holds because `src/scripts/` ships in the package."
@@ -79,0 +89,6 @@
+        },
+        {
+            "entry": "src/scripts/update_notice_hook.ts",
+            "max_bytes": 33600,
+            "registered_at": "2026-10-24",
+            "derivation": "Measured 30,571 bytes on 2026-10-24 with `yaml` external (the concern reads one user-global settings file with it; inlined it would be a second copy of the parser the dispatch bundle already carries). The ceiling is that reading plus about 10 %, rounded, with no growth queued. Bound on claude `session_start` alone, so a chunk keeps its body off every other dispatch parse; the bundle carries only its LAZY_CONCERNS row. Like `chat_history` it carries a concern, so a missing chunk falls back to the spawn path and costs latency, never the notice."
@@ -84 +99 @@
-    "max_yaml_packages_note": "The dispatch path reads YAML for the hook manifest, the host-lowering table and the settings contract. One reader covers all three. Two cost 95,846 bytes for a single call site and were invisible until an external rescore counted them \u2014 which is why this is a cap rather than prose. The package set the cap counts over is YAML_PACKAGES in the gate.",
+    "max_yaml_packages_note": "The dispatch path reads YAML for the hook manifest, the host-lowering table and the settings contract. One reader covers all three. Two cost 95,846 bytes for a single call site and were invisible until an external rescore counted them — which is why this is a cap rather than prose. The package set the cap counts over is YAML_PACKAGES in the gate.",
diff --git a/docs/contracts/hook-architecture-v1.md b/docs/contracts/hook-architecture-v1.md
index 84ee0711fb..319ff6866c 100644
--- a/docs/contracts/hook-architecture-v1.md
+++ b/docs/contracts/hook-architecture-v1.md
@@ -110,2 +110,3 @@ inferred from exit code only).
   "additional_context": "optional — surfaces back to the model on platforms that support it",
+  "user_notice": "optional — shown to the user, never to the model; `effect: notification` concerns only",
   "state_writes": ["agents/runtime/state/chat-history.json", "…"]
@@ -117,2 +118,18 @@ under the concurrency rules below.
 
+`user_notice` is the one user-addressed field (`hooks/user_notice.ts`). The
+dispatcher forwards it only from a concern whose manifest `effect` is
+`notification`, capped at 1,000 characters, joined with `\n` in manifest order,
+and only on a host with a verified field that shows text to the user and adds
+nothing to model context — today `claude`, as `systemMessage`. On any other host
+it is dropped, never rerouted to a model-facing channel; that `systemMessage`
+does not reach the model was reproduced on Claude Code 2.1.310
+(`agents/evidence/analysis/system-message-probe-2026-10-24.md`). The host parses
+stdout as JSON only when the whole of it is one object, so with a notice present
+the dispatcher merges structures, never text: the native emission's object is
+kept, `session_start` plain `context` joins
+`hookSpecificOutput.additionalContext` (`\n\n`), and the notice is appended to
+any `systemMessage` already there (`\n`). Plain context on any other event, or
+an emission that is not one JSON object, is never reinterpreted — the notice is
+dropped and the output is what it would have been without it.
+
 ## Exit-code semantics
diff --git a/src/scripts/hook_chunks.mjs b/src/scripts/hook_chunks.mjs
index 6edf615e7f..424d6460eb 100644
--- a/src/scripts/hook_chunks.mjs
+++ b/src/scripts/hook_chunks.mjs
@@ -51,2 +51,9 @@ export const HOOK_CHUNKS = Object.freeze([
     }),
+    // `yaml` external for the reason given at `chat_history`: the concern
+    // reads one user-global settings file with it.
+    Object.freeze({
+        entry: 'src/scripts/update_notice_hook.ts',
+        outfile: 'dist/hooks/update_notice.chunk.cjs',
+        external: Object.freeze(['yaml']),
+    }),
 ]);
diff --git a/src/scripts/hook_manifest.yaml b/src/scripts/hook_manifest.yaml
index f9e5c811ed..e6bf8063f0 100644
--- a/src/scripts/hook_manifest.yaml
+++ b/src/scripts/hook_manifest.yaml
@@ -632,18 +632,21 @@ concerns:
     effect: notification
-  # `update-notice` and `update-auto-invite` were registered here on
-  # 2026-10-20 and REMOVED the same day on a council verdict: both seats
-  # refused the change 2/2, convergent, no split
-  # (agents/evidence/council/lazy-concern-authority-expansion-20261020.md).
-  # The finding is not about the concerns' quality. `fail_closed: false` and
-  # `severity: advisory` describe failure and classification, not side
-  # effects, and `effect: notification` means the concern tells a human
-  # something and changes nothing else — so a session_start concern that may
-  # initiate `upgrade --unattended`, and a stop concern that may open a
-  # question with the user, are each an expansion of what lifecycle hooks are
-  # permitted to DECIDE. That the invoked command keeps all its own gates is
-  # true and beside the point: the gates constrain HOW an install happens,
-  # never WHO may start one. The ring-0 record is a rollout switch, not
-  # consent, so it postpones the expansion rather than bounding it.
-  # They return in their own change, declared as authority expansions and
-  # ratified on their own merits.
+  # Tells the user, at session start, that their global install is behind or
+  # has just moved. It installs nothing and starts nothing: a 2026-10-20
+  # council refused it 2/2 while it could spawn `upgrade --unattended`
+  # (agents/evidence/council/lazy-concern-authority-expansion-20261020.md),
+  # and that capability was removed rather than the effect widened (D13).
+  # Its writes are its own bookkeeping — a day stamp and the last version it
+  # reported, user-global, read by no other module (a CI assertion).
+  # Bound on `claude` alone: its text goes out through the user channel
+  # (`hooks/user_notice.ts`, `systemMessage`), which is UI-only, and claude is
+  # the one host with a verified field of that kind. Every other host keeps
+  # the CLI banner. Day-throttled, file reads only, loaded from its own chunk.
+  # Kill switches: `AGENT_CONFIG_NO_UPDATE_CHECK=1`, `update.mode: off`.
+  # `update-auto-invite` (step 4.3) is not registered.
+  update-notice:
+    script: src/scripts/update_notice_hook.ts
+    args: []
+    fail_closed: false
+    severity: advisory
+    effect: notification
   # road-to-install-path-convergence Phase 4 — duplicate-surface probe.
@@ -1618,3 +1621,3 @@ platforms:
     ask:              native
-    session_start:    [chat-history, hot-context, handoff-context, session-canary, council-availability, telemetry-disclosure, first-run-gate, onboarding-gate, verify-before-complete, minimal-safe-diff, profile-staleness, wrapper-freshness, surface-probe, session-register, review-baseline, journal-record, rule-inject, code-graph-refresh]
+    session_start:    [chat-history, hot-context, handoff-context, session-canary, council-availability, telemetry-disclosure, first-run-gate, onboarding-gate, verify-before-complete, minimal-safe-diff, profile-staleness, wrapper-freshness, update-notice, surface-probe, session-register, review-baseline, journal-record, rule-inject, code-graph-refresh]
     # `rule-inject` is bound here for ONE source: `compact`
diff --git a/src/scripts/hooks/dispatch_hook.ts b/src/scripts/hooks/dispatch_hook.ts
index 554b749840..3a2aef2fb5 100644
--- a/src/scripts/hooks/dispatch_hook.ts
+++ b/src/scripts/hooks/dispatch_hook.ts
@@ -54,3 +54,4 @@ import {
 } from "./hook_stdin.js";
-import { emitFor, type PermissionDecision, type Severity } from "./host_semantics.js";
+import { emitFor, withUserNotice, type PermissionDecision, type Severity } from "./host_semantics.js";
+import { USER_NOTICE_KEY, USER_NOTICE_MAX_CHARS } from "./user_notice.js";
 import { _concern_permission_verdict, _payload_tool_name, _permission_for } from "./permission_gate.js";
@@ -1266,2 +1267,4 @@ export function main(argv?: string[]): number {
   const context_blocks: string[] = [];
+  // User-addressed text (`hooks/user_notice.ts`), shown by the host, never model context.
+  const user_notices: string[] = [];
   // Per-concern message for the host emission (P0.1). Kept OUT of
@@ -1378,2 +1381,8 @@ export function main(argv?: string[]): number {
     }
+    // Only a `notification` concern may address the user: the effect says it
+    // tells a human something, and no other effect was reviewed for that.
+    const notice = reply[USER_NOTICE_KEY];
+    if (concern["effect"] === "notification" && typeof notice === "string" && notice.trim()) {
+      user_notices.push(injected(notice.trim()).slice(0, USER_NOTICE_MAX_CHARS));
+    }
     feedback_entries.push({
@@ -1404,5 +1413,4 @@ export function main(argv?: string[]): number {
   _record_rule_trips(envelope, feedback_entries);
-  if (context_blocks.length > 0 && final_rc === EXIT_ALLOW) {
-    process.stdout.write(context_blocks.join("\n\n") + "\n");
-  }
+  const context_out =
+    context_blocks.length > 0 && final_rc === EXIT_ALLOW ? context_blocks.join("\n\n") + "\n" : "";
 
@@ -1429,4 +1437,12 @@ export function main(argv?: string[]): number {
   );
-  if (emission.stdout) {
-    process.stdout.write(emission.stdout);
+  // The notice is emitted only on exit 0 because the host parses stdout only then.
+  const stdout_out = withUserNotice(
+    args.platform,
+    args.event,
+    context_out,
+    emission.stdout,
+    emission.exit === 0 ? user_notices.join("\n") : "",
+  );
+  if (stdout_out) {
+    process.stdout.write(stdout_out);
   }
diff --git a/src/scripts/hooks/host_semantics.ts b/src/scripts/hooks/host_semantics.ts
index 7c48dcff57..2f41ec1a03 100644
--- a/src/scripts/hooks/host_semantics.ts
+++ b/src/scripts/hooks/host_semantics.ts
@@ -37,2 +37,3 @@
 import { blockExitFor, DEFAULT_SURFACE, loadHostLowering, surfaceRow, verifiedPlatforms } from "./host_lowering.js";
+import { hostShowsUserNotice } from "./user_notice.js";
 
@@ -135,2 +136,44 @@ export function claudeAdditionalContext(event: string, text: string): string {
 
+/**
+ * Compose the dispatcher's stdout from its three parts: plain `session_start`
+ * context, the native emission, and a user-addressed notice.
+ *
+ * Without a notice — or on a host with no verified user field — this is the
+ * old output byte for byte: context, then emission. With one, the host parses
+ * stdout as JSON only when the whole of it is one object, so the parts are
+ * MERGED as structures, never concatenated as text: the emission's object is
+ * kept, context joins its `hookSpecificOutput.additionalContext`, and the
+ * notice joins `systemMessage`. Plain context is accepted on `session_start`
+ * only, and an emission that is not one JSON object is never reinterpreted —
+ * in either case the notice is dropped and the old output stands.
+ */
+export function withUserNotice(
+    platform: string,
+    event: string,
+    context: string,
+    emission: string,
+    notice: string,
+): string {
+    const legacy = context + emission;
+    const text = notice.trim();
+    if (!text || !hostShowsUserNotice(platform) || !usesNativeEmission(platform)) return legacy;
+    if (context.trim() && event !== "session_start") return legacy;
+    let reply: Record<string, unknown> = {};
+    if (emission.trim()) {
+        try {
+            reply = JSON.parse(emission) as Record<string, unknown>;
+        } catch {
+            return legacy;
+        }
+        if (typeof reply !== "object" || reply === null || Array.isArray(reply)) return legacy;
+    }
+    const join = (a: unknown, b: string, sep: string): string => (typeof a === "string" && a ? `${a}${sep}${b}` : b);
+    if (context.trim()) {
+        const hso = (reply["hookSpecificOutput"] ?? { hookEventName: nativeEventName(platform, event) }) as Record<string, unknown>;
+        reply["hookSpecificOutput"] = { ...hso, additionalContext: join(hso["additionalContext"], context.trim(), "\n\n") };
+    }
+    reply["systemMessage"] = join(reply["systemMessage"], text, "\n");
+    return `${JSON.stringify(reply)}\n`;
+}
+
 /**
diff --git a/src/scripts/hooks/lazy_concern.ts b/src/scripts/hooks/lazy_concern.ts
index f055753805..5285b0a09c 100644
--- a/src/scripts/hooks/lazy_concern.ts
+++ b/src/scripts/hooks/lazy_concern.ts
@@ -78,2 +78,6 @@ export const LAZY_CONCERNS: Readonly<Record<string, { readonly chunk: string; re
         }),
+        'src/scripts/update_notice_hook.ts': Object.freeze({
+            chunk: 'update_notice.chunk.cjs',
+            source: path.join('..', 'update_notice_hook'),
+        }),
     });
diff --git a/src/scripts/hooks/user_notice.ts b/src/scripts/hooks/user_notice.ts
new file mode 100644
index 0000000000..9ae902102b
--- /dev/null
+++ b/src/scripts/hooks/user_notice.ts
@@ -0,0 +1,28 @@
+/**
+ * The user-addressed channel: text a concern hands the dispatcher for the HUMAN,
+ * which the host shows in its own UI and never adds to model context.
+ *
+ * WHY IT EXISTS. Every channel the dispatcher had addressed the model
+ * (`additional_context`, `context`) or went to stderr, and every host runs the
+ * dispatcher on pipes — so a concern with something to tell the user had no
+ * path that reached them. `update-notice` was refused registration for exactly
+ * that: bound, it would have said nothing anywhere.
+ *
+ * Claude Code documents a `systemMessage` field on every hook event, "Display a
+ * message to the user", read off the 2.1.310 binary on 2026-10-24. It is the
+ * only host this package has verified a user-addressed field on, so the set
+ * below is one host wide; an unlisted host gets nothing rather than a guess.
+ */
+
+/** The concern reply key a notification concern puts its user-facing text under. */
+export const USER_NOTICE_KEY = 'user_notice';
+
+/** Longest notice the dispatcher forwards; a notice is a few lines, never a document. */
+export const USER_NOTICE_MAX_CHARS = 1000;
+
+/** Hosts with a verified field that shows text to the user and not to the model. */
+export const USER_NOTICE_HOSTS: ReadonlySet<string> = new Set(['claude']);
+
+export function hostShowsUserNotice(platform: unknown): boolean {
+    return typeof platform === 'string' && USER_NOTICE_HOSTS.has(platform);
+}
diff --git a/src/scripts/update_notice_hook.ts b/src/scripts/update_notice_hook.ts
index 78ef0daab4..2475ffdd04 100644
--- a/src/scripts/update_notice_hook.ts
+++ b/src/scripts/update_notice_hook.ts
@@ -50,2 +50,3 @@ import { readHookStdin } from './hooks/hook_stdin.js';
 import { is_replay_mode } from './hooks/state_io.js';
+import { hostShowsUserNotice, USER_NOTICE_KEY } from './hooks/user_notice.js';
 
@@ -140,7 +141,7 @@ function readText(p: string): string {
 
-function sessionIdFromEnvelope(raw: string): string | null {
+function envelopeField(raw: string, key: string): string | null {
     try {
         const doc: unknown = JSON.parse(raw);
-        const id = (doc as Record<string, unknown> | null)?.['session_id'];
-        return typeof id === 'string' && id.trim() !== '' ? id.trim() : null;
+        const value = (doc as Record<string, unknown> | null)?.[key];
+        return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
     } catch {
@@ -162,2 +163,8 @@ export interface NoticeDeps {
     readonly err: { write(text: string): void };
+    /**
+     * The dispatcher's user channel (`hooks/user_notice.ts`), set only when the
+     * host shows a notice to the user. The lines then go there as one reply and
+     * nothing goes to stderr, which every host discards.
+     */
+    readonly notice?: { write(text: string): void };
 }
@@ -202,3 +209,7 @@ export function runNotice(deps: NoticeDeps, apply = true): NoticeOutcome {
 
-    for (const line of outcome.lines) deps.err.write(`[update] ${line}\n`);
+    if (deps.notice !== undefined) {
+        if (outcome.lines.length > 0) deps.notice.write(JSON.stringify({ [USER_NOTICE_KEY]: outcome.lines.join('\n') }));
+    } else {
+        for (const line of outcome.lines) deps.err.write(`[update] ${line}\n`);
+    }
     writeNoticeState(deps.noticeStatePath, { staged: outcome.stage, last_seen_installed: installed });
@@ -263,7 +274,11 @@ export function main(argv?: string[]): number {
         // under CI, a non-TTY, a source checkout and the opt-out.
+        // Every host runs this on pipes, so a TTY says nothing about whether the
+        // user will see the notice; a host with a verified user channel does.
+        const viaHost = hostShowsUserNotice(envelopeField(raw, 'platform'));
         const deps: NoticeDeps = {
             packageRoot,
-            sessionId: sessionIdFromEnvelope(raw),
+            sessionId: envelopeField(raw, 'session_id'),
             env: process.env,
-            isTty: Boolean(process.stderr.isTTY) || Boolean(process.stdout.isTTY),
+            isTty: viaHost || Boolean(process.stderr.isTTY) || Boolean(process.stdout.isTTY),
+            ...(viaHost ? { notice: process.stdout } : {}),
             mode,
diff --git a/tests/hooks/fixtures/concern_user_notice.ts b/tests/hooks/fixtures/concern_user_notice.ts
new file mode 100644
index 0000000000..7fd9453c08
--- /dev/null
+++ b/tests/hooks/fixtures/concern_user_notice.ts
@@ -0,0 +1,22 @@
+#!/usr/bin/env tsx
+// Test fixture concern — replies with a user notice; with `context`, with
+// session context instead; with `echo-platform`, with a notice naming the
+// `platform` of the envelope the dispatcher built.
+import { readFileSync } from 'node:fs';
+
+let raw = '';
+try {
+    if (!process.stdin.isTTY) {
+        raw = readFileSync(0, 'utf-8');
+    }
+} catch {
+    // ignore — draining is best-effort
+}
+let reply: Record<string, string> = { user_notice: 'fixture notice for the user' };
+if (process.argv.includes('context')) reply = { context: 'fixture context block' };
+if (process.argv.includes('echo-platform')) {
+    const envelope = JSON.parse(raw || '{}') as Record<string, unknown>;
+    reply = { user_notice: `platform=${String(envelope['platform'])}` };
+}
+process.stdout.write(JSON.stringify(reply) + '\n');
+process.exit(0);
diff --git a/tests/hooks/user_notice_dispatch.test.ts b/tests/hooks/user_notice_dispatch.test.ts
new file mode 100644
index 0000000000..1ca33aafa1
--- /dev/null
+++ b/tests/hooks/user_notice_dispatch.test.ts
@@ -0,0 +1,136 @@
+/**
+ * The user channel through the REAL dispatcher (`hooks/user_notice.ts`).
+ *
+ * A notification concern's `user_notice` must reach the host as `systemMessage`
+ * — shown to the user, never added to model context — and must reach no host
+ * that has no verified field of that kind. Plain `session_start` context that
+ * shares the reply moves into `additionalContext`, because the host parses
+ * stdout as JSON only when the whole of it is one object.
+ */
+import { spawnSync } from 'node:child_process';
+import * as fs from 'node:fs';
+import * as os from 'node:os';
+import * as path from 'node:path';
+
+import { afterEach, describe, expect, it } from 'vitest';
+
+import { withUserNotice } from '../../src/scripts/hooks/host_semantics.js';
+
+const REPO_ROOT = path.resolve(__dirname, '..', '..');
+const ENTRY = path.join(REPO_ROOT, 'src', 'scripts', 'hooks', 'dispatch_entry.ts');
+const TSX_BIN = path.join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
+const FIXTURE = 'tests/hooks/fixtures/concern_user_notice.ts';
+
+const tmpDirs: string[] = [];
+afterEach(() => {
+    for (const d of tmpDirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
+});
+
+function dispatch(platform: string, concerns: Record<string, { effect: string; args?: string[] }>): { status: number | null; stdout: string } {
+    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'user-notice-'));
+    tmpDirs.push(dir);
+    const names = Object.keys(concerns);
+    const manifest = path.join(dir, 'manifest.yaml');
+    fs.writeFileSync(
+        manifest,
+        [
+            'schema_version: 1',
+            'concerns:',
+            ...names.flatMap((name) => [
+                `  ${name}:`,
+                `    script: ${FIXTURE}`,
+                `    args: [${(concerns[name]?.args ?? []).join(', ')}]`,
+                '    fail_closed: false',
+                '    severity: advisory',
+                `    effect: ${concerns[name]?.effect ?? 'notification'}`,
+            ]),
+            'platforms:',
+            `  ${platform}:`,
+            `    session_start: [${names.join(', ')}]`,
+            '',
+        ].join('\n'),
+        'utf8',
+    );
+    const r = spawnSync(TSX_BIN, [ENTRY, '--platform', platform, '--event', 'session_start', '--manifest', manifest], {
+        cwd: dir,
+        input: JSON.stringify({ session_id: 'user-notice-test' }),
+        encoding: 'utf8',
+        timeout: 120_000,
+        env: { ...process.env, AGENT_CONFIG_PACKAGE_ROOT: REPO_ROOT },
+    });
+    return { status: r.status, stdout: r.stdout ?? '' };
+}
+
+describe('the user channel through the dispatcher', () => {
+    it('a notification concern reaches claude as systemMessage and nowhere in model context', () => {
+        const r = dispatch('claude', { 'notice-a': { effect: 'notification' } });
+        expect(r.status).toBe(0);
+        const reply = JSON.parse(r.stdout) as Record<string, unknown>;
+        expect(reply['systemMessage']).toBe('fixture notice for the user');
+        expect(JSON.stringify(reply['hookSpecificOutput'] ?? null)).not.toContain('fixture notice');
+    }, 120_000);
+
+    it('a concern with any other effect cannot use it', () => {
+        const r = dispatch('claude', { 'context-a': { effect: 'context' } });
+        expect(r.status).toBe(0);
+        expect(r.stdout).not.toContain('fixture notice');
+    }, 120_000);
+
+    it('a host with no verified user field receives nothing', () => {
+        const r = dispatch('copilot', { 'notice-a': { effect: 'notification' } });
+        expect(r.stdout).not.toContain('fixture notice');
+    }, 120_000);
+
+    it('session context sharing the reply moves into additionalContext beside the notice', () => {
+        const r = dispatch('claude', {
+            'notice-a': { effect: 'notification' },
+            'context-b': { effect: 'context', args: ['context'] },
+        });
+        expect(r.status).toBe(0);
+        const reply = JSON.parse(r.stdout) as { systemMessage?: string; hookSpecificOutput?: Record<string, string> };
+        expect(reply.systemMessage).toBe('fixture notice for the user');
+        expect(reply.hookSpecificOutput?.['hookEventName']).toBe('SessionStart');
+        expect(reply.hookSpecificOutput?.['additionalContext']).toBe('fixture context block');
+    }, 120_000);
+
+    // The concern learns its host from the envelope the dispatcher builds out of
+    // its own `--platform`, not from anything the host payload claims.
+    it('the platform a concern reads is the one the dispatcher was invoked with', () => {
+        const r = dispatch('claude', { 'notice-a': { effect: 'notification', args: ['echo-platform'] } });
+        expect((JSON.parse(r.stdout) as Record<string, string>)['systemMessage']).toBe('platform=claude');
+    }, 120_000);
+});
+
+describe('withUserNotice', () => {
+    const EMISSION = '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"from a warn"}}\n';
+
+    it('is the old output byte for byte when there is nothing to say', () => {
+        expect(withUserNotice('claude', 'session_start', 'plain\n', EMISSION, '  ')).toBe(`plain\n${EMISSION}`);
+    });
+
+    it('merges context, an existing emission and a notice as structures', () => {
+        const out = withUserNotice('claude', 'session_start', 'plain context\n', EMISSION, 'hi');
+        expect(JSON.parse(out)).toEqual({
+            hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: 'from a warn\n\nplain context' },
+            systemMessage: 'hi',
+        });
+    });
+
+    it('appends to a systemMessage the emission already carries rather than replacing it', () => {
+        const out = withUserNotice('claude', 'stop', '', '{"systemMessage":"first"}\n', 'second');
+        expect(JSON.parse(out)).toEqual({ systemMessage: 'first\nsecond' });
+    });
+
+    it('never reinterprets an emission that is not one JSON object', () => {
+        expect(withUserNotice('claude', 'stop', '', 'not json\n', 'hi')).toBe('not json\n');
+        expect(withUserNotice('claude', 'stop', '', '[1]\n', 'hi')).toBe('[1]\n');
+    });
+
+    it('accepts plain context on session_start only', () => {
+        expect(withUserNotice('claude', 'stop', 'plain\n', '', 'hi')).toBe('plain\n');
+    });
+
+    it('drops the notice on a host without the field', () => {
+        expect(withUserNotice('cursor', 'session_start', '', '', 'hi')).toBe('');
+    });
+});
diff --git a/tests/scripts/lint_hook_manifest.test.ts b/tests/scripts/lint_hook_manifest.test.ts
index 86087c2a14..88a860195a 100644
--- a/tests/scripts/lint_hook_manifest.test.ts
+++ b/tests/scripts/lint_hook_manifest.test.ts
@@ -367,4 +367,5 @@ describe("effect: — the census's field (Phase 2.2)", () => {
     // (road-to-a-cold-start-paid-once 4.3), and 65 since `instructions-observer`
-    // (road-to-a-setup-that-decides-itself 1.1), and 66 since `code-graph-refresh`.
-    expect(names.length).toBe(66);
+    // (road-to-a-setup-that-decides-itself 1.1), and 66 since `code-graph-refresh`,
+    // and 67 since `update-notice` (road-to-an-update-that-installs-itself 3.1).
+    expect(names.length).toBe(67);
     const missing = names.filter((n) => !CONCERN_EFFECTS.has(String(manifest.concerns[n]?.effect)));
diff --git a/tests/scripts/update_notice_hook.test.ts b/tests/scripts/update_notice_hook.test.ts
index d91a2ad123..a1981190a2 100644
--- a/tests/scripts/update_notice_hook.test.ts
+++ b/tests/scripts/update_notice_hook.test.ts
@@ -18,2 +18,3 @@ import { parse as parseYaml } from 'yaml';
 import { parseCuratedHead, updateNotice, type NoticeInput } from '../../src/scripts/_lib/update_notice.js';
+import { USER_NOTICE_HOSTS, USER_NOTICE_KEY } from '../../src/scripts/hooks/user_notice.js';
 import { CONCERN, readNoticeState, readUpdateMode, runNotice, type NoticeDeps } from '../../src/scripts/update_notice_hook.js';
@@ -89,12 +90,16 @@ describe('3.1 — a session_start concern beside wrapper-freshness', () => {
 
-    // A lifecycle hook that may start an install is an authority expansion,
-    // whatever its `severity` says. Until a round on blocker
-    // `concerns-refused-as-authority-expansion` re-registers it, the manifest
-    // must NOT bind it — this flips red on the commit that registers it, which
-    // is exactly the commit that must carry the new verdict.
-    it('is not registered in hook_manifest.yaml while the council refusal stands', () => {
-        expect(manifest.concerns[CONCERN]).toBeUndefined();
+    // Registered as a notification and nothing wider: it installs nothing (3.2)
+    // and its text reaches the user only through a host's UI-only field.
+    it('is registered as an advisory, fail-open notification', () => {
+        expect(manifest.concerns[CONCERN]).toMatchObject({
+            script: 'src/scripts/update_notice_hook.ts',
+            fail_closed: false,
+            severity: 'advisory',
+            effect: 'notification',
+        });
     });
 
-    it('is bound on no event of any host while the council refusal stands', () => {
+    // Bound only where the user channel exists, so it never runs on a host
+    // where it would say nothing — the reason round 10 refused it.
+    it('is bound on session_start of the hosts with a user channel, and nowhere else', () => {
         const bound: string[] = [];
@@ -105,3 +110,46 @@ describe('3.1 — a session_start concern beside wrapper-freshness', () => {
         }
-        expect(bound).toEqual([]);
+        expect(bound).toEqual([...USER_NOTICE_HOSTS].map((h) => `${h}:session_start`));
+    });
+
+    it('under a host with a user channel the lines go out as one user_notice reply and not to stderr', () => {
+        const root = install('1.0.0');
+        const err: string[] = [];
+        const out: string[] = [];
+        const d = deps({
+            packageRoot: root,
+            isTty: false,
+            probeStatePath: probeState(tmp, { last_seen_version: '2.0.0' }),
+            err: { write: (t) => void err.push(t) },
+        });
+        runNotice({ ...d, isTty: true, notice: { write: (t) => void out.push(t) } });
+        expect(err).toEqual([]);
+        expect(out).toHaveLength(1);
+        const reply = JSON.parse(out[0] as string) as Record<string, string>;
+        expect(Object.keys(reply)).toEqual([USER_NOTICE_KEY]);
+        expect(reply[USER_NOTICE_KEY]).toContain('agent-config 2.0.0 is available (installed: 1.0.0).');
+    });
+
+    it('end to end, a claude envelope yields a user_notice reply on stdout', () => {
+        const root = install('1.0.0');
+        const home = path.join(tmp, 'home');
+        probeState(home, { last_seen_version: '2.0.0' });
+        const env: NodeJS.ProcessEnv = { ...process.env, EVENT4U_CONFIG_HOME: home, AGENT_CONFIG_PACKAGE_ROOT: root };
+        delete env['CI'];
+        delete env['GITHUB_ACTIONS'];
+        delete env['AGENT_CONFIG_NO_UPDATE_CHECK'];
+        const run = (platform: string) =>
+            spawnSync(path.join(REPO_ROOT, 'scripts-run'), ['src/scripts/update_notice_hook'], {
+                cwd: tmp,
+                env,
+                input: JSON.stringify({ platform, event: 'session_start', session_id: 's1' }),
+                encoding: 'utf-8',
+            });
+        const viaClaude = run('claude');
+        expect(viaClaude.status).toBe(0);
+        expect((JSON.parse(viaClaude.stdout) as Record<string, string>)[USER_NOTICE_KEY]).toContain('2.0.0 is available');
+        fs.rmSync(path.join(home, 'update-notice.stamp'), { force: true });
+        // A host with no verified user channel is a non-interactive context: nothing said, nothing written.
+        const viaCopilot = run('copilot');
+        expect(viaCopilot.stdout).toBe('');
+        expect(fs.existsSync(path.join(home, 'update-notice.stamp'))).toBe(false);
     });
```
