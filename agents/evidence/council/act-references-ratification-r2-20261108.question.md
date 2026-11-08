<!-- evidence-type: analysis -->

# Ratification review — act-time reference duty in a conditional chunk — round 2

You are an independent reviewer for a change in the `event4u/agent-config` repository. One file in it, `src/config/hook-bundle-budget.json`, is on the ratification gate's list (the hook bundle's byte budget), so the change needs a two-provider verdict under ADR-268 § 4.

subject: eb5786e836f220aff90f74eaf2f272e0db07cc0cf151420f51fadd1cde9aefae

(The digest covers the gated file at commit `8c7d80b795`, computed with `./scripts-run src/scripts/ratification_subject`.)

## What the change does

- **Act-reference table** `src/config/act-references.json` binds `git commit` → `commit-policy`, `git push` → `non-destructive-by-default` + `scope-control`, `gh pr create` → `scope-control`. Rule ids only, each with an owner; references come from each rule's own `load_context`. Chosen by council design round 2 (option B) over kernel frontmatter, which the rule schema forbids for router triggers. A test validates every binding (keys, owner, rule exists and has `load_context`).
- **Recogniser** `src/scripts/_lib/shell_acts.ts`: heredoc bodies dropped, segments split on `;` `&&` `||` `|` newline outside quotes, env assignments / `sudo` etc. stripped, `git -C`/`-c` skipped. Spike over 14,834 real agent Bash calls: ≤ 0.1 % misses; a prefix match finds 17 % (`agents/evidence/analysis/shell-command-recognition-spike-2026-11-08.md`).
- **Observation** in the existing `reread-guard` concern (already bound on claude `pre_tool_use` for Bash; no binding change): a Bash command containing a bound act word records each bound rule's references as `read` / `required-pending` in the session ledger, observe-only. The raw command is never stored. A bound rule that cannot be read counts as `duty_errors`.
- **Conditional chunk:** the duty logic (router walk, frontmatter parse, table, recogniser) moved out of the dispatch bundle into `dist/hooks/reference_duty.chunk.cjs` (15,080 B, ceiling 16,600 B registered in the gated file). It loads only on a file write or a Bash command matching `ACT_WORDS` (a test keeps that in step with the table). The bundle drops to 1,582,460 B (ceiling 1,585,000; it would have been 1,588,246 B with the logic inline). A missing or mis-digested chunk makes the hook count a duty error and observe nothing; the read ledger and advisories are unaffected. `ledgerKey` moved to `_lib/ledger_key.ts`, which stays in the bundle.

## Round 1 and what changed

Round 1: anthropic `refused`, openai `refused` — both on recogniser correctness and failure exposure. Round 2:

- **Recogniser rewritten as a one-pass lexer** (`simpleCommands`): single/double quotes, backslash escapes, `#` comments, line continuations, separators outside quotes, heredoc operator only outside quotes (body dropped to its terminator). `git -C`/`-c` values are skipped as lexed words, so `git -C "my repo" commit` is recognised. Matrix: 13 recognised forms including `git -C "my repo" commit`, `git -C 'my repo' push`, `git commit -m x # done`, `echo '<<EOF'; git commit`; 11 rejected forms including `echo hello\; git push`, `echo x # ; git push`, `echo "a; git push"`, `echo 'git commit -m x'`, `git -C "dir; git push" status`. The four forms round 1 named failed before the rewrite.
- **Re-measured on the spike corpus** (now 14,931 commands): 999 `git commit`, 508 `git push`, 129 `gh pr create`; every command holding the literal text without being recognised was read — all are text in heredocs or strings, or `git commit-tree`.
- **A match is a potential act**: the header says so — invoked, not necessarily succeeded.
- **Double count fixed:** a failed duty load counts one `duty_errors`; the duty object is passed through, not reloaded (`_recordActDutyWith`, tested).
- **Failure path:** the loader executes a bundled chunk only when its digest sidecar verifies `ok` (was: anything but `mismatch`); a missing chunk returns null (tested), and the hook counts one error and observes nothing. The read ledger and the guard's advisories do not depend on the chunk.
- File-write duty logic stays in the chunk: it was observe-only before and remains so; its only failure mode is a counted error.
- Chunk measured 16,523 B; its ceiling in the gated file is 18,200 B (+10 %).

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

## The diff (`git diff origin/main...feat/act-references`, source and config, plus the recogniser tests)

