<!-- evidence-type: analysis -->

# Ratification review — the egress mode from one read of the settings layers

Branch `feat/inbox-2026-10-al-am` (head `66aeb91039`) against `origin/main` (`384e9e85c9`).
`check_kernel_edit_ratified` gates two files: `src/scripts/hooks/egress_stage.ts` and
`src/config/hook-latency-budget.json`. Subject digest:
`f51d59d1cb4b3f98eda950e15bb6fefcdc5008a0ff4ced977624bfffb4ee6e81`.

## History of this review

Rounds 1-3 refused a reader that parsed only a layer's `egress:` block. Round 4
refused 2/2 a per-layer skip that judged each layer on one read while the
cascade (`load_agent_settings`) resolved on a second read, so a file changed
between the two reads could resolve `off` where `origin/main` read `protect`;
both seats asked for one snapshot used for detection and resolution. Both
earlier designs are withdrawn.

## The change now

`readEgressMode` no longer calls `load_agent_settings`. `egressFromLayers` reads
every path `_resolve_cascade_paths` returns, once. A missing layer is skipped;
a layer that exists and cannot be read is `protect`. If no text contains the word
`egress`, the mode is `off` without parsing (as on `origin/main`). Otherwise every
read text is parsed with YAML 1.1 (the cascade's reader uses the same version):
a layer naming the word that fails to parse is `protect` (as on `origin/main`); a
layer without the word that fails to parse is read as empty (as the cascade reads
it); a parsed document that is an object and has an `egress` key contributes
`{egress: ...}`, merged in cascade order with the cascade's rule (plain objects
merge key by key, anything else replaces). The mode is `resolveEgressMode` of the
merged object. Why this equals the cascade's `egress`: the user-global layer is
filtered to `MERGEABLE_KEYS`, which does not include `egress`; the template
default below every layer is `mode: "off"`; `RENAMED_KEYS` maps nothing onto
`egress`. A test runs 64 two-layer combinations (absent, protect, off, empty
placeholders, a scalar, an extra key, a comment-only mention, a mis-cased mode)
against `resolveEgressMode(load_agent_settings(...))`. Measured on the template:
26.0 ms cold / 9.9 ms warm before, 10.4 / 3.3 ms after.

## Round 6

Round 5 refused 2/2 on one point: with the working directory at or under
`agents/settings`, `_resolve_cascade_paths` returns the canonical layer twice
(in the directory chain and as the appended canonical path), so the snapshot
read that file twice. One seat also asked whether a user-global `egress` could
enter; the other seat answered that `_resolve_cascade_paths` returns project
layers only. Since round 5, commit `66aeb91039`: the path list is reduced to
each path's LAST position before reading (`A·D·A` → `D·A`, equal under the
cascade's last-writer-wins merge, where every leaf ends with its last writer and
a replaced subtree is replaced again by the later A), so every file is read once.
Tests added: a read-count test under `agents/settings` (fails at 2 reads without
the reduction), and the 64-combination parity test now runs at two working
directories (`pkg/` and `agents/settings/`) with a user-global
`egress: {placeholders: {mode: strict}}` present, which the cascade filters and
the stage never reads.

## Question

Review the diff below. Is any authority expanded, any enforcing surface made
non-enforcing, or any configured protection (`observe`, `protect`, `strict`)
able to resolve to `off` through the new path where `origin/main` would not?
Name every defect you find with the line it sits on.

Answer with exactly one verdict on its own line — `ratified`, `confirmed-non-expanding`
or `refused` — followed by your reasons.

## Diff (`git diff origin/main...HEAD` for the gated files and the test file)

