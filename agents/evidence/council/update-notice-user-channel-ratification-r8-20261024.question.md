<!-- evidence-type: analysis -->

# Ratification review — a user channel in the dispatcher, and `update-notice` registered on it (road-to-an-update-that-installs-itself-only-when-it-is-safe step 3.1) — round 8

You are an independent reviewer for a change in the `event4u/agent-config` repository. The change edits files on the ratification gate's hook-plumbing list (`src/scripts/hook_manifest.yaml`, its compiled `hook_manifest.json`, `src/scripts/hooks/dispatch_hook.ts`, `src/scripts/hooks/host_semantics.ts`, the new `src/scripts/hooks/user_notice.ts`, `src/config/hook-bundle-budget.json`), so it needs a two-provider verdict under ADR-268 § 4: an agent may change the hook plumbing but may not ratify its own change.

## Background

`update-notice` is a `session_start` concern that tells a user their global install of this package is behind, or has just moved. It was registered on 2026-10-20, then taken out of the manifest after council rounds on 2026-10-21: it could spawn `upgrade --unattended` (removed — `activate` is `null` on every path); it reported on stderr, which no host shows, so registered it "would say nothing anywhere"; and unbound definitions were refused as dead surface.

## What the change does

1. **A user-addressed reply field.** A concern may reply `{"user_notice": "<text>"}`. The dispatcher collects it only from concerns whose manifest `effect` is `notification`, passes it through the egress placeholder engine like other injected text, caps it at 1,000 Unicode code points, keeps it only if something is left, and records each kept notice as one `{concern, text}` entry; it joins them with `\n` in manifest order, and — only when the dispatcher exits 0 and only on a host in `USER_NOTICE_HOSTS` (today `claude`) whose native emission is verified — emits them as Claude Code's top-level `systemMessage`. On any other host the notice is dropped, never rerouted.
2. **One stdout object, merged as structures.** `withUserNotice(platform, event, context, emission, notice)`. Without a notice, or on a host without the field, the output is byte-identical to before (context then emission). With one: the native emission is parsed as one JSON object and kept; `session_start` plain context joins its `hookSpecificOutput.additionalContext`; the notice is appended to any existing `systemMessage`. Plain context on another event, an emission that is not one JSON object, or a field the merge would extend that has the wrong type → the old output stands and the notice is dropped.
3. **A delivery receipt.** For each entry kept — and only when the composed output actually differs from context + emission — the dispatcher writes, from the same entries, `<user-global root>/user-notice-<concern>.delivered` = `{session_id, at}`. A dropped notice — wrong host, refused call, structural fallback — leaves none.
4. **`update-notice` registered.** `effect: notification`, `severity: advisory`, `fail_closed: false`, bound on `claude` `session_start` only, loaded from its own chunk (32,428 B, ceiling 35,500) through `LAZY_CONCERNS`. Under an envelope whose `platform` has a user channel it treats the session as interactive and replies with one `user_notice`. Through the host it no longer advances `last_seen_installed` on replying: it records `pending: {session_id, installed}` and promotes it only when the receipt names that session; its day throttle on that path is "a receipt dated today", so a dropped notice is said again at the next session. On a TTY (direct CLI use) it writes to stderr and records immediately, as before. It installs nothing and starts nothing; it writes only its own user-global record and stamp (a CI assertion holds that no other module names its record), and is silenced by `AGENT_CONFIG_NO_UPDATE_CHECK=1`, `update.mode: off`, CI, a source checkout and an ephemeral run — those contexts write nothing. Every other host keeps the CLI banner. `update-auto-invite` (the stop-slot invitation) is NOT registered.
5. **Bundle ceiling.** `max_bytes` 1,551,000 → 1,554,000 with a `raise_log` entry: +2,857 B of own source measured with one esbuild invocation over origin/main and over this branch after merging it (host_semantics +1,590, user_notice +958, dispatch_hook +157, lazy_concern +152), against a base about 240 B under the ceiling. Room was not re-tried; the two previous entries measured the narrow-event chunk candidates as a quarter-megabyte require per event to buy a few hundred bytes.
6. **Records.** The concern-admission row for `update-notice` is rewritten to the new binding; `docs/contracts/hook-architecture-v1.md` documents the field, the merge rules and the receipt.

## Rounds 1–7 and what changed

Prompts committed as `agents/evidence/council/update-notice-user-channel-ratification-r{1..7}-20261024.question.md`. Every check named here was removed once and its test went red.