```diff
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
index c7f03a2ec7..a3a260d655 100644
--- a/src/config/hook-bundle-budget.json
+++ b/src/config/hook-bundle-budget.json
@@ -276,6 +276,12 @@
             "max_bytes": 61600,
             "registered_at": "2026-11-04",
             "derivation": "Measured 55,991 bytes on 2026-11-04 for the roadmap agents/roadmaps/archive/road-to-a-noted-that-is-a-write.md. The chunk holds the self-repair concern, its four detectors including persistence-claim, the record store with the target and subject indexes, and the Class-A telemetry shadow (emitDefectShadow: a structural-fields-only copy of a queued record for the org telemetry pack, inert unless that pack activated telemetry); `yaml` is external, resolved from the installed package as for the chat_history, update_notice and star_ask chunks. The ceiling is that reading plus about 10 %, rounded, the same margin as the quota_notice and intake_pass rows. The margin approves no planned code: a later addition to the chunk is measured and reviewed on its own change. WHY IT WAS MOVED: the dispatch bundle sat 14 bytes under its 1,582,000 ceiling at origin/main b53718de2 (measured 1,581,986 B by this gate with APFS-cloned node_modules), and the roadmap's detector work had to land somewhere. The concern built alone was 51,156 bytes before the work; moving it out, as the 2026-10-18 council chose for this situation, took the dispatch bundle to 1,557,293 B (-24,693 B, the rest being modules other concerns still import) instead of raising the dispatch ceiling. Bound on `user_prompt_submit` and `stop`; the bundle carries only its LAZY_CONCERNS row. A missing or mis-digested chunk falls back to spawning the same script, which is slower; tests/hooks/self_repair_lazy_paths.test.ts pins that the loader path and the spawn fallback write the same record, and that the built dispatcher falls back to the spawn exactly once with the chunk missing. On either path a failure of the concern does not reject the hook event (`fail_closed: false`, unchanged by this move); the dispatcher still writes that run's exit code to agents/runtime/state/.dispatcher/<session>/self-repair.json, which is where a failing concern is visible."
+        },
+        {
+            "entry": "src/scripts/_lib/reference_duty.ts",
+            "max_bytes": 18200,
+            "registered_at": "2026-11-08",
+            "derivation": "Measured 16,523 bytes on 2026-11-08 (15,080 before ratification round 1 replaced the segmenter with a quote-, escape-, comment- and heredoc-aware lexer) for road-to-a-reference-that-arrives-before-the-act. The chunk holds the reference duty: the router walk with trigger_matches, the rule-frontmatter parse, the act-reference table and the shell-act recogniser; `yaml` is external, resolved from the installed package as for the chat_history chunk. The ceiling is that reading plus about 10 %, rounded, the margin of the quota_notice, intake_pass and self_repair rows. WHY IT IS A CHUNK: adding the act-time duty in the dispatch bundle measured 1,588,246 B against the 1,585,000 B ceiling (real node_modules install); the duty runs only on a file write or on a Bash command containing a bound act word (`reference_duty_loader.ACT_WORDS`), so it does not belong in the bytes every hook event loads. The bundle keeps the loader, the act-word pre-check and `_lib/ledger_key.ts`. A missing or mis-digested chunk makes the hook count a duty error instead of observing; the guard's read ledger and advisories are unaffected."
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
index 0000000000..9c5a0e117f
--- /dev/null
+++ b/src/scripts/_lib/shell_acts.ts
@@ -0,0 +1,144 @@
+/**
+ * Whether an agent's Bash command runs a given shell act (`git commit`, …).
+ *
+ * Agents chain: a prefix match finds 17 % of commits in real transcripts, so the
+ * command is lexed into simple commands of words. One pass honours single and
+ * double quotes, backslash escapes, `#` comments, line continuations, and the
+ * separators `;` `&&` `||` `|` and newline outside quotes; a heredoc operator
+ * outside quotes drops the body up to its terminator line. Per command, leading
+ * `VAR=…` assignments and `sudo`/`command`/`time`/`exec`/`nohup` are dropped and
+ * `git -C <dir>` / `git -c k=v` are skipped, quoted values included.
+ *
+ * A match is a potential act: it was invoked, which does not mean it succeeded.
+ * Not recognised, by design: commands built at runtime (`eval`, `$CMD`), aliases
+ * and shell functions, wrappers that run git themselves, and `bash -c "…"`. A
+ * recognised act is a fact about the command; an unrecognised one is no evidence
+ * that none ran.
+ */
+
+const PREFIX_WORDS = new Set(['sudo', 'command', 'time', 'exec', 'nohup']);
+
+/** The command's simple commands, each as its words with quotes removed. */
+export function simpleCommands(command: string): string[][] {
+    const out: string[][] = [];
+    let words: string[] = [];
+    let word = '';
+    let inWord = false;
+    let pendingHeredoc: string | null = null;
+    const endWord = (): void => {
+        if (inWord) words.push(word);
+        word = '';
+        inWord = false;
+    };
+    const endCommand = (): void => {
+        endWord();
+        if (words.length > 0) out.push(words);
+        words = [];
+    };
+    const n = command.length;
+    let i = 0;
+    while (i < n) {
+        const ch = command[i] as string;
+        if (ch === '\\') {
+            if (command[i + 1] === '\n') {
+                i += 2;
+                continue;
+            }
+            word += command[i + 1] ?? '';
+            inWord = true;
+            i += 2;
+            continue;
+        }
+        if (ch === "'") {
+            const close = command.indexOf("'", i + 1);
+            const end = close === -1 ? n : close;
+            word += command.slice(i + 1, end);
+            inWord = true;
+            i = end + 1;
+            continue;
+        }
+        if (ch === '"') {
+            i += 1;
+            while (i < n && command[i] !== '"') {
+                if (command[i] === '\\' && i + 1 < n) {
+                    word += command[i + 1];
+                    i += 2;
+                    continue;
+                }
+                word += command[i];
+                i += 1;
+            }
+            inWord = true;
+            i += 1;
+            continue;
+        }
+        if (ch === '#' && !inWord) {
+            while (i < n && command[i] !== '\n') i += 1;
+            continue;
+        }
+        if (ch === '<' && command[i + 1] === '<' && command[i + 2] !== '<') {
+            endWord();
+            let j = i + 2;
+            if (command[j] === '-') j += 1;
+            while (command[j] === ' ' || command[j] === '\t') j += 1;
+            const m = /^['"]?([A-Za-z_][A-Za-z0-9_]*)['"]?/.exec(command.slice(j));
+            if (m) {
+                pendingHeredoc = m[1] as string;
+                i = j + m[0].length;
+                continue;
+            }
+            i += 2;
+            continue;
+        }
+        if (ch === '\n') {
+            endCommand();
+            i += 1;
+            if (pendingHeredoc !== null) {
+                const tag = pendingHeredoc;
+                pendingHeredoc = null;
+                while (i < n) {
+                    const eol = command.indexOf('\n', i);
+                    const line = command.slice(i, eol === -1 ? n : eol);
+                    i = eol === -1 ? n : eol + 1;
+                    if (line.trim() === tag) break;
+                }
+            }
+            continue;
+        }
+        if (ch === ';' || ch === '|' || (ch === '&' && command[i + 1] === '&')) {
+            endCommand();
+            i += (ch === '&' || (ch === '|' && command[i + 1] === '|')) ? 2 : 1;
+            continue;
+        }
+        if (ch === ' ' || ch === '\t') {
+            endWord();
+            i += 1;
+            continue;
+        }
+        word += ch;
+        inWord = true;
+        i += 1;
+    }
+    endCommand();
+    return out;
+}
+
+function normalise(words: readonly string[]): string[] {
+    let t = [...words];
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
+    return simpleCommands(command).some((words) => {
+        const w = normalise(words);
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
index 0000000000..87434d6104
--- /dev/null
+++ b/src/scripts/hooks/reference_duty_loader.ts
@@ -0,0 +1,74 @@
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
+            // Only a chunk whose digest sidecar verifies is executed.
+            if (verifyBundle(specifier).state !== 'ok') return null;
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
+
+/** Test seam: forget the cached load. Never called by the hook path. */
+export function _resetReferenceDutyCache(): void {
+    cached = undefined;
+}
diff --git a/src/scripts/hooks/reread_guard_hook.ts b/src/scripts/hooks/reread_guard_hook.ts
index 5086fc1d17..828705b274 100644
--- a/src/scripts/hooks/reread_guard_hook.ts
+++ b/src/scripts/hooks/reread_guard_hook.ts
@@ -78,7 +78,9 @@ import { unwrap, type JsonObject, type JsonValue } from './envelope.js';
 import { readHookStdin } from './hook_stdin.js';
 import { atomic_write_json } from './state_io.js';
 import { EXIT_ALLOW, EXIT_WARN } from './exit_codes.js';
-import { dutyStates, ledgerKey, scanDuties, type DutyState } from '../_lib/reference_duty.js';
+import { ledgerKey } from '../_lib/ledger_key.js';
+import type { DutyScan, DutyState } from '../_lib/reference_duty.js';
+import { ACT_WORDS, loadReferenceDuty, type ReferenceDuty } from './reference_duty_loader.js';
 
 // Severity is taken from the EXIT CODE, not from the `decision` field — see
 // the file header for why this never blocks on `claude`. This concern never
@@ -339,13 +341,55 @@ export interface DutyRecord {
     ts: number;
 }
 
+/** The duty a bound shell act makes due; the command itself is never stored. */
+function recordActDuty(envelope: JsonObject, payload: JsonObject, command: string): void {
+    if (!ACT_WORDS.test(command)) return;
+    const workspaceRoot = str(envelope['workspace_root'] as JsonValue | undefined).trim() || process.cwd();
+    const sessionKey = deriveSessionKey(envelope, payload);
+    const ledger = readLedger(workspaceRoot, sessionKey);
+    if (_recordActDutyWith(ledger, command, workspaceRoot, loadReferenceDuty())) writeLedger(workspaceRoot, sessionKey, ledger);
+}
+
+/** True when the ledger changed. Exported as a testing seam. */
+export function _recordActDutyWith(ledger: Ledger, command: string, workspaceRoot: string, duty: ReferenceDuty | null): boolean {
+    if (duty === null) {
+        ledger.duty_errors = (ledger.duty_errors ?? 0) + 1;
+        return true;
+    }
+    let scan: DutyScan;
+    try {
+        scan = duty.scanActDuties(command, workspaceRoot);
+    } catch {
+        ledger.duty_errors = (ledger.duty_errors ?? 0) + 1;
+        return true;
+    }
+    if (scan.duties.length === 0 && scan.errors.length === 0) return false;
+    applyScan(ledger, scan, workspaceRoot, duty);
+    return true;
+}
+
 function recordDuty(ledger: Ledger, key: string, workspaceRoot: string): void {
+    const duty = loadReferenceDuty();
+    if (duty === null) {
+        ledger.duty_errors = (ledger.duty_errors ?? 0) + 1;
+        return;
+    }
+    let scan: DutyScan;
+    try {
+        scan = duty.scanDuties(key, workspaceRoot);
+    } catch {
+        ledger.duty_errors = (ledger.duty_errors ?? 0) + 1;
+        return;
+    }
+    applyScan(ledger, scan, workspaceRoot, duty);
+}
+
+function applyScan(ledger: Ledger, scan: DutyScan, workspaceRoot: string, duty: ReferenceDuty): void {
     let states: Record<string, DutyState>;
     try {
-        const scan = scanDuties(key, workspaceRoot);
         // Each matched rule whose duties could not be read is one unobserved duty.
         if (scan.errors.length > 0) ledger.duty_errors = (ledger.duty_errors ?? 0) + scan.errors.length;
-        states = dutyStates(scan.duties, ledger.reads, workspaceRoot);
+        states = duty.dutyStates(scan.duties, ledger.reads, workspaceRoot);
     } catch {
         ledger.duty_errors = (ledger.duty_errors ?? 0) + 1;
         return;
@@ -469,6 +513,10 @@ export function main(): number {
 
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
diff --git a/tests/scripts/shell_acts.test.ts b/tests/scripts/shell_acts.test.ts
new file mode 100644
index 0000000000..74a26372e1
--- /dev/null
+++ b/tests/scripts/shell_acts.test.ts
@@ -0,0 +1,42 @@
+/**
+ * Recognising a shell act inside an agent's Bash command — the recogniser the
+ * 2026-11-08 spike measured at <= 0.1 % misses over 14,834 real calls.
+ */
+import { describe, expect, it } from 'vitest';
+
+import { commandRunsAct } from '../../src/scripts/_lib/shell_acts.js';
+
+describe('commandRunsAct', () => {
+    it.each([
+        ['git commit -m "x"', 'git commit'],
+        ['git add a && git commit -q -m "x"', 'git commit'],
+        ['cd /w && git -C /w commit -m x', 'git commit'],
+        ['GIT_AUTHOR_NAME=a git commit -m x', 'git commit'],
+        ['git -c user.name=x commit', 'git commit'],
+        ['npm test; git push origin HEAD', 'git push'],
+        ['true || gh pr create --title t', 'gh pr create'],
+        ["cat > f <<'EOF'\nit's prose\nEOF\ngit commit -m done", 'git commit'],
+        ['git -C "my repo" commit -m x', 'git commit'],
+        ["git -C 'my repo' push", 'git push'],
+        ['git commit -m x # done', 'git commit'],
+        ["echo '<<EOF'; git commit -m x", 'git commit'],
+        ['make && \\\n  git push', 'git push'],
+    ])('recognises %j as %s', (cmd, act) => {
+        expect(commandRunsAct(cmd, act)).toBe(true);
+    });
+    it.each([
+        ['echo "git commit"', 'git commit'],
+        ["cat > notes.md <<'EOF'\nthen run git commit\nEOF", 'git commit'],
+        ['git commit-tree abc', 'git commit'],
+        ['git log --grep commit', 'git commit'],
+        ['gh pr view 1', 'gh pr create'],
+        ['git pushx', 'git push'],
+        ['echo hello\\; git push', 'git push'],
+        ['echo x # ; git push', 'git push'],
+        ['echo "a; git push"', 'git push'],
+        ["echo 'git commit -m x'", 'git commit'],
+        ['git -C "dir; git push" status', 'git push'],
+    ])('does not take %j for %s', (cmd, act) => {
+        expect(commandRunsAct(cmd, act)).toBe(false);
+    });
+});
```
