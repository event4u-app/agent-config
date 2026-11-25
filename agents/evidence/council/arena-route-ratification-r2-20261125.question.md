<!-- evidence-type: original-review -->

# Ratification prompt, round 2 — the `arena-route` pre_tool_use concern (verbatim, as sent 2026-11-25)

~~~text
Ratification review, round 2, of one change touching four files on this repository's ratification watched set: src/scripts/hook_manifest.yaml, its compiled src/scripts/hook_manifest.json, src/config/hook-latency-budget.json, and src/scripts/hooks/egress_stage.ts (a verdict-deciding module in the dispatcher's import closure).

subject: 4a32a3fd808bb44d1a2e7b299a1109bd98ee61ccbf56fcc112f8dbde41cab498

(The digest covers those four gated files at commit c69a573483, computed with ./scripts-run src/scripts/ratification_subject --base-ref origin/main.)

Closed verdicts (ADR-268 § 4): ratified (an approved expansion of what an agent may do) · confirmed-non-expanding (no authority expanded, no gate weakened, no enforcing step made non-enforcing) · refused (must not land).

Background, as observed: in one session on 2026-11-25 the repository owner answered an agent's question with "entscheide das in einer 10 agent arena". The agent wrote a Workflow script named pr-gate-arena (four proposers, five judges, one synthesizer) instead of running this package's arena, which is /arena = /judge bracket: a resumable bracket whose state lives in agents/runtime/bracket/<run>/bracket.json and is driven by `agent-config bracket plan|init|scan|advance|collect|card|decline|status` (src/scripts/bracket/cli.ts; `init` writes bracket.json, task.md and briefs/). Workflow agents may legitimately carry an arena's lines and judges once the run exists. The owner's answer arrived as a tool result, which no user_prompt_submit route reads, and top-level commands such as /arena are not in the model-visible command listing on that host (judge:bracket is). An external tool that displays bracket runs showed nothing, because no bracket existed. This package also ships /panel decide|review: independent same-model judges on one question, the named route for a comparison that is not a bracket.

Round 1 (prompt: agents/evidence/council/arena-route-ratification-r1-20261125.question.md): both seats refused (anthropic DEALBREAKER no, openai DEALBREAKER yes). The grounds, and what was done with each:

- The release was a substring: a comment "// agents/runtime/bracket/fake" let a hand-rolled arena through; the hook enforced wording, not routing. CHANGED in c69a573483: the release is engine STATE. The script must name a run — `…/agents/runtime/bracket/<run>` (an absolute prefix is taken as written; a `${...}/` prefix is read as the session's cwd from the envelope) or `agent-config bracket … --run <run>` — whose bracket.json exists (fs.statSync isFile). At most 32 run references are checked. Tests now cover a comment mention (refused) and a folder without bracket.json (refused). Re-measuring against the real corpus under this rule found one earlier misclassification: vertrags-arena, counted in round 1 as an engine carrier, names agents/runtime/bracket/vertrag-01, a folder created 2026-11-17 holding ergebnis.json, matches/ and lines/ and no bracket.json, while the engine has written bracket.json on every init since 2026-10-31. It is a hand-written arena that borrowed the engine's path, and the new rule refuses it.
- No evidence the incident script was matched. The real pr-gate-arena script (session 58d6a4d2) begins `export const meta = { name: 'pr-gate-arena', …` and is in the measured corpus; it is refused.
- The 19-script corpus might be author-made examples. It is every Workflow script the host persisted on the author's machine across four projects and several sessions (`~/.agent-switch/**/workflows/scripts/*.js`, the host's own record of each Workflow call), none written for this review. Re-measured with each script's own session cwd: 7/7 hand-written arena-named workflows refused, 8/8 carriers of engine runs allowed (arena-visibility-* x4, tcc-signing-* x4), 4/4 other workflows allowed. It is one machine's population, not a sample of every user's.
- No rollback owner or criteria. ADDED to the manifest comment and the admission record: rollback is a revert by pull request (owner or maintainer; it touches gated files and carries its own record); trigger: one verified refusal of a Workflow carrying a run whose bracket.json existed at the call, or the owner naming a refused workflow as one that should have run. The kill switch is per-session relief, stated as not the rollback.
- Legitimate non-engine "arenas" (a design comparison named design-arena) would be refused. That is the intended scope: in this package "arena" names the bracket engine, and a comparison that is not a bracket has its own command, /panel; the deny message now names /panel. A workflow named for a bracket metaphor that is neither is refused and must be renamed or killed per session.
- blocking with fail_closed false is inconsistent. It is this repository's established shape for guards whose input may be unreadable (block-speaking-inbox-dir, block-credential-reads, one-question-per-ask): the concern refuses only what it decided; an unreadable script, a saved workflow by name or a malformed envelope is allowed. A crash still refuses, as for every blocking concern (severity resolves rc >= 3).
- Root causes (command visibility, tool-result routing) are not fixed. Not in this change. The model-visible listing is truncated by the host, not by this package; judge:bracket is visible there. A post_tool_use nudge on an answered question would be a complement; it would arrive before the Workflow call only if the agent reads it, which is the gap this pre-dispatch refusal covers. Neither is proposed here.
- The arena that chose this design ran through the engine (agents/runtime/bracket/arena-visibility, champion L002) before this hook existed; it is a provenance note, not evidence of correctness, and the measurements above stand on their own.

What the change does now: a new concern `arena-route` (src/scripts/hooks/arena_route_hook.ts), severity blocking, effect permission, fail_closed false, needs_payload_bodies [input], tools [Workflow], bound on claude pre_tool_use only. It refuses (exit 1) a Workflow call whose script `meta` name or description contains arena, bracket or tournament as a word (optionally plural, not inside a longer identifier) unless the script names a run whose bracket.json exists. Kill switch AGENT_CONFIG_ALLOW_HANDROLLED_ARENA=1. Lazy chunk; the dispatch bundle measures 1,603,109 B against the unchanged 1,915,000 B ceiling. Registered in EXECUTION_VIEW_GRANTS, the blocking allowlist (tests/hooks/concern_severity.test.ts), concern_sla_ms (unmeasured null row), concern-admissions.jsonl and the pre_tool_use guard roster; docs/enforcement-by-host.md regenerated by check_enforcement_matrix --write.

