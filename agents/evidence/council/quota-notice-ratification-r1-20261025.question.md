<!-- evidence-type: analysis -->

# Ratification review — quota notices, the metered spawn ask, and the ask passthrough (road-to-a-quota-the-user-sees-coming) — round 1

You are an independent reviewer for a change in the `event4u/agent-config` repository. The change edits files on the ratification gate's hook-plumbing list — `src/scripts/hook_manifest.yaml` and its compiled `hook_manifest.json`, `src/scripts/hooks/permission_gate.ts`, `src/config/hook-bundle-budget.json` — so it needs a two-provider verdict under ADR-268 § 4: an agent may change the hook plumbing but may not ratify its own change. Subject digest of the gated files: `09a81401809ac289cb2acb6498cf3c5343adf187809b309dd01361ff23f104be (revision 9752efd34b)`.

## Background

Owner directive of 2026-10-22, in his words (German, translated): AC should warn when plan limits approach or a session grows too large; near the end of the limits it should throttle its own subagent use somewhat; when work starts burning paid API tokens AC should warn and ask, so the user keeps full control of cost. Amended the same day: no hard limits AC sets, no stopping — counters AC manages itself, adaptive rather than configured, and no dependence on a settings UI. Measured state before this branch: the only session-size warning had been retired (2026-09-10), the host's plan-window fields (`rate_limits.five_hour` / `seven_day` in the status-line payload) were read nowhere, an `ask` vote from a concern only withheld the explicit allow (so no question reached the user), and a vendor-CLI council seat booked `billable=false` inherited `ANTHROPIC_API_KEY`.

## What the change does (gated parts first)

1. **Two concerns, one script** (`src/scripts/quota_notice_hook.ts`, loaded from its own lazy chunk, 18.6 KB, ceiling 20.5 KB):
   - `quota-notice` — `effect: notification`, `severity: advisory`, `fail_closed: false`, bound on `claude` `user_prompt_submit` only. Reads a machine-wide quota ledger (written by a status-line tap, below) and replies `user_notice` (shown via `systemMessage`, never model context): once per `(window, state, resets_at)` on the machine for states warm / hot / exhausted; once per session when that session's context fill is ≥ 80 %; once per session when the session may bill per token (presence of `ANTHROPIC_API_KEY` / `ANTHROPIC_AUTH_TOKEN`, `CLAUDE_CODE_USE_BEDROCK|VERTEX`, or an `apiKeyHelper` key in a host settings file — presence only, no value is read into any output). Dedup: one claim file per key created with `wx` under the user-global state dir, claims older than eight days pruned. Silent under CI, `AGENT_CONFIG_NO_QUOTA_NOTICE=1`, replay mode, a host without a user channel, or no session id.
   - `metered-spawn-ask` — same script with `--ask`, `effect: notification` (it cannot refuse; `lint_hook_manifest` reserves `permission` for concerns that can), `severity: advisory`, `fail_closed: false`, `tools: [Agent, Task]`, bound on `claude` `pre_tool_use` only. In a session that may bill per token and holds no `billing_grant`, the first `Agent`/`Task` spawn gets the reply `{"decision":"ask","reason":…}`; the session is then stamped asked (claim file) and later spawns pass. It never denies, never names an amount, and is silent in a plan session.
2. **`permission_gate.ts` emits an `ask` vote as the host's ask.** Before: `_permission_for` returned `null` whenever the composed verdict was not `allow`, so a concern's `ask` only removed the explicit allow and the host's own machinery decided alone. Now, on `pre_tool_use` with a reduced exit of allow and a composed verdict of `ask` (no `deny`), it returns `{decision: "ask", reason}` with the asking concerns' reasons (falls back to `"agent-config asked"`). `deny` still wins over `ask` and is still withheld; any other event still gets nothing. The reasons travel in a module-level array that `_permission_for` reads and clears, because `dispatch_hook.ts` is at its 1,500-line cap. No concern in the tree voted `ask` before this branch (`grep` for `decision: 'ask'` / `"decision":"ask"` in concern sources: zero hits on origin/main).
3. **Bundle ceiling** `max_bytes` 1,554,977 → 1,556,523 with a `raise_log` entry. Room was made first: compacting `LAZY_CONCERNS` (`lazy(chunk, source)` rows, `'../x'` instead of `path.join('..', 'x')`) freed 202 B, enough for the shared row and the ask passthrough. Then two in-bundle consumers (`delegation-nudge`, `spawn-guard-shadow`) needed the plan-window verdict; reading ledger + model there cost 4,984 B, so the model moved to the tap (a CLI process outside the bundle), which writes `state/quota/pressure.json`, and the consumers read only that file (`_lib/pressure_state.ts`). Measured 1,556,373 B on a 1,554,827 B base (re-measured after merging origin/main at 9752efd34b: unchanged); ceiling = reading + the base's 150 B headroom.

