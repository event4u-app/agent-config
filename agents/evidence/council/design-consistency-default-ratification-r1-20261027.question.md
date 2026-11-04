<!-- evidence-type: analysis -->

# Ratification review — the design-consistency check on by default, and the dispatch bundle raise it needs — round 1

You are an independent reviewer for a change in the `event4u/agent-config` repository, branch `fix/design-consistency-false-alarms`.

subject: 4a3089535dd0dc691c9ef279c4b9f4abbd05d251ef7cd8382e86607d461758d1

The ratification gate covers one file on this branch, `src/config/hook-bundle-budget.json`: the byte ceiling of `dist/hooks/dispatch.js`, the bundle every hook event loads. The digest above is computed over that file at revision `adffe71707`. The rest of the change is included so the raise can be judged against what it pays for.

## What the change does

1. **A default flip.** A new settings key `hooks.design_consistency.enabled` defaults to `true` (template and schema). It is read independently of `hooks.design_pass.enabled`, which stays `false`. When on, a `post_tool_use` write to a UI surface runs a consistency check, and a raw `<select>`, `<input>` or `<textarea>` written where the project already has its own `Select`/`Input`/`Textarea` component is delivered as one advisory line (exit 2 to the dispatcher, `severity: advisory`, never a block). A second rule (box metrics) only appends a row to a local shadow log and is never shown. The repository owner asked for this flip in the session, conditional on the measurement below meeting the project's activation policy (`docs/contracts/concern-activation-policy.md`).
2. **The measurement.** A retroactive replay of six months of two private consumer repositories (1,565 UI writes, 358 commits). The first reading showed false-alarm rates of 16.2 % and 4.1 %; six rule defects were fixed, each with a test; the same window then read 8 fires, 5 on the targeted failure and 3 false (0.19 %), and zero box-metric comparisons. The evidence file states that the 0.19 % is in-sample and names the reverse trigger.
3. **Where the code lives.** The check (`ui:audit`, the role parser, the rules, the recorder) is a conditional chunk `design_consistency.chunk.cjs` (36,545 B, its own ceiling 40,000), required only for a UI write. The dispatch bundle gains the settings switch, a consistency-only path in `design_pass_hook.ts`, a call site in the full pass, and the loader. The chunk `require` logic of `svg_rules_loader.ts` became a shared `chunkExport`.
4. **The raise.** `max_bytes` 1,556,670 → 1,558,850. Measured 1,558,551 B against a base of 1,556,669 B (+1,882 B). The `raise_log` entry records the alternatives tried.

## What to answer

1. Is the raise justified by what it pays for, and is the `raise_log` entry accurate and complete against the diff? Name file and line for any defect.
2. Does the in-bundle code keep the failure contract of a conditional chunk: a missing, unreadable or throwing chunk must cost the consistency finding and never the hook event? Look at `consistencyFor`, the loader and `chunkExport`.
3. Is the default flip bounded as described: advisory only, independent of `design_pass`, off by an explicit `enabled: false`, and with no effect on non-UI writes or on the `stop` slot when `design_pass` is off?
4. Do you approve the gated content?

End with exactly one verdict line: `VERDICT: ratified`, `VERDICT: confirmed-non-expanding`, or `VERDICT: refused — <reason>`.

## Scope of the diff below

`git diff origin/main...HEAD` for the bundle budget, the hook, both loaders, the chunk entry, the chunk list, the settings template and the consistency rule module. Left out for size, and available on the branch: the schema and settings-class rows (same wording as the template), the regenerated `dist/install/install.mjs`, both copies of the role parser, `ui:audit`'s read fix, the tests, the bench script, the evidence file, CLAIMS and the roadmap.

## The diff

