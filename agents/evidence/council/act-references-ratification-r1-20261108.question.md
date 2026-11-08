<!-- evidence-type: analysis -->

# Ratification review — act-time reference duty in a conditional chunk — round 1

You are an independent reviewer for a change in the `event4u/agent-config` repository. One file in it, `src/config/hook-bundle-budget.json`, is on the ratification gate's list (the hook bundle's byte budget), so the change needs a two-provider verdict under ADR-268 § 4.

subject: 24053c212e68209e64bc480b7a485dc75810d2e30f814127a754c218fe75e072

(The digest covers the gated file at commit `b5e4c19826`, computed with `./scripts-run src/scripts/ratification_subject`.)

## What the change does

- **Act-reference table** `src/config/act-references.json` binds `git commit` → `commit-policy`, `git push` → `non-destructive-by-default` + `scope-control`, `gh pr create` → `scope-control`. Rule ids only, each with an owner; references come from each rule's own `load_context`. Chosen by council design round 2 (option B) over kernel frontmatter, which the rule schema forbids for router triggers. A test validates every binding (keys, owner, rule exists and has `load_context`).
- **Recogniser** `src/scripts/_lib/shell_acts.ts`: heredoc bodies dropped, segments split on `;` `&&` `||` `|` newline outside quotes, env assignments / `sudo` etc. stripped, `git -C`/`-c` skipped. Spike over 14,834 real agent Bash calls: ≤ 0.1 % misses; a prefix match finds 17 % (`agents/evidence/analysis/shell-command-recognition-spike-2026-11-08.md`).
- **Observation** in the existing `reread-guard` concern (already bound on claude `pre_tool_use` for Bash; no binding change): a Bash command containing a bound act word records each bound rule's references as `read` / `required-pending` in the session ledger, observe-only. The raw command is never stored. A bound rule that cannot be read counts as `duty_errors`.
- **Conditional chunk:** the duty logic (router walk, frontmatter parse, table, recogniser) moved out of the dispatch bundle into `dist/hooks/reference_duty.chunk.cjs` (15,080 B, ceiling 16,600 B registered in the gated file). It loads only on a file write or a Bash command matching `ACT_WORDS` (a test keeps that in step with the table). The bundle drops to 1,582,460 B (ceiling 1,585,000; it would have been 1,588,246 B with the logic inline). A missing or mis-digested chunk makes the hook count a duty error and observe nothing; the read ledger and advisories are unaffected. `ledgerKey` moved to `_lib/ledger_key.ts`, which stays in the bundle.

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

## The diff (`git diff origin/main...feat/act-references`, source and config; tests and evidence omitted)

