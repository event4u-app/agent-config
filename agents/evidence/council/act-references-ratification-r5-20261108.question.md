<!-- evidence-type: analysis -->

# Ratification review — act-time reference duty in a conditional chunk — round 5

You are an independent reviewer for a change in the `event4u/agent-config` repository. One file in it, `src/config/hook-bundle-budget.json`, is on the ratification gate's list (the hook bundle's byte budget), so the change needs a two-provider verdict under ADR-268 § 4.

subject: 7e56c954ef527ad2214948ff8caf1f3abbf43a1da5ac4b88e2e4fda3ab9c7f8a

(The digest covers the gated file at commit `308dcfa408`, computed with `./scripts-run src/scripts/ratification_subject`.)

## What the change does

- **Act-reference table** `src/config/act-references.json` binds `git commit` → `commit-policy`, `git push` → `non-destructive-by-default` + `scope-control`, `gh pr create` → `scope-control`. Rule ids only, each with an owner; references come from each rule's own `load_context`. Chosen by council design round 2 (option B) over kernel frontmatter, which the rule schema forbids for router triggers. A test validates every binding (keys, owner, rule exists and has `load_context`).
- **Recogniser** `src/scripts/_lib/shell_acts.ts`: heredoc bodies dropped, segments split on `;` `&&` `||` `|` newline outside quotes, env assignments / `sudo` etc. stripped, `git -C`/`-c` skipped. Spike over 14,834 real agent Bash calls: ≤ 0.1 % misses; a prefix match finds 17 % (`agents/evidence/analysis/shell-command-recognition-spike-2026-11-08.md`).
- **Observation** in the existing `reread-guard` concern (already bound on claude `pre_tool_use` for Bash; no binding change): a Bash command containing a bound act word records each bound rule's references as `read` / `required-pending` in the session ledger, observe-only. The raw command is never stored. A bound rule that cannot be read counts as `duty_errors`.
- **Conditional chunk:** the duty logic (router walk, frontmatter parse, table, recogniser) moved out of the dispatch bundle into `dist/hooks/reference_duty.chunk.cjs` (15,080 B, ceiling 16,600 B registered in the gated file). It loads only on a file write or a Bash command matching `ACT_WORDS` (a test keeps that in step with the table). The bundle drops to 1,582,460 B (ceiling 1,585,000; it would have been 1,588,246 B with the logic inline). A missing or mis-digested chunk makes the hook count a duty error and observe nothing; the read ledger and advisories are unaffected. `ledgerKey` moved to `_lib/ledger_key.ts`, which stays in the bundle.

## Round 4 and what changed

Round 4: anthropic `refused` (no dealbreaker), openai `refused` (dealbreaker) — heredoc terminators with escapes or empty, quoted assignment prefixes, and an oracle fixture that lost its backslash. Round 5:

- **One quote reader** (`readQuoted`) is shared by ordinary words and heredoc terminators, so the two cannot diverge: `<<"A\\B"` ends at the line `A\B`, `<<'A\B'` likewise, and a quoted empty terminator (`<<''`, `<<""`) is valid and ends at the empty line.
- **Assignment words carry their quoting.** A word is an assignment prefix only when its `NAME=` lies in its leading unquoted, unescaped run: `'X=1' git push`, `"X"=1 git push` and `X\=1 git push` run a command named `X=1` (bash agrees), `X="a b" git push` is still a push. `normalise` walks an index instead of re-slicing the array.
- **The oracle states what each case runs.** Every case carries its expected act set; bash must produce exactly that set and so must the recogniser, so false positives are checked as well as misses. Bash runs each case twice — `true` succeeding and `true` failing — and the union is compared, so `&&` and `||` branches are both reachable; a bash that does not finish fails the test. The escaped-separator fixture is now `'echo hello\\; git push'` (expected: no act). 37 cases; the 6 round-4 counterexamples fail on the round-4 lexer and pass now.
- **Table:** each shell command bound once, each binding with distinct, non-empty rules (test).
- **Pre-check against the lexer:** for every bound act, a backslash, `''`, `""` or a line continuation inserted at every position of its last word, plus a partly double-quoted form: the lexer must recognise the act and `actWordsMayMatch` must let it through (test, 75 cases).
- **File-write duty under a missing chunk:** `_recordDutyWith(ledger, key, root, null)` counts exactly one `duty_errors` and leaves reads, writes and advisory bookkeeping unchanged (test). The packaged-load half — a missing or mis-digested chunk returns `null` — was already tested.
- Chunk 17,603 B against the unchanged 18,200 B ceiling; the gated derivation now states that reading and that the margin shrank to about 3 %. Bundle 1,582,782 B.
- **Not added, with reasons.** A kill switch: emptying `bindings` disables act observation without touching file-write observation, and the whole change reverts as one commit; observation is advisory and blocks nothing. Production telemetry: `duty_errors` is the counted failure signal in every session ledger; an alerting threshold is outside this change. `ledgerKey` is a key normaliser, not a containment boundary — round 4 was right about that, and the description does not claim otherwise.

