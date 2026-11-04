<!-- evidence-type: analysis -->

# Ratification review — the design-consistency check on by default, and the dispatch bundle raise it needs — round 2

You are an independent reviewer for a change in the `event4u/agent-config` repository, branch `fix/design-consistency-false-alarms`.

subject: 9a9482074163a6bfe4d9f4c6b753e4ab9651599ee2b1c900d21fe963d9a7f96c

Round 1 (`agents/evidence/council/design-consistency-default-ratification-r1-20261027.question.md`, which carries the full description and diff of the change) split: one seat ratified, one refused. The refusal named one defect and three record gaps:

1. `consistencyFor` called `load()` outside its `try`, so a loader that throws would escape into the dispatch.
2. The settings template comment read as if the shadow row were written regardless of the setting.
3. The `raise_log` entry named no toolchain for its measurement.
4. The "1 byte under the ceiling" base and the "no growth queued" chunk ceiling were unexplained.

The digest above covers `src/config/hook-bundle-budget.json` at revision `5ec06b2d9e`. Below is `git diff e47cb4a574 5ec06b2d9e` for the files that changed since round 1 (the regenerated `dist/install/install.mjs` is omitted). The test for item 1 was run red before the fix ("Error: loader broke") and is green after it. The bundle now measures 1,558,555 B under the unchanged 1,558,850 ceiling.

## What to answer

1. Do the changes close the four points above? Name file and line for anything still open.
2. Re-reading the whole change as round 1 described it: is the raise justified, does the failure contract of the conditional chunk hold, and is the default flip bounded as described?
3. Do you approve the gated content?

End with exactly one verdict line: `VERDICT: ratified`, `VERDICT: confirmed-non-expanding`, or `VERDICT: refused — <reason>`.

## The diff since round 1

