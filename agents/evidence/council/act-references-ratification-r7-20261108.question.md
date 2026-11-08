<!-- evidence-type: analysis -->

# Ratification review — act-time reference duty in a conditional chunk — round 7

You are an independent reviewer for a change in the `event4u/agent-config` repository. One file in it, `src/config/hook-bundle-budget.json`, is on the ratification gate's list (the hook bundle's byte budget), so the change needs a two-provider verdict under ADR-268 § 4.

subject: 68165f22e970e84218f00bb747ae215f60b202dad432c8b6d64f2362151a47d1

(The digest covers the gated file at commit `2931f1412e`, computed with `./scripts-run src/scripts/ratification_subject`.)

## What the change does

- **Act-reference table** `src/config/act-references.json` binds `git commit` → `commit-policy`, `git push` → `non-destructive-by-default` + `scope-control`, `gh pr create` → `scope-control`. Rule ids only, each with an owner; references come from each rule's own `load_context`. Chosen by council design round 2 (option B) over kernel frontmatter, which the rule schema forbids for router triggers. A test validates every binding (keys, owner, rule exists and has `load_context`).
- **Recogniser** `src/scripts/_lib/shell_acts.ts`: heredoc bodies dropped, segments split on `;` `&&` `||` `|` newline outside quotes, env assignments / `sudo` etc. stripped, `git -C`/`-c` skipped. Spike over 14,834 real agent Bash calls: ≤ 0.1 % misses; a prefix match finds 17 % (`agents/evidence/analysis/shell-command-recognition-spike-2026-11-08.md`).
- **Observation** in the existing `reread-guard` concern (already bound on claude `pre_tool_use` for Bash; no binding change): a Bash command containing a bound act word records each bound rule's references as `read` / `required-pending` in the session ledger, observe-only. The raw command is never stored. A bound rule that cannot be read counts as `duty_errors`.
- **Conditional chunk:** the duty logic (router walk, frontmatter parse, table, recogniser) moved out of the dispatch bundle into `dist/hooks/reference_duty.chunk.cjs` (15,080 B, ceiling 16,600 B registered in the gated file). It loads only on a file write or a Bash command matching `ACT_WORDS` (a test keeps that in step with the table). The bundle drops to 1,582,460 B (ceiling 1,585,000; it would have been 1,588,246 B with the logic inline). A missing or mis-digested chunk makes the hook count a duty error and observe nothing; the read ledger and advisories are unaffected. `ledgerKey` moved to `_lib/ledger_key.ts`, which stays in the bundle.

## Round 6 and what changed

Round 6: anthropic `refused` (dealbreaker), openai requested changes — here-strings, backslash-newline in an unquoted heredoc body, and a quoted `time`. The two seats disagreed on the heredoc body; bash decided (openai was right: with an unquoted terminator the body joins backslash-newlines before the comparison; with a quoted one it does not).

**Strategy change.** Six rounds each found syntax nobody had listed. Patching the cases named in each round is not converging, so round 7 adds a **generated differential test** (`tests/scripts/shell_acts_bash_fuzz.test.ts`): a seeded generator builds commands from the supported syntax — assignment and wrapper prefixes (`X=1`, `'X=1'`, `"X"=1`, `time`, `"time"`, `time -p`, `nohup`, `nohup --`, `command`, `command --`, `command -v`, `sudo`, `sudo X=1`, …), quotes, escapes and continuations inserted into act words, `git -C "my dir"`, separators `;` `&&` `||` `|` `&` newline, comments, here-strings, and heredocs with every terminator form (`EOF`, `'EOF'`, `"EOF"`, `E"OF"`, `EOF-1`, `"A\\B"`, `''`, `EO\<newline>F`, `<<-` with tabs) whose bodies carry acts, near-miss terminators and continuation lines — and runs each through bash with executable `git`/`gh` stubs. Recogniser and bash must name the same acts. Commands bash rejects with `bash -n` are skipped and must stay under 5 %. 100 seeds run on every test pass; `SHELL_ACTS_FUZZ_N` / `SHELL_ACTS_FUZZ_SEED` widen a local sweep.

