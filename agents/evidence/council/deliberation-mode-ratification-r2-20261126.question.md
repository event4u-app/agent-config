<!-- evidence-type: original-review -->

# Ratification prompt, round 2 — the `deliberation-mode` user_prompt_submit concern (verbatim, as sent 2026-11-26)

~~~text
Ratification review, round 2, of one change touching two files on this repository's ratification watched set: src/scripts/hook_manifest.yaml and its compiled src/scripts/hook_manifest.json.

subject: aee529d94e160019a2f8e2a540dab349af6ce908e0c59e47d1140def4655c16f

(The digest covers those two gated files, computed with ./scripts-run src/scripts/ratification_subject --files src/scripts/hook_manifest.json src/scripts/hook_manifest.yaml against origin/main 88a921e3a.)

Closed verdicts (ADR-268 § 4): ratified (an approved expansion of what an agent may do) · confirmed-non-expanding (no authority expanded, no gate weakened, no enforcing step made non-enforcing) · refused (must not land).

Background: the repository owner asked for a setting that decides what happens when a question carries a real decision with trade-offs. `deliberation.mode` is a key in the user-global settings file with three values: `offer` (the default and the shipped template value), `auto`, `off`. It is writable through `agent-config settings:set` and a new `agent-config deliberation:set`; a per-session override at `<user-global root>/state/deliberation/<session-id>.json` (written by `deliberation:set <mode> --session <id>`, removed by `inherit`) lets a desktop tool (Agent Switch) set the mode per chat. Resolution: session override, then the user-global setting, then `offer`. Nothing ever sets `auto` unless the user, the agent on the user's instruction, or Agent Switch writes it.

Round 1 (same subject family, 2026-11-26): both seats refused. Their stated reasons: `auto` was an unmeasured widening of what the agent may do on its own (starting /council, /arena or /panel on its own judgement), with the downstream spend and seat limits asserted rather than shown; no measurement plan or rollback thresholds; the three-word prompt filter fires on most prompts; a settings file that cannot be parsed fell back to the default instead of to silence. Both proposed shipping `offer` and `off` only and deferring `auto`.

The owner then ruled on what `auto` means, verbatim: "Nein, ich WILL, dass wenn ich aktiv auf Auto stelle (das ist wie das normale Auto bei Claude, Codex und co), dass der Agent Dinge automatisch macht. Und wenn ich sage, er soll seine Fragen (wie soll er was machen) automatisch beantworten, dann soll er das tun !!! PUNKT. - Was er nicht soll, ist automatisch mergen oder deployen. Aber Fragen wie etwas umgesetzt werden soll, darf er in diesem Fall automatisch entscheiden." In English: when he actively switches to auto (like the normal auto mode of Claude, Codex and similar tools) the agent should do things automatically, and answer its own questions about how to implement something; it must not merge or deploy automatically. The ruling is recorded in agents/evidence/owner-directives/2026-11-26-deliberation-mode-concern.md.

What changed since round 1:
- `auto` now means, in the injected line: the agent answers its own implementation questions inside the task (how to do it, approach, design, library) itself, directly or via /council, /arena or /panel when that is worth it, and states each decision with a one-line reason instead of asking; it runs a fitting tool without a confirmation round, saying which and why; the tools' own spend and seat rules still apply. The line then names, verbatim: "Still ask, always: merge, deploy, push, release or tag, production data or infra, bulk deletion, any irreversible external action (send, publish, post, purchase), owner-reserved decisions, and facts only the user holds." Those are the actions this repository's non-destructive-by-default rule (its Hard Floor) already requires a this-turn confirmation for in every mode; that rule is not changed by this change.
- The rule file `deliberation-offers` from round 1 is removed; the procedure lives in the `/deliberation` command and a reference page of the ai-council skill (not on the watched set, not shown). The hook line is therefore the only always-on carrier.
- The hook stays silent when a user-global settings layer exists but cannot be read, unless a session override decides.
- Unchanged: the three-word filter, the five host bindings, advisory severity, exit 0 on every path, the acceptance of an envelope with an absent `event` field (the same check `intake-pass` uses), the session-id validation, no measurement period recorded beyond the admission's rollback triggers.

Measured by the author before this review: 10 hook tests in tests/hooks/deliberation_mode_hook.test.ts (each mode; the auto line contains each Hard-Floor term; the offer line contains no instruction to decide alone; session-override precedence; silence on slash commands, short replies, other events, the kill switch and an unreadable settings layer; an invalid session id) and 21 resolution tests pass; lint_hook_manifest and check_concern_admissions exit 0; the per-spawn preamble payload is unchanged (check_preamble_payload_budget: 135,770 tokens, equal to origin/main). The offer line measures 533 bytes and the auto line 891 bytes for a 36-character session id.

Scope of what is shown: the diff against origin/main of every hook-system file of the change: the manifest YAML, the compiled manifest JSON as a key-sorted jq -S diff of base against head, the new concern, the module it imports, the lazy-chunk and bundle-entry rows, the admission row, the kill-switch row, and the two test-pin edits. The hook's own test file is described, not shown.