- **Round 1, refused 2/2:** context and emission were concatenated as text before the notice was merged. Now merged as structures (point 2). A real-dispatcher test proves the concern reads the platform the dispatcher was invoked with. That `systemMessage` stays out of model context was reproduced on Claude Code 2.1.310 with a positive control (`agents/evidence/analysis/system-message-probe-2026-10-24.md`); that the user sees it rests on the host's documentation.
- **Round 2, ratified 2/2,** with a hardening both seats named — wrong-typed fields were silently replaced; now the old output stands. Tests for manifest order, the cap, and no notice on a refused call.
- **Round 3, ratified 1 / refused 1:** the concern recorded the version as reported right after replying, while the dispatcher drops notices on a non-zero exit. Answered by pinning that its slot is not block-capable.
- **Round 4, refused 2/2:** pinning the slot does not cover an exit-0 structural fallback, which also drops the notice — the concern could still suppress a retry the user never saw. Strategy changed rather than argued: the delivery receipt (point 3) and the pending/confirm record (point 4). Tests: a notice in the output leaves a receipt naming the session, while a copilot run, a refused call and a non-notification concern leave none; through the host, without a receipt the post-update line is said again next session; a receipt for the pending session confirms it and throttles the rest of the day; a receipt for another session confirms nothing; a confirmation from an older day takes effect on the next decision.

Residuals named by seats in earlier rounds and not built: an automated re-probe of the host's `systemMessage` behaviour (it needs an authenticated live host; D16's revisit condition is the host ceasing to honour the field), and review of any future host added to `USER_NOTICE_HOSTS` or new `effect: notification` concern as authority-sensitive.
- **Round 5, ratified 1 / refused 1:** a same-day receipt naming a different session throttled a notice still pending from an earlier session. Fixed in commit `d292436e73`: the day throttle applies only when nothing is pending after confirmation. Test: a pending report from `s1` and a same-day receipt for `other` → the notice is said again and `last_seen_installed` stays unpromoted (red without the fix). The contract now states that `effect: notification` permits a concern its own user-global bookkeeping and nothing another module reads; the receipt belongs to the dispatcher.
- **Round 6, ratified 2/2,** with two non-blocking notes, taken in a commit that touched no gated file: no session id means no notice and no pending record, an empty receipt confirms nothing, and the contract says the receipt evidences emission into the host's output, not that the user read it.
- **After round 6, CI on the PR found two gates red,** which is why the gated files changed again (commit `bf4a567be4`, no behaviour change, same tests green): `dispatch_hook.ts` had gone 23 lines past its 1,500-line source cap, so the notice collection moved into `collectUserNotice` (`user_notice.ts`) and the stdout composition plus receipt into `composeStdout` (`host_semantics.ts`) — the dispatcher is back at main's line count; and `user_notice.ts`, reachable from model-facing concerns, now declares `loss_class: ephemeral-lossy` for the 1,000-character cap. The bundle was re-measured against origin/main after merging it (point 5).
- **Round 7, refused 2/2:** the batch kept a concern whose text the cleaning erased, and receipts went to every concern in the batch whenever any notice made it out — an erased notice could be counted as shown; and the cap used `.slice`, which counts UTF-16 units and can split a surrogate pair. Fixed in commit `5394e2c3df`: the batch is one list of `{concern, text}` entries, a notice is cleaned, capped by code point and kept only if something is left, and the emitted text and the receipts come from the same entries. Tests: a notice cleaned to nothing beside a visible one leaves only the visible concern in the batch; 999 × `x` + an emoji + `y` keeps exactly 1,000 code points ending in the whole emoji and is well-formed; a non-notification effect is ignored. Both guards were removed once and their tests went red.

## What to answer

1. Does the diff contain a defect — in the user channel, the stdout merge, the receipt, the concern's pending/confirm record, the binding, the tests or the budget entry? Name file and line for each.
2. Does the change expand any agent's or hook's authority — what an agent may do or decide, or what a hook may cause? Is `effect: notification` an accurate description of `update-notice` as changed?
3. Is the `max_bytes` raise, as recorded, an acceptable resolution, or should room be made instead (name how)?

End with exactly one verdict line: `VERDICT: ratified`, `VERDICT: confirmed-non-expanding`, or `VERDICT: refused — <reason>`.

