<!-- evidence-type: analysis -->

# Ratification review, round 1 — binding the `layer-promote` session concern

You are an independent reviewer for a change in the `event4u/agent-config` repository. The change implements step 3.3 of `road-to-a-setup-that-decides-itself` ("promote after proof, never at install") and binds it as a hook concern. It touches three files on the repository's hook-plumbing list (`src/scripts/hook_manifest.yaml`, its compiled `hook_manifest.json`, `src/config/hook-bundle-budget.json`), so ADR-268 § 4 requires a two-provider ratification record before it may merge. Decide whether the change may land as written.

## What the change does

- `src/install/layerPromotion.ts` — `sessionLayerStep()`, run once per claude `session_start`:
  - **Demote:** if the claude rule layer (`~/.claude/rules`) is marked thinned and the latest arrival record taken AFTER the promotion shows a consequence-class ("standing law") rule not loaded at session start, restore the staged full snapshot (overwrite only files carrying the package stamp, add missing ones, remove none — the same rule as the existing shell branch of the SessionStart command) and rename the `thinned` marker to `demoted`.
  - **Promote:** only if the layer is full, the shipped switch `src/config/layer-form-promotion.json` says `enabled: true`, the existing layer-form decision function (`_lib/layer_form_decision.ts`, step 3.1, unchanged) returns `thinned`, the install's ownership ledger has an entry for the anchor, and the time spent plus the last measured thin pass fits the `any_hook_event` p95 budget of `hook-latency-budget.json`: run the existing installer thin pass (`thinInstalledRuleLayer`, unchanged) on the layer, skipping user-edited files and every consequence-class and safety-floor rule, then mark the layer thinned and record the promotion time.
  - After either rewrite, the ownership ledger's recorded digests for the rewritten files are moved to the new bytes, so the next `install` classifies them as its own and writes the full layer again instead of preserving stubs as user edits.
  - **The switch ships `enabled: false`.** Step 5.3 of the roadmap flips it only on a non-inferior pre-registered comparison. Demotion is not behind the switch.