diff --git a/agents/decisions/concern-admissions.jsonl b/agents/decisions/concern-admissions.jsonl
index 885dd27fc..86730d0b0 100644
--- a/agents/decisions/concern-admissions.jsonl
+++ b/agents/decisions/concern-admissions.jsonl
@@ -27,3 +27,4 @@
 {"concern":"memory-audience-shadow","decision":"admitted","admitted_at":"2026-11-05","slot":"pre_tool_use on claude only, filtered to Agent, Task, Write, Edit and MultiEdit. No concern observed a subagent writing to the shared memory, and none measured what a memory slice handed to a spawn would cost before any slice is delivered (road-to-a-memory-each-worker-is-handed 2.2, 2.3).","binding_hosts":"claude (1). It reads agent_id from the pre_tool_use payload to tell a child call from the session, and claude is the host whose payload carries it; `agent-config hooks:status` answers whether the slot is live on the host actually running.","behaviour_where_deny_ignored":"Not applicable: `severity: advisory`, `effect: telemetry`, `fail_closed: false`. It never denies and writes nothing to stdout; it appends at most one line to the gitignored subagent ledger. Where it does not run, nothing is recorded, which is the behaviour before this concern.","why_not_extend":"spawn-guard-shadow already sees Agent/Task but its ratified payload_fields exclude the prompt (ratification 2026-10-22, condition 4), and the slice is named in the prompt; source-first-gate has no tools filter and records a different event class. Widening either would change a ratified privacy boundary rather than add a concern with its own.","per_event_budget_impact":"Inlined in the dispatch bundle, measured 1,570,052 B against the 1,585,000 B ceiling with no raise. Per matching call: one envelope parse; for a spawn a regex over the prompt and, for at most 20 distinct named refs (MAX_EXAMINED_REFS), two realpath calls and one stat each, names past that counted unresolved, over at most the first 100,000 prompt characters (MAX_SCAN_CHARS); for a child write one realpath per missing path level, at most 32 (MAX_RESOLVE_DEPTH), to find where it lands; and one appended ledger line; nothing reaches the model, so zero context bytes.","reason":"road-to-a-memory-each-worker-is-handed Phase 2: record child writes before writer provenance is enforced anywhere else, and measure the slice for two weeks before Phase 3 delivers it."}
 {"concern":"compact-checkpoint","decision":"admitted","admitted_at":"2026-11-08","slot":"pre_compact and session_start (source compact only) on claude only. No concern recorded whether a compaction's pre_compact and its session_start(compact) pair up, nor how often a pre-compaction record is orphaned — the reading the council's compact-attempt-identity blocker waits on (road-to-state-and-pins-across-compaction 1.2, 1.3).","binding_hosts":"claude (1) — the one host whose compaction records were measured (274 automatic compactions, session id kept 274/274). Whether the slot is live on the host actually running is `agent-config hooks:status`.","behaviour_where_deny_ignored":"Not applicable: `severity: advisory`, `effect: telemetry`, `fail_closed: false`. It never denies, prints nothing and exits 0 on every path; it writes only under the user-global runtime directory.","why_not_extend":"rule-inject and language-mirror already bind pre_compact, but each owns one restore and neither may write task-adjacent records; journal-record is default-off and repository-scoped. A separate lazy concern keeps the measurement off the dispatch bundle and behind its own kill switch AGENT_CONFIG_NO_COMPACT_CHECKPOINT.","per_event_budget_impact":"Lazy chunk, 18,296 B against its own 20,200 B ceiling; the dispatch bundle carries only the LAZY_CONCERNS row and stays under its unchanged ceiling. Per event: one envelope parse, at most one 64 KiB package.json read, a directory sweep capped at 512 entries, one ≤ 4 KiB marker read or write, one appended log line.","reason":"Phase 1 of road-to-state-and-pins-across-compaction: measure compaction pairing and orphans with a keys-only marker, inject nothing, so the council can choose the restore guarantee from readings. Ratified in agents/evidence/ratifications/compact-checkpoint-concern-20261108.md."}
 {"concern":"arena-route","decision":"admitted","admitted_at":"2026-11-25","slot":"pre_tool_use on claude only, filtered to the Workflow tool. No concern saw a Workflow script before: an owner who answered an ask with \"decide it in a 10 agent arena\" got a hand-written four-proposer workflow named pr-gate-arena, with no bracket engine and no bracket.json, because the answer arrived as a tool result that no user_prompt_submit route reads and /arena is not in the model-visible command listing.","binding_hosts":"claude (1) — the one host that both honours a pre_tool_use deny and has a Workflow tool. `agent-config hooks:status` answers whether the slot is live on the host actually running.","behaviour_where_deny_ignored":"Not bound elsewhere. Where it does not run, a hand-rolled arena runs as before; the routing obligation stays model-carried in the judge:bracket command.","why_not_extend":"evidence-independence reads evaluation prompts, not Workflow scripts, and one-question-per-ask is scoped to picker tools; neither has the script in its payload contract. A separate lazy concern keeps the read off every other tool call and behind its own kill switch AGENT_CONFIG_ALLOW_HANDROLLED_ARENA.","per_event_budget_impact":"Lazy chunk (12,680 B); the dispatch bundle carries one LAZY_CONCERNS row and stays under its unchanged 1,915,000 B ceiling (1,603,109 B). Per Workflow call: one bounded script read (inline, or at most 256 KB from scriptPath), the meta name/description extraction over at most 2,000 characters, and the run-reference scan over the script. For an arena-named script only: up to 32 named run folders, each one read of bracket.json and task.md (each at most 4 MB) and one sha-256. Every other tool call pays only the tools filter. Latency unmeasured (null row in concern_sla_ms).","reason":"Measured on 2026-11-25 against the 19 Workflow scripts on the author machine, each with its own session cwd: 7/7 hand-written arena-named workflows refused (criteria-ranking-arena, martinsen-owner-arena, pr-gate-arena, ratification-red-ci-strategy, rbac-arena, session-retro-arena, vertrags-arena — the last named agents/runtime/bracket/vertrag-01, a folder holding its own ergebnis.json and no bracket.json), 8/8 carriers of engine runs allowed (arena-visibility-*, tcc-signing-*), 4/4 other workflows allowed. The release is a run whose bracket.json meets the engine's own invariants (version 1, runId equal to the folder, taskHash equal to the sha-256 of task.md, lines/matches/log arrays), not a mention and not a bare file: ratification round 1 refused a substring release and round 2 an existence-only one. The engine signs nothing; a writer who reproduces the invariants on purpose passes.","rollback":"Revert the pull request that lands this concern, by pull request (owner or maintainer); the revert removes the concern, its claude binding, its LAZY_CONCERNS row, its chunk entry, its EXECUTION_VIEW_GRANTS row, its allowlist entry, its latency row and this record, and carries its own ratification record. Triggers: (a) a false positive — one refusal of a Workflow whose named run folder held a bracket.json meeting the engine invariants at the call, shown by the deny reason plus that folder; (b) the owner naming a refused workflow as one that should have run; (c) a false negative the owner judges material — a hand-written arena that passed by naming a run it did not use. The kill switch AGENT_CONFIG_ALLOW_HANDROLLED_ARENA=1 is per-session relief; it expires with the session and needs no follow-up owner."}