```diff
diff --git a/agents/roadmaps/road-to-a-reference-that-arrives-before-the-act.md b/agents/roadmaps/road-to-a-reference-that-arrives-before-the-act.md
index 9b41cf2101..f0ea8680fc 100644
--- a/agents/roadmaps/road-to-a-reference-that-arrives-before-the-act.md
+++ b/agents/roadmaps/road-to-a-reference-that-arrives-before-the-act.md
@@ -12,7 +12,7 @@ relates:
     relation: disjoint
     note: Owns the session-start size budget, the law form and the inactive-pack floors.
 estate_offset_exempt: "Extracted from road-to-mixed-trigger-activation-cost Phase 5 by owner decision of 2026-11-07, recorded in agents/evidence/owner-directives/2026-11-07-wip-cap-25.md, which names road-to-a-reference-that-arrives-before-the-act; no other roadmap owns the reference duty (owner search over active, later/, stubs/, skipped/ and archive/ in round inbox-2026-11-z)."
-estate_growth_exempt: "Resolves hook-binding-ratification; no new blocker or roadmap."
+estate_growth_exempt: "Resolves shell-command-trigger-kind; no new blocker or roadmap."
 ---
 # Road to a reference that arrives before the act
 
@@ -145,26 +145,22 @@ every step is observe-only or measurement-only unless it says otherwise. Complia
       extra turns and cost.
       spend released 2026-11-07; any blocking default still needs owner ratification, with a
       false-positive ceiling registered before the run.
-      blocked: `shell-command-trigger-kind`.
       verify: pre-registration committed before the first trial.
 
 ## Blockers
 
 ### blocker: shell-command-trigger-kind
-- **Status:** open
-- **Owner:** agent — `road-to-mixed-trigger-activation-cost` step 2.3 (action-time delivery)
-- **Blocks:** 3.1
-- **What to do:** add a trigger kind that names a shell command (`git commit`,
-  `gh pr create`, `git push`) and give `commit-policy`, `scope-control` and
-  `non-destructive-by-default` rows with it. Step 2.4 found that the only acts with a
-  duty today are writes under `.claude/`, `dist/agent-src/` and design files plus three
-  slash commands, so a four-arm comparison now would measure a duty almost no task meets.
-- **Recommendation:** build the trigger kind inside `road-to-mixed-trigger-activation-cost`
-  step 2.3, because that step already owns delivery at the tool call; a second carrier
-  here would split one mechanism across two roadmaps.
-- **If you do nothing:** 3.1 stays open, and the three always-loaded authority rules can
-  never leave the always-loaded layer, because no act would carry them.
-- **Resolved when:** `task report-rule-requires` shows act rows for those three rules.
+- **Status:** RESOLVED 2026-11-08 — council design round 2 chose a separate act-reference
+  table (`src/config/act-references.json`, rule ids only) over kernel-rule frontmatter,
+  which the rule schema forbids for router triggers. A recognition spike measured the
+  segmenting recogniser at ≤ 0.1 % misses over 14,834 real Bash calls
+  (`agents/evidence/analysis/shell-command-recognition-spike-2026-11-08.md`);
+  `task report-rule-requires` now shows `shell_command` rows for `commit-policy`,
+  `scope-control` and `non-destructive-by-default`.
+- **Owner:** agent
+- **Blocks:** nothing now (held 3.1)
+- **What to do:** nothing.
+- **Resolved when:** done.
 
 ### blocker: hook-binding-ratification
 - **Status:** RESOLVED 2026-11-07 — ratified by two providers in round 13
diff --git a/src/config/act-references.json b/src/config/act-references.json
new file mode 100644
index 0000000000..4f13b7e7da
--- /dev/null
+++ b/src/config/act-references.json
@@ -0,0 +1,9 @@
+{
+    "_comment": "Act-time reference bindings for the reference duty (road-to-a-reference-that-arrives-before-the-act, council design round 2, 2026-11-08, option B). Each binding names a shell command and the rules whose load_context references are due when that command runs. The table carries rule ids only: no rule text and no reference paths — those stay in the rules, so the rule is still the one place that says what the reference is. Read by src/scripts/_lib/reference_duty.ts (observation in the reread-guard concern) and src/scripts/rule_reference_requires.ts; validated by tests/scripts/act_references.test.ts. Kernel rules may appear here because this is not a router activation trigger, which the rule schema forbids on kernel rules.",
+    "schema_version": 1,
+    "bindings": [
+        { "shell_command": "git commit", "rules": ["commit-policy"], "owner": "maintainer" },
+        { "shell_command": "git push", "rules": ["non-destructive-by-default", "scope-control"], "owner": "maintainer" },
+        { "shell_command": "gh pr create", "rules": ["scope-control"], "owner": "maintainer" }
+    ]
+}
diff --git a/src/config/hook-bundle-budget.json b/src/config/hook-bundle-budget.json
index c7f03a2ec7..21cced3540 100644
--- a/src/config/hook-bundle-budget.json
+++ b/src/config/hook-bundle-budget.json
@@ -276,6 +276,12 @@
             "max_bytes": 61600,
             "registered_at": "2026-11-04",
             "derivation": "Measured 55,991 bytes on 2026-11-04 for the roadmap agents/roadmaps/archive/road-to-a-noted-that-is-a-write.md. The chunk holds the self-repair concern, its four detectors including persistence-claim, the record store with the target and subject indexes, and the Class-A telemetry shadow (emitDefectShadow: a structural-fields-only copy of a queued record for the org telemetry pack, inert unless that pack activated telemetry); `yaml` is external, resolved from the installed package as for the chat_history, update_notice and star_ask chunks. The ceiling is that reading plus about 10 %, rounded, the same margin as the quota_notice and intake_pass rows. The margin approves no planned code: a later addition to the chunk is measured and reviewed on its own change. WHY IT WAS MOVED: the dispatch bundle sat 14 bytes under its 1,582,000 ceiling at origin/main b53718de2 (measured 1,581,986 B by this gate with APFS-cloned node_modules), and the roadmap's detector work had to land somewhere. The concern built alone was 51,156 bytes before the work; moving it out, as the 2026-10-18 council chose for this situation, took the dispatch bundle to 1,557,293 B (-24,693 B, the rest being modules other concerns still import) instead of raising the dispatch ceiling. Bound on `user_prompt_submit` and `stop`; the bundle carries only its LAZY_CONCERNS row. A missing or mis-digested chunk falls back to spawning the same script, which is slower; tests/hooks/self_repair_lazy_paths.test.ts pins that the loader path and the spawn fallback write the same record, and that the built dispatcher falls back to the spawn exactly once with the chunk missing. On either path a failure of the concern does not reject the hook event (`fail_closed: false`, unchanged by this move); the dispatcher still writes that run's exit code to agents/runtime/state/.dispatcher/<session>/self-repair.json, which is where a failing concern is visible."
+        },
+        {
+            "entry": "src/scripts/_lib/reference_duty.ts",
+            "max_bytes": 16600,
+            "registered_at": "2026-11-08",
+            "derivation": "Measured 15,080 bytes on 2026-11-08 for road-to-a-reference-that-arrives-before-the-act. The chunk holds the reference duty: the router walk with trigger_matches, the rule-frontmatter parse, the act-reference table and the shell-act recogniser; `yaml` is external, resolved from the installed package as for the chat_history chunk. The ceiling is that reading plus about 10 %, rounded, the margin of the quota_notice, intake_pass and self_repair rows. WHY IT IS A CHUNK: adding the act-time duty in the dispatch bundle measured 1,588,246 B against the 1,585,000 B ceiling (real node_modules install); the duty runs only on a file write or on a Bash command containing a bound act word (`reference_duty_loader.ACT_WORDS`), so it does not belong in the bytes every hook event loads. The bundle keeps the loader, the act-word pre-check and `_lib/ledger_key.ts`. A missing or mis-digested chunk makes the hook count a duty error instead of observing; the guard's read ledger and advisories are unaffected."
         }
     ],
     "chunks_note": "A chunk is loaded only when a caller needs it, so its bytes are not paid by every dispatch; its ceiling exists so that the move out of dispatch.js stays a measured place rather than an unmeasured one. The gate builds each chunk with the exact esbuild segment `build:hook-chunks` uses for its entry.",
diff --git a/src/scripts/_lib/ledger_key.ts b/src/scripts/_lib/ledger_key.ts
new file mode 100644
index 0000000000..9fa6dc9b90
--- /dev/null
+++ b/src/scripts/_lib/ledger_key.ts
@@ -0,0 +1,12 @@
+import * as path from 'node:path';
+
+/**
+ * The one key both the read ledger and the reference duty use for a file:
+ * relative to the workspace when the file is inside it, absolute otherwise. Two
+ * derivations of this key would silently disagree for every reference outside
+ * the workspace.
+ */
+export function ledgerKey(workspaceRoot: string, absPath: string): string {
+    const rel = path.relative(workspaceRoot, absPath);
+    return rel === '' || rel.startsWith('..') || path.isAbsolute(rel) ? absPath : rel;
+}
diff --git a/src/scripts/_lib/reference_duty.ts b/src/scripts/_lib/reference_duty.ts
index 451756fa5e..cdcd4ad319 100644
--- a/src/scripts/_lib/reference_duty.ts
+++ b/src/scripts/_lib/reference_duty.ts
@@ -12,7 +12,10 @@ import * as path from 'node:path';
 
 import { parse as parseYaml } from 'yaml';
 
+import actReferences from '../../config/act-references.json';
+import { ledgerKey } from './ledger_key.js';
 import { ruleSources } from './rule_injection.js';
+import { commandRunsAct } from './shell_acts.js';
 import { trigger_matches, type Trigger } from './router_match.js';
 
 export interface Duty {
@@ -27,15 +30,10 @@ export type DutyState = 'read' | 'required-pending';
 
 export class DutySourceError extends Error {}
 
-/**
- * The one key both the read ledger and the duty use for a file: relative to the
- * workspace when the file is inside it, absolute otherwise. Two derivations of
- * this key would silently disagree for every reference outside the workspace.
- */
-export function ledgerKey(workspaceRoot: string, absPath: string): string {
-    const rel = path.relative(workspaceRoot, absPath);
-    return rel === '' || rel.startsWith('..') || path.isAbsolute(rel) ? absPath : rel;
-}
+/** The loader checks this before using the chunk; bump it when the exports change. */
+export const REFERENCE_DUTY_SCHEMA = 1;
+
+export { ledgerKey };
 
 function loadContextOf(ruleFile: string): string[] {
     let text: string;
@@ -154,3 +152,39 @@ export function dutyStates(
     }
     return states;
 }
+
+/** One act-time binding: a shell command and the rules whose references it makes due. */
+export interface ActBinding {
+    shell_command: string;
+    rules: string[];
+}
+
+/**
+ * References due when `command` runs a bound shell act (`src/config/act-references.json`).
+ * The table names rule ids only; each reference comes from the rule's own
+ * `load_context`. A bound rule that cannot be read is listed in `errors`.
+ */
+export function scanActDuties(
+    command: string,
+    workspaceRoot: string,
+    bindings: readonly ActBinding[] = actReferences.bindings,
+): DutyScan {
+    const rules = new Set<string>();
+    for (const b of bindings) if (commandRunsAct(command, b.shell_command)) for (const r of b.rules) rules.add(r);
+    if (rules.size === 0) return { duties: [], errors: [] };
+    const sources = ruleSources(workspaceRoot);
+    const duties: Duty[] = [];
+    const errors: string[] = [];
+    for (const id of rules) {
+        const dir = sources.dirs.find((d) => fs.existsSync(path.join(d, `${id}.md`)));
+        try {
+            if (dir === undefined) throw new DutySourceError(`bound rule has no file: ${id}`);
+            for (const reference of loadContextOf(path.join(dir, `${id}.md`))) {
+                duties.push({ rule: id, reference, resolved: ledgerKey(workspaceRoot, path.resolve(dir, reference)) });
+            }
+        } catch (e) {
+            errors.push((e as Error).message);
+        }
+    }
+    return { duties, errors };
+}
diff --git a/src/scripts/_lib/shell_acts.ts b/src/scripts/_lib/shell_acts.ts
new file mode 100644
index 0000000000..2cb551eee4
--- /dev/null
+++ b/src/scripts/_lib/shell_acts.ts
@@ -0,0 +1,81 @@
+/**
+ * Whether an agent's Bash command runs a given shell act (`git commit`, …).
+ *
+ * Agents chain: a prefix match finds 17 % of commits in real transcripts, so the
+ * command is segmented. Heredoc bodies are dropped first (prose in them is not a
+ * command, and an apostrophe in them would unbalance the quote tracking), the rest
+ * is split on `;`, `&&`, `||`, `|` and newlines outside quotes, and each segment is
+ * normalised: leading `VAR=…` assignments and `sudo`/`command`/`time`/`exec`/
+ * `nohup` dropped, `git -C <dir>` / `git -c k=v` skipped.
+ *
+ * Not recognised, by design: commands built at runtime (`eval`, `$CMD`), aliases
+ * and shell functions, wrappers that run git themselves, and `bash -c "…"`. A
+ * recognised act is a fact; an unrecognised one is no evidence that none ran.
+ */
+
+const PREFIX_WORDS = new Set(['sudo', 'command', 'time', 'exec', 'nohup']);
+
+function stripHeredocs(cmd: string): string {
+    const out: string[] = [];
+    let tag: string | null = null;
+    for (const line of cmd.split('\n')) {
+        if (tag !== null) {
+            if (line.trim() === tag) tag = null;
+            continue;
+        }
+        out.push(line);
+        const m = /<<-?\s*['"]?([A-Za-z_][A-Za-z0-9_]*)['"]?/.exec(line);
+        if (m) tag = m[1] as string;
+    }
+    return out.join('\n');
+}
+
+function segments(raw: string): string[] {
+    const cmd = stripHeredocs(raw);
+    const out: string[] = [];
+    let cur = '';
+    let quote: string | null = null;
+    for (let i = 0; i < cmd.length; i += 1) {
+        const ch = cmd[i] as string;
+        if (quote !== null) {
+            cur += ch;
+            if (ch === quote) quote = null;
+            continue;
+        }
+        if (ch === '"' || ch === "'") {
+            quote = ch;
+            cur += ch;
+            continue;
+        }
+        const pair = ch === '&' && cmd[i + 1] === '&';
+        if (ch === ';' || ch === '\n' || ch === '|' || pair) {
+            out.push(cur);
+            cur = '';
+            if (pair || (ch === '|' && cmd[i + 1] === '|')) i += 1;
+            continue;
+        }
+        cur += ch;
+    }
+    out.push(cur);
+    return out.map((s) => s.trim()).filter((s) => s !== '');
+}
+
+function words(segment: string): string[] {
+    let t = segment.split(/\s+/);
+    while (t.length > 0 && (/^[A-Za-z_][A-Za-z0-9_]*=/.test(t[0] as string) || PREFIX_WORDS.has(t[0] as string))) t = t.slice(1);
+    if (t[0] === 'git') {
+        let i = 1;
+        while (i < t.length && (t[i] === '-C' || t[i] === '-c')) i += 2;
+        return ['git', ...t.slice(i)];
+    }
+    return t;
+}
+
+/** True when some simple command in `command` begins with the words of `act`. */
+export function commandRunsAct(command: string, act: string): boolean {
+    const want = act.split(' ');
+    return segments(command).some((seg) => {
+        const w = words(seg);
+        return want.every((x, i) => w[i] === x);
+    });
+}
diff --git a/src/scripts/hook_chunks.mjs b/src/scripts/hook_chunks.mjs
index 470a94a431..c72bb5443c 100644
--- a/src/scripts/hook_chunks.mjs
+++ b/src/scripts/hook_chunks.mjs
@@ -25,6 +25,14 @@ import { buildSync } from 'esbuild';
 export const HOOK_CHUNKS = Object.freeze([
     Object.freeze({ entry: 'src/scripts/_lib/svg_rules.ts', outfile: 'dist/hooks/svg_rules.chunk.cjs' }),
     Object.freeze({ entry: 'src/scripts/_lib/egress_engine.ts', outfile: 'dist/hooks/egress_engine.chunk.cjs' }),
+    // Required by `reread-guard` on a file write or a bound shell act alone
+    // (`reference_duty_loader.ts`). `yaml` stays external, as at `chat_history`:
+    // the bundle already carries it and `dist/hooks/` resolves it in any install.
+    Object.freeze({
+        entry: 'src/scripts/_lib/reference_duty.ts',
+        outfile: 'dist/hooks/reference_duty.chunk.cjs',
+        external: Object.freeze(['yaml']),
+    }),
     // Required by `design-pass` on a UI write alone (`design_consistency_loader.ts`).
     Object.freeze({
         entry: 'src/scripts/_lib/design_consistency_pass.ts',
diff --git a/src/scripts/hooks/reference_duty_loader.ts b/src/scripts/hooks/reference_duty_loader.ts
new file mode 100644
index 0000000000..dd78373e50
--- /dev/null
+++ b/src/scripts/hooks/reference_duty_loader.ts
@@ -0,0 +1,68 @@
+/**
+ * Loads the reference-duty logic for `reread-guard`: from its conditional chunk
+ * beside the dispatch bundle when bundled, from the source module otherwise. The
+ * duty runs on file writes and on bound shell acts only, so the router walk, the
+ * frontmatter parse and the shell recogniser stay out of the bytes every hook
+ * event loads. A failed load is counted by the hook as a duty error.
+ */
+import { createRequire } from 'node:module';
+import * as path from 'node:path';
+import { fileURLToPath } from 'node:url';
+
+import type * as Duty from '../_lib/reference_duty.js';
+import { verifyBundle } from './bundle_integrity.js';
+
+export type ReferenceDuty = Pick<typeof Duty, 'scanDuties' | 'scanActDuties' | 'dutyStates'>;
+
+export const REFERENCE_DUTY_CHUNK = 'reference_duty.chunk.cjs';
+export const EXPECTED_REFERENCE_DUTY_SCHEMA = 1;
+
+/**
+ * Words at least one of which every bound shell act contains. A Bash command
+ * holding none of them cannot run a bound act, so the chunk is not loaded for
+ * it; a test holds this in step with `src/config/act-references.json`.
+ */
+export const ACT_WORDS = /\b(?:commit|push|pr)\b/;
+
+declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
+
+function isBundled(): boolean {
+    return typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__;
+}
+
+function sourceRequire(req: NodeJS.Require): (id: string, from: string) => unknown {
+    try {
+        const api = req(['tsx', 'cjs', 'api'].join('/')) as { require?: (id: string, from: string) => unknown };
+        if (typeof api.require === 'function') return api.require;
+    } catch {
+        // tsx absent: a plain require is the only reader left.
+    }
+    return (id: string) => req(id);
+}
+
+let cached: ReferenceDuty | null | undefined;
+
+export function loadReferenceDuty(selfUrl: string = import.meta.url, bundled: boolean = isBundled()): ReferenceDuty | null {
+    if (cached !== undefined) return cached;
+    cached = null;
+    try {
+        const self = fileURLToPath(selfUrl);
+        const dir = path.dirname(self);
+        const req = createRequire(selfUrl);
+        let mod: Record<string, unknown>;
+        if (bundled) {
+            const specifier = path.join(dir, REFERENCE_DUTY_CHUNK);
+            if (verifyBundle(specifier).state === 'mismatch') return null;
+            mod = req(specifier) as Record<string, unknown>;
+        } else {
+            const ext = self.endsWith('.ts') ? '.ts' : '.js';
+            mod = sourceRequire(req)(path.join(dir, '..', '_lib', `reference_duty${ext}`), self) as Record<string, unknown>;
+        }
+        if (mod['REFERENCE_DUTY_SCHEMA'] !== EXPECTED_REFERENCE_DUTY_SCHEMA) return null;
+        for (const name of ['scanDuties', 'scanActDuties', 'dutyStates']) if (typeof mod[name] !== 'function') return null;
+        cached = mod as unknown as ReferenceDuty;
+    } catch {
+        cached = null;
+    }
+    return cached;
+}
diff --git a/src/scripts/hooks/reread_guard_hook.ts b/src/scripts/hooks/reread_guard_hook.ts
index 5086fc1d17..9c7e354c2d 100644
--- a/src/scripts/hooks/reread_guard_hook.ts
+++ b/src/scripts/hooks/reread_guard_hook.ts
@@ -78,7 +78,9 @@ import { unwrap, type JsonObject, type JsonValue } from './envelope.js';
 import { readHookStdin } from './hook_stdin.js';
 import { atomic_write_json } from './state_io.js';
 import { EXIT_ALLOW, EXIT_WARN } from './exit_codes.js';
-import { dutyStates, ledgerKey, scanDuties, type DutyState } from '../_lib/reference_duty.js';
+import { ledgerKey } from '../_lib/ledger_key.js';
+import type { DutyScan, DutyState } from '../_lib/reference_duty.js';
+import { ACT_WORDS, loadReferenceDuty } from './reference_duty_loader.js';
 
 // Severity is taken from the EXIT CODE, not from the `decision` field — see
 // the file header for why this never blocks on `claude`. This concern never
@@ -339,13 +341,46 @@ export interface DutyRecord {
     ts: number;
 }
 
+/** The duty a bound shell act makes due; the command itself is never stored. */
+function recordActDuty(envelope: JsonObject, payload: JsonObject, command: string): void {
+    if (!ACT_WORDS.test(command)) return;
+    const workspaceRoot = str(envelope['workspace_root'] as JsonValue | undefined).trim() || process.cwd();
+    const duty = loadReferenceDuty();
+    let scan: DutyScan;
+    try {
+        if (duty === null) throw new Error('reference duty unavailable');
+        scan = duty.scanActDuties(command, workspaceRoot);
+    } catch {
+        scan = { duties: [], errors: ['act scan failed'] };
+    }
+    if (scan.duties.length === 0 && scan.errors.length === 0) return;
+    const sessionKey = deriveSessionKey(envelope, payload);
+    const ledger = readLedger(workspaceRoot, sessionKey);
+    applyScan(ledger, scan, workspaceRoot);
+    writeLedger(workspaceRoot, sessionKey, ledger);
+}
+
 function recordDuty(ledger: Ledger, key: string, workspaceRoot: string): void {
+    let scan: DutyScan;
+    try {
+        const duty = loadReferenceDuty();
+        if (duty === null) throw new Error('reference duty unavailable');
+        scan = duty.scanDuties(key, workspaceRoot);
+    } catch {
+        ledger.duty_errors = (ledger.duty_errors ?? 0) + 1;
+        return;
+    }
+    applyScan(ledger, scan, workspaceRoot);
+}
+
+function applyScan(ledger: Ledger, scan: DutyScan, workspaceRoot: string): void {
     let states: Record<string, DutyState>;
     try {
-        const scan = scanDuties(key, workspaceRoot);
         // Each matched rule whose duties could not be read is one unobserved duty.
         if (scan.errors.length > 0) ledger.duty_errors = (ledger.duty_errors ?? 0) + scan.errors.length;
-        states = dutyStates(scan.duties, ledger.reads, workspaceRoot);
+        const duty = loadReferenceDuty();
+        if (duty === null) throw new Error('reference duty unavailable');
+        states = duty.dutyStates(scan.duties, ledger.reads, workspaceRoot);
     } catch {
         ledger.duty_errors = (ledger.duty_errors ?? 0) + 1;
         return;
@@ -469,6 +504,10 @@ export function main(): number {
 
         const toolName = extractToolName(payload);
         const toolInput = extractToolInput(payload);
+        if (toolName === 'Bash') {
+            recordActDuty(envelope, payload, str(toolInput['command']));
+            return EXIT_ALLOW;
+        }
         const isRead = READ_TOOLS.has(toolName);
         const isWrite = WRITE_TOOLS.has(toolName);
         if (!isRead && !isWrite) return EXIT_ALLOW;
diff --git a/src/scripts/rule_reference_requires.ts b/src/scripts/rule_reference_requires.ts
index 0662fe9b95..f6b83b2cdd 100644
--- a/src/scripts/rule_reference_requires.ts
+++ b/src/scripts/rule_reference_requires.ts
@@ -3,7 +3,8 @@
  * rule frontmatter alone.
  *
  * An act is a trigger that names something the agent does rather than something
- * it says: `path_prefix`, `file_pattern`, `command`. A keyword or phrase trigger
+ * it says: `path_prefix`, `file_pattern`, `command`, or a `shell_command` bound in
+ * `src/config/act-references.json`. A keyword or phrase trigger
  * names a prompt, so a rule whose references hang only on those is reachable by
  * no act and is listed under `no_act` instead of being dropped.
  *
@@ -21,12 +22,13 @@ import * as fs from 'node:fs';
 import * as path from 'node:path';
 import { fileURLToPath, pathToFileURL } from 'node:url';
 
+import actReferences from '../config/act-references.json';
 import { parseFrontmatter } from './preamble_byte_census.js';
 
 /** Mirrors `COMPOSED_CHARS` in `hooks/rule_inject_hook.ts`; a test holds them equal. */
 export const INJECT_BUDGET_CHARS = 8000;
 
-const ACT_KINDS = ['path_prefix', 'file_pattern', 'command'] as const;
+const ACT_KINDS = ['path_prefix', 'file_pattern', 'command', 'shell_command'] as const;
 type ActKind = (typeof ACT_KINDS)[number];
 
 export interface Reference {
@@ -61,7 +63,21 @@ function reference(rel: string, contextsRoot: string): Reference {
     return { path: rel, chars, status: chars > INJECT_BUDGET_CHARS ? 'omitted-budget' : 'fits' };
 }
 
-export function buildRequiresTable(rulesDir: string, contextsRoot: string): RequiresTable {
+export interface ActBinding {
+    shell_command: string;
+    rules: string[];
+}
+
+/**
+ * The requires table. `shell_command` rows come from `src/config/act-references.json`,
+ * which binds a shell act to rule ids (kernel rules included — it is not a router
+ * trigger); the references themselves are still each rule's own `load_context`.
+ */
+export function buildRequiresTable(
+    rulesDir: string,
+    contextsRoot: string,
+    bindings: readonly ActBinding[] = actReferences.bindings,
+): RequiresTable {
     const rows: RequiresRow[] = [];
     const no_act: string[] = [];
     const acts_by_kind: Partial<Record<ActKind, number>> = {};
@@ -80,6 +96,12 @@ export function buildRequiresTable(rulesDir: string, contextsRoot: string): Requ
         const marking: RequiresRow['marking'] = typeof fm['consequence_class'] === 'string' ? 'required' : fm['type'] === 'manual' ? 'informational' : 'conditional';
         const triggers = Array.isArray(fm['triggers']) ? (fm['triggers'] as unknown[]) : [];
         let acts = 0;
+        for (const b of bindings) {
+            if (!b.rules.includes(rule)) continue;
+            rows.push({ rule, act: { kind: 'shell_command', value: b.shell_command }, marking, references });
+            acts_by_kind.shell_command = (acts_by_kind.shell_command ?? 0) + 1;
+            acts += 1;
+        }
         for (const t of triggers) {
             if (typeof t !== 'object' || t === null) continue;
             for (const kind of ACT_KINDS) {
```
