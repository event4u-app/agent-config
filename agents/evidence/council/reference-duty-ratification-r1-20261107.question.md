<!-- evidence-type: analysis -->

# Ratification review — the read ledger observes the reference duty — round 1

You are an independent reviewer for a change in the `event4u/agent-config` repository. Two files in it, `src/scripts/hook_manifest.yaml` and its compiled twin `src/scripts/hook_manifest.json`, are hook plumbing on the ratification gate's list, so the change needs a two-provider verdict under ADR-268 § 4: an agent may change hook plumbing but may not ratify its own change.

subject: 8da58644154f36fbdf93778a4c7f542f9a65aae30b964c1dcd57aaa4385b52cd

(The digest covers the gated files at commit `2bc9115f0d`, computed with `./scripts-run src/scripts/ratification_subject`.)

## What the change does

- `reread-guard` (an advisory `pre_tool_use` concern that never blocks and never exits 1) now also runs on `Bash`, where it records a plain `cat <absolute file>` as a full read, and is bound on claude `pre_compact`, where it deletes the session's read ledger.
- Its ledger key includes `agent_id` when the payload carries one, so a subagent's reads never satisfy the parent's.
- On Edit/Write it records, observe-only, which `load_context` references the rules whose path/file trigger matches require, and whether the ledger holds a full read of each. Nothing is injected into context and nothing is blocked.
- Reads under exempt paths (`dist/**` etc.) are now recorded without an advisory.
- Bench: per-trial hook events are recorded from stream-json, and a map-set trial whose hooks broke its arm's expectation is marked `instrument-invalid`.

## Answer each question, by number

1. What behaviour changes, including what follows from it that the diff does not state?
2. Which authority or safety boundary becomes wider or narrower, and in which direction?
3. Does the change weaken anything that judges it — a test, a gate, a threshold, this review? The standard is quoted rather than paraphrased: the implementer never silently weakens an assertion, deletes, skips or xfails a failing test, lowers a threshold, or changes fixture semantics to fit the code. Does this change do any of those?
4. Is another host or projection left as a way around the control this change touches?
5. Can it be undone, and how — by whom, with what authority, and against which revision?
6. What observation would show the claimed benefit to be false, and what rollback / kill-switch criteria does the change omit?
7. Would a smaller change do, and what does the larger one buy that the smaller one does not?
8. What does it add to standing instruction weight that every later session pays?
9. Could untrusted content steer the path this change opens, and what bounds it if so?

End with exactly one line in this form:
`STANCE: <ratified|confirmed-non-expanding|refused> | CONFIDENCE: <high|med|low> | DEALBREAKER: <yes|no>`

## The diff (`git diff origin/main...feat/reference-duty`, code and manifest)

