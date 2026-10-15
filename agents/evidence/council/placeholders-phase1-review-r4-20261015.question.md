<!-- evidence-type: analysis -->

<!-- The round-4 prompt given to the council on 2026-10-15 for branch
     drain/placeholders-phase-1, committed verbatim so the verdict recorded beside
     it can be checked against what was actually asked. Not edited after the run. -->

# Review branch drain/placeholders-phase-1 — delta since council round 3

Head `14b3eeef2ad750df848f5f6459634c394c0d1dd2`. Round 3 reviewed commit `a296651f6`. One seat approved; the other asked for one change: the regression test for an unreadable settings layer relied on a directory producing `EISDIR`, which is not true on every platform Node supports.

This round covers only commit `14b3eeef2`, shown below. `readEgressMode` now takes the file reader as an optional second parameter (default `fs.readFileSync(p, "utf8")`), and the test injects a reader that throws `EACCES`, `EIO` and `EISDIR` for the project layer (expecting `protect`) and `ENOENT` (expecting `off`). The production branch is unchanged from round 3 apart from the reader being passed through; the doc comment on `egressLayers` now says `broken` also covers an unreadable layer. The bundle and admission figures were re-measured (1,544,054 B).

State whether the delta resolves the round-3 finding. Report any defect in the delta with file:line, the failure scenario and a severity — including whether the new parameter opens a path by which production code could be handed a different reader. State your stance (APPROVE or REQUEST_CHANGES) and the single highest-leverage change.

Omitted: everything rounds 1–3 already covered.