- `src/scripts/hooks/layer_promotion_hook.ts` — the concern: reads stdin, honours `AGENT_CONFIG_LAYER_PROMOTE=off` and replay mode, calls `sessionLayerStep`, exits 0 on every path, emits nothing.
- Binding: one manifest concern row (`severity: advisory`, `fail_closed: false`, `effect: execution`), appended to `platforms.claude.session_start` only; one `LAZY_CONCERNS` row; one chunk in `hook_chunks.mjs` (51,620 B, `yaml` external) with a 56,800-B chunk ceiling.
- Dispatch bundle ceiling `max_bytes` 1,554,000 → 1,554,800 with a `raise_log` entry: +144 B for the `LAZY_CONCERNS` row and +793 B because `projectTreeForm()` (the project tree's precedence rule, ratified in substance by a 2/2 council design round the same day for step 3.6) now has a caller on the live path; before, esbuild dropped it. Gate reading 1,554,423 B.

## Verification on this revision

`tests/install/layer_promotion.test.ts` (8 cases, fresh-HOME fixture built from the repository's own projection): session 1 full with no arrival record; session 2 thinned with one; a later record missing a standing law demotes and restores the full layer with the ledger matching disk; a record taken before the promotion never demotes; the shipped switch off moves nothing; each unmet condition keeps the layer full with its own reason; a promotion over the latency budget is skipped; a user-edited file is never thinned; the kill switch works. Three sabotage probes (drop the ledger rewrite, drop the post-promotion filter, bypass the switch) each turned one case red. 168 test files under `tests/install`, `tests/hooks`, `tests/scripts/hooks` and the layer-form suites pass; `check_hook_bundle_composition`, `check_concern_admissions` and `check_kill_switch_table` pass.

## Left out of the diff below

`hook_manifest.json` (one regenerated 21 KB line, checked by `tests/hooks/hook_manifest_compiled.test.ts`), the compiled `dist/install/layerPromotion.js`, the test file, the concern-admission ledger row and the two kill-switch table rows in `docs/contracts/hook-architecture-v1.md`. The `project_tree_form.ts` change is in a separate commit reviewed by the 3.6 design round and is shown only as its bundle effect above.

## What to answer

1. Does the diff contain a defect? Name file and line.
2. Is anything here an authority expansion beyond what is described above — in particular, can this concern change files the user did not get from this package, or act while the switch is off other than by demotion?
3. Is the bundle-ceiling raise justified as recorded?

End with exactly one verdict line: `VERDICT: ratified`, `VERDICT: confirmed-non-expanding`, or `VERDICT: refused — <reason>`.

## The diff (`git diff origin/main...HEAD` for the listed files)

```diff
diff --git a/src/config/hook-bundle-budget.json b/src/config/hook-bundle-budget.json
index 50d610e35f..148c42ea2b 100644
--- a/src/config/hook-bundle-budget.json
+++ b/src/config/hook-bundle-budget.json
@@ -5,5 +5,5 @@
     "owner": "maintainer",
     "review_by": "2027-10-01",
-    "max_bytes": 1554000,
+    "max_bytes": 1554800,
     "max_bytes_derivation": "Measured 1,514,715 bytes on origin/main at 213d87055 (the gate's own reading, APFS-cloned node_modules so no worktree path artefacts). The ceiling is that reading plus ~2.3 % of headroom, rounded to 1,550,000, on the same doctrine as the 2026-10-01 registration: a bundle is rebuilt from source on every run, so an esbuild minor that renames symbols moves the figure by hundreds of bytes with no change to this tree, and a ceiling one byte above the reading would red on that. Composition is healthy at this reading and was checked rather than assumed: one YAML package (258,833 bytes) and 1,238,525 bytes of own source, so the growth is own code, not a re-entered dependency. The 1,564,211-byte pre-swap regression this roadmap closed still cannot reappear under it. RAISED to 1,550,500 on 2026-10-23 for the InstructionsLoaded binding (237 bytes against 51 of headroom); the reasoning and the measured alternative are the last `raise_log` entry, so this paragraph describes the 1,550,000 registration and the raise is recorded there rather than restated.",
     "shrink_only": true,
@@ -65,4 +65,13 @@
             "why_it_could_not_be_avoided": "The 2026-10-18 derivation queued this rescan inside the 32,000 ceiling and the 2026-10-22 raise recorded it as not yet in the chunk. Room was taken first: `LATIN_TWIN` moved out of confusables.ts as a hex-encoded string pair so the chunk no longer carries that module's four script regexes, and the normaliser keeps one origin array instead of two (32,670 down to 31,907). The extent fix that a council seat found in round 1 of the ratification review adds about 400 bytes of mapping code no smaller form carries. The chunk loads only when a caller needs detection; the dispatch bundle is unchanged.",
             "what_would_have_caught_it": "Measuring the wired engine when 2.5 was first built rather than the unwired module, and a disguised-marker key block in the extent tests from the start."
+        },
+        {
+            "date": "2026-10-24",
+            "from": 1554000,
+            "to": 1554800,
+            "by": "agent, drain/setup-decides-itself-20261024 (road-to-a-setup-that-decides-itself 3.3 and 3.6)",
+            "what_was_added": "Two things, measured per module from one esbuild metafile over origin/main and over this branch. (1) One `LAZY_CONCERNS` row for `layer-promote` (+144 B); its body, the thin pass and the ownership-ledger rewrite ship in their own 51,620-byte chunk. (2) `projectTreeForm()`, the project tree's precedence rule, now on the live path (+793 B to `project_tree_form.ts`): before, it had no caller and esbuild dropped it, which is exactly the defect the full-quorum council of 2026-10-24 named for step 3.6. Gate reading 1,554,423 B against 1,554,000.",
+            "why_it_could_not_be_avoided": "D10 recorded that 3.3 would need more than the bytes left and asked for the next raise or extraction to be sized from all blocked work then; 3.3 and 3.6 are that work. Room was not re-tried: the 2026-10-23 and 2026-10-24 entries measured both narrow-event chunk candidates (`session-eol`, `handoff-context`) as buying a few hundred bytes for a quarter-megabyte require on every event, and nothing has changed that trade. The 793 B are the precedence rule itself, which the projector's path must carry, and the 144 B are the row no chunk can carry.",
+            "what_would_have_caught_it": "Nothing earlier: the base sat about 514 bytes under the ceiling. Sized to this change plus 377 bytes."
         }
     ],
@@ -103,4 +112,10 @@
             "registered_at": "2026-10-24",
             "derivation": "Measured 32,812 bytes on 2026-10-24 (the concern, its decision library and the delivery-receipt reader) with `yaml` external (the concern reads one user-global settings file with it; inlined it would be a second copy of the parser the dispatch bundle already carries). The ceiling is that reading plus about 10 %, rounded, with no growth queued. Bound on claude `session_start` alone, so a chunk keeps its body off every other dispatch parse; the bundle carries only its LAZY_CONCERNS row. Like `chat_history` it carries a concern, so a missing chunk falls back to the spawn path and costs latency, never the notice."
+        },
+        {
+            "entry": "src/scripts/hooks/layer_promotion_hook.ts",
+            "max_bytes": 56800,
+            "registered_at": "2026-10-24",
+            "derivation": "Measured 51,620 bytes on 2026-10-24 (the session-start layer step of road-to-a-setup-that-decides-itself 3.3: the decision with its machine evidence, the arrival-record reader, the thin pass, the staged-snapshot restore and the ownership-ledger rewrite) with `yaml` external (the thin pass parses rule frontmatter; `chat_history` requires the same copy earlier on the same event, so the load is a cache hit). The ceiling is that reading plus about 10 %, rounded, with no growth queued. Bound on claude `session_start` alone, so a chunk keeps it off every other dispatch's parse; the bundle carries only its LAZY_CONCERNS row. Like `chat_history` it carries a concern, so a missing chunk falls back to the spawn path and costs latency, never the layer step."
         }
     ],
diff --git a/src/config/layer-form-promotion.json b/src/config/layer-form-promotion.json
new file mode 100644
index 0000000000..19f5a5f64f
--- /dev/null
+++ b/src/config/layer-form-promotion.json
@@ -0,0 +1,8 @@
+{
+    "_comment": "Whether a session may promote the claude rule layer to its thinned form (road-to-a-setup-that-decides-itself step 3.3). Package-owned and shipped, never a settings key: no consumer layer, no cascade. OFF until step 5.3, which enables it only on a non-inferior pre-registered comparison (5.2) and cites that result file in the enabling commit. While off, the layer-form decision still runs in `doctor --check layer-form` as a shadow and nothing on disk moves. Demotion of a thinned layer runs whatever this says. An unreadable file reads as off. Read by src/install/layerPromotion.ts (promotionEnabled).",
+    "schema_version": 1,
+    "registered_at": "2026-10-24",
+    "owner": "maintainer",
+    "enabled": false,
+    "enable_when": "step 5.3: a non-inferior 5.2 result under D2, cited by path in the enabling commit"
+}
diff --git a/src/install/layerPromotion.ts b/src/install/layerPromotion.ts
new file mode 100644
index 0000000000..c98e63d29b
--- /dev/null
+++ b/src/install/layerPromotion.ts
@@ -0,0 +1,337 @@
+/**
+ * Promote the claude rule layer after proof, never at install
+ * (road-to-a-setup-that-decides-itself step 3.3).
+ *
+ * An install writes the full layer, exactly as before. A LATER session whose
+ * evidence satisfies the layer-form decision thins it for the sessions after
+ * it: the `layer-promote` concern calls {@link sessionLayerStep} on
+ * `session_start`. Nothing here thins the session that is running — its rules
+ * are already loaded — which is also why a promotion can never change what the
+ * session that took the decision reads.
+ *
+ * OFF UNTIL STEP 5.3. `src/config/layer-form-promotion.json` ships
+ * `enabled: false`, and an unreadable switch reads as off. Step 5.3 flips it on
+ * a non-inferior pre-registered comparison and cites the result there; until
+ * then the decision still runs in `doctor` as a shadow and nothing on disk
+ * moves. The switch is package-owned and shipped, never a settings key.
+ *
+ * DEMOTION RUNS WHATEVER THE SWITCH SAYS. A thinned layer whose arrival record —
+ * taken after the promotion — shows a standing law missing is restored from
+ * the staged snapshot and the machine is demoted, as a dead carrier demotes it
+ * in the shell branch of `claude_settings_hooks`. Only files carrying the
+ * package stamp are overwritten, missing ones are added, none is removed.
+ * Restoring is the safe direction, so no switch may stand in front of it.
+ *
+ * THE OWNERSHIP LEDGER FOLLOWS THE BYTES. The installer decides whether a file
+ * was edited by comparing it with the digest it recorded. A layer rewritten
+ * after the install would read as edited everywhere, and the next install would
+ * preserve every stub as a user modification. Each file this module rewrites
+ * has its recorded digest moved to the new bytes, so the next install sees
+ * its own file and writes the full layer again — "a fresh install writes the
+ * full layer" stays true after a promotion. A file whose bytes already
+ * differed from the record before the pass is a user edit and is left alone.
+ *
+ * LATENCY. The budget is the shipped `any_hook_event` p95 of
+ * `hook-latency-budget.json`. A promotion is attempted only when the time
+ * already spent plus the last measured thin pass (or {@link DEFAULT_THIN_ESTIMATE_MS}
+ * before the first one) fits inside it; otherwise it is left to a later session.
+ */
+import * as fs from 'node:fs';
+import * as os from 'node:os';
+import * as path from 'node:path';
+
+import * as global_deploy_inventory from '../scripts/_lib/global_deploy_inventory.js';
+import { read_lockfile, lockfile_path } from '../scripts/_lib/installed_lock.js';
+import { arrivalEvidence, arrivalsDirUnder, latestArrivalRecord, readObserverLines } from '../scripts/_lib/arrival_record.js';
+import { decideLayerForm, gatherShippedEvidence, ruleForm, type LayerFormDecision, type NeverThinned } from '../scripts/_lib/layer_form_decision.js';
+import { readMachineEvidence, withMachineEvidence } from '../scripts/_lib/layer_form_evidence.js';
+import { readConsequenceClass } from '../scripts/_lib/rule_consequence_class.js';
+import { thinInstalledRuleLayer } from './installThinLayer.js';
+import {
+    CLAUDE_LAYER_DIRNAME,
+    DEMOTED_MARKER,
+    PACKAGE_STAMP_LINE,
+    THINNED_MARKER,
+    currentRuntimeDir,
+    markClaudeLayer,
+    readCarrierState,
+    runtimeRootFor,
+} from './stagedRuntime.js';
+
+export const PROMOTION_SWITCH_REL = path.join('src', 'config', 'layer-form-promotion.json');
+export const PROMOTION_RECORD = 'promotion.json';
+export const LATENCY_BUDGET_REL = path.join('src', 'config', 'hook-latency-budget.json');
+/** Measured 11 ms for the thin pass over 121 rules (tsx, warm, 2026-10-24); the default is that plus margin. */
+export const DEFAULT_THIN_ESTIMATE_MS = 50;
+const FALLBACK_BUDGET_MS = 250;
+const LEDGER_TOOL = 'claude-code';
+
+export type SessionLayerAction = 'none' | 'promoted' | 'demoted' | 'skipped';
+
+export interface SessionLayerOutcome {
+    readonly action: SessionLayerAction;
+    readonly reason: string;
+}
+
+export interface PromotionRecord {
+    readonly promoted_at: string;
+    readonly version: string;
+    readonly last_thin_ms: number;
+}
+
+function readJson(file: string): Record<string, unknown> | null {
+    try {
+        const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
+        return typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
+    } catch {
+        return null;
+    }
+}
+
+/** `true` only when the shipped switch says exactly `enabled: true`. */
+export function promotionEnabled(packageRoot: string): boolean {
+    return readJson(path.join(packageRoot, PROMOTION_SWITCH_REL))?.['enabled'] === true;
+}
+
+export function readPromotionRecord(runtimeRoot: string): PromotionRecord | null {
+    const o = readJson(path.join(runtimeRoot, PROMOTION_RECORD));
+    if (o === null || typeof o['promoted_at'] !== 'string') return null;
+    return {
+        promoted_at: o['promoted_at'],
+        version: typeof o['version'] === 'string' ? o['version'] : 'unknown',
+        last_thin_ms: typeof o['last_thin_ms'] === 'number' ? o['last_thin_ms'] : DEFAULT_THIN_ESTIMATE_MS,
+    };
+}
+
+export function latencyBudgetMs(packageRoot: string): number {
+    const budgets = readJson(path.join(packageRoot, LATENCY_BUDGET_REL))?.['budgets_ms'] as Record<string, unknown> | undefined;
+    const p95 = (budgets?.['any_hook_event'] as Record<string, unknown> | undefined)?.['p95_ci'];
+    return typeof p95 === 'number' && p95 > 0 ? p95 : FALLBACK_BUDGET_MS;
+}
+
+function versionOf(dir: string): string | null {
+    const v = readJson(path.join(dir, 'package.json'))?.['version'];
+    return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
+}
+
+/** The version the global install recorded — the install that wrote the layer on disk. */
+function layerVersion(env: NodeJS.ProcessEnv): string | null {
+    const v = read_lockfile(lockfile_path(env))?.agent_config_version;
+    return typeof v === 'string' && v.trim() !== '' ? v.trim().replace(/^v+/, '') : null;
+}
+
+/** The decision for the claude layer on this machine, with the two version facts filled in. */
+export function decideClaudeLayer(packageRoot: string, env: NodeJS.ProcessEnv): LayerFormDecision {
+    const payload = versionOf(packageRoot);
+    const shipped = gatherShippedEvidence(packageRoot, payload ?? 'unknown')('claude-code');
+    const input = withMachineEvidence(shipped, readMachineEvidence(packageRoot, env));
+    return decideLayerForm({ ...input, payloadVersion: payload, layerVersion: layerVersion(env) });
+}
+
+/**
+ * Ledger records for the claude anchor, or `null` when the ledger holds no
+ * entry for this rules directory — then nothing proves which bytes are ours,
+ * and nothing is rewritten.
+ */
+function ledgerFor(
+    rulesDir: string,
+    env: NodeJS.ProcessEnv,
+): { inventory: global_deploy_inventory.Inventory; file: string; recorded: Map<string, global_deploy_inventory.LedgerDigest> } | null {
+    const file = global_deploy_inventory.inventory_path(env);
+    const inventory = global_deploy_inventory.load_inventory(file);
+    const anchor = path.dirname(rulesDir);
+    const recorded = global_deploy_inventory.recorded_digests(LEDGER_TOOL, anchor, inventory);
+    return recorded.size === 0 ? null : { inventory, file, recorded };
+}
+
+function relOf(rulesDir: string, file: string): string {
+    return `${path.basename(rulesDir)}/${path.basename(file)}`;
+}
+
+/** Move the recorded digest of each rewritten file to its new bytes, and save the ledger. */
+function rerecord(rulesDir: string, files: readonly string[], env: NodeJS.ProcessEnv): void {
+    const ledger = ledgerFor(rulesDir, env);
+    if (ledger === null || files.length === 0) return;
+    const tools = ledger.inventory['tools'] as Record<string, Record<string, unknown>>;
+    const digests = tools[LEDGER_TOOL]?.['digests'] as Record<string, unknown> | undefined;
+    if (digests === undefined) return;
+    for (const file of files) {
+        const rel = relOf(rulesDir, file);
+        const onDisk = global_deploy_inventory.file_sha256(file);
+        if (onDisk === null || !(rel in digests)) continue;
+        digests[rel] = { installed_sha256: onDisk, packaged_sha256: onDisk };
+    }
+    global_deploy_inventory.save_inventory(ledger.inventory, ledger.file);
+}
+
+/**
+ * Files the thin pass must skip: user edits — bytes that differ from what the
+ * install recorded — and every rule {@link ruleForm} keeps `full`.
+ */
+function keptWhole(
+    rulesDir: string,
+    recorded: ReadonlyMap<string, global_deploy_inventory.LedgerDigest>,
+    decision: LayerFormDecision,
+    never: NeverThinned,
+): Set<string> {
+    const out = new Set<string>();
+    let names: string[] = [];
+    try {
+        names = fs.readdirSync(rulesDir).filter((n) => n.endsWith('.md'));
+    } catch {
+        return out;
+    }
+    for (const name of names) {
+        const file = path.join(rulesDir, name);
+        const rec = recorded.get(relOf(rulesDir, file));
+        const edited = rec !== undefined && global_deploy_inventory.file_sha256(file) !== rec.installed_sha256;
+        if (edited || ruleForm(name.slice(0, -3), decision, never) === 'full') out.add(path.resolve(file));
+    }
+    return out;
+}
+
+/**
+ * The rules a thinned layer still carries whole (step 3.1): the consequence
+ * class and the `safety-floor` tier, read from the staged package. The thin pass
+ * would reduce them to stub-plus-law; the decision's contract is `full`.
+ */
+export function neverThinned(packageRoot: string): NeverThinned {
+    const safetyFloor = new Set<string>();
+    const dir = path.join(packageRoot, 'dist', 'agent-src', 'rules');
+    let names: string[] = [];
+    try {
+        names = fs.readdirSync(dir).filter((n) => n.endsWith('.md'));
+    } catch {
+        // No bodies to read a tier from: the thin pass reads the same directory and finds nothing either.
+    }
+    for (const name of names) {
+        const text = fs.readFileSync(path.join(dir, name), 'utf8');
+        const end = text.indexOf('\n---', 3);
+        if (text.startsWith('---') && end > 0 && /^tier:\s*["']?safety-floor["']?\s*$/m.test(text.slice(0, end))) {
+            safetyFloor.add(name.slice(0, -3));
+        }
+    }
+    return { consequenceClass: new Set(Object.keys(readConsequenceClass(packageRoot).members)), safetyFloor };
+}
+
+/**
+ * Restore the staged full layer into `rulesDir`: overwrite only stamped files,
+ * add missing ones, remove none — the shell branch's rule. Returns the files
+ * written, or `null` when the snapshot is missing.
+ */
+export function restoreStagedLayer(packageRoot: string, rulesDir: string): string[] | null {
+    const snapshot = path.join(packageRoot, CLAUDE_LAYER_DIRNAME);
+    let names: string[];
+    try {
+        names = fs.readdirSync(snapshot).filter((n) => n.endsWith('.md')).sort();
+    } catch {
+        return null;
+    }
+    const written: string[] = [];
+    for (const name of names) {
+        const target = path.join(rulesDir, name);
+        if (fs.existsSync(target) && !fs.readFileSync(target, 'utf8').split(/\r?\n/).includes(PACKAGE_STAMP_LINE)) continue;
+        const tmp = `${target}.ac-restore`;
+        fs.copyFileSync(path.join(snapshot, name), tmp);
+        fs.renameSync(tmp, target);
+        written.push(target);
+    }
+    return written;
+}
+
+function thinnedDir(runtimeRoot: string): string | null {
+    try {
+        const first = fs.readFileSync(path.join(runtimeRoot, THINNED_MARKER), 'utf8').split('\n')[0]?.trim() ?? '';
+        return first === '' ? null : first;
+    } catch {
+        return null;
+    }
+}
+
+/** Does the arrival record taken after the promotion show a standing law missing? */
+function standingLawMissingSince(runtimeRoot: string, packageRoot: string, env: NodeJS.ProcessEnv, since: string | null): boolean {
+    const lines = readObserverLines(arrivalsDirUnder(runtimeRoot)).filter((l) => since === null || l.ts > since);
+    const evidence = arrivalEvidence(latestArrivalRecord(lines), readMachineEvidence(packageRoot, env).standingLaws);
+    return evidence !== null && !evidence.standingLawsLoaded;
+}
+
+export interface SessionLayerOptions {
+    readonly env?: NodeJS.ProcessEnv;
+    /** The installed claude rule directory; defaults to `$HOME/.claude/rules`. */
+    readonly rulesDir?: string;
+    /** Monotonic clock in ms; the concern passes the time it started. */
+    readonly now?: () => number;
+    readonly startedAt?: number;
+    readonly date?: () => Date;
+}
+
+/**
+ * One session's step: demote a thinned layer an arrival record contradicts,
+ * or promote a full one the decision says may be thinned. Never throws.
+ */
+export function sessionLayerStep(opts: SessionLayerOptions = {}): SessionLayerOutcome {
+    const env = opts.env ?? process.env;
+    const now = opts.now ?? (() => performance.now());
+    const started = opts.startedAt ?? now();
+    try {
+        const runtimeRoot = runtimeRootFor(env);
+        let packageRoot: string;
+        try {
+            packageRoot = fs.realpathSync(currentRuntimeDir(runtimeRoot));
+        } catch {
+            return { action: 'none', reason: 'no-staged-runtime' };
+        }
+        const home = env['HOME'] ?? os.homedir();
+        const state = readCarrierState(runtimeRoot);
+
+        if (state.layer === 'thinned') {
+            const record = readPromotionRecord(runtimeRoot);
+            if (!standingLawMissingSince(runtimeRoot, packageRoot, env, record?.promoted_at ?? null)) {
+                return { action: 'none', reason: 'thinned-holds' };
+            }
+            const rulesDir = thinnedDir(runtimeRoot) ?? opts.rulesDir ?? path.join(home, '.claude', 'rules');
+            const written = restoreStagedLayer(packageRoot, rulesDir);
+            if (written === null) return { action: 'none', reason: 'snapshot-missing' };
+            rerecord(rulesDir, written, env);
+            fs.renameSync(path.join(runtimeRoot, THINNED_MARKER), path.join(runtimeRoot, DEMOTED_MARKER));
+            return { action: 'demoted', reason: 'arrival-standing-law-missing' };
+        }
+        if (state.layer === 'demoted') return { action: 'none', reason: 'demoted' };
+        if (!promotionEnabled(packageRoot)) return { action: 'none', reason: 'promotion-disabled' };
+
+        const decision = decideClaudeLayer(packageRoot, env);
+        if (decision.form !== 'thinned') return { action: 'none', reason: decision.reason };
+
+        const rulesDir = opts.rulesDir ?? path.join(home, '.claude', 'rules');
+        const ledger = ledgerFor(rulesDir, env);
+        if (ledger === null) return { action: 'none', reason: 'no-ledger' };
+        const estimate = readPromotionRecord(runtimeRoot)?.last_thin_ms ?? DEFAULT_THIN_ESTIMATE_MS;
+        if (now() - started + estimate > latencyBudgetMs(packageRoot)) return { action: 'skipped', reason: 'over-latency-budget' };
+
+        const rewritten: string[] = [];
+        const t0 = now();
+        const res = thinInstalledRuleLayer({
+            rulesDir,
+            packageRoot,
+            bodyLinkRoot: packageRoot,
+            preserved: keptWhole(rulesDir, ledger.recorded, decision, neverThinned(packageRoot)),
+            onWrite: (target) => rewritten.push(target),
+        });
+        const thinMs = Math.max(1, Math.round(now() - t0));
+        if (res.failed.length > 0) {
+            rerecord(rulesDir, restoreStagedLayer(packageRoot, rulesDir) ?? [], env);
+            return { action: 'none', reason: 'thin-failed' };
+        }
+        rerecord(rulesDir, rewritten, env);
+        markClaudeLayer(runtimeRoot, { thinned: true, rulesDir });
+        const record: PromotionRecord = {
+            promoted_at: (opts.date ?? (() => new Date()))().toISOString(),
+            version: versionOf(packageRoot) ?? 'unknown',
+            last_thin_ms: thinMs,
+        };
+        fs.writeFileSync(path.join(runtimeRoot, PROMOTION_RECORD), `${JSON.stringify(record, null, 2)}\n`);
+        return { action: 'promoted', reason: decision.reason };
+    } catch {
+        return { action: 'none', reason: 'error' };
+    }
+}
diff --git a/src/scripts/hook_chunks.mjs b/src/scripts/hook_chunks.mjs
index 424d6460eb..96e35f259f 100644
--- a/src/scripts/hook_chunks.mjs
+++ b/src/scripts/hook_chunks.mjs
@@ -57,4 +57,13 @@ export const HOOK_CHUNKS = Object.freeze([
         external: Object.freeze(['yaml']),
     }),
+    // `session_start` on claude alone; the thin pass and the ownership ledger
+    // it reads stay off every other dispatch's parse. `yaml` external for the
+    // reason given at `chat_history`, which `require`s the same copy earlier on
+    // the same event, so the load is a cache hit there.
+    Object.freeze({
+        entry: 'src/scripts/hooks/layer_promotion_hook.ts',
+        outfile: 'dist/hooks/layer_promotion.chunk.cjs',
+        external: Object.freeze(['yaml']),
+    }),
 ]);
 
diff --git a/src/scripts/hook_manifest.yaml b/src/scripts/hook_manifest.yaml
index e6bf8063f0..3eb24dd835 100644
--- a/src/scripts/hook_manifest.yaml
+++ b/src/scripts/hook_manifest.yaml
@@ -1398,4 +1398,19 @@ concerns:
     severity: advisory
     effect: execution
+  # road-to-a-setup-that-decides-itself step 3.3 — promote the claude rule layer
+  # after proof, never at install. On session_start: demote a thinned layer the
+  # latest arrival record (taken after the promotion) shows missing a standing
+  # law, or — only while `src/config/layer-form-promotion.json` is enabled, which
+  # step 5.3 decides — thin a full one for the FOLLOWING sessions when the
+  # layer-form decision returns `thinned`. Silent, exit 0 on every path, no
+  # hook-token-budget row — it emits nothing. claude alone: the arrival record
+  # and the carrier describe the claude layer only. Loaded from its own chunk.
+  # Kill switch: `AGENT_CONFIG_LAYER_PROMOTE=off`.
+  layer-promote:
+    script: src/scripts/hooks/layer_promotion_hook.ts
+    args: []
+    fail_closed: false
+    severity: advisory
+    effect: execution
   subagent-ledger:
     script: src/scripts/hooks/subagent_ledger_hook.ts
@@ -1620,5 +1635,5 @@ platforms:
   claude:
     ask:              native
-    session_start:    [chat-history, hot-context, handoff-context, session-canary, council-availability, telemetry-disclosure, first-run-gate, onboarding-gate, verify-before-complete, minimal-safe-diff, profile-staleness, wrapper-freshness, update-notice, surface-probe, session-register, review-baseline, journal-record, rule-inject, code-graph-refresh]
+    session_start:    [chat-history, hot-context, handoff-context, session-canary, council-availability, telemetry-disclosure, first-run-gate, onboarding-gate, verify-before-complete, minimal-safe-diff, profile-staleness, wrapper-freshness, update-notice, surface-probe, session-register, review-baseline, journal-record, rule-inject, code-graph-refresh, layer-promote]
     # `rule-inject` is bound here for ONE source: `compact`
     # (road-to-a-rule-carrier-that-works-outside-the-repo step 1.6). The concern
diff --git a/src/scripts/hooks/layer_promotion_hook.ts b/src/scripts/hooks/layer_promotion_hook.ts
new file mode 100644
index 0000000000..ed83a475b7
--- /dev/null
+++ b/src/scripts/hooks/layer_promotion_hook.ts
@@ -0,0 +1,54 @@
+#!/usr/bin/env tsx
+/**
+ * `layer-promote` — the session half of road-to-a-setup-that-decides-itself
+ * step 3.3. On `session_start` it runs {@link sessionLayerStep}: demote a
+ * thinned claude rule layer that the latest arrival record contradicts, or
+ * promote a full one for the FOLLOWING sessions when the layer-form decision
+ * returns `thinned`. Promotion is off until step 5.3 flips the shipped switch.
+ *
+ * Silent, exit 0 on every path, never blocks a session start. Loaded from its
+ * own chunk, never inlined into the dispatch bundle.
+ * Kill switch: `AGENT_CONFIG_LAYER_PROMOTE=off`.
+ */
+import * as fs from 'node:fs';
+import * as path from 'node:path';
+import { fileURLToPath, pathToFileURL } from 'node:url';
+
+import { sessionLayerStep, type SessionLayerOutcome } from '../../install/layerPromotion.js';
+import { EXIT_ALLOW } from './exit_codes.js';
+import { readHookStdin } from './hook_stdin.js';
+import { is_replay_mode } from './state_io.js';
+
+export const KILL_SWITCH_ENV = 'AGENT_CONFIG_LAYER_PROMOTE';
+
+export function runLayerPromotion(env: NodeJS.ProcessEnv = process.env, startedAt = performance.now()): SessionLayerOutcome {
+    if (env[KILL_SWITCH_ENV] === 'off') return { action: 'none', reason: 'kill-switch' };
+    if (is_replay_mode()) return { action: 'none', reason: 'replay' };
+    return sessionLayerStep({ env, startedAt });
+}
+
+export function main(): number {
+    const startedAt = performance.now();
+    try {
+        readHookStdin();
+        runLayerPromotion(process.env, startedAt);
+    } catch {
+        // A layer step never breaks a session start.
+    }
+    return EXIT_ALLOW;
+}
+
+// The spawn fallback runs this file as a script, so it needs an entry; inside a
+// bundle or chunk every module shares one `import.meta.url`, so it must never fire there.
+declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
+function isCliEntry(): boolean {
+    if (typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__) return false;
+    if (process.argv[1] === undefined) return false;
+    if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) return true;
+    try {
+        return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(process.argv[1]));
+    } catch {
+        return false;
+    }
+}
+if (isCliEntry()) process.exit(main());
diff --git a/src/scripts/hooks/lazy_concern.ts b/src/scripts/hooks/lazy_concern.ts
index 5285b0a09c..dbe3dd7b8e 100644
--- a/src/scripts/hooks/lazy_concern.ts
+++ b/src/scripts/hooks/lazy_concern.ts
@@ -81,4 +81,8 @@ export const LAZY_CONCERNS: Readonly<Record<string, { readonly chunk: string; re
             source: path.join('..', 'update_notice_hook'),
         }),
+        'src/scripts/hooks/layer_promotion_hook.ts': Object.freeze({
+            chunk: 'layer_promotion.chunk.cjs',
+            source: 'layer_promotion_hook',
+        }),
     });
 
```