+{"concern": "deliberation-mode", "decision": "admitted", "admitted_at": "2026-11-26", "slot": "user_prompt_submit on claude, cowork, cursor, cline and gemini — the five hosts that already bind intake-pass on that slot. No concern carried deliberation.mode before; the mode has a per-session override keyed by the host's session id, a fact no rule text can know, so the slot that sees session_id with the prompt is the one place it can be delivered.", "binding_hosts": "claude, cowork, cursor, cline, gemini (5) — the intake-pass set; whether the slot is live on the host actually running is `agent-config hooks:status`. The session override applies only where the payload carries a session id; elsewhere the user-global setting decides.", "behaviour_where_deny_ignored": "Not applicable: `severity: advisory`, `effect: context`, `fail_closed: false`. It never denies and exits 0 on every path. Where it does not run, the procedure stays reachable through `/deliberation` and the ai-council skill's § Deliberation mode, and no automatic behaviour is switched on: `auto` reaches the agent only through this line or a deliberation:get it runs itself.", "why_not_extend": "intake-pass is ownerless and settings-free by owner decision OQ-25 and classifies task prompts, not decisions; delegation-nudge is a ranked nudge whose verdict changes the shape of the work and would suppress or be suppressed by this line under nudge_rank; council-availability runs at session_start, which cannot see a mid-session override. A separate lazy concern keeps the settings read off the dispatch bundle and behind its own kill switch AGENT_CONFIG_NO_DELIBERATION_HINT.", "per_event_budget_impact": "Lazy chunk; the dispatch bundle carries one LAZY_CONCERNS row and stays under its unchanged 1,915,000 B ceiling. Per prompt: one envelope parse, at most two user-global settings files parsed with the already-allowed `yaml` package, and one stat plus at most one <= 4 KiB read of the session override. On a qualifying prompt (three or more words, not a slash command, not a harness turn) about 530 B of context in offer mode and 890 B in auto mode (the auto line names the Hard-Floor actions that still ask); silent in off mode unless the prompt names council, arena, panel or deliberation.", "reason": "Owner request 2026-11-26: offer /council, /arena or /panel when a question warrants it, with a setting off|offer|auto (default offer) and a per-session override Agent Switch can set through `agent-config deliberation:set --session`. Owner decision the same day: `auto` is a real automatic mode — the agent answers its own implementation questions and runs the fitting tool — bounded by the non-destructive-by-default Hard Floor (no automatic merge or deploy). No rule file carries it, so the per-spawn preamble does not grow.", "rollback": "Revert the pull request that lands this concern (owner or maintainer); the revert removes the concern, its five bindings, its worker drop entry, its LAZY_CONCERNS row, its chunk entry, its kill-switch row and this record. Triggers: the owner finding the line on prompts where it adds nothing, or a measured slot-budget breach on user_prompt_submit. AGENT_CONFIG_NO_DELIBERATION_HINT=1 is per-process relief; `agent-config deliberation:set off` is the durable one."}
diff --git a/src/scripts/hook_chunks.mjs b/src/scripts/hook_chunks.mjs
index 489ae07d6..64a40ba86 100644
--- a/src/scripts/hook_chunks.mjs
+++ b/src/scripts/hook_chunks.mjs
@@ -118,6 +118,13 @@ export const HOOK_CHUNKS = Object.freeze([
         entry: 'src/scripts/hooks/intake_pass_hook.ts',
         outfile: 'dist/hooks/intake_pass.chunk.cjs',
     }),