```diff
diff --git a/src/config/hook-latency-budget.json b/src/config/hook-latency-budget.json
index 8c4028c27..fe539e9c5 100644
--- a/src/config/hook-latency-budget.json
+++ b/src/config/hook-latency-budget.json
@@ -59,7 +59,7 @@
         "why_not_a_retry_or_best_of_n": "A second bench on the same job would not help: the spread is between runner classes (p50 111-148 ms), not transient noise within one machine, so a slow runner measures slow twice. Retry logic is the escalation if 175 flaps, not the first move.",
         "revisit_if": "The p50 — not the p95 — of a green run rises above 160 ms. Read the MEDIAN because that is the runner-speed indicator: the observed p50 range is 111-148 ms, so a p50 past 160 is outside every machine this window saw and is the cost itself growing. It then belongs to the owning roadmap (road-to-per-turn-hook-economy, D-2: the dispatcher's own payload read+parse, once per event) rather than to a third cap raise. Raising this number again without a measured distribution beside it is the config-bending this block exists to make visible.",
         "_revisit_if_FIRED_2026_09_30": "THE TRIGGER ABOVE HAS FIRED, and this row records it rather than spending it. Measured on PR #2104 (road-to-a-stop-that-holds), three consecutive CI runs of the gated `via cli` leg: pre_tool_use p50 172, 175 and 176 ms against a revisit-if threshold of 160 and an observed historical p50 range of 111-148. The p95 readings were 179, 176 and 176 against the 175 cap. THE CAP IS NOT RAISED — this block says raising it again without a measured distribution beside it is the config-bending the block exists to make visible, and that verdict is unchanged. WHAT THIS BRANCH CONTRIBUTED, measured rather than guessed: `npm run build:hooks` at this branch produces 1,443,442 bytes against 1,424,332 at its merge base, i.e. +19,110 bytes / +1.34%. Every concern shares one bundle, so that cost is paid by EVERY slot including pre_tool_use, which this branch's diff otherwise does not touch (none of its six changed files is bound on that slot). At ~149 ms of non-spawn work the proportional share is ~2 ms — real, and far short of the 24-64 ms by which the p50 exceeds its historical range, so the dominant term is the runner and the branch is a contributor rather than the cause. `--legal-comments=none` was measured as a mitigation and recovers 635 bytes: the growth is code, not prose, so it cannot be given back without removing the feature. ROUTING, per this block's own revisit-if: this belongs to road-to-per-turn-hook-economy D-2 (the dispatcher's own payload read+parse, once per event) and to the maintainer, not to a third cap raise. Recorded here because a budget pre-registered so it could not be spent silently must not be spent silently.",
-        "_egress_stage_bundle_delta_2026_10_15": "road-to-placeholders-on-the-wire Phase 1 states its delta here, as the fired trigger above requires of every phase that touches the dispatcher. BUNDLE: check_hook_bundle_composition measured 1,529,222 B at the merge base and 1,544,003 B with the egress stage, i.e. +14,781 B / +0.97 %, almost all of it the egress rule table and token grammar the stage imports; 292 modules. RUNTIME, measured in-process on darwin (not on a CI runner): with the shipped default `off` the stage costs one regex over the project settings layers that exist, 0.25 ms cold and 0.09 ms warm, because the full settings cascade (about 25 ms cold, dominated by the template parse) is skipped unless a project layer opens a top-level `egress:` key; with `observe` or `protect`, one detection pass of about 2.3 ms on a 52 KB tool result and 25-35 ms on 2 MB. No cap is changed. Proportional share of the bundle growth at ~149 ms of non-spawn work is about 1 ms on every slot.",
+        "_egress_stage_bundle_delta_2026_10_15": "road-to-placeholders-on-the-wire Phase 1 states its delta here, as the fired trigger above requires of every phase that touches the dispatcher. BUNDLE: check_hook_bundle_composition measured 1,529,222 B at the merge base and 1,544,054 B with the egress stage, i.e. +14,832 B / +0.97 %, almost all of it the egress rule table and token grammar the stage imports; 292 modules. RUNTIME, measured in-process on darwin (not on a CI runner): with the shipped default `off` the stage costs one regex over the project settings layers that exist, 0.25 ms cold and 0.09 ms warm, because the full settings cascade (about 25 ms cold, dominated by the template parse) is skipped unless a project layer opens a top-level `egress:` key; with `observe` or `protect`, one detection pass of about 2.3 ms on a 52 KB tool result and 25-35 ms on 2 MB. No cap is changed. Proportional share of the bundle growth at ~149 ms of non-spawn work is about 1 ms on every slot.",
         "_revisit_if_correction":"First written as 'a green run measures p95 above 160 ms', which round 2 finding 9 refuted from inside this same block: 160 sits 15 ms BELOW the new cap and 3 ms above the observed max, so the very first green 161 ms run would pass the gate and simultaneously trip a trigger declaring the variance to be over. A trigger has to live outside the spread its own cap absorbs, and on a p95 with 42 ms of runner spread no such point exists below 175. The p50 has a spread of 37 ms and a ceiling of 148, so it does."
     },
     "per_turn_composite": {
diff --git a/src/scripts/hooks/egress_stage.ts b/src/scripts/hooks/egress_stage.ts
index da14701b9..269a1f452 100644
--- a/src/scripts/hooks/egress_stage.ts
+++ b/src/scripts/hooks/egress_stage.ts
@@ -119,15 +119,16 @@ const EGRESS_WORD = /\begress\b/;
  * cannot carry `egress` (it is not on MERGEABLE_KEYS). When no layer contains
  * the word at all the shipped default holds, and the full cascade — whose
  * template parse measured about 25 ms cold — is skipped. A layer that names it
- * anywhere, even in a comment, pays the full parse. `broken` means a naming
- * layer does not parse; the cascade would read it as empty and fall to `off`.
+ * anywhere, even in a comment, pays the full parse. `broken` means a layer
+ * exists but cannot be read, or names `egress` and does not parse; the cascade
+ * would read either as empty and fall to `off`.
  */
-function egressLayers(workspaceRoot: string): "none" | "named" | "broken" {
+function egressLayers(workspaceRoot: string, readFile: (p: string) => string): "none" | "named" | "broken" {
   let named = false;
   for (const p of _resolve_cascade_paths(workspaceRoot, null)) {
     let text: string;
     try {
-      text = fs.readFileSync(p, "utf8");
+      text = readFile(p);
     } catch (exc) {
       // Only a missing layer is skipped; a layer that exists and cannot be read could hold the mode.
       const code = (exc as NodeJS.ErrnoException).code;
@@ -150,11 +151,14 @@ function egressLayers(workspaceRoot: string): "none" | "named" | "broken" {
  * `protect`, never `off`: a broken file must not switch configured protection
  * off in silence. The count record carries the mode, so the fallback is visible.
  */
-export function readEgressMode(workspaceRoot: string): EgressMode {
+export function readEgressMode(
+  workspaceRoot: string,
+  readFile: (p: string) => string = (p) => fs.readFileSync(p, "utf8"),
+): EgressMode {
   if (isEnvKillSwitchActive(EGRESS_STAGE_KILL_SWITCH)) return "off";
   let layers: "none" | "named" | "broken";
   try {
-    layers = egressLayers(workspaceRoot);
+    layers = egressLayers(workspaceRoot, readFile);
   } catch {
     return "protect";
   }
diff --git a/tests/scripts/hooks/egress_stage.test.ts b/tests/scripts/hooks/egress_stage.test.ts
index a48b9eb41..3511146d4 100644
--- a/tests/scripts/hooks/egress_stage.test.ts
+++ b/tests/scripts/hooks/egress_stage.test.ts
@@ -94,10 +94,16 @@ describe("mode resolution", () => {
     expect(readEgressMode(tmp)).toBe("protect");
   });
 
-  it("a layer that exists but cannot be read is protect, not off", () => {
-    // A directory where the file should be reads as EISDIR on every platform.
-    fs.mkdirSync(path.join(tmp, ".agent-settings.yml"));
-    expect(readEgressMode(tmp)).toBe("protect");
+  it("a layer that exists but cannot be read is protect, not off; a missing one is skipped", () => {
+    fs.writeFileSync(path.join(tmp, ".agent-settings.yml"), "screenshots: {}\n");
+    const failing = (code: string) => (p: string): string => {
+      if (p.endsWith(".agent-settings.yml") && !p.includes(`${path.sep}agents${path.sep}`)) {
+        throw Object.assign(new Error("read failed"), { code });
+      }
+      throw Object.assign(new Error("absent"), { code: "ENOENT" });
+    };
+    for (const code of ["EACCES", "EIO", "EISDIR"]) expect(readEgressMode(tmp, failing(code))).toBe("protect");
+    expect(readEgressMode(tmp, failing("ENOENT"))).toBe("off");
   });
 
   it("reads the project layer, and a comment naming egress is not a key", () => {
```