```diff
diff --git a/src/config/agent-settings.template.yml b/src/config/agent-settings.template.yml
index 30ba5cc011..31abbebfa2 100644
--- a/src/config/agent-settings.template.yml
+++ b/src/config/agent-settings.template.yml
@@ -1350,4 +1350,17 @@ hooks:
     enabled: false
 
+  # Control consistency on a UI write (road-to-a-control-that-matches-its-
+  # neighbours 3.8). Default-ON, and independent of design_pass above: it runs
+  # when that is off. A raw <select>, <input> or <textarea> written where the
+  # project already has its own Select / Input / Textarea is delivered as one
+  # advisory line naming the project's control; it never blocks. A file that
+  # cannot render the component (a server template, a handover prototype) is
+  # not measured. Turned on after a retroactive shadow window met all four
+  # conditions of docs/contracts/concern-activation-policy.md. The box-metrics
+  # half stays in shadow: every UI write adds a row to
+  # agents/runtime/state/design-consistency-shadow.jsonl and nothing is shown.
+  design_consistency:
+    enabled: true
+
   # PreToolUse UI-route nudge (road-to-frontend-skill-application Phase 4).
   # Default-OFF. When enabled, a Write/Edit to a UI surface with no design
diff --git a/src/config/hook-bundle-budget.json b/src/config/hook-bundle-budget.json
index f93d681efa..f042076e53 100644
--- a/src/config/hook-bundle-budget.json
+++ b/src/config/hook-bundle-budget.json
@@ -5,5 +5,5 @@
     "owner": "maintainer",
     "review_by": "2027-10-01",
-    "max_bytes": 1556670,
+    "max_bytes": 1558850,
     "max_bytes_derivation": "Measured 1,514,715 bytes on origin/main at 213d87055 (the gate's own reading, APFS-cloned node_modules so no worktree path artefacts). The ceiling is that reading plus ~2.3 % of headroom, rounded to 1,550,000, on the same doctrine as the 2026-10-01 registration: a bundle is rebuilt from source on every run, so an esbuild minor that renames symbols moves the figure by hundreds of bytes with no change to this tree, and a ceiling one byte above the reading would red on that. Composition is healthy at this reading and was checked rather than assumed: one YAML package (258,833 bytes) and 1,238,525 bytes of own source, so the growth is own code, not a re-entered dependency. The 1,564,211-byte pre-swap regression this roadmap closed still cannot reappear under it. RAISED to 1,550,500 on 2026-10-23 for the InstructionsLoaded binding (237 bytes against 51 of headroom); the reasoning and the measured alternative are the `raise_log` entry whose `to` is 1,550,500, so this paragraph describes the 1,550,000 registration and the raise is recorded there rather than restated.",
     "shrink_only": true,
@@ -101,4 +101,13 @@
             "why_it_could_not_be_avoided": "Room was made first and measured: compacting the LAZY_CONCERNS table and dropping `path.join` from its rows freed 202 B, which carried the shared row and the ask passthrough with 16 B to spare. The two dispatch-path consumers could not follow: reading the ledger and the pressure model there cost 4,984 B, so the model moved to the tap (a CLI process, outside this bundle) and the consumers read its verdict file instead. What remains is the verdict reader and two call sites, which no chunk can carry because both concerns are in-bundle.",
             "what_would_have_caught_it": "Nothing earlier: the base sat 150 bytes under the ceiling, so any in-bundle consumer of a new state file would have tripped it."
+        },
+        {
+            "date": "2026-10-27",
+            "from": 1556670,
+            "to": 1558850,
+            "by": "agent, fix/design-consistency-false-alarms (road-to-a-control-that-matches-its-neighbours 3.8)",
+            "what_was_added": "The consistency check turned on by default inside the in-bundle `design-pass` concern: the `hooks.design_consistency` switch read with a default of on, a narrow consistency-only path for installs where the rest of the pass stays off, the call that adds its findings when the whole pass is on, and the loader of its conditional chunk. The check itself (`ui:audit`, the role parser, the rules and the shadow recorder) ships in `design_consistency.chunk.cjs`, required on a UI write alone. Measured 1,558,551 B with the change on a base of 1,556,669 B: +1,882 B.",
+            "why_it_could_not_be_avoided": "Room was made first: the chunk-require logic of `svg_rules_loader` became one shared `chunkExport`, which both loaders call, taking the first measurement from +2,061 to +1,882 B. Moving `design-pass` itself into a lazy chunk was considered and refused on the same trade the 2026-10-23 entry refused for `session-eol`: the concern is bound on every `post_tool_use`, so its body plus the slop registry would be required on every tool call of every install, against a switch that today returns in the bundle. What remains is the switch, the two call sites and the loader, which no chunk can carry because the concern that calls them is in the bundle. The base sat 1 byte under the ceiling.",
+            "what_would_have_caught_it": "Nothing earlier: with 1 byte of headroom any change to an in-bundle concern trips the ceiling. Sized to this change plus about 300 bytes."
         }
     ],
@@ -116,4 +125,10 @@
             "derivation": "Measured 18,478 bytes on 2026-10-18 (the rule table, the token grammar and the commit scanner, with the per-rule linearity prose moved to a test-only module). The ceiling is that reading plus the queued engine work of road-to-one-detector-and-the-senders-we-own (validated identifier rules about 4.3 KB, known values, the invisible-character rescan and the variant suffix about 1-2 KB each), rounded up. An AI council of two providers chose on 2026-10-18 to move the engine out of the dispatch bundle into this conditional chunk rather than raise the dispatch ceiling, and asked that the chunk carry a measured budget of its own so the move does not just relocate uncontrolled growth. A raise follows the same rule as max_bytes: a raise_log entry naming the chunk (`chunk`: this entry) and what was added."
         },
+        {
+            "entry": "src/scripts/_lib/design_consistency_pass.ts",
+            "max_bytes": 40000,
+            "registered_at": "2026-10-27",
+            "derivation": "Measured 36,545 bytes on 2026-10-27: the consistency check `design-pass` runs on a UI write (the `ui:audit` computation, the control-role parser, the two consistency rules and the shadow recorder). The ceiling is that reading plus about 9 %, rounded, with no growth queued. Required on a UI write alone, so no other dispatch parses it; the bundle carries only its loader and two call sites, the 2026-10-27 raise of `max_bytes`. A missing or mis-digested chunk costs the consistency finding, never the event (`design_consistency_loader.ts`)."
+        },
         {
             "entry": "src/scripts/chat_history.ts",
diff --git a/src/scripts/_lib/design_consistency_pass.ts b/src/scripts/_lib/design_consistency_pass.ts
new file mode 100644
index 0000000000..ee8338abea
--- /dev/null
+++ b/src/scripts/_lib/design_consistency_pass.ts
@@ -0,0 +1,61 @@
+/**
+ * The consistency check as the `design-pass` hook runs it on a UI write —
+ * road-to-a-control-that-matches-its-neighbours 3.8.
+ *
+ * Shipped as a conditional chunk (`hook_chunks.mjs`) and loaded only for a UI
+ * write, because the dispatch bundle every hook event parses has no room for
+ * `ui:audit` and the role parser (D11).
+ *
+ * Two postures in one call, per `docs/contracts/concern-activation-policy.md`:
+ *
+ *   consistency-raw-control      DELIVERED. A retroactive shadow window of
+ *                                1,565 UI writes met all four flip conditions
+ *                                (docs/CLAIMS.md `design-consistency-default-on`).
+ *   consistency-sibling-metrics  SHADOW. The same window read no box metric on
+ *                                either side of a single comparison, so it has
+ *                                no distribution to derive a tolerance from.
+ *
+ * Every call appends one shadow row, so the window keeps recording live.
+ */
+import * as fs from 'node:fs';
+import * as path from 'node:path';
+
+import { ARTEFACT_REL, computeUiAudit, gitHead, type UiAuditArtefact } from '../../cli/commands/uiAudit.js';
+import { consistencyFindings, SHADOW_REL, shadowRecord } from '../lint_design_consistency.js';
+
+export interface ConsistencyNotice {
+    line: number;
+    message: string;
+}
+
+/**
+ * The role map, recomputed only when HEAD moved. A single edit does not move a
+ * project's canonical, and the content-digest staleness check `ui:audit` uses
+ * would recompute on every write.
+ */
+function roles(root: string): UiAuditArtefact['control_roles'] {
+    const out = path.join(root, ARTEFACT_REL);
+    const head = gitHead(root);
+    try {
+        const a = JSON.parse(fs.readFileSync(out, 'utf8')) as Partial<UiAuditArtefact>;
+        if (a.control_roles && head !== null && a.stamp?.head === head) return a.control_roles;
+    } catch {
+        // absent or unreadable: computed below
+    }
+    const fresh = computeUiAudit(root, root);
+    fs.mkdirSync(path.dirname(out), { recursive: true });
+    fs.writeFileSync(out, `${JSON.stringify(fresh, null, 2)}\n`);
+    return fresh.control_roles;
+}
+
+export function consistencyPass(root: string, file: string, content: string): ConsistencyNotice[] {
+    const rel = path.relative(root, path.resolve(root, file)).split(path.sep).join('/');
+    const map = roles(root);
+    const shadow = path.join(root, SHADOW_REL);
+    fs.mkdirSync(path.dirname(shadow), { recursive: true });
+    // A live row is stamped with the wall clock on purpose; `asOf` would warn on every write.
+    fs.appendFileSync(shadow, `${JSON.stringify(shadowRecord(content, rel, map, new Date()))}\n`);
+    return consistencyFindings(content, rel, map)
+        .filter((f) => f.rule === 'consistency-raw-control')
+        .map((f) => ({ line: f.line, message: f.message }));
+}
diff --git a/src/scripts/hook_chunks.mjs b/src/scripts/hook_chunks.mjs
index af7419dac3..0b97dc5e18 100644
--- a/src/scripts/hook_chunks.mjs
+++ b/src/scripts/hook_chunks.mjs
@@ -26,4 +26,9 @@ export const HOOK_CHUNKS = Object.freeze([
     Object.freeze({ entry: 'src/scripts/_lib/svg_rules.ts', outfile: 'dist/hooks/svg_rules.chunk.cjs' }),
     Object.freeze({ entry: 'src/scripts/_lib/egress_engine.ts', outfile: 'dist/hooks/egress_engine.chunk.cjs' }),
+    // Required by `design-pass` on a UI write alone (`design_consistency_loader.ts`).
+    Object.freeze({
+        entry: 'src/scripts/_lib/design_consistency_pass.ts',
+        outfile: 'dist/hooks/design_consistency.chunk.cjs',
+    }),
     // `yaml` stays external here, alone among the chunks. Inlined it is
     // 258 KB of the 472 KB chunk — a second copy of a parser the dispatch
diff --git a/src/scripts/hooks/design_consistency_loader.ts b/src/scripts/hooks/design_consistency_loader.ts
new file mode 100644
index 0000000000..c6bf811620
--- /dev/null
+++ b/src/scripts/hooks/design_consistency_loader.ts
@@ -0,0 +1,28 @@
+/**
+ * Loads the consistency check (`_lib/design_consistency_pass.ts`) for a UI
+ * write — the conditional-chunk pattern of `svg_rules_loader.ts`, whose header
+ * carries the reasons: synchronous `require` because a concern is synchronous,
+ * a computed specifier so esbuild does not inline the module, the bundle's
+ * integrity check on the chunk, and null instead of a throw so a missing chunk
+ * costs the finding and never the dispatch.
+ */
+import * as path from 'node:path';
+import { fileURLToPath } from 'node:url';
+
+import type { ConsistencyNotice } from '../_lib/design_consistency_pass.js';
+import { chunkExport, isBundled } from './svg_rules_loader.js';
+
+export type ConsistencyPass = (root: string, file: string, content: string) => ConsistencyNotice[];
+
+export const CONSISTENCY_CHUNK = 'design_consistency.chunk.cjs';
+
+export function consistencySpecifier(selfUrl: string, bundled: boolean): string {
+    const self = fileURLToPath(selfUrl);
+    const dir = path.dirname(self);
+    if (bundled) return path.join(dir, CONSISTENCY_CHUNK);
+    return path.join(dir, '..', '_lib', `design_consistency_pass${self.endsWith('.ts') ? '.ts' : '.js'}`);
+}
+
+export function loadConsistencyPass(selfUrl: string = import.meta.url, bundled: boolean = isBundled()): ConsistencyPass | null {
+    return chunkExport<ConsistencyPass>(consistencySpecifier(selfUrl, bundled), 'consistencyPass', selfUrl, bundled);
+}
diff --git a/src/scripts/hooks/design_pass_hook.ts b/src/scripts/hooks/design_pass_hook.ts
index ac732f7278..855ca8fc78 100644
--- a/src/scripts/hooks/design_pass_hook.ts
+++ b/src/scripts/hooks/design_pass_hook.ts
@@ -94,4 +94,5 @@ import { HANDOVER_SHAPES, isUiPath, isUiTreePath } from '../_lib/ui_surface.js';
 import { loadDesignContext, scanFile } from '../lint_design_slop.js';
 import { readHookStdin } from './hook_stdin.js';
+import { loadConsistencyPass } from './design_consistency_loader.js';
 import { CHUNK_BASENAME, loadSvgScan } from './svg_rules_loader.js';
 import { EXIT_ALLOW, EXIT_WARN } from './exit_codes.js';
@@ -131,10 +132,10 @@ export interface PassResult {
 
 /** Minimal settings reader — mirrors design_slop_hook rather than adding a parser. */
-export function enabled(root: string, key = 'design_pass'): boolean {
+export function enabled(root: string, key = 'design_pass', fallback = false): boolean {
     let text: string;
     try {
         text = fs.readFileSync(path.join(root, SETTINGS_FILE), 'utf-8');
     } catch {
-        return false;
+        return fallback;
     }
     let inHooks = false;
@@ -159,5 +160,24 @@ export function enabled(root: string, key = 'design_pass'): boolean {
         }
     }
-    return false;
+    return fallback;
+}
+
+/** Raw-control findings for one UI file, from the conditional chunk. */
+export function consistencyFor(root: string, rel: string, load = loadConsistencyPass): Finding[] {
+    const run = load();
+    if (!run) return [];
+    try {
+        const abs = path.resolve(root, rel);
+        return run(root, rel, fs.readFileSync(abs, 'utf-8')).map((n) => ({
+            file: rel,
+            severity: 'P1',
+            catalogId: 'consistency',
+            rule: 'consistency-raw-control',
+            line: n.line,
+            message: n.message,
+        }));
+    } catch {
+        return [];
+    }
 }
 
@@ -627,5 +647,8 @@ export function render(result: PassResult, conformance?: string): string {
 function main(): number {
     const root = process.env['CLAUDE_PROJECT_DIR'] ?? process.cwd();
-    if (!enabled(root)) return EXIT_ALLOW;
+    // The consistency check ships ON (3.8); the rest of the pass ships OFF.
+    const pass = enabled(root);
+    const consistency = enabled(root, 'design_consistency', true);
+    if (!pass && !consistency) return EXIT_ALLOW;
 
     const slotArg = process.argv.includes('--slot') ? process.argv[process.argv.indexOf('--slot') + 1] : undefined;
@@ -638,4 +661,12 @@ function main(): number {
         return EXIT_ALLOW; // fail_closed: false — an unparsable payload is not a block
     }
+    if (!pass) {
+        const t = slot === 'stop' ? null : targetPath(payload);
+        const only = t && isUiSurface(t) ? consistencyFor(root, t) : [];
+        if (!only.length) return EXIT_ALLOW;
+        const r: PassResult = { slot, findings: only, blocked: [], audit_missing: [], verification: 'verified' };
+        process.stdout.write(`${JSON.stringify({ reason: render(r) })}\n`);
+        return EXIT_WARN;
+    }
 
     const state = readState(root);
@@ -675,4 +706,6 @@ function main(): number {
                 else findings.push(...svgFindings(scan(content, rel) as SvgRuleFinding[], rel));
             }
+            // One shadow row per write: the stop pass re-reads the same files.
+            if (consistency && slot === 'post_tool_use' && isUiSurface(rel)) findings.push(...consistencyFor(root, rel));
             for (const f of scanFile(content, rel, ctx)) {
                 findings.push({
diff --git a/src/scripts/hooks/svg_rules_loader.ts b/src/scripts/hooks/svg_rules_loader.ts
index 836d728faf..1811d0b949 100644
--- a/src/scripts/hooks/svg_rules_loader.ts
+++ b/src/scripts/hooks/svg_rules_loader.ts
@@ -114,13 +114,22 @@ export function loadSvgScanUncached(
 ): SvgScan | null {
     try {
-        const specifier = rulesSpecifier(selfUrl, bundled);
+        return chunkExport<SvgScan>(rulesSpecifier(selfUrl, bundled), 'scanSvg', selfUrl, bundled);
+    } catch {
+        return null;
+    }
+}
+
+/**
+ * One function export of a chunk, or null. Shared by every conditional-chunk
+ * loader so the dispatch bundle carries this once.
+ */
+export function chunkExport<T>(specifier: string, name: string, selfUrl: string, bundled: boolean): T | null {
+    try {
         // The chunk runs inside the dispatch process, so it gets the bundle's
         // own integrity check: a mismatch with its sidecar is not executed.
         // No sidecar is `unverifiable` and allowed, as for `dispatch.js`.
         if (bundled && verifyBundle(specifier).state === 'mismatch') return null;
-        const req = createRequire(selfUrl);
-        const mod = req(specifier) as Record<string, unknown>;
-        const scan = mod['scanSvg'];
-        return typeof scan === 'function' ? (scan as SvgScan) : null;
+        const fn = (createRequire(selfUrl)(specifier) as Record<string, unknown>)[name];
+        return typeof fn === 'function' ? (fn as T) : null;
     } catch {
         return null;
diff --git a/src/scripts/lint_design_consistency.ts b/src/scripts/lint_design_consistency.ts
index 79fee4d3fa..7a538f69bb 100644
--- a/src/scripts/lint_design_consistency.ts
+++ b/src/scripts/lint_design_consistency.ts
@@ -32,4 +32,5 @@ import path from 'node:path';
 import { asOf } from './_lib/as_of.js';
 import { assertScanned, DeadScopeError } from './_lib/scan_scope.js';
+import { isHandoverShape } from './_lib/ui_surface.js';
 
 import {
@@ -105,4 +106,20 @@ export function loadControlRoles(artefactPath: string): ControlRoleMap | null {
 }
 
+/**
+ * Whether a file of this kind can render the canonical at all. A server
+ * template cannot use a JSX `Select`, nor a `.tsx` file a Blade `x-select`;
+ * measuring one against the other is a false alarm on every edit to it.
+ */
+export function canRender(relPath: string, canonical: string): boolean {
+    if (canonical.startsWith('native:')) return true;
+    if (canonical.startsWith('x-') || canonical.includes(':')) return /\.blade\.php$/i.test(relPath);
+    return /\.(jsx|tsx|vue|svelte|astro|mdx)$/i.test(relPath);
+}
+
+/** A design handover or an agent's reference copy is not the product's UI. */
+function isProductUi(relPath: string): boolean {
+    return !isHandoverShape(relPath) && !/(^|\/)agents\//.test(relPath.replace(/\\/g, '/'));
+}
+
 /**
  * Pure core. `tolerancePx` applies to sibling metrics only; the raw-control
@@ -115,4 +132,5 @@ export function consistencyFindings(
     tolerancePx = 0,
 ): ConsistencyFinding[] {
+    if (!isProductUi(relPath)) return [];
     const definesRole = new Set(
         definedComponents(relPath, content)
@@ -127,5 +145,5 @@ export function consistencyFindings(
         if (definesRole.has(o.role)) continue;
         const entry = roles[o.role];
-        if (!entry || entry.canonical === null) continue;
+        if (!entry || entry.canonical === null || !canRender(relPath, entry.canonical)) continue;
 
         if (o.impl.startsWith('native:') && !entry.canonical.startsWith('native:')) {
```