```diff
diff --git a/internal/bench/core/bench_ab_task_runner.ts b/internal/bench/core/bench_ab_task_runner.ts
index 53d8ccf5bd..3aef9baf09 100644
--- a/internal/bench/core/bench_ab_task_runner.ts
+++ b/internal/bench/core/bench_ab_task_runner.ts
@@ -206,6 +206,56 @@ interface RunResult {
     subtype?: string;
     /** The raw stream-json events, present only when the run asked for `stream`. */
     stream?: string;
+    /** Responded hooks per host event, read from `stream`; absent without one. */
+    hook_events?: Record<string, number>;
+    /** Whether the hooks seen match what the arm's setting sources load. */
+    hook_instrument?: HookInstrument;
+}
+
+export type HookInstrument = 'ok' | 'no-hook-event' | 'unexpected-hook-event';
+
+/**
+ * Responded hooks per host event in a stream-json run. A hook surfaces as a
+ * `system` event, `hook_started` then `hook_response`; the response is counted
+ * whatever its outcome, because the question is whether the hook ran.
+ */
+export function hookEventsFromStream(stdout: string): Record<string, number> {
+    const counts: Record<string, number> = {};
+    for (const line of stdout.split('\n')) {
+        if (!line.includes('"hook_response"')) continue;
+        let ev: unknown;
+        try {
+            ev = JSON.parse(line);
+        } catch {
+            continue;
+        }
+        if (typeof ev !== 'object' || ev === null) continue;
+        const e = ev as Record<string, unknown>;
+        if (e['type'] !== 'system' || e['subtype'] !== 'hook_response') continue;
+        const name = typeof e['hook_event'] === 'string' ? e['hook_event'] : '?';
+        counts[name] = (counts[name] ?? 0) + 1;
+    }
+    return counts;
+}
+
+/**
+ * Whether an arm's hooks should fire: it loads user settings (`setting_sources`
+ * null), or it installs the package into its clone and says so with
+ * `expect_hooks`. Setting sources alone cannot tell a bare `project,local` arm
+ * from one whose clone carries project-level hooks.
+ */
+export function expectsHooks(opts: { setting_sources?: string | null; expect_hooks?: boolean }): boolean {
+    return opts.expect_hooks ?? (opts.setting_sources ?? null) === null;
+}
+
+/**
+ * Only `SessionStart` hooks are known to surface in the stream; the other
+ * events are not evidence either way, so the check is "any hook seen".
+ */
+export function hookInstrument(events: Record<string, number>, expectHooks: boolean): HookInstrument {
+    const seen = Object.values(events).some((n) => n > 0);
+    if (expectHooks) return seen ? 'ok' : 'no-hook-event';
+    return seen ? 'unexpected-hook-event' : 'ok';
 }
 
 export interface RunLiveOpts {
@@ -229,6 +279,8 @@ export interface RunLiveOpts {
     env?: Record<string, string> | null;
     /** `--output-format stream-json --verbose`: every event, kept as `stream` on the result for a trace. */
     stream?: boolean;
+    /** The arm installs hooks into its clone; overrides the setting-sources default. */
+    expect_hooks?: boolean;
     /** Run inside this image instead of on the host (`_lib/bench_ab_container.ts`); implies `stream`. */
     container?: (ContainerSpec & { token: string }) | null;
 }
@@ -454,10 +506,15 @@ export function run_live(
         errored: isError || returncode !== 0,
         num_turns: numTurns,
         subtype,
-        ...(opts.stream ? { stream: stdout } : {}),
+        ...(opts.stream ? streamFields(stdout, expectsHooks(opts)) : {}),
     };
 }
 
+function streamFields(stdout: string, expectHooks: boolean): Pick<RunResult, 'stream' | 'hook_events' | 'hook_instrument'> {
+    const hook_events = hookEventsFromStream(stdout);
+    return { stream: stdout, hook_events, hook_instrument: hookInstrument(hook_events, expectHooks) };
+}
+
 /** Record what would have run; produce a deterministic stub transcript. */
 export function run_dry(task: Record<string, unknown>, cloneRoot: string, variant: string): RunResult {
     const stubTranscript =
diff --git a/internal/bench/core/bench_map_task_set.ts b/internal/bench/core/bench_map_task_set.ts
index d77a88cd97..12d0025f01 100644
--- a/internal/bench/core/bench_map_task_set.ts
+++ b/internal/bench/core/bench_map_task_set.ts
@@ -298,12 +298,18 @@ export function run_trial(task: MapTask, arm: string, opts: TrialOpts): MapTrial
             max_budget: opts.max_budget,
             model: opts.model,
             stream: true,
+            expect_hooks: spec.install !== null,
         }) as unknown as Dict;
         trace = parseTrace(String(run['stream'] ?? ''), { wall_s: Number(run['wall_time_seconds'] ?? 0), ac_version: acVersion(spec), payload: spec.inject, clone });
         transcript = String(run['transcript'] ?? '');
         breakdown = (run['tokens_breakdown'] ?? {}) as TokensBreakdown | Record<string, never>;
         errored = Boolean(run['errored']);
         reason = run['reason'] === undefined || run['reason'] === null ? null : String(run['reason']);
+        // A trial whose hooks did not do what its arm promises measured another arm.
+        if (run['hook_instrument'] !== undefined && run['hook_instrument'] !== 'ok') {
+            errored = true;
+            reason = `instrument-invalid: ${String(run['hook_instrument'])}`;
+        }
     }
     const check = evaluate_hidden_check(task, clone);
     return {
diff --git a/src/scripts/_lib/reference_duty.ts b/src/scripts/_lib/reference_duty.ts
new file mode 100644
index 0000000000..cbf5887a59
--- /dev/null
+++ b/src/scripts/_lib/reference_duty.ts
@@ -0,0 +1,81 @@
+/**
+ * The reference duty, observed at a file act: which `load_context` references
+ * the rules triggered by a path require, and whether the session's read ledger
+ * shows each one read whole. Observation only — it injects nothing and blocks
+ * nothing; whether a gate is worth its cost is measured before one exists.
+ */
+import * as fs from 'node:fs';
+import * as path from 'node:path';
+
+import { allTierRules, ruleSources } from './rule_injection.js';
+import type { Router } from './router_match.js';
+
+export interface Duty {
+    rule: string;
+    /** As the rule writes it — relative to the rule file, e.g. `../contexts/x.md`. */
+    reference: string;
+    /** Workspace-relative path the reference resolves to, the form ledger keys take. */
+    resolved: string;
+}
+
+export type DutyState = 'read' | 'required-pending';
+
+/** A basename glob (`*` only), the shape `file_pattern` triggers use. */
+export function globMatches(pattern: string, relPath: string): boolean {
+    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
+    return new RegExp(`^${escaped}$`).test(path.basename(relPath));
+}
+
+function loadContextOf(ruleFile: string): string[] {
+    let text: string;
+    try {
+        text = fs.readFileSync(ruleFile, 'utf8');
+    } catch {
+        return [];
+    }
+    if (!text.startsWith('---')) return [];
+    const end = text.indexOf('\n---', 3);
+    const fm = end === -1 ? '' : text.slice(3, end);
+    const block = /^load_context:\s*\n((?:[ \t]*-[^\n]*\n?)+)/m.exec(fm);
+    if (block === null) return [];
+    return (block[1] ?? '')
+        .split('\n')
+        .map((l) => l.replace(/^\s*-\s*/, '').trim().replace(/^["']|["']$/g, ''))
+        .filter((l) => l !== '');
+}
+
+/** References required by the rules whose path or file trigger matches `relPath`. */
+export function dutyForPath(relPath: string, workspaceRoot: string): Duty[] {
+    const sources = ruleSources(workspaceRoot);
+    if (sources.router === null) return [];
+    let router: Router;
+    try {
+        router = JSON.parse(fs.readFileSync(sources.router, 'utf8')) as Router;
+    } catch {
+        return [];
+    }
+    const out: Duty[] = [];
+    for (const rule of allTierRules(router)) {
+        const hit = rule.triggers.some((t) => {
+            const tr = t as Record<string, unknown>;
+            if (typeof tr['path_prefix'] === 'string') return relPath.startsWith(tr['path_prefix']);
+            if (typeof tr['file_pattern'] === 'string') return globMatches(tr['file_pattern'], relPath);
+            return false;
+        });
+        if (!hit) continue;
+        const dir = sources.dirs.find((d) => fs.existsSync(path.join(d, `${rule.id}.md`)));
+        if (dir === undefined) continue;
+        for (const reference of loadContextOf(path.join(dir, `${rule.id}.md`))) {
+            const resolved = path.relative(workspaceRoot, path.resolve(dir, reference));
+            out.push({ rule: rule.id, reference, resolved });
+        }
+    }
+    return out;
+}
+
+/** `read` when the ledger holds a full read of the path the reference resolves to. */
+export function dutyStates(duties: readonly Duty[], reads: Readonly<Record<string, unknown>>): Record<string, DutyState> {
+    const states: Record<string, DutyState> = {};
+    for (const d of duties) states[`${d.rule}::${d.reference}`] = Object.hasOwn(reads, d.resolved) ? 'read' : 'required-pending';
+    return states;
+}
diff --git a/src/scripts/hook_manifest.json b/src/scripts/hook_manifest.json
index 7e359bbff4..d3a47815ff 100644
--- a/src/scripts/hook_manifest.json
+++ b/src/scripts/hook_manifest.json
@@ -1 +1 @@
-{"fingerprint":"405f4941b3b55dd63a2e84f275b130860762450a56ee7b947e67070122c71ba7:119627","body_fingerprint":"148b5c38bfb189cef0e17b3a64664a00bd0a1f7c30f0bc5abc3caba743b345d8:22876","manifest":{"schema_version":1,"concerns":{"chat-history":{"script":"src/scripts/chat_history.ts","args":["hook-dispatch"],"fail_closed":false,"severity":"advisory","effect":"telemetry","needs_payload_bodies":["result"]},"hot-context":{"script":"src/scripts/hot_context_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"memory"},"handoff-context":{"script":"src/scripts/handoff_context_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"context"},"roadmap-progress":{"script":"src/scripts/roadmap_progress_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"formatting","needs_payload_bodies":["input"]},"onboarding-gate":{"script":"src/scripts/onboarding_gate_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"notification"},"context-hygiene":{"script":"src/scripts/context_hygiene_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"telemetry"},"verify-before-complete":{"script":"src/scripts/before_complete_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"verification","needs_payload_bodies":["input","result"]},"ship-diff-volume":{"script":"src/scripts/hooks/ship_diff_volume_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"verification","needs_payload_bodies":["input"]},"minimal-safe-diff":{"script":"src/scripts/minimal_safe_diff_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"verification","needs_payload_bodies":["input"]},"injection-scan":{"script":"src/scripts/injection_scan_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"verification","needs_payload_bodies":["input","result"]},"block-no-verify":{"script":"src/scripts/hooks/block_no_verify.ts","args":[],"fail_closed":true,"severity":"blocking","effect":"permission","needs_payload_bodies":["input"]},"block-kernel-rule-writes":{"script":"src/scripts/hooks/block_kernel_rule_writes.ts","args":[],"fail_closed":true,"severity":"blocking","effect":"permission","needs_payload_bodies":["input"]},"block-plumbing-writes":{"script":"src/scripts/hooks/block_plumbing_writes.ts","args":[],"fail_closed":true,"severity":"blocking","effect":"permission","needs_payload_bodies":["input"]},"one-question-per-ask":{"script":"src/scripts/hooks/one_question_per_ask_hook.ts","args":[],"fail_closed":false,"severity":"blocking","effect":"permission","tools":["AskUserQuestion","AskQuestion","UserQuestion","ask_user_question","ask_question","user_question"],"needs_payload_bodies":["input"]},"block-speaking-inbox-dir":{"script":"src/scripts/hooks/block_speaking_inbox_dir.ts","args":[],"fail_closed":false,"severity":"blocking","effect":"permission","needs_payload_bodies":["input"]},"block-credential-reads":{"script":"src/scripts/hooks/block_credential_reads.ts","args":[],"fail_closed":false,"severity":"blocking","effect":"permission","needs_payload_bodies":["input"]},"block-config-weakening":{"script":"src/scripts/hooks/block_config_weakening.ts","args":[],"fail_closed":false,"severity":"blocking","effect":"permission","needs_payload_bodies":["input"]},"rtk-wrap":{"script":"src/scripts/hooks/rtk_wrap_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"formatting","needs_payload_bodies":["input"]},"design-slop":{"script":"src/scripts/hooks/design_slop_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"verification","needs_payload_bodies":["input"]},"design-pass":{"script":"src/scripts/hooks/design_pass_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"notification","needs_payload_bodies":["input"]},"design-pass-stop":{"script":"src/scripts/hooks/design_pass_hook.ts","args":["--slot","stop"],"fail_closed":false,"severity":"advisory","effect":"notification"},"ui-route-nudge":{"script":"src/scripts/hooks/ui_route_nudge_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"notification","needs_payload_bodies":["input"]},"suggestion-capture":{"script":"src/scripts/hooks/suggestion_capture_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"telemetry"},"chain-nudge":{"script":"src/scripts/hooks/chain_nudge_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"notification","needs_payload_bodies":["input"]},"code-graph-context":{"script":"src/scripts/hooks/code_graph_context_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"context","tools":["Grep","Glob","Read","Bash"],"needs_payload_bodies":["input"]},"memory-learn":{"script":"src/scripts/memory_learn_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"memory"},"first-run-gate":{"script":"src/scripts/first_run_gate_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"notification"},"profile-staleness":{"script":"src/scripts/profile_staleness_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"notification"},"wrapper-freshness":{"script":"src/scripts/wrapper_freshness_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"notification"},"update-notice":{"script":"src/scripts/update_notice_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"notification"},"star-ask":{"script":"src/scripts/star_ask_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"notification"},"quota-notice":{"script":"src/scripts/quota_notice_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"notification"},"metered-spawn-ask":{"script":"src/scripts/quota_notice_hook.ts","args":["--ask"],"fail_closed":false,"severity":"advisory","effect":"confirmation","tools":["Agent","Task"]},"surface-probe":{"script":"src/scripts/surface_probe_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"telemetry"},"team-review-gate":{"script":"src/scripts/team_review_gate_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"verification"},"pr-url-reminder":{"script":"src/scripts/pr_url_reminder_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"notification","needs_payload_bodies":["input","result"]},"push-settle":{"script":"src/scripts/hooks/push_settle_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"verification","needs_payload_bodies":["input","result"]},"language-mirror":{"script":"src/scripts/language_mirror_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"context"},"git-authorization":{"script":"src/scripts/git_authorization_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"verification"},"evidence-independence":{"script":"src/scripts/hooks/evidence_independence.ts","args":[],"fail_closed":false,"severity":"blocking","effect":"permission","needs_payload_bodies":["input"]},"session-canary":{"script":"src/scripts/session_canary_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"context"},"council-availability":{"script":"src/scripts/council_availability_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"verification"},"telemetry-disclosure":{"script":"src/scripts/telemetry_disclosure_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"notification"},"telemetry-flush":{"script":"src/scripts/hooks/telemetry_flush_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"telemetry"},"self-repair":{"script":"src/scripts/self_repair_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"telemetry"},"session-register":{"script":"src/scripts/session_register_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"telemetry"},"orchestration-record":{"script":"src/scripts/hooks/orchestration_record_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"telemetry","tools":["Agent","Task"],"needs_payload_bodies":["input","result"]},"telemetry-usage":{"script":"src/scripts/hooks/telemetry_usage_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"telemetry","tools":["Skill"],"needs_payload_bodies":["input"]},"mcp-usage-observation":{"script":"src/scripts/hooks/mcp_usage_observation_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"telemetry"},"delegation-nudge":{"script":"src/scripts/hooks/delegation_nudge_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"notification","nudge_rank":1},"skill-route":{"script":"src/scripts/hooks/skill_route_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"context","nudge_rank":2},"intake-pass":{"script":"src/scripts/hooks/intake_pass_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"context"},"rule-inject":{"script":"src/scripts/hooks/rule_inject_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"context","needs_payload_bodies":["input"]},"obligation-settle":{"script":"src/scripts/hooks/obligation_settle_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"verification"},"end-review-nudge":{"script":"src/scripts/hooks/end_review_nudge_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"notification","skip_on_refusal_retry":true},"review-baseline":{"script":"src/scripts/hooks/review_baseline_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"telemetry"},"turn-end-gate":{"script":"src/scripts/hooks/turn_end_gate_hook.ts","args":[],"fail_closed":false,"severity":"blocking","effect":"permission"},"comment-discipline":{"script":"src/scripts/hooks/comment_discipline_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"verification","tools":["Write","Edit"],"needs_payload_bodies":["input"]},"edit-shape":{"script":"src/scripts/hooks/edit_shape_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"verification","tools":["Write"],"needs_payload_bodies":["input"]},"reread-guard":{"script":"src/scripts/hooks/reread_guard_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"verification","tools":["Read","Edit","Write"],"needs_payload_bodies":["input"]},"memory-recall":{"script":"src/scripts/hooks/memory_recall_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"memory","tools":["Bash","Edit","Write","MultiEdit","str-replace-editor","save-file","launch-process"],"needs_payload_bodies":["input"]},"session-eol":{"script":"src/scripts/hooks/session_eol_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"notification"},"interruption-ledger":{"script":"src/scripts/hooks/interruption_ledger_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"telemetry","skip_on_refusal_retry":true},"instructions-observer":{"script":"src/scripts/hooks/instructions_observer_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"telemetry"},"code-graph-refresh":{"script":"src/scripts/hooks/code_graph_refresh_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"execution"},"layer-promote":{"script":"src/scripts/hooks/layer_promotion_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"execution"},"subagent-constraints":{"script":"src/scripts/hooks/subagent_constraints_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"context"},"subagent-ledger":{"script":"src/scripts/hooks/subagent_ledger_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"telemetry"},"tool-result-bytes":{"script":"src/scripts/hooks/tool_result_bytes_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"telemetry"},"spawn-guard-shadow":{"script":"src/scripts/hooks/spawn_guard_shadow_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"telemetry","tools":["Agent","Task","SendMessage"],"needs_payload_bodies":["input","result"],"payload_fields":["name","subagent_type","to","recipient_kind","agentId"]},"host-rate-marker":{"script":"src/scripts/hooks/host_rate_marker_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"telemetry"},"memory-audience-shadow":{"script":"src/scripts/hooks/memory_audience_shadow_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"telemetry","tools":["Agent","Task","Write","Edit","MultiEdit"],"needs_payload_bodies":["input"],"payload_fields":["prompt","file_path","path"]},"source-first-gate":{"script":"src/scripts/hooks/source_first_gate_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"telemetry","needs_payload_bodies":["input"]},"journal-record":{"script":"src/scripts/hooks/journal_record_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"telemetry"}},"roles":{"worker":{"drop":["delegation-nudge","skill-route","intake-pass","end-review-nudge","review-baseline","council-availability","team-review-gate","self-repair","session-eol","interruption-ledger"]}},"platforms":{"augment":{"ask":"text","session_start":["chat-history","hot-context","handoff-context","session-canary","council-availability","telemetry-disclosure","first-run-gate","onboarding-gate","verify-before-complete","minimal-safe-diff","profile-staleness","wrapper-freshness","surface-probe","session-register","code-graph-refresh"],"session_end":["chat-history","memory-learn","session-register","roadmap-progress","telemetry-flush"],"stop":["chat-history","verify-before-complete","self-repair","session-register","roadmap-progress","design-pass-stop","code-graph-refresh"],"pre_tool_use":["block-no-verify","evidence-independence","block-kernel-rule-writes","block-plumbing-writes","block-config-weakening","block-speaking-inbox-dir","block-credential-reads","rtk-wrap","design-slop","ui-route-nudge","code-graph-context","chain-nudge","ship-diff-volume","reread-guard","memory-recall"],"post_tool_use":["chat-history","roadmap-progress","context-hygiene","verify-before-complete","minimal-safe-diff","injection-scan","pr-url-reminder","push-settle","orchestration-record","telemetry-usage","mcp-usage-observation","tool-result-bytes","edit-shape","comment-discipline","design-pass"]},"claude":{"ask":"native","session_start":["chat-history","hot-context","handoff-context","session-canary","council-availability","telemetry-disclosure","first-run-gate","onboarding-gate","verify-before-complete","minimal-safe-diff","profile-staleness","wrapper-freshness","update-notice","star-ask","surface-probe","session-register","review-baseline","journal-record","rule-inject","code-graph-refresh","layer-promote"],"session_end":["chat-history","memory-learn","session-register","roadmap-progress","telemetry-flush","journal-record"],"stop":["chat-history","verify-before-complete","team-review-gate","end-review-nudge","obligation-settle","turn-end-gate","self-repair","session-register","session-eol","interruption-ledger","roadmap-progress","design-pass-stop","suggestion-capture","code-graph-refresh","journal-record"],"user_prompt_submit":["chat-history","verify-before-complete","minimal-safe-diff","language-mirror","delegation-nudge","skill-route","git-authorization","session-canary","self-repair","session-register","rule-inject","suggestion-capture","journal-record","quota-notice","intake-pass"],"pre_tool_use":["block-no-verify","evidence-independence","block-kernel-rule-writes","block-plumbing-writes","block-config-weakening","block-speaking-inbox-dir","block-credential-reads","one-question-per-ask","rtk-wrap","design-slop","ui-route-nudge","code-graph-context","chain-nudge","ship-diff-volume","reread-guard","spawn-guard-shadow","metered-spawn-ask","source-first-gate","memory-recall","memory-audience-shadow"],"post_tool_use":["chat-history","roadmap-progress","context-hygiene","verify-before-complete","minimal-safe-diff","injection-scan","pr-url-reminder","push-settle","orchestration-record","telemetry-usage","mcp-usage-observation","tool-result-bytes","edit-shape","comment-discipline","language-mirror","design-pass","journal-record","spawn-guard-shadow","metered-spawn-ask"],"pre_compact":["language-mirror","rule-inject","journal-record"],"subagent_start":["subagent-ledger","journal-record","subagent-constraints"],"subagent_stop":["subagent-ledger","journal-record"],"agent_error":["host-rate-marker"],"instructions_loaded":["instructions-observer"]},"cowork":{"ask":"text","session_start":["chat-history","hot-context","handoff-context","session-canary","council-availability","telemetry-disclosure","first-run-gate","onboarding-gate","verify-before-complete","minimal-safe-diff","profile-staleness","wrapper-freshness","surface-probe","session-register","code-graph-refresh"],"session_end":["chat-history","memory-learn","session-register","roadmap-progress","telemetry-flush"],"stop":["chat-history","verify-before-complete","self-repair","session-register","roadmap-progress","design-pass-stop","code-graph-refresh"],"user_prompt_submit":["chat-history","verify-before-complete","minimal-safe-diff","language-mirror","git-authorization","session-canary","self-repair","session-register","intake-pass"],"pre_tool_use":["block-no-verify","evidence-independence","block-kernel-rule-writes","block-plumbing-writes","block-config-weakening","block-speaking-inbox-dir","block-credential-reads","rtk-wrap","design-slop","ui-route-nudge","code-graph-context","chain-nudge","ship-diff-volume","reread-guard","spawn-guard-shadow","source-first-gate","memory-recall"],"post_tool_use":["chat-history","roadmap-progress","context-hygiene","verify-before-complete","minimal-safe-diff","injection-scan","pr-url-reminder","push-settle","orchestration-record","telemetry-usage","mcp-usage-observation","tool-result-bytes","edit-shape","comment-discipline","design-pass","spawn-guard-shadow"],"subagent_start":["subagent-ledger"],"subagent_stop":["subagent-ledger"]},"cursor":{"ask":"text","session_start":["chat-history","hot-context","handoff-context","session-canary","council-availability","telemetry-disclosure","first-run-gate","onboarding-gate","verify-before-complete","minimal-safe-diff","profile-staleness","wrapper-freshness","surface-probe","session-register","code-graph-refresh"],"session_end":["chat-history","memory-learn","session-register","roadmap-progress","telemetry-flush"],"stop":["chat-history","verify-before-complete","self-repair","session-register","roadmap-progress","design-pass-stop","code-graph-refresh"],"user_prompt_submit":["chat-history","verify-before-complete","minimal-safe-diff","language-mirror","git-authorization","session-canary","self-repair","session-register","intake-pass"],"post_tool_use":["chat-history","roadmap-progress","context-hygiene","verify-before-complete","minimal-safe-diff","injection-scan","pr-url-reminder","push-settle","orchestration-record","telemetry-usage","mcp-usage-observation","tool-result-bytes","edit-shape","comment-discipline","design-pass"]},"cline":{"ask":"text","session_start":["chat-history","hot-context","handoff-context","session-canary","council-availability","telemetry-disclosure","first-run-gate","onboarding-gate","verify-before-complete","minimal-safe-diff","profile-staleness","wrapper-freshness","surface-probe","session-register","code-graph-refresh"],"session_end":["chat-history","memory-learn","session-register","roadmap-progress","telemetry-flush"],"stop":["chat-history","verify-before-complete","self-repair","session-register","roadmap-progress","design-pass-stop","code-graph-refresh"],"user_prompt_submit":["chat-history","verify-before-complete","minimal-safe-diff","language-mirror","git-authorization","session-canary","self-repair","session-register","intake-pass"],"post_tool_use":["chat-history","roadmap-progress","context-hygiene","verify-before-complete","minimal-safe-diff","injection-scan","pr-url-reminder","push-settle","orchestration-record","telemetry-usage","mcp-usage-observation","tool-result-bytes","edit-shape","comment-discipline","design-pass"]},"windsurf":{"ask":"text","session_start":["chat-history","hot-context","handoff-context","session-canary","council-availability","telemetry-disclosure","first-run-gate","onboarding-gate","verify-before-complete","profile-staleness","wrapper-freshness","surface-probe","session-register","code-graph-refresh"]},"gemini":{"ask":"text","session_start":["chat-history","hot-context","handoff-context","session-canary","council-availability","telemetry-disclosure","first-run-gate","onboarding-gate","verify-before-complete","minimal-safe-diff","profile-staleness","wrapper-freshness","surface-probe","session-register","code-graph-refresh"],"session_end":["chat-history","memory-learn","session-register","roadmap-progress","telemetry-flush"],"stop":["chat-history","verify-before-complete","self-repair","session-register","roadmap-progress","design-pass-stop","code-graph-refresh"],"user_prompt_submit":["chat-history","verify-before-complete","minimal-safe-diff","language-mirror","git-authorization","session-canary","self-repair","session-register","intake-pass"],"post_tool_use":["chat-history","roadmap-progress","context-hygiene","verify-before-complete","minimal-safe-diff","injection-scan","pr-url-reminder","push-settle","orchestration-record","telemetry-usage","mcp-usage-observation","tool-result-bytes","edit-shape","comment-discipline","design-pass"]},"copilot":{"ask":"text","fallback_only":true}},"native_event_aliases":{"augment":{"SessionStart":"session_start","SessionEnd":"session_end","Stop":"stop","PostToolUse":"post_tool_use","PreToolUse":"pre_tool_use"},"claude":{"SessionStart":"session_start","SessionEnd":"session_end","Stop":"stop","UserPromptSubmit":"user_prompt_submit","PostToolUse":"post_tool_use","PostToolUseFailure":"post_tool_use","PreToolUse":"pre_tool_use","PreCompact":"pre_compact","SubagentStart":"subagent_start","SubagentStop":"subagent_stop","InstructionsLoaded":"instructions_loaded","StopFailure":"agent_error"},"cowork":{"SessionStart":"session_start","SessionEnd":"session_end","Stop":"stop","UserPromptSubmit":"user_prompt_submit","PostToolUse":"post_tool_use","PreToolUse":"pre_tool_use","PreCompact":"pre_compact","SubagentStart":"subagent_start","SubagentStop":"subagent_stop"},"cursor":{"sessionStart":"session_start","sessionEnd":"session_end","stop":"stop","beforeSubmitPrompt":"user_prompt_submit","postToolUse":"post_tool_use","preToolUse":"pre_tool_use","preCompact":"pre_compact"},"cline":{"TaskStart":"session_start","TaskResume":"session_start","TaskComplete":"session_end","TaskCancel":"stop","UserPromptSubmit":"user_prompt_submit","PostToolUse":"post_tool_use","PreToolUse":"pre_tool_use","PreCompact":"pre_compact"},"windsurf":{"pre_user_prompt":"user_prompt_submit","post_cascade_response":"stop","post_setup_worktree":"session_start"},"gemini":{"SessionStart":"session_start","SessionEnd":"session_end","BeforeAgent":"user_prompt_submit","AfterAgent":"stop","BeforeTool":"pre_tool_use","AfterTool":"post_tool_use"}},"native_event_min_host_version":{"claude":{"StopFailure":"2.1.308"}}}}
\ No newline at end of file
+{"fingerprint":"f6a5b074de0ffca932dec9ca249bcea42719c9233092970f9345c00fbc4c1c59:119734","body_fingerprint":"6f892e56f349a8de680b3d69b384d8a6a29dec6a87cd75357e5658004653f317:22898","manifest":{"schema_version":1,"concerns":{"chat-history":{"script":"src/scripts/chat_history.ts","args":["hook-dispatch"],"fail_closed":false,"severity":"advisory","effect":"telemetry","needs_payload_bodies":["result"]},"hot-context":{"script":"src/scripts/hot_context_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"memory"},"handoff-context":{"script":"src/scripts/handoff_context_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"context"},"roadmap-progress":{"script":"src/scripts/roadmap_progress_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"formatting","needs_payload_bodies":["input"]},"onboarding-gate":{"script":"src/scripts/onboarding_gate_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"notification"},"context-hygiene":{"script":"src/scripts/context_hygiene_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"telemetry"},"verify-before-complete":{"script":"src/scripts/before_complete_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"verification","needs_payload_bodies":["input","result"]},"ship-diff-volume":{"script":"src/scripts/hooks/ship_diff_volume_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"verification","needs_payload_bodies":["input"]},"minimal-safe-diff":{"script":"src/scripts/minimal_safe_diff_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"verification","needs_payload_bodies":["input"]},"injection-scan":{"script":"src/scripts/injection_scan_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"verification","needs_payload_bodies":["input","result"]},"block-no-verify":{"script":"src/scripts/hooks/block_no_verify.ts","args":[],"fail_closed":true,"severity":"blocking","effect":"permission","needs_payload_bodies":["input"]},"block-kernel-rule-writes":{"script":"src/scripts/hooks/block_kernel_rule_writes.ts","args":[],"fail_closed":true,"severity":"blocking","effect":"permission","needs_payload_bodies":["input"]},"block-plumbing-writes":{"script":"src/scripts/hooks/block_plumbing_writes.ts","args":[],"fail_closed":true,"severity":"blocking","effect":"permission","needs_payload_bodies":["input"]},"one-question-per-ask":{"script":"src/scripts/hooks/one_question_per_ask_hook.ts","args":[],"fail_closed":false,"severity":"blocking","effect":"permission","tools":["AskUserQuestion","AskQuestion","UserQuestion","ask_user_question","ask_question","user_question"],"needs_payload_bodies":["input"]},"block-speaking-inbox-dir":{"script":"src/scripts/hooks/block_speaking_inbox_dir.ts","args":[],"fail_closed":false,"severity":"blocking","effect":"permission","needs_payload_bodies":["input"]},"block-credential-reads":{"script":"src/scripts/hooks/block_credential_reads.ts","args":[],"fail_closed":false,"severity":"blocking","effect":"permission","needs_payload_bodies":["input"]},"block-config-weakening":{"script":"src/scripts/hooks/block_config_weakening.ts","args":[],"fail_closed":false,"severity":"blocking","effect":"permission","needs_payload_bodies":["input"]},"rtk-wrap":{"script":"src/scripts/hooks/rtk_wrap_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"formatting","needs_payload_bodies":["input"]},"design-slop":{"script":"src/scripts/hooks/design_slop_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"verification","needs_payload_bodies":["input"]},"design-pass":{"script":"src/scripts/hooks/design_pass_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"notification","needs_payload_bodies":["input"]},"design-pass-stop":{"script":"src/scripts/hooks/design_pass_hook.ts","args":["--slot","stop"],"fail_closed":false,"severity":"advisory","effect":"notification"},"ui-route-nudge":{"script":"src/scripts/hooks/ui_route_nudge_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"notification","needs_payload_bodies":["input"]},"suggestion-capture":{"script":"src/scripts/hooks/suggestion_capture_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"telemetry"},"chain-nudge":{"script":"src/scripts/hooks/chain_nudge_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"notification","needs_payload_bodies":["input"]},"code-graph-context":{"script":"src/scripts/hooks/code_graph_context_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"context","tools":["Grep","Glob","Read","Bash"],"needs_payload_bodies":["input"]},"memory-learn":{"script":"src/scripts/memory_learn_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"memory"},"first-run-gate":{"script":"src/scripts/first_run_gate_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"notification"},"profile-staleness":{"script":"src/scripts/profile_staleness_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"notification"},"wrapper-freshness":{"script":"src/scripts/wrapper_freshness_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"notification"},"update-notice":{"script":"src/scripts/update_notice_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"notification"},"star-ask":{"script":"src/scripts/star_ask_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"notification"},"quota-notice":{"script":"src/scripts/quota_notice_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"notification"},"metered-spawn-ask":{"script":"src/scripts/quota_notice_hook.ts","args":["--ask"],"fail_closed":false,"severity":"advisory","effect":"confirmation","tools":["Agent","Task"]},"surface-probe":{"script":"src/scripts/surface_probe_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"telemetry"},"team-review-gate":{"script":"src/scripts/team_review_gate_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"verification"},"pr-url-reminder":{"script":"src/scripts/pr_url_reminder_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"notification","needs_payload_bodies":["input","result"]},"push-settle":{"script":"src/scripts/hooks/push_settle_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"verification","needs_payload_bodies":["input","result"]},"language-mirror":{"script":"src/scripts/language_mirror_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"context"},"git-authorization":{"script":"src/scripts/git_authorization_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"verification"},"evidence-independence":{"script":"src/scripts/hooks/evidence_independence.ts","args":[],"fail_closed":false,"severity":"blocking","effect":"permission","needs_payload_bodies":["input"]},"session-canary":{"script":"src/scripts/session_canary_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"context"},"council-availability":{"script":"src/scripts/council_availability_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"verification"},"telemetry-disclosure":{"script":"src/scripts/telemetry_disclosure_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"notification"},"telemetry-flush":{"script":"src/scripts/hooks/telemetry_flush_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"telemetry"},"self-repair":{"script":"src/scripts/self_repair_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"telemetry"},"session-register":{"script":"src/scripts/session_register_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"telemetry"},"orchestration-record":{"script":"src/scripts/hooks/orchestration_record_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"telemetry","tools":["Agent","Task"],"needs_payload_bodies":["input","result"]},"telemetry-usage":{"script":"src/scripts/hooks/telemetry_usage_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"telemetry","tools":["Skill"],"needs_payload_bodies":["input"]},"mcp-usage-observation":{"script":"src/scripts/hooks/mcp_usage_observation_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"telemetry"},"delegation-nudge":{"script":"src/scripts/hooks/delegation_nudge_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"notification","nudge_rank":1},"skill-route":{"script":"src/scripts/hooks/skill_route_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"context","nudge_rank":2},"intake-pass":{"script":"src/scripts/hooks/intake_pass_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"context"},"rule-inject":{"script":"src/scripts/hooks/rule_inject_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"context","needs_payload_bodies":["input"]},"obligation-settle":{"script":"src/scripts/hooks/obligation_settle_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"verification"},"end-review-nudge":{"script":"src/scripts/hooks/end_review_nudge_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"notification","skip_on_refusal_retry":true},"review-baseline":{"script":"src/scripts/hooks/review_baseline_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"telemetry"},"turn-end-gate":{"script":"src/scripts/hooks/turn_end_gate_hook.ts","args":[],"fail_closed":false,"severity":"blocking","effect":"permission"},"comment-discipline":{"script":"src/scripts/hooks/comment_discipline_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"verification","tools":["Write","Edit"],"needs_payload_bodies":["input"]},"edit-shape":{"script":"src/scripts/hooks/edit_shape_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"verification","tools":["Write"],"needs_payload_bodies":["input"]},"reread-guard":{"script":"src/scripts/hooks/reread_guard_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"verification","tools":["Read","Edit","Write","Bash"],"needs_payload_bodies":["input"]},"memory-recall":{"script":"src/scripts/hooks/memory_recall_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"memory","tools":["Bash","Edit","Write","MultiEdit","str-replace-editor","save-file","launch-process"],"needs_payload_bodies":["input"]},"session-eol":{"script":"src/scripts/hooks/session_eol_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"notification"},"interruption-ledger":{"script":"src/scripts/hooks/interruption_ledger_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"telemetry","skip_on_refusal_retry":true},"instructions-observer":{"script":"src/scripts/hooks/instructions_observer_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"telemetry"},"code-graph-refresh":{"script":"src/scripts/hooks/code_graph_refresh_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"execution"},"layer-promote":{"script":"src/scripts/hooks/layer_promotion_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"execution"},"subagent-constraints":{"script":"src/scripts/hooks/subagent_constraints_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"context"},"subagent-ledger":{"script":"src/scripts/hooks/subagent_ledger_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"telemetry"},"tool-result-bytes":{"script":"src/scripts/hooks/tool_result_bytes_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"telemetry"},"spawn-guard-shadow":{"script":"src/scripts/hooks/spawn_guard_shadow_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"telemetry","tools":["Agent","Task","SendMessage"],"needs_payload_bodies":["input","result"],"payload_fields":["name","subagent_type","to","recipient_kind","agentId"]},"host-rate-marker":{"script":"src/scripts/hooks/host_rate_marker_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"telemetry"},"memory-audience-shadow":{"script":"src/scripts/hooks/memory_audience_shadow_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"telemetry","tools":["Agent","Task","Write","Edit","MultiEdit"],"needs_payload_bodies":["input"],"payload_fields":["prompt","file_path","path"]},"source-first-gate":{"script":"src/scripts/hooks/source_first_gate_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"telemetry","needs_payload_bodies":["input"]},"journal-record":{"script":"src/scripts/hooks/journal_record_hook.ts","args":[],"fail_closed":false,"severity":"advisory","effect":"telemetry"}},"roles":{"worker":{"drop":["delegation-nudge","skill-route","intake-pass","end-review-nudge","review-baseline","council-availability","team-review-gate","self-repair","session-eol","interruption-ledger"]}},"platforms":{"augment":{"ask":"text","session_start":["chat-history","hot-context","handoff-context","session-canary","council-availability","telemetry-disclosure","first-run-gate","onboarding-gate","verify-before-complete","minimal-safe-diff","profile-staleness","wrapper-freshness","surface-probe","session-register","code-graph-refresh"],"session_end":["chat-history","memory-learn","session-register","roadmap-progress","telemetry-flush"],"stop":["chat-history","verify-before-complete","self-repair","session-register","roadmap-progress","design-pass-stop","code-graph-refresh"],"pre_tool_use":["block-no-verify","evidence-independence","block-kernel-rule-writes","block-plumbing-writes","block-config-weakening","block-speaking-inbox-dir","block-credential-reads","rtk-wrap","design-slop","ui-route-nudge","code-graph-context","chain-nudge","ship-diff-volume","reread-guard","memory-recall"],"post_tool_use":["chat-history","roadmap-progress","context-hygiene","verify-before-complete","minimal-safe-diff","injection-scan","pr-url-reminder","push-settle","orchestration-record","telemetry-usage","mcp-usage-observation","tool-result-bytes","edit-shape","comment-discipline","design-pass"]},"claude":{"ask":"native","session_start":["chat-history","hot-context","handoff-context","session-canary","council-availability","telemetry-disclosure","first-run-gate","onboarding-gate","verify-before-complete","minimal-safe-diff","profile-staleness","wrapper-freshness","update-notice","star-ask","surface-probe","session-register","review-baseline","journal-record","rule-inject","code-graph-refresh","layer-promote"],"session_end":["chat-history","memory-learn","session-register","roadmap-progress","telemetry-flush","journal-record"],"stop":["chat-history","verify-before-complete","team-review-gate","end-review-nudge","obligation-settle","turn-end-gate","self-repair","session-register","session-eol","interruption-ledger","roadmap-progress","design-pass-stop","suggestion-capture","code-graph-refresh","journal-record"],"user_prompt_submit":["chat-history","verify-before-complete","minimal-safe-diff","language-mirror","delegation-nudge","skill-route","git-authorization","session-canary","self-repair","session-register","rule-inject","suggestion-capture","journal-record","quota-notice","intake-pass"],"pre_tool_use":["block-no-verify","evidence-independence","block-kernel-rule-writes","block-plumbing-writes","block-config-weakening","block-speaking-inbox-dir","block-credential-reads","one-question-per-ask","rtk-wrap","design-slop","ui-route-nudge","code-graph-context","chain-nudge","ship-diff-volume","reread-guard","spawn-guard-shadow","metered-spawn-ask","source-first-gate","memory-recall","memory-audience-shadow"],"post_tool_use":["chat-history","roadmap-progress","context-hygiene","verify-before-complete","minimal-safe-diff","injection-scan","pr-url-reminder","push-settle","orchestration-record","telemetry-usage","mcp-usage-observation","tool-result-bytes","edit-shape","comment-discipline","language-mirror","design-pass","journal-record","spawn-guard-shadow","metered-spawn-ask"],"pre_compact":["language-mirror","rule-inject","journal-record","reread-guard"],"subagent_start":["subagent-ledger","journal-record","subagent-constraints"],"subagent_stop":["subagent-ledger","journal-record"],"agent_error":["host-rate-marker"],"instructions_loaded":["instructions-observer"]},"cowork":{"ask":"text","session_start":["chat-history","hot-context","handoff-context","session-canary","council-availability","telemetry-disclosure","first-run-gate","onboarding-gate","verify-before-complete","minimal-safe-diff","profile-staleness","wrapper-freshness","surface-probe","session-register","code-graph-refresh"],"session_end":["chat-history","memory-learn","session-register","roadmap-progress","telemetry-flush"],"stop":["chat-history","verify-before-complete","self-repair","session-register","roadmap-progress","design-pass-stop","code-graph-refresh"],"user_prompt_submit":["chat-history","verify-before-complete","minimal-safe-diff","language-mirror","git-authorization","session-canary","self-repair","session-register","intake-pass"],"pre_tool_use":["block-no-verify","evidence-independence","block-kernel-rule-writes","block-plumbing-writes","block-config-weakening","block-speaking-inbox-dir","block-credential-reads","rtk-wrap","design-slop","ui-route-nudge","code-graph-context","chain-nudge","ship-diff-volume","reread-guard","spawn-guard-shadow","source-first-gate","memory-recall"],"post_tool_use":["chat-history","roadmap-progress","context-hygiene","verify-before-complete","minimal-safe-diff","injection-scan","pr-url-reminder","push-settle","orchestration-record","telemetry-usage","mcp-usage-observation","tool-result-bytes","edit-shape","comment-discipline","design-pass","spawn-guard-shadow"],"subagent_start":["subagent-ledger"],"subagent_stop":["subagent-ledger"]},"cursor":{"ask":"text","session_start":["chat-history","hot-context","handoff-context","session-canary","council-availability","telemetry-disclosure","first-run-gate","onboarding-gate","verify-before-complete","minimal-safe-diff","profile-staleness","wrapper-freshness","surface-probe","session-register","code-graph-refresh"],"session_end":["chat-history","memory-learn","session-register","roadmap-progress","telemetry-flush"],"stop":["chat-history","verify-before-complete","self-repair","session-register","roadmap-progress","design-pass-stop","code-graph-refresh"],"user_prompt_submit":["chat-history","verify-before-complete","minimal-safe-diff","language-mirror","git-authorization","session-canary","self-repair","session-register","intake-pass"],"post_tool_use":["chat-history","roadmap-progress","context-hygiene","verify-before-complete","minimal-safe-diff","injection-scan","pr-url-reminder","push-settle","orchestration-record","telemetry-usage","mcp-usage-observation","tool-result-bytes","edit-shape","comment-discipline","design-pass"]},"cline":{"ask":"text","session_start":["chat-history","hot-context","handoff-context","session-canary","council-availability","telemetry-disclosure","first-run-gate","onboarding-gate","verify-before-complete","minimal-safe-diff","profile-staleness","wrapper-freshness","surface-probe","session-register","code-graph-refresh"],"session_end":["chat-history","memory-learn","session-register","roadmap-progress","telemetry-flush"],"stop":["chat-history","verify-before-complete","self-repair","session-register","roadmap-progress","design-pass-stop","code-graph-refresh"],"user_prompt_submit":["chat-history","verify-before-complete","minimal-safe-diff","language-mirror","git-authorization","session-canary","self-repair","session-register","intake-pass"],"post_tool_use":["chat-history","roadmap-progress","context-hygiene","verify-before-complete","minimal-safe-diff","injection-scan","pr-url-reminder","push-settle","orchestration-record","telemetry-usage","mcp-usage-observation","tool-result-bytes","edit-shape","comment-discipline","design-pass"]},"windsurf":{"ask":"text","session_start":["chat-history","hot-context","handoff-context","session-canary","council-availability","telemetry-disclosure","first-run-gate","onboarding-gate","verify-before-complete","profile-staleness","wrapper-freshness","surface-probe","session-register","code-graph-refresh"]},"gemini":{"ask":"text","session_start":["chat-history","hot-context","handoff-context","session-canary","council-availability","telemetry-disclosure","first-run-gate","onboarding-gate","verify-before-complete","minimal-safe-diff","profile-staleness","wrapper-freshness","surface-probe","session-register","code-graph-refresh"],"session_end":["chat-history","memory-learn","session-register","roadmap-progress","telemetry-flush"],"stop":["chat-history","verify-before-complete","self-repair","session-register","roadmap-progress","design-pass-stop","code-graph-refresh"],"user_prompt_submit":["chat-history","verify-before-complete","minimal-safe-diff","language-mirror","git-authorization","session-canary","self-repair","session-register","intake-pass"],"post_tool_use":["chat-history","roadmap-progress","context-hygiene","verify-before-complete","minimal-safe-diff","injection-scan","pr-url-reminder","push-settle","orchestration-record","telemetry-usage","mcp-usage-observation","tool-result-bytes","edit-shape","comment-discipline","design-pass"]},"copilot":{"ask":"text","fallback_only":true}},"native_event_aliases":{"augment":{"SessionStart":"session_start","SessionEnd":"session_end","Stop":"stop","PostToolUse":"post_tool_use","PreToolUse":"pre_tool_use"},"claude":{"SessionStart":"session_start","SessionEnd":"session_end","Stop":"stop","UserPromptSubmit":"user_prompt_submit","PostToolUse":"post_tool_use","PostToolUseFailure":"post_tool_use","PreToolUse":"pre_tool_use","PreCompact":"pre_compact","SubagentStart":"subagent_start","SubagentStop":"subagent_stop","InstructionsLoaded":"instructions_loaded","StopFailure":"agent_error"},"cowork":{"SessionStart":"session_start","SessionEnd":"session_end","Stop":"stop","UserPromptSubmit":"user_prompt_submit","PostToolUse":"post_tool_use","PreToolUse":"pre_tool_use","PreCompact":"pre_compact","SubagentStart":"subagent_start","SubagentStop":"subagent_stop"},"cursor":{"sessionStart":"session_start","sessionEnd":"session_end","stop":"stop","beforeSubmitPrompt":"user_prompt_submit","postToolUse":"post_tool_use","preToolUse":"pre_tool_use","preCompact":"pre_compact"},"cline":{"TaskStart":"session_start","TaskResume":"session_start","TaskComplete":"session_end","TaskCancel":"stop","UserPromptSubmit":"user_prompt_submit","PostToolUse":"post_tool_use","PreToolUse":"pre_tool_use","PreCompact":"pre_compact"},"windsurf":{"pre_user_prompt":"user_prompt_submit","post_cascade_response":"stop","post_setup_worktree":"session_start"},"gemini":{"SessionStart":"session_start","SessionEnd":"session_end","BeforeAgent":"user_prompt_submit","AfterAgent":"stop","BeforeTool":"pre_tool_use","AfterTool":"post_tool_use"}},"native_event_min_host_version":{"claude":{"StopFailure":"2.1.308"}}}}
\ No newline at end of file
diff --git a/src/scripts/hook_manifest.yaml b/src/scripts/hook_manifest.yaml
index 6d4058a2bb..2e3404b4ad 100644
--- a/src/scripts/hook_manifest.yaml
+++ b/src/scripts/hook_manifest.yaml
@@ -1319,8 +1319,9 @@ concerns:
     fail_closed: false
     severity: advisory
     effect: verification
-    # Provable from the hook's own source: READ_TOOLS ∪ WRITE_TOOLS.
-    tools: [Read, Edit, Write]
+    # Provable from the hook's own source: READ_TOOLS ∪ WRITE_TOOLS, plus Bash
+    # for a whole-file `cat <file>` (wholeFileCatPath), which is a read too.
+    tools: [Read, Edit, Write, Bash]
     needs_payload_bodies: [input]
   # Memory recall — delivers a memory the store ALREADY holds, at the moment
   # the tool call it is about would run. The finding: in one long autonomous
@@ -1789,7 +1790,7 @@ platforms:
     # Claude Code transcript fact. (It was the ONLY binding on this slot until
     # the entry below; that sentence is retired rather than left to rot.)
     #
-    pre_compact:      [language-mirror, rule-inject, journal-record]
+    pre_compact:      [language-mirror, rule-inject, journal-record, reread-guard]
     # road-to-subagent-lifecycle-integrity Phase 1 Step 1. `claude` is the only
     # platform where both native events were measured present on the installed
     # binary (2.1.229 — see the evidence page cited on the alias rows below).
diff --git a/src/scripts/hooks/reread_guard_hook.ts b/src/scripts/hooks/reread_guard_hook.ts
index 8226236e61..276317b3c2 100644
--- a/src/scripts/hooks/reread_guard_hook.ts
+++ b/src/scripts/hooks/reread_guard_hook.ts
@@ -1,7 +1,11 @@
 #!/usr/bin/env node
 /**
  * Re-read guard + post-edit scope hint — `pre_tool_use` concern
- * (road-to-token-economy-cache Phase 6.1/6.2).
+ * (road-to-token-economy-cache Phase 6.1/6.2), also bound on `pre_compact`,
+ * where it clears the session's ledger: compaction drops what was read.
+ *
+ * A whole-file `cat <file>` through Bash counts as a full read, and a
+ * subagent's reads are keyed apart from its parent's (`agent_id`).
  *
  * Two signals, one session-scoped read ledger:
  *
@@ -72,6 +76,7 @@ import { unwrap, type JsonObject, type JsonValue } from './envelope.js';
 import { readHookStdin } from './hook_stdin.js';
 import { atomic_write_json } from './state_io.js';
 import { EXIT_ALLOW, EXIT_WARN } from './exit_codes.js';
+import { dutyForPath, dutyStates, type DutyState } from '../_lib/reference_duty.js';
 
 // Severity is taken from the EXIT CODE, not from the `decision` field — see
 // the file header for why this never blocks on `claude`. This concern never
@@ -191,6 +196,8 @@ export interface Ledger {
     writes: Record<string, number>;
     /** Per-path once-per-session advisory latch. */
     fired: Record<string, boolean>;
+    /** Reference duty observed at file acts, `rule::reference` → latest state. */
+    duty?: Record<string, { state: DutyState; ts: number }>;
 }
 
 function emptyLedger(): Ledger {
@@ -202,7 +209,9 @@ export function deriveSessionKey(envelope: JsonObject, payload: JsonObject): str
     const raw =
         str(envelope['session_id'] as JsonValue | undefined) ||
         str((payload['session_id'] ?? payload['sessionId']) as JsonValue | undefined);
-    const material = raw || 'unknown-session';
+    const agent = str((payload['agent_id'] ?? payload['agentId']) as JsonValue | undefined);
+    // A subagent reads into its own context, so its reads never satisfy the parent's.
+    const material = `${raw || 'unknown-session'}${agent ? `::${agent}` : ''}`;
     return crypto.createHash('sha256').update(material).digest('hex');
 }
 
@@ -218,6 +227,7 @@ export function readLedger(workspaceRoot: string, sessionKey: string): Ledger {
             reads: isObject(parsed['reads']) ? (parsed['reads'] as unknown as Record<string, ReadRecord>) : {},
             writes: isObject(parsed['writes']) ? (parsed['writes'] as Record<string, number>) : {},
             fired: isObject(parsed['fired']) ? (parsed['fired'] as Record<string, boolean>) : {},
+            ...(isObject(parsed['duty']) ? { duty: parsed['duty'] as unknown as NonNullable<Ledger['duty']> } : {}),
         };
     } catch {
         return emptyLedger(); // missing/corrupt ledger → fresh; never a crash
@@ -254,6 +264,19 @@ export function isRangedRead(toolInput: JsonObject): boolean {
     return false;
 }
 
+/**
+ * The file a plain `cat <absolute file>` reads whole, or null. A relative path
+ * resolves against the shell's cwd, which the hook cannot see; a pipe, a
+ * redirect, a flag, a second file or a shell expansion is not a whole-file read
+ * of one known path.
+ */
+export function wholeFileCatPath(command: string): string | null {
+    const m = /^\s*cat\s+(?:"([^"]+)"|'([^']+)'|([^\s|&;<>'"]+))\s*$/.exec(command);
+    if (m === null) return null;
+    const p = m[1] ?? m[2] ?? m[3] ?? '';
+    return p.startsWith('/') && !/[$*?~`]/.test(p) ? p : null;
+}
+
 /** 6.1 advisory — duplicate full read of an unchanged, already-read path. */
 export function buildDuplicateReadLine(relPath: string, earlierTs: number, compared: CompareBasis): string {
     const when = new Date(earlierTs).toISOString();
@@ -275,26 +298,41 @@ export function buildPostEditReadLine(relPath: string): string {
     );
 }
 
