<!-- evidence-type: original-review -->

# Ratification prompt, round 1 — the `session-title` user_prompt_submit concern (verbatim, as sent 2026-11-26)

~~~text
Ratification review, round 1, of one change touching two files on this repository's ratification watched set: src/scripts/hook_manifest.yaml and its compiled src/scripts/hook_manifest.json.

subject: cd3eca2c01df0360e4f9949228862d0cf2f18863885cb16f932e8dd7429cdf31

(The digest covers those two gated files at commit 3644d9b413, computed with ./scripts-run src/scripts/ratification_subject --base-ref origin/main; merge base 3c75931f13.)

Closed verdicts (ADR-268 § 4): ratified (an approved expansion of what an agent may do) · confirmed-non-expanding (no authority expanded, no gate weakened, no enforcing step made non-enforcing) · refused (must not land).

Background, as observed: Claude Code writes an ai-title line into each session transcript once, early, and then re-appends the same value for the rest of the session. Across the eight most recent transcripts of this checkout each carried exactly one distinct ai-title value, repeated between 6 and 452 times. sessions:catalog and the external tool Agent Switch list sessions by that title, so a session keeps the name of its first prompt. The repository owner asked, verbatim: "Können wir dafür sorgen, dass der Name einer Session sich immer weiter verbessert und klarer wird, je mehr Informationen wir haben? Und nur wenn der Nutzer selbst die Session umbenennt, dann ändern wir ihn nicht mehr. Aber so hätten wir in Agent Switch eine Bessere Darstellung der Sessions. Das ganze könenn wir ja so gestalten, dass man es über eine Anweisung ein und ausschalten kann. Per default ist es aber an. Und es ist eine globale einstellung." Offered three ways to phrase the better title (the agent itself on a nudge, a separate small-model call from the hook, a deterministic rule from branch and PR), the owner chose the agent itself. Recorded in agents/evidence/owner-directives/2026-11-26-session-titles-that-sharpen.md and ADR-305.

What the change does: a new concern session-title (src/scripts/hooks/session_title_hook.ts), severity advisory, effect context, fail_closed false, bound on claude user_prompt_submit only, added to the worker role's drop list. On each non-harness prompt it increments a per-session counter in <user-global root>/state/session-titles/<id>.json (session id, transcript path, prompt count, last nudge; no prompt text). At prompts 3, 8, 20, 45, 100 and every 100 after, it streams the transcript for title markers; if no custom-title line (the user's /rename) exists, it injects one line asking the agent whether the session goal can now be named more precisely and, if so, to run agent-config session:title --session <id> "<title>" once, at most 60 characters. It never denies, never rewrites the prompt, and returns allow on every error. It is silent when sessions.auto_title is false: a new class-A setting, default true, whitelisted in MERGEABLE_KEYS so a user-global value survives the merge. The CLI writes <session>.agent-title.json beside the transcript (title masked for token-shaped runs, capped at 80 characters, atomic write), refuses with exit 0 when a custom-title exists or the setting is false, and never writes the transcript. sessions:catalog now prefers custom-title, then the sidecar, then ai-title. The body ships as a lazy chunk (46,766 B); the dispatch bundle gains one LAZY_CONCERNS row and measures 1,602,250 B against the unchanged 1,915,000 B backstop. It is admitted in agents/decisions/concern-admissions.jsonl, its +1 concern_count is claimed in a new stub roadmap, and the CLI count budget moves 130 -> 131 in the same change.

Measured by the author before this review, on the author's machine: 10 tests in tests/hooks/session_title_hook.test.ts pass; with the setting check replaced by "return true" the off-switch test fails (1 of 10). tsc --noEmit clean. check_settings_classes (120 keys, A=12), check_concern_admissions, check_hook_bundle_composition, check_generator_sync, check_estate_count against origin/main, runtime_dependencies and check_cli_registry_budget_sync pass.

Scope of what is shown: the full diff against the merge base of every file except four generated or oversized ones: the compiled hook_manifest.json is shown as a key-sorted jq -S diff of base against head; dist/install/install.mjs (the regenerated install bundle, which inlines MERGEABLE_KEYS), docs/decisions/INDEX.md (one added row for ADR-305) and agents/evidence/analysis/adr-evidence-census-2026-08.md (regenerated census) are omitted; src/config/evaluator-budgets.json changes only budgets.cli_help_command_count: max and last_measured 130 -> 131, last_measured_at 2026-11-23 -> 2026-11-26, and one sentence appended to its baseline_note: "130 -> 131 on 2026-11-26 (ADR-305): session:title registers in the SAME PR that adds it — the agent publishes a refined session title through it when the session-title concern asks, and a user's /rename title is never overridden. Headroom stays zero by design."

diff --git a/agents/decisions/concern-admissions.jsonl b/agents/decisions/concern-admissions.jsonl
index 885dd27fcd..c9919e40f4 100644
--- a/agents/decisions/concern-admissions.jsonl
+++ b/agents/decisions/concern-admissions.jsonl
@@ -27,3 +27,4 @@
 {"concern":"memory-audience-shadow","decision":"admitted","admitted_at":"2026-11-05","slot":"pre_tool_use on claude only, filtered to Agent, Task, Write, Edit and MultiEdit. No concern observed a subagent writing to the shared memory, and none measured what a memory slice handed to a spawn would cost before any slice is delivered (road-to-a-memory-each-worker-is-handed 2.2, 2.3).","binding_hosts":"claude (1). It reads agent_id from the pre_tool_use payload to tell a child call from the session, and claude is the host whose payload carries it; `agent-config hooks:status` answers whether the slot is live on the host actually running.","behaviour_where_deny_ignored":"Not applicable: `severity: advisory`, `effect: telemetry`, `fail_closed: false`. It never denies and writes nothing to stdout; it appends at most one line to the gitignored subagent ledger. Where it does not run, nothing is recorded, which is the behaviour before this concern.","why_not_extend":"spawn-guard-shadow already sees Agent/Task but its ratified payload_fields exclude the prompt (ratification 2026-10-22, condition 4), and the slice is named in the prompt; source-first-gate has no tools filter and records a different event class. Widening either would change a ratified privacy boundary rather than add a concern with its own.","per_event_budget_impact":"Inlined in the dispatch bundle, measured 1,570,052 B against the 1,585,000 B ceiling with no raise. Per matching call: one envelope parse; for a spawn a regex over the prompt and, for at most 20 distinct named refs (MAX_EXAMINED_REFS), two realpath calls and one stat each, names past that counted unresolved, over at most the first 100,000 prompt characters (MAX_SCAN_CHARS); for a child write one realpath per missing path level, at most 32 (MAX_RESOLVE_DEPTH), to find where it lands; and one appended ledger line; nothing reaches the model, so zero context bytes.","reason":"road-to-a-memory-each-worker-is-handed Phase 2: record child writes before writer provenance is enforced anywhere else, and measure the slice for two weeks before Phase 3 delivers it."}
 {"concern":"compact-checkpoint","decision":"admitted","admitted_at":"2026-11-08","slot":"pre_compact and session_start (source compact only) on claude only. No concern recorded whether a compaction's pre_compact and its session_start(compact) pair up, nor how often a pre-compaction record is orphaned — the reading the council's compact-attempt-identity blocker waits on (road-to-state-and-pins-across-compaction 1.2, 1.3).","binding_hosts":"claude (1) — the one host whose compaction records were measured (274 automatic compactions, session id kept 274/274). Whether the slot is live on the host actually running is `agent-config hooks:status`.","behaviour_where_deny_ignored":"Not applicable: `severity: advisory`, `effect: telemetry`, `fail_closed: false`. It never denies, prints nothing and exits 0 on every path; it writes only under the user-global runtime directory.","why_not_extend":"rule-inject and language-mirror already bind pre_compact, but each owns one restore and neither may write task-adjacent records; journal-record is default-off and repository-scoped. A separate lazy concern keeps the measurement off the dispatch bundle and behind its own kill switch AGENT_CONFIG_NO_COMPACT_CHECKPOINT.","per_event_budget_impact":"Lazy chunk, 18,296 B against its own 20,200 B ceiling; the dispatch bundle carries only the LAZY_CONCERNS row and stays under its unchanged ceiling. Per event: one envelope parse, at most one 64 KiB package.json read, a directory sweep capped at 512 entries, one ≤ 4 KiB marker read or write, one appended log line.","reason":"Phase 1 of road-to-state-and-pins-across-compaction: measure compaction pairing and orphans with a keys-only marker, inject nothing, so the council can choose the restore guarantee from readings. Ratified in agents/evidence/ratifications/compact-checkpoint-concern-20261108.md."}
 {"concern":"arena-route","decision":"admitted","admitted_at":"2026-11-25","slot":"pre_tool_use on claude only, filtered to the Workflow tool. No concern saw a Workflow script before: an owner who answered an ask with \"decide it in a 10 agent arena\" got a hand-written four-proposer workflow named pr-gate-arena, with no bracket engine and no bracket.json, because the answer arrived as a tool result that no user_prompt_submit route reads and /arena is not in the model-visible command listing.","binding_hosts":"claude (1) — the one host that both honours a pre_tool_use deny and has a Workflow tool. `agent-config hooks:status` answers whether the slot is live on the host actually running.","behaviour_where_deny_ignored":"Not bound elsewhere. Where it does not run, a hand-rolled arena runs as before; the routing obligation stays model-carried in the judge:bracket command.","why_not_extend":"evidence-independence reads evaluation prompts, not Workflow scripts, and one-question-per-ask is scoped to picker tools; neither has the script in its payload contract. A separate lazy concern keeps the read off every other tool call and behind its own kill switch AGENT_CONFIG_ALLOW_HANDROLLED_ARENA.","per_event_budget_impact":"Lazy chunk (12,680 B); the dispatch bundle carries one LAZY_CONCERNS row and stays under its unchanged 1,915,000 B ceiling (1,603,109 B). Per Workflow call: one bounded script read (inline, or at most 256 KB from scriptPath), the meta name/description extraction over at most 2,000 characters, and the run-reference scan over the script. For an arena-named script only: up to 32 named run folders, each one read of bracket.json and task.md (each at most 4 MB) and one sha-256. Every other tool call pays only the tools filter. Latency unmeasured (null row in concern_sla_ms).","reason":"Measured on 2026-11-25 against the 19 Workflow scripts on the author machine, each with its own session cwd: 7/7 hand-written arena-named workflows refused (criteria-ranking-arena, martinsen-owner-arena, pr-gate-arena, ratification-red-ci-strategy, rbac-arena, session-retro-arena, vertrags-arena — the last named agents/runtime/bracket/vertrag-01, a folder holding its own ergebnis.json and no bracket.json), 8/8 carriers of engine runs allowed (arena-visibility-*, tcc-signing-*), 4/4 other workflows allowed. The release is a run whose bracket.json meets the engine's own invariants (version 1, runId equal to the folder, taskHash equal to the sha-256 of task.md, lines/matches/log arrays), not a mention and not a bare file: ratification round 1 refused a substring release and round 2 an existence-only one. The engine signs nothing; a writer who reproduces the invariants on purpose passes.","rollback":"Revert the pull request that lands this concern, by pull request (owner or maintainer); the revert removes the concern, its claude binding, its LAZY_CONCERNS row, its chunk entry, its EXECUTION_VIEW_GRANTS row, its allowlist entry, its latency row and this record, and carries its own ratification record. Triggers: (a) a false positive — one refusal of a Workflow whose named run folder held a bracket.json meeting the engine invariants at the call, shown by the deny reason plus that folder; (b) the owner naming a refused workflow as one that should have run; (c) a false negative the owner judges material — a hand-written arena that passed by naming a run it did not use. The kill switch AGENT_CONFIG_ALLOW_HANDROLLED_ARENA=1 is per-session relief; it expires with the session and needs no follow-up owner."}
