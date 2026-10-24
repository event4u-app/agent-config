<!-- evidence-type: analysis -->

# Ratification review, round 3 — binding the `layer-promote` session concern

You are an independent reviewer for a change in the `event4u/agent-config` repository: step 3.3 of `road-to-a-setup-that-decides-itself` ("promote after proof, never at install"), bound as a claude-only `session_start` hook concern. It touches files on the hook-plumbing list, so ADR-268 § 4 requires a two-provider ratification record. Full description and diff: `agents/evidence/council/layer-promote-binding-ratification-r1-20261024.question.md`; round-2 delta: `…-r2-20261024.question.md`.

Round 2 ended with one seat `ratified` and one seat `refused`, on one finding: the `thinned` marker is written before the thin pass, so a process terminated mid-pass leaves a layer recorded as thinned that the next session reads as `thinned-holds` — never retried, never restored, possibly with stale ledger digests. Both seats agreed the two round-1 findings stand closed and that authority is unchanged.

This round reviews the delta made in response, against revision `2ccfc2e7c5` (the round-2 revision). Decide whether the change may land as written now.

## What changed

- A `promoting` marker under the machine runtime root is written BEFORE the `thinned` marker and removed only AFTER the promotion record is written (and on the in-process failure path).
- At the top of `sessionLayerStep()`, before any other state is read: if `promoting` exists, the previous promotion never finished. The staged snapshot is restored (same stamp-only rule as everywhere), the ledger re-recorded for the restored files, the `thinned`/`demoted` markers cleared, `promoting` removed, and the session returns `promotion-interrupted`. The session after that decides from scratch, so the state converges to either full or a completed promotion.
- The `thinned` marker still goes before the pass, so a dead carrier on a half-thinned layer is still restored by the shell branch meanwhile (the shell branch does not read `promoting`; restoring there is the same action).
- Chunk 52,890 B (ceiling 56,800). Dispatch bundle unchanged at 1,554,423 B.

## Verification on this revision

`tests/install/layer_promotion.test.ts` — 11 cases. New: termination simulated at three points — after the markers (no file rewritten), part-way (two stubs left), and after the pass but before the promotion record — each followed by a session whose arrivals show every law loaded: each returns `promotion-interrupted` with no stub left, layer `full`, no `promoting` marker and the ledger matching disk; the following session promotes again and clears the marker. Red with the recovery block disabled.

## What to answer

1. Does the round-2 finding stand closed? Name file and line if not.
2. Does the delta contain a new defect?
3. Does the change expand any agent's authority beyond what round 1 described?

End with exactly one verdict line: `VERDICT: ratified`, `VERDICT: confirmed-non-expanding`, or `VERDICT: refused — <reason>`.

## The delta (`git diff 2ccfc2e7c5..HEAD`, compiled `dist/` output excluded)

