<!-- evidence-type: analysis -->

# Ratification review, round 5 — binding the `layer-promote` session concern

You are an independent reviewer for a change in the `event4u/agent-config` repository: step 3.3 of `road-to-a-setup-that-decides-itself` ("promote after proof, never at install"), bound as a claude-only `session_start` hook concern. It touches files on the hook-plumbing list, so ADR-268 § 4 requires a two-provider ratification record. Full description and diff: `agents/evidence/council/layer-promote-binding-ratification-r1-20261024.question.md`; later deltas: `…-r2-…`, `…-r3-…`, `…-r4-20261024.question.md`.

Round 4 ended with one seat `ratified` and one seat `refused`, on two findings: (1) a lock older than 30 s was recoverable even while its owner process was alive, and a timeout does not fence a slow live writer; (2) the in-process failure path restored files and rewrote the ledger before checking it still owned the lock. Both seats agreed authority is unchanged.

This round reviews the delta made in response, against revision `6862196faa` (the round-4 revision). Decide whether the change may land as written now.

## What changed

- `promotionLockLive()` now returns `ownerAlive(pid)` for any lock that names an owner — its age no longer matters. Age (via mtime, 30 s) decides only for a lock whose content cannot be parsed. Consequence, stated: if a dead owner's pid is reused by an unrelated live process, the lock is held until that process exits; during that time nothing is promoted, demoted or restored by this concern (the shell branch's dead-carrier restore is unaffected).
- The failure cleanup (snapshot restore, ledger re-record, marker clear, lock removal) runs only when the pass still owns the lock.
- Chunk 54,058 B (ceiling 56,800). Dispatch bundle unchanged at 1,554,423 B.

## Verification on this revision

`tests/install/layer_promotion.test.ts` — 14 cases. Changed: a live owner with a 24-hour-old lock returns `promotion-in-progress` and leaves the thinned layer untouched; a dead owner with a fresh lock is recovered. New: a pass whose lock is taken by another session just before the thin pass and which then throws leaves a stamped, ledger-recorded file unrestored, the ledger byte-identical and the other session's lock in place. Restoring the age check reds the first; dropping the ownership check from the failure path reds the second.

## What to answer

1. Do the round-4 findings stand closed? Name file and line if not.
2. Does the delta contain a new defect?
3. Does the change expand any agent's authority beyond what round 1 described?

End with exactly one verdict line: `VERDICT: ratified`, `VERDICT: confirmed-non-expanding`, or `VERDICT: refused — <reason>`.

## The delta (`git diff 6862196faa..HEAD`, compiled `dist/` output excluded)

