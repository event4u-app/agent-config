<!-- evidence-type: analysis -->

<!-- A prompt given to the council on 2026-10-15 for branch drain/placeholders-phase-1,
     committed verbatim so the verdict recorded beside it can be checked against
     what was actually asked. Not edited after the run. -->

# Review branch drain/placeholders-phase-1 — the gated set of the ratification record

Round 4 (commit `14b3eeef2`) closed with both seats approving. CI then refused the ratification record: the base revision's gate classifies **four** files of this diff as hook plumbing, not the two the record's digest was computed over, because the stage module and the settings reader arrive in the dispatcher's import closure:

- `src/config/hook-latency-budget.json`
- `src/scripts/_lib/agent_settings.ts`
- `src/scripts/hooks/dispatch_hook.ts`
- `src/scripts/hooks/egress_stage.ts`

The content of these four files is byte-identical at `14b3eeef2` (reviewed in round 4) and at the current head: the `ratification_subject` digest over the four is `0476a16f388eb7fafca738c30b2335dbfeff8da612974b060d80a62b8089ee04` at both. The commits since round 4 touch none of them: two test-only commits, a merge of `origin/main` (three files of another PR, none gated), and an ADR evidence section.

`egress_stage.ts` was shown in full in rounds 3 and 4. The other three were shown in part: round 1 named the `hook-latency-budget.json` note as omitted, and later rounds showed only edits to its figures. This round shows those three files' complete diff against the base, below, so the record can be bound to content a review saw.

For each of the three, report any defect with file:line, the failure scenario and a severity — in particular whether the `hook-latency-budget.json` note changes any threshold, cap or gate behaviour, and whether the `agent_settings.ts` export widens what a caller can do. State your stance (APPROVE or REQUEST_CHANGES) and the single highest-leverage change.

Omitted: `egress_stage.ts` (shown in rounds 3–4, unchanged since) and every non-gated file.