Omitted from the diff below as generated or bookkeeping: `src/scripts/hook_manifest.json` (compiled from the YAML), `agents/decisions/concern-admissions.jsonl` (one rewritten row), the contract paragraph in `docs/contracts/hook-architecture-v1.md` (it restates points 1–3), the roadmap and council records. `git diff origin/main...drain/update-installs-itself-20261024` shows the full change.

## The diff (`git diff origin/main`, generated and bookkeeping files excluded; budget at -U0; tests as added test titles only)

```diff
diff --git a/src/config/hook-bundle-budget.json b/src/config/hook-bundle-budget.json
index 790d89d5f9..4ce0b1a3fa 100644
--- a/src/config/hook-bundle-budget.json
+++ b/src/config/hook-bundle-budget.json
@@ -7 +7 @@
-    "max_bytes": 1551000,
+    "max_bytes": 1554000,
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
+            "to": 1554000,
+            "by": "agent, drain/update-installs-itself-20261024 (road-to-an-update-that-installs-itself-only-when-it-is-safe 3.1)",
+            "what_was_added": "A user-addressed channel in the dispatcher: a `notification` concern may reply `user_notice`, and on claude the dispatcher emits it as `systemMessage`, the field the host documents as shown to the user and not added to model context (hooks/user_notice.ts: collectUserNotice; host_semantics: withUserNotice, which merges context, the native emission and the notice as structures and falls back to the old output whenever a field it would extend has the wrong type, and composeStdout, which also writes a small user-global receipt for each notice actually in the output, so a concern counts a notice as shown only on that receipt). Plus one LAZY_CONCERNS row for `update-notice`, whose body ships in its own chunk. Measured with one esbuild invocation over origin/main and over this branch after merging it: +2,857 bytes of own source (host_semantics +1,590, user_notice +958, dispatch_hook +157, lazy_concern +152; identifier renames elsewhere net 0), so 1,553,620 B against 1,551,000, the base reading 1,550,763. The logic sits in the two helper modules rather than in dispatch_hook.ts because that file is at the 1,500-line source cap. The first measurement, +1,391 B, predated the structural merge, the type guards and the delivery receipt that council rounds asked for.",
+            "why_it_could_not_be_avoided": "The channel is what step 3.1 was reopened for: every host runs the dispatcher on pipes, so a notice on stderr reached nobody, and a council round refused the registration for exactly that. The bytes are dispatcher code on the emission path of every event, so a chunk cannot carry them; the concern body is already in one. Room was not re-tried: the 2026-10-23 and 2026-10-24 entries measured the two narrow-event chunk candidates (`session-eol`, `handoff-context`) as buying a few hundred bytes for a quarter-megabyte require on every event, and nothing in this tree has changed that trade. Own code was compacted first (1,545 -> 1,391 B).",
+            "what_would_have_caught_it": "Nothing earlier: the base sat about 240 bytes under the ceiling. Sized to this change plus about 410 bytes."
@@ -67 +76 @@
-            "derivation": "Measured 209,890 bytes on 2026-10-20, with `yaml` external (inlined it is 472,201 \u2014 a second copy of the parser the dispatch bundle already carries). The ceiling is that reading plus about 10 %, rounded, because this chunk carries a 2,300-line concern plus the memory lookup and FTS index it reads, all of which still grow.\n\nWHY IT WAS MOVED \u2014 AND THE REASON FIRST GIVEN WAS FALSE, which is recorded here rather than corrected silently. This entry said `chat-history` is bound on `session_start` and on no other event, and called it the largest narrow-event module the metafile ranks. An independent provider review of 2026-10-20 checked the manifest and refused the change on it: `chat-history` is bound on FIVE events \u2014 `session_start`, `session_end`, `stop`, `post_tool_use` and `user_prompt_submit` \u2014 across seven hosts. It is close to the widest-bound concern in the tree, not the narrowest. The claim came from reading the `session_start:` rows of the manifest and never the others.\n\nWHAT SURVIVES THE CORRECTION, stated as narrowly as the evidence allows: the move takes 120,586 bytes out of a bundle every hook event parses (1,549,961 -> 1,429,414 B) and pays for them with one `require` of a 209,890-byte CJS file on the events that actually need the concern. Whether that is a latency WIN is UNMEASURED, and the 2026-10-18 council that chose this mechanism asked for exactly that proof inside `src/config/hook-latency-budget.json`. Until it exists this chunk is a byte-budget move with an unproven wall-clock effect, and the honest narrow-event candidates the same metafile ranks are recorded for whoever re-does it: `turn-end-gate` 71,928 B on `stop` alone, `injection-scan` 46,660 B on `post_tool_use` alone, `skill-route` 31,183 B and `git-authorization` 30,761 B on `user_prompt_submit` alone, `session-eol` 27,708 B on `stop` alone, `handoff-context` 25,220 B on `session_start` alone.\n\nUNLIKE THE OTHER TWO CHUNKS this one carries a CONCERN, so there is a correct path behind the fast one: `_run_concern` tries the static registry, then `loadLazyConcern`, then the historical spawn-per-concern path. A missing or mis-digested chunk costs latency, never the concern's effect \u2014 which the same review confirmed, noting it holds because `src/scripts/` ships in the package."
+            "derivation": "Measured 209,890 bytes on 2026-10-20, with `yaml` external (inlined it is 472,201 — a second copy of the parser the dispatch bundle already carries). The ceiling is that reading plus about 10 %, rounded, because this chunk carries a 2,300-line concern plus the memory lookup and FTS index it reads, all of which still grow.\n\nWHY IT WAS MOVED — AND THE REASON FIRST GIVEN WAS FALSE, which is recorded here rather than corrected silently. This entry said `chat-history` is bound on `session_start` and on no other event, and called it the largest narrow-event module the metafile ranks. An independent provider review of 2026-10-20 checked the manifest and refused the change on it: `chat-history` is bound on FIVE events — `session_start`, `session_end`, `stop`, `post_tool_use` and `user_prompt_submit` — across seven hosts. It is close to the widest-bound concern in the tree, not the narrowest. The claim came from reading the `session_start:` rows of the manifest and never the others.\n\nWHAT SURVIVES THE CORRECTION, stated as narrowly as the evidence allows: the move takes 120,586 bytes out of a bundle every hook event parses (1,549,961 -> 1,429,414 B) and pays for them with one `require` of a 209,890-byte CJS file on the events that actually need the concern. Whether that is a latency WIN is UNMEASURED, and the 2026-10-18 council that chose this mechanism asked for exactly that proof inside `src/config/hook-latency-budget.json`. Until it exists this chunk is a byte-budget move with an unproven wall-clock effect, and the honest narrow-event candidates the same metafile ranks are recorded for whoever re-does it: `turn-end-gate` 71,928 B on `stop` alone, `injection-scan` 46,660 B on `post_tool_use` alone, `skill-route` 31,183 B and `git-authorization` 30,761 B on `user_prompt_submit` alone, `session-eol` 27,708 B on `stop` alone, `handoff-context` 25,220 B on `session_start` alone.\n\nUNLIKE THE OTHER TWO CHUNKS this one carries a CONCERN, so there is a correct path behind the fast one: `_run_concern` tries the static registry, then `loadLazyConcern`, then the historical spawn-per-concern path. A missing or mis-digested chunk costs latency, never the concern's effect — which the same review confirmed, noting it holds because `src/scripts/` ships in the package."
@@ -79,0 +89,6 @@
+        },
+        {
+            "entry": "src/scripts/update_notice_hook.ts",
+            "max_bytes": 35500,
+            "registered_at": "2026-10-24",
+            "derivation": "Measured 32,428 bytes on 2026-10-24 (the concern, its decision library and the delivery-receipt reader) with `yaml` external (the concern reads one user-global settings file with it; inlined it would be a second copy of the parser the dispatch bundle already carries). The ceiling is that reading plus about 10 %, rounded, with no growth queued. Bound on claude `session_start` alone, so a chunk keeps its body off every other dispatch parse; the bundle carries only its LAZY_CONCERNS row. Like `chat_history` it carries a concern, so a missing chunk falls back to the spawn path and costs latency, never the notice."
@@ -84 +99 @@
-    "max_yaml_packages_note": "The dispatch path reads YAML for the hook manifest, the host-lowering table and the settings contract. One reader covers all three. Two cost 95,846 bytes for a single call site and were invisible until an external rescore counted them \u2014 which is why this is a cap rather than prose. The package set the cap counts over is YAML_PACKAGES in the gate.",
+    "max_yaml_packages_note": "The dispatch path reads YAML for the hook manifest, the host-lowering table and the settings contract. One reader covers all three. Two cost 95,846 bytes for a single call site and were invisible until an external rescore counted them — which is why this is a cap rather than prose. The package set the cap counts over is YAML_PACKAGES in the gate.",
# tests: only the added test titles are listed, to fit the input limit; the full test code is on the branch.
+++ b/tests/hooks/fixtures/concern_user_notice.ts
+process.exit(0);
+++ b/tests/hooks/user_notice_dispatch.test.ts
+describe('the user channel through the dispatcher', () => {
+    it('a notification concern reaches claude as systemMessage and nowhere in model context', () => {
+    it('a concern with any other effect cannot use it', () => {
+    it('a host with no verified user field receives nothing', () => {
+    it('session context sharing the reply moves into additionalContext beside the notice', () => {
+    it('several notices arrive in manifest order, each capped at 1,000 characters', () => {
+        const [first, second] = message.split('\n');
+    it('a refused call carries no notice', () => {
+    it('a notice put into the output leaves a receipt naming the session; a dropped one leaves none', () => {
+    it('on session_start a refusing concern beside the notice does not withhold it', () => {
+    it('update-notice is bound only on slots where no host refusal can withhold its notice', () => {
+            const [host, event] = slot.split(':') as [string, string];
+    it('the platform a concern reads is the one the dispatcher was invoked with', () => {
+describe('collectUserNotice', () => {
+    it('a notice cleaned to nothing is not kept, so only the surviving concern can be receipted', () => {
+    it('caps by code point and never splits a surrogate pair', () => {
+    it('ignores every effect but notification', () => {
+describe('withUserNotice', () => {
+    it('is the old output byte for byte when there is nothing to say', () => {
+    it('merges context, an existing emission and a notice as structures', () => {
+    it('appends to a systemMessage the emission already carries rather than replacing it', () => {
+    it('never reinterprets an emission that is not one JSON object', () => {
+    it('never overwrites a field of the wrong type — the old output stands', () => {
+    it('accepts plain context on session_start only', () => {
+    it('drops the notice on a host without the field', () => {
+++ b/tests/scripts/lint_hook_manifest.test.ts
+++ b/tests/scripts/update_notice_hook.test.ts
+    it('is registered as an advisory, fail-open notification', () => {
+    it('is bound on session_start of the hosts with a user channel, and nowhere else', () => {
+    it('under a host with a user channel the lines go out as one user_notice reply and not to stderr', () => {
+    describe('a notice through the host counts as shown only on a receipt for its session', () => {
+        it('without a receipt the post-update line stays due and is said again next session', () => {
+        it('a receipt for the pending session confirms it and throttles the rest of the day', () => {
+        it('a receipt for another session confirms nothing', () => {
+        it('an empty session id is never pending and an empty receipt confirms nothing', () => {
+        it('a same-day receipt for another session does not throttle a notice still pending', () => {
+        it('the confirmation takes effect on the next decision too, not only on the throttle path', () => {
+    it('end to end, a claude envelope yields a user_notice reply on stdout', () => {
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
index 554b749840..64b335d40d 100644
--- a/src/scripts/hooks/dispatch_hook.ts
+++ b/src/scripts/hooks/dispatch_hook.ts
@@ -54,3 +54,4 @@ import {
 } from "./hook_stdin.js";
-import { emitFor, type PermissionDecision, type Severity } from "./host_semantics.js";
+import { composeStdout, emitFor, type PermissionDecision, type Severity } from "./host_semantics.js";
+import { collectUserNotice, type NoticeBatch } from "./user_notice.js";
 import { _concern_permission_verdict, _payload_tool_name, _permission_for } from "./permission_gate.js";
@@ -1266,2 +1267,3 @@ export function main(argv?: string[]): number {
   const context_blocks: string[] = [];
+  const notices: NoticeBatch = []; // `hooks/user_notice.ts`, never model context
   // Per-concern message for the host emission (P0.1). Kept OUT of
@@ -1378,2 +1380,3 @@ export function main(argv?: string[]): number {
     }
+    collectUserNotice(notices, concern, reply, injected);
     feedback_entries.push({
@@ -1404,5 +1407,2 @@ export function main(argv?: string[]): number {
   _record_rule_trips(envelope, feedback_entries);
-  if (context_blocks.length > 0 && final_rc === EXIT_ALLOW) {
-    process.stdout.write(context_blocks.join("\n\n") + "\n");
-  }
 
@@ -1429,5 +1429,5 @@ export function main(argv?: string[]): number {
   );
-  if (emission.stdout) {
-    process.stdout.write(emission.stdout);
-  }
+  const context_out = context_blocks.length > 0 && final_rc === EXIT_ALLOW ? context_blocks.join("\n\n") + "\n" : "";
+  const stdout_out = composeStdout(args.platform, args.event, context_out, emission, notices, session_id);
+  if (stdout_out) process.stdout.write(stdout_out);
   if (emission.stderr) {
diff --git a/src/scripts/hooks/host_semantics.ts b/src/scripts/hooks/host_semantics.ts
index 7c48dcff57..f637c2b3d1 100644
--- a/src/scripts/hooks/host_semantics.ts
+++ b/src/scripts/hooks/host_semantics.ts
@@ -37,2 +37,3 @@
 import { blockExitFor, DEFAULT_SURFACE, loadHostLowering, surfaceRow, verifiedPlatforms } from "./host_lowering.js";
+import { hostShowsUserNotice, writeNoticeReceipts, type NoticeBatch } from "./user_notice.js";
 
@@ -135,2 +136,71 @@ export function claudeAdditionalContext(event: string, text: string): string {
 
+function isObject(v: unknown): v is Record<string, unknown> {
+    return typeof v === "object" && v !== null && !Array.isArray(v);
+}
+
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
+        if (!isObject(reply)) return legacy;
+    }
+    // A field this merge would extend must already have the type it extends.
+    const hsoIn = reply["hookSpecificOutput"];
+    if (hsoIn !== undefined && !isObject(hsoIn)) return legacy;
+    if (![reply["systemMessage"], hsoIn?.["additionalContext"]].every((v) => v === undefined || typeof v === "string")) return legacy;
+    const join = (a: unknown, b: string, sep: string): string => (typeof a === "string" && a ? `${a}${sep}${b}` : b);
+    if (context.trim()) {
+        const hso = hsoIn ?? { hookEventName: nativeEventName(platform, event) };
+        reply["hookSpecificOutput"] = { ...hso, additionalContext: join(hso["additionalContext"], context.trim(), "\n\n") };
+    }
+    reply["systemMessage"] = join(reply["systemMessage"], text, "\n");
+    return `${JSON.stringify(reply)}\n`;
+}
+
+/**
+ * The dispatcher's whole stdout: `withUserNotice` over its parts, and a receipt
+ * for each notice that is actually in the result — a dropped notice leaves
+ * none, so its concern says it again instead of counting it as shown. The
+ * notice rides only on exit 0, because the host parses stdout only then.
+ */
+export function composeStdout(
+    platform: string,
+    event: string,
+    context: string,
+    emission: Emission,
+    notices: NoticeBatch,
+    sessionId: string,
+): string {
+    const out = withUserNotice(platform, event, context, emission.stdout, emission.exit === 0 ? notices.map((n) => n.text).join("\n") : "");
+    if (notices.length > 0 && out !== context + emission.stdout) writeNoticeReceipts(notices.map((n) => n.concern), sessionId);
+    return out;
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
index 0000000000..504e8195c3
--- /dev/null
+++ b/src/scripts/hooks/user_notice.ts
@@ -0,0 +1,100 @@
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
+ *
+ * loss_class: ephemeral-lossy
+ *
+ * A notice longer than USER_NOTICE_MAX_CHARS loses its tail, deliberately: the
+ * text is for the user's UI and never reaches the model, and a notice is a few
+ * lines by contract, so nothing recovers the cut part.
+ */
+
+import * as fs from 'node:fs';
+
+import { write_atomic } from '../_lib/fs_atomic.js';
+import { write_target } from '../_lib/user_global_paths.js';
+
+/** The concern reply key a notification concern puts its user-facing text under. */
+export const USER_NOTICE_KEY = 'user_notice';
+
+/** Longest notice the dispatcher forwards, in Unicode code points; a notice is a few lines, never a document. */
+export const USER_NOTICE_MAX_CHARS = 1000;
+
+/** Hosts with a verified field that shows text to the user and not to the model. */
+export const USER_NOTICE_HOSTS: ReadonlySet<string> = new Set(['claude']);
+
+export function hostShowsUserNotice(platform: unknown): boolean {
+    return typeof platform === 'string' && USER_NOTICE_HOSTS.has(platform);
+}
+
+/**
+ * The notices one dispatch kept, each with the concern it came from, in
+ * manifest order. One entry carries both, so the text that is emitted and the
+ * concern that gets a receipt can never come apart.
+ */
+export type NoticeBatch = Array<{ readonly concern: string; readonly text: string }>;
+
+/**
+ * Only a `notification` concern may address the user: no other effect was
+ * reviewed for it. The text is cleaned, then capped by code point so a pair is
+ * never split, and kept only if something is left to show.
+ */
+export function collectUserNotice(
+    batch: NoticeBatch,
+    concern: Record<string, unknown>,
+    reply: Record<string, unknown>,
+    clean: (text: string) => string,
+): void {
+    const notice = reply[USER_NOTICE_KEY];
+    if (concern['effect'] !== 'notification' || typeof notice !== 'string') return;
+    const text = Array.from(clean(notice.trim())).slice(0, USER_NOTICE_MAX_CHARS).join('').trim();
+    if (text) batch.push({ concern: String(concern['name']), text });
+}
+
+/**
+ * A delivery receipt: the dispatcher writes one per concern whose notice it
+ * actually put into host output, naming the session. A concern that must not
+ * count a notice as shown until it was handed to the host reads it on its next
+ * run; anything the dispatcher dropped leaves no receipt, so the concern says
+ * it again.
+ */
+export interface NoticeReceipt {
+    readonly session_id: string;
+    readonly at: string;
+}
+
+function receiptPath(concern: string): string {
+    return write_target(`user-notice-${concern}.delivered`);
+}
+
+export function writeNoticeReceipts(concerns: readonly string[], sessionId: string): void {
+    for (const concern of new Set(concerns)) {
+        try {
+            write_atomic(receiptPath(concern), JSON.stringify({ session_id: sessionId, at: new Date().toISOString() }));
+        } catch {
+            // no receipt → the concern repeats its notice, which is the safe direction
+        }
+    }
+}
+
+export function readNoticeReceipt(concern: string): NoticeReceipt | null {
+    try {
+        const o = JSON.parse(fs.readFileSync(receiptPath(concern), 'utf-8')) as Record<string, unknown>;
+        return typeof o['session_id'] === 'string' && typeof o['at'] === 'string'
+            ? { session_id: o['session_id'], at: o['at'] }
+            : null;
+    } catch {
+        return null;
+    }
+}
diff --git a/src/scripts/update_notice_hook.ts b/src/scripts/update_notice_hook.ts
index 78ef0daab4..17e2abe645 100644
--- a/src/scripts/update_notice_hook.ts
+++ b/src/scripts/update_notice_hook.ts
@@ -50,2 +50,3 @@ import { readHookStdin } from './hooks/hook_stdin.js';
 import { is_replay_mode } from './hooks/state_io.js';
+import { hostShowsUserNotice, readNoticeReceipt, USER_NOTICE_KEY, type NoticeReceipt } from './hooks/user_notice.js';
 
@@ -75,2 +76,9 @@ export interface NoticeState {
     readonly last_seen_installed: string | null;
+    /**
+     * A notice handed to the dispatcher's user channel and not yet confirmed:
+     * the session it was handed over in, and the installed version it reported.
+     * It becomes `last_seen_installed` only when the dispatcher's receipt names
+     * that session (`hooks/user_notice.ts`); until then the notice is due again.
+     */
+    readonly pending?: { readonly session_id: string; readonly installed: string };
 }
@@ -84,3 +92,7 @@ export function readNoticeState(statePath: string | null): NoticeState {
         const str = (v: unknown): string | null => (typeof v === 'string' && parse_version(v.trim()) !== null ? v.trim() : null);
-        return { staged: str(o['staged']), last_seen_installed: str(o['last_seen_installed']) };
+        const p = o['pending'] as Record<string, unknown> | null | undefined;
+        const installed = str(p?.['installed']);
+        const pending =
+            typeof p?.['session_id'] === 'string' && installed !== null ? { session_id: p['session_id'], installed } : undefined;
+        return { staged: str(o['staged']), last_seen_installed: str(o['last_seen_installed']), ...(pending ? { pending } : {}) };
     } catch {
@@ -90,2 +102,8 @@ export function readNoticeState(statePath: string | null): NoticeState {
 
+/** The state with a pending notice promoted, when the dispatcher's receipt names its session. */
+export function confirmDelivered(state: NoticeState, receipt: NoticeReceipt | null): NoticeState {
+    if (state.pending === undefined || receipt === null || !receipt.session_id || receipt.session_id !== state.pending.session_id) return state;
+    return { staged: state.staged, last_seen_installed: state.pending.installed };
+}
+
 export function writeNoticeState(statePath: string, state: NoticeState): void {
@@ -140,7 +158,7 @@ function readText(p: string): string {
 
-function sessionIdFromEnvelope(raw: string): string | null {
+function envelopeField(raw: string, key: string): string | null {
     try {
         const doc: unknown = JSON.parse(raw);
-        const id = (doc as Record<string, unknown> | null)?.['session_id'];
-        return typeof id === 'string' && id.trim() !== '' ? id.trim() : null;
+        const value = (doc as Record<string, unknown> | null)?.[key];
+        return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
     } catch {
@@ -162,2 +180,10 @@ export interface NoticeDeps {
     readonly err: { write(text: string): void };
+    /**
+     * The dispatcher's user channel (`hooks/user_notice.ts`), set only when the
+     * host shows a notice to the user. The lines then go there as one reply and
+     * nothing goes to stderr, which every host discards.
+     */
+    readonly notice?: { write(text: string): void };
+    /** The dispatcher's delivery receipt for this concern, read only on the `notice` path. */
+    readonly receipt?: () => NoticeReceipt | null;
 }
@@ -175,3 +201,3 @@ export function runNotice(deps: NoticeDeps, apply = true): NoticeOutcome {
     const seen = probe['last_seen_version'];
-    const state = readNoticeState(deps.noticeStatePath);
+    const state = confirmDelivered(readNoticeState(deps.noticeStatePath), deps.receipt?.() ?? null);
 
@@ -202,2 +228,13 @@ export function runNotice(deps: NoticeDeps, apply = true): NoticeOutcome {
 
+    // Through the host, a notice counts as shown only once the dispatcher's
+    // receipt names this session; until then it stays pending and is said again.
+    if (deps.notice !== undefined) {
+        if (outcome.lines.length > 0) deps.notice.write(JSON.stringify({ [USER_NOTICE_KEY]: outcome.lines.join('\n') }));
+        writeNoticeState(deps.noticeStatePath, {
+            staged: outcome.stage,
+            last_seen_installed: state.last_seen_installed,
+            ...(outcome.lines.length > 0 && deps.sessionId ? { pending: { session_id: deps.sessionId, installed } } : {}),
+        });
+        return outcome;
+    }
     for (const line of outcome.lines) deps.err.write(`[update] ${line}\n`);
@@ -216,2 +253,15 @@ export function noticeOncePerDay(deps: NoticeDeps): NoticeOutcome | null {
     if (dry.suppressed !== null && !RECONCILE_REASONS.has(dry.suppressed)) return null;
+    if (deps.notice !== undefined) {
+        // Through the host the day throttle is a DELIVERED notice today, so a
+        // notice the dispatcher dropped is said again at the next session.
+        const receipt = deps.receipt?.() ?? null;
+        if (receipt !== null && localDay(new Date(receipt.at)) === localDay(new Date())) {
+            const stored = readNoticeState(deps.noticeStatePath);
+            const confirmed = confirmDelivered(stored, receipt);
+            if (confirmed !== stored) writeNoticeState(deps.noticeStatePath, confirmed);
+            // Another session's receipt never throttles a notice still pending.
+            if (confirmed.pending === undefined) return null;
+        }
+        return runNotice(deps);
+    }
     if (ranToday(deps.throttlePath)) return null;
@@ -263,7 +313,13 @@ export function main(argv?: string[]): number {
         // under CI, a non-TTY, a source checkout and the opt-out.
+        // Every host runs this on pipes, so a TTY says nothing about whether the
+        // user will see the notice; a host with a verified user channel does.
+        // Through the host a notice is confirmed by a receipt naming its session,
+        // so without a session id there is nothing to confirm it by: say nothing.
+        const viaHost = envelopeField(raw, 'session_id') !== null && hostShowsUserNotice(envelopeField(raw, 'platform'));
         const deps: NoticeDeps = {
             packageRoot,
-            sessionId: sessionIdFromEnvelope(raw),
+            sessionId: envelopeField(raw, 'session_id'),
             env: process.env,
-            isTty: Boolean(process.stderr.isTTY) || Boolean(process.stdout.isTTY),
+            isTty: viaHost || Boolean(process.stderr.isTTY) || Boolean(process.stdout.isTTY),
+            ...(viaHost ? { notice: process.stdout, receipt: () => readNoticeReceipt(CONCERN) } : {}),
             mode,
```