+{"concern": "session-title", "decision": "admitted", "admitted_at": "2026-11-26", "slot": "user_prompt_submit on claude only; dropped for worker sessions. No concern refreshed a session title: Claude Code writes its ai-title once and repeats it (one distinct value across each of the eight most recent transcripts of this checkout, repeated 6 to 452 times), so a session keeps the name of its first prompt in sessions:catalog and Agent Switch.", "binding_hosts": "claude (1) — the one host that writes a title this could refine and whose transcript the readers resolve. Whether the slot is live on the host actually running is `agent-config hooks:status`.", "behaviour_where_deny_ignored": "Not applicable: `severity: advisory`, `effect: context`, `fail_closed: false`; it never denies and never rewrites the prompt. Silent between milestones (prompts 3, 8, 20, 45, 100, then every 100), on harness turns, once the user renamed the session (a custom-title line is final), and when `sessions.auto_title` is false. Where it does not run, the host title stays, which is the behaviour before this concern.", "why_not_extend": "session-register keys a repository-scoped register and runs on session_start/stop, not on a prompt count; intake-pass and skill-route fire on task-prompt shape, not on milestones, and folding a title line into either would tie its off switch to theirs. A separate lazy concern keeps the settings read off every other prompt's parse and behind the global setting.", "per_event_budget_impact": "Lazy chunk, 46,766 B measured; the dispatch bundle carries one LAZY_CONCERNS row and measures 1,602,250 B against the unchanged 1,915,000 B backstop. Per prompt: one settings load, one ≤ 1 KB state read and write under the user-global state directory; at a milestone one streaming byte scan of the transcript for title markers and about 420 B of context.", "reason": "Owner directive 2026-11-26 (agents/evidence/owner-directives/2026-11-26-session-titles-that-sharpen.md, ADR-305): titles sharpen as the session learns, the agent phrases them, a /rename title is final, global switch on by default."}
diff --git a/agents/evidence/metrics/evaluator-measurements.json b/agents/evidence/metrics/evaluator-measurements.json
index 420a713810..dff0acd172 100644
--- a/agents/evidence/metrics/evaluator-measurements.json
+++ b/agents/evidence/metrics/evaluator-measurements.json
@@ -1,12 +1,12 @@
 {
     "schema_version": 1,
     "_comment": "Written by src/scripts/record_evaluator_measurements.mjs, invoked from src/scripts/evaluator_umbrella.sh when UMBRELLA_RECORD=1 (the nightly). check_evaluator_budgets.ts --recorded compares a fresh measurement set against this file; a contradiction on a DETERMINISTIC metric warns on main and fails on release. Do not hand-edit — refresh it from a real run.",
-    "recorded_at": "2026-11-24T13:46:24.168Z",
-    "git_sha": "9b6242da90e7cb7b865a3f91627b590804d3842f",
-    "run_url": "https://github.com/event4u-app/agent-config/actions/runs/45406431322",
-    "conditions": "Linux/x86_64 · node v22.23.2 · npm 10.9.8 · npm install --omit=dev from a LOCAL tarball (no registry round-trip for the package itself; a real first-touch install adds registry latency)",
+    "recorded_at": "2026-11-26T17:24:22.596Z",
+    "git_sha": "3c75931f132c0491046c2e111b022011ee4754c5",
+    "run_url": null,
+    "conditions": "Linux/x86_64 · node v22.23.2 · npm 10.9.8 · npm install --omit=dev from a LOCAL tarball (no registry round-trip for the package itself; a real first-touch install adds registry latency) · cli_help_command_count re-counted from src/cli/registry.ts on 2026-11-26 (ADR-305); other metrics carried from the 2026-11-24 nightly",
     "measurements": {
-        "cli_help_command_count": 130,
+        "cli_help_command_count": 131,
         "cli_version_cold_ms": 371,
         "cold_start_conditions": "Linux/x86_64 · node v22.23.2 · npm 10.9.8 · npm install --omit=dev from a LOCAL tarball (no registry round-trip for the package itself; a real first-touch install adds registry latency)",
         "cold_start_install_to_doctor_ms": 13249,
diff --git a/agents/evidence/owner-directives/2026-11-26-session-titles-that-sharpen.md b/agents/evidence/owner-directives/2026-11-26-session-titles-that-sharpen.md
new file mode 100644
index 0000000000..62e0dc15c5
--- /dev/null
+++ b/agents/evidence/owner-directives/2026-11-26-session-titles-that-sharpen.md
@@ -0,0 +1,24 @@
+<!-- evidence-type: analysis -->
+
+# Owner directive — session titles that sharpen as the session learns
+
+| Field | Value |
+|---|---|
+| Ordered by | the repository owner, in chat |
+| Date | 2026-11-26 |
+| Scope | a `session-title` concern, the `session:title` CLI, and the global setting `sessions.auto_title` (default `true`) |
+| Grants by itself | the feature and its default. It lowers no test, CI gate or Hard-Floor obligation |
+
+**Context.** Agent Switch lists sessions by their host title. Claude Code writes
+its `ai-title` once and then repeats the same value: across the eight most recent
+transcripts of this checkout, each carried exactly one distinct `ai-title` value,
+repeated between 6 and 452 times. A session named from its first prompt keeps that
+name however far the work moves.
+
+Owner, verbatim:
+
+> Könenn wir dafür sorgen, dass der Name einer Session sich immer weiter verbessert und klarer wird, je mehr Informationen wir haben? Und nur wenn der Nutzer selbst die Session umbenennt, dann ändern wir ihn nicht mehr. Aber so hätten wir in Agent Switch eine Bessere Darstellung der Sessions. Das ganze könenn wir ja so gestalten, dass man es über eine Anweisung ein und ausschalten kann. Per default ist es aber an. Und es ist eine globale einstellung. <!-- md-language-check: ignore -->
+
+Asked who should phrase the better title — the agent itself on a milestone nudge,
+a separate small-model call, or a deterministic rule from branch and PR — the
+owner chose **the agent itself**.
diff --git a/agents/roadmaps/stubs/road-to-session-titles-beyond-claude.md b/agents/roadmaps/stubs/road-to-session-titles-beyond-claude.md
new file mode 100644
index 0000000000..a8f939525f
--- /dev/null
+++ b/agents/roadmaps/stubs/road-to-session-titles-beyond-claude.md
@@ -0,0 +1,33 @@
+---
+complexity: lightweight
+review_by: 2027-02-28
+estate_growth_exempt: "+1 concern_count for session-title (2026-11-26, ADR-305): at prompt milestones it asks the agent whether the session title can be named more precisely and how to publish it, silent once the user renamed the session or `sessions.auto_title` is false. Owner-ordered, recorded in agents/evidence/owner-directives/2026-11-26-session-titles-that-sharpen.md. The two follow-ups below stay a stub."
+---
+
+# Stub: session titles beyond Claude Code, and whether the nudge is followed
+
+> **Stub — not active work.** Created 2026-11-26 with ADR-305.
+
+ADR-305 ships refined session titles for Claude Code only: the `session-title`
+concern is bound on claude `user_prompt_submit`, and the readers that prefer the
+sidecar (`sessions:catalog`, Agent Switch) resolve Claude transcripts. Two things
+stay open.
+
+**Other hosts.** Codex sessions appear in `sessions:catalog` with whatever title
+the rollout carries, and nothing refines it.
+
+**Trigger.** The owner asks for refined titles on a second host, or Agent Switch
+starts listing a host whose sessions carry no usable title.
+
+**Then.** Bind the concern on that host's prompt slot, key the sidecar off that
+host's session file, and teach its reader the same precedence.
+
+**Compliance.** Nothing measures whether the agent acts on the nudge; a session
+whose agent ignores it keeps the host title. The sidecar's `revision` against the
+state file's `last_nudge_prompt` is the measurement, and it is not taken.
+
+**Trigger.** A month of real sessions after release, or a report that titles do
+not move.
+
+**Then.** Count sessions with a nudge and no sidecar, per host model; if the rate
+is high, tighten the nudge wording before considering a different carrier.
diff --git a/docs/contracts/settings-classes.md b/docs/contracts/settings-classes.md
index cd1e842bd6..c0e6095165 100644
--- a/docs/contracts/settings-classes.md
+++ b/docs/contracts/settings-classes.md
@@ -248,10 +248,12 @@ dispatch runs, not WHETHER the layer exists, so they keep their own C rows.
 
 | Class | Keys |
 |---|---|
-| A — preference | 11 |
+| A — preference | 12 |
 | B — consent | 4 |
 | C — guarded | 104 |
-| **Total** | **119** |
+| **Total** | **120** |
+
+It rose to 120 on 2026-11-26 when `sessions.auto_title` was added — one A, `un-inferrable`: whether session titles keep sharpening is the user's taste, the worst case is a worse title in a sidecar file, and the owner asked for it to be switchable by instruction, which only class A allows. It ships `true` by the owner's request of 2026-11-26 and is whitelisted in `MERGEABLE_KEYS`, because it is meant to be set once, user-global.
 
 It rose to 119 on 2026-11-04 when `road-to-an-observation-provider-slot` step 1.1 added `reconstruction.observation_providers` — one C, `un-inferrable`: the roadmap planned it as class A, but it is a list of evidence sources whose observations may close ledger rows and it decides which MCP server the reference door calls, so C-tests 2 and 5 fire and the plan yielded to this contract.
 
@@ -411,10 +413,10 @@ the template, which is the drift this contract exists to prevent.
 | Disposition | Keys |
 |---|---|
 | derivable | 33 |
-| un-inferrable | 12 |
+| un-inferrable | 13 |
 | consent | 54 |
 | policy | 20 |
-| **Total** | **119** |
+| **Total** | **120** |
 
 First measured 2026-08-12 at 140 leaves (derivable 88 · consent 38 ·
 un-inferrable 9 · policy 5), from the table below rather than predicted — the
@@ -593,6 +595,7 @@ Rows follow template order, so a diff against the template reads straight down.
 | `commands.create_pr.screenshots` | C | `false` | puts captured screenshots into a published PR body | consent |
 | `continuity.auto_record` | C | `"on"` | arms an automatic producer on the normal session-end path | consent |
 | `continuity.run_checkpoints` | C | `"on"` | disabling it removes a recovery artifact a killed run resumes from | consent |
+| `sessions.auto_title` | A | `true` | lets the agent replace the host's one-shot session title with a sharper one at prompt milestones; a `/rename` title stays final, and nothing outside the title sidecar changes | un-inferrable |
 | `retro.enabled` | C | `true` | arms automatic producers on the merge, push and first-session paths (ADR-292) | consent |
 | `memory.redact_patterns` | C | `[]` | deny-list of secret and PII regexes | policy |
 | `memory.session_index` | A | `"off"` | injects a compact index at session start | derivable — the row cap and index cost the mechanism already computes; the flag only holds an unproven ship-criterion open |
diff --git a/docs/decisions/ADR-305-session-titles-that-sharpen.md b/docs/decisions/ADR-305-session-titles-that-sharpen.md
new file mode 100644
index 0000000000..61812aa78a
--- /dev/null
+++ b/docs/decisions/ADR-305-session-titles-that-sharpen.md
@@ -0,0 +1,73 @@
+---
+adr: 305
+status: accepted
+date: 2026-11-26
+decision: session-titles-that-sharpen
+supersedes: —
+superseded_by: —
+phase: owner directive 2026-11-26
+type: structural
+reopen_policy: unclassified
+protected_dimensions: none
+provenance:
+  kind: agentic
+  agentic_mode: single
+  decision_makers: [agent]
+  human_directed: true
+evidence:
+  strength: E1
+  basis:
+    - agents/evidence/owner-directives/2026-11-26-session-titles-that-sharpen.md
+review_trigger: >-
+  Reopened when a host starts refreshing its own generated title, when Claude
+  Code objects to or removes files beside a transcript, or when the nudge is
+  found to be ignored often enough that titles do not move.
+---
+
+# ADR-305 — Session titles sharpen as the session learns; a user's title is final
+
+## Context
+
+Claude Code writes an `ai-title` once, early, and repeats that value for the rest
+of the session. Agent Switch and `sessions:catalog` show it, so a session keeps
+the name of its first prompt. The owner asked for titles that improve as more is
+known, frozen once the user renames the session, switchable by instruction, on by
+default, and global.
+
+## Decision
+
+1. **The agent phrases the title** (owner's choice over a separate model call and
+   a deterministic rule). The `session-title` concern on claude
+   `user_prompt_submit` counts real prompts and, at milestones 3, 8, 20, 45, 100
+   and every 100 after, injects one line asking whether the goal can now be named
+   more precisely. The agent publishes with `agent-config session:title`.
+2. **A user title is final.** A `custom-title` line in the transcript (`/rename`)
+   silences the nudge and makes `session:title` refuse. Readers resolve
+   user title > refined title > host title.
+3. **The refined title lives in a sidecar** `<session>.agent-title.json` beside
+   the transcript. The transcript is never written: the host keeps re-appending
+   its cached `ai-title`, which would bury an appended line. Beside the `.jsonl`,
+   any reader that already resolved a transcript finds it without knowing this
+   package's paths.
+4. **`sessions.auto_title`** — class A, default `true`, and added to
+   `MERGEABLE_KEYS` so the user-global value `settings:set` writes survives the
+   merge. A project value still wins.
+
+## Consequences
+
+- Cost: one line of context at a handful of prompts per session, plus one CLI
+  call when the agent decides the title should change. No spend outside the
+  session.
+- Model-carried: nothing verifies the agent acts on the nudge; a session whose
+  agent ignores it keeps the host title, which is today's behaviour.
+- Agent Switch must read the sidecar and honour `custom-title` to show the
+  result; that change lives in its own repository.
+
+## Alternatives
+
+- **A small-model call from the hook** — reliable cadence, but quota or spend and
+  prompt text leaving the hook process. Rejected by the owner.
+- **Deterministic from branch, PR and roadmap** — free, but technical and absent
+  in sessions without a branch. Rejected by the owner.
+- **Appending an `ai-title` line to the transcript** — rejected: the host's
+  repeated cached title supersedes it within a turn.
diff --git a/src/cli/registry.ts b/src/cli/registry.ts
index f1538a3b09..624ffcce0b 100644
--- a/src/cli/registry.ts
+++ b/src/cli/registry.ts
@@ -86,6 +86,7 @@ export const REGISTRY: readonly CommandEntry[] = [
     { name: 'use', disposition: 'delegate', synopsis: 'Switch the active experience/profile (writes profile.id).' },
     { name: 'sessions:list', disposition: 'delegate', synopsis: 'List live agent sessions plus unmerged branches held by other worktrees; --json, --branches.' },
     { name: 'sessions:catalog', disposition: 'delegate', synopsis: 'Every Claude Code and Codex session on this machine, newest first, with profile, model, repos/branches, tokens and resume command; refreshes sessions.json + SESSIONS.md; --json, --all, --status, --live.' },
+    { name: 'session:title', disposition: 'delegate', synopsis: 'Set (or --show) the refined title of a session; a title the user set with /rename is never overridden.' },
     { name: 'sessions:claim', disposition: 'delegate', synopsis: 'Claim a roadmap for this session so other sessions skip it; --release clears it.' },
     { name: 'session:recycle', disposition: 'delegate', synopsis: 'Validate + write the main-session recycle envelope (--verify validates only, --project names the repo); the successor resumes from it after /clear.' },
     { name: 'roadmap:context', disposition: 'delegate', synopsis: 'One live situational-awareness probe: open PRs + their file sets, roadmap-tail branches, live sessions, inbox note names, sibling-roadmap keyword hits; --roadmap <slug>, --json.' },
diff --git a/src/config/agent-settings.template.yml b/src/config/agent-settings.template.yml
index 3a20847a30..22010fc9fc 100644
--- a/src/config/agent-settings.template.yml
+++ b/src/config/agent-settings.template.yml
@@ -1105,6 +1105,17 @@ continuity:
   #   off = no checkpoint; every other session-end handler is unaffected.
   run_checkpoints: "on"
 
+# Session titles that sharpen as the session learns (`session-title` concern,
+# `agent-config session:title`). Claude Code names a session once, from its first
+# prompt; with this on, the agent is asked at a few prompt milestones whether the
+# goal can now be named more precisely, and publishes the better title in a
+# sidecar beside the transcript that Agent Switch and `sessions:catalog` read.
+# A title the user set with /rename is final and is never replaced.
+# A GLOBAL preference — set it once, user-global, and every checkout follows:
+#   agent-config settings:set sessions.auto_title false
+sessions:
+  auto_title: true
+
 # Automatic retro after merged work (ADR-292, docs/contracts/retro-v1.md).
 retro:
   # On by default by the owner's directive of 2026-10-12. A merged pull request
diff --git a/src/scripts/_cli/cmd_script.ts b/src/scripts/_cli/cmd_script.ts
index 7099b2e4db..fe3c769796 100644
--- a/src/scripts/_cli/cmd_script.ts
+++ b/src/scripts/_cli/cmd_script.ts
@@ -112,6 +112,7 @@ export const DELEGATES: Readonly<Record<string, Delegate>> = {
     self_repair_cli: d(async (a) => (await import('../self_repair_cli.js')).main(a), true),
     sessions_catalog_cli: d(async (a) => (await import('../sessions_catalog_cli.js')).cmd_catalog(a), true),
     sessions_cli: d(async (a) => (await import('../sessions_cli.js')).main(a), true),
+    session_title_cli: d(async (a) => (await import('../session_title_cli.js')).cmd_session_title(a), true),
     workspace_doctor: d(async (a) => (await import('../workspace_doctor.js')).main(a), true),
     worktree_cleanup_check: d(async (a) => {
         try {
diff --git a/src/scripts/_dispatch.bash b/src/scripts/_dispatch.bash
index 627d1e76fa..824c40d6b8 100755
--- a/src/scripts/_dispatch.bash
+++ b/src/scripts/_dispatch.bash
@@ -264,7 +264,10 @@ Tier 2 — maintenance / internal (hooks, MCP, memory, telemetry):
                              first: profile, model, repos/branches, tokens, resume.
                              Refreshes ~/.event4u/agent-config/sessions.json + SESSIONS.md.
                              Flags: --json, --all, --limit N, --status S, --live
-  session:recycle            Validate + write the main-session recycle envelope (--verify validates only)
+  session:title              Set the refined title of a session: --session <id> "<title>",
+                             or --show. A /rename title is final and never overridden.
+                             Off globally: settings:set sessions.auto_title false
+  session:recycle           Validate + write the main-session recycle envelope (--verify validates only)
                              (deliberate recycle instead of auto-compact). Flags:
                              --file <json> | --template; default reads stdin
   roadmap:context            One live situational-awareness probe: open PRs and the
@@ -634,7 +637,7 @@ cli_delegate_bundle() {
 # config — in every install that ships no tsx. Must match `DELEGATES` in
 # cmd_script.ts; tests/scripts/runtime_dependencies.test.ts pins both that and
 # that every `src/scripts/` dispatcher route outside the bundled roots is listed.
-SCRIPT_DELEGATES=" advisories agent_actions_detect audit_security benchmark bracket/cli chat_history check_proposal code_audit conformance_scan context_hygiene_hook council_cli decision_memo derive_live_surfaces discovery_graph generate_capabilities_index hook_effect_doctor hooks/replay_hook hooks_doctor hooks_status knowledge_global_cli learning_sidecar linked_projects_list mcp_render media_bundle memory_lookup onboarding_gate_hook profile_use reach_doctor refine_ticket_detect roadmap_context roadmap_progress_hook routing_doctor run_supervise security_audit_config self_repair_cli sessions_catalog_cli sessions_cli workspace_doctor worktree_cleanup_check "
+SCRIPT_DELEGATES=" advisories agent_actions_detect audit_security benchmark bracket/cli chat_history check_proposal code_audit conformance_scan context_hygiene_hook council_cli decision_memo derive_live_surfaces discovery_graph generate_capabilities_index hook_effect_doctor hooks/replay_hook hooks_doctor hooks_status knowledge_global_cli learning_sidecar linked_projects_list mcp_render media_bundle memory_lookup onboarding_gate_hook profile_use reach_doctor refine_ticket_detect roadmap_context roadmap_progress_hook routing_doctor run_supervise security_audit_config self_repair_cli sessions_catalog_cli sessions_cli session_title_cli workspace_doctor worktree_cleanup_check "
 
 # Echo the cmd_script key for an absolute `src/scripts/<key>.ts`, or nothing.
 script_delegate_key() {
@@ -915,6 +918,10 @@ cmd_sessions_catalog() {
   exec_ts "$PACKAGE_ROOT/src/scripts/sessions_catalog_cli.ts" "$@"
 }
 
+cmd_session_title() {
+  exec_ts "$PACKAGE_ROOT/src/scripts/session_title_cli.ts" "$@"
+}
+
 # Main-session recycle envelope producer (road-to-token-economy-recycling
 # Phase 2.2). PACKAGE_ROOT: imports src/scripts/_lib/ (capsule schema) and
 # src/scripts/hooks/state_io.ts, which are never projected into
@@ -1822,6 +1829,7 @@ main() {
     sessions:list)           cmd_sessions_list "$@" ;;
     sessions:catalog)        cmd_sessions_catalog "$@" ;;
     sessions:claim)          cmd_sessions_claim "$@" ;;
+    session:title)           cmd_session_title "$@" ;;
     session:recycle)         cmd_session_recycle "$@" ;;
     packs:active)            cmd_packs_active "$@" ;;
     settings:get)            cmd_settings_get "$@" ;;
diff --git a/src/scripts/_lib/agent_settings.ts b/src/scripts/_lib/agent_settings.ts
index 99a4964d96..6e839d9c94 100644
--- a/src/scripts/_lib/agent_settings.ts
+++ b/src/scripts/_lib/agent_settings.ts
@@ -306,6 +306,12 @@ export const MERGEABLE_KEYS: readonly string[] = [
     // own value to honour it — without this row the off switch would be
     // discarded silently. A project value still wins.
     'retro.enabled',
+    // `sessions.auto_title` is a GLOBAL preference by the owner's request of
+    // 2026-11-26: whether session titles keep sharpening is decided once per
+    // developer, and `settings:set` writes it user-global — without this row the
+    // off switch it writes would be discarded at the merge. A project value
+    // still wins.
+    'sessions.auto_title',
 ];
 
 /** The shipped template, relative to the package root. */
diff --git a/src/scripts/_lib/session_catalog.ts b/src/scripts/_lib/session_catalog.ts
index daed1ad101..5e3840c280 100644
--- a/src/scripts/_lib/session_catalog.ts
+++ b/src/scripts/_lib/session_catalog.ts
@@ -28,6 +28,7 @@ import { rawKeyPrefixPattern } from './egress_rules.js';
 import { write_atomic } from './fs_atomic.js';
 import { claudeHomeInfo, codexHomeInfo } from './provider_home.js';
 import { iso_now, ttl_seconds_for } from './session_register.js';
+import { readRefinedTitle } from './session_title.js';
 import { DEFAULT_EVENT4U_ROOT_RELATIVE, type EnvMap, event4u_root } from './user_global_paths.js';
 
 export const CATALOG_SCHEMA_VERSION = 1;
@@ -1206,7 +1207,8 @@ export function build_index(options: BuildOptions = {}): CatalogIndex {
             status,
             live: rec !== null,
             idle_seconds: idle,
-            title: st.title,
+            // User's own title > the agent's refined one (session_title.ts) > the host's.
+            title: st.title_custom ? st.title : (readRefinedTitle(t.file)?.title ?? st.title),
             roadmap_slug: rec?.roadmap_slug ?? null,
             repos: repos_for(st, git_cache),
             usage: st.usage,
diff --git a/src/scripts/_lib/session_title.ts b/src/scripts/_lib/session_title.ts
new file mode 100644
index 0000000000..ebfda3164a
--- /dev/null
+++ b/src/scripts/_lib/session_title.ts
@@ -0,0 +1,195 @@
+/**
+ * Refined session titles — the shared half of the `session-title` concern and
+ * the `session:title` CLI.
+ *
+ * Claude Code writes its `ai-title` once, early, and then repeats the same value
+ * for the rest of the session, so a title chosen from the first prompt is the
+ * title forever. This module lets the agent replace it as the session's goal
+ * becomes clear, under one invariant: a title the USER set (`/rename`, recorded
+ * as a `custom-title` line) is final, and nothing here ever overrides it.
+ *
+ * Two files, deliberately separate:
+ *
+ * - the SIDECAR beside the transcript (`<session>.agent-title.json`) is the
+ *   published title. It sits next to the `.jsonl` so any reader that already
+ *   resolved a transcript (the session catalog, Agent Switch) finds it without
+ *   knowing this package's paths. The transcript itself is never written to:
+ *   Claude Code keeps re-appending its cached `ai-title`, which would bury an
+ *   appended line within a turn.
+ * - the STATE file under the user-global root counts prompts and maps the
+ *   session id to its transcript, so the CLI needs nothing but the id.
+ *
+ * Privacy: neither file holds prompt or reply text — a title, a counter, a path.
+ */
+import fs from "node:fs";
+import path from "node:path";
+import { write_atomic } from "./fs_atomic.js";
+import { event4u_root } from "./user_global_paths.js";
+
+export const SETTING_KEY = "sessions.auto_title";
+export const SIDECAR_SUFFIX = ".agent-title.json";
+export const TITLE_MAX = 80;
+
+/**
+ * Prompt counts at which the agent is asked to reconsider the title. Spaced
+ * out because a title should change when the session learned something, not on
+ * a clock: early milestones catch the goal settling, later ones the scope
+ * moving. Past the last entry the cadence repeats every `REPEAT_EVERY` prompts.
+ */
+export const MILESTONES: readonly number[] = [3, 8, 20, 45, 100];
+export const REPEAT_EVERY = 100;
+
+export function isMilestone(prompt: number): boolean {
+  if (MILESTONES.includes(prompt)) return true;
+  const last = MILESTONES[MILESTONES.length - 1] as number;
+  return prompt > last && (prompt - last) % REPEAT_EVERY === 0;
+}
+
+/** A session id as a filename stem; anything else collapses to `_`. */
+export function safeId(sessionId: string): string {
+  return sessionId.replace(/[^A-Za-z0-9._-]/g, "_").replace(/^\.+/, "_").slice(0, 128) || "_";
+}
+
+export function sidecarPath(transcriptPath: string): string {
+  return transcriptPath.replace(/\.jsonl$/, "") + SIDECAR_SUFFIX;
+}
+
+/** Control characters and runaway length stripped; empty → null. */
+export function sanitizeTitle(raw: string): string | null {
+  const t = raw.replace(/[\u0000-\u001f\u007f-\u009f]/g, " ").replace(/\s+/g, " ").trim();
+  if (t === "") return null;
+  return t.length > TITLE_MAX ? `${t.slice(0, TITLE_MAX - 1)}…` : t;
+}
+
+export interface SessionTitleState {
+  session_id: string;
+  transcript_path: string | null;
+  prompts: number;
+  last_nudge_prompt: number;
+}
+
+export function stateDir(root: string = event4u_root()): string {
+  return path.join(root, "state", "session-titles");
+}
+
+export function readState(sessionId: string, root?: string): SessionTitleState | null {
+  try {
+    const raw = JSON.parse(fs.readFileSync(path.join(stateDir(root), `${safeId(sessionId)}.json`), "utf8"));
+    if (typeof raw !== "object" || raw === null || raw.session_id !== sessionId) return null;
+    return {
+      session_id: sessionId,
+      transcript_path: typeof raw.transcript_path === "string" ? raw.transcript_path : null,
+      prompts: Number.isInteger(raw.prompts) && raw.prompts >= 0 ? raw.prompts : 0,
+      last_nudge_prompt: Number.isInteger(raw.last_nudge_prompt) ? raw.last_nudge_prompt : 0,
+    };
+  } catch {
+    return null;
+  }
+}
+
+export function writeState(state: SessionTitleState, root?: string): void {
+  write_atomic(path.join(stateDir(root), `${safeId(state.session_id)}.json`), `${JSON.stringify(state)}\n`);
+}
+
+export interface RefinedTitle {
+  title: string;
+  updated_at: string;
+  revision: number;
+}
+
+export function readRefinedTitle(transcriptPath: string): RefinedTitle | null {
+  try {
+    const raw = JSON.parse(fs.readFileSync(sidecarPath(transcriptPath), "utf8"));
+    const title = typeof raw?.title === "string" ? sanitizeTitle(raw.title) : null;
+    if (title === null) return null;
+    return {
+      title,
+      updated_at: typeof raw.updated_at === "string" ? raw.updated_at : "",
+      revision: Number.isInteger(raw.revision) ? raw.revision : 1,
+    };
+  } catch {
+    return null;
+  }
+}
+
+export function writeRefinedTitle(transcriptPath: string, sessionId: string, title: string, now: Date = new Date()): RefinedTitle {
+  const prev = readRefinedTitle(transcriptPath);
+  const next: RefinedTitle = { title, updated_at: now.toISOString(), revision: (prev?.revision ?? 0) + 1 };
+  write_atomic(sidecarPath(transcriptPath), `${JSON.stringify({ schema: 1, session_id: sessionId, ...next })}\n`);
+  return next;
+}
+
+export interface HostTitles {
+  /** The user's own title (`/rename`); when set, the session title is frozen. */
+  custom: string | null;
+  /** The host's latest generated title. */
+  ai: string | null;
+}
+
+const CHUNK = 1 << 20;
+const CUSTOM_MARK = '"type":"custom-title"';
+const AI_MARK = '"type":"ai-title"';
+
+function titleFrom(line: string, key: string): string | null {
+  try {
+    const v = JSON.parse(line)?.[key];
+    return typeof v === "string" ? sanitizeTitle(v) : null;
+  } catch {
+    return null;
+  }
+}
+
+/**
+ * The host-side titles in one streaming pass. Only lines carrying a marker are
+ * parsed, so a 20 MB transcript costs a byte scan, not 20 MB of JSON. The last
+ * occurrence of each wins, as it does for the host.
+ */
+export function readHostTitles(transcriptPath: string): HostTitles {
+  const out: HostTitles = { custom: null, ai: null };
+  let fd: number;
+  try {
+    fd = fs.openSync(transcriptPath, "r");
+  } catch {
+    return out;
+  }
+  try {
+    const buf = Buffer.alloc(CHUNK);
+    let carry = "";
+    for (;;) {
+      const n = fs.readSync(fd, buf, 0, CHUNK, null);
+      if (n === 0) break;
+      const text = carry + buf.subarray(0, n).toString("utf8");
+      const lines = text.split("\n");
+      carry = lines.pop() ?? "";
+      for (const line of lines) scanLine(line, out);
+    }
+    if (carry !== "") scanLine(carry, out);
+  } catch {
+    // A transcript that cannot be read leaves whatever was found so far.
+  } finally {
+    fs.closeSync(fd);
+  }
+  return out;
+}
+
+function scanLine(line: string, out: HostTitles): void {
+  if (line.includes(CUSTOM_MARK)) out.custom = titleFrom(line, "customTitle") ?? out.custom;
+  else if (line.includes(AI_MARK)) out.ai = titleFrom(line, "aiTitle") ?? out.ai;
+}
+
+/** The title a reader should show: user's own > refined > host-generated. */
+export function effectiveTitle(transcriptPath: string): { title: string | null; source: "custom" | "refined" | "ai" | null } {
+  const host = readHostTitles(transcriptPath);
+  if (host.custom !== null) return { title: host.custom, source: "custom" };
+  const refined = readRefinedTitle(transcriptPath);
+  if (refined !== null) return { title: refined.title, source: "refined" };
+  return host.ai !== null ? { title: host.ai, source: "ai" } : { title: null, source: null };
+}
+
+/** `false` only when the setting is explicitly off; absent means on. */
+export function autoTitleEnabled(settings: Record<string, unknown>): boolean {
+  const sessions = settings["sessions"];
+  if (typeof sessions !== "object" || sessions === null) return true;
+  const v = (sessions as Record<string, unknown>)["auto_title"];
+  return !(v === false || v === "false" || v === "off");
+}
diff --git a/src/scripts/hook_chunks.mjs b/src/scripts/hook_chunks.mjs
index 489ae07d60..7ab6adfbb7 100644
--- a/src/scripts/hook_chunks.mjs
+++ b/src/scripts/hook_chunks.mjs
@@ -118,6 +118,13 @@ export const HOOK_CHUNKS = Object.freeze([
         entry: 'src/scripts/hooks/intake_pass_hook.ts',
         outfile: 'dist/hooks/intake_pass.chunk.cjs',
     }),
+    // `session-title` on claude `user_prompt_submit`. `yaml` external for the
+    // reason given at `chat_history`: the concern reads `sessions.auto_title`.
+    Object.freeze({
+        entry: 'src/scripts/hooks/session_title_hook.ts',
+        outfile: 'dist/hooks/session_title.chunk.cjs',
+        external: Object.freeze(['yaml']),
+    }),
     // `arena-route` on claude `pre_tool_use`, Workflow calls only; reads no YAML.
     Object.freeze({
         entry: 'src/scripts/hooks/arena_route_hook.ts',
diff --git a/src/scripts/hook_manifest.yaml b/src/scripts/hook_manifest.yaml
index 263b2b7805..5b613ec0c3 100644
--- a/src/scripts/hook_manifest.yaml
+++ b/src/scripts/hook_manifest.yaml
@@ -1127,6 +1127,19 @@ concerns:
     fail_closed: false
     severity: advisory
     effect: context
+  # Session titles that sharpen as the session learns. Claude Code writes its
+  # `ai-title` once and repeats it; at prompt milestones (3, 8, 20, 45, 100,
+  # then every 100) this asks the agent whether the goal can now be named more
+  # precisely and how to publish it (`agent-config session:title`). Silent
+  # between milestones, after the user renamed the session (a `custom-title`
+  # is final), and when `sessions.auto_title: false` — a global setting, on by
+  # default. Claude only: no other host writes a title this could refine.
+  session-title:
+    script: src/scripts/hooks/session_title_hook.ts
+    args: []
+    fail_closed: false
+    severity: advisory
+    effect: context
   # road-to-trigger-delivered-rule-bodies Phase 1 — the DELIVERY twin of
   # `skill-route` above: same two slots, opposite payload policy. `skill-route`
   # ships pointers because a skill is invoked; this ships BODIES because a rule
@@ -1761,7 +1774,7 @@ roles:
     # contacts, so a worker turn that ends in a question to its orchestrator
     # would be recorded as a contact that never reached a human, inflating the
     # exact baseline Phase 0 pre-registers.
-    drop: [delegation-nudge, skill-route, intake-pass, end-review-nudge, review-baseline, council-availability, team-review-gate, self-repair, session-eol, interruption-ledger]
+    drop: [delegation-nudge, skill-route, intake-pass, end-review-nudge, review-baseline, council-availability, team-review-gate, self-repair, session-eol, interruption-ledger, session-title]
 
 platforms:
   # `ask:` — the SHAPE of this host's user-facing question primitive.
@@ -1803,7 +1816,7 @@ platforms:
     # was not restored at all.
     session_end:      [chat-history, memory-learn, session-register, roadmap-progress, telemetry-flush, journal-record]
     stop:             [chat-history, verify-before-complete, team-review-gate, end-review-nudge, obligation-settle, turn-end-gate, self-repair, session-register, session-eol, interruption-ledger, roadmap-progress, design-pass-stop, suggestion-capture, code-graph-refresh, journal-record]
-    user_prompt_submit: [chat-history, verify-before-complete, minimal-safe-diff, language-mirror, delegation-nudge, skill-route, git-authorization, session-canary, self-repair, session-register, rule-inject, suggestion-capture, journal-record, quota-notice, intake-pass]
+    user_prompt_submit: [chat-history, verify-before-complete, minimal-safe-diff, language-mirror, delegation-nudge, skill-route, git-authorization, session-canary, self-repair, session-register, rule-inject, suggestion-capture, journal-record, quota-notice, intake-pass, session-title]
     # `rule-inject` was bound here and is not any more
     # (road-to-delivery-for-every-host 3.2, owner ruling E2). E2's strategy is
     # `user_prompt_submit` + `pre_compact`; this slot is the hottest one in the
diff --git a/src/scripts/hooks/lazy_concern.ts b/src/scripts/hooks/lazy_concern.ts
index 5ec1a78ea1..03f2ce78ec 100644
--- a/src/scripts/hooks/lazy_concern.ts
+++ b/src/scripts/hooks/lazy_concern.ts
@@ -69,6 +69,7 @@ export const LAZY_CONCERNS: Readonly<Record<string, { readonly chunk: string; re
     'src/scripts/quota_notice_hook.ts': lazy('quota_notice.chunk.cjs', '../quota_notice_hook'),
     'src/scripts/hooks/layer_promotion_hook.ts': lazy('layer_promotion.chunk.cjs', 'layer_promotion_hook'),
     'src/scripts/hooks/intake_pass_hook.ts': lazy('intake_pass.chunk.cjs', 'intake_pass_hook'),
+    'src/scripts/hooks/session_title_hook.ts': lazy('session_title.chunk.cjs', 'session_title_hook'),
     'src/scripts/hooks/arena_route_hook.ts': lazy('arena_route.chunk.cjs', 'arena_route_hook'),
     'src/scripts/self_repair_hook.ts': lazy('self_repair.chunk.cjs', '../self_repair_hook'),
     'src/scripts/hooks/compact_checkpoint_hook.ts': lazy('compact_checkpoint.chunk.cjs', 'compact_checkpoint_hook'),
diff --git a/src/scripts/hooks/session_title_hook.ts b/src/scripts/hooks/session_title_hook.ts
new file mode 100644
index 0000000000..64b2485568
--- /dev/null
+++ b/src/scripts/hooks/session_title_hook.ts
@@ -0,0 +1,131 @@
+/**
+ * session-title — asks the agent, at a few prompt milestones, whether the
+ * session title can now be named more precisely, and how to set it.
+ *
+ * The agent writes the title (`agent-config session:title`); this concern only
+ * counts prompts and decides when to ask. It stays silent once the user renamed
+ * the session — a user-set title is final — and when `sessions.auto_title` is
+ * `false` (a global setting, on by default). Never blocks: every failure path
+ * returns allow.
+ */
+import fs from "node:fs";
+import path from "node:path";
+import { fileURLToPath, pathToFileURL } from "node:url";
+import { readHookStdin } from "./hook_stdin.js";
+import { isSyntheticPrompt } from "../_lib/prompt_shape.js";
+import { load_agent_settings } from "../_lib/agent_settings.js";
+import {
+  autoTitleEnabled,
+  isMilestone,
+  readHostTitles,
+  readRefinedTitle,
+  readState,
+  writeState,
+  type SessionTitleState,
+} from "../_lib/session_title.js";
+import { EXIT_ALLOW, EXIT_WARN } from "./exit_codes.js";
+
+type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };
+type JsonObject = { [k: string]: JsonValue };
+
+function _isObject(v: JsonValue | undefined): v is JsonObject {
+  return typeof v === "object" && v !== null && !Array.isArray(v);
+}
+
+function _str(v: JsonValue | undefined): string | null {
+  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
+}
+
+function _extractPrompt(payload: JsonObject): string {
+  for (const key of ["prompt", "userPrompt", "user_prompt", "message", "text"]) {
+    const v = payload[key];
+    if (typeof v === "string" && v.trim()) return v;
+  }
+  return "";
+}
+
+export function nudgeLine(sessionId: string, prompt: number, current: string | null): string {
+  const now = current === null ? "none yet" : `«${current}»`;
+  return (
+    `<session-title>Prompt ${prompt}: the session title is ${now}. If what you now know names this ` +
+    `session's goal more precisely, run \`agent-config session:title --session ${sessionId} "<title>"\` once ` +
+    `alongside your work — at most 60 characters, in the user's language, naming the deliverable rather than ` +
+    `the activity. Still accurate → do nothing. Do not mention this to the user.</session-title>`
+  );
+}
+
+export interface TickInput {
+  sessionId: string;
+  transcriptPath: string;
+  prompt: string;
+  root?: string;
+}
+
+/** One prompt counted; returns the nudge to inject, or null. */
+export function tick(input: TickInput): string | null {
+  const text = input.prompt.trim();
+  if (text === "" || isSyntheticPrompt(text)) return null;
+  const prev = readState(input.sessionId, input.root);
+  const state: SessionTitleState = {
+    session_id: input.sessionId,
+    transcript_path: input.transcriptPath,
+    prompts: (prev?.prompts ?? 0) + 1,
+    last_nudge_prompt: prev?.last_nudge_prompt ?? 0,
+  };
+  let nudge: string | null = null;
+  if (isMilestone(state.prompts)) {
+    const host = readHostTitles(input.transcriptPath);
+    if (host.custom === null) {
+      nudge = nudgeLine(input.sessionId, state.prompts, readRefinedTitle(input.transcriptPath)?.title ?? host.ai);
+      state.last_nudge_prompt = state.prompts;
+    }
+  }
+  writeState(state, input.root);
+  return nudge;
+}
+
+export function main(): number {
+  let envelope: JsonValue = {};
+  try {
+    const raw = readHookStdin();
+    envelope = raw.trim() ? (JSON.parse(raw) as JsonValue) : {};
+  } catch {
+    return EXIT_ALLOW;
+  }
+  try {
+    const env: JsonObject = _isObject(envelope) ? envelope : {};
+    const event = env["event"];
+    if (typeof event === "string" && event !== "" && event !== "user_prompt_submit") return EXIT_ALLOW;
+    const payload = _isObject(env["payload"]) ? (env["payload"] as JsonObject) : env;
+    const sessionId = _str(env["session_id"]) ?? _str(payload["session_id"]);
+    const transcriptPath = _str(payload["transcript_path"]);
+    if (sessionId === null || transcriptPath === null) return EXIT_ALLOW;
+    const root = _str(env["workspace_root"]) ?? process.cwd();
+    if (!autoTitleEnabled(load_agent_settings({ cwd: root }) as Record<string, unknown>)) return EXIT_ALLOW;
+    const nudge = tick({ sessionId, transcriptPath, prompt: _extractPrompt(payload) });
+    if (nudge === null) return EXIT_ALLOW;
+    process.stdout.write(
+      `${JSON.stringify({ decision: "warn", reason: "session-title: milestone", additional_context: nudge })}\n`,
+    );
+    return EXIT_WARN;
+  } catch {
+    return EXIT_ALLOW;
+  }
+}
+
+// Bundle-safety: never auto-run when inlined into an esbuild bundle.
+declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
+function _isCliEntry(): boolean {
+  if (typeof __AGENT_CONFIG_BUNDLE__ !== "undefined" && __AGENT_CONFIG_BUNDLE__) return false;
+  if (process.argv[1] === undefined) return false;
+  if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) return true;
+  try {
+    return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(process.argv[1]));
+  } catch {
+    return false;
+  }
+}
+
+if (_isCliEntry()) {
+  process.exit(main());
+}
diff --git a/src/scripts/session_title_cli.ts b/src/scripts/session_title_cli.ts
new file mode 100644
index 0000000000..232d93d650
--- /dev/null
+++ b/src/scripts/session_title_cli.ts
@@ -0,0 +1,88 @@
+#!/usr/bin/env node
+/**
+ * `agent-config session:title` — set or show the refined title of a session.
+ *
+ *   session:title --session <id> "<title>"   publish a refined title
+ *   session:title --session <id> --show      print the title a reader would show
+ *
+ * A title the user set with `/rename` is final: setting is refused, with exit 0,
+ * because an agent that follows the `session-title` nudge did nothing wrong.
+ * `sessions.auto_title: false` refuses the same way.
+ */
+import path from 'node:path';
+import process from 'node:process';
+import { fileURLToPath } from 'node:url';
+
+import { load_agent_settings } from './_lib/agent_settings.js';
+import { clean_title } from './_lib/session_catalog.js';
+import {
+    SETTING_KEY,
+    autoTitleEnabled,
+    effectiveTitle,
+    readHostTitles,
+    readState,
+    sanitizeTitle,
+    writeRefinedTitle,
+} from './_lib/session_title.js';
+
+function usage(): number {
+    process.stderr.write('usage: agent-config session:title --session <id> ("<title>" | --show) [--transcript <path>]\n');
+    return 2;
+}
+
+export interface TitleCliOptions {
+    cwd?: string;
+    root?: string;
+    out?: (line: string) => void;
+    err?: (line: string) => void;
+}
+
+export function cmd_session_title(argv: string[] = process.argv.slice(2), opts: TitleCliOptions = {}): number {
+    const out = opts.out ?? ((l: string) => process.stdout.write(`${l}\n`));
+    const err = opts.err ?? ((l: string) => process.stderr.write(`${l}\n`));
+    let sessionId: string | null = null;
+    let transcript: string | null = null;
+    let show = false;
+    const words: string[] = [];
+    for (let i = 0; i < argv.length; i++) {
+        const a = argv[i] as string;
+        if (a === '--session') sessionId = argv[++i] ?? null;
+        else if (a === '--transcript') transcript = argv[++i] ?? null;
+        else if (a === '--show') show = true;
+        else if (a === '-h' || a === '--help') return usage();
+        else words.push(a);
+    }
+    if (sessionId === null || sessionId.trim() === '') return usage();
+    const transcriptPath = transcript ?? readState(sessionId, opts.root)?.transcript_path ?? null;
+    if (transcriptPath === null) {
+        err(`session:title: no transcript known for session ${sessionId} — pass --transcript <path>`);
+        return 1;
+    }
+    if (show) {
+        const t = effectiveTitle(transcriptPath);
+        out(t.title === null ? '(untitled)' : `${t.title} [${t.source}]`);
+        return 0;
+    }
+    if (words.length === 0) return usage();
+    const settings = load_agent_settings({ cwd: opts.cwd ?? process.cwd() }) as Record<string, unknown>;
+    if (!autoTitleEnabled(settings)) {
+        out(`session:title: skipped — ${SETTING_KEY} is false`);
+        return 0;
+    }
+    const custom = readHostTitles(transcriptPath).custom;
+    if (custom !== null) {
+        out(`session:title: skipped — the user named this session «${custom}»; that title is final`);
+        return 0;
+    }
+    const title = sanitizeTitle(clean_title(words.join(' ')));
+    if (title === null) return usage();
+    const written = writeRefinedTitle(transcriptPath, sessionId, title);
+    out(`session:title: «${written.title}» (revision ${written.revision})`);
+    return 0;
+}
+
+declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
+const _bundled = typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__;
+if (!_bundled && fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? '')) {
+    process.exit(cmd_session_title());
+}
diff --git a/tests/hooks/session_title_hook.test.ts b/tests/hooks/session_title_hook.test.ts
new file mode 100644
index 0000000000..0cd79a6400
--- /dev/null
+++ b/tests/hooks/session_title_hook.test.ts
@@ -0,0 +1,171 @@
+import fs from 'node:fs';
+import os from 'node:os';
+import path from 'node:path';
+
+import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
+
+import { clearHookStdinOverride, setHookStdinOverride } from '../../src/scripts/hooks/hook_stdin.js';
+import { main, tick } from '../../src/scripts/hooks/session_title_hook.js';
+import {
+    MILESTONES,
+    effectiveTitle,
+    isMilestone,
+    readHostTitles,
+    readState,
+    sidecarPath,
+    writeRefinedTitle,
+} from '../../src/scripts/_lib/session_title.js';
+import { cmd_session_title } from '../../src/scripts/session_title_cli.js';
+
+let tmp: string;
+let root: string;
+let transcript: string;
+const SID = 'abc-123';
+
+function line(o: Record<string, unknown>): string {
+    return `${JSON.stringify(o)}\n`;
+}
+
+function transcriptWith(...lines: Record<string, unknown>[]): void {
+    fs.writeFileSync(transcript, lines.map(line).join(''));
+}
+
+/** Count `n` real prompts, returning every nudge emitted. */
+function prompts(n: number): (string | null)[] {
+    const out: (string | null)[] = [];
+    for (let i = 0; i < n; i++) out.push(tick({ sessionId: SID, transcriptPath: transcript, prompt: `task ${i}`, root }));
+    return out;
+}
+
+beforeEach(() => {
+    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'session-title-'));
+    root = path.join(tmp, 'event4u');
+    vi.stubEnv('EVENT4U_CONFIG_HOME', root);
+    transcript = path.join(tmp, 'projects', 'p', `${SID}.jsonl`);
+    fs.mkdirSync(path.dirname(transcript), { recursive: true });
+    transcriptWith({ type: 'user', cwd: tmp }, { type: 'ai-title', aiTitle: 'Fix stuff', sessionId: SID });
+});
+
+afterEach(() => {
+    fs.rmSync(tmp, { recursive: true, force: true });
+    vi.unstubAllEnvs();
+});
+
+describe('isMilestone', () => {
+    it('fires on each listed milestone and then on the repeat cadence, nowhere else', () => {
+        const fired = Array.from({ length: 400 }, (_, i) => i + 1).filter(isMilestone);
+        const last = MILESTONES[MILESTONES.length - 1] as number;
+        expect(fired).toEqual([...MILESTONES, last + 100, last + 200, last + 300]);
+    });
+});
+
+describe('tick', () => {
+    it('nudges only at milestones, naming the current host title and the session id', () => {
+        const out = prompts(MILESTONES[1] as number);
+        const nudged = out.map((n, i) => (n === null ? null : i + 1)).filter((x) => x !== null);
+        expect(nudged).toEqual([MILESTONES[0], MILESTONES[1]]);
+        expect(out[(MILESTONES[0] as number) - 1]).toContain('«Fix stuff»');
+        expect(out[(MILESTONES[0] as number) - 1]).toContain(`--session ${SID}`);
+        expect(readState(SID, root)).toMatchObject({ prompts: MILESTONES[1], transcript_path: transcript });
+    });
+
+    it('shows the refined title, not the host one, once the agent set one', () => {
+        writeRefinedTitle(transcript, SID, 'Refactor billing export');
+        const out = prompts(MILESTONES[0] as number);
+        expect(out.at(-1)).toContain('«Refactor billing export»');
+    });
+
+    it('stays silent for good once the user renamed the session, but keeps counting', () => {
+        fs.appendFileSync(transcript, line({ type: 'custom-title', customTitle: 'Mine', sessionId: SID }));
+        expect(prompts(MILESTONES[2] as number).every((n) => n === null)).toBe(true);
+        expect(readState(SID, root)?.prompts).toBe(MILESTONES[2]);
+    });
+
+    it('does not count harness turns as prompts', () => {
+        for (let i = 0; i < 5; i++) tick({ sessionId: SID, transcriptPath: transcript, prompt: '<task-notification>x', root });
+        expect(readState(SID, root)).toBeNull();
+    });
+});
+
+describe('readHostTitles', () => {
+    it('takes the last title of each kind, across read-chunk boundaries', () => {
+        const filler = line({ type: 'assistant', text: 'x'.repeat(1024) }).repeat(1500);
+        fs.writeFileSync(
+            transcript,
+            line({ type: 'ai-title', aiTitle: 'Old' }) + filler + line({ type: 'ai-title', aiTitle: 'New' }),
+        );
+        expect(fs.statSync(transcript).size).toBeGreaterThan(1 << 20);
+        expect(readHostTitles(transcript)).toEqual({ custom: null, ai: 'New' });
+    });
+});
+
+describe('main', () => {
+    function run(workspace: string): { rc: number; out: string } {
+        let out = '';
+        const spy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => {
+            out += String(chunk);
+            return true;
+        });
+        setHookStdinOverride(
+            JSON.stringify({
+                event: 'user_prompt_submit',
+                session_id: SID,
+                workspace_root: workspace,
+                payload: { prompt: 'add the export', transcript_path: transcript },
+            }),
+        );
+        try {
+            return { rc: main(), out };
+        } finally {
+            spy.mockRestore();
+            clearHookStdinOverride();
+        }
+    }
+
+    it('emits the nudge at a milestone by default, and nothing when sessions.auto_title is false', () => {
+        const on =path.join(tmp, 'on');
+        fs.mkdirSync(on);
+        const outs = Array.from({ length: MILESTONES[0] as number }, () => run(on));
+        expect(outs.at(-1)?.out).toContain('session-title: milestone');
+        expect(outs.slice(0, -1).every((r) => r.out === '')).toBe(true);
+
+        const off = path.join(tmp, 'off');
+        fs.mkdirSync(off);
+        fs.writeFileSync(path.join(off, '.agent-settings.yml'), 'sessions:\n  auto_title: false\n');
+        fs.rmSync(path.join(root, 'state'), { recursive: true, force: true });
+        const silent = Array.from({ length: MILESTONES[1] as number }, () => run(off));
+        expect(silent.every((r) => r.out === '')).toBe(true);
+    });
+});
+
+describe('session:title CLI', () => {
+    function cli(...argv: string[]): { rc: number; out: string[] } {
+        const out: string[] = [];
+        const rc = cmd_session_title(argv, { cwd: tmp, root, out: (l) => out.push(l), err: (l) => out.push(l) });
+        return { rc, out };
+    }
+
+    it('publishes a refined title the readers prefer over the host title, revision by revision', () => {
+        prompts(1);
+        expect(cli('--session', SID, 'Billing', 'export').rc).toBe(0);
+        expect(cli('--session', SID, 'Billing CSV export').out[0]).toContain('revision 2');
+        expect(JSON.parse(fs.readFileSync(sidecarPath(transcript), 'utf8'))).toMatchObject({ title: 'Billing CSV export', revision: 2 });
+        expect(effectiveTitle(transcript)).toEqual({ title: 'Billing CSV export', source: 'refined' });
+    });
+
+    it('never overrides a title the user set', () => {
+        prompts(1);
+        fs.appendFileSync(transcript, line({ type: 'custom-title', customTitle: 'Mine' }));
+        const r = cli('--session', SID, 'Something else');
+        expect(r.rc).toBe(0);
+        expect(r.out[0]).toContain('final');
+        expect(fs.existsSync(sidecarPath(transcript))).toBe(false);
+        expect(effectiveTitle(transcript)).toEqual({ title: 'Mine', source: 'custom' });
+    });
+
+    it('fails with a hint when the session is unknown, and rejects a missing title', () => {
+        expect(cli('--session', 'nope', 'x').rc).toBe(1);
+        prompts(1);
+        expect(cli('--session', SID).rc).toBe(2);
+    });
+});
diff --git a/tests/lib/agent_settings.test.ts b/tests/lib/agent_settings.test.ts
index fe3fc18661..cceb2ef9d7 100644
--- a/tests/lib/agent_settings.test.ts
+++ b/tests/lib/agent_settings.test.ts
@@ -333,6 +333,9 @@ describe('MERGEABLE_KEYS', () => {
             // ADR-292: the retro's one switch ships `true`, so `false` is the only
             // value worth writing, and it must hold from the user-global file.
             'retro.enabled',
+            // ADR-305: a global preference by the owner's request; `settings:set`
+            // writes it user-global, so the off switch must survive the merge.
+            'sessions.auto_title',
         ]);
     });
 