```diff
diff --git a/src/config/hook-latency-budget.json b/src/config/hook-latency-budget.json
index 06bd9e859..fe539e9c5 100644
--- a/src/config/hook-latency-budget.json
+++ b/src/config/hook-latency-budget.json
@@ -61,3 +61,4 @@
         "_revisit_if_FIRED_2026_09_30": "THE TRIGGER ABOVE HAS FIRED, and this row records it rather than spending it. Measured on PR #2104 (road-to-a-stop-that-holds), three consecutive CI runs of the gated `via cli` leg: pre_tool_use p50 172, 175 and 176 ms against a revisit-if threshold of 160 and an observed historical p50 range of 111-148. The p95 readings were 179, 176 and 176 against the 175 cap. THE CAP IS NOT RAISED — this block says raising it again without a measured distribution beside it is the config-bending the block exists to make visible, and that verdict is unchanged. WHAT THIS BRANCH CONTRIBUTED, measured rather than guessed: `npm run build:hooks` at this branch produces 1,443,442 bytes against 1,424,332 at its merge base, i.e. +19,110 bytes / +1.34%. Every concern shares one bundle, so that cost is paid by EVERY slot including pre_tool_use, which this branch's diff otherwise does not touch (none of its six changed files is bound on that slot). At ~149 ms of non-spawn work the proportional share is ~2 ms — real, and far short of the 24-64 ms by which the p50 exceeds its historical range, so the dominant term is the runner and the branch is a contributor rather than the cause. `--legal-comments=none` was measured as a mitigation and recovers 635 bytes: the growth is code, not prose, so it cannot be given back without removing the feature. ROUTING, per this block's own revisit-if: this belongs to road-to-per-turn-hook-economy D-2 (the dispatcher's own payload read+parse, once per event) and to the maintainer, not to a third cap raise. Recorded here because a budget pre-registered so it could not be spent silently must not be spent silently.",
-        "_revisit_if_correction": "First written as 'a green run measures p95 above 160 ms', which round 2 finding 9 refuted from inside this same block: 160 sits 15 ms BELOW the new cap and 3 ms above the observed max, so the very first green 161 ms run would pass the gate and simultaneously trip a trigger declaring the variance to be over. A trigger has to live outside the spread its own cap absorbs, and on a p95 with 42 ms of runner spread no such point exists below 175. The p50 has a spread of 37 ms and a ceiling of 148, so it does."
+        "_egress_stage_bundle_delta_2026_10_15": "road-to-placeholders-on-the-wire Phase 1 states its delta here, as the fired trigger above requires of every phase that touches the dispatcher. BUNDLE: check_hook_bundle_composition measured 1,529,222 B at the merge base and 1,544,054 B with the egress stage, i.e. +14,832 B / +0.97 %, almost all of it the egress rule table and token grammar the stage imports; 292 modules. RUNTIME, measured in-process on darwin (not on a CI runner): with the shipped default `off` the stage costs one regex over the project settings layers that exist, 0.25 ms cold and 0.09 ms warm, because the full settings cascade (about 25 ms cold, dominated by the template parse) is skipped unless a project layer opens a top-level `egress:` key; with `observe` or `protect`, one detection pass of about 2.3 ms on a 52 KB tool result and 25-35 ms on 2 MB. No cap is changed. Proportional share of the bundle growth at ~149 ms of non-spawn work is about 1 ms on every slot.",
+        "_revisit_if_correction":"First written as 'a green run measures p95 above 160 ms', which round 2 finding 9 refuted from inside this same block: 160 sits 15 ms BELOW the new cap and 3 ms above the observed max, so the very first green 161 ms run would pass the gate and simultaneously trip a trigger declaring the variance to be over. A trigger has to live outside the spread its own cap absorbs, and on a p95 with 42 ms of runner spread no such point exists below 175. The p50 has a spread of 37 ms and a ceiling of 148, so it does."
     },
diff --git a/src/scripts/_lib/agent_settings.ts b/src/scripts/_lib/agent_settings.ts
index f2a81c4ba..180cdbf9b 100644
--- a/src/scripts/_lib/agent_settings.ts
+++ b/src/scripts/_lib/agent_settings.ts
@@ -802,3 +802,3 @@ export function resolve_project_root(
  */
-function _resolve_cascade_paths(
+export function _resolve_cascade_paths(
     cwd: string | null,
diff --git a/src/scripts/hooks/dispatch_hook.ts b/src/scripts/hooks/dispatch_hook.ts
index b6593e464..5faf7f0e9 100644
--- a/src/scripts/hooks/dispatch_hook.ts
+++ b/src/scripts/hooks/dispatch_hook.ts
@@ -58,2 +58,3 @@ export { _concern_permission_verdict, _payload_tool_input, _payload_tool_name, _
 import { _concern_body_classes, planPayloadShapes } from "./payload_stub.js";
+import { egressViewFor, runEgressStage } from "./egress_stage.js";
 import { resolveSessionRole, type SessionRole } from "../_lib/session_role.js";
@@ -1278,8 +1279,5 @@ export function main(argv?: string[]): number {
   const tool_name = _payload_tool_name(envelope);
-  // Payload opt-in (step 2.1). There are at most FOUR distinct envelope shapes
-  // per dispatch (keep neither / input / result / both), so they are memoised
-  // by keep-set: concerns sharing a declaration share one clone, and building
-  // one per concern would re-pay the allocation the stub exists to avoid.
-  // `present` is the set of body classes this event actually carries — empty on
-  // every non-tool event, which is why those pay nothing at all.
+  // The egress stage (ADR-285) builds the placeholder view before any concern
+  // runs; `egressViewFor` decides which concern gets which view.
+  const egress = runEgressStage(envelope);
   // Payload opt-in (step 2.1). One planner owns the whole decision — which
@@ -1295,2 +1293,3 @@ export function main(argv?: string[]): number {
     keep_by_concern.map(([, keep]) => keep),
+    egress.placeholder,
   );
@@ -1300,3 +1299,3 @@ export function main(argv?: string[]): number {
     }
-    const concern_envelope = shapes.shapeFor(keep_classes);
+    const concern_envelope = shapes.shapeFor(keep_classes, egressViewFor(concern));
     const stubs_served = shapes.stubsFor(keep_classes);
```
