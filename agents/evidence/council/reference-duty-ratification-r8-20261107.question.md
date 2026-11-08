<!-- evidence-type: analysis -->

# Ratification review — bind the read ledger on Bash and pre_compact — round 8

You are an independent reviewer for a change in the `event4u/agent-config` repository. Two files in it, `src/scripts/hook_manifest.yaml` and its compiled twin `src/scripts/hook_manifest.json`, are hook plumbing on the ratification gate's list, so the change needs a two-provider verdict under ADR-268 § 4: an agent may change hook plumbing but may not ratify its own change.

subject: 015b3d4565548d0a94c18dbd0ada07204a8df4c4d074b299d3d5f2a93fe06f71

(The digest covers the gated files at commit `f43ec84837`, computed with `./scripts-run src/scripts/ratification_subject`.)

## Where this stands

Rounds 1–6 reviewed a larger change that bound `reread-guard` on Bash and claude `pre_compact` AND added the reference-duty observation. Every round named a new, narrower finding, each fixed test-first (record: `agents/evidence/analysis/reference-duty-council-rounds-2026-11-07.md`). The observation without the new bindings merged as PR #2912, so it is already on `main`: `scanDuties` (every matched rule yields its duties or a counted error, router `trigger_matches`, YAML frontmatter, exact `---` delimiter, per-rule isolation), one `ledgerKey` for reads and duties, version-checked read credit, and the `cat` recognizer and compaction clear as unbound code with tests.

This round's diff is only what #2912 left out, plus round 6's two open points:

- **The binding:** `Bash` added to the concern's `tools:`; the concern added to claude `pre_compact`.
- **Measured hot-path cost** (`agents/evidence/analysis/reference-duty-hot-path-2026-11-07.md`): the duty scan costs 0.41–0.61 ms p50, < 0.8 ms p90 per Edit/Write on the real router, against a 250 ms p95 hook budget. A Bash call other than a plain `cat <absolute file>` returns after one anchored regex, before any filesystem access.
- **Bounded state:** distinct `rule::reference` keys capped at `MAX_DUTY_KEYS = 256`; a dropped key increments `duty_overflow`. The real bound is the router's path/file-triggered references (two rules today). `duty_errors`/`duty_overflow` are integers. `reads` is the guard's pre-existing per-file map, cleared at `pre_compact` once bound.

The concern is advisory: it never exits 1 and never blocks; on the verified claude host its warn verdict reaches the host as exit 0. It injects nothing for the duty.

## Round 7 and what changed

Round 7: anthropic `refused`, openai refusing without a stance line — both on one defect: the cap held only for new keys, so a ledger loaded over 256 keys stayed over. Round 8:

- `readLedger` holds the duty map to `MAX_DUTY_KEYS` on load, keeping the most recent keys by `ts` and adding the excess to `duty_overflow`. Test: a ledger seeded with 266 keys is 256 after one hook run, `duty_overflow` 10.
- A test resolves the concerns from the shipped `hook_manifest.yaml` with the dispatcher's own `_resolve_concerns` / `_concern_matches_tool` and asserts `reread-guard` runs on claude `pre_compact` and on a claude Bash and Read `pre_tool_use`.
- Observability of `duty_overflow`: it is a field of the session ledger beside `duty_errors`, read the same way; no separate channel is added.

## Answer each question, by number

1. What behaviour changes, including what follows from it that the diff does not state?
2. Which authority or safety boundary becomes wider or narrower, and in which direction?
3. Does the change weaken anything that judges it — a test, a gate, a threshold, this review? The standard is quoted rather than paraphrased: the implementer never silently weakens an assertion, deletes, skips or xfails a failing test, lowers a threshold, or changes fixture semantics to fit the code. Does this change do any of those?
4. Is another host or projection left as a way around the control this change touches?
5. Can it be undone, and how — by whom, with what authority, and against which revision?
6. What observation would show the claimed benefit to be false, and what rollback / kill-switch criteria does the change omit?
7. Would a smaller change do, and what does the larger one buy that the smaller one does not?
8. What does it add to standing instruction weight that every later session pays?
9. Could untrusted content steer the path this change opens, and what bounds it if so?

End with exactly one line in this form:
`STANCE: <ratified|confirmed-non-expanding|refused> | CONFIDENCE: <high|med|low> | DEALBREAKER: <yes|no>`

