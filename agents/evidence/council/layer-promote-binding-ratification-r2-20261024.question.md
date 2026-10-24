<!-- evidence-type: analysis -->

# Ratification review, round 2 — binding the `layer-promote` session concern

You are an independent reviewer for a change in the `event4u/agent-config` repository. It implements step 3.3 of `road-to-a-setup-that-decides-itself` ("promote after proof, never at install") and binds it as a claude-only `session_start` hook concern; it touches files on the hook-plumbing list, so ADR-268 § 4 requires a two-provider ratification record. Round 1 (prompt: `agents/evidence/council/layer-promote-binding-ratification-r1-20261024.question.md`, which carries the full description and diff) ended with one seat `ratified` and one seat `refused`, on two findings:

1. `keptWhole()` treated a file as protected only when a ledger record existed and differed, so a rule file the ledger does not record at all was eligible for thinning.
2. A missing promotion record made `since` null, so every arrival record — including ones from before the promotion — could trigger a demotion.

This round reviews the delta made in response, against revision `ff276c482a` (the round-1 revision). Decide whether the change may land as written now.

## What changed

- `keptWhole()` now protects a file when there is NO ledger record for it or its bytes differ from the record: only a file the ledger proves is this package's, byte for byte, can be thinned.
- `promotionBoundary()`: post-promotion evidence starts at the recorded `promoted_at`, else at the `thinned` marker's mtime; with neither, no evidence-based demotion happens (the shell branch's dead-carrier restore is unaffected). A torn or malformed record falls back the same way.
- The `thinned` marker is now written BEFORE the thin pass, so an interrupted pass leaves a layer both the shell branch and this module recognise as thinned; a pass that reports failures or throws restores the staged snapshot, re-records the ledger and clears the marker.
- The chunk measures 52,118 B (was 51,620) under its 56,800-B ceiling; the budget derivation and the admission row say so. The dispatch bundle reading is unchanged at 1,554,423 B.

## Verification on this revision

`tests/install/layer_promotion.test.ts` — 10 cases. Two are new: (a) a rule that a normal promotion DOES thin stays whole once its ledger entry is removed; (b) with the promotion record deleted, torn, or carrying an unparseable time, an arrival record from before the marker leaves the layer thinned and one from after it demotes. Each new case was red against the round-1 code: reverting the ownership condition reds (a), replacing the marker fallback with "the epoch" reds (b). `check_hook_bundle_composition` passes.

## What to answer

1. Do the two round-1 findings stand closed? Name file and line if not.
2. Does the delta contain a new defect?
3. Does the change expand any agent's authority beyond what round 1 described?

End with exactly one verdict line: `VERDICT: ratified`, `VERDICT: confirmed-non-expanding`, or `VERDICT: refused — <reason>`.

## The delta (`git diff ff276c482a..HEAD`, compiled `dist/` output excluded)