Tests: 17 cases in tests/hooks/arena_route.test.ts. With the state check replaced by "any folder counts", 3 fail; with the refusal disabled, 6 fail. tests/hooks, tests/scripts/hooks, lint_hook_manifest and the suites reading the touched registries: 2,565 passed. tsc --noEmit and eslint on the touched files: clean.

Scope of what is shown: the full diff against origin/main of every file except two generated ones: the compiled hook_manifest.json is shown as a key-sorted jq -S diff of base against head; docs/enforcement-by-host.md is left out (its three regenerated rows add arena-route on augment, claude and cowork pre_tool_use with the same three outcomes as block-credential-reads: warning-only, refusal, unverified; check_enforcement_matrix confirms the file equals a fresh generation).

diff --git a/agents/decisions/concern-admissions.jsonl b/agents/decisions/concern-admissions.jsonl
index 102a340319..dd55829057 100644
--- a/agents/decisions/concern-admissions.jsonl
+++ b/agents/decisions/concern-admissions.jsonl
@@ -26,3 +26,4 @@
 {"concern": "intake-pass", "decision": "admitted", "admitted_at": "2026-10-28", "slot": "user_prompt_submit on claude, cowork, cursor, cline, windsurf and gemini; dropped for worker sessions. No concern told the agent to sort a task prompt's gaps before the first write: skill-route and delegation-nudge point at artefacts, not at the intake decision of which gap is a lookup, a call to make and name, or the one owner question.", "binding_hosts": "claude, cowork, cursor, cline, windsurf, gemini (6) — every platform whose manifest binds user_prompt_submit. Whether the slot is live on the host actually running is `agent-config hooks:status`.", "behaviour_where_deny_ignored": "Not applicable: `severity: advisory`, `effect: context`, `fail_closed: false`; it never denies and never rewrites the prompt. Silent on questions, resume orders, slash commands, harness turns and prompts that already ask for an interview. Where it does not run, the agent gets no intake line, which is the behaviour before this concern. Kill switch AGENT_CONFIG_NO_INTAKE_PASS=1.", "per_event_budget_impact": "Loaded from its own lazy chunk (9,807 B measured, ceiling 10,800 B); the dispatch bundle grows by one LAZY_CONCERNS row (+94 B, max_bytes 1,556,670 -> 1,556,764 with a raise_log entry). The chunk loads and the classifier runs on every prompt; a task prompt adds about 470 B of context.", "reason": "Owner decision OQ-25 (2026-10-28): ship the intake pass in the package's own hooks, on by default, no settings key, and let the agent decide whether a gap is owner-owned. Ratified by the AI council, 2 provider-diverse seats, round 3 — agents/evidence/ratifications/intake-pass-concern-20261028.md.", "why_not_extend": "skill-route and delegation-nudge are nudge-ranked pointer concerns under the one-ranked-nudge-per-slot exclusivity, so folding the intake line into either would let it suppress them or be suppressed by them, and would tie its kill switch to theirs; session-canary is a user-configured liveness marker with an unrelated trigger."}
 {"concern":"memory-audience-shadow","decision":"admitted","admitted_at":"2026-11-05","slot":"pre_tool_use on claude only, filtered to Agent, Task, Write, Edit and MultiEdit. No concern observed a subagent writing to the shared memory, and none measured what a memory slice handed to a spawn would cost before any slice is delivered (road-to-a-memory-each-worker-is-handed 2.2, 2.3).","binding_hosts":"claude (1). It reads agent_id from the pre_tool_use payload to tell a child call from the session, and claude is the host whose payload carries it; `agent-config hooks:status` answers whether the slot is live on the host actually running.","behaviour_where_deny_ignored":"Not applicable: `severity: advisory`, `effect: telemetry`, `fail_closed: false`. It never denies and writes nothing to stdout; it appends at most one line to the gitignored subagent ledger. Where it does not run, nothing is recorded, which is the behaviour before this concern.","why_not_extend":"spawn-guard-shadow already sees Agent/Task but its ratified payload_fields exclude the prompt (ratification 2026-10-22, condition 4), and the slice is named in the prompt; source-first-gate has no tools filter and records a different event class. Widening either would change a ratified privacy boundary rather than add a concern with its own.","per_event_budget_impact":"Inlined in the dispatch bundle, measured 1,570,052 B against the 1,585,000 B ceiling with no raise. Per matching call: one envelope parse; for a spawn a regex over the prompt and, for at most 20 distinct named refs (MAX_EXAMINED_REFS), two realpath calls and one stat each, names past that counted unresolved, over at most the first 100,000 prompt characters (MAX_SCAN_CHARS); for a child write one realpath per missing path level, at most 32 (MAX_RESOLVE_DEPTH), to find where it lands; and one appended ledger line; nothing reaches the model, so zero context bytes.","reason":"road-to-a-memory-each-worker-is-handed Phase 2: record child writes before writer provenance is enforced anywhere else, and measure the slice for two weeks before Phase 3 delivers it."}
 {"concern":"compact-checkpoint","decision":"admitted","admitted_at":"2026-11-08","slot":"pre_compact and session_start (source compact only) on claude only. No concern recorded whether a compaction's pre_compact and its session_start(compact) pair up, nor how often a pre-compaction record is orphaned — the reading the council's compact-attempt-identity blocker waits on (road-to-state-and-pins-across-compaction 1.2, 1.3).","binding_hosts":"claude (1) — the one host whose compaction records were measured (274 automatic compactions, session id kept 274/274). Whether the slot is live on the host actually running is `agent-config hooks:status`.","behaviour_where_deny_ignored":"Not applicable: `severity: advisory`, `effect: telemetry`, `fail_closed: false`. It never denies, prints nothing and exits 0 on every path; it writes only under the user-global runtime directory.","why_not_extend":"rule-inject and language-mirror already bind pre_compact, but each owns one restore and neither may write task-adjacent records; journal-record is default-off and repository-scoped. A separate lazy concern keeps the measurement off the dispatch bundle and behind its own kill switch AGENT_CONFIG_NO_COMPACT_CHECKPOINT.","per_event_budget_impact":"Lazy chunk, 18,296 B against its own 20,200 B ceiling; the dispatch bundle carries only the LAZY_CONCERNS row and stays under its unchanged ceiling. Per event: one envelope parse, at most one 64 KiB package.json read, a directory sweep capped at 512 entries, one ≤ 4 KiB marker read or write, one appended log line.","reason":"Phase 1 of road-to-state-and-pins-across-compaction: measure compaction pairing and orphans with a keys-only marker, inject nothing, so the council can choose the restore guarantee from readings. Ratified in agents/evidence/ratifications/compact-checkpoint-concern-20261108.md."}