## Rounds 1–3

Rounds 1–3 refused on lexer gaps (separators, comments, `git -C` values, heredoc terminators, line continuations, double-quote escapes) and on a pre-check that could reject what the lexer accepts; each was fixed with a test seen red first. Their questions are committed beside this one (`act-references-ratification-r1..r4-20261108.question.md`).

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

## The diff (`git diff origin/main...feat/act-references` for the files below; unchanged since round 4 and omitted: `_lib/ledger_key.ts` (moved `ledgerKey`), `hook_chunks.mjs` (one chunk entry), `rule_reference_requires.ts` (adds `shell_command` rows), the bench corpus under `internal/`)

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
index c7f03a2ec7..29141481bf 100644
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
+            "derivation": "Registered at 16,523 bytes on 2026-11-08 (15,080 before ratification round 1 replaced the segmenter with a quote-, escape-, comment- and heredoc-aware lexer); re-measured 17,603 bytes after ratification round 4 (one quote reader shared by words and heredoc terminators, assignment words carrying their quoting), the ceiling unchanged, so the margin is now about 3 %, not 10 % for road-to-a-reference-that-arrives-before-the-act. The chunk holds the reference duty: the router walk with trigger_matches, the rule-frontmatter parse, the act-reference table and the shell-act recogniser; `yaml` is external, resolved from the installed package as for the chat_history chunk. The ceiling was the registered reading plus about 10 %, rounded, the margin of the quota_notice, intake_pass and self_repair rows. WHY IT IS A CHUNK: adding the act-time duty in the dispatch bundle measured 1,588,246 B against the 1,585,000 B ceiling (real node_modules install); the duty runs only on a file write or on a Bash command containing a bound act word (`reference_duty_loader.ACT_WORDS`), so it does not belong in the bytes every hook event loads. The bundle keeps the loader, the act-word pre-check and `_lib/ledger_key.ts`. A missing or mis-digested chunk makes the hook count a duty error instead of observing; the guard's read ledger and advisories are unaffected."
         }
     ],
     "chunks_note": "A chunk is loaded only when a caller needs it, so its bytes are not paid by every dispatch; its ceiling exists so that the move out of dispatch.js stays a measured place rather than an unmeasured one. The gate builds each chunk with the exact esbuild segment `build:hook-chunks` uses for its entry.",
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
index 0000000000..45afa897dc
--- /dev/null
+++ b/src/scripts/_lib/shell_acts.ts
@@ -0,0 +1,213 @@
+/**
+ * Whether an agent's Bash command runs a given shell act (`git commit`, …).
+ *
+ * Agents chain: a prefix match finds 17 % of commits in real transcripts, so the
+ * command is lexed into simple commands of words. One pass honours single and
+ * double quotes, backslash escapes, `#` comments, line continuations, and the
+ * separators `;` `&&` `||` `|` `&` and newline outside quotes. A heredoc operator
+ * outside quotes queues its terminator (one word after quote removal, read by the
+ * same quote reader as every other word, and empty when quoted as `''`); the
+ * bodies follow the line in order, each ending at the line that is exactly its
+ * terminator (leading tabs stripped for `<<-`).
+ *
+ * Supported syntax contract: the above, plus `VAR=…` prefixes, `sudo`/`command`/
+ * `time`/`exec`/`nohup`, and `git -C`/`-c` values. An assignment prefix is only one
+ * whose `NAME=` is unquoted: `'X=1' git push` runs a command named `X=1`. Not interpreted: `$(…)` and
+ * backticks (their text stays inside the word), subshell parentheses, `eval`,
+ * aliases, functions, `bash -c` strings. Per command, leading
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
+/** One word after quote removal. `assign` holds when it opens with an unquoted `NAME=`. */
+interface Word {
+    text: string;
+    assign: boolean;
+}
+
+/**
+ * The quoted run that starts at `i` (a `'` or `"`), quotes removed, and the index
+ * after its closing quote. Inside double quotes a backslash escapes only
+ * $ ` " \ and newline; before anything else it stays a literal backslash.
+ * Shared by words and heredoc terminators, so the two cannot diverge.
+ */
+function readQuoted(s: string, i: number): { text: string; end: number } {
+    const q = s[i];
+    const n = s.length;
+    if (q === "'") {
+        const close = s.indexOf("'", i + 1);
+        const end = close === -1 ? n : close;
+        return { text: s.slice(i + 1, end), end: end + 1 };
+    }
+    let text = '';
+    let j = i + 1;
+    while (j < n && s[j] !== '"') {
+        if (s[j] === '\\' && j + 1 < n && '$`"\\\n'.includes(s[j + 1] as string)) {
+            if (s[j + 1] !== '\n') text += s[j + 1];
+            j += 2;
+            continue;
+        }
+        text += s[j];
+        j += 1;
+    }
+    return { text, end: j + 1 };
+}
+
+function lexCommands(command: string): Word[][] {
+    const out: Word[][] = [];
+    let words: Word[] = [];
+    let word = '';
+    let inWord = false;
+    // Length of the word's leading unquoted, unescaped run; -1 while no quote or
+    // escape has occurred in it. An assignment's `NAME=` must fit inside that run.
+    let literal = -1;
+    const pendingHeredocs: Array<{ tag: string; stripTabs: boolean }> = [];
+    const endWord = (): void => {
+        if (inWord) {
+            const m = /^[A-Za-z_][A-Za-z0-9_]*=/.exec(word);
+            const limit = literal === -1 ? word.length : literal;
+            words.push({ text: word, assign: m !== null && m[0].length <= limit });
+        }
+        word = '';
+        inWord = false;
+        literal = -1;
+    };
+    const markQuoted = (): void => {
+        if (literal === -1) literal = word.length;
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
+            markQuoted();
+            word += command[i + 1] ?? '';
+            inWord = true;
+            i += 2;
+            continue;
+        }
+        if (ch === "'" || ch === '"') {
+            markQuoted();
+            const { text, end } = readQuoted(command, i);
+            word += text;
+            inWord = true;
+            i = end;
+            continue;
+        }
+        if (ch === '#' && !inWord) {
+            while (i < n && command[i] !== '\n') i += 1;
+            continue;
+        }
+        if (ch === '<' && command[i + 1] === '<' && command[i + 2] !== '<') {
+            endWord();
+            let j = i + 2;
+            const stripTabs = command[j] === '-';
+            if (stripTabs) j += 1;
+            while (command[j] === ' ' || command[j] === '\t') j += 1;
+            // The terminator is one word after quote removal: `E"OF"` and `'EOF'` are
+            // EOF, `"E\\OF"` is E\OF, and a quoted empty word (`<<''`) is a valid,
+            // empty terminator.
+            let tag = '';
+            let quoted = false;
+            while (j < n && !/[\s;&|<>()]/.test(command[j] as string)) {
+                const c = command[j] as string;
+                if (c === "'" || c === '"') {
+                    const { text, end } = readQuoted(command, j);
+                    tag += text;
+                    quoted = true;
+                    j = end;
+                } else if (c === '\\' && j + 1 < n) {
+                    tag += command[j + 1];
+                    quoted = true;
+                    j += 2;
+                } else {
+                    tag += c;
+                    j += 1;
+                }
+            }
+            if (tag !== '' || quoted) pendingHeredocs.push({ tag, stripTabs });
+            i = j > i + 2 ? j : i + 2;
+            continue;
+        }
+        if (ch === '\n') {
+            endCommand();
+            i += 1;
+            // Each pending heredoc body follows in order, each up to the line that
+            // is exactly its terminator (leading tabs stripped for `<<-`).
+            for (const { tag, stripTabs } of pendingHeredocs.splice(0)) {
+                while (i < n) {
+                    const eol = command.indexOf('\n', i);
+                    const line = command.slice(i, eol === -1 ? n : eol);
+                    i = eol === -1 ? n : eol + 1;
+                    if ((stripTabs ? line.replace(/^\t+/, '') : line) === tag) break;
+                }
+            }
+            continue;
+        }
+        if (ch === ';' || ch === '|' || (ch === '&' && command[i + 1] === '&')) {
+            endCommand();
+            i += (ch === '&' || (ch === '|' && command[i + 1] === '|')) ? 2 : 1;
+            continue;
+        }
+        // A lone `&` backgrounds the command before it; `2>&1` and `&>f` are redirections.
+        if (ch === '&' && command[i + 1] !== '>' && !(inWord && /[<>]$/.test(word))) {
+            endCommand();
+            i += 1;
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
+/** The command's simple commands, each as its words with quotes removed. */
+export function simpleCommands(command: string): string[][] {
+    return lexCommands(command).map((ws) => ws.map((w) => w.text));
+}
+
+function normalise(words: readonly Word[]): string[] {
+    let k = 0;
+    // A quoted `'X=1'` is a command name, not an assignment: bash runs `X=1`.
+    while (k < words.length && ((words[k] as Word).assign || PREFIX_WORDS.has((words[k] as Word).text))) k += 1;
+    const t = words.slice(k).map((w) => w.text);
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
+    return lexCommands(command).some((words) => {
+        const w = normalise(words);
+        return want.every((x, i) => w[i] === x);
+    });
+}
diff --git a/src/scripts/hooks/reference_duty_loader.ts b/src/scripts/hooks/reference_duty_loader.ts
new file mode 100644
index 0000000000..7fe4628069
--- /dev/null
+++ b/src/scripts/hooks/reference_duty_loader.ts
@@ -0,0 +1,81 @@
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
+ * Whether a command could run a bound act, so loading the chunk is worth it. A
+ * superset of the lexer: line continuations, quotes and backslashes are removed
+ * before matching, and no word boundary is required, so a form the lexer would
+ * match is never skipped. It matches the LAST word of each bound act, which keeps
+ * `printf` and the like from loading the chunk; a test holds it in step with
+ * `src/config/act-references.json`.
+ */
+export const ACT_WORDS = /commit|push|create/;
+
+export function actWordsMayMatch(command: string): boolean {
+    return ACT_WORDS.test(command.replace(/\\\n/g, '').replace(/[\\'"]/g, ''));
+}
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
index 5086fc1d17..73316e800a 100644
--- a/src/scripts/hooks/reread_guard_hook.ts
+++ b/src/scripts/hooks/reread_guard_hook.ts
@@ -78,7 +78,9 @@ import { unwrap, type JsonObject, type JsonValue } from './envelope.js';
 import { readHookStdin } from './hook_stdin.js';
 import { atomic_write_json } from './state_io.js';
 import { EXIT_ALLOW, EXIT_WARN } from './exit_codes.js';
-import { dutyStates, ledgerKey, scanDuties, type DutyState } from '../_lib/reference_duty.js';
+import { ledgerKey } from '../_lib/ledger_key.js';
+import type { DutyScan, DutyState } from '../_lib/reference_duty.js';
+import { actWordsMayMatch, loadReferenceDuty, type ReferenceDuty } from './reference_duty_loader.js';
 
 // Severity is taken from the EXIT CODE, not from the `decision` field — see
 // the file header for why this never blocks on `claude`. This concern never
@@ -339,13 +341,63 @@ export interface DutyRecord {
     ts: number;
 }
 
+/** The duty a bound shell act makes due; the command itself is never stored. */
+function recordActDuty(envelope: JsonObject, payload: JsonObject, command: string): void {
+    if (!actWordsMayMatch(command)) return;
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
+    _recordDutyWith(ledger, key, workspaceRoot, loadReferenceDuty());
+}
+
+/**
+ * The file-act duty. A duty that could not load (missing or mis-digested chunk) is
+ * one counted error; the write, read and advisory bookkeeping is left as it was.
+ * Exported as a testing seam.
+ */
+export function _recordDutyWith(ledger: Ledger, key: string, workspaceRoot: string, duty: ReferenceDuty | null): void {
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
@@ -469,6 +521,10 @@ export function main(): number {
 
         const toolName = extractToolName(payload);
         const toolInput = extractToolInput(payload);
+        if (toolName === 'Bash') {
+            recordActDuty(envelope, payload, str(toolInput['command']));
+            return EXIT_ALLOW;
+        }
         const isRead = READ_TOOLS.has(toolName);
         const isWrite = WRITE_TOOLS.has(toolName);
         if (!isRead && !isWrite) return EXIT_ALLOW;
diff --git a/tests/scripts/act_references.test.ts b/tests/scripts/act_references.test.ts
new file mode 100644
index 0000000000..89bb3e591c
--- /dev/null
+++ b/tests/scripts/act_references.test.ts
@@ -0,0 +1,80 @@
+/**
+ * The act-reference table: rule ids only, every one real and carrying a
+ * load_context, every binding owned — the operational contract council design
+ * round 2 set for option B.
+ */
+import * as fs from 'node:fs';
+import * as path from 'node:path';
+import { fileURLToPath } from 'node:url';
+
+import { describe, expect, it } from 'vitest';
+import { parse as parseYaml } from 'yaml';
+
+const REPO = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
+const table = JSON.parse(fs.readFileSync(path.join(REPO, 'src', 'config', 'act-references.json'), 'utf8')) as {
+    bindings: Array<Record<string, unknown>>;
+};
+
+function frontmatter(rule: string): Record<string, unknown> {
+    const text = fs.readFileSync(path.join(REPO, 'src', 'rules', `${rule}.md`), 'utf8');
+    return parseYaml(text.slice(3, text.indexOf('\n---', 3))) as Record<string, unknown>;
+}
+
+describe('src/config/act-references.json', () => {
+    it('has at least one binding', () => {
+        expect(table.bindings.length).toBeGreaterThan(0);
+    });
+    it.each(table.bindings.map((b) => [String(b['shell_command']), b]))('%s: keys, owner, a real command', (_cmd, b) => {
+        expect(Object.keys(b).sort()).toEqual(['owner', 'rules', 'shell_command']);
+        expect(String(b['owner']).trim()).not.toBe('');
+        expect(String(b['shell_command'])).toMatch(/^[a-z][a-z0-9-]*( [a-z][a-z0-9-]*)+$/);
+    });
+    it('binds each shell command once, each with distinct, non-empty rules', () => {
+        const cmds = table.bindings.map((b) => String(b['shell_command']));
+        expect(new Set(cmds).size).toBe(cmds.length);
+        for (const b of table.bindings) {
+            const rules = b['rules'] as string[];
+            expect(rules.length).toBeGreaterThan(0);
+            expect(new Set(rules).size).toBe(rules.length);
+        }
+    });
+    it.each(table.bindings.flatMap((b) => (b['rules'] as string[]).map((r) => [String(b['shell_command']), r])))(
+        '%s → %s exists and carries load_context',
+        (_cmd, rule) => {
+            const fm = frontmatter(rule);
+            expect(Array.isArray(fm['load_context']) && (fm['load_context'] as unknown[]).length > 0).toBe(true);
+        },
+    );
+});
+
+describe('the bundle-side pre-check stays in step with the table', () => {
+    it('every bound act\'s last word is one ACT_WORDS matches', async () => {
+        const { ACT_WORDS } = await import('../../src/scripts/hooks/reference_duty_loader.js');
+        for (const b of table.bindings) expect(ACT_WORDS.test(String(b['shell_command']).split(' ').pop() as string)).toBe(true);
+    });
+});
+
+describe('the pre-check never drops what the lexer recognises', () => {
+    // Every bound act, with one quote, empty-quote or escape inserted at every
+    // position of its last word: bash still runs the act, so the lexer must
+    // recognise it and the pre-check must let it through to the lexer.
+    const variants = table.bindings.flatMap((b) => {
+        const words = String(b['shell_command']).split(' ');
+        const last = words.pop() as string;
+        const head = words.join(' ');
+        const out: Array<[string, string]> = [];
+        for (let i = 1; i < last.length; i += 1) {
+            for (const ins of ['\\', "''", '""', '\\\n']) {
+                out.push([String(b['shell_command']), `cd x && ${head} ${last.slice(0, i)}${ins}${last.slice(i)} -q 2>&1 | tail -1`]);
+            }
+            out.push([String(b['shell_command']), `${head} ${last.slice(0, i)}"${last.slice(i)}" -q`]);
+        }
+        return out;
+    });
+    it.each(variants)('%s ← %j', async (act, command) => {
+        const { actWordsMayMatch } = await import('../../src/scripts/hooks/reference_duty_loader.js');
+        const { commandRunsAct } = await import('../../src/scripts/_lib/shell_acts.js');
+        expect(commandRunsAct(command, act)).toBe(true);
+        expect(actWordsMayMatch(command)).toBe(true);
+    });
+});
diff --git a/tests/scripts/shell_acts_bash_oracle.test.ts b/tests/scripts/shell_acts_bash_oracle.test.ts
new file mode 100644
index 0000000000..bc22d16d2d
--- /dev/null
+++ b/tests/scripts/shell_acts_bash_oracle.test.ts
@@ -0,0 +1,103 @@
+/**
+ * Shell-grounded oracle for the act recogniser: every case is run by real bash
+ * with `git` and `gh` replaced by functions that log their arguments, in an empty
+ * temp directory. Each case also states the acts it expects, so the oracle checks
+ * false positives (an act the recogniser reports and bash never reaches) as well as
+ * misses, and a stub or fixture defect shows up as bash disagreeing with the case.
+ */
+import { spawnSync } from 'node:child_process';
+import * as fs from 'node:fs';
+import * as os from 'node:os';
+import * as path from 'node:path';
+
+import { describe, expect, it } from 'vitest';
+
+import { commandRunsAct } from '../../src/scripts/_lib/shell_acts.js';
+
+const STUBS = [
+    'git() { while [ "$1" = -C ] || [ "$1" = -c ]; do shift 2; done; printf "git %s\\n" "$1" >> "$ACT_LOG"; }',
+    'gh() { printf "gh %s %s\\n" "$1" "$2" >> "$ACT_LOG"; }',
+    'cat() { command cat > /dev/null; }',
+    'sudo() { "$@"; }',
+    'make() { :; }', 'npm() { :; }', 'sleep() { :; }', 'cd() { :; }',
+].join('\n');
+
+/**
+ * Acts bash invokes, as the union of two runs: `true` succeeding and `true`
+ * failing. The recogniser reports a potential act, so both `&&` and `||` branches
+ * have to be reachable for bash to be its oracle.
+ */
+function bashActs(command: string): string[] {
+    const acts = new Set([C, P, G]);
+    return [...new Set([...bashRun(command, 0), ...bashRun(command, 1)])].filter((a) => acts.has(a)).sort();
+}
+
+function bashRun(command: string, trueStatus: number): string[] {
+    const dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'acts-oracle-'));
+    try {
+        const log = path.join(dir, 'acts.log');
+        fs.writeFileSync(log, '');
+        const r = spawnSync('bash', ['-c', `${STUBS}\ntrue() { return ${trueStatus}; }\n${command}\nwait`], { cwd: dir, env: { PATH: process.env['PATH'] ?? '', ACT_LOG: log }, encoding: 'utf8', timeout: 10_000 });
+        if (r.error || r.signal) throw new Error(`bash did not finish: ${String(r.error ?? r.signal)}`);
+        return fs.readFileSync(log, 'utf8').split('\n').filter((l) => l !== '');
+    } finally {
+        fs.rmSync(dir, { recursive: true, force: true });
+    }
+}
+
+const C = 'git commit';
+const P = 'git push';
+const G = 'gh pr create';
+
+/** Each case: the command and the acts it runs. */
+const CASES: Array<[string, string[]]> = [
+    ['git commit -m "x"', [C]],
+    ['git add a && git commit -q -m "x"', [C]],
+    ['cd /w && git -C /w commit -m x', [C]],
+    ['GIT_AUTHOR_NAME=a git commit -m x', [C]],
+    ['npm test; git push origin HEAD', [P]],
+    ['true || gh pr create --title t', [G]],
+    ["cat > f <<'EOF'\nit's prose\nEOF\ngit commit -m done", [C]],
+    ['git -C "my repo" commit -m x', [C]],
+    ['git commit -m x # done', [C]],
+    ["echo '<<EOF'; git commit -m x", [C]],
+    ['make && \\\n  git push', [P]],
+    ['cat > f <<EOF-1\nprose\nEOF-1\ngit commit -m x', [C]],
+    ['cat > a <<A > b <<B\none\nA\ntwo\nB\ngit push', [P]],
+    ['cat > f <<-EOF\n\tbody\n\tEOF\ngit commit -m x', [C]],
+    ['sleep 1 & git push', [P]],
+    ['git com\\mit -m x', [C]],
+    ['git "commit" -m x', [C]],
+    ['git com\\\nmit -m x', [C]],
+    ['cat <<E"OF"\nbody\nEOF\ngit push', [P]],
+    ['echo "git commit"', []],
+    ["cat > notes.md <<'EOF'\nthen run git commit\nEOF", []],
+    ['echo hello\\; git push', []],
+    ['echo x # ; git push', []],
+    ['echo "a; git push"', []],
+    ['git -C "dir; git push" status', []],
+    ['cat > f <<EOF\n  EOF\ngit push\nEOF', []],
+    ['git "com\\mit" -m x', []],
+    ['cat <<E"OF"\ngit push\nEOF', []],
+    // Round-4 counterexamples: escapes inside a quoted terminator, an empty
+    // terminator, and assignment words that are quoted.
+    ['cat <<"A\\\\B"\ngit push\nA\\B\ngit commit -m done', [C]],
+    ["cat <<'A\\B'\ngit push\nA\\B\ngit commit -m done", [C]],
+    ["cat <<''\ngit push\n\ngit commit -m x", [C]],
+    ['cat <<""\ngit push\n\ngit commit -m x', [C]],
+    ["'X=1' git push", []],
+    ['"X"=1 git push', []],
+    ['X\\=1 git push', []],
+    ['X="a b" git push', [P]],
+    ["X='a' Y=2 git push", [P]],
+];
+
+const hasBash = spawnSync('bash', ['-c', 'true']).status === 0;
+
+describe.skipIf(!hasBash)('the recogniser agrees with bash', () => {
+    it.each(CASES)('%j', (command, expected) => {
+        expect(bashActs(command)).toEqual([...expected].sort());
+        const recognised = [C, P, G].filter((act) => commandRunsAct(command, act)).sort();
+        expect(recognised).toEqual([...expected].sort());
+    });
+});
```