+    // `deliberation-mode` on `user_prompt_submit`; `yaml` external: it reads
+    // the user-global settings layers for `deliberation.mode`.
+    Object.freeze({
+        entry: 'src/scripts/hooks/deliberation_mode_hook.ts',
+        outfile: 'dist/hooks/deliberation_mode.chunk.cjs',
+        external: Object.freeze(['yaml']),
+    }),
     // `arena-route` on claude `pre_tool_use`, Workflow calls only; reads no YAML.
     Object.freeze({
         entry: 'src/scripts/hooks/arena_route_hook.ts',
diff --git a/src/scripts/hook_manifest.yaml b/src/scripts/hook_manifest.yaml
index 263b2b780..0f0d56993 100644
--- a/src/scripts/hook_manifest.yaml
+++ b/src/scripts/hook_manifest.yaml
@@ -1127,6 +1127,28 @@ concerns:
     fail_closed: false
     severity: advisory
     effect: context
+  # deliberation.mode (off|offer|auto) for THIS session: one line telling the
+  # agent whether to offer /council, /arena or /panel on a real decision
+  # (`offer`), or — in `auto`, the user's own opt-in — to run the fitting one and
+  # answer its own implementation questions, while every Hard-Floor action
+  # (merge, deploy, push, release, production data/infra, bulk deletion,
+  # irreversible external actions) still asks. Resolution: per-session override
+  # under the user-global state dir > user-global `deliberation.mode` > `offer`.
+  # It is the only always-on carrier on purpose: no rule file, so the per-spawn
+  # preamble does not grow; the procedure is `/deliberation` and the
+  # `ai-council` skill. Silent on `off` (bar a prompt that names one of the
+  # tools, where it states the mode and the toggle), slash commands, harness
+  # turns and replies under three words.
+  # COST, named: on every prompt the lazy chunk loads and reads at most the two
+  # user-global settings layers plus one <= 4 KiB state file; on a qualifying
+  # prompt it adds about 530 B of context in `offer` and 890 B in `auto`.
+  # Kill switch: `AGENT_CONFIG_NO_DELIBERATION_HINT=1`.
+  deliberation-mode:
+    script: src/scripts/hooks/deliberation_mode_hook.ts
+    args: []
+    fail_closed: false
+    severity: advisory
+    effect: context
   # road-to-trigger-delivered-rule-bodies Phase 1 — the DELIVERY twin of
   # `skill-route` above: same two slots, opposite payload policy. `skill-route`
   # ships pointers because a skill is invoked; this ships BODIES because a rule
@@ -1761,7 +1783,7 @@ roles:
     # contacts, so a worker turn that ends in a question to its orchestrator
     # would be recorded as a contact that never reached a human, inflating the
     # exact baseline Phase 0 pre-registers.
-    drop: [delegation-nudge, skill-route, intake-pass, end-review-nudge, review-baseline, council-availability, team-review-gate, self-repair, session-eol, interruption-ledger]
+    drop: [delegation-nudge, skill-route, intake-pass, deliberation-mode, end-review-nudge, review-baseline, council-availability, team-review-gate, self-repair, session-eol, interruption-ledger]
 
 platforms:
   # `ask:` — the SHAPE of this host's user-facing question primitive.
@@ -1803,7 +1825,7 @@ platforms:
     # was not restored at all.
     session_end:      [chat-history, memory-learn, session-register, roadmap-progress, telemetry-flush, journal-record]
     stop:             [chat-history, verify-before-complete, team-review-gate, end-review-nudge, obligation-settle, turn-end-gate, self-repair, session-register, session-eol, interruption-ledger, roadmap-progress, design-pass-stop, suggestion-capture, code-graph-refresh, journal-record]
-    user_prompt_submit: [chat-history, verify-before-complete, minimal-safe-diff, language-mirror, delegation-nudge, skill-route, git-authorization, session-canary, self-repair, session-register, rule-inject, suggestion-capture, journal-record, quota-notice, intake-pass]
+    user_prompt_submit: [chat-history, verify-before-complete, minimal-safe-diff, language-mirror, delegation-nudge, skill-route, git-authorization, session-canary, self-repair, session-register, rule-inject, suggestion-capture, journal-record, quota-notice, intake-pass, deliberation-mode]
     # `rule-inject` was bound here and is not any more
     # (road-to-delivery-for-every-host 3.2, owner ruling E2). E2's strategy is
     # `user_prompt_submit` + `pre_compact`; this slot is the hottest one in the
@@ -1878,7 +1900,7 @@ platforms:
     # weight: the concern still runs (git diff, transcript scan, classifier),
     # still costs the dispatch, and its entire output is thrown away.
     stop:             [chat-history, verify-before-complete, self-repair, session-register, roadmap-progress, design-pass-stop, code-graph-refresh]
-    user_prompt_submit: [chat-history, verify-before-complete, minimal-safe-diff, language-mirror, git-authorization, session-canary, self-repair, session-register, intake-pass]
+    user_prompt_submit: [chat-history, verify-before-complete, minimal-safe-diff, language-mirror, git-authorization, session-canary, self-repair, session-register, intake-pass, deliberation-mode]
     pre_tool_use:     [block-no-verify, evidence-independence, block-kernel-rule-writes, block-plumbing-writes, block-config-weakening, block-speaking-inbox-dir, block-credential-reads, rtk-wrap, design-slop, ui-route-nudge, code-graph-context, chain-nudge, ship-diff-volume, reread-guard, spawn-guard-shadow, source-first-gate, memory-recall]
     post_tool_use:    [chat-history, roadmap-progress, context-hygiene, verify-before-complete, minimal-safe-diff, injection-scan, pr-url-reminder, push-settle, orchestration-record, telemetry-usage, mcp-usage-observation, tool-result-bytes, edit-shape, comment-discipline, design-pass, spawn-guard-shadow]
     # subagent-ledger IS bound here, unlike the two nudges above, and the
@@ -1904,7 +1926,7 @@ platforms:
     session_start:      [chat-history, hot-context, handoff-context, session-canary, council-availability, telemetry-disclosure, first-run-gate, onboarding-gate, verify-before-complete, minimal-safe-diff, profile-staleness, wrapper-freshness, surface-probe, session-register, code-graph-refresh]
     session_end:        [chat-history, memory-learn, session-register, roadmap-progress, telemetry-flush]
     stop:               [chat-history, verify-before-complete, self-repair, session-register, roadmap-progress, design-pass-stop, code-graph-refresh]
-    user_prompt_submit: [chat-history, verify-before-complete, minimal-safe-diff, language-mirror, git-authorization, session-canary, self-repair, session-register, intake-pass]
+    user_prompt_submit: [chat-history, verify-before-complete, minimal-safe-diff, language-mirror, git-authorization, session-canary, self-repair, session-register, intake-pass, deliberation-mode]
     post_tool_use:      [chat-history, roadmap-progress, context-hygiene, verify-before-complete, minimal-safe-diff, injection-scan, pr-url-reminder, push-settle, orchestration-record, telemetry-usage, mcp-usage-observation, tool-result-bytes, edit-shape, comment-discipline, design-pass]
 
   # Phase 7.6 — Cline. Hooks live under `.clinerules/hooks/<HookName>`
@@ -1920,7 +1942,7 @@ platforms:
     session_start:      [chat-history, hot-context, handoff-context, session-canary, council-availability, telemetry-disclosure, first-run-gate, onboarding-gate, verify-before-complete, minimal-safe-diff, profile-staleness, wrapper-freshness, surface-probe, session-register, code-graph-refresh]
     session_end:        [chat-history, memory-learn, session-register, roadmap-progress, telemetry-flush]
     stop:               [chat-history, verify-before-complete, self-repair, session-register, roadmap-progress, design-pass-stop, code-graph-refresh]
-    user_prompt_submit: [chat-history, verify-before-complete, minimal-safe-diff, language-mirror, git-authorization, session-canary, self-repair, session-register, intake-pass]
+    user_prompt_submit: [chat-history, verify-before-complete, minimal-safe-diff, language-mirror, git-authorization, session-canary, self-repair, session-register, intake-pass, deliberation-mode]
     post_tool_use:      [chat-history, roadmap-progress, context-hygiene, verify-before-complete, minimal-safe-diff, injection-scan, pr-url-reminder, push-settle, orchestration-record, telemetry-usage, mcp-usage-observation, tool-result-bytes, edit-shape, comment-discipline, design-pass]
 
   # Phase 7.7 — Windsurf (Cascade). Hooks live at `.windsurf/hooks.json`
@@ -1958,7 +1980,7 @@ platforms:
     session_start:      [chat-history, hot-context, handoff-context, session-canary, council-availability, telemetry-disclosure, first-run-gate, onboarding-gate, verify-before-complete, minimal-safe-diff, profile-staleness, wrapper-freshness, surface-probe, session-register, code-graph-refresh]
     session_end:        [chat-history, memory-learn, session-register, roadmap-progress, telemetry-flush]
     stop:               [chat-history, verify-before-complete, self-repair, session-register, roadmap-progress, design-pass-stop, code-graph-refresh]
-    user_prompt_submit: [chat-history, verify-before-complete, minimal-safe-diff, language-mirror, git-authorization, session-canary, self-repair, session-register, intake-pass]
+    user_prompt_submit: [chat-history, verify-before-complete, minimal-safe-diff, language-mirror, git-authorization, session-canary, self-repair, session-register, intake-pass, deliberation-mode]
     post_tool_use:      [chat-history, roadmap-progress, context-hygiene, verify-before-complete, minimal-safe-diff, injection-scan, pr-url-reminder, push-settle, orchestration-record, telemetry-usage, mcp-usage-observation, tool-result-bytes, edit-shape, comment-discipline, design-pass]
 
   # Phase 7.9 — this package binds no hook on Copilot and has measured none
diff --git a/src/scripts/hooks/lazy_concern.ts b/src/scripts/hooks/lazy_concern.ts
index 5ec1a78ea..ac2ae0404 100644
--- a/src/scripts/hooks/lazy_concern.ts
+++ b/src/scripts/hooks/lazy_concern.ts
@@ -70,6 +70,7 @@ export const LAZY_CONCERNS: Readonly<Record<string, { readonly chunk: string; re
     'src/scripts/hooks/layer_promotion_hook.ts': lazy('layer_promotion.chunk.cjs', 'layer_promotion_hook'),
     'src/scripts/hooks/intake_pass_hook.ts': lazy('intake_pass.chunk.cjs', 'intake_pass_hook'),
     'src/scripts/hooks/arena_route_hook.ts': lazy('arena_route.chunk.cjs', 'arena_route_hook'),
+    'src/scripts/hooks/deliberation_mode_hook.ts': lazy('deliberation_mode.chunk.cjs', 'deliberation_mode_hook'),
     'src/scripts/self_repair_hook.ts': lazy('self_repair.chunk.cjs', '../self_repair_hook'),
     'src/scripts/hooks/compact_checkpoint_hook.ts': lazy('compact_checkpoint.chunk.cjs', 'compact_checkpoint_hook'),
 });
diff --git a/tests/scripts/hook_role_axis.test.ts b/tests/scripts/hook_role_axis.test.ts
index 376f5831f..3ccc75c9b 100644
--- a/tests/scripts/hook_role_axis.test.ts
+++ b/tests/scripts/hook_role_axis.test.ts
@@ -42,6 +42,8 @@ const WORKER_DROP = [
     'skill-route',
     // OQ-25 (2026-10-28): the intake pass decides what to ask the owner, and a worker never talks to the user.
     'intake-pass',
+    // The deliberation line asks the agent to offer the user a council, arena or panel; a worker never talks to the user.
+    'deliberation-mode',
     'end-review-nudge',
     // Joined in road-to-a-question-that-survives-the-turn Phase 2, and the first
     // member here for a DERIVED reason rather than a clause of its own: it
diff --git a/tests/scripts/lint_hook_manifest.test.ts b/tests/scripts/lint_hook_manifest.test.ts
index 54f7ce277..5035fb82f 100644
--- a/tests/scripts/lint_hook_manifest.test.ts
+++ b/tests/scripts/lint_hook_manifest.test.ts
@@ -380,7 +380,8 @@ describe("effect: — the census's field (Phase 2.2)", () => {
     // and 74 since `memory-audience-shadow` (road-to-a-memory-each-worker-is-handed 2.2/2.3).
     // and 75 since `compact-checkpoint` (road-to-state-and-pins-across-compaction 1.2).
     // and 76 since `arena-route` (an arena is the bracket engine, 2026-11-25).
-    expect(names.length).toBe(76);
+    // and 77 since `deliberation-mode` (deliberation.mode off|offer|auto, 2026-11-26).
+    expect(names.length).toBe(77);
     const missing = names.filter((n) => !CONCERN_EFFECTS.has(String(manifest.concerns[n]?.effect)));
     expect(missing).toStrictEqual([]);
     const mismatched = names.filter(

--- jq -S diff of src/scripts/hook_manifest.json (manifest object, base vs head) ---
> 163a164,170
> >     "deliberation-mode": {
> >       "args": [],
> >       "effect": "context",
> >       "fail_closed": false,
> >       "script": "src/scripts/hooks/deliberation_mode_hook.ts",
> >       "severity": "advisory"
> >     },
> 1002c1009,1010
> <         "intake-pass"
> ---
> >         "intake-pass",
> >         "deliberation-mode"
> 1066c1074,1075
> <         "intake-pass"
> ---
> >         "intake-pass",
> >         "deliberation-mode"
> 1160c1169,1170
> <         "intake-pass"
> ---
> >         "intake-pass",
> >         "deliberation-mode"
> 1224c1234,1235
> <         "intake-pass"
> ---
> >         "intake-pass",
> >         "deliberation-mode"
> 1288c1299,1300
> <         "intake-pass"
> ---
> >         "intake-pass",
> >         "deliberation-mode"
> 1316a1329
> >         "deliberation-mode",

diff --git a/docs/contracts/hook-architecture-v1.md b/docs/contracts/hook-architecture-v1.md
index 7225e04fd..fa1aef2a9 100644
--- a/docs/contracts/hook-architecture-v1.md
+++ b/docs/contracts/hook-architecture-v1.md
@@ -1330,6 +1330,7 @@ configuration. `orphan` — the name survives only in prose; nothing reads it.
 | `AGENT_CONFIG_NO_EGRESS_STAGE` | maintainer | Turns the egress stage off whatever `egress.placeholders.mode` says: no detection, no count record, no placeholder view. Every egress channel then publishes `uncovered`, never a stale `replaced` (`docs/contracts/egress-placeholders-v1.md` § Settings) | `hooks/egress_stage.ts:28` |
 | `AGENT_CONFIG_NO_EVENTS_LOG` | maintainer | Short-circuits council / team event-log appends to a no-op | `_lib/env_kill_switch.ts` names it; the readers are `ai_council/events_log.ts:109` and `ai_team/review_gate.ts:56`, both outside the two directories the unit covers |
 | `AGENT_CONFIG_NO_INTAKE_PASS` | operator | `=1` silences the `intake-pass` concern: no intake-pass line on any prompt (owner answer OQ-25 ships it on, with no settings key, so this is its only off switch) | `hooks/intake_pass_hook.ts:78` |
+| `AGENT_CONFIG_NO_DELIBERATION_HINT` | operator | `=1` silences the `deliberation-mode` concern: no deliberation line on any prompt. The mode itself is `deliberation.mode` (`agent-config deliberation:set`), which this does not change | `hooks/deliberation_mode_hook.ts:33` |
 | `AGENT_CONFIG_NO_COMPACT_CHECKPOINT` | operator | `=1` silences the `compact-checkpoint` concern: no checkpoint written at `pre_compact` and nothing recorded after a compaction (it injects nothing either way) | `hooks/compact_checkpoint_hook.ts:44` |
 | `AGENT_CONFIG_NO_SESSION_PINS` | operator | `=1` turns session pins off: no `pin:` line is captured, no pin is restored after a compaction and none is handed to a subagent. The language pin is unaffected. Also read by `language_mirror_hook.ts`, outside the scanned roots, so a disabled install never loads the pin chunk | `_lib/session_pins.ts:45` |
 | `AGENT_CONFIG_NO_PIN_REEXEC` | maintainer | Suppresses the pin re-exec | `_lib/pin_resolver.ts:43` |

--- new file src/scripts/hooks/deliberation_mode_hook.ts ---
/**
 * deliberation-mode — `user_prompt_submit` concern that tells the agent, in one
 * line, which `deliberation.mode` is in force for THIS session and what it
 * obliges: `offer` → offer `/council`, `/arena` or `/panel` as numbered options
 * when the prompt carries a real decision; `auto` → the user's own opt-in to an
 * automatic mode: run the fitting tool, and answer the agent's own
 * implementation questions instead of asking, with the Hard Floor
 * (`non-destructive-by-default`) still asking for merge, deploy, push, release,
 * production data/infra, bulk deletion and irreversible external actions. The
 * line is the carrier on purpose — no rule file, so the per-spawn preamble does
 * not grow; the procedure is `/deliberation` and the `ai-council` skill's
 * § Deliberation mode.
 *
 * Resolution: session override (`state/deliberation/<session_id>.json`) >
 * user-global `deliberation.mode` > `offer` (`_lib/deliberation_mode.ts`).
 *
 * Silent on: mode `off` (except a prompt that itself names council, arena,
 * panel or deliberation — then one line states that the mode is off and how to
 * change it, so an "only this chat" toggle has the session id it needs), slash
 * commands, harness-generated turns, and replies under three words.
 *
 * Never blocks; exit 0 on every path. Kill switch:
 * `AGENT_CONFIG_NO_DELIBERATION_HINT=1`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { resolveDeliberationMode, validSessionId, type DeliberationMode } from '../_lib/deliberation_mode.js';
import { isSyntheticPrompt } from '../_lib/prompt_shape.js';
import { EXIT_ALLOW } from './exit_codes.js';
import { readHookStdin } from './hook_stdin.js';

type JsonObject = Record<string, unknown>;

export const CONCERN = 'deliberation-mode';
export const KILL_SWITCH = 'AGENT_CONFIG_NO_DELIBERATION_HINT';
export const MIN_WORDS = 3;
const TOPIC = /\b(?:council|arena|panel|deliberation|deliberations?-?modus)\b/i;
const TOOLS =
    '/council (other model families\' second opinion), /arena (competing solutions judged pairwise), ' +
    '/panel decide|review (independent judges vote or verify)';
/** The Hard Floor, named in the `auto` line itself so no reader of the line takes `auto` past it. */
export const ALWAYS_ASK =
    'merge, deploy, push, release or tag, production data or infra, bulk deletion, any irreversible external action ' +
    '(send, publish, post, purchase), owner-reserved decisions, and facts only the user holds';

function isObject(v: unknown): v is JsonObject {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Whether this prompt is one the line is worth spending on. Pure. */
export function promptWarrantsLine(prompt: string): boolean {
    const text = prompt.trim();
    if (text === '' || text.startsWith('/')) return false;
    if (isSyntheticPrompt(text)) return false;
    return text.split(/\s+/).length >= MIN_WORDS;
}

/** The line for one mode, or `null` for silence. Pure. */
export function deliberationLine(mode: DeliberationMode, sessionId: string | null, prompt: string): string | null {
    const topic = TOPIC.test(prompt);
    const sid = sessionId === null ? '' : ` session="${sessionId}"`;
    const toggle = topic
        ? ` To change it: agent-config deliberation:set <off|offer|auto> (global)${sessionId === null ? '' : `, or add --session ${sessionId} for this chat only (inherit removes that)`}.`
        : '';
    if (mode === 'off') {
        if (!topic) return null;
        return `<deliberation mode="off"${sid}>Deliberation tools are off: never offer or start /council, /arena or /panel unasked.${toggle}</deliberation>`;
    }
    if (mode === 'offer') {
        return (
            `<deliberation mode="offer"${sid}>If this prompt asks for a real decision with trade-offs (a design choice, a contested claim, several viable solutions), ` +
            `offer the fitting one(s) as numbered options — ${TOOLS} — with one recommendation line and the plain answer as the last option. ` +
            `Never on a trivial ask. Procedure: /deliberation.${toggle}</deliberation>`
        );
    }
    return (
        `<deliberation mode="auto"${sid}>The user switched on automatic mode. Answer your own implementation questions inside the task ` +
        `(how to do it, approach, design, library) yourself — directly, or via ${TOOLS} when that is worth it — and state each decision ` +
        `with a one-line reason instead of asking. Run a fitting tool yourself when it adds value, saying which and why in one line; ` +
        `its own spend and seat rules still apply. Never on a trivial ask. Still ask, always: ${ALWAYS_ASK}. Procedure: /deliberation.${toggle}</deliberation>`
    );
}

function field(o: JsonObject, keys: readonly string[]): string {
    for (const k of keys) {
        const v = o[k];
        if (typeof v === 'string' && v.trim() !== '') return v;
    }
    return '';
}

export interface HookDeps {
    readonly env: NodeJS.ProcessEnv;
    readonly settingsPaths?: readonly string[];
}

/** The concern's decision for one envelope: the line to inject, or `null`. */
export function decide(envelope: JsonObject, deps: HookDeps): string | null {
    if (deps.env[KILL_SWITCH] === '1') return null;
    const event = envelope['event'];
    if (typeof event === 'string' && event !== '' && event !== 'user_prompt_submit') return null;
    const payload = isObject(envelope['payload']) ? envelope['payload'] : envelope;
    const prompt = field(payload, ['prompt', 'userPrompt', 'user_prompt', 'message', 'text']);
    if (!promptWarrantsLine(prompt)) return null;
    const sessionId = validSessionId(field(payload, ['session_id', 'sessionId']) || field(envelope, ['session_id', 'sessionId']));
    const effective = resolveDeliberationMode({ sessionId, settingsPaths: deps.settingsPaths, env: deps.env });
    // A settings layer that exists but cannot be read may hold `off`; without a
    // session override deciding, stay silent rather than assume the default.
    if (effective.source !== 'session' && effective.global.unreadable === true) return null;
    return deliberationLine(effective.mode, sessionId, prompt);
}

export function main(): number {
    try {
        const raw = readHookStdin();
        const parsed: unknown = raw.trim() ? JSON.parse(raw) : {};
        const line = decide(isObject(parsed) ? parsed : {}, { env: process.env });
        if (line === null) return EXIT_ALLOW;
        process.stdout.write(`${JSON.stringify({ decision: 'allow', reason: `${CONCERN}: mode line`, context: line })}\n`);
    } catch {
        // A malformed envelope or an unreadable state file never costs the turn.
    }
    return EXIT_ALLOW;
}

// Bundle-safety: never auto-run when inlined into an esbuild bundle.
declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
function _isCliEntry(): boolean {
    if (typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__) return false;
    if (process.argv[1] === undefined) return false;
    if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) return true;
    try {
        return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exit(main());
}

--- new file src/scripts/_lib/deliberation_mode.ts ---
/**
 * `deliberation.mode` — whether the agent offers `/council`, `/arena` or
 * `/panel` on a real decision (`offer`), runs the fitting one (`auto`), or
 * neither (`off`) — and the per-session override beside it.
 *
 * Resolution order, first hit wins:
 *
 *   1. session  — `<user-global root>/state/deliberation/<session-id>.json`,
 *                 written by `agent-config deliberation:set <mode> --session <id>`;
 *   2. global   — `deliberation.mode` in the USER-GLOBAL settings layers (later
 *                 layers win), the file `settings:set` writes;
 *   3. default  — `offer`, the template value.
 *
 * Only the user-global layers are read, for the reason `star_ask` gives: a
 * repository a contributor clones must not be able to switch the agent to
 * `auto` for them.
 *
 * The session file is keyed by the host's session id, which arrives from a hook
 * payload or from a caller such as Agent Switch. It is validated before it ever
 * becomes a path segment: letters, digits, `-` and `_`, 8–128 characters,
 * starting with a letter or digit — a UUID passes, `..`, `/` and `\` do not.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { parse as parseYaml } from 'yaml';

import { user_global_settings_paths } from './agent_settings.js';
import { write_atomic } from './fs_atomic.js';
import * as user_global_paths from './user_global_paths.js';

export const DELIBERATION_MODES = ['off', 'offer', 'auto'] as const;
export type DeliberationMode = (typeof DELIBERATION_MODES)[number];
export const DEFAULT_DELIBERATION_MODE: DeliberationMode = 'offer';
export const SESSION_OVERRIDE_SCHEMA = 1;
export const SESSION_OVERRIDE_DIR = path.join('state', 'deliberation');

const SESSION_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{7,127}$/;
const OVERRIDE_MAX_BYTES = 4096;

export type DeliberationSource = 'session' | 'global' | 'default';

export function isDeliberationMode(v: unknown): v is DeliberationMode {
    return typeof v === 'string' && (DELIBERATION_MODES as readonly string[]).includes(v);
}

/** A session id that may become one path segment, or `null`. */
export function validSessionId(id: unknown): string | null {
    if (typeof id !== 'string') return null;
    const t = id.trim();
    return SESSION_ID.test(t) ? t : null;
}

/** Where the override for `sessionId` lives. Throws on an id that is not a single safe segment. */
export function sessionOverridePath(sessionId: string, env?: user_global_paths.EnvMap | null): string {
    const id = validSessionId(sessionId);
    if (id === null) throw new Error(`not a session id: ${JSON.stringify(sessionId)}`);
    return user_global_paths.write_target(path.join(SESSION_OVERRIDE_DIR, `${id}.json`), { env: env ?? null });
}

export interface GlobalMode {
    readonly mode: DeliberationMode;
    readonly source: 'global' | 'default';
    /** The layer that set it; `null` for the default. */
    readonly file: string | null;
    /** A layer exists but could not be read or parsed; the default stands in for whatever it holds. */
    readonly unreadable?: boolean;
}

/** YAML 1.1 reads a bare `off` as boolean false; both spell the same choice. */
function modeOf(v: unknown): DeliberationMode | null {
    if (v === false) return 'off';
    return isDeliberationMode(v) ? v : null;
}

export function readGlobalMode(paths: readonly string[] = user_global_settings_paths()): GlobalMode {
    let found: { mode: DeliberationMode; file: string } | null = null;
    let unreadable = false;
    for (const p of paths) {
        let raw: string;
        try {
            raw = fs.readFileSync(p, 'utf-8');
        } catch (e) {
            if ((e as NodeJS.ErrnoException).code !== 'ENOENT') unreadable = true;
            continue;
        }
        try {
            const doc = parseYaml(raw, { version: '1.1' }) as Record<string, unknown> | null;
            const block = doc?.['deliberation'];
            if (block === null || typeof block !== 'object' || Array.isArray(block)) continue;
            const mode = modeOf((block as Record<string, unknown>)['mode']);
            if (mode !== null) found = { mode, file: p };
        } catch {
            unreadable = true;
        }
    }
    const extra = unreadable ? { unreadable: true } : {};
    return found === null
        ? { mode: DEFAULT_DELIBERATION_MODE, source: 'default', file: null, ...extra }
        : { mode: found.mode, source: 'global', file: found.file, ...extra };
}

export interface SessionOverride {
    readonly mode: DeliberationMode;
    readonly at: string | null;
    readonly file: string;
}

/** The override for `sessionId`, or `null` when there is none, the id is invalid, or the file is not one this module wrote. */
export function readSessionOverride(sessionId: string, env?: user_global_paths.EnvMap | null): SessionOverride | null {
    if (validSessionId(sessionId) === null) return null;
    const file = sessionOverridePath(sessionId, env);
    try {
        const st = fs.statSync(file);
        if (!st.isFile() || st.size > OVERRIDE_MAX_BYTES) return null;
        const o = JSON.parse(fs.readFileSync(file, 'utf-8')) as Record<string, unknown> | null;
        if (o === null || typeof o !== 'object' || Array.isArray(o) || o['v'] !== SESSION_OVERRIDE_SCHEMA) return null;
        if (!isDeliberationMode(o['mode'])) return null;
        const at = typeof o['at'] === 'string' ? o['at'] : null;
        return { mode: o['mode'], at, file };
    } catch {
        return null;
    }
}

/** Write (atomically, 0600) the override for one session. Returns the file. */
export function writeSessionOverride(
    sessionId: string,
    mode: DeliberationMode,
    now: Date = new Date(),
    env?: user_global_paths.EnvMap | null,
): string {
    const file = sessionOverridePath(sessionId, env);
    const body = { v: SESSION_OVERRIDE_SCHEMA, session: validSessionId(sessionId), mode, at: now.toISOString() };
    write_atomic(file, `${JSON.stringify(body, null, 2)}\n`);
    return file;
}

/** Remove the override for one session. `true` when a file was removed. */
export function clearSessionOverride(sessionId: string, env?: user_global_paths.EnvMap | null): boolean {
    const file = sessionOverridePath(sessionId, env);
    try {
        fs.unlinkSync(file);
        return true;
    } catch (e) {
        if ((e as NodeJS.ErrnoException).code === 'ENOENT') return false;
        throw e;
    }
}

export interface EffectiveMode {
    readonly mode: DeliberationMode;
    readonly source: DeliberationSource;
    /** The file that decided it; `null` for the default. */
    readonly file: string | null;
    readonly sessionId: string | null;
    readonly global: GlobalMode;
    readonly sessionOverride: SessionOverride | null;
}

export interface ResolveOptions {
    readonly sessionId?: string | null | undefined;
    readonly settingsPaths?: readonly string[] | undefined;
    readonly env?: user_global_paths.EnvMap | null | undefined;
}

/** session override > user-global setting > default. Pure apart from the reads named above. */
export function resolveDeliberationMode(opts: ResolveOptions = {}): EffectiveMode {
    const sessionId = validSessionId(opts.sessionId ?? null);
    const global = readGlobalMode(opts.settingsPaths ?? user_global_settings_paths());
    const sessionOverride = sessionId === null ? null : readSessionOverride(sessionId, opts.env);
    if (sessionOverride !== null) {
        return { mode: sessionOverride.mode, source: 'session', file: sessionOverride.file, sessionId, global, sessionOverride };
    }
    return { mode: global.mode, source: global.source, file: global.file, sessionId, global, sessionOverride };
}

/** The machine-readable shape `deliberation:get --json` prints and Agent Switch reads. */
export function effectiveToJson(e: EffectiveMode): Record<string, unknown> {
    return {
        v: 1,
        mode: e.mode,
        source: e.source,
        file: e.file,
        session_id: e.sessionId,
        global: {
            mode: e.global.mode,
            source: e.global.source,
            file: e.global.file,
            ...(e.global.unreadable === true ? { unreadable: true } : {}),
        },
        session_override:
            e.sessionOverride === null ? null : { mode: e.sessionOverride.mode, at: e.sessionOverride.at, file: e.sessionOverride.file },
    };
}

(tests/hooks/deliberation_mode_hook.test.ts is not shown, to stay under the review bundle ceiling; its ten cases are listed above.)

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