- Its first runs found a class neither seat named: **`time` is the keyword only unquoted and at the start of a pipeline and of a command**; after `|`, after an assignment or quoted, it is time(1), after which `X=1` is the command name. The next sweep found that **`-p` belongs to time(1) as well** (POSIX). Both fixed, both in the curated oracle.
- Round-6 cases fixed: `<<<` is a here-string (a redirection whose word is an ordinary word); unquoted-terminator bodies join a line ending in an odd run of backslashes onto the next before comparing; a quoted `"time"` is time(1).
- Wrapper options probed in bash and handled: `time -p`, `command --`, `nohup --` are skipped; `command -v` / `-V` run nothing. Not interpreted, and stated in the contract: `sudo -u …` and `command -p` (the latter searches the default `PATH`, which the stub cannot model).
- **Sweep results on the final lexer:** seeds 1–2,000, 10,001–13,000 and 20,001–24,000 — 9,000 generated commands — agree with bash. On the round-6 lexer, 400 seeds gave 10 disagreements, and the curated oracle's new cases failed (seen red).
- **Curated oracle:** 63 cases, each with its expected act set.
- **Chunk ceiling raised** 18,200 → 20,600 B with a `raise_log` entry naming the chunk and every addition (measured 18,774 B). This is a threshold raise and is stated as one: the bytes are the syntax the recogniser needs to agree with bash; the dispatch bundle is unchanged at 1,582,782 B.

## Round 5 and what changed

Round 5: anthropic `refused` (dealbreaker), openai requested changes — assignments after wrappers, a continuation inside a heredoc terminator, and a kill switch that did not exist. Round 6:

