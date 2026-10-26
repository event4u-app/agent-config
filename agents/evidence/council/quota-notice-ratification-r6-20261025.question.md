<!-- evidence-type: analysis -->

# Ratification review — quota notices, the metered spawn ask, and the ask passthrough (road-to-a-quota-the-user-sees-coming) — round 6

You are an independent reviewer for a change in the `event4u/agent-config` repository. The change edits files on the ratification gate's hook-plumbing list — `src/scripts/hook_manifest.yaml` and its compiled `hook_manifest.json`, `src/scripts/hooks/permission_gate.ts`, `src/scripts/hooks/dispatch_hook.ts` (one argument added on one line), `src/config/hook-bundle-budget.json` — so it needs a two-provider verdict under ADR-268 § 4: an agent may change the hook plumbing but may not ratify its own change. Subject digest of the gated files: `d9832d073a334e54f58689898ae4e4760eb9a5c41768209c141cb98a4b4141fb (revision eedbcd043d)`.

## Background

Owner directive of 2026-10-22, in his words (German, translated): AC should warn when plan limits approach or a session grows too large; near the end of the limits it should throttle its own subagent use somewhat; when work starts burning paid API tokens AC should warn and ask, so the user keeps full control of cost. Amended the same day: no hard limits AC sets, no stopping — counters AC manages itself, adaptive rather than configured, and no dependence on a settings UI. Measured state before this branch: the only session-size warning had been retired (2026-09-10), the host's plan-window fields (`rate_limits.five_hour` / `seven_day` in the status-line payload) were read nowhere, an `ask` vote from a concern only withheld the explicit allow (so no question reached the user), and a vendor-CLI council seat booked `billable=false` inherited `ANTHROPIC_API_KEY`.

## What the change does (gated parts first)

