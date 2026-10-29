Review the test changes in the diff below. The production change removes a scheduled legacy behaviour: an explicitly written `projection.rule_packs` setting used to decide the rule-layer pack axis for "one release window"; it is now ignored and the derived active-pack set always decides. The doctor check `rule-packs-legacy` (module `rulePacksLegacy.ts`) and the function `projectionModeOf` in `mcp_bridge.ts` are deleted with it.

The test diff net-removes assertions in two files. For each removed or changed assertion, decide whether the removal is legitimate (it asserted behaviour of code that no longer exists, or behaviour that is intentionally reversed) or a weakening (it asserted something that still exists and is no longer covered). Name any behaviour of the remaining code that the new tests fail to cover. Give a verdict per file: LEGITIMATE or WEAKENING, with reasons.

--- production diff ---
diff --git a/src/install/rulePacksLegacy.ts b/src/install/rulePacksLegacy.ts
deleted file mode 100644
index 02de0d7367..0000000000
--- a/src/install/rulePacksLegacy.ts
+++ /dev/null
@@ -1,51 +0,0 @@
-/**
- * The doctor half of step 4.9 of road-to-a-setup-that-decides-itself, kept out
- * of `rule_scope.ts` because that module is in the hook dispatch bundle and this
- * one runs only from `doctor`.
- */
-import * as fs from 'node:fs';
-
-import * as YAML from 'yaml';
-
-import { RULE_PACKS_AUTO, resolve_rule_pack_scope } from '../scripts/_lib/scoped_projection.js';
-import { RULE_PACKS_LEGACY_WINDOW, _list, _runtimeActivePacks, legacyRulePacks } from './rule_scope.js';
-
-/**
- * The doctor half of step 4.9: whether any of `settingsFiles` (project and
- * user-global) still carries a legacy `projection.rule_packs`, and how the scope
- * it selects differs from the derived active-pack set.
- */
-export function rulePacksLegacyCheck(
-    settingsFiles: readonly string[],
-    packageRoot: string,
-): { id: string; status: 'ok' | 'warn'; message: string; remedy: string } {
-    const id = 'rule-packs-legacy';
-    for (const file of settingsFiles) {
-        let doc: unknown;
-        try {
-            doc = YAML.parse(fs.readFileSync(file, 'utf8'));
-        } catch {
-            continue;
-        }
-        if (typeof doc !== 'object' || doc === null || Array.isArray(doc)) continue;
-        const proj = (doc as Record<string, unknown>)['projection'];
-        if (typeof proj !== 'object' || proj === null || Array.isArray(proj)) continue;
-        const legacy = legacyRulePacks(proj as Record<string, unknown>);
-        if (legacy === undefined) continue;
-        const active = _list(_runtimeActivePacks(doc as Record<string, unknown>)) ?? [];
-        const derived = resolve_rule_pack_scope(RULE_PACKS_AUTO, packageRoot, active) ?? [];
-        const chosen = resolve_rule_pack_scope(legacy, packageRoot, active);
-        const remedy = `delete projection.rule_packs from ${file} to take the derived set; it is read for ${RULE_PACKS_LEGACY_WINDOW}, then ignored`;
-        if (chosen === null) {
-            return { id, status: 'warn', message: `${file}: projection.rule_packs keeps the rule pack axis inactive, where the derived set would scope it to ${derived.join(', ')}`, remedy };
-        }
-        const plus = chosen.filter((x) => !derived.includes(x)).map((x) => `+${x}`);
-        const minus = derived.filter((x) => !chosen.includes(x)).map((x) => `-${x}`);
-        if (plus.length === 0 && minus.length === 0) {
-            return { id, status: 'ok', message: `${file}: projection.rule_packs equals the derived active-pack set; it can be deleted`, remedy: '' };
-        }
-        return { id, status: 'warn', message: `${file}: projection.rule_packs differs from the derived active-pack set: ${[...plus, ...minus].join(' ')}`, remedy };
-    }
-    return { id, status: 'ok', message: 'no projection.rule_packs written; the rule pack axis is derived from the active-pack set', remedy: '' };
-}
-
diff --git a/src/install/rule_scope.ts b/src/install/rule_scope.ts
index a794661d3d..abd85451d2 100644
--- a/src/install/rule_scope.ts
+++ b/src/install/rule_scope.ts
@@ -80,21 +80,14 @@ export function ruleScopeFromSettings(
     const derivedWorkspaces = packageRoot === undefined ? null : consumerRuleWorkspaces(packageRoot);
     // The PACK axis is derived too since step 4.9 (owner directive 2026-10-24):
     // the active-pack set, the same set the skill/command prune uses, whether or
-    // not a settings file says anything. For one release window an explicitly
-    // written legacy `projection.rule_packs` still wins — see `legacyRulePacks`.
+    // not a settings file says anything. A leftover `projection.rule_packs` is
+    // ignored since 19.0.0; its tombstone in `REMOVED_KEYS` names it on stderr.
     const proj = settings['projection'];
     const p = typeof proj === 'object' && proj !== null && !Array.isArray(proj) ? (proj as Record<string, unknown>) : {};
-    const legacy = legacyRulePacks(p);
     const packs =
         packageRoot === undefined
-            ? legacy === undefined
-                ? null
-                : _list(legacy)
-            : resolve_rule_pack_scope(
-                  legacy === undefined ? RULE_PACKS_AUTO : legacy,
-                  packageRoot,
-                  _list(_runtimeActivePacks(settings)) ?? [],
-              );
+            ? null
+            : resolve_rule_pack_scope(RULE_PACKS_AUTO, packageRoot, _list(_runtimeActivePacks(settings)) ?? []);
     return {
         // DERIVED since ADR-293 step 4.6, not read. `projection.rule_workspaces`
         // carried this list as a settings default — the nine consumer workspace
@@ -113,24 +106,6 @@ export function ruleScopeFromSettings(
     };
 }
 
-/**
- * The release window in which an explicitly written `projection.rule_packs`
- * still decides (step 4.9). When it closes, delete {@link legacyRulePacks} and
- * its caller's branch; the tombstone in `REMOVED_KEYS` then names the key as
- * ignored.
- */
-export const RULE_PACKS_LEGACY_WINDOW = 'one release window after the 2026-10-24 retirement of projection.rule_packs';
-
-/**
- * The legacy `projection.rule_packs` value while the window is open, or
- * `undefined` when none was written. An explicitly written value wins over the
- * derivation — a consumer who chose a scope does not lose it silently on the
- * upgrade — and `doctor` names how it differs (`rulePacksLegacyCheck`).
- */
-export function legacyRulePacks(projection: Record<string, unknown>): unknown {
-    return Object.prototype.hasOwnProperty.call(projection, 'rule_packs') ? projection['rule_packs'] : undefined;
-}
-
 /** `runtime.active_packs` overlay from an already-parsed settings object. */
 export function _runtimeActivePacks(settings: Record<string, unknown>): unknown {
     const rt = settings['runtime'];
diff --git a/src/scripts/_cli/cmd_doctor.ts b/src/scripts/_cli/cmd_doctor.ts
index ea11753c9b..f25f2677d2 100644
--- a/src/scripts/_cli/cmd_doctor.ts
+++ b/src/scripts/_cli/cmd_doctor.ts
@@ -139,7 +139,6 @@ import { review_gate_doctor_signal } from '../ai_team/review_gate.js';
 import { resolvePackageRoot } from '../_lib/package_root.js';
 import { rglob as _rglob_raw, scanForeign } from '../_lib/foreign_scan.js';
 import { runCensus, summaryLine } from './cmd_doctor_neighbours.js';
-import { rulePacksLegacyCheck } from '../../install/rulePacksLegacy.js';
 import {
     LEGACY_ALL,
     excludedRuleBasenames,
@@ -725,7 +724,6 @@ const CHECK_IDS = [
     'stale-orphans',
     'overrides',
     'rule-scope-drift',
-    'rule-packs-legacy',
     'manifest-integrity',
     'lockfile-freshness',
     'bridge-drift',
@@ -759,7 +757,6 @@ const GLOBAL_CHECK_IDS: ReadonlySet<string> = new Set([
     'stale-orphans',
     'overrides',
     'rule-scope-drift',
-    'rule-packs-legacy',
     'mcp-mode',
     'mcp-beta-readiness',
     'offline-readiness',
@@ -2810,7 +2807,6 @@ function _run_checks(
         'stale-orphans': _check_stale_orphans,
         overrides: () => _check_overrides(project_root),
         'rule-scope-drift': () => _check_rule_scope_drift(project_root),
-        'rule-packs-legacy': () => rulePacksLegacyCheck([project_settings_path(project_root), path.join(user_global_paths.event4u_root(), 'settings', '.agent-settings.yml'), path.join(user_global_paths.event4u_root(), '.agent-settings.yml')], _package_root()) as unknown as Dict,
         'manifest-integrity': () => _check_manifest_integrity(manifest),
         'lockfile-freshness': () => _check_lockfile_freshness(manifest),
         'bridge-drift': () =>
@@ -2902,7 +2898,6 @@ function _run_checks_no_manifest(
         // worth the comment because the duplication is easy to miss.
         overrides: () => _check_overrides(project_root),
         'rule-scope-drift': () => _check_rule_scope_drift(project_root),
-        'rule-packs-legacy': () => rulePacksLegacyCheck([project_settings_path(project_root), path.join(user_global_paths.event4u_root(), 'settings', '.agent-settings.yml'), path.join(user_global_paths.event4u_root(), '.agent-settings.yml')], _package_root()) as unknown as Dict,
         'manifest-integrity': () => _skipped_manifest_check('manifest-integrity'),
         'lockfile-freshness': () => _skipped_manifest_check('lockfile-freshness'),
         'bridge-drift': () => _check_bridge_drift_no_manifest(bridge_present),
diff --git a/src/scripts/_lib/mcp_bridge.ts b/src/scripts/_lib/mcp_bridge.ts
index 96d5706ddb..d74a6cdec6 100644
--- a/src/scripts/_lib/mcp_bridge.ts
+++ b/src/scripts/_lib/mcp_bridge.ts
@@ -291,31 +291,6 @@ export function migrateMcpBridge(
     return 'rewritten';
 }
 
-/**
- * The two projection modes.
- *
- * `legacy-all` ships everything and stays the default. `scoped` narrows to the
- * active packs.
- *
- * `tiered` was a third, and it was RETIRED on 2026-10-20 (ADR-293, step 4.5)
- * with the install branch that acted on it. It narrowed the catalogue to the
- * skills predicted to reach the model WITH their description, and its own
- * roadmap closed it at `measured-null`: the split usually came from an
- * ALPHABETICAL fallback order (`agents/runtime/metrics/skill-usage.jsonl` is
- * absent on most machines), and the one real host observation this repo has
- * disagreed with that fallback on four of eight sampled entries. A value that
- * hides skills on a prediction the tree can show to be wrong is strictly worse
- * than the bare-but-listed defect it was meant to fix. The measured null stays
- * in `docs/CLAIMS.md`; a leftover `tiered` now resolves to `legacy-all`, which
- * is the full surface and the safe direction.
- */
-export type ProjectionMode = 'scoped' | 'legacy-all';
-
-/** Resolve a raw `projection.mode` value. Anything unrecognised is `legacy-all`. */
-export function projectionModeOf(raw: unknown): ProjectionMode {
-    return raw === 'scoped' ? 'scoped' : 'legacy-all';
-}
-
 /**
  * Tier B skill names, or `null` when no split exists on this machine.
  *
diff --git a/src/scripts/_lib/settings_removed_keys.ts b/src/scripts/_lib/settings_removed_keys.ts
index 099ddb8336..375259e83d 100644
--- a/src/scripts/_lib/settings_removed_keys.ts
+++ b/src/scripts/_lib/settings_removed_keys.ts
@@ -162,7 +162,7 @@ export const REMOVED_KEYS: ReadonlyMap<string, string> = new Map([
     // 2026-10-24 — road-to-a-setup-that-decides-itself step 4.9 (owner directive, D14)
     // 2026-10-24 — step 4.7 (owner answer OQ-1)
     ['projection.mode', 'per host: a host with a listing lever gets every skill, every other host the active profile packs'],
-    ['projection.rule_packs', 'the active-pack set; install rule scoping honours an explicit value one release window'],
+    ['projection.rule_packs', 'the active-pack set; runtime.active_packs widens it'],
 ]);
 
 /**
@@ -204,7 +204,6 @@ export function warnRemovedKeys(merged: SettingsDict): void {
             continue;
         }
         _warnedRemovedKeys.add(key);
-        // A reason that says the key is still honoured must not end in "ignored".
-        process.stderr.write(`${key} was removed (${reason}); ${reason.includes('honours') ? 'still honoured' : 'ignored'}.\n`);
+        process.stderr.write(`${key} was removed (${reason}); ignored.\n`);
     }
 }
--- test diff ---
diff --git a/tests/install/rule_packs_auto.test.ts b/tests/install/rule_packs_auto.test.ts
index de1f090a55..b7dd04f19f 100644
--- a/tests/install/rule_packs_auto.test.ts
+++ b/tests/install/rule_packs_auto.test.ts
@@ -84,8 +84,10 @@ describe('ruleScopeFromSettings with rule_packs: auto', () => {
         expect(ruleScopeFromSettings(SETTINGS).packs).toBeNull();
     });
 
-    it('an explicit empty list keeps the axis inactive during the legacy window (step 4.9)', () => {
-        expect(ruleScopeFromSettings({ projection: { rule_packs: [] } }, REPO).packs).toBeNull();
+    it('a leftover explicit empty list no longer switches the axis off (window closed at 19.0.0)', () => {
+        expect(ruleScopeFromSettings({ projection: { rule_packs: [] } }, REPO).packs).toEqual(
+            resolve_rule_pack_scope(RULE_PACKS_AUTO, REPO),
+        );
     });
 });
 
diff --git a/tests/install/rule_packs_retired.test.ts b/tests/install/rule_packs_retired.test.ts
index b4d5824d62..062af95c8e 100644
--- a/tests/install/rule_packs_retired.test.ts
+++ b/tests/install/rule_packs_retired.test.ts
@@ -3,30 +3,22 @@
  * retired (owner directive 2026-10-24, D14).
  *
  * The rule layer's pack axis is DERIVED from the active-pack set — what `auto`
- * did — whether or not a settings file says anything. For one release window
- * an explicitly written legacy value still wins, so nobody who chose a scope
- * loses it silently on upgrade; `doctor` names how that value differs from the
- * derived set. Runs against the real `packs.yml` and rule tree.
+ * did — whether or not a settings file says anything. The one-release window
+ * in which an explicitly written legacy value still won closed with 19.0.0: a
+ * leftover value is ignored. Runs against the real `packs.yml` and rule tree.
  */
 import * as fs from 'node:fs';
-import * as os from 'node:os';
 import * as path from 'node:path';
 
-import { afterEach, describe, expect, it } from 'vitest';
+import { describe, expect, it } from 'vitest';
 
 import { RULE_PACKS_AUTO, resolve_rule_pack_scope } from '../../src/scripts/_lib/scoped_projection.js';
 import { REMOVED_KEYS } from '../../src/scripts/_lib/settings_removed_keys.js';
 import { ruleScopeFromSettings } from '../../src/install/rule_scope.js';
-import { rulePacksLegacyCheck } from '../../src/install/rulePacksLegacy.js';
 
 const REPO = path.resolve(__dirname, '..', '..');
 const DERIVED = resolve_rule_pack_scope(RULE_PACKS_AUTO, REPO) as string[];
 
-const temps: string[] = [];
-afterEach(() => {
-    for (const d of temps.splice(0)) fs.rmSync(d, { recursive: true, force: true });
-});
-
 describe('the pack axis is derived, not configured', () => {
     it('a settings file with no projection block gets the derived set', () => {
         expect(DERIVED.length).toBeGreaterThan(0);
@@ -45,17 +37,17 @@ describe('the pack axis is derived, not configured', () => {
     });
 });
 
-describe('one release window: an explicit legacy value wins', () => {
-    it('an explicit list is honoured verbatim', () => {
-        expect(ruleScopeFromSettings({ projection: { rule_packs: ['brand'] } }, REPO).packs).toEqual(['brand']);
+describe('a leftover legacy value no longer decides (window closed at 19.0.0)', () => {
+    it('an explicit list is ignored — the derived set decides', () => {
+        expect(ruleScopeFromSettings({ projection: { rule_packs: ['brand'] } }, REPO).packs).toEqual(DERIVED);
     });
 
-    it('an explicit empty list keeps the axis inactive, as it meant before', () => {
-        expect(ruleScopeFromSettings({ projection: { rule_packs: [] } }, REPO).packs).toBeNull();
+    it('an explicit empty list no longer switches the axis off', () => {
+        expect(ruleScopeFromSettings({ projection: { rule_packs: [] } }, REPO).packs).toEqual(DERIVED);
     });
 
-    it('`auto` is the derived set', () => {
-        expect(ruleScopeFromSettings({ projection: { rule_packs: 'auto' } }, REPO).packs).toEqual(DERIVED);
+    it('without a package root a leftover value cannot narrow the scope either', () => {
+        expect(ruleScopeFromSettings({ projection: { rule_packs: ['brand'] } }).packs).toBeNull();
     });
 });
 
@@ -65,44 +57,10 @@ describe('the key is gone from every public surface, with a tombstone', () => {
         expect(fs.readFileSync(path.join(REPO, 'src/server/schemas/settings.ts'), 'utf8')).not.toContain('rule_packs');
     });
 
-    it('REMOVED_KEYS names what decides instead and that the window still reads it', () => {
+    it('REMOVED_KEYS names what decides instead and no longer promises a window', () => {
         const entry = [...REMOVED_KEYS].find(([key]) => key === 'projection.rule_packs');
         expect(entry).toBeDefined();
         expect(entry?.[1]).toContain('active-pack set');
-        expect(entry?.[1]).toContain('release window');
-    });
-});
-
-describe('doctor names a legacy value and its difference from the derived set', () => {
-    function settingsFile(doc: string): string {
-        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rule-packs-retired-'));
-        temps.push(dir);
-        const file = path.join(dir, '.agent-settings.yml');
-        fs.writeFileSync(file, doc);
-        return file;
-    }
-
-    it('no legacy value: ok, and says the axis is derived', () => {
-        const res = rulePacksLegacyCheck([settingsFile('profile:\n  id: developer\n')], REPO);
-        expect(res.status).toBe('ok');
-        expect(res.message).toContain('derived');
-    });
-
-    it('an explicit list that differs: warn, naming what it adds and drops against the derived set', () => {
-        const res = rulePacksLegacyCheck([settingsFile('projection:\n  rule_packs: [brand, finance-basic]\n')], REPO);
-        expect(res.status).toBe('warn');
-        expect(res.message).toContain('+finance-basic');
-        expect(res.message).toContain('-engineering-base');
-        expect(res.remedy).toContain('rule_packs');
-    });
-
-    it('an explicit empty list: warn — the axis is off where the derivation would scope it', () => {
-        const res = rulePacksLegacyCheck([settingsFile('projection:\n  rule_packs: []\n')], REPO);
-        expect(res.status).toBe('warn');
-        expect(res.message).toContain('inactive');
-    });
-
-    it('`auto`: ok — it equals the derived set', () => {
-        expect(rulePacksLegacyCheck([settingsFile('projection:\n  rule_packs: auto\n')], REPO).status).toBe('ok');
+        expect(entry?.[1]).not.toContain('release window');
     });
 });
diff --git a/tests/install/rule_scoping_global_deploy.test.ts b/tests/install/rule_scoping_global_deploy.test.ts
index d6e5e92090..b43b11a928 100644
--- a/tests/install/rule_scoping_global_deploy.test.ts
+++ b/tests/install/rule_scoping_global_deploy.test.ts
@@ -40,6 +40,7 @@ const RULES_DIR = path.join(REPO, RULE_SOURCE_REL);
 
 /** A scoped settings doc — the shape a wizard-written global file carries. */
 const SCOPED_SETTINGS = { projection: { rule_workspaces: ['engineering'] } };
+const WIDER_SETTINGS = { ...SCOPED_SETTINGS, runtime: { active_packs: ['ai-image', 'ai-video'] } };
 
 const POLICY: ConflictPolicy = {
     force: false,
@@ -206,18 +207,19 @@ describe('CLI global deploy — rule set equals the wizard plan', () => {
 describe('CLI global deploy — upgrade reaps newly-excluded rules', () => {
     it('deletes rules a narrower re-install newly excludes', () => {
         // The upgrade path. ADR-293 step 4.6 took the WORKSPACE axis out of
-        // settings, so the two states are produced on the PACK axis instead —
-        // the axis that is still a setting, and the same reap code path. The
+        // settings and 19.0.0 closed the `projection.rule_packs` window, so the
+        // two states are produced on the PACK axis through `runtime.active_packs`
+        // — the one input that still moves it, and the same reap code path. The
         // point is unchanged: the newly-excluded rules are GONE from disk, not
         // merely un-refreshed. Filtering the copy without filtering the
         // inventory would leave every one behind, which is worse than shipping
         // them — the user would carry them forever with no way to notice.
-        writeGlobalSettings(SCOPED_SETTINGS);
+        writeGlobalSettings(WIDER_SETTINGS);
         runDeploy();
         const wider = deployedRuleBasenames();
         expect(wider.length).toBeGreaterThan(0);
 
-        writeGlobalSettings({ projection: { rule_packs: ['engineering-base'] } });
+        writeGlobalSettings(SCOPED_SETTINGS);
         runDeploy();
         const narrower = deployedRuleBasenames();
 
@@ -229,9 +231,7 @@ describe('CLI global deploy — upgrade reaps newly-excluded rules', () => {
                 `${name} survived the narrower re-install`,
             ).toBe(false);
         }
-        expect(narrower).toEqual(
-            plannedRuleBasenames(ruleScopeFromSettings({ projection: { rule_packs: ['engineering-base'] } }, REPO)),
-        );
+        expect(narrower).toEqual(plannedRuleBasenames(ruleScopeFromSettings(SCOPED_SETTINGS, REPO)));
     });
 
     it('is idempotent — a second scoped install changes nothing', () => {
diff --git a/tests/scripts/projection_key_downgrade.test.ts b/tests/scripts/projection_key_downgrade.test.ts
index 0df5cbf064..6f38d85178 100644
--- a/tests/scripts/projection_key_downgrade.test.ts
+++ b/tests/scripts/projection_key_downgrade.test.ts
@@ -12,7 +12,6 @@ import {
     DEFAULT_LEAN_PROJECTION_MODE,
     normalizeLeanProjectionMode,
 } from '../../src/scripts/_lib/lean_projection_mode.js';
-import { projectionModeOf } from '../../src/scripts/_lib/mcp_bridge.js';
 
 const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
 const TEMPLATE = readFileSync(join(ROOT, 'src', 'config', 'agent-settings.template.yml'), 'utf8');
@@ -25,12 +24,12 @@ const parse = (body: string): Record<string, unknown> => (yamlLoad(body) ?? {})
  * The scenario is a machine that installed the REMOVAL release and is then put
  * back on the previous one, whose readers still look for the keys. There is no
  * second checkout to run here, and there does not need to be: the previous
- * release's readers are the two normalisers below, and ADR-293 left both
+ * release's lean-projection reader is the normaliser below, and ADR-293 left it
  * untouched precisely so this direction keeps working. So the fixture is the
- * settings file the removal release actually writes, fed to the readers the
- * older release used.
+ * settings file the removal release actually writes, fed to the reader the
+ * older release used. The `projection.mode` reader was removed with 19.0.0.
  *
- * The safe answer is the FULL form on both axes. A downgrade that landed on a
+ * The safe answer is the FULL form. A downgrade that landed on a
  * thinning value would thin a machine whose rule layer the newer release had
  * left full — the one direction that loses bodies without anyone asking.
  */
@@ -51,16 +50,6 @@ describe('a machine downgraded past the key removal lands on the full form', ()
         expect(DEFAULT_LEAN_PROJECTION_MODE).toBe('eager-all');
     });
 
-    it('the older release resolves the absent projection mode to legacy-all', () => {
-        const projection = removalRelease['projection'] as Record<string, unknown> | undefined;
-        // `projection.mode` is the ONE key Phase 4 has not removed yet (4.7),
-        // so this reads what the removal release still writes. Either way the
-        // older reader is safe: a written `scoped` is a mode it understands,
-        // and an absent one is `legacy-all`.
-        expect(['scoped', 'legacy-all']).toContain(projectionModeOf(projection?.['mode']));
-        expect(projectionModeOf(undefined)).toBe('legacy-all');
-    });
-
     it('every value a PRIOR release could have written still resolves, and only the full ones keep the layer full', () => {
         // The mixed-version matrix, both directions. A downgraded machine may
         // still carry a hand-written value from before the removal; the older
@@ -75,17 +64,5 @@ describe('a machine downgraded past the key removal lands on the full form', ()
         ] as const) {
             expect(normalizeLeanProjectionMode(written)).toBe(expected);
         }
-        for (const [written, expected] of [
-            [undefined, 'legacy-all'],
-            ['legacy-all', 'legacy-all'],
-            ['scoped', 'scoped'],
-            // The retired value (4.5): an older reader that still understands
-            // `tiered` is not harmed, and THIS reader maps it onto the full
-            // surface rather than pruning on a split it no longer computes.
-            ['tiered', 'legacy-all'],
-            ['nonsense', 'legacy-all'],
-        ] as const) {
-            expect(projectionModeOf(written)).toBe(expected);
-        }
     });
 });
diff --git a/tests/scripts/projection_key_migration.test.ts b/tests/scripts/projection_key_migration.test.ts
index 7d38e68c1d..b369f35226 100644
--- a/tests/scripts/projection_key_migration.test.ts
+++ b/tests/scripts/projection_key_migration.test.ts
@@ -104,7 +104,7 @@ describe('the removed keys carry tombstones (step 4.2)', () => {
         expect(hits).toHaveLength(1); // once per process, not once per call
     });
 
-    it('a removed key still honoured during its window is not reported as ignored', () => {
+    it('projection.rule_packs is reported as ignored now its window has closed', () => {
         const written: string[] = [];
         const real = process.stderr.write.bind(process.stderr);
         process.stderr.write = ((chunk: string) => {
@@ -118,8 +118,8 @@ describe('the removed keys carry tombstones (step 4.2)', () => {
         }
         const hit = written.find((l) => l.startsWith('projection.rule_packs was removed'));
         expect(hit).toBeDefined();
-        expect(hit).not.toContain('ignored');
-        expect(hit).toContain('still honoured');
+        expect(hit).toContain('ignored');
+        expect(hit).not.toContain('still honoured');
     });
 
     it('the keys the migration reads are exactly the keys that have tombstones', () => {