```diff
diff --git a/agents/decisions/concern-admissions.jsonl b/agents/decisions/concern-admissions.jsonl
index da4b944f74..e26c258360 100644
--- a/agents/decisions/concern-admissions.jsonl
+++ b/agents/decisions/concern-admissions.jsonl
@@ -18,4 +18,4 @@
 {"concern": "host-rate-marker", "decision": "admitted", "admitted_at": "2026-10-22", "slot": "agent_error on claude only, lowered from the host's StopFailure (road-to-a-cold-start-paid-once 4.3). No concern was bound to agent_error before.", "binding_hosts": "claude (1). StopFailure is measured on Claude Code alone; `agent-config hooks:status` answers whether the slot is live on the host actually running.", "behaviour_where_deny_ignored": "Not applicable: `severity: advisory`, it returns no verdict and exits 0 on every path. Where it does not run, no host-sourced quota_parked marker is written and the spawn guard's rate_window reads `clear`; nothing is blocked either way.", "per_event_budget_impact": "One payload field read and, only on `error: rate_limit`, one small JSON file write under agents/runtime/state. StopFailure fires on API failures, not per tool call.", "reason": "A plan rate limit is the moment a new spawn costs most and helps least; recording it is the input 4.5 reads to mark spawns that would have waited. Record-only per quota_parked.ts.", "why_not_extend": "subagent-ledger is bound to subagent_start and subagent_stop and writes the subagent ledger; a host API failure is neither event, and the marker it writes is the quota_parked state the council already reads, not a ledger line. Ratified with the branch's gated plumbing (agents/evidence/ratifications/subagent-system-2583-20261022.md)."}
 {"concern": "instructions-observer", "decision": "admitted", "admitted_at": "2026-10-23", "slot": "instructions_loaded on claude only, lowered from the host's InstructionsLoaded (road-to-a-setup-that-decides-itself 1.1). No concern was bound to that event before; it is new to the vocabulary in the same change.", "binding_hosts": "claude (1). InstructionsLoaded is measured present on the installed Claude Code binary only; `agent-config hooks:status` answers whether the slot is live on the host actually running.", "behaviour_where_deny_ignored": "Not applicable: `severity: advisory`, `fail_closed: false`, it returns no verdict and exits 0 on every path. Where it does not run, no arrival line is written and the computed layer form stays `full` — evidence lost in the direction that keeps the machine on today's behaviour.", "per_event_budget_impact": "One classified JSON line appended to a per-session file under the machine root's runtime/arrivals/, plus a bounded prune. It loads from its own 11,097-byte chunk, not the dispatch bundle; the host runs the event asynchronously, once per loaded instruction file.", "reason": "The computed rule-layer form may thin a machine only on an arrival record showing which rules actually reached the session; this concern is that record's only producer. Kill switch AGENT_CONFIG_INSTRUCTIONS_OBSERVER=off.", "why_not_extend": "No existing concern is bound to instructions_loaded, and the capture is per loaded file with its own private store and retention; folding it into journal-record would multiply the journal per session start for no reader. Ratified with the branch's gated plumbing (agents/evidence/ratifications/instructions-loaded-binding-20261023.md)."}
 {"concern": "code-graph-refresh", "decision": "admitted", "admitted_at": "2026-10-23", "slot": "session_start on every host that carries it. No refresh was bound to any agent event before; the only freshness carrier was the git-hook block of install-hooks.sh, which consumer projects never receive.", "binding_hosts": "augment, claude, cowork, cursor, cline, windsurf, gemini (7) per the manifest; `agent-config hooks:status` answers whether the slot is live on the host actually running. Inert on Windows by construction.", "behaviour_where_deny_ignored": "Not applicable: `severity: advisory`, `fail_closed: false`, it returns no verdict and exits 0 on every path. Where it does not run, an opted-in project's graph and agents/map/ stay at their last build until a manual `code-graph refresh`, which is the behaviour before this concern.", "per_event_budget_impact": "Loaded from its own chunk (12,726 B); the dispatch bundle carries one LAZY_CONCERNS row. For a project that never ran `code-graph auto-refresh on` it costs a realpath walk and one stat. Opted in: one `git ls-files`, a PATH scan and one detached spawn; the build runs outside the hook.", "reason": "Owner request of 2026-10-23: the map and graph should stay current without a manual command. It acts only after the explicit per-project opt-in, never on a git-tracked marker or cache, and only runs an agent-config resolved outside the repository. Ratified confirmed-non-expanding 2/2 by the AI council after eight rounds. Kill switch AGENT_CONFIG_CODE_GRAPH_REFRESH=off.", "why_not_extend": "code-graph-context is a pre_tool_use concern that carries state, never side effects, and the council (2026-10-23) held a refresh trigger there in reserve; no existing session_start concern owns the code graph, and the git-hook block cannot reach consumers."}
-{"concern": "layer-promote", "decision": "admitted", "admitted_at": "2026-10-24", "slot": "session_start on claude only (road-to-a-setup-that-decides-itself 3.3). It acts for the FOLLOWING sessions: the running session's rules are already loaded, so nothing it does changes what the session that took the decision reads.", "binding_hosts": "claude (1). The arrival record and the hook carrier it weighs describe the claude rule layer only; `agent-config hooks:status` answers whether the slot is live on the host actually running.", "behaviour_where_deny_ignored": "Not applicable: `severity: advisory`, `fail_closed: false`, it returns no verdict and exits 0 on every path. Where it does not run, a full layer stays full (today's behaviour) and a thinned one is still demoted by the shell branch of the SessionStart command when the carrier is dead.", "per_event_budget_impact": "Loaded from its own 54,119-byte chunk (yaml external, already required by chat_history on the same event); the dispatch bundle carries one LAZY_CONCERNS row. While the shipped switch src/config/layer-form-promotion.json is off it costs three stats and one small JSON read on a full layer, and one arrival-directory read on a thinned one. A promotion is attempted only inside the any_hook_event p95 budget of hook-latency-budget.json; the thin pass measured 11 ms over 121 rules.", "reason": "Step 3.3: promote after proof, never at install. A fresh install still writes the full layer; a later session whose evidence satisfies the layer-form decision thins it, and an arrival record contradicting a thinned layer demotes the machine. Promotion stays off until step 5.3 enables it on a non-inferior pre-registered comparison. Kill switch AGENT_CONFIG_LAYER_PROMOTE=off.", "why_not_extend": "No session_start concern owns the installed rule layer: rule-inject delivers bodies into a session and never rewrites files; the installer owns the thin pass but runs only at install, which is exactly the moment 3.3 forbids promoting at."}
+{"concern": "layer-promote", "decision": "admitted", "admitted_at": "2026-10-24", "slot": "session_start on claude only (road-to-a-setup-that-decides-itself 3.3). It acts for the FOLLOWING sessions: the running session's rules are already loaded, so nothing it does changes what the session that took the decision reads.", "binding_hosts": "claude (1). The arrival record and the hook carrier it weighs describe the claude rule layer only; `agent-config hooks:status` answers whether the slot is live on the host actually running.", "behaviour_where_deny_ignored": "Not applicable: `severity: advisory`, `fail_closed: false`, it returns no verdict and exits 0 on every path. Where it does not run, a full layer stays full (today's behaviour) and a thinned one is still demoted by the shell branch of the SessionStart command when the carrier is dead.", "per_event_budget_impact": "Loaded from its own 54,058-byte chunk (yaml external, already required by chat_history on the same event); the dispatch bundle carries one LAZY_CONCERNS row. While the shipped switch src/config/layer-form-promotion.json is off it costs three stats and one small JSON read on a full layer, and one arrival-directory read on a thinned one. A promotion is attempted only inside the any_hook_event p95 budget of hook-latency-budget.json; the thin pass measured 11 ms over 121 rules.", "reason": "Step 3.3: promote after proof, never at install. A fresh install still writes the full layer; a later session whose evidence satisfies the layer-form decision thins it, and an arrival record contradicting a thinned layer demotes the machine. Promotion stays off until step 5.3 enables it on a non-inferior pre-registered comparison. Kill switch AGENT_CONFIG_LAYER_PROMOTE=off.", "why_not_extend": "No session_start concern owns the installed rule layer: rule-inject delivers bodies into a session and never rewrites files; the installer owns the thin pass but runs only at install, which is exactly the moment 3.3 forbids promoting at."}
diff --git a/src/config/hook-bundle-budget.json b/src/config/hook-bundle-budget.json
index 35370b195f..2121222d18 100644
--- a/src/config/hook-bundle-budget.json
+++ b/src/config/hook-bundle-budget.json
@@ -70,7 +70,7 @@
             "from": 1554000,
             "to": 1554800,
             "by": "agent, drain/setup-decides-itself-20261024 (road-to-a-setup-that-decides-itself 3.3 and 3.6)",
-            "what_was_added": "Two things, measured per module from one esbuild metafile over origin/main and over this branch. (1) One `LAZY_CONCERNS` row for `layer-promote` (+144 B); its body, the thin pass and the ownership-ledger rewrite ship in their own 54,119-byte chunk. (2) `projectTreeForm()`, the project tree's precedence rule, now on the live path (+793 B to `project_tree_form.ts`): before, it had no caller and esbuild dropped it, which is exactly the defect the full-quorum council of 2026-10-24 named for step 3.6. Gate reading 1,554,423 B against 1,554,000.",
+            "what_was_added": "Two things, measured per module from one esbuild metafile over origin/main and over this branch. (1) One `LAZY_CONCERNS` row for `layer-promote` (+144 B); its body, the thin pass and the ownership-ledger rewrite ship in their own 54,058-byte chunk. (2) `projectTreeForm()`, the project tree's precedence rule, now on the live path (+793 B to `project_tree_form.ts`): before, it had no caller and esbuild dropped it, which is exactly the defect the full-quorum council of 2026-10-24 named for step 3.6. Gate reading 1,554,423 B against 1,554,000.",
             "why_it_could_not_be_avoided": "D10 recorded that 3.3 would need more than the bytes left and asked for the next raise or extraction to be sized from all blocked work then; 3.3 and 3.6 are that work. Room was not re-tried: the 2026-10-23 and 2026-10-24 entries measured both narrow-event chunk candidates (`session-eol`, `handoff-context`) as buying a few hundred bytes for a quarter-megabyte require on every event, and nothing has changed that trade. The 793 B are the precedence rule itself, which the projector's path must carry, and the 144 B are the row no chunk can carry.",
             "what_would_have_caught_it": "Nothing earlier: the base sat about 514 bytes under the ceiling. Sized to this change plus 377 bytes."
         }
@@ -116,7 +116,7 @@
             "entry": "src/scripts/hooks/layer_promotion_hook.ts",
             "max_bytes": 56800,
             "registered_at": "2026-10-24",
-            "derivation": "Measured 54,119 bytes on 2026-10-24 (the session-start layer step of road-to-a-setup-that-decides-itself 3.3: the decision with its machine evidence, the arrival-record reader, the thin pass, the staged-snapshot restore and the ownership-ledger rewrite) with `yaml` external (the thin pass parses rule frontmatter; `chat_history` requires the same copy earlier on the same event, so the load is a cache hit). The ceiling is that reading plus about 10 %, rounded, with no growth queued. Bound on claude `session_start` alone, so a chunk keeps it off every other dispatch's parse; the bundle carries only its LAZY_CONCERNS row. Like `chat_history` it carries a concern, so a missing chunk falls back to the spawn path and costs latency, never the layer step."
+            "derivation": "Measured 54,058 bytes on 2026-10-24 (the session-start layer step of road-to-a-setup-that-decides-itself 3.3: the decision with its machine evidence, the arrival-record reader, the thin pass, the staged-snapshot restore and the ownership-ledger rewrite) with `yaml` external (the thin pass parses rule frontmatter; `chat_history` requires the same copy earlier on the same event, so the load is a cache hit). The ceiling is that reading plus about 10 %, rounded, with no growth queued. Bound on claude `session_start` alone, so a chunk keeps it off every other dispatch's parse; the bundle carries only its LAZY_CONCERNS row. Like `chat_history` it carries a concern, so a missing chunk falls back to the spawn path and costs latency, never the layer step."
         }
     ],
     "chunks_note": "A chunk is loaded only when a caller needs it, so its bytes are not paid by every dispatch; its ceiling exists so that the move out of dispatch.js stays a measured place rather than an unmeasured one. The gate builds each chunk with the exact esbuild segment `build:hook-chunks` uses for its entry.",
diff --git a/src/install/layerPromotion.ts b/src/install/layerPromotion.ts
index 4d6a42b9e4..fd038c12af 100644
--- a/src/install/layerPromotion.ts
+++ b/src/install/layerPromotion.ts
@@ -63,11 +63,15 @@ export const PROMOTION_RECORD = 'promotion.json';
 /**
  * The promotion lock: created exclusively before the thin pass, removed after
  * the promotion record. It names its owner (`<pid> <ms since epoch>`), so a
- * concurrent session can tell a pass still running — skip, touch nothing — from
- * one whose owner is gone or older than {@link PROMOTING_STALE_MS} — recover.
+ * concurrent session can tell a pass whose owner is alive — skip, touch
+ * nothing — from one whose owner is gone — recover.
  */
 export const PROMOTING_MARKER = 'promoting';
-/** Far beyond any real pass (11 ms measured, 250-ms budget); only a dead owner gets this old. */
+/**
+ * Only for a lock whose owner cannot be read: then its mtime decides, and
+ * nothing real is this old (11 ms measured, 250-ms budget). A lock naming a
+ * LIVE owner is never recovered, whatever its age — a timeout is not a fence.
+ */
 export const PROMOTING_STALE_MS = 30_000;
 
 function ownerAlive(pid: number): boolean {
@@ -89,7 +93,7 @@ export function promotionLockLive(file: string, nowMs: number = Date.now()): boo
     }
     const [pid, at] = text.trim().split(/\s+/).map(Number);
     if (!Number.isInteger(pid) || !Number.isFinite(at)) return nowMs - fs.statSync(file).mtimeMs < PROMOTING_STALE_MS;
-    return nowMs - (at as number) < PROMOTING_STALE_MS && ownerAlive(pid as number);
+    return ownerAlive(pid as number);
 }
 export const LATENCY_BUDGET_REL = path.join('src', 'config', 'hook-latency-budget.json');
 /** Measured 11 ms for the thin pass over 121 rules (tsx, warm, 2026-10-24); the default is that plus margin. */
@@ -404,12 +408,11 @@ export function sessionLayerStep(opts: SessionLayerOptions = {}): SessionLayerOu
             });
             failed = res.failed.length > 0;
         } finally {
-            if (failed) {
+            // Only while it still owns the lock: a recoverer that took it is restoring.
+            if (failed && stillOurs()) {
                 rerecord(rulesDir, restoreStagedLayer(packageRoot, rulesDir) ?? [], env);
-                if (stillOurs()) {
-                    markClaudeLayer(runtimeRoot, { thinned: false, rulesDir });
-                    fs.rmSync(lock, { force: true });
-                }
+                markClaudeLayer(runtimeRoot, { thinned: false, rulesDir });
+                fs.rmSync(lock, { force: true });
             }
         }
         if (failed) return { action: 'none', reason: 'thin-failed' };
diff --git a/tests/install/layer_promotion.test.ts b/tests/install/layer_promotion.test.ts
index a79a58b2ae..e43bd246f2 100644
--- a/tests/install/layer_promotion.test.ts
+++ b/tests/install/layer_promotion.test.ts
@@ -327,7 +327,7 @@ describe('step 3.3 — promote after proof, never at install', () => {
         }
     });
 
-    it('a promotion still running in another session is left alone; a stale one is recovered', () => {
+    it('a lock whose owner is alive is left alone at any age; a dead owner is recovered', () => {
         const f = freshInstall();
         arrive(f, 'session-1', '2026-10-24T10:00:00Z', allRules(f));
         expect(step(f).action).toBe('promoted');
@@ -338,8 +338,12 @@ describe('step 3.3 — promote after proof, never at install', () => {
         expect(step(f)).toEqual({ action: 'none', reason: 'promotion-in-progress' });
         expect(stubCount(f)).toBe(stubs);
         expect(readCarrierState(f.runtimeRoot).layer).toBe('thinned');
-        // Same live owner, but older than any real pass: recovered.
-        fs.writeFileSync(lock, `${process.pid} ${Date.now() - 60_000}\n`);
+        // A live owner is never recovered, however old its lock: a timeout is not a fence.
+        fs.writeFileSync(lock, `${process.pid} ${Date.now() - 86_400_000}\n`);
+        expect(step(f)).toEqual({ action: 'none', reason: 'promotion-in-progress' });
+        expect(stubCount(f)).toBe(stubs);
+        // A dead owner is recovered, however fresh.
+        fs.writeFileSync(lock, `${DEAD_PID} ${Date.now()}\n`);
         expect(step(f)).toEqual({ action: 'none', reason: 'promotion-interrupted' });
         expect(stubCount(f)).toBe(0);
     });
@@ -367,6 +371,33 @@ describe('step 3.3 — promote after proof, never at install', () => {
         expect(ledgerMatchesDisk(f)).toBe(true);
     });
 
+    it('a pass that fails after losing its lock restores nothing and writes no ledger', () => {
+        const f = freshInstall();
+        arrive(f, 'session-1', '2026-10-24T10:00:00Z', allRules(f));
+        const lock = path.join(f.runtimeRoot, PROMOTING_MARKER);
+        // A file a restore would overwrite: stamped, and recorded as ours.
+        const sentinel = path.join(f.rulesDir, 'scope-control.md');
+        fs.appendFileSync(sentinel, '\nsentinel\n');
+        const inv = inventory.load_inventory(f.ledgerPath);
+        const digests = (inv['tools'] as Record<string, { digests: Record<string, inventory.LedgerDigest> }>)['claude-code']!.digests;
+        const sha = inventory.file_sha256(sentinel) as string;
+        digests['rules/scope-control.md'] = { installed_sha256: sha, packaged_sha256: sha };
+        inventory.save_inventory(inv, f.ledgerPath);
+        const ledgerBefore = fs.readFileSync(f.ledgerPath, 'utf8');
+        // The pass will throw (no router to build stubs from) after another session took the lock.
+        fs.rmSync(path.join(f.stage, 'dist/router.json'));
+        let calls = 0;
+        const clock = (): number => {
+            calls += 1;
+            if (calls === 2) fs.writeFileSync(lock, `${DEAD_PID} 0\n`);
+            return 0;
+        };
+        expect(step(f, { now: clock, startedAt: 0 })).toEqual({ action: 'none', reason: 'error' });
+        expect(fs.readFileSync(sentinel, 'utf8')).toContain('sentinel');
+        expect(fs.readFileSync(f.ledgerPath, 'utf8')).toBe(ledgerBefore);
+        expect(fs.readFileSync(lock, 'utf8')).toBe(`${DEAD_PID} 0\n`);
+    });
+
     it('the concern honours its kill switch and never throws without a staged runtime', () => {
         const f = freshInstall();
         arrive(f, 'session-1', '2026-10-24T10:00:00Z', allRules(f));
```