```diff
diff --git a/agents/decisions/concern-admissions.jsonl b/agents/decisions/concern-admissions.jsonl
index 37e5320046..fc1cbb0f7c 100644
--- a/agents/decisions/concern-admissions.jsonl
+++ b/agents/decisions/concern-admissions.jsonl
@@ -18,4 +18,4 @@
 {"concern": "host-rate-marker", "decision": "admitted", "admitted_at": "2026-10-22", "slot": "agent_error on claude only, lowered from the host's StopFailure (road-to-a-cold-start-paid-once 4.3). No concern was bound to agent_error before.", "binding_hosts": "claude (1). StopFailure is measured on Claude Code alone; `agent-config hooks:status` answers whether the slot is live on the host actually running.", "behaviour_where_deny_ignored": "Not applicable: `severity: advisory`, it returns no verdict and exits 0 on every path. Where it does not run, no host-sourced quota_parked marker is written and the spawn guard's rate_window reads `clear`; nothing is blocked either way.", "per_event_budget_impact": "One payload field read and, only on `error: rate_limit`, one small JSON file write under agents/runtime/state. StopFailure fires on API failures, not per tool call.", "reason": "A plan rate limit is the moment a new spawn costs most and helps least; recording it is the input 4.5 reads to mark spawns that would have waited. Record-only per quota_parked.ts.", "why_not_extend": "subagent-ledger is bound to subagent_start and subagent_stop and writes the subagent ledger; a host API failure is neither event, and the marker it writes is the quota_parked state the council already reads, not a ledger line. Ratified with the branch's gated plumbing (agents/evidence/ratifications/subagent-system-2583-20261022.md)."}
 {"concern": "instructions-observer", "decision": "admitted", "admitted_at": "2026-10-23", "slot": "instructions_loaded on claude only, lowered from the host's InstructionsLoaded (road-to-a-setup-that-decides-itself 1.1). No concern was bound to that event before; it is new to the vocabulary in the same change.", "binding_hosts": "claude (1). InstructionsLoaded is measured present on the installed Claude Code binary only; `agent-config hooks:status` answers whether the slot is live on the host actually running.", "behaviour_where_deny_ignored": "Not applicable: `severity: advisory`, `fail_closed: false`, it returns no verdict and exits 0 on every path. Where it does not run, no arrival line is written and the computed layer form stays `full` — evidence lost in the direction that keeps the machine on today's behaviour.", "per_event_budget_impact": "One classified JSON line appended to a per-session file under the machine root's runtime/arrivals/, plus a bounded prune. It loads from its own 11,097-byte chunk, not the dispatch bundle; the host runs the event asynchronously, once per loaded instruction file.", "reason": "The computed rule-layer form may thin a machine only on an arrival record showing which rules actually reached the session; this concern is that record's only producer. Kill switch AGENT_CONFIG_INSTRUCTIONS_OBSERVER=off.", "why_not_extend": "No existing concern is bound to instructions_loaded, and the capture is per loaded file with its own private store and retention; folding it into journal-record would multiply the journal per session start for no reader. Ratified with the branch's gated plumbing (agents/evidence/ratifications/instructions-loaded-binding-20261023.md)."}
 {"concern": "code-graph-refresh", "decision": "admitted", "admitted_at": "2026-10-23", "slot": "session_start on every host that carries it. No refresh was bound to any agent event before; the only freshness carrier was the git-hook block of install-hooks.sh, which consumer projects never receive.", "binding_hosts": "augment, claude, cowork, cursor, cline, windsurf, gemini (7) per the manifest; `agent-config hooks:status` answers whether the slot is live on the host actually running. Inert on Windows by construction.", "behaviour_where_deny_ignored": "Not applicable: `severity: advisory`, `fail_closed: false`, it returns no verdict and exits 0 on every path. Where it does not run, an opted-in project's graph and agents/map/ stay at their last build until a manual `code-graph refresh`, which is the behaviour before this concern.", "per_event_budget_impact": "Loaded from its own chunk (12,726 B); the dispatch bundle carries one LAZY_CONCERNS row. For a project that never ran `code-graph auto-refresh on` it costs a realpath walk and one stat. Opted in: one `git ls-files`, a PATH scan and one detached spawn; the build runs outside the hook.", "reason": "Owner request of 2026-10-23: the map and graph should stay current without a manual command. It acts only after the explicit per-project opt-in, never on a git-tracked marker or cache, and only runs an agent-config resolved outside the repository. Ratified confirmed-non-expanding 2/2 by the AI council after eight rounds. Kill switch AGENT_CONFIG_CODE_GRAPH_REFRESH=off.", "why_not_extend": "code-graph-context is a pre_tool_use concern that carries state, never side effects, and the council (2026-10-23) held a refresh trigger there in reserve; no existing session_start concern owns the code graph, and the git-hook block cannot reach consumers."}
-{"concern": "layer-promote", "decision": "admitted", "admitted_at": "2026-10-24", "slot": "session_start on claude only (road-to-a-setup-that-decides-itself 3.3). It acts for the FOLLOWING sessions: the running session's rules are already loaded, so nothing it does changes what the session that took the decision reads.", "binding_hosts": "claude (1). The arrival record and the hook carrier it weighs describe the claude rule layer only; `agent-config hooks:status` answers whether the slot is live on the host actually running.", "behaviour_where_deny_ignored": "Not applicable: `severity: advisory`, `fail_closed: false`, it returns no verdict and exits 0 on every path. Where it does not run, a full layer stays full (today's behaviour) and a thinned one is still demoted by the shell branch of the SessionStart command when the carrier is dead.", "per_event_budget_impact": "Loaded from its own 51,620-byte chunk (yaml external, already required by chat_history on the same event); the dispatch bundle carries one LAZY_CONCERNS row. While the shipped switch src/config/layer-form-promotion.json is off it costs three stats and one small JSON read on a full layer, and one arrival-directory read on a thinned one. A promotion is attempted only inside the any_hook_event p95 budget of hook-latency-budget.json; the thin pass measured 11 ms over 121 rules.", "reason": "Step 3.3: promote after proof, never at install. A fresh install still writes the full layer; a later session whose evidence satisfies the layer-form decision thins it, and an arrival record contradicting a thinned layer demotes the machine. Promotion stays off until step 5.3 enables it on a non-inferior pre-registered comparison. Kill switch AGENT_CONFIG_LAYER_PROMOTE=off.", "why_not_extend": "No session_start concern owns the installed rule layer: rule-inject delivers bodies into a session and never rewrites files; the installer owns the thin pass but runs only at install, which is exactly the moment 3.3 forbids promoting at."}
+{"concern": "layer-promote", "decision": "admitted", "admitted_at": "2026-10-24", "slot": "session_start on claude only (road-to-a-setup-that-decides-itself 3.3). It acts for the FOLLOWING sessions: the running session's rules are already loaded, so nothing it does changes what the session that took the decision reads.", "binding_hosts": "claude (1). The arrival record and the hook carrier it weighs describe the claude rule layer only; `agent-config hooks:status` answers whether the slot is live on the host actually running.", "behaviour_where_deny_ignored": "Not applicable: `severity: advisory`, `fail_closed: false`, it returns no verdict and exits 0 on every path. Where it does not run, a full layer stays full (today's behaviour) and a thinned one is still demoted by the shell branch of the SessionStart command when the carrier is dead.", "per_event_budget_impact": "Loaded from its own 52,118-byte chunk (yaml external, already required by chat_history on the same event); the dispatch bundle carries one LAZY_CONCERNS row. While the shipped switch src/config/layer-form-promotion.json is off it costs three stats and one small JSON read on a full layer, and one arrival-directory read on a thinned one. A promotion is attempted only inside the any_hook_event p95 budget of hook-latency-budget.json; the thin pass measured 11 ms over 121 rules.", "reason": "Step 3.3: promote after proof, never at install. A fresh install still writes the full layer; a later session whose evidence satisfies the layer-form decision thins it, and an arrival record contradicting a thinned layer demotes the machine. Promotion stays off until step 5.3 enables it on a non-inferior pre-registered comparison. Kill switch AGENT_CONFIG_LAYER_PROMOTE=off.", "why_not_extend": "No session_start concern owns the installed rule layer: rule-inject delivers bodies into a session and never rewrites files; the installer owns the thin pass but runs only at install, which is exactly the moment 3.3 forbids promoting at."}
diff --git a/src/config/hook-bundle-budget.json b/src/config/hook-bundle-budget.json
index 148c42ea2b..ed5135b0ac 100644
--- a/src/config/hook-bundle-budget.json
+++ b/src/config/hook-bundle-budget.json
@@ -70,7 +70,7 @@
             "from": 1554000,
             "to": 1554800,
             "by": "agent, drain/setup-decides-itself-20261024 (road-to-a-setup-that-decides-itself 3.3 and 3.6)",
-            "what_was_added": "Two things, measured per module from one esbuild metafile over origin/main and over this branch. (1) One `LAZY_CONCERNS` row for `layer-promote` (+144 B); its body, the thin pass and the ownership-ledger rewrite ship in their own 51,620-byte chunk. (2) `projectTreeForm()`, the project tree's precedence rule, now on the live path (+793 B to `project_tree_form.ts`): before, it had no caller and esbuild dropped it, which is exactly the defect the full-quorum council of 2026-10-24 named for step 3.6. Gate reading 1,554,423 B against 1,554,000.",
+            "what_was_added": "Two things, measured per module from one esbuild metafile over origin/main and over this branch. (1) One `LAZY_CONCERNS` row for `layer-promote` (+144 B); its body, the thin pass and the ownership-ledger rewrite ship in their own 52,118-byte chunk. (2) `projectTreeForm()`, the project tree's precedence rule, now on the live path (+793 B to `project_tree_form.ts`): before, it had no caller and esbuild dropped it, which is exactly the defect the full-quorum council of 2026-10-24 named for step 3.6. Gate reading 1,554,423 B against 1,554,000.",
             "why_it_could_not_be_avoided": "D10 recorded that 3.3 would need more than the bytes left and asked for the next raise or extraction to be sized from all blocked work then; 3.3 and 3.6 are that work. Room was not re-tried: the 2026-10-23 and 2026-10-24 entries measured both narrow-event chunk candidates (`session-eol`, `handoff-context`) as buying a few hundred bytes for a quarter-megabyte require on every event, and nothing has changed that trade. The 793 B are the precedence rule itself, which the projector's path must carry, and the 144 B are the row no chunk can carry.",
             "what_would_have_caught_it": "Nothing earlier: the base sat about 514 bytes under the ceiling. Sized to this change plus 377 bytes."
         }
@@ -116,7 +116,7 @@
             "entry": "src/scripts/hooks/layer_promotion_hook.ts",
             "max_bytes": 56800,
             "registered_at": "2026-10-24",
-            "derivation": "Measured 51,620 bytes on 2026-10-24 (the session-start layer step of road-to-a-setup-that-decides-itself 3.3: the decision with its machine evidence, the arrival-record reader, the thin pass, the staged-snapshot restore and the ownership-ledger rewrite) with `yaml` external (the thin pass parses rule frontmatter; `chat_history` requires the same copy earlier on the same event, so the load is a cache hit). The ceiling is that reading plus about 10 %, rounded, with no growth queued. Bound on claude `session_start` alone, so a chunk keeps it off every other dispatch's parse; the bundle carries only its LAZY_CONCERNS row. Like `chat_history` it carries a concern, so a missing chunk falls back to the spawn path and costs latency, never the layer step."
+            "derivation": "Measured 52,118 bytes on 2026-10-24 (the session-start layer step of road-to-a-setup-that-decides-itself 3.3: the decision with its machine evidence, the arrival-record reader, the thin pass, the staged-snapshot restore and the ownership-ledger rewrite) with `yaml` external (the thin pass parses rule frontmatter; `chat_history` requires the same copy earlier on the same event, so the load is a cache hit). The ceiling is that reading plus about 10 %, rounded, with no growth queued. Bound on claude `session_start` alone, so a chunk keeps it off every other dispatch's parse; the bundle carries only its LAZY_CONCERNS row. Like `chat_history` it carries a concern, so a missing chunk falls back to the spawn path and costs latency, never the layer step."
         }
     ],
     "chunks_note": "A chunk is loaded only when a caller needs it, so its bytes are not paid by every dispatch; its ceiling exists so that the move out of dispatch.js stays a measured place rather than an unmeasured one. The gate builds each chunk with the exact esbuild segment `build:hook-chunks` uses for its entry.",
diff --git a/src/install/layerPromotion.ts b/src/install/layerPromotion.ts
index c98e63d29b..01460ae705 100644
--- a/src/install/layerPromotion.ts
+++ b/src/install/layerPromotion.ts
@@ -165,8 +165,9 @@ function rerecord(rulesDir: string, files: readonly string[], env: NodeJS.Proces
 }
 
 /**
- * Files the thin pass must skip: user edits — bytes that differ from what the
- * install recorded — and every rule {@link ruleForm} keeps `full`.
+ * Files the thin pass must skip: any file the ledger does not record as this
+ * package's with exactly these bytes — unrecorded or edited — and every rule
+ * {@link ruleForm} keeps `full`.
  */
 function keptWhole(
     rulesDir: string,
@@ -184,8 +185,9 @@ function keptWhole(
     for (const name of names) {
         const file = path.join(rulesDir, name);
         const rec = recorded.get(relOf(rulesDir, file));
-        const edited = rec !== undefined && global_deploy_inventory.file_sha256(file) !== rec.installed_sha256;
-        if (edited || ruleForm(name.slice(0, -3), decision, never) === 'full') out.add(path.resolve(file));
+        // No record means no proof the file is ours; a record that differs means the user edited it.
+        const notOurs = rec === undefined || global_deploy_inventory.file_sha256(file) !== rec.installed_sha256;
+        if (notOurs || ruleForm(name.slice(0, -3), decision, never) === 'full') out.add(path.resolve(file));
     }
     return out;
 }
@@ -239,6 +241,21 @@ export function restoreStagedLayer(packageRoot: string, rulesDir: string): strin
     return written;
 }
 
+/**
+ * Where post-promotion evidence starts: the recorded promotion time, else the
+ * thinned marker's own mtime. Never "no boundary" — a record missing, torn or
+ * malformed must not let a session from before the promotion decide on it.
+ */
+function promotionBoundary(runtimeRoot: string): string | null {
+    const record = readPromotionRecord(runtimeRoot);
+    if (record !== null && !Number.isNaN(Date.parse(record.promoted_at))) return new Date(record.promoted_at).toISOString();
+    try {
+        return fs.statSync(path.join(runtimeRoot, THINNED_MARKER)).mtime.toISOString();
+    } catch {
+        return null;
+    }
+}
+
 function thinnedDir(runtimeRoot: string): string | null {
     try {
         const first = fs.readFileSync(path.join(runtimeRoot, THINNED_MARKER), 'utf8').split('\n')[0]?.trim() ?? '';
@@ -249,8 +266,8 @@ function thinnedDir(runtimeRoot: string): string | null {
 }
 
 /** Does the arrival record taken after the promotion show a standing law missing? */
-function standingLawMissingSince(runtimeRoot: string, packageRoot: string, env: NodeJS.ProcessEnv, since: string | null): boolean {
-    const lines = readObserverLines(arrivalsDirUnder(runtimeRoot)).filter((l) => since === null || l.ts > since);
+function standingLawMissingSince(runtimeRoot: string, packageRoot: string, env: NodeJS.ProcessEnv, since: string): boolean {
+    const lines = readObserverLines(arrivalsDirUnder(runtimeRoot)).filter((l) => l.ts > since);
     const evidence = arrivalEvidence(latestArrivalRecord(lines), readMachineEvidence(packageRoot, env).standingLaws);
     return evidence !== null && !evidence.standingLawsLoaded;
 }
@@ -285,8 +302,8 @@ export function sessionLayerStep(opts: SessionLayerOptions = {}): SessionLayerOu
         const state = readCarrierState(runtimeRoot);
 
         if (state.layer === 'thinned') {
-            const record = readPromotionRecord(runtimeRoot);
-            if (!standingLawMissingSince(runtimeRoot, packageRoot, env, record?.promoted_at ?? null)) {
+            const since = promotionBoundary(runtimeRoot);
+            if (since === null || !standingLawMissingSince(runtimeRoot, packageRoot, env, since)) {
                 return { action: 'none', reason: 'thinned-holds' };
             }
             const rulesDir = thinnedDir(runtimeRoot) ?? opts.rulesDir ?? path.join(home, '.claude', 'rules');
@@ -308,22 +325,30 @@ export function sessionLayerStep(opts: SessionLayerOptions = {}): SessionLayerOu
         const estimate = readPromotionRecord(runtimeRoot)?.last_thin_ms ?? DEFAULT_THIN_ESTIMATE_MS;
         if (now() - started + estimate > latencyBudgetMs(packageRoot)) return { action: 'skipped', reason: 'over-latency-budget' };
 
+        // The marker goes first, so a pass interrupted part-way leaves a layer the
+        // shell branch and the demotion above both recognise as thinned.
+        markClaudeLayer(runtimeRoot, { thinned: true, rulesDir });
         const rewritten: string[] = [];
         const t0 = now();
-        const res = thinInstalledRuleLayer({
-            rulesDir,
-            packageRoot,
-            bodyLinkRoot: packageRoot,
-            preserved: keptWhole(rulesDir, ledger.recorded, decision, neverThinned(packageRoot)),
-            onWrite: (target) => rewritten.push(target),
-        });
-        const thinMs = Math.max(1, Math.round(now() - t0));
-        if (res.failed.length > 0) {
-            rerecord(rulesDir, restoreStagedLayer(packageRoot, rulesDir) ?? [], env);
-            return { action: 'none', reason: 'thin-failed' };
+        let failed = true;
+        try {
+            const res = thinInstalledRuleLayer({
+                rulesDir,
+                packageRoot,
+                bodyLinkRoot: packageRoot,
+                preserved: keptWhole(rulesDir, ledger.recorded, decision, neverThinned(packageRoot)),
+                onWrite: (target) => rewritten.push(target),
+            });
+            failed = res.failed.length > 0;
+        } finally {
+            if (failed) {
+                rerecord(rulesDir, restoreStagedLayer(packageRoot, rulesDir) ?? [], env);
+                markClaudeLayer(runtimeRoot, { thinned: false, rulesDir });
+            }
         }
+        if (failed) return { action: 'none', reason: 'thin-failed' };
+        const thinMs = Math.max(1, Math.round(now() - t0));
         rerecord(rulesDir, rewritten, env);
-        markClaudeLayer(runtimeRoot, { thinned: true, rulesDir });
         const record: PromotionRecord = {
             promoted_at: (opts.date ?? (() => new Date()))().toISOString(),
             version: versionOf(packageRoot) ?? 'unknown',
diff --git a/tests/install/layer_promotion.test.ts b/tests/install/layer_promotion.test.ts
index 95b732a08e..d356cfe0a2 100644
--- a/tests/install/layer_promotion.test.ts
+++ b/tests/install/layer_promotion.test.ts
@@ -251,6 +251,44 @@ describe('step 3.3 — promote after proof, never at install', () => {
         expect(is_thin_entry(fs.readFileSync(file, 'utf8'))).toBe(false);
     });
 
+    it('a rule file the ledger does not record is never thinned', () => {
+        // A rule a normal promotion DOES thin, so keeping it whole is the ledger's doing.
+        const probe = freshInstall();
+        arrive(probe, 'session-1', '2026-10-24T10:00:00Z', allRules(probe));
+        expect(step(probe).action).toBe('promoted');
+        const victim = allRules(probe).find((id) => is_thin_entry(fs.readFileSync(path.join(probe.rulesDir, `${id}.md`), 'utf8'))) as string;
+        const f = freshInstall();
+        arrive(f, 'session-1', '2026-10-24T10:00:00Z', allRules(f));
+        const inv = inventory.load_inventory(f.ledgerPath);
+        const entry = (inv['tools'] as Record<string, { digests: Record<string, unknown> }>)['claude-code'] as { digests: Record<string, unknown> };
+        delete entry.digests[`rules/${victim}.md`];
+        inventory.save_inventory(inv, f.ledgerPath);
+        expect(step(f).action).toBe('promoted');
+        expect(stubCount(f)).toBeGreaterThan(0);
+        expect(is_thin_entry(fs.readFileSync(path.join(f.rulesDir, `${victim}.md`), 'utf8'))).toBe(false);
+    });
+
+    it('without a readable promotion record the thinned marker sets the boundary', () => {
+        for (const record of [null, '{not json', JSON.stringify({ promoted_at: 'yesterday' })]) {
+            const f = freshInstall();
+            arrive(f, 'session-1', '2026-10-24T10:00:00Z', allRules(f));
+            expect(step(f).action).toBe('promoted');
+            const file = path.join(f.runtimeRoot, PROMOTION_RECORD);
+            if (record === null) fs.rmSync(file);
+            else fs.writeFileSync(file, record);
+            const marked = fs.statSync(path.join(f.runtimeRoot, 'thinned')).mtime.getTime();
+            const missing = LAWS.find((id) => allRules(f).includes(id)) as string;
+            const lawless = allRules(f).filter((id) => id !== missing);
+            // Before the marker: not evidence about this layer.
+            arrive(f, 'before', new Date(marked - 60_000).toISOString(), lawless);
+            fs.rmSync(path.join(f.runtimeRoot, 'arrivals', 'session-1.jsonl'));
+            expect(step(f)).toEqual({ action: 'none', reason: 'thinned-holds' });
+            // After it: the layer is contradicted.
+            arrive(f, 'after', new Date(marked + 60_000).toISOString(), lawless);
+            expect(step(f)).toEqual({ action: 'demoted', reason: 'arrival-standing-law-missing' });
+        }
+    });
+
     it('the concern honours its kill switch and never throws without a staged runtime', () => {
         const f = freshInstall();
         arrive(f, 'session-1', '2026-10-24T10:00:00Z', allRules(f));
```