+{"concern":"arena-route","decision":"admitted","admitted_at":"2026-11-25","slot":"pre_tool_use on claude only, filtered to the Workflow tool. No concern saw a Workflow script before: an owner who answered an ask with \"decide it in a 10 agent arena\" got a hand-written four-proposer workflow named pr-gate-arena, with no bracket engine and no bracket.json, because the answer arrived as a tool result that no user_prompt_submit route reads and /arena is not in the model-visible command listing.","binding_hosts":"claude (1) — the one host that both honours a pre_tool_use deny and has a Workflow tool. `agent-config hooks:status` answers whether the slot is live on the host actually running.","behaviour_where_deny_ignored":"Not bound elsewhere. Where it does not run, a hand-rolled arena runs as before; the routing obligation stays model-carried in the judge:bracket command.","why_not_extend":"evidence-independence reads evaluation prompts, not Workflow scripts, and one-question-per-ask is scoped to picker tools; neither has the script in its payload contract. A separate lazy concern keeps the read off every other tool call and behind its own kill switch AGENT_CONFIG_ALLOW_HANDROLLED_ARENA.","per_event_budget_impact":"Lazy chunk; the dispatch bundle carries one LAZY_CONCERNS row and stays under its unchanged 1,915,000 B ceiling. Per Workflow call: one bounded script read (inline, or at most 256 KB from scriptPath) and three regular expressions. Every other tool call pays only the tools filter.","reason":"Measured on 2026-11-25 against the 19 Workflow scripts on the author machine, each with its own session cwd: 7/7 hand-written arena-named workflows refused (criteria-ranking-arena, martinsen-owner-arena, pr-gate-arena, ratification-red-ci-strategy, rbac-arena, session-retro-arena, vertrags-arena — the last named agents/runtime/bracket/vertrag-01, a folder holding its own ergebnis.json and no bracket.json), 8/8 carriers of engine runs allowed (arena-visibility-*, tcc-signing-*), 4/4 other workflows allowed. The release is engine state (an existing bracket.json), not a mention: ratification round 1 refused a substring release.","rollback":"Revert by pull request (owner or maintainer; the revert carries its own ratification record). Trigger: one verified refusal of a Workflow carrying a run whose bracket.json existed at the call, or the owner naming a refused workflow as one that should have run. The kill switch AGENT_CONFIG_ALLOW_HANDROLLED_ARENA=1 is the per-session relief until then, not the rollback."}
diff --git a/agents/evidence/analysis/pre-tool-use-guard-coverage-2026-09-04.md b/agents/evidence/analysis/pre-tool-use-guard-coverage-2026-09-04.md
index c9d073ed6d..1b3621065b 100644
--- a/agents/evidence/analysis/pre-tool-use-guard-coverage-2026-09-04.md
+++ b/agents/evidence/analysis/pre-tool-use-guard-coverage-2026-09-04.md
@@ -31,6 +31,7 @@ somewhere in `tests/`" because the looser form hides exactly the gap below.
 
 | guard | concern script | verdict | driving tests |
 |---|---|---|---|
+| `arena-route` | `src/scripts/hooks/arena_route_hook.ts` | covered | 1 |
 | `block-config-weakening` | `src/scripts/hooks/block_config_weakening.ts` | covered | 1 |
 | `block-credential-reads` | `src/scripts/hooks/block_credential_reads.ts` | covered | 1 |
 | `block-kernel-rule-writes` | `src/scripts/hooks/block_kernel_rule_writes.ts` | covered | 4 |
diff --git a/src/config/hook-latency-budget.json b/src/config/hook-latency-budget.json
index a9ec567ea9..69c685afe3 100644
--- a/src/config/hook-latency-budget.json
+++ b/src/config/hook-latency-budget.json
@@ -31,6 +31,8 @@
         "evidence-independence": 0.956,
         "turn-end-gate": 1.587,
         "block-credential-reads": null,