```diff
diff --git a/src/config/agent-settings.template.yml b/src/config/agent-settings.template.yml
index 31abbebfa2..391193655a 100644
--- a/src/config/agent-settings.template.yml
+++ b/src/config/agent-settings.template.yml
@@ -1357,8 +1357,9 @@ hooks:
   # cannot render the component (a server template, a handover prototype) is
   # not measured. Turned on after a retroactive shadow window met all four
   # conditions of docs/contracts/concern-activation-policy.md. The box-metrics
-  # half stays in shadow: every UI write adds a row to
+  # half stays in shadow: while this is enabled, every UI write adds a row to
   # agents/runtime/state/design-consistency-shadow.jsonl and nothing is shown.
+  # Disabled, nothing runs and nothing is recorded.
   design_consistency:
     enabled: true
 
diff --git a/src/config/hook-bundle-budget.json b/src/config/hook-bundle-budget.json
index f042076e53..eda984380c 100644
--- a/src/config/hook-bundle-budget.json
+++ b/src/config/hook-bundle-budget.json
@@ -106,8 +106,8 @@
             "from": 1556670,
             "to": 1558850,
             "by": "agent, fix/design-consistency-false-alarms (road-to-a-control-that-matches-its-neighbours 3.8)",
-            "what_was_added": "The consistency check turned on by default inside the in-bundle `design-pass` concern: the `hooks.design_consistency` switch read with a default of on, a narrow consistency-only path for installs where the rest of the pass stays off, the call that adds its findings when the whole pass is on, and the loader of its conditional chunk. The check itself (`ui:audit`, the role parser, the rules and the shadow recorder) ships in `design_consistency.chunk.cjs`, required on a UI write alone. Measured 1,558,551 B with the change on a base of 1,556,669 B: +1,882 B.",
-            "why_it_could_not_be_avoided": "Room was made first: the chunk-require logic of `svg_rules_loader` became one shared `chunkExport`, which both loaders call, taking the first measurement from +2,061 to +1,882 B. Moving `design-pass` itself into a lazy chunk was considered and refused on the same trade the 2026-10-23 entry refused for `session-eol`: the concern is bound on every `post_tool_use`, so its body plus the slop registry would be required on every tool call of every install, against a switch that today returns in the bundle. What remains is the switch, the two call sites and the loader, which no chunk can carry because the concern that calls them is in the bundle. The base sat 1 byte under the ceiling.",
+            "what_was_added": "The consistency check turned on by default inside the in-bundle `design-pass` concern: the `hooks.design_consistency` switch read with a default of on, a narrow consistency-only path for installs where the rest of the pass stays off, the call that adds its findings when the whole pass is on, and the loader of its conditional chunk. The check itself (`ui:audit`, the role parser, the rules and the shadow recorder) ships in `design_consistency.chunk.cjs`, required on a UI write alone. Measured 1,558,555 B with the change on a base of 1,556,669 B: +1,886 B (Node 26.7.0, esbuild 0.28.1, Darwin arm64; the gate rebuilds from source, so a different esbuild minor can move the figure by some hundreds of bytes).",
+            "why_it_could_not_be_avoided": "Room was made first: the chunk-require logic of `svg_rules_loader` became one shared `chunkExport`, which both loaders call, taking the first measurement from +2,061 to +1,882 B. Moving `design-pass` itself into a lazy chunk was considered and refused on the same trade the 2026-10-23 entry refused for `session-eol`: the concern is bound on every `post_tool_use`, so its body plus the slop registry would be required on every tool call of every install, against a switch that today returns in the bundle. What remains is the switch, the two call sites and the loader, which no chunk can carry because the concern that calls them is in the bundle. The base sat 1 byte under the ceiling: the 2026-10-25 entry above set 1,556,670 at its own round-1 reading, and later merges consumed all but that byte.",
             "what_would_have_caught_it": "Nothing earlier: with 1 byte of headroom any change to an in-bundle concern trips the ceiling. Sized to this change plus about 300 bytes."
         }
     ],
@@ -128,7 +128,7 @@
             "entry": "src/scripts/_lib/design_consistency_pass.ts",
             "max_bytes": 40000,
             "registered_at": "2026-10-27",
-            "derivation": "Measured 36,545 bytes on 2026-10-27: the consistency check `design-pass` runs on a UI write (the `ui:audit` computation, the control-role parser, the two consistency rules and the shadow recorder). The ceiling is that reading plus about 9 %, rounded, with no growth queued. Required on a UI write alone, so no other dispatch parses it; the bundle carries only its loader and two call sites, the 2026-10-27 raise of `max_bytes`. A missing or mis-digested chunk costs the consistency finding, never the event (`design_consistency_loader.ts`)."
+            "derivation": "Measured 36,545 bytes on 2026-10-27: the consistency check `design-pass` runs on a UI write (the `ui:audit` computation, the control-role parser, the two consistency rules and the shadow recorder). The ceiling is that reading plus about 9 %, rounded, with no growth queued: no further consistency rule is planned, and the box-metrics rule already ships in it. Required on a UI write alone, so no other dispatch parses it; the bundle carries only its loader and two call sites, the 2026-10-27 raise of `max_bytes`. A missing or mis-digested chunk costs the consistency finding, never the event (`design_consistency_loader.ts`)."
         },
         {
             "entry": "src/scripts/chat_history.ts",
diff --git a/src/scripts/hooks/design_pass_hook.ts b/src/scripts/hooks/design_pass_hook.ts
index 855ca8fc78..a48d2b6e36 100644
--- a/src/scripts/hooks/design_pass_hook.ts
+++ b/src/scripts/hooks/design_pass_hook.ts
@@ -164,9 +164,9 @@ export function enabled(root: string, key = 'design_pass', fallback = false): bo
 
 /** Raw-control findings for one UI file, from the conditional chunk. */
 export function consistencyFor(root: string, rel: string, load = loadConsistencyPass): Finding[] {
-    const run = load();
-    if (!run) return [];
     try {
+        const run = load();
+        if (!run) return [];
         const abs = path.resolve(root, rel);
         return run(root, rel, fs.readFileSync(abs, 'utf-8')).map((n) => ({
             file: rel,
diff --git a/src/server/schemas/settings.ts b/src/server/schemas/settings.ts
index 05bdfdfccd..bcf90fb40b 100644
--- a/src/server/schemas/settings.ts
+++ b/src/server/schemas/settings.ts
@@ -483,7 +483,7 @@ export const settingsSchema = z.object({
         }).prefault({}),
         design_consistency: z.object({
             enabled: z.boolean().default(true).describe(
-                'Control consistency on a UI write (road-to-a-control-that-matches-its-neighbours 3.8). Default on, independent of design_pass. A raw select, input or textarea written where the project already has its own Select, Input or Textarea is delivered as one advisory line naming the project control; it never blocks. A file that cannot render the component (a server template, a handover prototype) is not measured. Turned on after a retroactive shadow window met all four conditions of the concern-activation policy. The box-metrics half stays in shadow: every UI write adds a row to agents/runtime/state/design-consistency-shadow.jsonl and nothing is shown.',
+                'Control consistency on a UI write (road-to-a-control-that-matches-its-neighbours 3.8). Default on, independent of design_pass. A raw select, input or textarea written where the project already has its own Select, Input or Textarea is delivered as one advisory line naming the project control; it never blocks. A file that cannot render the component (a server template, a handover prototype) is not measured. Turned on after a retroactive shadow window met all four conditions of the concern-activation policy. The box-metrics half stays in shadow: while this is enabled, every UI write adds a row to agents/runtime/state/design-consistency-shadow.jsonl and nothing is shown. Disabled, nothing runs and nothing is recorded.',
             ),
         }).prefault({}),
         ui_route_nudge: z.object({
diff --git a/tests/hooks/design_consistency_default.test.ts b/tests/hooks/design_consistency_default.test.ts
index 50336fd734..958fce83d1 100644
--- a/tests/hooks/design_consistency_default.test.ts
+++ b/tests/hooks/design_consistency_default.test.ts
@@ -90,6 +90,10 @@ describe('the chunk boundary', () => {
     it('a missing chunk costs the finding, never the event', () => {
         const root = project();
         expect(consistencyFor(root, 'app/filters.tsx', () => null)).toEqual([]);
+        const throwing = () => {
+            throw new Error('loader broke');
+        };
+        expect(consistencyFor(root, 'app/filters.tsx', throwing)).toEqual([]);
     });
 
     it('bundled, the check is the sibling chunk; from source, the module', () => {
```
