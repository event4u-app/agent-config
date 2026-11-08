<!-- evidence-type: analysis -->

# Ratification review — act-time reference duty in a conditional chunk — round 17

You are an independent reviewer for a change in the `event4u/agent-config` repository. One file in it, `src/config/hook-bundle-budget.json`, is on the ratification gate's list (the hook bundle's byte budget), so the change needs a two-provider verdict under ADR-268 § 4.

subject: 0d375e89d95adb4b0bfb8b096d73f7500ef7698fa92171ae7a6bccf3511268ac

(The digest covers the gated file at commit `213947e4f5`, computed with `./scripts-run src/scripts/ratification_subject`.)

## What the change does

- **Act-reference table** `src/config/act-references.json` binds `git commit` → `commit-policy`, `git push` → `non-destructive-by-default` + `scope-control`, `gh pr create` → `scope-control`. Rule ids only, each with an owner; references come from each rule's own `load_context`. Chosen by council design round 2 (option B) over kernel frontmatter, which the rule schema forbids for router triggers. A test validates every binding (keys, owner, rule exists and has `load_context`).
- **Recogniser** `src/scripts/_lib/shell_acts.ts`: a one-pass lexer over quotes, escapes, continuations, comments, separators, heredocs, redirections and leading reserved words, then per simple command the assignment / wrapper prefix rules; its syntax contract is the file header. Checked against real bash by a curated oracle (155 cases) and a generated differential test. Spike over 14,834 real agent Bash calls: ≤ 0.1 % misses; a prefix match finds 17 % (`agents/evidence/analysis/shell-command-recognition-spike-2026-11-08.md`).
- **Observation** in the existing `reread-guard` concern (already bound on claude `pre_tool_use` for Bash; no binding change): a Bash command containing a bound act word records each bound rule's references as `read` / `required-pending` in the session ledger, observe-only. The raw command is never stored. A bound rule that cannot be read counts as `duty_errors`.
- **Conditional chunk:** the duty logic (router walk, frontmatter parse, table, recogniser) moved out of the dispatch bundle into `dist/hooks/reference_duty.chunk.cjs`. **Current: 20,247 B against a ceiling of 22,000 B** (registered at 18,200 B, raised to 20,600 B in round 7 and to 22,000 B in round 16, each with a `raise_log` entry). It loads only on a file write or a Bash command matching `ACT_WORDS` (a test keeps that in step with the table). **Bundle: 1,583,881 B** (after merging origin/main) (ceiling 1,585,000; 1,588,246 B with the logic inline). A missing or mis-digested chunk makes the hook count a duty error and observe nothing; the read ledger and advisories are unaffected. `ledgerKey` moved to `_lib/ledger_key.ts`, which stays in the bundle.

## The contract this round asks you to judge

Nine rounds each found shell syntax no list had named, and each was fixed with a case seen red first. A recogniser for bash written by hand will not be shown complete by enumeration, so this round states the contract as what is **measured**, not as a list of claims:

1. **Correctness is defined against bash on a stated grammar.** The generator in `tests/scripts/shell_acts_bash_fuzz.test.ts` is that grammar: prefixes and wrappers, quoting / escapes / continuations inside act words, redirections at any position (adjacent pairs, fd numbers, here-strings, operands that look like act words), continuations inside operators and separators, `!` / `{ }` / `if` compounds, comments, and heredocs with every terminator form placed on `cat` or among an act's words. On it, recogniser and bash must name the same acts; the curated oracle pins every counterexample any round found.
2. **Outside the grammar the recogniser is best effort,** and named so in its header: runtime-built commands, `eval`, `bash -c`, aliases, functions, subshell parentheses, `$(…)` and backticks are not interpreted. A miss produces no `duty_errors`.
3. **What the observation is for:** an advisory ledger entry that a bound rule's reference was due at a candidate act (some simple command names it; control flow is not evaluated). It blocks nothing, authorises nothing and changes no command's outcome. A false entry costs a reader's attention; a miss costs the advisory.
4. **A new counterexample** inside the grammar is a defect fixed like the nine before it; one outside it extends the grammar first. Either is a follow-up change, not a reason the observation must not exist.

Please judge whether this contract and its evidence are adequate **for an observe-only signal**, and name any counterexample **inside the stated grammar** you can construct, since that is what would falsify point 1.

## Round 16 and what changed