diff --git a/tests/scripts/hook_role_axis.test.ts b/tests/scripts/hook_role_axis.test.ts
index 376f5831f8..6bab20cb00 100644
--- a/tests/scripts/hook_role_axis.test.ts
+++ b/tests/scripts/hook_role_axis.test.ts
@@ -54,6 +54,8 @@ const WORKER_DROP = [
     'self-repair',
     'session-eol',
     'interruption-ledger',
+    // ADR-305: the title belongs to the user's session, not to a worker slice.
+    'session-title',
 ];
 
 function manifest(): JsonObject {
diff --git a/tests/scripts/lint_hook_manifest.test.ts b/tests/scripts/lint_hook_manifest.test.ts
index 54f7ce2773..8c180ca618 100644
--- a/tests/scripts/lint_hook_manifest.test.ts
+++ b/tests/scripts/lint_hook_manifest.test.ts
@@ -380,7 +380,8 @@ describe("effect: — the census's field (Phase 2.2)", () => {
     // and 74 since `memory-audience-shadow` (road-to-a-memory-each-worker-is-handed 2.2/2.3).
     // and 75 since `compact-checkpoint` (road-to-state-and-pins-across-compaction 1.2).
     // and 76 since `arena-route` (an arena is the bracket engine, 2026-11-25).
-    expect(names.length).toBe(76);
+    // and 77 since `session-title` (ADR-305).
+    expect(names.length).toBe(77);
     const missing = names.filter((n) => !CONCERN_EFFECTS.has(String(manifest.concerns[n]?.effect)));
     expect(missing).toStrictEqual([]);
     const mismatched = names.filter(

jq -S diff of src/scripts/hook_manifest.json, base against head:
2,3c2,3
<   "body_fingerprint": "837675674723d6852f605622bfd545ef9574c3242510e4d60081389cf4385cdc:23591",
<   "fingerprint": "f4a050958d1afd52e3f1d8847a63783fe6a79677335923ea924138f6b9d2f240:124189",
---
>   "body_fingerprint": "ca7e70f1ca7daf2e6d27bde298b4812946b53b53e6f6b147c638a8efc6e80e7e:23495",
>   "fingerprint": "2a42de0b3a2dbcf07bd412df0e2b98f553917f9b5f5b953ee0f7085115f3992f:123452",
165,171d164
<         "severity": "advisory"
<       },
<       "deliberation-mode": {
<         "args": [],
<         "effect": "context",
<         "fail_closed": false,
<         "script": "src/scripts/hooks/deliberation_mode_hook.ts",
564a558,564
>         "severity": "advisory"
>       },
>       "session-title": {
>         "args": [],
>         "effect": "context",
>         "fail_closed": false,
>         "script": "src/scripts/hooks/session_title_hook.ts",
1013c1013
<           "deliberation-mode"
---
>           "session-title"
1077,1078c1077
<           "intake-pass",
<           "deliberation-mode"
---
>           "intake-pass"
1172,1173c1171
<           "intake-pass",
<           "deliberation-mode"
---
>           "intake-pass"
1237,1238c1235
<           "intake-pass",
<           "deliberation-mode"
---
>           "intake-pass"
1302,1303c1299
<           "intake-pass",
<           "deliberation-mode"
---
>           "intake-pass"
1332d1327
<           "deliberation-mode",
1339c1334,1335
<           "interruption-ledger"
---
>           "interruption-ledger",
>           "session-title"

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