1. **Two concerns, one script** (`src/scripts/quota_notice_hook.ts`, loaded from its own lazy chunk, 20,703 B measured, ceiling 22,800 B as registered in the budget entry):
   - `quota-notice` — `effect: notification`, `severity: advisory`, `fail_closed: false`, bound on `claude` `user_prompt_submit` only. Reads a machine-wide quota ledger (written by a status-line tap, below) and replies `user_notice` (shown via `systemMessage`, never model context): once per `(window, state, resets_at)` on the machine for states warm / hot / exhausted; once per session when that session's context fill is ≥ 80 %; once per session when the session may bill per token (presence of `ANTHROPIC_API_KEY` / `ANTHROPIC_AUTH_TOKEN`, `CLAUDE_CODE_USE_BEDROCK|VERTEX`, or an `apiKeyHelper` key in a host settings file — presence only, no value is read into any output). Dedup: one claim file per key created with `wx` under the user-global state dir, claims older than eight days pruned. Silent under CI, `AGENT_CONFIG_NO_QUOTA_NOTICE=1`, replay mode, a host without a user channel, or no session id.
   - `metered-spawn-ask` — same script with `--ask`, `effect: confirmation` (a new, closed effect: asks the human to confirm the call through the host's native ask, never refuses; `lint_hook_manifest` admits it only for concerns named in `CONFIRMATION_CONCERNS`, today only this one), `severity: advisory`, `fail_closed: false`, `tools: [Agent, Task]`, bound on `claude` `pre_tool_use` and `post_tool_use`. On `pre_tool_use`, in a session that may bill per token with no `billing_grant` and no session approval, it replies `{"decision":"ask","reason":…}` and marks that one call pending — a marker named by `sha256(session_id|tool_use_id)`, the raw id never stored. On `post_tool_use`, the session is approved only if that call's pending marker exists (the marker is then removed): the asked call ran, which a refused call never does. A spawn that ran under a billing grant or with its ask suppressed has no pending marker and approves nothing; a call with no `tool_use_id` is asked about but can never approve the session; racing spawns each ask. Markers expire after eight days, and every read checks the age — the approval in `spawnApproved()` and the pending mark in `recordSpawnRan()` through one helper (stale → removed and absent, future-dated → absent); the pending mark is removed before any approval is written, so it is spent once. The ask is silenced ONLY by `AGENT_CONFIG_NO_SPAWN_ASK=1` (the user's explicit opt-out) or a billing grant; CI, a missing user channel and a missing session id silence the notices (`AGENT_CONFIG_NO_QUOTA_NOTICE=1` too) but never the ask. An unanswered ask keeps the spawn from running — observed, see Verified — so a headless paid fan-out needs a billing grant. It never denies and names no amount.
2. **`permission_gate.ts` emits a `confirmation` concern's `ask` as the host's ask.** Before: `_permission_for` returned `null` whenever the composed verdict was not `allow`, so an `ask` only removed the explicit allow. Now `_concern_permission_verdict(rc, reply, effect)` takes the concern's manifest `effect` (the one changed line in `dispatch_hook.ts`); only when it is `confirmation` is the reason recorded — normalised to one line, control characters (C0, DEL, C1) and whitespace runs collapsed to a space, cut at 300 characters; an empty one is dropped. The joined reasons stop at 600 characters. `_permission_for` emits `{decision: "ask", reason}` on `pre_tool_use` with a reduced exit of allow and a composed `ask` (no `deny`) only when a confirmation reason was recorded; any other `ask` keeps the old behaviour (allow withheld, no field). `deny` still wins and is withheld. The reasons live in a module-level array that `_permission_for` reads and clears on every call (any event), because `dispatch_hook.ts` is at its 1,500-line cap; the dispatcher runs one dispatch per process, and a test pins that a reason does not survive into the next call. No concern other than `metered-spawn-ask` declares `confirmation`.
3. **Bundle ceiling** `max_bytes` 1,554,977 → 1,556,670 with a `raise_log` entry. Room was made first: compacting `LAZY_CONCERNS` (`lazy(chunk, source)` rows, `'../x'` instead of `path.join('..', 'x')`) freed 202 B, enough for the shared row and the ask passthrough. Then two in-bundle consumers (`delegation-nudge`, `spawn-guard-shadow`) needed the plan-window verdict; reading ledger + model there cost 4,984 B, so the model moved to the tap (a CLI process outside the bundle), which writes `state/quota/pressure.json`, and the consumers read only that file (`_lib/pressure_state.ts`). Bundle readings, one procedure (`./scripts-run src/scripts/check_hook_bundle_composition`, which builds the bundle from source with the shipped esbuild options): base 1,554,827 B; 1,556,373 B after the first cut of this branch; 1,556,520 B after the round-1 fixes; 1,556,562 B now (rounds 2 and 3 touched only the lazy chunk). The ceiling 1,556,670 B is the round-1 reading plus the base's 150 B of headroom; 108 B remain. The raise_log entry states the current reading and how the ceiling was set.ts` (burn-rate slope over the last 15 minutes needing ≥3 points spanning ≥5 minutes; stale > 10 min is `unknown`, never `ok`); `delegation-nudge` replaces its fan-out push with an in-session line when the verdict is hot/exhausted; `spawn-guard-shadow` records `plan_window: would_wait` (shadow, never denies); the council necessity check applies its strict bar on a hot window as well as after a host rate marker; an unmetered vendor-CLI seat is spawned without `ANTHROPIC_API_KEY`/`ANTHROPIC_AUTH_TOKEN` unless the run holds a billing grant; the shipped 50-calls-per-day council and team caps are removed (unset = counted, never refused; ADR-279 amended on the owner's words). Whether `setup` installs the tap by default is an open owner question; today it is opt-in.

## Verified

- **Host behaviour of an unanswered ask, observed on Claude Code 2.1.310 in print mode** (`claude -p`, subscription auth, empty temp project, `--allowedTools "Bash(touch:*)"`): control without a hook — the `touch` ran and the file exists; same call with a project `PreToolUse` hook returning `permissionDecision: "ask"` — the call did not run, the model reported it blocked, the file does not exist.

- `npx vitest run` over the touched suites green; the ask passthrough, the spawn ask, the claim dedup, the stale rule and the key stripping each have a test seen red with the mechanism neutralised (the key-strip one demonstrated in this session).
- End to end through the real dispatcher on `claude`: a session with `ANTHROPIC_API_KEY` set and a hot ledger gets one `systemMessage` with the metered and window lines; a `PreToolUse(Agent)` for call `c1` returns `permissionDecision: "ask"`; a `PostToolUse` for an unasked call `c-unasked` leaves the next `PreToolUse` (`c2`) asking; a `PostToolUse` for `c2` itself makes the next (`c3`) return nothing; the same spawn without a key returns nothing.

## Rounds 1–3, in short

Prompts committed as `agents/evidence/council/quota-notice-ratification-r{1,2,3}-20261025.question.md`. Round 1 refused 2/2 (a session stamped "asked" at emission; any concern's ask reaching the host; unbounded reason text; wrong effect) → approval only after a spawn ran, the closed `confirmation` effect, one bounded line per reason. Round 2 refused 2/2 (any completed metered spawn approved the session) → the ask marks its own call (hashed `tool_use_id`) pending and only that call's completion approves; joined reasons capped at 600, empty dropped, separate kill switches, markers expire. Round 3 refused 1 of 2 (expiry not enforced on read) → age checked in `spawnApproved()`, `confirmation` limited to `CONFIRMATION_CONCERNS` in the linter, bundle readings stated from one procedure. Each fix has a test seen red with its guard removed.

## Round 4 and what changed

Prompt committed as `agents/evidence/council/quota-notice-ratification-r4-20261025.question.md`. **Refused 2/2**, one point: `spawnAsk()` used the generic notice suppression, so in CI the ask was silenced and a paid spawn ran without the billing grant the manifest said it needs. Both seats otherwise called the multi-round consent fixes strong and the round-3 expiry and closed-set changes closed. Answers:

- **CI no longer silences the ask.** `spawnAsk()` checks only `AGENT_CONFIG_NO_SPAWN_ASK`, then plan/metered, then the billing grant, then the session approval. Tests: CI, `GITHUB_ACTIONS`, no user channel and no session id each still ask; CI with a billing grant passes; a call asked about without a session id can never approve. Seen red with the generic suppression restored.
- **"Cannot proceed" is now an observation, not a claim** — the print-mode probe above, with its control.
- **Credential source changing after approval.** The billing class is read on every call: a session that becomes plan is never asked; an approval exists only for a session that was metered when the user allowed a spawn, and it expires after eight days.
- **Telemetry and rollback criteria.** Not built; the measurement stub owns them and says so. Rollback is `AGENT_CONFIG_NO_SPAWN_ASK=1` at runtime or reverting the binding.

## Round 5 and what changed

Prompt committed as `agents/evidence/council/quota-notice-ratification-r5-20261025.question.md`. **Refused 2/2**, one point: `recordSpawnRan()` redeemed a pending mark by existence alone, so a stale one could approve a session after the stated expiry; both also asked that the mark be one-use, and one noted the chunk size in the preamble lagged the budget entry. No defect was found in the manifest bindings, the confirmation-only composition, `dispatch_hook.ts`, the closed set or the budget justification; rounds 1, 2 and 4 were judged closed.

- **Pending expiry on redemption.** `spawnApproved()` and `recordSpawnRan()` share `freshMarker()`; the pending mark is removed before the approval is written. Test: a pending mark aged nine days approves nothing; a future-dated one approves nothing; both are removed; a fresh one approves once and a second redemption of the same call approves nothing. Seen red with the age check replaced by an existence check.
- **Chunk size.** The preamble and the budget entry now state the same reading (20,703 B) and ceiling (22,800 B). The chunk entry is new in this diff, so there is no base value to raise from.
- **Opening versus narrowing.** Agreed with both seats that it is both: a new, review-gated hook authority (an admitted `confirmation` concern can put a prompt in front of the user and hold an unattended call) used here to narrow paid spend. The record will say so rather than call the change non-expanding.

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

A. Does the diff contain a defect in the gated parts — the two manifest concerns, the confirmation-only ask passthrough, the post_tool_use approval, the shared-script binding, the chunk or bundle entries? Name file and line. Are the findings of rounds 1–5 closed?
B. Is emitting a concern's `ask` as the host's ask a narrowing (more confirmation) or does it open anything — e.g. could a concern now force prompts that block an unattended run, or could a reason string carry untrusted text into the host dialog?

End with exactly one verdict line: `VERDICT: ratified`, `VERDICT: confirmed-non-expanding`, or `VERDICT: refused — <reason>`.







Omitted as generated or bookkeeping: `src/scripts/hook_manifest.json` (compiled from the YAML), concern-admission rows, roster/test-pin updates, docs, roadmap, and — for size — `hooks/lazy_concern.ts` and `_lib/pressure_state.ts` (both unchanged since round 1). `quota_notice_hook.ts` is shown at one line of context. `git diff origin/main...feat/inbox-2026-10-ax` shows the full change.

## The diff (gated files, the new effect in the linter, then the concern; budget at -U0)

```diff
diff --git a/src/config/hook-bundle-budget.json b/src/config/hook-bundle-budget.json
index 476a279a7d..f93d681efa 100644
--- a/src/config/hook-bundle-budget.json
+++ b/src/config/hook-bundle-budget.json
@@ -7 +7 @@
-    "max_bytes": 1554977,
+    "max_bytes": 1556670,
@@ -93,0 +94,9 @@
+        },
+        {
+            "date": "2026-10-25",
+            "from": 1554977,
+            "to": 1556670,
+            "by": "agent, feat/inbox-2026-10-ax (road-to-a-quota-the-user-sees-coming 3.2, 4.3, 5.1, 5.3)",
+            "what_was_added": "The owner's 2026-10-22 quota directive on the dispatch path: one LAZY_CONCERNS row shared by `quota-notice` and `metered-spawn-ask` (both bodies live in their own chunk), `permission_gate` emitting a concern's `ask` vote as the host's native ask with its reason, and `_lib/pressure_state` — a ten-line reader of the plan-window verdict the status-line tap leaves behind — used by `delegation-nudge` (no fan-out push into a hot window) and `spawn-guard-shadow` (`plan_window: would_wait`). Measured 1,556,562 B with the change on a base of 1,554,827 B, after ratification rounds 1 and 2 restricted the host ask to `effect: confirmation` concerns, passed that effect from the dispatcher and bounded the reasons. The ceiling, 1,556,670 B, was set at the round-1 reading (1,556,520 B) plus the 150 B of headroom the base had; 108 B remain.",
+            "why_it_could_not_be_avoided": "Room was made first and measured: compacting the LAZY_CONCERNS table and dropping `path.join` from its rows freed 202 B, which carried the shared row and the ask passthrough with 16 B to spare. The two dispatch-path consumers could not follow: reading the ledger and the pressure model there cost 4,984 B, so the model moved to the tap (a CLI process, outside this bundle) and the consumers read its verdict file instead. What remains is the verdict reader and two call sites, which no chunk can carry because both concerns are in-bundle.",
+            "what_would_have_caught_it": "Nothing earlier: the base sat 150 bytes under the ceiling, so any in-bundle consumer of a new state file would have tripped it."
@@ -149,0 +159,6 @@
+        },
+        {
+            "entry": "src/scripts/quota_notice_hook.ts",
+            "max_bytes": 22800,
+            "registered_at": "2026-10-25",
+            "derivation": "Measured 20,703 bytes on 2026-10-25 (road-to-a-quota-the-user-sees-coming 3.2-4.3: the quota and metered notices, the metered spawn ask with its per-call pending marker and read-path expiry from ratification rounds 1-5, the quota ledger reader, the pressure model, the billing-class reader and the billing-grant check), no `yaml` (it reads JSON only). The ceiling is that reading plus about 10 %, rounded, with no growth queued. Two manifest concerns share the script (`quota-notice` on claude `user_prompt_submit`, `metered-spawn-ask` on claude `pre_tool_use` for Agent/Task), so the bundle carries one LAZY_CONCERNS row for both; the row fits inside the room the compacted LAZY_CONCERNS table freed, so the dispatch ceiling is not raised. A missing chunk falls back to the spawn path and costs latency, never a notice."
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
diff --git a/src/scripts/hook_manifest.yaml b/src/scripts/hook_manifest.yaml
index ff956572e5..c08b344840 100644
--- a/src/scripts/hook_manifest.yaml
+++ b/src/scripts/hook_manifest.yaml
@@ -663,6 +663,37 @@ concerns:
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
+  # The ask before AC fans out on metered money. In a session that may bill per
+  # token, with no billing grant, an Agent/Task spawn gets the host's native
+  # `ask` until the user has allowed one: the ask marks that call (hashed
+  # tool_use_id) pending, and only that call's own post_tool_use approves the
+  # session — a "no", or a spawn that ran without an ask, approves nothing. Never a
+  # deny, never an amount. `effect: confirmation` is the only effect whose `ask`
+  # the dispatcher hands to the host. CI and print mode do not silence it: an
+  # unanswered ask keeps the spawn from running (observed on 2.1.310), so a
+  # headless paid fan-out needs a billing grant. Kill switch: `AGENT_CONFIG_NO_SPAWN_ASK=1`. Same
+  # script as `quota-notice`.
+  metered-spawn-ask:
+    script: src/scripts/quota_notice_hook.ts
+    args: ['--ask']
+    fail_closed: false
+    severity: advisory
+    effect: confirmation
+    tools: [Agent, Task]
   # road-to-install-path-convergence Phase 4 — duplicate-surface probe.
   # Reads src/config/surface-matrix.yml, existence-checks declared duplicate
   # classes, nudges ONCE per day (state: agents/runtime/state/
@@ -1682,7 +1713,7 @@ platforms:
     # was not restored at all.
     session_end:      [chat-history, memory-learn, session-register, roadmap-progress, telemetry-flush, journal-record]
     stop:             [chat-history, verify-before-complete, team-review-gate, end-review-nudge, obligation-settle, turn-end-gate, self-repair, session-register, session-eol, interruption-ledger, roadmap-progress, design-pass-stop, suggestion-capture, journal-record]
-    user_prompt_submit: [chat-history, verify-before-complete, minimal-safe-diff, language-mirror, delegation-nudge, skill-route, git-authorization, session-canary, self-repair, session-register, rule-inject, suggestion-capture, journal-record]
+    user_prompt_submit: [chat-history, verify-before-complete, minimal-safe-diff, language-mirror, delegation-nudge, skill-route, git-authorization, session-canary, self-repair, session-register, rule-inject, suggestion-capture, journal-record, quota-notice]
     # `rule-inject` was bound here and is not any more
     # (road-to-delivery-for-every-host 3.2, owner ruling E2). E2's strategy is
     # `user_prompt_submit` + `pre_compact`; this slot is the hottest one in the
@@ -1706,8 +1737,8 @@ platforms:
     # (+16,329 GPT tok, +69 % on the thin rule layer) are in
     # `project_thin_rules.path_only_ids`; the receiver is
     # `agents/roadmaps/stubs/road-to-a-path-route-under-delivery.md`.
-    pre_tool_use:     [block-no-verify, evidence-independence, block-kernel-rule-writes, block-plumbing-writes, block-config-weakening, block-speaking-inbox-dir, block-credential-reads, one-question-per-ask, rtk-wrap, design-slop, ui-route-nudge, code-graph-context, chain-nudge, ship-diff-volume, reread-guard, spawn-guard-shadow, source-first-gate, memory-recall]
-    post_tool_use:    [chat-history, roadmap-progress, context-hygiene, verify-before-complete, minimal-safe-diff, injection-scan, pr-url-reminder, push-settle, orchestration-record, telemetry-usage, mcp-usage-observation, tool-result-bytes, edit-shape, comment-discipline, language-mirror, design-pass, journal-record, spawn-guard-shadow]
+    pre_tool_use:     [block-no-verify, evidence-independence, block-kernel-rule-writes, block-plumbing-writes, block-config-weakening, block-speaking-inbox-dir, block-credential-reads, one-question-per-ask, rtk-wrap, design-slop, ui-route-nudge, code-graph-context, chain-nudge, ship-diff-volume, reread-guard, spawn-guard-shadow, metered-spawn-ask, source-first-gate, memory-recall]
+    post_tool_use:    [chat-history, roadmap-progress, context-hygiene, verify-before-complete, minimal-safe-diff, injection-scan, pr-url-reminder, push-settle, orchestration-record, telemetry-usage, mcp-usage-observation, tool-result-bytes, edit-shape, comment-discipline, language-mirror, design-pass, journal-record, spawn-guard-shadow, metered-spawn-ask]
     # `language-mirror` — round-5 § 6.1. `pre_compact` sets a pin-lost marker;
     # the `post_tool_use` entry above re-emits the pin exactly once while that
     # marker is set, then clears it. One extra injection per compaction EVENT —
diff --git a/src/scripts/hooks/dispatch_hook.ts b/src/scripts/hooks/dispatch_hook.ts
index c40f584346..16ac1faf33 100644
--- a/src/scripts/hooks/dispatch_hook.ts
+++ b/src/scripts/hooks/dispatch_hook.ts
@@ -1341,7 +1341,7 @@ export function main(argv?: string[]): number {
     }
     rcs.push(rc);
     const reply = _parse_concern_stdout(stdout_text);
-    permission_verdicts.push(_concern_permission_verdict(rc, reply));
+    permission_verdicts.push(_concern_permission_verdict(rc, reply, concern["effect"]));
     // A concern states its reason either as JSON {"reason": …} on stdout
     // (advisory concerns) or as a formatted stderr line (the block guards, e.g.
     // `block-no-verify: BLOCKED — …`). Both are captured here so the emission
diff --git a/src/scripts/hooks/permission_gate.ts b/src/scripts/hooks/permission_gate.ts
index 60f1a1d7a3..c94e3a8312 100644
--- a/src/scripts/hooks/permission_gate.ts
+++ b/src/scripts/hooks/permission_gate.ts
@@ -77,14 +77,33 @@ export function _working_tree_root(envelope: JsonObject): string {
 export function _concern_permission_verdict(
   rc: number,
   reply: JsonObject,
+  effect?: unknown,
 ): PermissionDecision {
   if (rc === EXIT_BLOCK) return "deny";
   const stated = String(reply["decision"] ?? "").trim().toLowerCase();
-  if (stated === "ask") return "ask";
+  if (stated === "ask") {
+    // Only a `confirmation` concern's ask reaches the host; any other ask still
+    // just withholds the allow. The reason is one bounded line of plain text.
+    const line = typeof reply["reason"] === "string"
+      ? reply["reason"].replace(/[\u0000-\u001f\u007f-\u009f\s]+/g, " ").trim().slice(0, 300) : "";
+    if (effect === "confirmation" && line !== "") _askReasons.push(line);
+    return "ask";
+  }
   if (stated === "deny") return "deny";
   return "allow";
 }
 
+/**
+ * The reasons the `confirmation` concerns of the current dispatch gave with an
+ * `ask`, read and cleared by `_permission_for` on every call.
+ * It assumes one dispatch at a time per process, which is how the dispatcher
+ * runs (one process per hook event); `_permission_for` clearing it on every
+ * call, any event, keeps a reason from outliving its dispatch. Module state rather than a parameter
+ * because `dispatch_hook.ts` sits at its source-size ceiling: a dispatch calls
+ * `_concern_permission_verdict` per concern and `_permission_for` once.
+ */
+const _askReasons: string[] = [];
+
 /**
  * The permission field to hand the host, or `null` to keep the legacy envelope.
  *
@@ -93,6 +112,8 @@ export function _concern_permission_verdict(
  * already be `allow`; no concern may have voted `ask` or `deny`; and the call
  * itself must be category A. An allow is emitted only when all four hold, so
  * widening any one of them is a visible edit rather than an emergent effect.
+ * A vote of `ask` from a `confirmation` concern, with no `deny` beside it, is
+ * emitted as the host's `ask`; any other `ask` withholds the allow and no more.
  */
 export function _permission_for(
   event: string,
@@ -100,9 +121,15 @@ export function _permission_for(
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
+  if (composed === "ask") return askReasons.length > 0 ? { decision: "ask", reason: askReasons.join(" ").slice(0, 600) } : null;
+  if (composed !== "allow") return null;
   const tool_name = _payload_tool_name(envelope);
   const verdict = categoryAVerdict(tool_name, _payload_tool_input(envelope), _working_tree_root(envelope));
   if (!verdict.categoryA) return null;
diff --git a/src/scripts/lint_hook_manifest.ts b/src/scripts/lint_hook_manifest.ts
index 78a0b92f4a..e0d7501e26 100644
--- a/src/scripts/lint_hook_manifest.ts
+++ b/src/scripts/lint_hook_manifest.ts
@@ -68,9 +68,20 @@ const DEFAULT_HOST_LOWERING = path.join(HOOKS_DIR, "host_lowering.yaml");
  * - `telemetry`    records state, a ledger, a counter
  * - `memory`       reads or writes the memory layer
  * - `notification` tells the human something and changes nothing else
+ * - `confirmation` asks the human to confirm the call it fires on, through the
+ *                  host's native ask; it never refuses, and it is the only
+ *                  effect whose `ask` vote the dispatcher hands to the host
  * - `formatting`   reshapes a command or a generated file
  * - `execution`    starts a process that outlives the event it fired on
  */
+/**
+ * The concerns admitted to `effect: confirmation`. That effect is privileged —
+ * its `ask` reaches the host as a prompt the user must answer, and a headless
+ * run waits on it — so the set is closed: adding a name here is a reviewed
+ * change to this file, never a manifest edit alone.
+ */
+export const CONFIRMATION_CONCERNS: ReadonlySet<string> = new Set(["metered-spawn-ask"]);
+
 export const CONCERN_EFFECTS: ReadonlySet<string> = new Set([
   "permission",
   "context",
@@ -78,6 +89,7 @@ export const CONCERN_EFFECTS: ReadonlySet<string> = new Set([
   "telemetry",
   "memory",
   "notification",
+  "confirmation",
   "formatting",
   "execution",
 ]);
@@ -205,6 +217,12 @@ function _check_concerns(manifest: YamlObject, errors: string[]): Set<string> {
         `concerns.${name}: 'effect' must be one of ` +
           `${[...CONCERN_EFFECTS].sort().join(" | ")} (got ${JSON.stringify(effect)})`,
       );
+    } else if (effect === "confirmation" && !CONFIRMATION_CONCERNS.has(name)) {
+      errors.push(
+        `concerns.${name}: 'effect: confirmation' is reserved to ` +
+          `${[...CONFIRMATION_CONCERNS].join(", ")} — its ask reaches the host as a prompt; ` +
+          `admitting another concern is a reviewed edit of CONFIRMATION_CONCERNS`,
+      );
     } else if ((spec["severity"] === "blocking") !== (effect === "permission")) {
       // The two fields answer the same question from different sides, so a
       // disagreement is a mistake in one of them, never a shade of meaning:
diff --git a/src/scripts/quota_notice_hook.ts b/src/scripts/quota_notice_hook.ts
new file mode 100644
index 0000000000..eaa8c392fa
--- /dev/null
+++ b/src/scripts/quota_notice_hook.ts
@@ -0,0 +1,283 @@
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
+ * `metered-spawn-ask` (Agent/Task, `effect: confirmation`, run with `--ask`)
+ * returns the host's native ask on a subagent spawn of a possibly-metered
+ * session without a billing grant, until the user has allowed one: asking marks
+ * that one call (by its hashed `tool_use_id`) pending, and only its own
+ * post_tool_use turns the mark into a session approval. A "no", a spawn that
+ * ran without an ask, or a call with no id approves nothing; racing spawns each
+ * ask. Markers expire after eight days. Never a deny, never an amount.
+ *
+ * Dedup is a claim file created with `wx`, one per key, so two sessions that
+ * race for the same notice cannot both print it. Claims older than eight days
+ * are removed when a new one is taken.
+ *
+ * WHAT STOPS IT. The notices: `AGENT_CONFIG_NO_QUOTA_NOTICE=1`, CI, replay
+ * mode, and any host without a verified user channel. The ask: only
+ * `AGENT_CONFIG_NO_SPAWN_ASK=1` or a billing grant — in CI or print mode an
+ * unanswered ask keeps the spawn from running. Fail-open on every path: exit 0.
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
+/** Remove marker files older than eight days from one state directory. */
+function prune(dir: string, now: number): void {
+    try {
+        for (const name of fs.readdirSync(dir)) {
+            const p = path.join(dir, name);
+            try {
+                if (now - fs.statSync(p).mtimeMs > CLAIM_MAX_AGE_MS) fs.rmSync(p, { force: true });
+            } catch {
+                // a concurrent prune got there first
+            }
+        }
+    } catch {
+        // no directory yet
+    }
+}
+
+function digest(key: string): string {
+    return createHash('sha256').update(key).digest('hex').slice(0, 20);
+}
+
+/** `true` exactly once per key on this machine; `false` when taken or unwritable (fail-closed for the notice). */
+export function claimOnce(key: string, stateEnv?: EnvMap | null, now: number = Date.now()): boolean {
+    const dir = claimDir(stateEnv);
+    try {
+        fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
+        prune(dir, now);
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
+        'AC asks before subagent spawns here until you allow one.'
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
+    /** The host's id for this tool call; read only to be hashed, never stored. */
+    readonly toolUseId: string | null;
+    readonly repoRoot: string;
+}
+
+const SPAWN_TOOLS = new Set(['Agent', 'Task']);
+
+function markerPath(kind: 'pending' | 'approved', key: string, stateEnv?: EnvMap | null): string {
+    return path.join(quotaStateDir(stateEnv), kind, digest(key));
+}
+
+function touch(p: string, now: number): void {
+    const dir = path.dirname(p);
+    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
+    prune(dir, now);
+    fs.writeFileSync(p, '', { mode: 0o600 });
+}
+
+/**
+ * The ask reason, or `null` when this spawn passes without one. Asking marks
+ * exactly this call as pending; nothing else is recorded.
+ */
+export function spawnAsk(deps: AskDeps): string | null {
+    if (deps.toolName === null || !SPAWN_TOOLS.has(deps.toolName)) return null;
+    // Only the explicit opt-out silences the ask. CI, a missing user channel or
+    // a missing session id suppress the notices, never this: an unanswerable ask
+    // keeps the spawn from running (observed on Claude Code 2.1.310 in print
+    // mode), so a headless paid fan-out needs a billing grant, as stated.
+    if (deps.env['AGENT_CONFIG_NO_SPAWN_ASK'] === '1') return null;
+    if (deps.billing.billing_class !== 'metered') return null;
+    if (hasBillingGrant(deps.repoRoot, deps.env)) return null;
+    if (spawnApproved(deps.sessionId, deps.stateEnv, deps.now)) return null;
+    if (deps.toolUseId !== null) {
+        try {
+            touch(markerPath('pending', `${deps.sessionId ?? ''}|${deps.toolUseId}`, deps.stateEnv), deps.now);
+        } catch {
+            // without a pending marker the post event approves nothing: it asks again
+        }
+    }
+    return (
+        `agent-config: this session may bill per token (${deps.billing.source ?? 'an API credential'} is configured), ` +
+        'and a subagent spawn starts another paid context. Once you have allowed one spawn here, AC stops asking. ' +
+        'If /status shows your subscription, allowing costs nothing extra.'
+    );
+}
+
+/**
+ * Is the marker at `p` within its eight days? Checked on every read, so a
+ * marker cannot outlive its expiry because nothing wrote a new one. A stale
+ * marker is removed; a future-dated or unreadable one counts as absent. One
+ * minute of slack: a file's mtime can run a few ms ahead of the clock read.
+ */
+function freshMarker(p: string, now: number): boolean {
+    try {
+        const age = now - fs.statSync(p).mtimeMs;
+        if (age >= -60_000 && age <= CLAIM_MAX_AGE_MS) return true;
+        if (age > CLAIM_MAX_AGE_MS) fs.rmSync(p, { force: true });
+        return false;
+    } catch {
+        return false;
+    }
+}
+
+/** Has the user allowed an asked spawn in this session, within eight days? */
+export function spawnApproved(sessionId: string | null, stateEnv?: EnvMap | null, now: number = Date.now()): boolean {
+    return sessionId !== null && freshMarker(markerPath('approved', sessionId, stateEnv), now);
+}
+
+/**
+ * post_tool_use: the session is approved only when THIS call was asked about
+ * and then ran — the one observable "yes". A spawn that ran without an ask
+ * (a billing grant, a suppressed ask, no call id) approves nothing.
+ */
+export function recordSpawnRan(deps: Pick<AskDeps, 'sessionId' | 'stateEnv' | 'toolName' | 'toolUseId' | 'now'>): boolean {
+    if (deps.sessionId === null || deps.toolUseId === null) return false;
+    if (deps.toolName === null || !SPAWN_TOOLS.has(deps.toolName)) return false;
+    const pending = markerPath('pending', `${deps.sessionId}|${deps.toolUseId}`, deps.stateEnv);
+    const fresh = freshMarker(pending, deps.now);
+    // One use: the pending mark is spent before any approval is written.
+    fs.rmSync(pending, { force: true });
+    if (!fresh) return false;
+    touch(markerPath('approved', deps.sessionId, deps.stateEnv), deps.now);
+    return true;
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
+            const toolName = field(payload, 'tool_name');
+            const toolUseId = field(payload, 'tool_use_id');
+            if (field(envelope, 'event') === 'post_tool_use') {
+                recordSpawnRan({ ...base, toolName, toolUseId });
+                return 0;
+            }
+            const reason = spawnAsk({ ...base, toolName, toolUseId, repoRoot: cwd });
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

- it('a confirmation concern that asked gets the host ask, carrying its own reason', () => {
- it('an ask from any other effect still only withholds the allow', () => {
- it('the reason reaches the host as one bounded line without control characters', () => {
- it('an empty confirmation reason emits nothing, and several reasons stay under 600 characters', () => {
- it('a reason belongs to its dispatch only', () => {
- it('an ask on any event but pre_tool_use is not emitted', () => {
- it('deny beside an ask is still withheld, never turned into an ask', () => {
- it("returns 1 when a concern outside CONFIRMATION_CONCERNS declares effect: confirmation", () => {
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
- it('a "no" approves nothing: the next spawn asks again', () => {
- it('the asked call running approves the session — that session only', () => {
- it('a spawn that ran under a billing grant approves nothing once the grant is gone', () => {
- it('CI, no user channel or no session id do not silence the ask; a billing grant does', () => {
- it('a call asked about without a session id can never approve a session', () => {
- it('a spawn whose ask was suppressed approves nothing', () => {
- it('another call running, or a call with no id, approves nothing', () => {
- it('the ask kill switch leaves the notices on, and the notice kill switch leaves the ask on', () => {
- it('never asks in a plan session or for a non-spawn tool', () => {
- it('markers older than eight days expire', () => {
- it('a stale or future-dated pending mark approves nothing, and a pending mark is spent once', () => {
- it('a future-dated approval marker is no approval', () => {
- describe('claimOnce', () => {
- it('is true exactly once per key and prunes claims older than eight days', () => {
- describe('readBillingClass', () => {
- it('reads presence, never values', () => {
- it('an apiKeyHelper in a host settings file is metered', () => {