Round 16: both seats `refused` without a dealbreaker on the same case: `time >/dev/null ! git push` reported a push — the `!` after the `time` keyword skipped the redirection check that reserved words got in round 15. Searching for the pattern (grammar tokens after `time`) found a second instance neither seat named: `time >/dev/null -p git push` (bash runs `-p`). Measured in bash 3.2 and 5.2: after the `time` keyword, `-p` and `!` are grammar and a redirection before them breaks it; options of time(1), `command` and `nohup` are arguments, where a redirection changes nothing (`echo a | time >/dev/null -p git push` runs git; `command >/dev/null -v git push` runs nothing).

The generated test, given redirections on both sides of `!` after `time` and `time -p`, then found that **bash 5 reads any chain of `time`, `time -p` and `!` as the grammar prefix** (`time ! time X=1 git push`, `time time X=1 git push`, `! time ! X=1 git push` all run git; bash 3.2 runs none of them). Round 17:

- **One loop reads the grammar prefix**: leading reserved words, the `time` keyword and its `-p`, each counted only unquoted and before any redirection; `time` is the keyword at the start of a pipeline or after another prefix token, time(1) after `|` alone. Any later `time` is time(1). This replaces two special cases (reserved words, `!` after `time`) with one rule and removed the now-unused `ASSIGN_AFTER` set; the chunk shrank to 20,247 B.
- Pinned: 8 redirection/grammar cases and 5 chain cases (with bash 3.2 recorded where it reads fewer); 7 fail on the round-16 lexer. The generator places redirections before and after `!`, after `time` / `time -p`, and between `time` and `-p`. Seeds 120,001–121,500 agree with bash 5.2 (eight runs each); the curated oracle passes under 3.2 and 5.2.

## Round 15

Round 15 found `> /dev/null ! git push`: a redirection or assignment before a reserved word makes it an ordinary word (bash 3.2 and 5.2). Fixed and pinned. The chunk ceiling rose to 22,000 B with a second `raise_log` entry (a threshold raise, stated as one); origin/main was merged, keeping both sides of the `raise_log` conflict. Rollback criteria: revert if a counterexample inside the generator grammar stays unfixed past its next change, if the chunk cannot stay under its ceiling without dropping a pinned case, or if a ledger reader acts on candidates as executed acts.

## Round 14

Round 14: anthropic ratified (high); openai asked that the result be named a syntactic candidate per simple command. Header, `commandRunsAct` comment and unit tests (`exec git push; git commit`, `false && git push`) now say so.

## Round 13

Round 13: anthropic ratified; openai found `git 2&>/dev/null push` (a digit before `&>` is an argument in bash 3.2 and 5.2). Fixed and pinned; the generator gained `2&>/dev/null` and `1&>out`; seeds 100,001–101,000 agree with bash 5.2.

## Round 12

Round 12 (openai; anthropic timed out) read `nohup command exec git push` as a false positive under the oracle's `command` stub. A real Mac's `/usr/bin/command` runs sh's `command` builtin, so the chain runs git, as the recogniser reports; the stub was corrected and the chains pinned. An end-to-end hook test feeds a continued, here-string-carrying commit through pre-check, lexer and table.

## Round 11 and what changed

Round 11: anthropic `refused` (no dealbreaker), openai `refused` (dealbreaker) — two findings, both accepted.

- **Wrapper chains** (`exec exec git push` invented a push). Measured in bash 3.2 and 5.2: after `exec`, `nohup`, `sudo` or time(1) the next word is looked up as an **external program**, and there is no `exec` program, so `exec exec …` and `nohup exec …` run nothing; after the `command` builtin or the `time` keyword the shell lookup continues, so `command exec git push` and `time exec git push` run git. Whether `command(1)` and `time(1)` exist as programs differs by system (macOS has both, the ubuntu image neither); the recogniser takes them to exist — the larger set of potential acts — and the oracle models a POSIX system that has them (`command` and `time` stubs). The recogniser tracks the lookup context per word.
- **Branches behind a failed act.** The `git` and `gh` stubs now exit with a status the oracle varies: **eight runs** per command (`true`, `cond` and the act stubs each succeeding and failing), so `git push || git commit` reaches the commit. Curated cases: `git push || git commit -m x`, `true && { git push || gh pr create; }`, `git push && git commit || gh pr create`, plus eight wrapper-chain cases; the two `exec` chains fail on the round-11 lexer.
- **What the eight runs cannot model, stated:** branches whose reachability depends on the *same* status twice in one path (two `if cond` that must disagree, `!` over an act that a later `&&` needs, `command -v` whose status is the environment). The generator keeps its commands independent — a command after a generated `&&` / `||` starts behind `true;` — so it compares only what the oracle can decide; the curated oracle pins the act-after-act forms by hand. I tried letting acts chain directly; it produced exactly such correlation artefacts (bash reaching fewer acts than are statically reachable), so it was reverted.
- Generator prefixes gain `nohup nohup`, `command command`, `nohup command`, `time nohup`, `nohup time`. Seeds 90,001–91,200 agree with bash 5.2 (eight runs each); the curated oracle passes under bash 3.2 and 5.2.
- Chunk 20,528 B under the 20,600 B ceiling; no further raise.