+function recordDuty(ledger: Ledger, key: string, workspaceRoot: string): void {
+    const states = dutyStates(dutyForPath(key, workspaceRoot), ledger.reads);
+    if (Object.keys(states).length === 0) return;
+    const ts = Date.now();
+    ledger.duty = { ...(ledger.duty ?? {}) };
+    for (const [k, state] of Object.entries(states)) ledger.duty[k] = { state, ts };
+}
+
 export function main(): number {
     try {
         const [envelope, payload] = unwrap(readHookStdin(), 'claude');
 
         const event = str(envelope['event'] as JsonValue | undefined);
+        if (event === 'pre_compact') {
+            // Compaction drops what was read, so the ledger must not outlive it.
+            const root = str(envelope['workspace_root'] as JsonValue | undefined).trim() || process.cwd();
+            fs.rmSync(ledgerFile(root, deriveSessionKey(envelope, payload)), { force: true });
+            return EXIT_ALLOW;
+        }
         if (event !== '' && event !== 'pre_tool_use') return EXIT_ALLOW;
 
         const toolName = extractToolName(payload);
-        const isRead = READ_TOOLS.has(toolName);
+        const toolInput = extractToolInput(payload);
+        const catPath = toolName === 'Bash' ? wholeFileCatPath(str(toolInput['command'])) : null;
+        const isRead = READ_TOOLS.has(toolName) || catPath !== null;
         const isWrite = WRITE_TOOLS.has(toolName);
         if (!isRead && !isWrite) return EXIT_ALLOW;
 
-        const toolInput = extractToolInput(payload);
-        const filePath = extractFilePath(toolInput);
+        const filePath = catPath ?? extractFilePath(toolInput);
         if (!filePath) return EXIT_ALLOW;
 
         const workspaceRoot = str(envelope['workspace_root'] as JsonValue | undefined).trim() || process.cwd();
         const absPath = path.isAbsolute(filePath) ? filePath : path.resolve(workspaceRoot, filePath);
         const relPath = path.relative(workspaceRoot, absPath);
-        if (isExemptPath(relPath) || isExemptPath(absPath)) return EXIT_ALLOW;
+        const exempt = isExemptPath(relPath) || isExemptPath(absPath);
 
         const sessionKey = deriveSessionKey(envelope, payload);
         const ledger = readLedger(workspaceRoot, sessionKey);
@@ -302,11 +340,35 @@ export function main(): number {
         // absolute-vs-relative host payloads), absolute otherwise.
         const key = relPath.startsWith('..') ? absPath : relPath;
 
+        if (exempt && isWrite) {
+            // No 6.2 bookkeeping on an exempt path, but the duty is observed:
+            // `dist/agent-src/` is itself a trigger prefix.
+            recordDuty(ledger, key, workspaceRoot);
+            writeLedger(workspaceRoot, sessionKey, ledger);
+            return EXIT_ALLOW;
+        }
+        if (exempt) {
+            // No advisory on an exempt path, but the read is recorded: a projected
+            // rule reference lives under dist/, and the reference duty asks whether
+            // it was read.
+            if (!isRangedRead(toolInput)) {
+                try {
+                    const st = fs.statSync(absPath);
+                    ledger.reads[key] = { mtime: st.mtimeMs, size: st.size, ts: Date.now() };
+                    writeLedger(workspaceRoot, sessionKey, ledger);
+                } catch {
+                    // unreadable target — nothing to record
+                }
+            }
+            return EXIT_ALLOW;
+        }
+
         if (isWrite) {
             // 6.2 bookkeeping: remember this session's own write. The write has
             // not happened yet, but for every later comparison "about to write"
             // and "wrote" are equivalent.
             ledger.writes[key] = Date.now();
+            recordDuty(ledger, key, workspaceRoot);
             writeLedger(workspaceRoot, sessionKey, ledger);
             return EXIT_ALLOW;
         }
```