## The diff (`git diff origin/main...feat/reference-duty-binding`, complete except the compiled JSON twin and the council prompts)

```diff
diff --git a/agents/evidence/analysis/reference-duty-hot-path-2026-11-07.md b/agents/evidence/analysis/reference-duty-hot-path-2026-11-07.md
new file mode 100644
index 0000000000..b773e0dbdb
--- /dev/null
+++ b/agents/evidence/analysis/reference-duty-hot-path-2026-11-07.md
@@ -0,0 +1,38 @@
+<!-- evidence-type: analysis -->
+
+# Reference duty — hot-path cost and state bounds
+
+The two entry questions blocker `hook-binding-ratification` names for re-binding
+`reread-guard` on Bash and claude `pre_compact`
+(`road-to-a-reference-that-arrives-before-the-act` step 2.2).
+
+## Cost per Edit/Write
+
+In-process timing of `scanDuties` + `dutyStates` against the repository's real
+`dist/router.json` and rule tree, 20 warm-up calls then 500 timed calls per path,
+2026-11-07 on the maintainer's Mac:
+
+| Path written | Duties found | p50 | p90 | p99.9 |
+|---|---:|---:|---:|---:|
+| `src/scripts/x.ts` (no trigger matches) | 0 | 0.450 ms | 0.646 ms | 1.055 ms |
+| `dist/agent-src/rules/x.md` | 1 | 0.610 ms | 0.783 ms | 1.153 ms |
+| `.claude/settings.json` | 1 | 0.406 ms | 0.569 ms | 1.209 ms |
+
+Against the `any_hook_event.p95_ci` budget of 250 ms in `hook-latency-budget.json`,
+this is under 0.5 % of it.
+
+## Cost per Bash call
+
+The concern reaches its ledger only for a plain `cat <absolute file>`. Every other
+Bash command is one anchored regex (`wholeFileCatPath`) and an early return, before
+any filesystem access.
+
+## State bounds
+
+- `duty`: at most one entry per `rule::reference` pair. The real bound is the router's
+  path- and file-triggered references (two rules today, per step 2.4); a hard cap of
+  `MAX_DUTY_KEYS = 256` stops a corrupt router from growing the file, and each dropped
+  key increments `duty_overflow`. Entries hold integers, so they do not grow with use.
+- `duty_errors`, `duty_overflow`: single integers.
+- `reads`: one entry per distinct file read in full, unchanged from the guard's
+  behaviour before this roadmap; cleared at `pre_compact` once bound.
diff --git a/src/scripts/hook_manifest.yaml b/src/scripts/hook_manifest.yaml
index 6d4058a2bb..6744661e5d 100644
--- a/src/scripts/hook_manifest.yaml
+++ b/src/scripts/hook_manifest.yaml
@@ -1319,8 +1319,9 @@ concerns:
     fail_closed: false
     severity: advisory
     effect: verification
-    # Provable from the hook's own source: READ_TOOLS ∪ WRITE_TOOLS.
-    tools: [Read, Edit, Write]
+    # Provable from the hook's own source: READ_TOOLS ∪ WRITE_TOOLS, plus Bash
+    # for a whole-file `cat <absolute file>` (wholeFileCatPath), which is a read too.
+    tools: [Read, Edit, Write, Bash]
     needs_payload_bodies: [input]
   # Memory recall — delivers a memory the store ALREADY holds, at the moment
   # the tool call it is about would run. The finding: in one long autonomous
@@ -1789,7 +1790,7 @@ platforms:
     # Claude Code transcript fact. (It was the ONLY binding on this slot until
     # the entry below; that sentence is retired rather than left to rot.)
     #
-    pre_compact:      [language-mirror, rule-inject, journal-record]
+    pre_compact:      [language-mirror, rule-inject, journal-record, reread-guard]
     # road-to-subagent-lifecycle-integrity Phase 1 Step 1. `claude` is the only
     # platform where both native events were measured present on the installed
     # binary (2.1.229 — see the evidence page cited on the alias rows below).
diff --git a/src/scripts/hooks/reread_guard_hook.ts b/src/scripts/hooks/reread_guard_hook.ts
index a05fb0749c..5d380c4b30 100644
--- a/src/scripts/hooks/reread_guard_hook.ts
+++ b/src/scripts/hooks/reread_guard_hook.ts
@@ -4,10 +4,9 @@
  * (road-to-token-economy-cache Phase 6.1/6.2). A subagent's reads are keyed
  * apart from its parent's (`agent_id`).
  *
- * The concern also handles a `pre_compact` envelope (clears the recorded reads)
- * and a Bash `cat <absolute file>` (a full read), but the manifest binds it to
- * neither yet: that binding is hook plumbing and lands with its own
- * ratification.
+ * Also bound on Bash, where a plain `cat <absolute file>` counts as a full read,
+ * and on claude `pre_compact`, where it clears the recorded reads: compaction
+ * drops what was read.
  *
  * Two signals, one session-scoped read ledger:
  *
@@ -202,6 +201,8 @@ export interface Ledger {
     duty?: Record<string, DutyRecord>;
     /** File acts whose duty could not be computed (an unreadable router). */
     duty_errors?: number;
+    /** Duty keys dropped at {@link MAX_DUTY_KEYS}. */
+    duty_overflow?: number;
 }
 
 function emptyLedger(): Ledger {
@@ -223,6 +224,19 @@ export function ledgerFile(workspaceRoot: string, sessionKey: string): string {
     return path.join(workspaceRoot, 'agents', 'runtime', 'state', 'reread-guard', `${sessionKey}.json`);
 }
 
+/**
+ * The duty map as loaded, held to {@link MAX_DUTY_KEYS}: a ledger written before
+ * the cap, or by hand, keeps its most recent keys and counts the rest.
+ */
+function boundedDuty(parsed: JsonObject): Pick<Ledger, 'duty' | 'duty_overflow'> {
+    const prior = typeof parsed['duty_overflow'] === 'number' ? parsed['duty_overflow'] : 0;
+    if (!isObject(parsed['duty'])) return prior > 0 ? { duty_overflow: prior } : {};
+    const entries = Object.entries(parsed['duty'] as unknown as Record<string, DutyRecord>);
+    if (entries.length <= MAX_DUTY_KEYS) return { duty: Object.fromEntries(entries), ...(prior > 0 ? { duty_overflow: prior } : {}) };
+    entries.sort((a, b) => (Number(b[1]?.ts) || 0) - (Number(a[1]?.ts) || 0));
+    return { duty: Object.fromEntries(entries.slice(0, MAX_DUTY_KEYS)), duty_overflow: prior + entries.length - MAX_DUTY_KEYS };
+}
+
 export function readLedger(workspaceRoot: string, sessionKey: string): Ledger {
     try {
         const parsed = JSON.parse(fs.readFileSync(ledgerFile(workspaceRoot, sessionKey), 'utf8'));
@@ -231,7 +245,7 @@ export function readLedger(workspaceRoot: string, sessionKey: string): Ledger {
             reads: isObject(parsed['reads']) ? (parsed['reads'] as unknown as Record<string, ReadRecord>) : {},
             writes: isObject(parsed['writes']) ? (parsed['writes'] as Record<string, number>) : {},
             fired: isObject(parsed['fired']) ? (parsed['fired'] as Record<string, boolean>) : {},
-            ...(isObject(parsed['duty']) ? { duty: parsed['duty'] as unknown as NonNullable<Ledger['duty']> } : {}),
+            ...boundedDuty(parsed),
             ...(typeof parsed['duty_errors'] === 'number' ? { duty_errors: parsed['duty_errors'] } : {}),
         };
     } catch {
@@ -303,6 +317,13 @@ export function buildPostEditReadLine(relPath: string): string {
     );
 }
 
+/**
+ * Distinct `rule::reference` keys a ledger keeps. The real bound is the router's
+ * path- and file-triggered references (a handful); the cap only stops a corrupt
+ * or hostile router from growing the file, and a dropped key is counted.
+ */
+export const MAX_DUTY_KEYS = 256;
+
 export interface DutyRecord {
     state: DutyState;
     pending: number;
@@ -325,6 +346,10 @@ function recordDuty(ledger: Ledger, key: string, workspaceRoot: string): void {
     const ts = Date.now();
     ledger.duty = { ...(ledger.duty ?? {}) };
     for (const [k, state] of Object.entries(states)) {
+        if (ledger.duty[k] === undefined && Object.keys(ledger.duty).length >= MAX_DUTY_KEYS) {
+            ledger.duty_overflow = (ledger.duty_overflow ?? 0) + 1;
+            continue;
+        }
         const prior = ledger.duty[k] ?? { state, pending: 0, read: 0, ts };
         ledger.duty[k] = {
             state,
diff --git a/tests/scripts/reference_duty.test.ts b/tests/scripts/reference_duty.test.ts
index 93612c775c..e24d80cf0c 100644
--- a/tests/scripts/reference_duty.test.ts
+++ b/tests/scripts/reference_duty.test.ts
@@ -12,7 +12,8 @@ import { fileURLToPath } from 'node:url';
 import { afterEach, describe, expect, it } from 'vitest';
 
 import { dutyStates, scanDuties } from '../../src/scripts/_lib/reference_duty.js';
-import { ledgerFile } from '../../src/scripts/hooks/reread_guard_hook.js';
+import { _concern_matches_tool, _load_yaml, _resolve_concerns } from '../../src/scripts/hooks/dispatch_hook.js';
+import { ledgerFile, MAX_DUTY_KEYS } from '../../src/scripts/hooks/reread_guard_hook.js';
 
 const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
 const HOOK = path.join(REPO_ROOT, 'src', 'scripts', 'hooks', 'reread_guard_hook.ts');
@@ -233,3 +234,48 @@ describe('council round 6', () => {
         expect(scan.errors).toHaveLength(1);
     });
 });
+
+describe('ratification entry questions: bounded state', () => {
+    it('caps distinct duty keys and counts what it drops', () => {
+        const root = workspace();
+        const key = crypto.createHash('sha256').update('s1').digest('hex');
+        const ledgerPath = ledgerFile(root, key);
+        fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
+        const duty: Record<string, unknown> = {};
+        for (let i = 0; i < MAX_DUTY_KEYS; i++) duty[`r${String(i)}::x`] = { state: 'read', pending: 0, read: 1, ts: 1 };
+        fs.writeFileSync(ledgerPath, JSON.stringify({ reads: {}, writes: {}, fired: {}, duty }));
+        run(root, { tool_name: 'Write', tool_input: { file_path: path.join(root, '.claude', 'x.md'), content: 'x' } });
+        const after = JSON.parse(fs.readFileSync(ledgerPath, 'utf8')) as { duty: Record<string, unknown>; duty_overflow?: number };
+        expect(Object.keys(after.duty)).toHaveLength(MAX_DUTY_KEYS);
+        expect(after.duty_overflow).toBe(1);
+    });
+});
+
+describe('the shipped manifest routes the read ledger where the duty needs it', () => {
+    const manifest = _load_yaml(path.join(REPO_ROOT, 'src', 'scripts', 'hook_manifest.yaml'));
+    it('runs reread-guard on claude pre_compact', () => {
+        expect(_resolve_concerns(manifest, 'claude', 'pre_compact').map((c) => c.name)).toContain('reread-guard');
+    });
+    it('runs reread-guard on a claude Bash pre_tool_use, and on Read', () => {
+        const concern = _resolve_concerns(manifest, 'claude', 'pre_tool_use').find((c) => c.name === 'reread-guard');
+        expect(concern).toBeDefined();
+        expect(_concern_matches_tool(concern as unknown as Record<string, never>, 'Bash')).toBe(true);
+        expect(_concern_matches_tool(concern as unknown as Record<string, never>, 'Read')).toBe(true);
+    });
+});
+
+describe('the cap holds on a ledger loaded over it', () => {
+    it('prunes an oversized duty map on load and counts the excess', () => {
+        const root = workspace();
+        const key = crypto.createHash('sha256').update('s1').digest('hex');
+        const ledgerPath = ledgerFile(root, key);
+        fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
+        const duty: Record<string, unknown> = {};
+        for (let i = 0; i < MAX_DUTY_KEYS + 10; i++) duty[`r${String(i)}::x`] = { state: 'read', pending: 0, read: 1, ts: i };
+        fs.writeFileSync(ledgerPath, JSON.stringify({ reads: {}, writes: {}, fired: {}, duty }));
+        run(root, { tool_name: 'Write', tool_input: { file_path: path.join(root, 'src', 'a.ts'), content: 'x' } });
+        const after = JSON.parse(fs.readFileSync(ledgerPath, 'utf8')) as { duty: Record<string, unknown>; duty_overflow?: number };
+        expect(Object.keys(after.duty)).toHaveLength(MAX_DUTY_KEYS);
+        expect(after.duty_overflow).toBe(10);
+    });
+});
```