## Round 10

Round 10: openai ratified; anthropic refused on a `<<-` case that bash 3.2 and 5.3 both decided as the recogniser had it (pinned). Checking under bash 5 found that bash 5 keeps `time` the keyword after every reserved-word opener; the recogniser follows bash 5, the oracle records where 3.2 differs, the harness can run in a container (`BASH_ORACLE_IMAGE=ubuntu:24.04`), and the generated test needs bash ≥ 4 (required on Linux CI).

## Round 9

Round 9 refused on `cat <<\⏎ EOF`; round 10 made the lexer read every operator and the blanks before a terminator across backslash-newline, as bash does.

## Round 8

Round 8 (openai; the anthropic seat timed out) found `git 2>&1<<EOF push`: a pending redirection operand now outranks the fd reading of a digit word, and heredocs are generated among an act's words and beside other redirections.

## Rounds 1–7

Each refused on concrete syntax and each was fixed with a case seen red first: separators, comments, `git -C` values, heredoc terminators (quoted, escaped, empty, continued), double-quote escapes, quoted and positional assignments (`'X=1' git push`, `nohup X=1 git push`), here-strings, `time` as keyword vs time(1), redirection operands, reserved words. Round 7 added the generated differential test and raised the chunk ceiling 18,200 → 20,600 B with a `raise_log` entry. Rollback is revert, rebuild, release; `duty_errors` counts load and read failures only. All earlier questions are committed beside this one.

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

## The diff

`git diff origin/main...feat/act-references` for the gated budget and the recogniser; for the two test files, only the change since round 15 (`git diff e0391325a0 HEAD`). Unchanged since round 13: `tests/_lib/bash_act_oracle.ts` (but two comment words); since round 5: `src/config/act-references.json`, `_lib/reference_duty.ts`, `hooks/reference_duty_loader.ts`, `hooks/reread_guard_hook.ts`; since round 1: `_lib/ledger_key.ts`, `hook_chunks.mjs`, `rule_reference_requires.ts`.