- **Assignment position**, checked against real bash with executable `git` stubs: an assignment is a prefix before the command name and after `time` (a keyword) or `sudo` (sudo(8) applies `VAR=value` arguments). After `command`, `exec` and `nohup` it is the name of the command run: `command X=1 git push`, `exec X=1 git push`, `nohup X=1 git push` run no git; `time X=1 git push`, `X=1 nohup git push` do. (Round 5's two seats disagreed on `command` and `sudo`; bash and the sudo manual decided.)
- **Heredoc terminator continuation:** a backslash-newline inside the terminator is removed, as in any other word, so `cat <<EO\<newline>F` ends at `EOF`.
- **The oracle runs `git` and `gh` as executables on `PATH`**, not shell functions, so `command`, `exec` and `nohup` behave as bash does; `sudo` stays a function that applies its leading `VAR=value` arguments. It throws on CI when bash is absent instead of skipping. 47 cases; the 4 new round-5 counterexamples fail on the round-5 lexer and pass now.
- **Kill switch — the round-4 claim is withdrawn.** Emptying `bindings` is refused by the table test and would not reach an installed chunk, which imports the table at build time. Rollback is: revert the change on `main`, rebuild, and release; installed copies stop observing on update. Observation is advisory and blocks nothing, which is why no runtime switch is added.
- **What `duty_errors` measures:** load and read failures only. A command the recogniser misses produces no error; the miss rate rests on the spike corpus and the oracle, not on a runtime counter.
- **File-write observation in the chunk:** moving it out of the bundle was forced by the bundle ceiling (inline: 1,588,246 B against 1,585,000 B). A chunk that fails to load counts one `duty_errors` per file act and leaves reads, writes and advisories unchanged (tested); the loader's missing or mis-digested chunk path returns `null` (tested).
- Chunk 17,886 B against the unchanged 18,200 B ceiling (margin now about 2 %, stated in the gated derivation); bundle 1,582,782 B.

## Round 4

Round 4 refused on escaped and empty heredoc terminators, quoted assignment words, and an oracle fixture that lost its backslash; all fixed with cases seen red (see the committed round-5 question). Its claim that emptying `bindings` is a kill switch was withdrawn in round 5.

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

## The diff (`git diff origin/main...feat/act-references` for the files below; omitted as unchanged since round 5, and shown in the committed round-5/6 questions: `src/config/act-references.json`, `_lib/reference_duty.ts`, `hooks/reference_duty_loader.ts`, `hooks/reread_guard_hook.ts`, `tests/scripts/act_references.test.ts`; unchanged since round 1: `_lib/ledger_key.ts`, `hook_chunks.mjs`, `rule_reference_requires.ts`; the bench corpus under `internal/` ships nothing)

```diff
diff --git a/src/config/hook-bundle-budget.json b/src/config/hook-bundle-budget.json
index c7f03a2ec7..e83e4954a7 100644
--- a/src/config/hook-bundle-budget.json
+++ b/src/config/hook-bundle-budget.json
@@ -190,6 +190,16 @@
             "what_was_added": "The consistency check turned on by default inside the in-bundle `design-pass` concern: the `hooks.design_consistency` switch read with a default of on, a narrow consistency-only path for installs where the rest of the pass stays off, the call that adds its findings when the whole pass is on, the `shadow` switch that keeps it recording without delivering (the rollback of the activation policy's reverse trigger, asked for by ratification round 4), and the loader of its conditional chunk. The check itself (`ui:audit`, the role parser, the rules and the shadow recorder) ships in `design_consistency.chunk.cjs`, required on a UI write alone. Measured 1,584,460 B with the change on a base of 1,581,986 B (origin/main b53718de25, re-based on 2026-11-04 onto the raises above, both readings by this gate): +2,474 B, the same delta as on the 2026-11-03 base 1a552b83c5; the same change raises the `design_consistency_pass` chunk ceiling from 47,000 to 53,000 B, derived in `chunks` (Node 26.7.0, esbuild 0.28.1, Darwin arm64). esbuild is locked at 0.28.1 in package-lock.json, which is the version CI installs for this gate, so the toolchain cannot move the figure between this reading and CI without a lockfile change; source changes move it as well, and any growth past the ceiling is caught by this same gate.",
             "why_it_could_not_be_avoided": "Room was made first: the chunk-require logic of `svg_rules_loader` became one shared function, which both loaders call (since 2026-11-03 the `loadChunkExport` origin/main extracted for the same purpose), taking the first measurement from +2,061 to +1,882 B; moving the loader call inside the failure boundary (ratification round 1) added 4 B, the `shadow` switch of round 4 added 169 B, the explicit `post_tool_use` gate of round 10 added 35 B, and reading the dispatcher envelope added 300 B (2,390 B on the 2026-10-29 base). That last fix was found when round 12 asked for whole-event latency: run through the real dispatcher, `design-pass` received the envelope, read no `tool_input` at its top level, and returned before any check. origin/main has since unwrapped the envelope in the same function independently; this change keeps that call and adds the two parts it does not carry, the root from `workspace_root` and an absolute `file_path` made relative to it (`writtenPath`), plus a guarded specifier in the consistency loader, for the +2,474 B above. Moving `design-pass` itself into a lazy chunk was considered and refused on the same trade the 2026-10-23 entry refused for `session-eol`: the concern is bound on every `post_tool_use`, so its body plus the slop registry would be required on every tool call of every install, against a switch that today returns in the bundle. What remains is the switch, the two call sites and the loader, which no chunk can carry because the concern that calls them is in the bundle. origin/main itself sits 14 bytes under its 1,582,000 ceiling, which this change exceeds by 2,460 bytes.",
             "what_would_have_caught_it": "Nothing earlier: the base headroom is smaller than the change. Sized to the measurement plus 540 bytes of headroom; rebuild variability was not measured."
+        },
+        {
+            "date": "2026-11-08",
+            "chunk": "src/scripts/_lib/reference_duty.ts",
+            "from": 18200,
+            "to": 20600,
+            "by": "agent, feat/act-references (road-to-a-reference-that-arrives-before-the-act), ratification rounds 4-6",
+            "what_was_added": "Shell syntax the act recogniser had to honour to agree with bash, each found by a ratification seat or by the generated bash differential test: one quote reader shared by words and heredoc terminators (escaped and empty terminators), assignment words carrying their quoting and position (`'X=1' git push`, `nohup X=1 git push`), backslash-newline joins in terminators and in unquoted heredoc bodies, here-strings, `time` as the keyword only unquoted at the start of a pipeline, and the `time -p` / `command --` / `nohup --` / `command -v` forms. Measured 17,148 B before round 4, 18,774 B after round 6.",
+            "why_it_could_not_be_avoided": "Every addition closes a false observation or a swallowed act that real bash disagrees with; the alternative is a recogniser whose stated syntax contract is false. The chunk loads only on a file write or a Bash command carrying a bound act word, so no other dispatch pays these bytes; the dispatch bundle is unchanged at 1,582,782 B.",
+            "what_would_have_caught_it": "The generated differential test that now ships with the recogniser (`tests/scripts/shell_acts_bash_fuzz.test.ts`), had it existed before the 18,200 ceiling was set: it found the pipeline-`time` class on its first run. Sized to the round-6 reading plus about 10 %."
         }
     ],
     "chunks": [
@@ -276,6 +286,12 @@
             "max_bytes": 61600,
             "registered_at": "2026-11-04",
             "derivation": "Measured 55,991 bytes on 2026-11-04 for the roadmap agents/roadmaps/archive/road-to-a-noted-that-is-a-write.md. The chunk holds the self-repair concern, its four detectors including persistence-claim, the record store with the target and subject indexes, and the Class-A telemetry shadow (emitDefectShadow: a structural-fields-only copy of a queued record for the org telemetry pack, inert unless that pack activated telemetry); `yaml` is external, resolved from the installed package as for the chat_history, update_notice and star_ask chunks. The ceiling is that reading plus about 10 %, rounded, the same margin as the quota_notice and intake_pass rows. The margin approves no planned code: a later addition to the chunk is measured and reviewed on its own change. WHY IT WAS MOVED: the dispatch bundle sat 14 bytes under its 1,582,000 ceiling at origin/main b53718de2 (measured 1,581,986 B by this gate with APFS-cloned node_modules), and the roadmap's detector work had to land somewhere. The concern built alone was 51,156 bytes before the work; moving it out, as the 2026-10-18 council chose for this situation, took the dispatch bundle to 1,557,293 B (-24,693 B, the rest being modules other concerns still import) instead of raising the dispatch ceiling. Bound on `user_prompt_submit` and `stop`; the bundle carries only its LAZY_CONCERNS row. A missing or mis-digested chunk falls back to spawning the same script, which is slower; tests/hooks/self_repair_lazy_paths.test.ts pins that the loader path and the spawn fallback write the same record, and that the built dispatcher falls back to the spawn exactly once with the chunk missing. On either path a failure of the concern does not reject the hook event (`fail_closed: false`, unchanged by this move); the dispatcher still writes that run's exit code to agents/runtime/state/.dispatcher/<session>/self-repair.json, which is where a failing concern is visible."
+        },
+        {
+            "entry": "src/scripts/_lib/reference_duty.ts",
+            "max_bytes": 20600,
+            "registered_at": "2026-11-08",
+            "derivation": "Registered at 16,523 bytes on 2026-11-08 (15,080 before ratification round 1 replaced the segmenter with a quote-, escape-, comment- and heredoc-aware lexer); raised to 20,600 after ratification round 6 measured 18,774 bytes; the raise and what was added are the raise_log entry naming this chunk for road-to-a-reference-that-arrives-before-the-act. The chunk holds the reference duty: the router walk with trigger_matches, the rule-frontmatter parse, the act-reference table and the shell-act recogniser; `yaml` is external, resolved from the installed package as for the chat_history chunk. The ceiling was the registered reading plus about 10 %, rounded, the margin of the quota_notice, intake_pass and self_repair rows. WHY IT IS A CHUNK: adding the act-time duty in the dispatch bundle measured 1,588,246 B against the 1,585,000 B ceiling (real node_modules install); the duty runs only on a file write or on a Bash command containing a bound act word (`reference_duty_loader.ACT_WORDS`), so it does not belong in the bytes every hook event loads. The bundle keeps the loader, the act-word pre-check and `_lib/ledger_key.ts`. A missing or mis-digested chunk makes the hook count a duty error instead of observing; the guard's read ledger and advisories are unaffected."
         }
     ],
     "chunks_note": "A chunk is loaded only when a caller needs it, so its bytes are not paid by every dispatch; its ceiling exists so that the move out of dispatch.js stays a measured place rather than an unmeasured one. The gate builds each chunk with the exact esbuild segment `build:hook-chunks` uses for its entry.",
diff --git a/src/scripts/_lib/shell_acts.ts b/src/scripts/_lib/shell_acts.ts
new file mode 100644
index 0000000000..7b469aa239
--- /dev/null
+++ b/src/scripts/_lib/shell_acts.ts
@@ -0,0 +1,271 @@
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
+ * terminator (leading tabs stripped for `<<-`; with an unquoted terminator, body
+ * lines joined across backslash-newline first). `<<<` is a here-string, not a heredoc.
+ *
+ * Supported syntax contract: the above, plus `VAR=…` prefixes, `sudo`/`command`/
+ * `time`/`exec`/`nohup`, and `git -C`/`-c` values. An assignment prefix is only one
+ * whose `NAME=` is unquoted and that stands before the command name or after
+ * `time` / `sudo`: `'X=1' git push` and `nohup X=1 git push` run a command named `X=1`.
+ * `time` is the keyword only unquoted at the start of a pipeline; `-p` after any `time`, and `--`
+ * after `command` / `nohup`, are skipped; `command -v` / `-V` run nothing. Other
+ * wrapper options (`sudo -u …`, `command -p`) are not interpreted. Not interpreted: `$(…)` and
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
+// After these an assignment is still a prefix: `time` is a keyword, and sudo(8)
+// applies `VAR=value` arguments. After `command`, `exec` and `nohup` it is the
+// name of the command run, so `nohup X=1 git push` does not run git.
+const ASSIGN_AFTER = new Set(['time', 'sudo']);
+
+/**
+ * One word after quote removal. `assign` holds when it opens with an unquoted
+ * `NAME=`; `quoted` when any part of it was quoted or escaped.
+ */
+interface Word {
+    text: string;
+    assign: boolean;
+    quoted: boolean;
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
+/** A simple command's words, and whether it follows a `|` inside a pipeline. */
+interface Simple {
+    words: Word[];
+    piped: boolean;
+}
+
+function lexCommands(command: string): Simple[] {
+    const out: Simple[] = [];
+    let piped = false;
+    let words: Word[] = [];
+    let word = '';
+    let inWord = false;
+    // Length of the word's leading unquoted, unescaped run; -1 while no quote or
+    // escape has occurred in it. An assignment's `NAME=` must fit inside that run.
+    let literal = -1;
+    const pendingHeredocs: Array<{ tag: string; stripTabs: boolean; quoted: boolean }> = [];
+    const endWord = (): void => {
+        if (inWord) {
+            const m = /^[A-Za-z_][A-Za-z0-9_]*=/.exec(word);
+            const limit = literal === -1 ? word.length : literal;
+            words.push({ text: word, assign: m !== null && m[0].length <= limit, quoted: literal !== -1 });
+        }
+        word = '';
+        inWord = false;
+        literal = -1;
+    };
+    const markQuoted = (): void => {
+        if (literal === -1) literal = word.length;
+    };
+    const endCommand = (nextPiped = false): void => {
+        endWord();
+        if (words.length > 0) out.push({ words, piped });
+        words = [];
+        piped = nextPiped;
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
+        // `<<<` is a here-string: a redirection whose word is an ordinary word.
+        if (ch === '<' && command[i + 1] === '<' && command[i + 2] === '<') {
+            endWord();
+            i += 3;
+            continue;
+        }
+        if (ch === '<' && command[i + 1] === '<') {
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
+                } else if (c === '\\' && command[j + 1] === '\n') {
+                    // A line continuation is removed here as in any other word.
+                    j += 2;
+                } else if (c === '\\' && j + 1 < n) {
+                    tag += command[j + 1];
+                    quoted = true;
+                    j += 2;
+                } else {
+                    tag += c;
+                    j += 1;
+                }
+            }
+            if (tag !== '' || quoted) pendingHeredocs.push({ tag, stripTabs, quoted });
+            i = j > i + 2 ? j : i + 2;
+            continue;
+        }
+        if (ch === '\n') {
+            endCommand();
+            i += 1;
+            // Each pending heredoc body follows in order, each up to the line that
+            // is exactly its terminator (leading tabs stripped for `<<-`). With an
+            // unquoted terminator a body line ending in an odd run of backslashes
+            // continues onto the next before the comparison, as in bash.
+            for (const { tag, stripTabs, quoted } of pendingHeredocs.splice(0)) {
+                while (i < n) {
+                    let line = '';
+                    for (;;) {
+                        const eol = command.indexOf('\n', i);
+                        const part = command.slice(i, eol === -1 ? n : eol);
+                        i = eol === -1 ? n : eol + 1;
+                        const run = /\\*$/.exec(part)?.[0].length ?? 0;
+                        if (quoted || run % 2 === 0 || eol === -1) {
+                            line += part;
+                            break;
+                        }
+                        line += part.slice(0, -1);
+                    }
+                    if ((stripTabs ? line.replace(/^\t+/, '') : line) === tag) break;
+                }
+            }
+            continue;
+        }
+        if (ch === ';' || ch === '|' || (ch === '&' && command[i + 1] === '&')) {
+            endCommand(ch === '|' && command[i + 1] !== '|');
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
+    return lexCommands(command).map((c) => c.words.map((w) => w.text));
+}
+
+function normalise({ words, piped }: Simple): string[] {
+    let k = 0;
+    // A quoted `'X=1'` is a command name, not an assignment: bash runs `X=1`.
+    let assignOk = true;
+    while (k < words.length) {
+        const w = words[k] as Word;
+        if (w.assign && assignOk) k += 1;
+        else if (PREFIX_WORDS.has(w.text)) {
+            // `time` is the keyword only unquoted and at the start of a pipeline;
+            // a quoted `"time"`, or one after `|`, is the time(1) program, after
+            // which `X=1` is the command name.
+            const keyword = w.text === 'time' && !(w.quoted || piped || k > 0);
+            assignOk = ASSIGN_AFTER.has(w.text) && (w.text !== 'time' || keyword);
+            k += 1;
+            const next = words[k]?.text;
+            // `command -v` / `-V` only describe the command; they run nothing.
+            if (w.text === 'command' && (next === '-v' || next === '-V')) return [];
+            // `-p` belongs to the keyword and to time(1) alike (POSIX).
+            if ((w.text === 'time' && next === '-p') || ((w.text === 'command' || w.text === 'nohup') && next === '--')) k += 1;
+        } else break;
+    }
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
+    return lexCommands(command).some((simple) => {
+        const w = normalise(simple);
+        return want.every((x, i) => w[i] === x);
+    });
+}
diff --git a/tests/_lib/bash_act_oracle.ts b/tests/_lib/bash_act_oracle.ts
new file mode 100644
index 0000000000..1984318727
--- /dev/null
+++ b/tests/_lib/bash_act_oracle.ts
@@ -0,0 +1,55 @@
+/**
+ * Real bash as the oracle for the act recogniser. A command runs in an empty temp
+ * directory with `git` and `gh` as logging executables; the result is the set of
+ * bound acts bash reached.
+ */
+import { spawnSync } from 'node:child_process';
+import * as fs from 'node:fs';
+import * as os from 'node:os';
+import * as path from 'node:path';
+
+export const C = 'git commit';
+export const P = 'git push';
+export const G = 'gh pr create';
+export const ACTS = [C, P, G] as const;
+
+export const hasBash = spawnSync('bash', ['-c', 'true']).status === 0;
+
+// `git` and `gh` are executables on PATH, not functions, so `command`, `exec` and
+// `nohup` treat them as bash does. `sudo` is a function that applies its leading
+// `VAR=value` arguments, as sudo(8) documents, then runs the rest.
+const GIT_STUB = '#!/bin/sh\nwhile [ "$1" = -C ] || [ "$1" = -c ]; do shift 2; done\nprintf "git %s\\n" "$1" >> "$ACT_LOG"\n';
+const GH_STUB = '#!/bin/sh\nprintf "gh %s %s\\n" "$1" "$2" >> "$ACT_LOG"\n';
+const STUBS = [
+    'cat() { command cat > /dev/null; }',
+    'sudo() { while [ $# -gt 0 ]; do case $1 in [A-Za-z_]*=*) export "$1"; shift ;; *) break ;; esac; done; "$@"; }',
+    'make() { :; }', 'npm() { :; }', 'sleep() { :; }', 'cd() { :; }',
+].join('\n');
+
+/**
+ * Acts bash invokes, as the union of two runs: `true` succeeding and `true`
+ * failing. The recogniser reports a potential act, so both `&&` and `||` branches
+ * have to be reachable for bash to be its oracle.
+ */
+export function bashActs(command: string): string[] {
+    const acts = new Set<string>(ACTS);
+    return [...new Set([...bashRun(command, 0), ...bashRun(command, 1)])].filter((a) => acts.has(a)).sort();
+}
+
+function bashRun(command: string, trueStatus: number): string[] {
+    const dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'acts-oracle-'));
+    try {
+        const log = path.join(dir, 'acts.log');
+        fs.writeFileSync(log, '');
+        const bin = path.join(dir, 'bin');
+        fs.mkdirSync(bin);
+        fs.writeFileSync(path.join(bin, 'git'), GIT_STUB, { mode: 0o755 });
+        fs.writeFileSync(path.join(bin, 'gh'), GH_STUB, { mode: 0o755 });
+        const r = spawnSync('bash', ['-c', `${STUBS}\ntrue() { return ${trueStatus}; }\n${command}\nwait`], { cwd: dir, env: { PATH: `${bin}${path.delimiter}${process.env['PATH'] ?? ''}`, ACT_LOG: log }, encoding: 'utf8', timeout: 10_000 });
+        if (r.error || r.signal) throw new Error(`bash did not finish: ${String(r.error ?? r.signal)}`);
+        return fs.readFileSync(log, 'utf8').split('\n').filter((l) => l !== '');
+    } finally {
+        fs.rmSync(dir, { recursive: true, force: true });
+    }
+}
+
diff --git a/tests/scripts/shell_acts_bash_fuzz.test.ts b/tests/scripts/shell_acts_bash_fuzz.test.ts
new file mode 100644
index 0000000000..f8ac79bca1
--- /dev/null
+++ b/tests/scripts/shell_acts_bash_fuzz.test.ts
@@ -0,0 +1,110 @@
+/**
+ * Generated differential test: seeded commands built from the supported syntax
+ * (prefixes, wrappers, quoting and escapes inside act words, separators, comments,
+ * heredocs with every terminator form, here-strings) are run by real bash and must
+ * produce the acts the recogniser reports. A hand-picked case list only checks the
+ * forms someone thought of; this checks their combinations.
+ *
+ * `exec` is not generated: it ends the shell, so the commands after it are
+ * potential acts bash never reaches. Commands bash rejects as syntax errors are
+ * skipped and counted. `SHELL_ACTS_FUZZ_N` raises the count for a local sweep,
+ * `SHELL_ACTS_FUZZ_SEED` moves its first seed.
+ */
+import { spawnSync } from 'node:child_process';
+
+import { describe, expect, it } from 'vitest';
+
+import { commandRunsAct } from '../../src/scripts/_lib/shell_acts.js';
+import { ACTS, bashActs, hasBash } from '../_lib/bash_act_oracle.js';
+
+function rng(seed: number): () => number {
+    let a = seed >>> 0;
+    return () => {
+        a = (a + 0x6d2b79f5) >>> 0;
+        let t = a;
+        t = Math.imul(t ^ (t >>> 15), t | 1);
+        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
+        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
+    };
+}
+
+function pick<T>(r: () => number, xs: readonly T[]): T {
+    return xs[Math.floor(r() * xs.length)] as T;
+}
+
+/** One word, with a quote, an escape or a continuation inserted at random. */
+function mangle(r: () => number, word: string): string {
+    if (r() < 0.5 || word.length < 2) return word;
+    const i = 1 + Math.floor(r() * (word.length - 1));
+    const [a, b] = [word.slice(0, i), word.slice(i)];
+    return pick(r, [`${a}\\${b}`, `${a}''${b}`, `${a}""${b}`, `${a}\\\n${b}`, `"${a}"${b}`, `${a}'${b}'`, `"${word}"`]);
+}
+
+const ACT_FORMS = [['git', 'commit', '-m', 'x'], ['git', 'push'], ['gh', 'pr', 'create', '-t', 't'], ['git', '-C', '"my dir"', 'commit', '-q']];
+const PREFIXES = ['', 'X=1 ', "'X=1' ", '"X"=1 ', 'X="a b" ', 'time ', '"time" ', 'nohup ', 'command ', 'sudo ', 'sudo X=1 ', 'nohup X=1 ', 'command X=1 ', 'time X=1 ', 'X=1 nohup ', 'time -p ', 'time -p X=1 ', 'command -- ', 'nohup -- ', 'command -v '];
+const OTHERS = ['echo hi', 'echo "git push"', "echo 'git commit -m x'", 'cat <<< "git push"', 'cat <<<x', 'make', 'npm test', 'echo a # ; git push', 'echo "a; git push"', 'echo hello\\; git push'];
+const TAGS: Array<[string, string, boolean]> = [
+    ['EOF', 'EOF', false], ["'EOF'", 'EOF', true], ['"EOF"', 'EOF', true], ['E"OF"', 'EOF', true],
+    ['EOF-1', 'EOF-1', false], ['"A\\\\B"', 'A\\B', true], ["''", '', true], ['EO\\\nF', 'EOF', false],
+];
+
+function act(r: () => number): string {
+    const form = pick(r, ACT_FORMS);
+    return pick(r, PREFIXES) + form.map((w, i) => (i === 0 || w.startsWith('-') || w.startsWith('"') ? w : mangle(r, w))).join(' ');
+}
+
+function simple(r: () => number): string {
+    const s = r() < 0.6 ? act(r) : pick(r, OTHERS);
+    return pick(r, ['', '', '', 'true && ', 'true || ']) + s;
+}
+
+/** A heredoc segment; it ends with its terminator line, so a newline must follow. */
+function heredoc(r: () => number): string {
+    const [spec, tag, quoted] = pick(r, TAGS);
+    const lines: string[] = [];
+    for (let k = Math.floor(r() * 3); k > 0; k -= 1) {
+        lines.push(pick(r, [act(r), 'prose line', `  ${tag}`, ...(quoted ? [] : [`${tag.slice(0, 1)}\\`]), `${tag}x`]));
+    }
+    const tabbed = r() < 0.2;
+    const body = lines.map((l) => (tabbed ? `\t${l}` : l));
+    return `cat ${tabbed ? '<<-' : '<<'}${spec} > /dev/null\n${[...body, tabbed ? `\t${tag}` : tag].join('\n')}`;
+}
+
+function command(r: () => number): string {
+    let out = '';
+    let needNewline = false;
+    for (let k = 1 + Math.floor(r() * 4); k > 0; k -= 1) {
+        if (out !== '') out += needNewline ? '\n' : pick(r, ['; ', ' && ', ' | ', '\n', ' & ', ' || ']);
+        if (out.endsWith('&& ') || out.endsWith('|| ')) out = `${out}true; `;
+        const h = r() < 0.25;
+        out += h ? heredoc(r) : simple(r);
+        needNewline = h;
+    }
+    return out + (r() < 0.2 ? ' # trailing' : '');
+}
+
+const N = Number(process.env['SHELL_ACTS_FUZZ_N'] ?? 100);
+const FIRST = Number(process.env['SHELL_ACTS_FUZZ_SEED'] ?? 1);
+
+function bashAccepts(cmd: string): boolean {
+    return spawnSync('bash', ['-n', '-c', cmd], { encoding: 'utf8' }).status === 0;
+}
+
+describe.skipIf(!hasBash)('generated commands: the recogniser agrees with bash', () => {
+    it(`${N} seeded commands`, () => {
+        const mismatches: string[] = [];
+        let skipped = 0;
+        for (let seed = FIRST; seed < FIRST + N; seed += 1) {
+            const cmd = command(rng(seed));
+            if (!bashAccepts(cmd)) {
+                skipped += 1;
+                continue;
+            }
+            const want = bashActs(cmd);
+            const got = ACTS.filter((a) => commandRunsAct(cmd, a)).sort();
+            if (JSON.stringify(want) !== JSON.stringify(got)) mismatches.push(`seed ${seed}: ${JSON.stringify(cmd)} bash=${JSON.stringify(want)} recogniser=${JSON.stringify(got)}`);
+        }
+        expect(skipped).toBeLessThan(N * 0.05);
+        expect(mismatches).toEqual([]);
+    }, Math.max(120_000, N * 300));
+});
diff --git a/tests/scripts/shell_acts_bash_oracle.test.ts b/tests/scripts/shell_acts_bash_oracle.test.ts
new file mode 100644
index 0000000000..7a4d548351
--- /dev/null
+++ b/tests/scripts/shell_acts_bash_oracle.test.ts
@@ -0,0 +1,104 @@
+/**
+ * Shell-grounded oracle for the act recogniser: every case is run by real bash
+ * (`tests/_lib/bash_act_oracle.ts`). Each case also states the acts it expects, so the oracle checks
+ * false positives (an act the recogniser reports and bash never reaches) as well as
+ * misses, and a stub or fixture defect shows up as bash disagreeing with the case.
+ */
+import { describe, expect, it } from 'vitest';
+
+import { bashActs, C, G, hasBash, P } from '../_lib/bash_act_oracle.js';
+
+import { commandRunsAct } from '../../src/scripts/_lib/shell_acts.js';
+
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
+    // Round-5 counterexamples: an assignment is a prefix only before the command
+    // name or after `time` / `sudo`; a continuation inside a heredoc terminator is
+    // removed, as in any other word.
+    ['command X=1 git push', []],
+    ['nohup X=1 git push', []],
+    ['exec X=1 git push', []],
+    ['time X=1 git push', [P]],
+    ['sudo X=1 git push', [P]],
+    ['X=1 nohup git push', [P]],
+    ['nohup git push', [P]],
+    ['command git commit -m x', [C]],
+    ['cat <<EO\\\nF\nbody\nEOF\ngit push', [P]],
+    ['cat <<EO\\\nF\ngit push\nEOF', []],
+    // Round-6 counterexamples: a here-string is not a heredoc; an unquoted
+    // terminator's body joins backslash-newlines before the comparison; a quoted
+    // `time` is the time(1) program, not the keyword.
+    ['cat <<< "hello"\ngit push', [P]],
+    ['cat <<<hello; git push', [P]],
+    ['cat <<EOF\nbody\nE\\\nOF\ngit push\nEOF', [P]],
+    ["cat <<'EOF'\nbody\nE\\\nOF\ngit push\nEOF", []],
+    ['cat <<EOF\nE\\\\\nOF\ngit push\nEOF', []],
+    ['"time" X=1 git push', []],
+    ['"time" git push', [P]],
+    ["'nohup' git push", [P]],
+    // Found by the generated test: `time` is the keyword only at the start of a
+    // pipeline and of a command; elsewhere it is time(1).
+    ['echo a | time X=1 git push', []],
+    ['echo a | time git push', [P]],
+    ['true || time X=1 git push', [P]],
+    ['X=1 time Y=2 git push', []],
+    ['time -p git push', [P]],
+    ['time -p X=1 git push', [P]],
+    ['echo hi | time -p git push', [P]],
+    ['echo hi | time -p X=1 git push', []],
+    ['command -- git push', [P]],
+    ['nohup -- git push', [P]],
+    ['command -v git push', []],
+    ['command -V git commit -m x', []],
+];
+
+// CI must not pass this suite by skipping it.
+if (!hasBash && process.env['CI']) throw new Error('the bash oracle needs bash on CI');
+
+describe.skipIf(!hasBash)('the recogniser agrees with bash', () => {
+    it.each(CASES)('%j', (command, expected) => {
+        expect(bashActs(command)).toEqual([...expected].sort());
+        const recognised = [C, P, G].filter((act) => commandRunsAct(command, act)).sort();
+        expect(recognised).toEqual([...expected].sort());
+    });
+});
```