+        "arena-route": null,
+        "_arena_route_2026_11_25": "Registered unmeasured (null) when the arena-route concern was added, for the reason the block-credential-reads row gives: the derivation admits only maxima read on both machine classes, and none exists yet. It runs only on a Workflow call (manifest `tools: [Workflow]`); its cost there is one bounded read of the script (inline, or at most 256 KB from `scriptPath`), regular expressions over at most 2,000 characters of `meta` and over the script, and one `stat` per named run folder (at most 32) for an arena-named script. Its body is a lazy chunk, so other tool calls pay nothing beyond the filter check.",
         "_block_credential_reads_2026_10_18": "Registered unmeasured (null) when road-to-one-detector-and-the-senders-we-own 1.1 added the concern: the derivation above admits only maxima read on both machine classes, and none exists yet, so the window reports it as unmeasured rather than a guessed number. Its cost is a few string tests per path key and one tokenisation per shell segment, with no file read; it grows the shared hook bundle by 11,970 B (1,530,696 to 1,542,666 of 1,550,000)."
     },
     "gate_remeasure": {
diff --git a/src/scripts/hook_chunks.mjs b/src/scripts/hook_chunks.mjs
index b4a539fb7c..489ae07d60 100644
--- a/src/scripts/hook_chunks.mjs
+++ b/src/scripts/hook_chunks.mjs
@@ -118,6 +118,11 @@ export const HOOK_CHUNKS = Object.freeze([
         entry: 'src/scripts/hooks/intake_pass_hook.ts',
         outfile: 'dist/hooks/intake_pass.chunk.cjs',
     }),
+    // `arena-route` on claude `pre_tool_use`, Workflow calls only; reads no YAML.
+    Object.freeze({
+        entry: 'src/scripts/hooks/arena_route_hook.ts',
+        outfile: 'dist/hooks/arena_route.chunk.cjs',
+    }),
     Object.freeze({
         entry: 'src/scripts/hooks/web_launch_rows.ts',
         outfile: 'dist/hooks/web_launch_rows.chunk.cjs',
diff --git a/src/scripts/hook_manifest.yaml b/src/scripts/hook_manifest.yaml
index 6f80529261..3b386a248b 100644
--- a/src/scripts/hook_manifest.yaml
+++ b/src/scripts/hook_manifest.yaml
@@ -327,6 +327,37 @@ concerns:
     severity: blocking
     effect: permission
     needs_payload_bodies: [input]
+  # An arena is the bracket engine (`/arena` = `/judge bracket`, state in
+  # agents/runtime/bracket/<run>/bracket.json), never a hand-written Workflow
+  # named after one. Refuses a Workflow call whose script `meta` names an
+  # arena, bracket or tournament as a word unless the script names a run whose
+  # bracket.json EXISTS (`…/agents/runtime/bracket/<run>`, absolute or under the
+  # session cwd, or `agent-config bracket … --run <run>`) — engine state, not a
+  # mention, releases it. The deny message names /arena, the engine commands and
+  # /panel for a non-bracket comparison. A `scriptPath` script is read (bounded
+  # to 256 KB). Measured on 2026-11-25 against the 19 Workflow scripts on the
+  # author's machine, each with its own session's cwd: 7/7 hand-written
+  # arena-named workflows refused (one of them named an engine path whose folder
+  # holds no bracket.json), 8/8 carriers of engine runs allowed, 4/4 others
+  # allowed. Bound on claude only — the one host that honours a deny and has a
+  # Workflow tool. fail_closed: false — an unreadable script, a saved workflow
+  # by name or a malformed envelope ALLOWS; a crash refuses, as for every
+  # blocking concern. The script is read only on a Workflow call (`tools:`),
+  # and the body ships in its own lazy chunk.
+  # Kill switch: AGENT_CONFIG_ALLOW_HANDROLLED_ARENA=1 (per session, allows
+  # every call while the concern stays bound). Rollback: revert the change by
+  # pull request (the owner or a maintainer; the revert touches this file and
+  # carries its own ratification record). Rollback trigger: one verified refusal
+  # of a Workflow carrying a run whose bracket.json existed at the call, or the
+  # owner naming a refused workflow as one that should have run.
+  arena-route:
+    script: src/scripts/hooks/arena_route_hook.ts
+    args: []
+    fail_closed: false
+    severity: blocking
+    effect: permission
+    needs_payload_bodies: [input]
+    tools: [Workflow]
   # road-to-renewal-leverage Phase 2 — "fix the code, not the config".
   # PreToolUse guard over the recorded allowlist-growth antipattern
   # (autonomous-execution § Antipattern): warns as an allowlist grows within a
@@ -1793,7 +1824,7 @@ platforms:
     # (+16,329 GPT tok, +69 % on the thin rule layer) are in
     # `project_thin_rules.path_only_ids`; the receiver is
     # `agents/roadmaps/stubs/road-to-a-path-route-under-delivery.md`.
-    pre_tool_use:     [block-no-verify, evidence-independence, block-kernel-rule-writes, block-plumbing-writes, block-config-weakening, block-speaking-inbox-dir, block-credential-reads, one-question-per-ask, rtk-wrap, design-slop, ui-route-nudge, code-graph-context, chain-nudge, ship-diff-volume, reread-guard, spawn-guard-shadow, metered-spawn-ask, source-first-gate, memory-recall, memory-audience-shadow]
+    pre_tool_use:     [block-no-verify, evidence-independence, block-kernel-rule-writes, block-plumbing-writes, block-config-weakening, block-speaking-inbox-dir, block-credential-reads, arena-route, one-question-per-ask, rtk-wrap, design-slop, ui-route-nudge, code-graph-context, chain-nudge, ship-diff-volume, reread-guard, spawn-guard-shadow, metered-spawn-ask, source-first-gate, memory-recall, memory-audience-shadow]
     post_tool_use:    [chat-history, roadmap-progress, context-hygiene, verify-before-complete, minimal-safe-diff, injection-scan, pr-url-reminder, push-settle, orchestration-record, telemetry-usage, mcp-usage-observation, tool-result-bytes, edit-shape, comment-discipline, language-mirror, design-pass, journal-record, spawn-guard-shadow, metered-spawn-ask, reread-guard]
     # `language-mirror` — round-5 § 6.1. `pre_compact` sets a pin-lost marker;
     # the `post_tool_use` entry above re-emits the pin exactly once while that
diff --git a/src/scripts/hooks/arena_route_hook.ts b/src/scripts/hooks/arena_route_hook.ts
new file mode 100644
index 0000000000..690983700b
--- /dev/null
+++ b/src/scripts/hooks/arena_route_hook.ts
@@ -0,0 +1,211 @@
+#!/usr/bin/env tsx
+/**
+ * PreToolUse guard: an arena is the bracket engine, never a hand-written
+ * Workflow named after one.
+ *
+ * `/arena` (= `/judge bracket`) runs a resumable bracket whose state lives in
+ * `agents/runtime/bracket/<run>/bracket.json`: lines, script-scored matches,
+ * appeals. Workflow agents may CARRY its lines and judges. What went wrong in
+ * session 58d6a4d2 (2026-11-25) is the other thing: the owner answered an ask
+ * with "entscheide das in einer 10 agent arena", the agent loaded the generic
+ * workflow-authoring reference and wrote `pr-gate-arena` — four proposers, five
+ * judges, one synthesizer, no engine, no state file. It was not an arena in
+ * this package's sense, it left nothing Agent Switch could show as one, and
+ * nothing fired: the ask came back as a tool result, which no
+ * `user_prompt_submit` route sees, and top-level commands such as `/arena` are
+ * not in the model-visible listing (only `judge:bracket` is).
+ *
+ * The Workflow call is the one point every path to a hand-rolled arena passes.
+ * The trigger is literal: the script's `meta` names an arena, bracket or
+ * tournament as a word. The release is STATE, not text: the script must name a
+ * run whose `bracket.json` exists — through a path `…/agents/runtime/bracket/<run>`
+ * (absolute, or relative to the session's cwd) or `agent-config bracket … --run
+ * <run>`. A mention alone, in a comment or of a folder the engine never wrote,
+ * releases nothing: ratification round 1 refused the earlier substring release
+ * on exactly that ground, and a real case confirmed it (a hand-written
+ * `vertrags-arena` named `agents/runtime/bracket/vertrag-01`, a folder holding
+ * its own `ergebnis.json` and no `bracket.json`).
+ *
+ * A script passed by `scriptPath` is read (bounded); an unreadable one, a
+ * named saved workflow, or a malformed envelope is ALLOWED — this guards a
+ * routing mistake, not a safety boundary, and must never wedge a session.
+ *
+ * Kill switch: `AGENT_CONFIG_ALLOW_HANDROLLED_ARENA=1`.
+ *
+ * Exit codes (docs/contracts/hook-architecture-v1.md):
+ *   0 — allow
+ *   1 — block (a hand-rolled arena)
+ */
+import * as fs from 'node:fs';
+import * as os from 'node:os';
+import * as path from 'node:path';
+import { fileURLToPath, pathToFileURL } from 'node:url';
+
+import { readHookStdin } from './hook_stdin.js';
+
+const _HERE = fileURLToPath(import.meta.url);
+
+const KILL_SWITCH = 'AGENT_CONFIG_ALLOW_HANDROLLED_ARENA';
+const SCRIPT_MAX_BYTES = 256 * 1024;
+const META_WINDOW = 2000;
+const MAX_RUN_REFS = 32;
+const ARENA_WORD = /(^|[^A-Za-z0-9])(arena|bracket|tournament)s?($|[^A-Za-z0-9])/i;
+const RUN_ID = '[A-Za-z0-9][A-Za-z0-9._-]*';
+// An absolute prefix, when the script spells one out; a `${REPO}/` prefix is left to the cwd.
+const PATH_REF = new RegExp(`(/[^\\s'"\`$\\{\\}/][^\\s'"\`$\\{\\}]*/)?agents/runtime/bracket/(${RUN_ID})`, 'g');
+const CLI_REF = new RegExp(`agent-config\\s+bracket\\b[^\\n]*?--run[=\\s]+(${RUN_ID})`, 'g');
+
+type JsonObject = Record<string, unknown>;
+
+function _isObject(v: unknown): v is JsonObject {
+    return typeof v === 'object' && v !== null && !Array.isArray(v);
+}
+
+export interface WorkflowCall {
+    readonly tool: string;
+    /** The script text, '' when there is none or it could not be read. */
+    readonly script: string;
+    /** The session's working directory: where a relative run folder lives. */
+    readonly cwd: string;
+}
+
+function readBounded(file: string): string {
+    try {
+        const fd = fs.openSync(file, 'r');
+        try {
+            const buf = Buffer.alloc(SCRIPT_MAX_BYTES);
+            const n = fs.readSync(fd, buf, 0, SCRIPT_MAX_BYTES, 0);
+            return buf.subarray(0, n).toString('utf8');
+        } finally {
+            fs.closeSync(fd);
+        }
+    } catch {
+        return '';
+    }
+}
+
+/** Read (tool name, script text, cwd) off a PreToolUse envelope. */
+export function extractWorkflowCall(envelope: JsonObject): WorkflowCall {
+    const payload = _isObject(envelope['payload']) ? envelope['payload'] : envelope;
+    const nameVal = payload['tool_name'] ?? payload['toolName'] ?? payload['tool'] ?? envelope['tool_name'] ?? envelope['tool'];
+    const tool = typeof nameVal === 'string' ? nameVal : '';
+    const ti = _isObject(payload['tool_input']) ? payload['tool_input'] : _isObject(envelope['tool_input']) ? envelope['tool_input'] : {};
+    const inline = typeof ti['script'] === 'string' ? ti['script'] : '';
+    const scriptPath = typeof ti['scriptPath'] === 'string' ? ti['scriptPath'] : '';
+    const cwdVal = payload['cwd'] ?? envelope['cwd'];
+    const cwd = typeof cwdVal === 'string' && cwdVal !== '' ? cwdVal : process.cwd();
+    return { tool, script: inline || (scriptPath ? readBounded(scriptPath) : ''), cwd };
+}
+
+/** The `name` and `description` strings of the script's `export const meta`. Pure. */
+export function metaText(script: string): string {
+    const at = script.indexOf('export const meta');
+    if (at < 0) return '';
+    const head = script.slice(at, at + META_WINDOW);
+    const field = (key: string) => new RegExp(`\\b${key}\\s*:\\s*(['"\`])([^'"\`]*)\\1`).exec(head)?.[2] ?? '';
+    return `${field('name')} ${field('description')}`;
+}
+
+/** Every run folder the script names, as candidate directories. Pure. */
+export function runDirs(script: string, cwd: string): string[] {
+    const out = new Set<string>();
+    for (const m of script.matchAll(PATH_REF)) {
+        const id = m[2] as string;
+        if (m[1]) out.add(path.join(m[1], 'agents/runtime/bracket', id));
+        out.add(path.join(cwd, 'agents/runtime/bracket', id));
+        if (out.size >= MAX_RUN_REFS) break;
+    }
+    for (const m of script.matchAll(CLI_REF)) {
+        out.add(path.join(cwd, 'agents/runtime/bracket', m[1] as string));
+        if (out.size >= MAX_RUN_REFS) break;
+    }
+    return [...out].slice(0, MAX_RUN_REFS);
+}
+
+/** Whether the engine wrote this run: its `bracket.json` exists. */
+function engineRun(dir: string): boolean {
+    try {
+        return fs.statSync(path.join(dir, 'bracket.json')).isFile();
+    } catch {
+        return false;
+    }
+}
+
+/** The verdict, separated from I/O so the fixtures exercise the decision itself. */
+export function verdict(call: WorkflowCall): { block: boolean; reason: string } {
+    if (call.tool !== 'Workflow') return { block: false, reason: 'not a Workflow call' };
+    if (!call.script) return { block: false, reason: 'no readable script — allowed, never guessed' };
+    if (!ARENA_WORD.test(metaText(call.script))) return { block: false, reason: 'not an arena' };
+    if (runDirs(call.script, call.cwd).some(engineRun)) return { block: false, reason: 'carries a bracket run the engine wrote' };
+    return {
+        block: true,
+        reason:
+            'This Workflow is named an arena but carries no bracket run the engine wrote (no ' +
+            'agents/runtime/bracket/<run>/bracket.json it names exists). An arena here is /arena ' +
+            '(= /judge bracket): `agent-config bracket plan`, then `agent-config bracket init --run <id> ' +
+            '--task <file> --tier S1`, then dispatch the lines, scan, advance, collect, appeals. Workflow ' +
+            'agents may carry the lines and judges once the run exists — name its folder in the script. ' +
+            'A comparison of options by independent judges that is not a bracket is a panel ' +
+            '(`/panel decide|review`) and must not be named an arena.',
+    };
+}
+
+export function main(argv?: string[]): number {
+    const args = argv ?? process.argv.slice(2);
+    if (args.includes('--self-test')) return selfTest();
+    if (process.env[KILL_SWITCH] === '1') return 0;
+    const raw = readHookStdin();
+    if (!raw.trim()) return 0;
+    let envelope: JsonObject;
+    try {
+        const parsed: unknown = JSON.parse(raw);
+        envelope = _isObject(parsed) ? parsed : {};
+    } catch {
+        return 0;
+    }
+    const v = verdict(extractWorkflowCall(envelope));
+    if (v.block) {
+        process.stderr.write(`arena-route: BLOCKED — ${v.reason}\n`);
+        return 1;
+    }
+    return 0;
+}
+
+export function selfTest(): number {
+    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'arena-route-self-'));
+    fs.mkdirSync(path.join(root, 'agents/runtime/bracket/live'), { recursive: true });
+    fs.writeFileSync(path.join(root, 'agents/runtime/bracket/live/bracket.json'), '{}');
+    fs.mkdirSync(path.join(root, 'agents/runtime/bracket/imitation'), { recursive: true });
+    const wf = (script: string): WorkflowCall => ({ tool: 'Workflow', script, cwd: root });
+    const cases: Array<[string, WorkflowCall, boolean]> = [
+        ['a hand-rolled arena is denied', wf("export const meta = { name: 'pr-gate-arena', description: 'x' }"), true],
+        ['a tournament bracket in the description is denied', wf("export const meta = { name: 'pick', description: 'Tournament of designs' }"), true],
+        ['a carrier of a run the engine wrote is allowed', wf("export const meta = { name: 'a-arena-judge' }\nconst RUN = `${REPO}/agents/runtime/bracket/live`"), false],
+        ['a CLI-driving carrier of a live run is allowed', wf("export const meta = { name: 'a-arena' }\n// agent-config bracket scan --run live"), false],
+        ['a mention of a run the engine never wrote is denied', wf("export const meta = { name: 'x-arena' }\n// agents/runtime/bracket/nothing-here"), true],
+        ['a folder without bracket.json is denied', wf("export const meta = { name: 'x-arena' }\nconst B = 'agents/runtime/bracket/imitation'"), true],
+        ['an ordinary workflow is allowed', wf("export const meta = { name: 'find-bugs', description: 'find bugs' }"), false],
+        ['a longer identifier is not the word', wf("export const meta = { name: 'map-arenaview' }"), false],
+        ['another tool is never seen', { tool: 'Bash', script: "export const meta = { name: 'arena' }", cwd: root }, false],
+        ['an empty script is allowed', wf(''), false],
+    ];
+    let failed = 0;
+    try {
+        for (const [name, call, want] of cases) {
+            const got = verdict(call).block;
+            const ok = got === want;
+            process.stdout.write(`${ok ? '✅' : '❌'}  ${name} — block=${String(got)}${ok ? '\n' : ` (wanted ${String(want)})\n`}`);
+            if (!ok) failed += 1;
+        }
+    } finally {
+        fs.rmSync(root, { recursive: true, force: true });
+    }
+    process.stdout.write(`\narena_route --self-test: ${String(cases.length - failed)}/${String(cases.length)} case(s) behaved\n`);
+    return failed > 0 ? 1 : 0;
+}
+
+if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
+    process.exit(main());
+}
+
+export { _HERE };
diff --git a/src/scripts/hooks/egress_stage.ts b/src/scripts/hooks/egress_stage.ts
index 750c9dec7e..6dec685582 100644
--- a/src/scripts/hooks/egress_stage.ts
+++ b/src/scripts/hooks/egress_stage.ts
@@ -40,6 +40,7 @@ export const EGRESS_STAGE_KILL_SWITCH = "AGENT_CONFIG_NO_EGRESS_STAGE";
  * what stops a manifest entry from borrowing a guard's name to read raw values.
  */
 export const EXECUTION_VIEW_GRANTS: ReadonlyMap<string, string> = new Map([
+  ["arena-route", "src/scripts/hooks/arena_route_hook.ts"],
   ["block-config-weakening", "src/scripts/hooks/block_config_weakening.ts"],
   ["block-credential-reads", "src/scripts/hooks/block_credential_reads.ts"],
   ["block-kernel-rule-writes", "src/scripts/hooks/block_kernel_rule_writes.ts"],
diff --git a/src/scripts/hooks/lazy_concern.ts b/src/scripts/hooks/lazy_concern.ts
index c8a65d131e..5ec1a78ea1 100644
--- a/src/scripts/hooks/lazy_concern.ts
+++ b/src/scripts/hooks/lazy_concern.ts
@@ -69,6 +69,7 @@ export const LAZY_CONCERNS: Readonly<Record<string, { readonly chunk: string; re
     'src/scripts/quota_notice_hook.ts': lazy('quota_notice.chunk.cjs', '../quota_notice_hook'),
     'src/scripts/hooks/layer_promotion_hook.ts': lazy('layer_promotion.chunk.cjs', 'layer_promotion_hook'),
     'src/scripts/hooks/intake_pass_hook.ts': lazy('intake_pass.chunk.cjs', 'intake_pass_hook'),
+    'src/scripts/hooks/arena_route_hook.ts': lazy('arena_route.chunk.cjs', 'arena_route_hook'),
     'src/scripts/self_repair_hook.ts': lazy('self_repair.chunk.cjs', '../self_repair_hook'),
     'src/scripts/hooks/compact_checkpoint_hook.ts': lazy('compact_checkpoint.chunk.cjs', 'compact_checkpoint_hook'),
 });
diff --git a/tests/hooks/arena_route.test.ts b/tests/hooks/arena_route.test.ts
new file mode 100644
index 0000000000..7bcacde3af
--- /dev/null
+++ b/tests/hooks/arena_route.test.ts
@@ -0,0 +1,164 @@
+// The `arena-route` PreToolUse guard: an arena is the bracket engine, never a
+// hand-written Workflow named after one.
+//
+// Drives the concern's entry point (envelope → extract → verdict → exit code).
+// The deny cases come first: a guard never seen refuse has unknown sensitivity.
+// The allow cases include the real carrier shapes the engine's own procedure
+// produces, because a guard that blocks the engine it routes to is worse than
+// none. The release is engine STATE: a run whose bracket.json exists.
+import * as fs from 'node:fs';
+import * as os from 'node:os';
+import * as path from 'node:path';
+import { afterAll, beforeAll, describe, expect, it } from 'vitest';
+
+import { extractWorkflowCall, main, runDirs, selfTest, verdict } from '../../src/scripts/hooks/arena_route_hook.js';
+import { clearHookStdinOverride, setHookStdinOverride } from '../../src/scripts/hooks/hook_stdin.js';
+
+let repo = '';
+let elsewhere = '';
+
+beforeAll(() => {
+    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'arena-route-repo-'));
+    fs.mkdirSync(path.join(repo, 'agents/runtime/bracket/tcc-signing'), { recursive: true });
+    fs.writeFileSync(path.join(repo, 'agents/runtime/bracket/tcc-signing/bracket.json'), '{"runId":"tcc-signing"}');
+    // The shape of the real imitation: a run folder the engine never wrote.
+    fs.mkdirSync(path.join(repo, 'agents/runtime/bracket/vertrag-01/lines'), { recursive: true });
+    fs.writeFileSync(path.join(repo, 'agents/runtime/bracket/vertrag-01/ergebnis.json'), '{}');
+    elsewhere = fs.mkdtempSync(path.join(os.tmpdir(), 'arena-route-other-'));
+    fs.mkdirSync(path.join(elsewhere, 'agents/runtime/bracket/abs-run'), { recursive: true });
+    fs.writeFileSync(path.join(elsewhere, 'agents/runtime/bracket/abs-run/bracket.json'), '{}');
+});
+
+afterAll(() => {
+    fs.rmSync(repo, { recursive: true, force: true });
+    fs.rmSync(elsewhere, { recursive: true, force: true });
+});
+
+function run(envelope: unknown): number {
+    setHookStdinOverride(JSON.stringify(envelope));
+    try {
+        return main([]);
+    } finally {
+        clearHookStdinOverride();
+    }
+}
+
+const handRolled = `export const meta = {
+  name: 'pr-gate-arena',
+  description: '10-agent arena: decide how the PR test gate should look',
+  phases: [{ title: 'Propose' }, { title: 'Judge' }],
+}
+const proposals = await parallel(OPTIONS.map(o => () => agent(o.text, { label: 'propose:' + o.key })))`;
+
+// The shape of a real line carrier: the run folder named once, with no slash after the run id.
+const carrier = `export const meta = {
+  name: 'tcc-signing-arena-judge',
+  description: 'Judge arena matches: deterministic checks on both lines, rubric scores',
+  phases: [{ title: 'Judge' }],
+}
+const RUN = \`\${REPO}/agents/runtime/bracket/tcc-signing\`
+const results = await parallel(args.matches.map(m => () => agent(\`judge \${RUN}/lines/\${m.a}.md\`, { label: \`judge:\${m.id}\` })))`;
+
+const workflow = (input: Record<string, unknown>) => ({ tool_name: 'Workflow', tool_input: input, cwd: repo });
+
+describe('arena-route — the deny path', () => {
+    it('blocks a Workflow whose meta names an arena and that carries no engine run', () => {
+        expect(run(workflow({ script: handRolled }))).toBe(1);
+    });
+
+    it('blocks the same script passed by path, so a saved script cannot route around it', () => {
+        const file = path.join(elsewhere, 'pr-gate-arena.js');
+        fs.writeFileSync(file, handRolled);
+        expect(run(workflow({ scriptPath: file }))).toBe(1);
+    });
+
+    it('blocks a bracket or tournament named in the description only', () => {
+        const s = `export const meta = { name: 'pick-design', description: 'Tournament bracket of 8 designs' }`;
+        expect(verdict(extractWorkflowCall(workflow({ script: s }))).block).toBe(true);
+    });
+
+    it('blocks a mention of the engine path in a comment — text is not a run', () => {
+        const s = `${handRolled}\n// see agents/runtime/bracket/fake for how the engine does it`;
+        expect(run(workflow({ script: s }))).toBe(1);
+    });
+
+    it('blocks a run folder the engine never wrote (no bracket.json), as the real vertrags-arena did', () => {
+        const s = `export const meta = { name: 'vertrags-arena', description: 'contract arena' }\nconst B = '${repo}/agents/runtime/bracket/vertrag-01'`;
+        expect(run(workflow({ script: s }))).toBe(1);
+    });
+
+    it('names /arena, the engine and /panel in the refusal', () => {
+        const v = verdict(extractWorkflowCall(workflow({ script: handRolled })));
+        expect(v.reason).toMatch(/\/arena/);
+        expect(v.reason).toMatch(/agent-config bracket/);
+        expect(v.reason).toMatch(/\/panel/);
+    });
+});
+
+describe('arena-route — the allow path', () => {
+    it('allows a real bracket carrier that names its run relative to the session cwd', () => {
+        expect(run(workflow({ script: carrier }))).toBe(0);
+    });
+
+    it('allows a carrier that names its run by an absolute path outside the cwd', () => {
+        const s = `export const meta = { name: 'x-arena-lines' }\nconst B = '${elsewhere}/agents/runtime/bracket/abs-run'`;
+        expect(run(workflow({ script: s }))).toBe(0);
+    });
+
+    it('allows a carrier that drives the CLI for a live run', () => {
+        const s = `export const meta = { name: 'x-arena-lines', description: 'arena lines' }\n// then: agent-config bracket scan --run tcc-signing`;
+        expect(run(workflow({ script: s }))).toBe(0);
+    });
+
+    it('allows a Workflow that is not an arena', () => {
+        const s = `export const meta = { name: 'find-flaky-tests', description: 'Find flaky tests and propose fixes' }`;
+        expect(run(workflow({ script: s }))).toBe(0);
+    });
+
+    it('allows a word inside a longer identifier (arenas of the codebase, not an arena run)', () => {
+        const s = `export const meta = { name: 'map-arenaviews', description: 'map the ArenaView components' }`;
+        expect(run(workflow({ script: s }))).toBe(0);
+    });
+
+    it('never looks at another tool', () => {
+        expect(run({ tool_name: 'Bash', tool_input: { command: "echo 'arena'" } })).toBe(0);
+    });
+
+    it('allows what it cannot read: an unreadable path, an empty or malformed envelope', () => {
+        expect(run(workflow({ scriptPath: '/nonexistent/arena.js' }))).toBe(0);
+        expect(run({})).toBe(0);
+        setHookStdinOverride('{not json');
+        try {
+            expect(main([])).toBe(0);
+        } finally {
+            clearHookStdinOverride();
+        }
+    });
+
+    it('the kill switch lets a hand-rolled arena through', () => {
+        process.env['AGENT_CONFIG_ALLOW_HANDROLLED_ARENA'] = '1';
+        try {
+            expect(run(workflow({ script: handRolled }))).toBe(0);
+        } finally {
+            delete process.env['AGENT_CONFIG_ALLOW_HANDROLLED_ARENA'];
+        }
+    });
+
+    it('a named saved workflow is not a script and is allowed', () => {
+        expect(run(workflow({ name: 'review-changes' }))).toBe(0);
+    });
+});
+
+describe('arena-route — run references', () => {
+    it('reads a `${REPO}/` prefix as the cwd and an absolute prefix as itself', () => {
+        expect(runDirs('`${REPO}/agents/runtime/bracket/a`', '/w')).toEqual(['/w/agents/runtime/bracket/a']);
+        expect(runDirs("'/x/y/agents/runtime/bracket/b'", '/w')).toEqual(['/x/y/agents/runtime/bracket/b', '/w/agents/runtime/bracket/b']);
+        expect(runDirs('agent-config bracket advance --run c', '/w')).toEqual(['/w/agents/runtime/bracket/c']);
+    });
+});
+
+describe('arena-route — self-test', () => {
+    it('passes its own fixtures', () => {
+        expect(selfTest()).toBe(0);
+    });
+});
diff --git a/tests/hooks/concern_severity.test.ts b/tests/hooks/concern_severity.test.ts
index ae8e1e9762..f7ce48339c 100644
--- a/tests/hooks/concern_severity.test.ts
+++ b/tests/hooks/concern_severity.test.ts
@@ -165,6 +165,29 @@ const BLOCKING_ALLOWLIST = new Set([
     // closing a turn (verify-before-complete § turn-completion) and a reply
     // in the wrong language (language-and-tone Iron Law).
     'turn-end-gate',
+    // 2026-11-25, session 58d6a4d2. It refuses ONE thing: a Workflow call whose
+    // script `meta` names an arena, bracket or tournament as a word while the
+    // script carries no run the bracket engine wrote. The three questions, on
+    // this concern's own terms:
+    //
+    //   · SCOPE. Filtered by the manifest's `tools: [Workflow]`, so it never
+    //     sees any other call; within a Workflow call it reads only the `name`
+    //     and `description` of `meta` for the trigger, and a named run whose
+    //     `bracket.json` exists lets it through — a mention alone does not.
+    //     Measured against the 19 real scripts with their sessions' cwd: 7/7
+    //     hand-written arenas refused, 8/8 carriers of engine runs allowed.
+    //   · fail_closed: FALSE. An unreadable `scriptPath`, a saved workflow by
+    //     name, a malformed envelope: the concern returns allow. Every read is
+    //     inside a try, so the crash branch (rc >= 3 refuses) is not the path
+    //     an ordinary unreadable input takes.
+    //   · WHY REFUSAL RATHER THAN A NUDGE. A hand-rolled arena is a whole fan-out
+    //     of paid agents that, once dispatched, has produced no bracket state:
+    //     nothing Agent Switch can show as one, no appeals, no scored matches.
+    //     A warning arrives after the spend. The deny message names the engine
+    //     commands, so the retry is the right run rather than the same one.
+    //
+    // Kill switch: AGENT_CONFIG_ALLOW_HANDROLLED_ARENA=1.
+    'arena-route',
 ]);
 
 interface Concern {
diff --git a/tests/scripts/lint_hook_manifest.test.ts b/tests/scripts/lint_hook_manifest.test.ts
index f80e4e9f9a..54f7ce2773 100644
--- a/tests/scripts/lint_hook_manifest.test.ts
+++ b/tests/scripts/lint_hook_manifest.test.ts
@@ -379,7 +379,8 @@ describe("effect: — the census's field (Phase 2.2)", () => {
     // and 73 since `intake-pass` (owner answer OQ-25, 2026-10-28).
     // and 74 since `memory-audience-shadow` (road-to-a-memory-each-worker-is-handed 2.2/2.3).
     // and 75 since `compact-checkpoint` (road-to-state-and-pins-across-compaction 1.2).
-    expect(names.length).toBe(75);
+    // and 76 since `arena-route` (an arena is the bracket engine, 2026-11-25).
+    expect(names.length).toBe(76);
     const missing = names.filter((n) => !CONCERN_EFFECTS.has(String(manifest.concerns[n]?.effect)));
     expect(missing).toStrictEqual([]);
     const mismatched = names.filter(

Compiled manifest, key-sorted (jq -S) base vs head:
2,3c2,3
<   "body_fingerprint": "24ef2566069b548794f4dae013706d12a183c1323fad21d2b83351cc1f484756:23116",
<   "fingerprint": "eb8dac02d0d13f8de0beb1cd0742f5177c3c37407fa4a5eab2c57be328e7d488:120518",
---
>   "body_fingerprint": "49b65b8e02260c6a6ef463d8eefc9fa28535b5415e7b49b52a604a8303b63302:23323",
>   "fingerprint": "a859e558e4ae97674404cc1bf5437f88d7722f5a5160e5293a03f03466d35e77:122481",
5a6,18
>       "arena-route": {
>         "args": [],
>         "effect": "permission",
>         "fail_closed": false,
>         "needs_payload_bodies": [
>           "input"
>         ],
>         "script": "src/scripts/hooks/arena_route_hook.ts",
>         "severity": "blocking",
>         "tools": [
>           "Workflow"
>         ]
>       },
903a917
>           "arena-route",

Answer each of these, one at a time, keyed by number:
1. What behaviour changes, including what follows from it that the diff does not state?
2. Which authority or safety boundary becomes wider or narrower, and in which direction?
3. Does the change weaken anything that judges it — a test, a gate, a threshold, this review? The standard is quoted rather than paraphrased: the implementer never silently weakens an assertion, deletes, skips or xfails a failing test, lowers a threshold, or changes fixture semantics to fit the code. Does this change do any of those?
4. Is another host or projection left as a way around the control this change touches?
5. Can it be undone, and how — by whom, with what authority, and against which revision?
6. What observation would show the claimed benefit to be false, and what rollback / kill-switch criteria does the change omit?
7. Would a smaller change do, and what does the larger one buy that the smaller one does not?
8. What does it add to standing instruction weight that every later session pays?
9. Could untrusted content steer the path this change opens, and what bounds it if so?

Close with exactly one line, as the last line of your reply, in plain text: no markdown, no bold, no bullet, all three fields on that one line, separated by " | ", in this shape:
STANCE: <ratified|confirmed-non-expanding|refused> | CONFIDENCE: <high|med|low> | DEALBREAKER: <yes|no>
~~~