```diff
diff --git a/src/config/hook-latency-budget.json b/src/config/hook-latency-budget.json
index 804625065b..a9ec567ea9 100644
--- a/src/config/hook-latency-budget.json
+++ b/src/config/hook-latency-budget.json
@@ -61,7 +61,7 @@
         "why_not_a_retry_or_best_of_n": "A second bench on the same job would not help: the spread is between runner classes (p50 111-148 ms), not transient noise within one machine, so a slow runner measures slow twice. Retry logic is the escalation if 175 flaps, not the first move.",
         "revisit_if": "The p50 — not the p95 — of a green run rises above 160 ms. Read the MEDIAN because that is the runner-speed indicator: the observed p50 range is 111-148 ms, so a p50 past 160 is outside every machine this window saw and is the cost itself growing. It then belongs to the owning roadmap (road-to-per-turn-hook-economy, D-2: the dispatcher's own payload read+parse, once per event) rather than to a third cap raise. Raising this number again without a measured distribution beside it is the config-bending this block exists to make visible.",
         "_revisit_if_FIRED_2026_09_30": "THE TRIGGER ABOVE HAS FIRED, and this row records it rather than spending it. Measured on PR #2104 (road-to-a-stop-that-holds), three consecutive CI runs of the gated `via cli` leg: pre_tool_use p50 172, 175 and 176 ms against a revisit-if threshold of 160 and an observed historical p50 range of 111-148. The p95 readings were 179, 176 and 176 against the 175 cap. THE CAP IS NOT RAISED — this block says raising it again without a measured distribution beside it is the config-bending the block exists to make visible, and that verdict is unchanged. WHAT THIS BRANCH CONTRIBUTED, measured rather than guessed: `npm run build:hooks` at this branch produces 1,443,442 bytes against 1,424,332 at its merge base, i.e. +19,110 bytes / +1.34%. Every concern shares one bundle, so that cost is paid by EVERY slot including pre_tool_use, which this branch's diff otherwise does not touch (none of its six changed files is bound on that slot). At ~149 ms of non-spawn work the proportional share is ~2 ms — real, and far short of the 24-64 ms by which the p50 exceeds its historical range, so the dominant term is the runner and the branch is a contributor rather than the cause. `--legal-comments=none` was measured as a mitigation and recovers 635 bytes: the growth is code, not prose, so it cannot be given back without removing the feature. ROUTING, per this block's own revisit-if: this belongs to road-to-per-turn-hook-economy D-2 (the dispatcher's own payload read+parse, once per event) and to the maintainer, not to a third cap raise. Recorded here because a budget pre-registered so it could not be spent silently must not be spent silently.",
-        "_egress_stage_bundle_delta_2026_10_15": "road-to-placeholders-on-the-wire Phase 1 states its delta here, as the fired trigger above requires of every phase that touches the dispatcher. BUNDLE: check_hook_bundle_composition measured 1,529,222 B at the merge base and 1,544,054 B with the egress stage, i.e. +14,832 B / +0.97 %, almost all of it the egress rule table and token grammar the stage imports; 292 modules. RUNTIME, measured in-process on darwin (not on a CI runner): with the shipped default `off` the stage costs one regex over the project settings layers that exist, 0.25 ms cold and 0.09 ms warm, because the full settings cascade (about 25 ms cold, dominated by the template parse) is skipped unless a project layer opens a top-level `egress:` key; with `observe` or `protect`, one detection pass of about 2.3 ms on a 52 KB tool result and 25-35 ms on 2 MB. No cap is changed. Proportional share of the bundle growth at ~149 ms of non-spawn work is about 1 ms on every slot.",
+        "_egress_stage_bundle_delta_2026_10_15": "road-to-placeholders-on-the-wire Phase 1 states its delta here, as the fired trigger above requires of every phase that touches the dispatcher. BUNDLE: check_hook_bundle_composition measured 1,529,222 B at the merge base and 1,544,054 B with the egress stage, i.e. +14,832 B / +0.97 %, almost all of it the egress rule table and token grammar the stage imports; 292 modules. RUNTIME, measured in-process on darwin (not on a CI runner): with the shipped default `off` the stage costs one regex over the project settings layers that exist, 0.25 ms cold and 0.09 ms warm, because the full settings cascade (about 25 ms cold, dominated by the template parse) is skipped unless a project layer opens a top-level `egress:` key; CORRECTED 2026-10-25: that skip keyed on the bare word, and the installer-written template opens `egress:` with mode `off` and names the word in comments, so every installed project paid a parse of each layer AND the full cascade, which read them again (readEgressMode on the template, darwin in-process: 26.0 ms cold / 9.9 ms warm); the mode is now resolved from that one read, merged in the cascade's order with its rule, and the cascade is never called (10.4 ms cold / 3.3 ms warm on the same template); with `observe` or `protect`, one detection pass of about 2.3 ms on a 52 KB tool result and 25-35 ms on 2 MB. No cap is changed. Proportional share of the bundle growth at ~149 ms of non-spawn work is about 1 ms on every slot.",
         "_revisit_if_correction":"First written as 'a green run measures p95 above 160 ms', which round 2 finding 9 refuted from inside this same block: 160 sits 15 ms BELOW the new cap and 3 ms above the observed max, so the very first green 161 ms run would pass the gate and simultaneously trip a trigger declaring the variance to be over. A trigger has to live outside the spread its own cap absorbs, and on a p95 with 42 ms of runner spread no such point exists below 175. The p50 has a spread of 37 ms and a ceiling of 148, so it does."
     },
     "per_turn_composite": {
diff --git a/src/scripts/hooks/egress_stage.ts b/src/scripts/hooks/egress_stage.ts
index 9652921bd5..750c9dec7e 100644
--- a/src/scripts/hooks/egress_stage.ts
+++ b/src/scripts/hooks/egress_stage.ts
@@ -16,7 +16,7 @@ import * as path from "node:path";
 
 import { parse as parseYaml } from "yaml";
 
-import { _resolve_cascade_paths, load_agent_settings } from "../_lib/agent_settings.js";
+import { _resolve_cascade_paths } from "../_lib/agent_settings.js";
 import type { EgressClass } from "../_lib/egress_rules.js";
 import type { TokenScope } from "../_lib/egress_token.js";
 import { isEnvKillSwitchActive } from "../_lib/env_kill_switch.js";
@@ -116,36 +116,61 @@ export function resolveEgressMode(settings: unknown): EgressMode {
 /** Any spelling of the key — block, flow or quoted — contains the word. */
 const EGRESS_WORD = /\begress\b/;
 
+/** The cascade's merge rule: plain objects merge key by key, anything else replaces. Mutates parsed layers, which are discarded. */
+function mergeInto(dst: JsonObject, src: JsonObject): void {
+  for (const [k, v] of Object.entries(src)) {
+    const cur = dst[k];
+    if (isObject(v) && isObject(cur)) mergeInto(cur, v);
+    else dst[k] = v;
+  }
+}
+
 /**
- * Every project settings layer the cascade would read; the user-global layer
- * cannot carry `egress` (it is not on MERGEABLE_KEYS). When no layer contains
- * the word at all the shipped default holds, and the full cascade — whose
- * template parse measured about 25 ms cold — is skipped. A layer that names it
- * anywhere, even in a comment, pays the full parse. `broken` means a layer
- * exists but cannot be read, or names `egress` and does not parse; the cascade
- * would read either as empty and fall to `off`.
+ * The mode, read from ONE read of every project settings layer the cascade
+ * would read, merged in the cascade's order with its rule. The user-global
+ * layer cannot carry `egress` (it is not on MERGEABLE_KEYS), the template's
+ * default is `off`, and no rename maps onto the key, so the merged `egress` of
+ * the project layers is the cascade's.
+ *
+ * Detection and resolution share this one read. The previous path read every
+ * layer to look for the word and then ran the full cascade, which read them
+ * again — 26.0 ms cold / 9.9 ms warm on the template the installer writes into
+ * every project, because that template opens `egress:` with mode `off`. A
+ * second read is also a second answer: a layer changed between the two could
+ * be judged by one and resolved by the other.
+ *
+ * No layer naming the word: `off`, unparsed, as before. Otherwise every layer is
+ * parsed. A layer that exists and cannot be read, or names the word and does not
+ * parse, is `protect`; a layer without the word that does not parse is read as
+ * empty, as the cascade reads it.
  */
-function egressLayers(workspaceRoot: string, readFile: (p: string) => string): "none" | "named" | "broken" {
-  let named = false;
-  for (const p of _resolve_cascade_paths(workspaceRoot, null)) {
-    let text: string;
+function egressFromLayers(workspaceRoot: string, readFile: (p: string) => string): EgressMode {
+  // The canonical layer can also sit in the directory chain. Under the
+  // cascade's last-writer-wins merge, A·D·A equals D·A, so each path is read
+  // once, at its last position.
+  const texts: string[] = [];
+  for (const p of [...new Set(_resolve_cascade_paths(workspaceRoot, null).reverse())].reverse()) {
     try {
-      text = readFile(p);
+      texts.push(readFile(p));
     } catch (exc) {
       // Only a missing layer is skipped; a layer that exists and cannot be read could hold the mode.
-      const code = (exc as NodeJS.ErrnoException).code;
-      if (code === "ENOENT" || code === "ENOTDIR") continue;
-      return "broken";
+      if (/^ENO(ENT|TDIR)$/.test((exc as NodeJS.ErrnoException).code ?? "")) continue;
+      return "protect";
     }
-    if (!EGRESS_WORD.test(text)) continue;
-    named = true;
+  }
+  if (!texts.some((t) => EGRESS_WORD.test(t))) return "off";
+  const merged: JsonObject = {};
+  for (const text of texts) {
+    let doc: unknown;
     try {
-      parseYaml(text, { version: "1.1" });
+      doc = parseYaml(text, { version: "1.1" });
     } catch {
-      return "broken";
+      if (EGRESS_WORD.test(text)) return "protect";
+      continue;
     }
+    if (isObject(doc) && "egress" in doc) mergeInto(merged, { egress: doc["egress"] } as JsonObject);
   }
-  return named ? "named" : "none";
+  return resolveEgressMode(merged);
 }
 
 /**
@@ -158,16 +183,8 @@ export function readEgressMode(
   readFile: (p: string) => string = (p) => fs.readFileSync(p, "utf8"),
 ): EgressMode {
   if (isEnvKillSwitchActive(EGRESS_STAGE_KILL_SWITCH)) return "off";
-  let layers: "none" | "named" | "broken";
-  try {
-    layers = egressLayers(workspaceRoot, readFile);
-  } catch {
-    return "protect";
-  }
-  if (layers === "none") return "off";
-  if (layers === "broken") return "protect";
   try {
-    return resolveEgressMode(load_agent_settings({ cwd: workspaceRoot }));
+    return egressFromLayers(workspaceRoot, readFile);
   } catch {
     return "protect";
   }
diff --git a/tests/scripts/hooks/egress_stage.test.ts b/tests/scripts/hooks/egress_stage.test.ts
index 422849e89a..311734ef3b 100644
--- a/tests/scripts/hooks/egress_stage.test.ts
+++ b/tests/scripts/hooks/egress_stage.test.ts
@@ -35,6 +35,7 @@ import {
   type EgressMode,
 } from "../../../src/scripts/hooks/egress_stage.js";
 import { planPayloadShapes, type JsonObject } from "../../../src/scripts/hooks/payload_stub.js";
+import { load_agent_settings } from "../../../src/scripts/_lib/agent_settings.js";
 import { feedback_dir } from "../../../src/scripts/hooks/state_io.js";
 
 const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), "..", "..", "..", "..");
@@ -116,6 +117,76 @@ describe("mode resolution", () => {
     expect(readEgressMode(tmp)).toBe("protect");
   });
 
+  it("detects and resolves from one read, so the disk cannot answer differently afterwards", () => {
+    const template = fs.readFileSync(path.join(REPO_ROOT, "src", "config", "agent-settings.template.yml"), "utf8");
+    expect(template).toMatch(/^egress:\n  placeholders:\n    mode: "off"$/m);
+    // The disk says protect; the injected reader is the only read there is.
+    fs.writeFileSync(path.join(tmp, ".agent-settings.yml"), "egress:\n  placeholders:\n    mode: protect\n");
+    const view = (text: string) => (p: string): string => {
+      if (p === path.join(tmp, ".agent-settings.yml")) return text;
+      throw Object.assign(new Error("absent"), { code: "ENOENT" });
+    };
+    expect(readEgressMode(tmp, view(template))).toBe("off");
+    expect(readEgressMode(tmp, view(template.replace('mode: "off"', "mode: observe")))).toBe("observe");
+    expect(readEgressMode(tmp, view(template + "\negress: [unclosed\n"))).toBe("protect");
+  });
+
+  it("reads every layer at most once, even the one the cascade lists twice", () => {
+    fs.mkdirSync(path.join(tmp, ".git"));
+    const sub = path.join(tmp, "agents", "settings");
+    fs.mkdirSync(sub, { recursive: true });
+    const reads = new Map<string, number>();
+    const count = (p: string): string => {
+      reads.set(p, (reads.get(p) ?? 0) + 1);
+      if (p === path.join(sub, ".agent-settings.yml")) return "egress:\n  placeholders:\n    mode: protect\n";
+      throw Object.assign(new Error("absent"), { code: "ENOENT" });
+    };
+    expect(readEgressMode(sub, count)).toBe("protect");
+    expect(reads.get(path.join(sub, ".agent-settings.yml"))).toBe(1);
+    expect(Math.max(...reads.values())).toBe(1);
+  });
+
+  it("merges every layer the way the settings cascade does", () => {
+    // The project root anchors the chain; a nested cwd adds a deeper layer.
+    // Under agents/settings the canonical layer is ALSO in the directory chain,
+    // so the cascade merges it twice; the stage must read it once and agree.
+    fs.mkdirSync(path.join(tmp, ".git"));
+    const home = fs.mkdtempSync(path.join(os.tmpdir(), "egress-home-"));
+    const savedHome = process.env["EVENT4U_CONFIG_HOME"];
+    process.env["EVENT4U_CONFIG_HOME"] = home;
+    fs.mkdirSync(path.join(home, "settings"), { recursive: true });
+    // A user-global egress is filtered out by the cascade; the stage never reads it.
+    fs.writeFileSync(path.join(home, "settings", ".agent-settings.yml"), "egress:\n  placeholders:\n    mode: strict\n");
+    for (const sub of [path.join(tmp, "pkg"), path.join(tmp, "agents", "settings")]) {
+    fs.mkdirSync(sub, { recursive: true });
+    const shapes = [
+      undefined,
+      "egress:\n  placeholders:\n    mode: protect\n",
+      'egress:\n  placeholders:\n    mode: "off"\n',
+      "egress:\n  placeholders: {}\n",
+      "egress: on\n",
+      "egress:\n  placeholders:\n    mode: observe\n    other: 1\n",
+      "# names egress only in a comment\nscreenshots: {}\n",
+      "egress:\n  placeholders:\n    mode: Protect\n",
+    ];
+    for (const outer of shapes) {
+      for (const inner of shapes) {
+        for (const [dir, text] of [[tmp, outer], [sub, inner]] as const) {
+          const f = path.join(dir, ".agent-settings.yml");
+          if (text === undefined) fs.rmSync(f, { force: true });
+          else fs.writeFileSync(f, text);
+        }
+        const viaCascade = resolveEgressMode(load_agent_settings({ cwd: sub }));
+        expect(readEgressMode(sub), JSON.stringify({ sub, outer, inner })).toBe(viaCascade);
+      }
+    }
+    for (const dir of [tmp, sub]) fs.rmSync(path.join(dir, ".agent-settings.yml"), { force: true });
+    }
+    if (savedHome === undefined) delete process.env["EVENT4U_CONFIG_HOME"];
+    else process.env["EVENT4U_CONFIG_HOME"] = savedHome;
+    fs.rmSync(home, { recursive: true, force: true });
+  });
+
   it("a thrown kill switch is off whatever the settings say", () => {
     process.env[EGRESS_STAGE_KILL_SWITCH] = "1";
     expect(resolveEgressMode({ egress: { placeholders: { mode: "strict" } } })).toBe("off");
```