```diff
diff --git a/agents/decisions/concern-admissions.jsonl b/agents/decisions/concern-admissions.jsonl
index fc1cbb0f7c..e6b2877c5d 100644
--- a/agents/decisions/concern-admissions.jsonl
+++ b/agents/decisions/concern-admissions.jsonl
@@ -18,4 +18,4 @@
 {"concern": "host-rate-marker", "decision": "admitted", "admitted_at": "2026-10-22", "slot": "agent_error on claude only, lowered from the host's StopFailure (road-to-a-cold-start-paid-once 4.3). No concern was bound to agent_error before.", "binding_hosts": "claude (1). StopFailure is measured on Claude Code alone; `agent-config hooks:status` answers whether the slot is live on the host actually running.", "behaviour_where_deny_ignored": "Not applicable: `severity: advisory`, it returns no verdict and exits 0 on every path. Where it does not run, no host-sourced quota_parked marker is written and the spawn guard's rate_window reads `clear`; nothing is blocked either way.", "per_event_budget_impact": "One payload field read and, only on `error: rate_limit`, one small JSON file write under agents/runtime/state. StopFailure fires on API failures, not per tool call.", "reason": "A plan rate limit is the moment a new spawn costs most and helps least; recording it is the input 4.5 reads to mark spawns that would have waited. Record-only per quota_parked.ts.", "why_not_extend": "subagent-ledger is bound to subagent_start and subagent_stop and writes the subagent ledger; a host API failure is neither event, and the marker it writes is the quota_parked state the council already reads, not a ledger line. Ratified with the branch's gated plumbing (agents/evidence/ratifications/subagent-system-2583-20261022.md)."}
 {"concern": "instructions-observer", "decision": "admitted", "admitted_at": "2026-10-23", "slot": "instructions_loaded on claude only, lowered from the host's InstructionsLoaded (road-to-a-setup-that-decides-itself 1.1). No concern was bound to that event before; it is new to the vocabulary in the same change.", "binding_hosts": "claude (1). InstructionsLoaded is measured present on the installed Claude Code binary only; `agent-config hooks:status` answers whether the slot is live on the host actually running.", "behaviour_where_deny_ignored": "Not applicable: `severity: advisory`, `fail_closed: false`, it returns no verdict and exits 0 on every path. Where it does not run, no arrival line is written and the computed layer form stays `full` — evidence lost in the direction that keeps the machine on today's behaviour.", "per_event_budget_impact": "One classified JSON line appended to a per-session file under the machine root's runtime/arrivals/, plus a bounded prune. It loads from its own 11,097-byte chunk, not the dispatch bundle; the host runs the event asynchronously, once per loaded instruction file.", "reason": "The computed rule-layer form may thin a machine only on an arrival record showing which rules actually reached the session; this concern is that record's only producer. Kill switch AGENT_CONFIG_INSTRUCTIONS_OBSERVER=off.", "why_not_extend": "No existing concern is bound to instructions_loaded, and the capture is per loaded file with its own private store and retention; folding it into journal-record would multiply the journal per session start for no reader. Ratified with the branch's gated plumbing (agents/evidence/ratifications/instructions-loaded-binding-20261023.md)."}
 {"concern": "code-graph-refresh", "decision": "admitted", "admitted_at": "2026-10-23", "slot": "session_start on every host that carries it. No refresh was bound to any agent event before; the only freshness carrier was the git-hook block of install-hooks.sh, which consumer projects never receive.", "binding_hosts": "augment, claude, cowork, cursor, cline, windsurf, gemini (7) per the manifest; `agent-config hooks:status` answers whether the slot is live on the host actually running. Inert on Windows by construction.", "behaviour_where_deny_ignored": "Not applicable: `severity: advisory`, `fail_closed: false`, it returns no verdict and exits 0 on every path. Where it does not run, an opted-in project's graph and agents/map/ stay at their last build until a manual `code-graph refresh`, which is the behaviour before this concern.", "per_event_budget_impact": "Loaded from its own chunk (12,726 B); the dispatch bundle carries one LAZY_CONCERNS row. For a project that never ran `code-graph auto-refresh on` it costs a realpath walk and one stat. Opted in: one `git ls-files`, a PATH scan and one detached spawn; the build runs outside the hook.", "reason": "Owner request of 2026-10-23: the map and graph should stay current without a manual command. It acts only after the explicit per-project opt-in, never on a git-tracked marker or cache, and only runs an agent-config resolved outside the repository. Ratified confirmed-non-expanding 2/2 by the AI council after eight rounds. Kill switch AGENT_CONFIG_CODE_GRAPH_REFRESH=off.", "why_not_extend": "code-graph-context is a pre_tool_use concern that carries state, never side effects, and the council (2026-10-23) held a refresh trigger there in reserve; no existing session_start concern owns the code graph, and the git-hook block cannot reach consumers."}
-{"concern": "layer-promote", "decision": "admitted", "admitted_at": "2026-10-24", "slot": "session_start on claude only (road-to-a-setup-that-decides-itself 3.3). It acts for the FOLLOWING sessions: the running session's rules are already loaded, so nothing it does changes what the session that took the decision reads.", "binding_hosts": "claude (1). The arrival record and the hook carrier it weighs describe the claude rule layer only; `agent-config hooks:status` answers whether the slot is live on the host actually running.", "behaviour_where_deny_ignored": "Not applicable: `severity: advisory`, `fail_closed: false`, it returns no verdict and exits 0 on every path. Where it does not run, a full layer stays full (today's behaviour) and a thinned one is still demoted by the shell branch of the SessionStart command when the carrier is dead.", "per_event_budget_impact": "Loaded from its own 52,118-byte chunk (yaml external, already required by chat_history on the same event); the dispatch bundle carries one LAZY_CONCERNS row. While the shipped switch src/config/layer-form-promotion.json is off it costs three stats and one small JSON read on a full layer, and one arrival-directory read on a thinned one. A promotion is attempted only inside the any_hook_event p95 budget of hook-latency-budget.json; the thin pass measured 11 ms over 121 rules.", "reason": "Step 3.3: promote after proof, never at install. A fresh install still writes the full layer; a later session whose evidence satisfies the layer-form decision thins it, and an arrival record contradicting a thinned layer demotes the machine. Promotion stays off until step 5.3 enables it on a non-inferior pre-registered comparison. Kill switch AGENT_CONFIG_LAYER_PROMOTE=off.", "why_not_extend": "No session_start concern owns the installed rule layer: rule-inject delivers bodies into a session and never rewrites files; the installer owns the thin pass but runs only at install, which is exactly the moment 3.3 forbids promoting at."}
+{"concern": "layer-promote", "decision": "admitted", "admitted_at": "2026-10-24", "slot": "session_start on claude only (road-to-a-setup-that-decides-itself 3.3). It acts for the FOLLOWING sessions: the running session's rules are already loaded, so nothing it does changes what the session that took the decision reads.", "binding_hosts": "claude (1). The arrival record and the hook carrier it weighs describe the claude rule layer only; `agent-config hooks:status` answers whether the slot is live on the host actually running.", "behaviour_where_deny_ignored": "Not applicable: `severity: advisory`, `fail_closed: false`, it returns no verdict and exits 0 on every path. Where it does not run, a full layer stays full (today's behaviour) and a thinned one is still demoted by the shell branch of the SessionStart command when the carrier is dead.", "per_event_budget_impact": "Loaded from its own 52,890-byte chunk (yaml external, already required by chat_history on the same event); the dispatch bundle carries one LAZY_CONCERNS row. While the shipped switch src/config/layer-form-promotion.json is off it costs three stats and one small JSON read on a full layer, and one arrival-directory read on a thinned one. A promotion is attempted only inside the any_hook_event p95 budget of hook-latency-budget.json; the thin pass measured 11 ms over 121 rules.", "reason": "Step 3.3: promote after proof, never at install. A fresh install still writes the full layer; a later session whose evidence satisfies the layer-form decision thins it, and an arrival record contradicting a thinned layer demotes the machine. Promotion stays off until step 5.3 enables it on a non-inferior pre-registered comparison. Kill switch AGENT_CONFIG_LAYER_PROMOTE=off.", "why_not_extend": "No session_start concern owns the installed rule layer: rule-inject delivers bodies into a session and never rewrites files; the installer owns the thin pass but runs only at install, which is exactly the moment 3.3 forbids promoting at."}
diff --git a/src/config/hook-bundle-budget.json b/src/config/hook-bundle-budget.json
index ed5135b0ac..478ac65ae6 100644
--- a/src/config/hook-bundle-budget.json
+++ b/src/config/hook-bundle-budget.json
@@ -70,7 +70,7 @@
             "from": 1554000,
             "to": 1554800,
             "by": "agent, drain/setup-decides-itself-20261024 (road-to-a-setup-that-decides-itself 3.3 and 3.6)",
-            "what_was_added": "Two things, measured per module from one esbuild metafile over origin/main and over this branch. (1) One `LAZY_CONCERNS` row for `layer-promote` (+144 B); its body, the thin pass and the ownership-ledger rewrite ship in their own 52,118-byte chunk. (2) `projectTreeForm()`, the project tree's precedence rule, now on the live path (+793 B to `project_tree_form.ts`): before, it had no caller and esbuild dropped it, which is exactly the defect the full-quorum council of 2026-10-24 named for step 3.6. Gate reading 1,554,423 B against 1,554,000.",
+            "what_was_added": "Two things, measured per module from one esbuild metafile over origin/main and over this branch. (1) One `LAZY_CONCERNS` row for `layer-promote` (+144 B); its body, the thin pass and the ownership-ledger rewrite ship in their own 52,890-byte chunk. (2) `projectTreeForm()`, the project tree's precedence rule, now on the live path (+793 B to `project_tree_form.ts`): before, it had no caller and esbuild dropped it, which is exactly the defect the full-quorum council of 2026-10-24 named for step 3.6. Gate reading 1,554,423 B against 1,554,000.",
             "why_it_could_not_be_avoided": "D10 recorded that 3.3 would need more than the bytes left and asked for the next raise or extraction to be sized from all blocked work then; 3.3 and 3.6 are that work. Room was not re-tried: the 2026-10-23 and 2026-10-24 entries measured both narrow-event chunk candidates (`session-eol`, `handoff-context`) as buying a few hundred bytes for a quarter-megabyte require on every event, and nothing has changed that trade. The 793 B are the precedence rule itself, which the projector's path must carry, and the 144 B are the row no chunk can carry.",
             "what_would_have_caught_it": "Nothing earlier: the base sat about 514 bytes under the ceiling. Sized to this change plus 377 bytes."
         }
@@ -116,7 +116,7 @@
             "entry": "src/scripts/hooks/layer_promotion_hook.ts",
             "max_bytes": 56800,
             "registered_at": "2026-10-24",
-            "derivation": "Measured 52,118 bytes on 2026-10-24 (the session-start layer step of road-to-a-setup-that-decides-itself 3.3: the decision with its machine evidence, the arrival-record reader, the thin pass, the staged-snapshot restore and the ownership-ledger rewrite) with `yaml` external (the thin pass parses rule frontmatter; `chat_history` requires the same copy earlier on the same event, so the load is a cache hit). The ceiling is that reading plus about 10 %, rounded, with no growth queued. Bound on claude `session_start` alone, so a chunk keeps it off every other dispatch's parse; the bundle carries only its LAZY_CONCERNS row. Like `chat_history` it carries a concern, so a missing chunk falls back to the spawn path and costs latency, never the layer step."
+            "derivation": "Measured 52,890 bytes on 2026-10-24 (the session-start layer step of road-to-a-setup-that-decides-itself 3.3: the decision with its machine evidence, the arrival-record reader, the thin pass, the staged-snapshot restore and the ownership-ledger rewrite) with `yaml` external (the thin pass parses rule frontmatter; `chat_history` requires the same copy earlier on the same event, so the load is a cache hit). The ceiling is that reading plus about 10 %, rounded, with no growth queued. Bound on claude `session_start` alone, so a chunk keeps it off every other dispatch's parse; the bundle carries only its LAZY_CONCERNS row. Like `chat_history` it carries a concern, so a missing chunk falls back to the spawn path and costs latency, never the layer step."
         }
     ],
     "chunks_note": "A chunk is loaded only when a caller needs it, so its bytes are not paid by every dispatch; its ceiling exists so that the move out of dispatch.js stays a measured place rather than an unmeasured one. The gate builds each chunk with the exact esbuild segment `build:hook-chunks` uses for its entry.",
diff --git a/src/install/layerPromotion.ts b/src/install/layerPromotion.ts
index 01460ae705..5a57bb180f 100644
--- a/src/install/layerPromotion.ts
+++ b/src/install/layerPromotion.ts
@@ -60,6 +60,8 @@ import {
 
 export const PROMOTION_SWITCH_REL = path.join('src', 'config', 'layer-form-promotion.json');
 export const PROMOTION_RECORD = 'promotion.json';
+/** Present from before the thin pass until the promotion record is written; found at session start, it means the pass never finished. */
+export const PROMOTING_MARKER = 'promoting';
 export const LATENCY_BUDGET_REL = path.join('src', 'config', 'hook-latency-budget.json');
 /** Measured 11 ms for the thin pass over 121 rules (tsx, warm, 2026-10-24); the default is that plus margin. */
 export const DEFAULT_THIN_ESTIMATE_MS = 50;
@@ -299,6 +301,15 @@ export function sessionLayerStep(opts: SessionLayerOptions = {}): SessionLayerOu
             return { action: 'none', reason: 'no-staged-runtime' };
         }
         const home = env['HOME'] ?? os.homedir();
+        const promoting = path.join(runtimeRoot, PROMOTING_MARKER);
+        if (fs.existsSync(promoting)) {
+            // An interrupted promotion: restore the snapshot and start again from full.
+            const rulesDir = thinnedDir(runtimeRoot) ?? opts.rulesDir ?? path.join(home, '.claude', 'rules');
+            rerecord(rulesDir, restoreStagedLayer(packageRoot, rulesDir) ?? [], env);
+            markClaudeLayer(runtimeRoot, { thinned: false, rulesDir });
+            fs.rmSync(promoting, { force: true });
+            return { action: 'none', reason: 'promotion-interrupted' };
+        }
         const state = readCarrierState(runtimeRoot);
 
         if (state.layer === 'thinned') {
@@ -325,8 +336,10 @@ export function sessionLayerStep(opts: SessionLayerOptions = {}): SessionLayerOu
         const estimate = readPromotionRecord(runtimeRoot)?.last_thin_ms ?? DEFAULT_THIN_ESTIMATE_MS;
         if (now() - started + estimate > latencyBudgetMs(packageRoot)) return { action: 'skipped', reason: 'over-latency-budget' };
 
-        // The marker goes first, so a pass interrupted part-way leaves a layer the
-        // shell branch and the demotion above both recognise as thinned.
+        // Both markers go first. `promoting` makes an interrupted pass visible to
+        // the next session, which restores it; `thinned` lets the shell branch
+        // restore it on a dead carrier meanwhile. `promoting` goes last, after the record.
+        fs.writeFileSync(path.join(runtimeRoot, PROMOTING_MARKER), `${process.pid}\n`);
         markClaudeLayer(runtimeRoot, { thinned: true, rulesDir });
         const rewritten: string[] = [];
         const t0 = now();
@@ -344,6 +357,7 @@ export function sessionLayerStep(opts: SessionLayerOptions = {}): SessionLayerOu
             if (failed) {
                 rerecord(rulesDir, restoreStagedLayer(packageRoot, rulesDir) ?? [], env);
                 markClaudeLayer(runtimeRoot, { thinned: false, rulesDir });
+                fs.rmSync(path.join(runtimeRoot, PROMOTING_MARKER), { force: true });
             }
         }
         if (failed) return { action: 'none', reason: 'thin-failed' };
@@ -355,6 +369,7 @@ export function sessionLayerStep(opts: SessionLayerOptions = {}): SessionLayerOu
             last_thin_ms: thinMs,
         };
         fs.writeFileSync(path.join(runtimeRoot, PROMOTION_RECORD), `${JSON.stringify(record, null, 2)}\n`);
+        fs.rmSync(path.join(runtimeRoot, PROMOTING_MARKER), { force: true });
         return { action: 'promoted', reason: decision.reason };
     } catch {
         return { action: 'none', reason: 'error' };
diff --git a/tests/install/layer_promotion.test.ts b/tests/install/layer_promotion.test.ts
index d356cfe0a2..51561a9909 100644
--- a/tests/install/layer_promotion.test.ts
+++ b/tests/install/layer_promotion.test.ts
@@ -18,6 +18,7 @@ import { afterEach, describe, expect, it } from 'vitest';
 
 import {
     DEFAULT_THIN_ESTIMATE_MS,
+    PROMOTING_MARKER,
     PROMOTION_RECORD,
     neverThinned,
     PROMOTION_SWITCH_REL,
@@ -135,6 +136,17 @@ const ledgerMatchesDisk = (f: Fixture): boolean => {
     const rec = inventory.recorded_digests('claude-code', path.dirname(f.rulesDir), inventory.load_inventory(f.ledgerPath));
     return allRules(f).every((id) => rec.get(`rules/${id}.md`)?.installed_sha256 === inventory.file_sha256(path.join(f.rulesDir, `${id}.md`)));
 };
+/** Put back the stamped full bodies of all files (or all but `keep` stubs), as a pass cut short leaves them. */
+function restoreAll(f: Fixture, keep = 0): void {
+    let kept = 0;
+    for (const id of allRules(f)) {
+        const file = path.join(f.rulesDir, `${id}.md`);
+        if (!is_thin_entry(fs.readFileSync(file, 'utf8'))) continue;
+        if (kept++ < keep) continue;
+        fs.copyFileSync(path.join(f.stage, CLAUDE_LAYER_DIRNAME, `${id}.md`), file);
+    }
+}
+
 const step = (f: Fixture, extra: Partial<Parameters<typeof sessionLayerStep>[0]> = {}) =>
     sessionLayerStep({ env: f.env, date: () => new Date('2026-10-24T12:00:00Z'), ...extra });
 
@@ -289,6 +301,30 @@ describe('step 3.3 — promote after proof, never at install', () => {
         }
     });
 
+    it('an interrupted promotion is restored to full by the next session, whatever its arrivals say', () => {
+        // Simulate termination at three points: after the markers, after some files, after the pass.
+        for (const cut of ['markers', 'partial', 'before-record'] as const) {
+            const f = freshInstall();
+            arrive(f, 'session-1', '2026-10-24T10:00:00Z', allRules(f));
+            expect(step(f).action).toBe('promoted');
+            const stubs = stubCount(f);
+            if (cut === 'markers') restoreAll(f);
+            if (cut === 'partial') restoreAll(f, 2);
+            fs.writeFileSync(path.join(f.runtimeRoot, PROMOTING_MARKER), '1\n');
+            if (cut === 'before-record') fs.rmSync(path.join(f.runtimeRoot, PROMOTION_RECORD));
+            expect(stubs).toBeGreaterThan(0);
+            arrive(f, 'session-2', new Date(Date.now() + 60_000).toISOString(), allRules(f));
+            expect(step(f)).toEqual({ action: 'none', reason: 'promotion-interrupted' });
+            expect(stubCount(f)).toBe(0);
+            expect(readCarrierState(f.runtimeRoot).layer).toBe('full');
+            expect(fs.existsSync(path.join(f.runtimeRoot, PROMOTING_MARKER))).toBe(false);
+            expect(ledgerMatchesDisk(f)).toBe(true);
+            // And the session after that converges: it promotes again.
+            expect(step(f).action).toBe('promoted');
+            expect(fs.existsSync(path.join(f.runtimeRoot, PROMOTING_MARKER))).toBe(false);
+        }
+    });
+
     it('the concern honours its kill switch and never throws without a staged runtime', () => {
         const f = freshInstall();
         arrive(f, 'session-1', '2026-10-24T10:00:00Z', allRules(f));
```