Not gated, for context: `statusline:tap|install|uninstall` CLI (chains the user's status line, passes stdin unchanged, prints its output unchanged, then appends a counts-only snapshot — hashed session id, window percentages and resets, context fill, model id — and writes the pressure verdict; every own error swallowed); `_lib/pressure.ts` (burn-rate slope over the last 15 minutes needing ≥3 points spanning ≥5 minutes; stale > 10 min is `unknown`, never `ok`); `delegation-nudge` replaces its fan-out push with an in-session line when the verdict is hot/exhausted; `spawn-guard-shadow` records `plan_window: would_wait` (shadow, never denies); the council necessity check applies its strict bar on a hot window as well as after a host rate marker; an unmetered vendor-CLI seat is spawned without `ANTHROPIC_API_KEY`/`ANTHROPIC_AUTH_TOKEN` unless the run holds a billing grant; the shipped 50-calls-per-day council and team caps are removed (unset = counted, never refused; ADR-279 amended on the owner's words). Whether `setup` installs the tap by default is an open owner question; today it is opt-in.

## Verified

- `npx vitest run` over the touched suites green; the ask passthrough, the spawn ask, the claim dedup, the stale rule and the key stripping each have a test seen red with the mechanism neutralised (the key-strip one demonstrated in this session).
- End to end through the real dispatcher on `claude`: a session with `ANTHROPIC_API_KEY` set and a hot ledger gets one `systemMessage` with the metered and window lines; its first `PreToolUse(Agent)` returns `{"hookSpecificOutput":{"permissionDecision":"ask",…}}`, the second returns nothing; the same spawn without a key returns nothing.

## What to answer

Answer each of the nine modification-review questions in order, then the two specific ones:

1. What behaviour changes, including what follows from it that the diff does not state?
2. Which authority or safety boundary becomes wider or narrower, and in which direction?
3. Does the change weaken anything that judges it — a test, a gate, a threshold, this review? The standard is quoted rather than paraphrased: the implementer never silently weakens an assertion, deletes, skips or xfails a failing test, lowers a threshold, or changes fixture semantics to fit the code. Does this change do any of those?
4. Is another host or projection left as a way around the control this change touches?
5. Can it be undone, and how — by whom, with what authority, and against which revision?
6. What observation would show the claimed benefit to be false, and what rollback / kill-switch criteria does the change omit?
7. Would a smaller change do, and what does the larger one buy that the smaller one does not?
8. What does it add to standing instruction weight that every later session pays?
9. Could untrusted content steer the path this change opens, and what bounds it if so?

A. Does the diff contain a defect in the gated parts — the two manifest concerns, the ask passthrough, the shared-script binding, the chunk or bundle entries? Name file and line.
B. Is emitting a concern's `ask` as the host's ask a narrowing (more confirmation) or does it open anything — e.g. could a concern now force prompts that block an unattended run, or could a reason string carry untrusted text into the host dialog?

End with exactly one verdict line: `VERDICT: ratified`, `VERDICT: confirmed-non-expanding`, or `VERDICT: refused — <reason>`.



Omitted as generated or bookkeeping: `src/scripts/hook_manifest.json` (compiled from the YAML), concern-admission rows, roster/test-pin updates, docs, roadmap. `git diff origin/main...feat/inbox-2026-10-ax` shows the full change.

## The diff (gated files, then the concern and its readers; budget at -U0)