```diff
diff --git a/src/config/hook-bundle-budget.json b/src/config/hook-bundle-budget.json
index 72ebb16456..ce8d654b20 100644
--- a/src/config/hook-bundle-budget.json
+++ b/src/config/hook-bundle-budget.json
@@ -200,6 +200,26 @@
             "what_was_added": "The switch question near a plan limit: `_lib/switch_relay.ts` (raise a request for this session over `agent-switch switch request --session … --by ac --json`, read it back with `switch show`, parse the version-1 request, the per-session record of what was told, the user's line and the model's `additional_context` naming the id and that only the user decides) and the link discovery it gates on (`_lib/agent_switch_link.ts` with the hardened spawn environment of `_lib/spawn_env.ts`). Measured 38,720 B against 22,772 B on origin/main d783496af2, both readings by this gate; ceiling 41,000 B leaves 2,280 B, about 6 % of the reading; any growth past it is caught by this gate.",
             "why_it_could_not_be_avoided": "The feature is this concern's: the raise follows the same hot-window reading the notice already makes, on the same prompt, and the relay has to run on every prompt while a request is open. The cheaper paths were taken first. The MCP client (`agent_switch_client.ts`) stays out: its lazy SDK import would inline the SDK into the chunk, so the hook reaches agent-switch over the synchronous CLI verbs the contract already defines. The checkpoint before a move, which needs the settings cascade and the run-claim reader (measured at about 466 KB with them, the yaml parser among them), lives in the `session-eol` Stop path that already carries both, not here. A second lazily-required chunk for the relay alone was considered and refused: it would load on every prompt that has a request open and every prompt with a hot window, which is when this code runs anyway, and it would add a loader and a second budget entry for no byte this concern does not need.",
             "what_would_have_caught_it": "Nothing earlier: the growth is the feature."
+        },
+        {
+            "date": "2026-11-08",
+            "chunk": "src/scripts/_lib/reference_duty.ts",
+            "from": 18200,
+            "to": 20600,
+            "by": "agent, feat/act-references (road-to-a-reference-that-arrives-before-the-act), ratification rounds 4-6",
+            "what_was_added": "Shell syntax the act recogniser had to honour to agree with bash, each found by a ratification seat or by the generated bash differential test: one quote reader shared by words and heredoc terminators (escaped and empty terminators), assignment words carrying their quoting and position (`'X=1' git push`, `nohup X=1 git push`), backslash-newline joins in terminators and in unquoted heredoc bodies, here-strings, `time` as the keyword only unquoted at the start of a pipeline, the `time -p` / `command --` / `nohup --` / `command -v` forms, and in round 7 every redirection dropped with its operand wherever it stands. Measured 17,148 B before round 4, 18,774 B after round 6, 20,566 B after round 7.",
+            "why_it_could_not_be_avoided": "Every addition closes a false observation or a swallowed act that real bash disagrees with; the alternative is a recogniser whose stated syntax contract is false. The chunk loads only on a file write or a Bash command carrying a bound act word, so no other dispatch pays these bytes; the dispatch bundle is unchanged at 1,582,782 B.",
+            "what_would_have_caught_it": "The generated differential test that now ships with the recogniser (`tests/scripts/shell_acts_bash_fuzz.test.ts`), had it existed before the 18,200 ceiling was set: it found the pipeline-`time` class on its first run. Sized to the round-6 reading plus about 10 %."
+        },
+        {
+            "date": "2026-11-08",
+            "chunk": "src/scripts/_lib/reference_duty.ts",
+            "from": 20600,
+            "to": 22000,
+            "by": "agent, feat/act-references (road-to-a-reference-that-arrives-before-the-act), ratification rounds 8-15",
+            "what_was_added": "Shell syntax the recogniser needed to agree with bash after the 20,600 raise, each found by a ratification seat or by the generated bash test and pinned in the oracle: redirections dropped with their operands at any position (fd numbers, here-strings, a pending operand outranking a digit word, no fd before `&>`), operators and heredoc terminators read across backslash-newline, leading reserved words opening a command only before any redirection, `time` as keyword per bash 5 after every opener, and the lookup context that makes `exec` after `exec` / `nohup` / `sudo` / time(1) a program name. Measured 18,774 B at the 20,600 raise, 20,607 B after round 15.",
+            "why_it_could_not_be_avoided": "Each addition closes a false or missed candidate that bash 3.2 and 5.2 disagree with; trimming code to fit would reopen one of them. The chunk loads only on a file write or a Bash command carrying a bound act word; the dispatch bundle is unchanged at 1,582,782 B.",
+            "what_would_have_caught_it": "Sizing the ceiling to the parser's eventual scope rather than to one round's reading: a hand-written bash lexer kept growing for eight rounds after the first raise. Sized to the round-15 reading plus about 7 %, so the next fix does not need a raise of its own."
         }
     ],
     "chunks": [
@@ -286,6 +306,12 @@
             "max_bytes": 61600,
             "registered_at": "2026-11-04",
             "derivation": "Measured 55,991 bytes on 2026-11-04 for the roadmap agents/roadmaps/archive/road-to-a-noted-that-is-a-write.md. The chunk holds the self-repair concern, its four detectors including persistence-claim, the record store with the target and subject indexes, and the Class-A telemetry shadow (emitDefectShadow: a structural-fields-only copy of a queued record for the org telemetry pack, inert unless that pack activated telemetry); `yaml` is external, resolved from the installed package as for the chat_history, update_notice and star_ask chunks. The ceiling is that reading plus about 10 %, rounded, the same margin as the quota_notice and intake_pass rows. The margin approves no planned code: a later addition to the chunk is measured and reviewed on its own change. WHY IT WAS MOVED: the dispatch bundle sat 14 bytes under its 1,582,000 ceiling at origin/main b53718de2 (measured 1,581,986 B by this gate with APFS-cloned node_modules), and the roadmap's detector work had to land somewhere. The concern built alone was 51,156 bytes before the work; moving it out, as the 2026-10-18 council chose for this situation, took the dispatch bundle to 1,557,293 B (-24,693 B, the rest being modules other concerns still import) instead of raising the dispatch ceiling. Bound on `user_prompt_submit` and `stop`; the bundle carries only its LAZY_CONCERNS row. A missing or mis-digested chunk falls back to spawning the same script, which is slower; tests/hooks/self_repair_lazy_paths.test.ts pins that the loader path and the spawn fallback write the same record, and that the built dispatcher falls back to the spawn exactly once with the chunk missing. On either path a failure of the concern does not reject the hook event (`fail_closed: false`, unchanged by this move); the dispatcher still writes that run's exit code to agents/runtime/state/.dispatcher/<session>/self-repair.json, which is where a failing concern is visible."
+        },
+        {
+            "entry": "src/scripts/_lib/reference_duty.ts",
+            "max_bytes": 22000,
+            "registered_at": "2026-11-08",
+            "derivation": "Registered at 16,523 bytes on 2026-11-08 (15,080 before ratification round 1 replaced the segmenter with a quote-, escape-, comment- and heredoc-aware lexer); raised to 20,600 after ratification round 6 measured 18,774 bytes, and to 22,000 after round 15 measured 20,607 bytes; both raises and what was added are the raise_log entries naming this chunk; the raise and what was added are the raise_log entry naming this chunk for road-to-a-reference-that-arrives-before-the-act. The chunk holds the reference duty: the router walk with trigger_matches, the rule-frontmatter parse, the act-reference table and the shell-act recogniser; `yaml` is external, resolved from the installed package as for the chat_history chunk. The ceiling was the registered reading plus about 10 %, rounded, the margin of the quota_notice, intake_pass and self_repair rows. WHY IT IS A CHUNK: adding the act-time duty in the dispatch bundle measured 1,588,246 B against the 1,585,000 B ceiling (real node_modules install); the duty runs only on a file write or on a Bash command containing a bound act word (`reference_duty_loader.ACT_WORDS`), so it does not belong in the bytes every hook event loads. The bundle keeps the loader, the act-word pre-check and `_lib/ledger_key.ts`. A missing or mis-digested chunk makes the hook count a duty error instead of observing; the guard's read ledger and advisories are unaffected."
         }
     ],
     "chunks_note": "A chunk is loaded only when a caller needs it, so its bytes are not paid by every dispatch; its ceiling exists so that the move out of dispatch.js stays a measured place rather than an unmeasured one. The gate builds each chunk with the exact esbuild segment `build:hook-chunks` uses for its entry.",
diff --git a/src/scripts/_lib/shell_acts.ts b/src/scripts/_lib/shell_acts.ts
new file mode 100644
index 0000000000..63330b1cff
--- /dev/null
+++ b/src/scripts/_lib/shell_acts.ts
@@ -0,0 +1,349 @@
+/**
+ * Identifies the shell acts (`git commit`, …) an agent's Bash command names: a
+ * syntactic candidate per simple command, not a claim that the command reaches it.
+ * Correctness is measured against bash on the grammar of
+ * `tests/scripts/shell_acts_bash_fuzz.test.ts`; beyond it the result is best effort.
+ *
+ * Agents chain: a prefix match finds 17 % of commits in real transcripts, so the
+ * command is lexed into simple commands of words. One pass honours single and
+ * double quotes, backslash escapes, `#` comments, line continuations, and the
+ * separators `;` `&&` `||` `|` `&` and newline outside quotes. A heredoc operator
+ * outside quotes queues its terminator (one word after quote removal, read by the
+ * same quote reader as every other word, and empty when quoted as `''`); the
+ * bodies follow the line in order, each ending at the line that is exactly its
+ * terminator (leading tabs stripped for `<<-`; with an unquoted terminator, body
+ * lines joined across backslash-newline first). Every other redirection (`>`, `>>`,
+ * `<`, `<>`, `>|`, `>&`, `<&`, `&>`, `&>>`, the here-string `<<<`, each with an
+ * optional fd number) is dropped together with its operand word, wherever it stands.
+ *
+ * Supported syntax contract: the above, plus `VAR=…` prefixes, `sudo`/`command`/
+ * `time`/`exec`/`nohup`, and `git -C`/`-c` values. An assignment prefix is only one
+ * whose `NAME=` is unquoted and that stands before the command name or after
+ * `time` / `sudo`: `'X=1' git push` and `nohup X=1 git push` run a command named `X=1`.
+ * `time` is the keyword only unquoted at the start of a pipeline; `-p` after any `time`, and `--`
+ * after `command` / `nohup`, are skipped; `command -v` / `-V` run nothing. Other
+ * wrapper options (`sudo -u …`, `command -p`) are not interpreted. Leading unquoted
+ * reserved words (`!`, `{`, `if`, `then`, `else`, `elif`, `do`, `while`, `until`) open
+ * the command rather than name it. After `exec` / `nohup` / `sudo` / time(1) a
+ * following `exec` is a program name, not a wrapper. Where bash versions differ,
+ * this follows bash 5. Not interpreted: `$(…)` and
+ * backticks (their text stays inside the word), subshell parentheses, `eval`,
+ * aliases, functions, `bash -c` strings. Per command, leading
+ * `VAR=…` assignments and `sudo`/`command`/`time`/`exec`/`nohup` are dropped and
+ * `git -C <dir>` / `git -c k=v` are skipped, quoted values included.
+ *
+ * A match is a candidate act: some simple command names it. Control flow is not
+ * evaluated, so a branch that never runs still counts, and so does a command after
+ * `exec git push;`, which ends the shell.
+ * Not recognised, by design: commands built at runtime (`eval`, `$CMD`), aliases
+ * and shell functions, wrappers that run git themselves, and `bash -c "…"`. A
+ * recognised act is a fact about the command; an unrecognised one is no evidence
+ * that none ran.
+ */
+
+const PREFIX_WORDS = new Set(['sudo', 'command', 'time', 'exec', 'nohup']);
+// Reserved words that open a command list or a pipeline; unquoted and leading,
+// the command proper starts after them (`if true; then git push; fi`, `! git push`).
+const LEADING_RESERVED = new Set(['!', '{', 'if', 'then', 'else', 'elif', 'do', 'while', 'until']);
+
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
+/**
+ * A simple command's words; whether it follows a `|` inside a pipeline; and the
+ * index of the word the first redirection stood before (-1 if none), since a
+ * redirection before `time` keeps it from being the keyword.
+ */
+interface Simple {
+    words: Word[];
+    piped: boolean;
+    redirectAt: number;
+}
+
+function lexCommands(command: string): Simple[] {
+    const out: Simple[] = [];
+    let piped = false;
+    let redirectAt = -1;
+    let words: Word[] = [];
+    let word = '';
+    let inWord = false;
+    // Length of the word's leading unquoted, unescaped run; -1 while no quote or
+    // escape has occurred in it. An assignment's `NAME=` must fit inside that run.
+    let literal = -1;
+    const pendingHeredocs: Array<{ tag: string; stripTabs: boolean; quoted: boolean }> = [];
+    // Set by a redirection operator: the next word is its operand, not an argument.
+    let operand = false;
+    const endWord = (): void => {
+        if (inWord && operand) operand = false;
+        else if (inWord) {
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
+    // Before a redirection operator, a word of digits is its file descriptor —
+    // unless an earlier operator is still waiting for its operand, which that
+    // word then is (`2>&1<<EOF`: `1` belongs to `>&`).
+    const endWordBeforeRedirect = (): void => {
+        if (inWord && !operand && literal === -1 && /^\d+$/.test(word)) {
+            word = '';
+            inWord = false;
+        } else endWord();
+    };
+    const endCommand = (nextPiped = false): void => {
+        endWord();
+        operand = false;
+        if (words.length > 0) out.push({ words, piped, redirectAt });
+        words = [];
+        piped = nextPiped;
+        redirectAt = -1;
+    };
+    const n = command.length;
+    // Bash removes backslash-newline before it reads operators, so one may stand
+    // inside `<<`, `&&`, `2>&1` or before a heredoc terminator. `skip` steps over
+    // them; `next(j)` is the index of the next real character after `j`.
+    const skip = (j: number): number => {
+        while (command[j] === '\\' && command[j + 1] === '\n') j += 2;
+        return j;
+    };
+    const next = (j: number): number => skip(j + 1);
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
+        if (ch === '<' && command[next(i)] === '<' && command[next(next(i))] !== '<') {
+            endWordBeforeRedirect();
+            if (redirectAt === -1) redirectAt = words.length;
+            let j = next(next(i));
+            const stripTabs = command[j] === '-';
+            if (stripTabs) j = next(j);
+            while (command[j] === ' ' || command[j] === '\t' || (command[j] === '\\' && command[j + 1] === '\n')) j += command[j] === '\\' ? 2 : 1;
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
+            i = j;
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
+        // Any other redirection, a here-string `<<<` included: the operator and its
+        // operand word are dropped, wherever they stand among the arguments.
+        if (ch === '<' || ch === '>' || (ch === '&' && command[next(i)] === '>')) {
+            // `&>` takes no fd number: in `git 2&>/dev/null push` the 2 is an argument.
+            if (ch === '&') endWord();
+            else endWordBeforeRedirect();
+            if (redirectAt === -1) redirectAt = words.length;
+            // The operator's characters, continuations between them removed.
+            const at = [i, next(i), next(next(i))];
+            const text = at.map((k) => command[k] ?? '').join('');
+            const op = /^(?:&>>|&>|<<<|>>|>\||>&|<&|<>|>|<)/.exec(text) as RegExpExecArray;
+            i = (at[op[0].length - 1] as number) + 1;
+            operand = true;
+            continue;
+        }
+        if (ch === ';' || ch === '|' || (ch === '&' && command[next(i)] === '&')) {
+            const double = (ch === '&' || ch === '|') && command[next(i)] === ch;
+            endCommand(ch === '|' && !double);
+            i = double ? next(i) + 1 : i + 1;
+            continue;
+        }
+        // A lone `&` backgrounds the command before it (`>&` and `&>` are redirections, read above).
+        if (ch === '&') {
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
+function normalise({ words, piped, redirectAt }: Simple): string[] {
+    // The grammar prefix of a command, as bash 5 reads it: any sequence of leading
+    // reserved words (`!`, `{`, `if`, …) and the `time` keyword with its `-p`. Each
+    // counts only unquoted and before any redirection (`>f ! git push` runs `!`).
+    // `time` is the keyword at the start of a pipeline or after another prefix
+    // token; after `|` alone it is time(1). Bash 3.2 reads fewer of these.
+    let k = 0;
+    let prefixed = false;
+    const grammar = (j: number): boolean => {
+        const w = words[j];
+        return w !== undefined && !w.quoted && (redirectAt === -1 || redirectAt > j);
+    };
+    while (grammar(k)) {
+        const w = (words[k] as Word).text;
+        if (LEADING_RESERVED.has(w)) k += 1;
+        else if (w === 'time' && (prefixed || !piped)) {
+            k += 1;
+            if (grammar(k) && (words[k] as Word).text === '-p') k += 1;
+        } else break;
+        prefixed = true;
+    }
+    // A quoted `'X=1'` is a command name, not an assignment: bash runs `X=1`.
+    let assignOk = true;
+    // After `exec`, `nohup`, `sudo` or time(1) the next word is looked up as an
+    // external program, and there is no `exec` program: `exec exec git push` runs
+    // nothing. `command` and `time` exist as programs on POSIX systems and are
+    // taken to (the larger set of candidate acts).
+    let external = false;
+    while (k < words.length) {
+        const w = words[k] as Word;
+        if (w.assign && assignOk) k += 1;
+        else if (PREFIX_WORDS.has(w.text) && !(external && w.text === 'exec')) {
+            // Every keyword `time` was taken above; one here is time(1), after which
+            // `X=1` is the command name.
+            // sudo(8) applies `VAR=value` arguments; after `command`, `exec`, `nohup`
+            // and time(1) an assignment is the name of the command run.
+            assignOk = w.text === 'sudo';
+            external = w.text === 'exec' || w.text === 'nohup' || w.text === 'sudo' || w.text === 'time';
+            k += 1;
+            const next = words[k]?.text;
+            // `command -v` / `-V` only describe the command; they run nothing.
+            if (w.text === 'command' && (next === '-v' || next === '-V')) return [];
+            // Options of time(1), `command` and `nohup` are arguments: a redirection
+            // before them changes nothing.
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
+    // Each simple command is judged on its own; nothing evaluates control flow, so
+    // `exec git push; git commit` names both acts although exec ends the shell.
+    return lexCommands(command).some((simple) => {
+        const w = normalise(simple);
+        return want.every((x, i) => w[i] === x);
+    });
+}
diff --git a/tests/scripts/shell_acts_bash_fuzz.test.ts b/tests/scripts/shell_acts_bash_fuzz.test.ts
index eae62a29af..9f2a3a5849 100644
--- a/tests/scripts/shell_acts_bash_fuzz.test.ts
+++ b/tests/scripts/shell_acts_bash_fuzz.test.ts
@@ -69,7 +69,10 @@ function simple(r: () => number): string {
     // across the oracle's runs of `cond`.
     // A comment would swallow the closing `}` / `fi`, so commented forms stay bare.
     if (s.includes('#')) return lead;
-    return pick(r, [lead, lead, lead, `! ${s}`, `{ ${s}; }`, `if cond; then ${s}; fi`, `if cond; then ${s}; else ${act(r)}; fi`]);
+    // A redirection before `!` makes it an ordinary word (`>out ! git push` runs `!`).
+    // Redirections on either side of `!`, after `time` and `time -p` too.
+    const t = pick(r, ['', '', 'time ', 'time -p ']);
+    return pick(r, [lead, lead, lead, `${t}! ${s}`, `${t}${pick(r, REDIRECTS)} ! ${s}`, `${t}! ${pick(r, REDIRECTS)} ${s}`, `time ${pick(r, REDIRECTS)} -p ${s}`, `{ ${s}; }`, `if cond; then ${s}; fi`, `if cond; then ${s}; else ${act(r)}; fi`]);
 }
 
 /**
diff --git a/tests/scripts/shell_acts_bash_oracle.test.ts b/tests/scripts/shell_acts_bash_oracle.test.ts
index 46e052b7d1..8aeadc42fb 100644
--- a/tests/scripts/shell_acts_bash_oracle.test.ts
+++ b/tests/scripts/shell_acts_bash_oracle.test.ts
@@ -146,6 +146,30 @@ const CASES: Array<[string, string[]]> = [
     ['git 2&>/dev/null push', []],
     ['git 2&>/dev/null commit -m x', []],
     ['git 2>/dev/null push', [P]],
+    // Round-15 counterexample: a redirection (or an assignment) before a reserved
+    // word makes it an ordinary word, in bash 3.2 and 5.2 alike.
+    ['> /dev/null ! git push', []],
+    ['X=1 ! git push', []],
+    ['! >/dev/null git push', [P]],
+    ['{ >/dev/null git push; }', [P]],
+    // Round-16 counterexample and its pattern: after the `time` keyword, `-p` and
+    // `!` are grammar, broken by a redirection before them; options of time(1),
+    // `command` and `nohup` are arguments, where a redirection changes nothing.
+    ['time >/dev/null ! git push', []],
+    ['time ! >/dev/null git push', [P]],
+    ['time >/dev/null -p git push', []],
+    ['time -p >/dev/null ! git push', []],
+    ['time -p ! >/dev/null git push', [P]],
+    ['echo a | time >/dev/null -p git push', [P]],
+    ['command >/dev/null -v git push', []],
+    ['nohup >/dev/null -- git push', [P]],
+    // Found by the generated test: bash 5 reads any sequence of `time`, `time -p`
+    // and `!` as the grammar prefix; bash 3.2 reads none of these chains.
+    ['time ! time X=1 git push', [P]],
+    ['time time X=1 git push', [P]],
+    ['time -p time X=1 git push', [P]],
+    ['! time ! X=1 git push', [P]],
+    ['time ! ! X=1 git push', [P]],
     ['git push || git commit -m x', [C, P]],
     ['true && { git push || gh pr create -t t; }', [G, P]],
     ['git push && git commit -m x || gh pr create -t t', [C, G, P]],
@@ -186,6 +210,11 @@ const BASH3: Record<string, string[]> = {
     'if time X=1 git push; then :; fi': [],
     'while time X=1 git push; do break; done': [],
     '{ ! time X=1 git push; }': [],
+    'time ! time X=1 git push': [],
+    'time time X=1 git push': [],
+    'time -p time X=1 git push': [],
+    '! time ! X=1 git push': [],
+    'time ! ! X=1 git push': [],
 };
 
 describe.skipIf(!hasBash)('the recogniser agrees with bash', () => {
```