```diff
diff --git a/src/config/hook-bundle-budget.json b/src/config/hook-bundle-budget.json
index 476a279a7d..88d59d0a2e 100644
--- a/src/config/hook-bundle-budget.json
+++ b/src/config/hook-bundle-budget.json
@@ -7 +7 @@
-    "max_bytes": 1554977,
+    "max_bytes": 1556523,
@@ -93,0 +94,9 @@
+        },
+        {
+            "date": "2026-10-25",
+            "from": 1554977,
+            "to": 1556523,
+            "by": "agent, feat/inbox-2026-10-ax (road-to-a-quota-the-user-sees-coming 3.2, 4.3, 5.1, 5.3)",
+            "what_was_added": "The owner's 2026-10-22 quota directive on the dispatch path: one LAZY_CONCERNS row shared by `quota-notice` and `metered-spawn-ask` (both bodies live in their own chunk), `permission_gate` emitting a concern's `ask` vote as the host's native ask with its reason, and `_lib/pressure_state` — a ten-line reader of the plan-window verdict the status-line tap leaves behind — used by `delegation-nudge` (no fan-out push into a hot window) and `spawn-guard-shadow` (`plan_window: would_wait`). Measured 1,556,373 B with the change on a base of 1,554,827 B; the ceiling is that reading plus the 150 B of headroom the base had.",
+            "why_it_could_not_be_avoided": "Room was made first and measured: compacting the LAZY_CONCERNS table and dropping `path.join` from its rows freed 202 B, which carried the shared row and the ask passthrough with 16 B to spare. The two dispatch-path consumers could not follow: reading the ledger and the pressure model there cost 4,984 B, so the model moved to the tap (a CLI process, outside this bundle) and the consumers read its verdict file instead. What remains is the verdict reader and two call sites, which no chunk can carry because both concerns are in-bundle.",
+            "what_would_have_caught_it": "Nothing earlier: the base sat 150 bytes under the ceiling, so any in-bundle consumer of a new state file would have tripped it."
@@ -149,0 +159,6 @@
+        },
+        {
+            "entry": "src/scripts/quota_notice_hook.ts",
+            "max_bytes": 20500,
+            "registered_at": "2026-10-25",
+            "derivation": "Measured 18,592 bytes on 2026-10-25 (road-to-a-quota-the-user-sees-coming 3.2-4.3: the quota and metered notices, the metered spawn ask, the quota ledger reader, the pressure model, the billing-class reader and the billing-grant check), no `yaml` (it reads JSON only). The ceiling is that reading plus about 10 %, rounded, with no growth queued. Two manifest concerns share the script (`quota-notice` on claude `user_prompt_submit`, `metered-spawn-ask` on claude `pre_tool_use` for Agent/Task), so the bundle carries one LAZY_CONCERNS row for both; the row fits inside the room the compacted LAZY_CONCERNS table freed, so the dispatch ceiling is not raised. A missing chunk falls back to the spawn path and costs latency, never a notice."
diff --git a/src/scripts/_lib/billing_class.ts b/src/scripts/_lib/billing_class.ts
new file mode 100644
index 0000000000..6685e55c4a
--- /dev/null
+++ b/src/scripts/_lib/billing_class.ts
@@ -0,0 +1,62 @@
+/**
+ * billing_class — does this Claude Code session bill per token?
+ *
+ * A key in the environment or an `apiKeyHelper` in the host settings can make
+ * the session bill at API rates instead of the plan, and nothing told the user.
+ * This reads PRESENCE only — a variable that is set, a settings key that
+ * exists — and never a value, so no credential passes through it.
+ *
+ * `metered` is a possibility, not a proof: an interactive login may have
+ * declined the key. Every caller words its notice that way and points at
+ * `/status`, which shows the auth source the host actually used.
+ */
+
+import * as fs from 'node:fs';
+import * as os from 'node:os';
+import * as path from 'node:path';
+
+export interface BillingClassReading {
+    readonly billing_class: 'plan' | 'metered';
+    /** What made it metered, by name only; `null` for `plan`. */
+    readonly source: string | null;
+}
+
+const KEY_VARS = ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN'] as const;
+const CLOUD_VARS = ['CLAUDE_CODE_USE_BEDROCK', 'CLAUDE_CODE_USE_VERTEX'] as const;
+
+function truthy(v: string | undefined): boolean {
+    return v !== undefined && ['1', 'true', 'yes'].includes(v.trim().toLowerCase());
+}
+
+/** The host settings files an `apiKeyHelper` can live in, user layer first. */
+export function hostSettingsPaths(env: NodeJS.ProcessEnv, projectDir: string | null): string[] {
+    const home = env['CLAUDE_CONFIG_DIR'] ?? path.join(env['HOME'] ?? os.homedir(), '.claude');
+    const out = [path.join(home, 'settings.json')];
+    if (projectDir) {
+        out.push(path.join(projectDir, '.claude', 'settings.json'), path.join(projectDir, '.claude', 'settings.local.json'));
+    }
+    return out;
+}
+
+function hasApiKeyHelper(file: string): boolean {
+    try {
+        const o = JSON.parse(fs.readFileSync(file, 'utf-8')) as Record<string, unknown> | null;
+        const helper = o?.['apiKeyHelper'];
+        return typeof helper === 'string' && helper.trim() !== '';
+    } catch {
+        return false;
+    }
+}
+
+export function readBillingClass(env: NodeJS.ProcessEnv, settingsPaths: readonly string[]): BillingClassReading {
+    for (const name of KEY_VARS) {
+        if ((env[name] ?? '').trim() !== '') return { billing_class: 'metered', source: name };
+    }
+    for (const name of CLOUD_VARS) {
+        if (truthy(env[name])) return { billing_class: 'metered', source: name };
+    }
+    for (const file of settingsPaths) {
+        if (hasApiKeyHelper(file)) return { billing_class: 'metered', source: 'apiKeyHelper' };
+    }
+    return { billing_class: 'plan', source: null };
+}
diff --git a/src/scripts/_lib/pressure_state.ts b/src/scripts/_lib/pressure_state.ts
new file mode 100644
index 0000000000..5bfbef047c
--- /dev/null
+++ b/src/scripts/_lib/pressure_state.ts
@@ -0,0 +1,39 @@
+/**
+ * pressure_state — the plan-window verdict as one small file, for readers on
+ * the hook dispatch path.
+ *
+ * The full model (`pressure.ts`) and the ledger reader would cost every hook
+ * dispatch about five kilobytes of bundle to parse, so they run where the
+ * snapshot is written — the status-line tap — and leave their verdict here.
+ * A reader on the dispatch path reads this file and nothing else. A verdict
+ * older than ten minutes is no verdict, the same staleness rule the model uses.
+ */
+
+import * as fs from 'node:fs';
+import * as path from 'node:path';
+
+import { write_target, type EnvMap } from './user_global_paths.js';
+
+const STALE_AFTER_MS = 10 * 60 * 1000;
+
+export interface PressureVerdict {
+    readonly at: number;
+    readonly state: string;
+    /** The most pressing window, described for a human (`pressure.describeWindow`). */
+    readonly line: string;
+}
+
+export function pressureStatePath(env?: EnvMap | null): string {
+    return write_target(path.join('state', 'quota', 'pressure.json'), { env: env ?? null });
+}
+
+/** The window line when a fresh verdict says hot or exhausted; `null` otherwise. */
+export function hotWindowLine(env?: EnvMap | null, now: number = Date.now()): string | null {
+    try {
+        const v = JSON.parse(fs.readFileSync(pressureStatePath(env), 'utf-8')) as Partial<PressureVerdict>;
+        if (typeof v.at !== 'number' || now - v.at > STALE_AFTER_MS) return null;
+        return (v.state === 'hot' || v.state === 'exhausted') && typeof v.line === 'string' ? v.line : null;
+    } catch {
+        return null;
+    }
+}
diff --git a/src/scripts/hook_manifest.yaml b/src/scripts/hook_manifest.yaml
index ff956572e5..04afb718f5 100644
--- a/src/scripts/hook_manifest.yaml
+++ b/src/scripts/hook_manifest.yaml
@@ -663,6 +663,32 @@ concerns:
     fail_closed: false
     severity: advisory
     effect: notification
+  # What the user is told about plan quota and paid tokens (owner directive
+  # 2026-10-22, road-to-a-quota-the-user-sees-coming Phase 3-4). Reads the
+  # machine-wide quota ledger the status-line tap writes and emits through the
+  # user channel: one notice per (window, state, reset) on the machine at warm /
+  # hot / exhausted, one per session at 80 % context fill, one per session that
+  # may bill per token. Bound on `claude` alone for the reason `update-notice`
+  # gives. Claim files dedup across sessions. Never blocks.
+  # Kill switch: `AGENT_CONFIG_NO_QUOTA_NOTICE=1`.
+  quota-notice:
+    script: src/scripts/quota_notice_hook.ts
+    args: []
+    fail_closed: false
+    severity: advisory
+    effect: notification
+  # The one ask before AC fans out on metered money: the first Agent/Task spawn
+  # of a session that may bill per token, with no billing grant, gets the host's
+  # native `ask` (permission_gate emits an `ask` vote as the host ask). Once per
+  # session, never a deny, never an amount — it cannot refuse, so its effect is
+  # `notification`, not `permission`. Same script as `quota-notice`.
+  metered-spawn-ask:
+    script: src/scripts/quota_notice_hook.ts
+    args: ['--ask']
+    fail_closed: false
+    severity: advisory
+    effect: notification
+    tools: [Agent, Task]
   # road-to-install-path-convergence Phase 4 — duplicate-surface probe.
   # Reads src/config/surface-matrix.yml, existence-checks declared duplicate
   # classes, nudges ONCE per day (state: agents/runtime/state/
@@ -1682,7 +1708,7 @@ platforms:
     # was not restored at all.
     session_end:      [chat-history, memory-learn, session-register, roadmap-progress, telemetry-flush, journal-record]
     stop:             [chat-history, verify-before-complete, team-review-gate, end-review-nudge, obligation-settle, turn-end-gate, self-repair, session-register, session-eol, interruption-ledger, roadmap-progress, design-pass-stop, suggestion-capture, journal-record]
-    user_prompt_submit: [chat-history, verify-before-complete, minimal-safe-diff, language-mirror, delegation-nudge, skill-route, git-authorization, session-canary, self-repair, session-register, rule-inject, suggestion-capture, journal-record]
+    user_prompt_submit: [chat-history, verify-before-complete, minimal-safe-diff, language-mirror, delegation-nudge, skill-route, git-authorization, session-canary, self-repair, session-register, rule-inject, suggestion-capture, journal-record, quota-notice]
     # `rule-inject` was bound here and is not any more
     # (road-to-delivery-for-every-host 3.2, owner ruling E2). E2's strategy is
     # `user_prompt_submit` + `pre_compact`; this slot is the hottest one in the
@@ -1706,7 +1732,7 @@ platforms:
     # (+16,329 GPT tok, +69 % on the thin rule layer) are in
     # `project_thin_rules.path_only_ids`; the receiver is
     # `agents/roadmaps/stubs/road-to-a-path-route-under-delivery.md`.
-    pre_tool_use:     [block-no-verify, evidence-independence, block-kernel-rule-writes, block-plumbing-writes, block-config-weakening, block-speaking-inbox-dir, block-credential-reads, one-question-per-ask, rtk-wrap, design-slop, ui-route-nudge, code-graph-context, chain-nudge, ship-diff-volume, reread-guard, spawn-guard-shadow, source-first-gate, memory-recall]
+    pre_tool_use:     [block-no-verify, evidence-independence, block-kernel-rule-writes, block-plumbing-writes, block-config-weakening, block-speaking-inbox-dir, block-credential-reads, one-question-per-ask, rtk-wrap, design-slop, ui-route-nudge, code-graph-context, chain-nudge, ship-diff-volume, reread-guard, spawn-guard-shadow, metered-spawn-ask, source-first-gate, memory-recall]
     post_tool_use:    [chat-history, roadmap-progress, context-hygiene, verify-before-complete, minimal-safe-diff, injection-scan, pr-url-reminder, push-settle, orchestration-record, telemetry-usage, mcp-usage-observation, tool-result-bytes, edit-shape, comment-discipline, language-mirror, design-pass, journal-record, spawn-guard-shadow]
     # `language-mirror` — round-5 § 6.1. `pre_compact` sets a pin-lost marker;
     # the `post_tool_use` entry above re-emits the pin exactly once while that
diff --git a/src/scripts/hooks/lazy_concern.ts b/src/scripts/hooks/lazy_concern.ts
index aa852a7665..f7df6828e7 100644
--- a/src/scripts/hooks/lazy_concern.ts
+++ b/src/scripts/hooks/lazy_concern.ts
@@ -62,37 +62,18 @@ import type { ConcernMain } from './concern_registry_types.js';
  * Manifest `script:` path → the chunk basename beside `dist/hooks/dispatch.js`,
  * and the source module to fall back to when running from the tree.
  */
-export const LAZY_CONCERNS: Readonly<Record<string, { readonly chunk: string; readonly source: string }>> =
-    Object.freeze({
-        'src/scripts/chat_history.ts': Object.freeze({
-            chunk: 'chat_history.chunk.cjs',
-            source: path.join('..', 'chat_history'),
-        }),
-        'src/scripts/hooks/instructions_observer_hook.ts': Object.freeze({
-            chunk: 'instructions_observer.chunk.cjs',
-            source: 'instructions_observer_hook',
-        }),
-        'src/scripts/hooks/code_graph_refresh_hook.ts': Object.freeze({
-            chunk: 'code_graph_refresh.chunk.cjs',
-            source: 'code_graph_refresh_hook',
-        }),
-        'src/scripts/hooks/subagent_constraints_hook.ts': Object.freeze({
-            chunk: 'subagent_constraints.chunk.cjs',
-            source: 'subagent_constraints_hook',
-        }),
-        'src/scripts/update_notice_hook.ts': Object.freeze({
-            chunk: 'update_notice.chunk.cjs',
-            source: path.join('..', 'update_notice_hook'),
-        }),
-        'src/scripts/star_ask_hook.ts': Object.freeze({
-            chunk: 'star_ask.chunk.cjs',
-            source: path.join('..', 'star_ask_hook'),
-        }),
-        'src/scripts/hooks/layer_promotion_hook.ts': Object.freeze({
-            chunk: 'layer_promotion.chunk.cjs',
-            source: 'layer_promotion_hook',
-        }),
-    });
+const lazy = (chunk: string, source: string) => Object.freeze({ chunk, source });
+
+export const LAZY_CONCERNS: Readonly<Record<string, { readonly chunk: string; readonly source: string }>> = Object.freeze({
+    'src/scripts/chat_history.ts': lazy('chat_history.chunk.cjs', '../chat_history'),
+    'src/scripts/hooks/instructions_observer_hook.ts': lazy('instructions_observer.chunk.cjs', 'instructions_observer_hook'),
+    'src/scripts/hooks/code_graph_refresh_hook.ts': lazy('code_graph_refresh.chunk.cjs', 'code_graph_refresh_hook'),
+    'src/scripts/hooks/subagent_constraints_hook.ts': lazy('subagent_constraints.chunk.cjs', 'subagent_constraints_hook'),
+    'src/scripts/update_notice_hook.ts': lazy('update_notice.chunk.cjs', '../update_notice_hook'),
+    'src/scripts/star_ask_hook.ts': lazy('star_ask.chunk.cjs', '../star_ask_hook'),
+    'src/scripts/quota_notice_hook.ts': lazy('quota_notice.chunk.cjs', '../quota_notice_hook'),
+    'src/scripts/hooks/layer_promotion_hook.ts': lazy('layer_promotion.chunk.cjs', 'layer_promotion_hook'),
+});
 
 declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
 
diff --git a/src/scripts/hooks/permission_gate.ts b/src/scripts/hooks/permission_gate.ts
index 60f1a1d7a3..e56b0dd572 100644
--- a/src/scripts/hooks/permission_gate.ts
+++ b/src/scripts/hooks/permission_gate.ts
@@ -80,11 +80,22 @@ export function _concern_permission_verdict(
 ): PermissionDecision {
   if (rc === EXIT_BLOCK) return "deny";
   const stated = String(reply["decision"] ?? "").trim().toLowerCase();
-  if (stated === "ask") return "ask";
+  if (stated === "ask") {
+    if (typeof reply["reason"] === "string") _askReasons.push(reply["reason"]);
+    return "ask";
+  }
   if (stated === "deny") return "deny";
   return "allow";
 }
 
+/**
+ * The reasons the concerns of the current dispatch gave with an `ask`, read
+ * and cleared by `_permission_for`. Module state rather than a parameter
+ * because `dispatch_hook.ts` sits at its source-size ceiling: a dispatch calls
+ * `_concern_permission_verdict` per concern and `_permission_for` once.
+ */
+const _askReasons: string[] = [];
+
 /**
  * The permission field to hand the host, or `null` to keep the legacy envelope.
  *
@@ -93,6 +104,7 @@ export function _concern_permission_verdict(
  * already be `allow`; no concern may have voted `ask` or `deny`; and the call
  * itself must be category A. An allow is emitted only when all four hold, so
  * widening any one of them is a visible edit rather than an emergent effect.
+ * A vote of `ask` with no `deny` beside it is emitted as the host's `ask`.
  */
 export function _permission_for(
   event: string,
@@ -100,9 +112,15 @@ export function _permission_for(
   final_rc: number,
   verdicts: readonly PermissionDecision[],
 ): PermissionEmission | null {
+  const askReasons = _askReasons.splice(0);
   if (event !== "pre_tool_use") return null;
   if (final_rc !== EXIT_ALLOW) return null;
-  if (composePermissionDecision(verdicts) !== "allow") return null;
+  const composed = composePermissionDecision(verdicts);
+  // A concern that asked gets the host's own confirmation, with its reason.
+  // Before this an `ask` only withheld the allow, so the host's machinery
+  // decided alone and the question was never put.
+  if (composed === "ask") return { decision: "ask", reason: askReasons.join(" ") || "agent-config asked" };
+  if (composed !== "allow") return null;
   const tool_name = _payload_tool_name(envelope);
   const verdict = categoryAVerdict(tool_name, _payload_tool_input(envelope), _working_tree_root(envelope));
   if (!verdict.categoryA) return null;
diff --git a/src/scripts/quota_notice_hook.ts b/src/scripts/quota_notice_hook.ts
new file mode 100644
index 0000000000..bf976ae4c7
--- /dev/null
+++ b/src/scripts/quota_notice_hook.ts
@@ -0,0 +1,193 @@
+#!/usr/bin/env node
+/**
+ * `quota-notice` and `metered-spawn-ask` — what the user is told about plan
+ * quota and paid tokens, in their own terminal, never in the model's context.
+ *
+ * WHY IT EXISTS. Owner directive 2026-10-22: AC used to warn when a session
+ * grew large and stopped doing so when that advisory was retired; a session
+ * then drained a whole Max window in an hour without a word. The owner asked
+ * for a warning near the plan limit, one when a session grows too large, and a
+ * warning plus a question before paid tokens are spent — and ruled out stopping.
+ *
+ * `quota-notice` (user_prompt_submit, `effect: notification`) reads the quota
+ * ledger the status-line tap writes and emits through the user channel:
+ *   - one notice per (window, state, reset) on the whole machine, for the
+ *     states warm / hot / exhausted, so five parallel sessions print one line;
+ *   - one notice per session when its context reaches 80 % of its window;
+ *   - one notice per session when the session may bill per token.
+ * `metered-spawn-ask` (pre_tool_use on Agent/Task, `effect: permission`, run
+ * with `--ask`) returns the host's native ask on the first subagent spawn of a
+ * possibly-metered session without a billing grant. Never a deny, never an
+ * amount; every later spawn in that session passes.
+ *
+ * Dedup is a claim file created with `wx`, one per key, so two sessions that
+ * race for the same notice cannot both print it. Claims older than eight days
+ * are removed when a new one is taken.
+ *
+ * WHAT STOPS IT. `AGENT_CONFIG_NO_QUOTA_NOTICE=1`, CI, replay mode, and any host
+ * without a verified user channel. Fail-open on every path: exit 0.
+ */
+import { createHash } from 'node:crypto';
+import * as fs from 'node:fs';
+import * as path from 'node:path';
+import { fileURLToPath, pathToFileURL } from 'node:url';
+
+import { hasBillingGrant } from './_lib/billing_grant.js';
+import { hostSettingsPaths, readBillingClass, type BillingClassReading } from './_lib/billing_class.js';
+import { atLeast, describeWindow, planPressure, sessionContextFill } from './_lib/pressure.js';
+import { hashSessionId, quotaStateDir, readQuotaLedger } from './_lib/quota_ledger.js';
+import type { EnvMap } from './_lib/user_global_paths.js';
+import { readHookStdin } from './hooks/hook_stdin.js';
+import { is_replay_mode } from './hooks/state_io.js';
+import { hostShowsUserNotice, USER_NOTICE_ID_KEY, USER_NOTICE_KEY } from './hooks/user_notice.js';
+
+export const CONTEXT_NOTICE_PCT = 80;
+const CLAIM_MAX_AGE_MS = 8 * 24 * 60 * 60 * 1000;
+
+export interface QuotaNoticeDeps {
+    readonly sessionId: string | null;
+    readonly viaHost: boolean;
+    readonly env: NodeJS.ProcessEnv;
+    readonly stateEnv?: EnvMap | null;
+    readonly billing: BillingClassReading;
+    readonly now: number;
+}
+
+function claimDir(stateEnv?: EnvMap | null): string {
+    return path.join(quotaStateDir(stateEnv), 'claims');
+}
+
+/** `true` exactly once per key on this machine; `false` when taken or unwritable (fail-closed for the notice). */
+export function claimOnce(key: string, stateEnv?: EnvMap | null, now: number = Date.now()): boolean {
+    const dir = claimDir(stateEnv);
+    try {
+        fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
+        for (const name of fs.readdirSync(dir)) {
+            const p = path.join(dir, name);
+            try {
+                if (now - fs.statSync(p).mtimeMs > CLAIM_MAX_AGE_MS) fs.rmSync(p, { force: true });
+            } catch {
+                // a concurrent prune got there first
+            }
+        }
+        const name = createHash('sha256').update(key).digest('hex').slice(0, 20);
+        fs.closeSync(fs.openSync(path.join(dir, name), 'wx', 0o600));
+        return true;
+    } catch {
+        return false;
+    }
+}
+
+export function suppression(deps: Pick<QuotaNoticeDeps, 'sessionId' | 'viaHost' | 'env'>): string | null {
+    const ci = ['1', 'true'].includes((deps.env['CI'] ?? '').trim().toLowerCase()) || deps.env['GITHUB_ACTIONS'] === 'true';
+    if (ci) return 'ci';
+    if (deps.env['AGENT_CONFIG_NO_QUOTA_NOTICE'] === '1') return 'kill switch';
+    if (!deps.viaHost || deps.sessionId === null) return 'no user channel';
+    return null;
+}
+
+export function meteredText(b: BillingClassReading): string {
+    return (
+        `AC: this session may bill per token rather than your plan — ${b.source ?? 'an API credential'} is configured. ` +
+        '`/status` shows which auth Claude Code is using; remove the key or helper to stay on your subscription. ' +
+        'AC asks once before its first subagent spawn here.'
+    );
+}
+
+/** The lines this turn shows, each claimed so it is shown once. */
+export function noticeLines(deps: QuotaNoticeDeps): string[] {
+    if (suppression(deps) !== null) return [];
+    const session = hashSessionId(deps.sessionId);
+    const lines: string[] = [];
+    if (deps.billing.billing_class === 'metered' && claimOnce(`metered|${session}`, deps.stateEnv, deps.now)) {
+        lines.push(meteredText(deps.billing));
+    }
+    const ledger = readQuotaLedger(deps.stateEnv, deps.now);
+    for (const w of planPressure(ledger, deps.now).windows) {
+        if (!atLeast(w.state, 'warm') || w.state === 'unknown') continue;
+        if (!claimOnce(`window|${w.window}|${w.state}|${w.resets_at ?? 'none'}`, deps.stateEnv, deps.now)) continue;
+        const advice =
+            w.state === 'exhausted'
+                ? 'Further turns may bill extra usage or wait for the reset.'
+                : 'AC is narrowing its own fan-out; /compact or fewer parallel sessions save the most.';
+        lines.push(`AC: ${describeWindow(w)}. ${advice}`);
+    }
+    const ctx = sessionContextFill(ledger, session, deps.now);
+    if (ctx !== null && ctx >= CONTEXT_NOTICE_PCT && claimOnce(`context|${session}`, deps.stateEnv, deps.now)) {
+        lines.push(`AC: this session's context is ${Math.round(ctx)} % of its window — every turn resends it. /compact now keeps the next turns cheap.`);
+    }
+    return lines;
+}
+
+export interface AskDeps extends QuotaNoticeDeps {
+    readonly toolName: string | null;
+    readonly repoRoot: string;
+}
+
+const SPAWN_TOOLS = new Set(['Agent', 'Task']);
+
+/** The ask reason, or `null` when this spawn passes without one. */
+export function spawnAsk(deps: AskDeps): string | null {
+    if (deps.toolName === null || !SPAWN_TOOLS.has(deps.toolName)) return null;
+    if (suppression(deps) !== null) return null;
+    if (deps.billing.billing_class !== 'metered') return null;
+    if (hasBillingGrant(deps.repoRoot, deps.env)) return null;
+    if (!claimOnce(`ask|${hashSessionId(deps.sessionId)}`, deps.stateEnv, deps.now)) return null;
+    return (
+        `agent-config: this session may bill per token (${deps.billing.source ?? 'an API credential'} is configured), ` +
+        'and a subagent spawn starts another paid context. Allow to continue; the answer covers the rest of this session. ' +
+        'If /status shows your subscription, allowing costs nothing extra.'
+    );
+}
+
+function field(o: Record<string, unknown> | null, key: string): string | null {
+    const v = o?.[key];
+    return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
+}
+
+export function main(argv: string[] = process.argv.slice(2)): number {
+    const raw = readHookStdin();
+    if (is_replay_mode()) return 0;
+    try {
+        const envelope = JSON.parse(raw) as Record<string, unknown> | null;
+        const payload = (envelope?.['payload'] ?? envelope) as Record<string, unknown> | null;
+        const sessionId = field(payload, 'session_id') ?? field(envelope, 'session_id');
+        const cwd = field(payload, 'cwd') ?? field(envelope, 'workspace_root') ?? process.cwd();
+        const base = {
+            sessionId,
+            viaHost: sessionId !== null && hostShowsUserNotice(field(envelope, 'platform')),
+            env: process.env,
+            billing: readBillingClass(process.env, hostSettingsPaths(process.env, cwd)),
+            now: Date.now(),
+        };
+        if (argv.includes('--ask')) {
+            const reason = spawnAsk({ ...base, toolName: field(payload, 'tool_name'), repoRoot: cwd });
+            if (reason !== null) process.stdout.write(JSON.stringify({ decision: 'ask', reason }));
+            return 0;
+        }
+        const lines = noticeLines(base);
+        if (lines.length > 0) {
+            const id = createHash('sha256').update(`${sessionId ?? ''}|${base.now}`).digest('hex').slice(0, 16);
+            process.stdout.write(JSON.stringify({ [USER_NOTICE_KEY]: lines.join('\n'), [USER_NOTICE_ID_KEY]: id }));
+        }
+        return 0;
+    } catch {
+        return 0;
+    }
+}
+
+declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
+function _isCliEntry(): boolean {
+    if (typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__) return false;
+    if (process.argv[1] === undefined) return false;
+    if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) return true;
+    try {
+        return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(process.argv[1]));
+    } catch {
+        return false;
+    }
+}
+
+if (_isCliEntry()) {
+    process.exit(main(process.argv.slice(2)));
+}
```

## Added test titles

- it('a concern that asked gets the host ask, carrying its own reason', () => {
- it('an ask on any event but pre_tool_use is not emitted', () => {
- it('deny beside an ask is still withheld, never turned into an ask', () => {
- describe('window notices', () => {
- it('a window filling faster than it resets produces one notice with fill, projection and reset', () => {
- it('the same state in the same window is shown once on the machine, across sessions', () => {
- it('a worse state in the same window is a new notice', () => {
- it('ok and unknown windows say nothing', () => {
- describe('context notice', () => {
- it('context at 85 % of the window gets one notice per session, and a second turn none', () => {
- it('another session’s context fill is not this session’s', () => {
- describe('metered notice', () => {
- it('a session that may bill per token is told once, naming the source', () => {
- it('a plan session is not', () => {
- describe('suppression', () => {
- it.each([
- describe('spawn ask', () => {
- it('asks on the first spawn of a metered session, then lets later spawns pass', () => {
- it('never asks in a plan session, for a non-spawn tool, or under a billing grant', () => {
- describe('claimOnce', () => {
- it('is true exactly once per key and prunes claims older than eight days', () => {
- describe('readBillingClass', () => {
- it('reads presence, never values', () => {
- it('an apiKeyHelper in a host settings file is metered', () => {
