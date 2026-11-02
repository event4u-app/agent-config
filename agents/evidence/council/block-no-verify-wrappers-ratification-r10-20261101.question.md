<!-- evidence-type: analysis -->

# Ratification review — block-no-verify reads git behind exec wrappers — round 10

You are an independent reviewer for a change in the `event4u/agent-config` repository. One file, `src/scripts/hooks/block_no_verify.ts`, is the PreToolUse guard that refuses `git … --no-verify` and hook-disabling overrides. It is on the ratification gate's list, so the change needs a two-provider verdict under ADR-268 § 4: an agent may change that file but may not ratify its own change.

subject: 98d7f1682dc47bc3e540b746f5519b189a7347ce146d04717f8df8c3b8ae0914

(The digest covers `src/scripts/hooks/block_no_verify.ts` at commit `6e30e81d09`, computed with `./scripts-run src/scripts/ratification_subject`.)

## Background

At `2ccb435632` the guard's command-position test skipped only leading `VAR=value` assignments and required the literal token `git`. Reproduced: `env git commit --no-verify`, `sudo git …`, `nice git …`, `/usr/bin/git …`, `sh -c 'git commit --no-verify'`, `eval '…'`, `git --config-env=core.hooksPath=X commit` and `GIT_CONFIG_KEY_0=core.hooksPath … git commit` were all allowed; the plain form was refused. A planned shared shell segmenter (`later/road-to-a-hard-floor-the-shell-cannot-talk-past` Phase 1) will replace this parser; this change closes the reproduced class in the meantime.

## The current design

1. **`_unwrap(tokens)`** returns the argument vector as the command runs it plus where its command starts. It peels assignments and a closed table of exec wrappers (`env command exec builtin nice nohup time sudo doas stdbuf timeout xargs`) with each wrapper's value-taking options. GNU `env -S` is modelled with env's own semantics: the string (`\_` decoded) is split and expanded **in place**, and the scan continues over the expanded words — assignments, env options, the command. A split string with `$` or another backslash escape, or one that does not split, is reported unreadable. `command -v`/`-V` (only `command`'s own options) is reported as a lookup, which runs nothing. Sixteen peeled wrappers stop the scan and report exhaustion.
2. **Hook-disabling assignments** met on the way are reported: `GIT_CONFIG_KEY_<n>=core.hooksPath`, a `GIT_CONFIG_PARAMETERS` value naming it, `HUSKY=0`.
3. **`_git_base`** reads git at the resolved start (path prefixes accepted). **After a wrapper**, a head that is not git does not clear the segment: the first later token whose basename is `git` is read as git, so an option spelling the table misses cannot hide git; the table decides only false refusals.
4. **`_shell_payload`** reads `sh|bash|zsh|ksh|dash|csh|tcsh|fish|pwsh -c '<payload>'` and `eval` at the start, and after a wrapper also past an unresolved head; the payload is checked recursively (depth bound 3).
5. **`_check_command`**, per segment: an exhausted scan → refused; an unreadable `-S` string → refused; a hook-disabling assignment with a payload that invokes git → refused; the payload is checked, **and then** the segment's git is checked too (either refuses); a hook-disabling assignment in front of git → refused; `--config-env core.hooksPath=…` is read in `_is_blocked`.

**Stated prices** (pinned by tests): a wrapped command with a `git` operand (`timeout 5 echo git commit --no-verify`), or with an interpreter-shaped operand whose payload is refused (`env printf '%s\n' sh -c 'git commit --no-verify'`), is refused; any `env -S` string with an expansion is refused; sixteen or more stacked wrappers are refused whatever follows. A hooksPath assignment is refused whatever its value. No existing refusal is removed.

**Not addressed, and stated:** symlinked or Windows-path git, wrappers outside the table that are not followed by a literal `git` token, nesting deeper than 3 — the shared segmenter's job.

## Review history (rounds 1–9)

Prompts `agents/evidence/council/block-no-verify-wrappers-ratification-r1…r9-20261101.question.md`. anthropic ratified rounds 1–7 and timed out in 8–9. openai refused each round with a concrete counterexample, every one fixed with its own regression row: (1) env state lost across `sh -c`, `xargs --replace`, `command -v` false refusal; (2) `-v` after the executable, `xargs --max-lines 1`; (3) `env -S'…'`, `stdbuf --output L` — answered by the fallback in design point 3 instead of more rows; (4) `-S` consumed twice, interpreter behind an unresolved head; (5) a payload in git's operands skipped the git check; (6) `env -S 'sh -c' '…'` boundaries; (7) env's `\_` separator and escapes; (8) a later `-S` replaced an earlier one — answered by in-place expansion; (9) the scan stopped after sixteen wrappers and lost a later assignment or `-S` — now refused.

Tests: 60 refused shapes, 21 allowed controls, pinned policies for stacked wrappers and the fallback's prices. Each round's rows were seen red before its fix. All 184 tests of the file and all 1035 hook tests pass.

## The diff (guard only; the test file adds the rows named above)

```diff
diff --git a/src/scripts/hooks/block_no_verify.ts b/src/scripts/hooks/block_no_verify.ts
index 8a5caab088..2db5d47c43 100644
--- a/src/scripts/hooks/block_no_verify.ts
+++ b/src/scripts/hooks/block_no_verify.ts
@@ -56,6 +56,7 @@ const _GIT_GLOBAL_OPTS_WITH_VALUE: ReadonlySet<string> = new Set([
     '-C',
     '-c',
     '--config',
+    '--config-env',
     '--git-dir',
     '--work-tree',
     '--namespace',
@@ -260,13 +261,203 @@ function _split_subcommands(tokens: string[]): string[][] {
     return groups;
 }
 
-function _git_base(tokens: string[]): string[] | null {
+/**
+ * Commands that run their remaining arguments as a command, with the options
+ * that consume the NEXT token as their value. An option whose argument is
+ * optional (GNU `xargs --replace`) takes it only attached (`--replace=x`), so
+ * it is deliberately absent here: listing it would swallow the command after it
+ * (council round 1). Without this table, `env git commit --no-verify` put `env`
+ * in command position and the guard saw no git (release review 19.2.0, M7).
+ */
+const _EXEC_WRAPPERS: ReadonlyMap<string, { readonly withValue: ReadonlySet<string>; readonly positional: number }> =
+    new Map([
+        ['env', { withValue: new Set(['-u', '--unset', '-C', '--chdir', '-S', '--split-string']), positional: 0 }],
+        ['command', { withValue: new Set<string>(), positional: 0 }],
+        ['exec', { withValue: new Set(['-a']), positional: 0 }],
+        ['builtin', { withValue: new Set<string>(), positional: 0 }],
+        ['nice', { withValue: new Set(['-n', '--adjustment']), positional: 0 }],
+        ['nohup', { withValue: new Set<string>(), positional: 0 }],
+        ['time', { withValue: new Set(['-f', '--format', '-o', '--output']), positional: 0 }],
+        ['sudo', { withValue: new Set(['-u', '--user', '-g', '--group', '-h', '--host', '-p', '--prompt', '-C', '--close-from', '-D', '--chdir', '-r', '--role', '-t', '--type', '-T', '--command-timeout', '-U', '--other-user']), positional: 0 }],
+        ['doas', { withValue: new Set(['-u', '-C']), positional: 0 }],
+        ['stdbuf', { withValue: new Set(['-i', '-o', '-e']), positional: 0 }],
+        ['timeout', { withValue: new Set(['-s', '--signal', '-k', '--kill-after']), positional: 1 }],
+        ['xargs', { withValue: new Set(['-a', '-d', '-E', '-I', '-L', '-n', '-P', '-s', '--arg-file', '--delimiter', '--max-args', '--max-procs', '--max-chars', '--process-slot-var']), positional: 0 }],
+    ]);
+
+/** Interpreters whose `-c <payload>` is a command list (`sh -c '…'`). */
+const _SHELL_RE = /^(?:ba|z|k|da|c|tc|fi|pw)?sh$/;
+
+/** An assignment that switches hooks off: `GIT_CONFIG_KEY_<n>=core.hooksPath`, a `GIT_CONFIG_PARAMETERS` value naming it, or `HUSKY=0`. */
+function _env_sets_hookspath(token: string): boolean {
+    const eq = token.indexOf('=');
+    const name = token.slice(0, eq);
+    const value = token.slice(eq + 1);
+    if (/^GIT_CONFIG_KEY_\d+$/.test(name)) return /^core\.hooksPath$/i.test(value.trim());
+    if (name === 'GIT_CONFIG_PARAMETERS') return /core\.hooksPath/i.test(value);
+    // Husky's documented off switch: the hooks it installs exit before running.
+    if (name === 'HUSKY') return value.trim() === '0';
+    return false;
+}
+
+function _basename(token: string): string {
+    const slash = token.lastIndexOf('/');
+    return slash === -1 ? token : token.slice(slash + 1);
+}
+
+/**
+ * Where the command in `tokens` really starts once env assignments and exec
+ * wrappers are peeled off, plus any assignment that disables hooks on the way.
+ */
+export function _unwrap(tokens: string[]): {
+    /** The argument vector as the command runs it: `env -S` strings expanded in place. */
+    argv: string[];
+    start: number;
+    hookspathEnv: string | null;
+    /** At least one wrapper was peeled, so `start` rests on the option table. */
+    wrapped: boolean;
+    /** `command -v` / `-V`: a lookup, which runs nothing. */
+    lookup: boolean;
+    /** An `env -S` string this guard cannot read (`${VAR}`, an escape other than `\_`). */
+    unreadableSplit: string | null;
+    /** More stacked wrappers than the guard reads; nothing after them was interpreted. */
+    exhausted: boolean;
+} {
+    let argv = [...tokens];
     let i = 0;
-    while (i < tokens.length && _is_env_assignment(tokens[i] as string)) {
+    let hookspathEnv: string | null = null;
+    let wrapped = false;
+    const done = (lookup: boolean, unreadableSplit: string | null = null, exhausted = false) => ({
+        argv,
+        start: i,
+        hookspathEnv,
+        wrapped,
+        lookup,
+        unreadableSplit,
+        exhausted,
+    });
+    for (let guard = 0; guard < 16; guard += 1) {
+        while (i < argv.length && _is_env_assignment(argv[i] as string)) {
+            if (hookspathEnv === null && _env_sets_hookspath(argv[i] as string)) hookspathEnv = argv[i] as string;
+            i += 1;
+        }
+        const head = _basename(argv[i] ?? '');
+        const spec = _EXEC_WRAPPERS.get(head);
+        if (spec === undefined) return done(false);
+        // `command -v` / `-V` looks a name up; it runs nothing. Only `command`'s
+        // own options count: `-v` after the executable is that program's flag.
+        if (head === 'command') {
+            let k = i + 1;
+            let lookup = false;
+            while (k < argv.length && (argv[k] as string).startsWith('-') && argv[k] !== '--') {
+                if (/^-[a-zA-Z]*[vV]/.test(argv[k] as string)) lookup = true;
+                k += 1;
+            }
+            if (lookup) return done(true);
+        }
+        wrapped = true;
         i += 1;
+        while (i < argv.length && (argv[i] as string).startsWith('-')) {
+            const opt = argv[i] as string;
+            if (head === 'env') {
+                // GNU env splits an `-S` string into arguments IN PLACE and goes on
+                // parsing them — options, assignments, the command — exactly as if
+                // they had been typed (council rounds 6-8). So the string is
+                // expanded into argv here and the scan continues over it, which
+                // is what makes `-S 'git …' -S echo` and `-S 'sh -c' '…'` read
+                // the way env runs them.
+                const bundle = opt.startsWith('--') ? null : /^-([a-zA-Z]*)S(.*)$/.exec(opt);
+                let raw: string | null = null;
+                let consumed = 0;
+                let keep: string[] = [];
+                if (opt.startsWith('--split-string=')) {
+                    raw = opt.slice('--split-string='.length);
+                    consumed = 1;
+                } else if (opt === '--split-string') {
+                    raw = argv[i + 1] ?? '';
+                    consumed = 2;
+                } else if (bundle !== null) {
+                    keep = bundle[1] !== '' ? [`-${bundle[1] as string}`] : [];
+                    raw = bundle[2] !== '' ? (bundle[2] as string) : (argv[i + 1] ?? '');
+                    consumed = bundle[2] !== '' ? 1 : 2;
+                }
+                if (raw !== null) {
+                    const decoded = raw.replace(/\\_/g, ' ');
+                    if (/\$/.test(decoded) || /\\/.test(decoded)) return done(false, raw);
+                    let split: string[];
+                    try {
+                        split = shlexSplit(decoded);
+                    } catch {
+                        return done(false, raw);
+                    }
+                    argv = [...argv.slice(0, i), ...keep, ...split, ...argv.slice(i + consumed)];
+                    i += keep.length;
+                    // The expanded words may begin with assignments or the command.
+                    while (i < argv.length && _is_env_assignment(argv[i] as string)) {
+                        if (hookspathEnv === null && _env_sets_hookspath(argv[i] as string)) hookspathEnv = argv[i] as string;
+                        i += 1;
+                    }
+                    continue;
+                }
+            }
+            i += spec.withValue.has(opt) ? 2 : 1;
+            if (opt === '--') break;
+        }
+        i += spec.positional;
     }
-    if (i < tokens.length && tokens[i] === 'git') {
-        return tokens.slice(i);
+    // Sixteen wrappers were peeled and the scan stopped; assignments and `-S`
+    // strings past this point were never read (council round 9). Say so, and
+    // let the caller refuse rather than judge a half-read command.
+    return done(false, null, true);
+}
+
+function _payload_at(tokens: string[], at: number): string | null {
+    const head = _basename(tokens[at] ?? '');
+    if (head === 'eval') {
+        const words = tokens.slice(at + 1);
+        return words.length > 0 ? words.join(' ') : null;
+    }
+    if (!_SHELL_RE.test(head)) return null;
+    for (let k = at + 1; k < tokens.length; k += 1) {
+        const tok = tokens[k] as string;
+        if (!tok.startsWith('-')) return null;
+        if (/^-[a-z]*c[a-z]*$/.test(tok)) return tokens[k + 1] ?? null;
+    }
+    return null;
+}
+
+/**
+ * The payload of `sh -c '<payload>'` or `eval <words…>`, read from the argument
+ * vector as the command runs it (`env -S` expanded), or null. After a wrapper,
+ * an interpreter is looked for past an unresolved head the same way `_git_base`
+ * looks for git (council round 4).
+ */
+export function _shell_payload(tokens: string[]): string | null {
+    const { argv, start, wrapped, lookup } = _unwrap(tokens);
+    const direct = _payload_at(argv, start);
+    if (direct !== null || !wrapped || lookup || _basename(argv[start] ?? '') === 'git') return direct;
+    for (let k = start + 1; k < argv.length; k += 1) {
+        const p = _payload_at(argv, k);
+        if (p !== null) return p;
+    }
+    return null;
+}
+
+function _git_base(tokens: string[]): string[] | null {
+    const { argv, start, wrapped, lookup } = _unwrap(tokens);
+    if (start < argv.length && _basename(argv[start] as string) === 'git') {
+        return ['git', ...argv.slice(start + 1)];
+    }
+    // After a wrapper, `start` is only as good as the option table that found
+    // it, and every round of review found a spelling the table missed
+    // (`xargs --max-lines 1`, `stdbuf --output L`, `env -S'…'`). So a head that
+    // is not git does not clear the segment: the first later `git` is read as
+    // git. Fail-closed by intent — `timeout 5 echo git commit --no-verify` is
+    // refused — and the shared segmenter (later/road-to-a-hard-floor-the-shell-
+    // cannot-talk-past Phase 1) is what retires the guess.
+    if (wrapped && !lookup) {
+        const at = argv.findIndex((t, k) => k >= start && _basename(t) === 'git');
+        if (at !== -1) return ['git', ...argv.slice(at + 1)];
     }
     return null;
 }
@@ -391,6 +582,12 @@ function _is_blocked(git_tokens: string[]): [boolean, string] {
             if (_HOOKS_PATH_RE.test(val)) {
                 return [true, `'${tok}' disables git hooks via hooksPath (git-history-discipline)`];
             }
+        } else if (tok === '--config-env' || tok.startsWith('--config-env=')) {
+            const val = tok === '--config-env' ? (git_tokens[i + 1] ?? '') : tok.slice('--config-env='.length);
+            if (_HOOKS_PATH_RE.test(val)) {
+                return [true, `'--config-env ${val}' disables git hooks via hooksPath (git-history-discipline)`];
+            }
+            if (tok === '--config-env') i += 1;
         } else if (tok === '--config') {
             if (i + 1 < git_tokens.length) {
                 const val = git_tokens[i + 1] as string;
@@ -590,10 +787,43 @@ function _check_command(cmd: string, depth = 0): [boolean, string] {
     }
 
     for (const sub of _split_subcommands(tokens)) {
+        const { hookspathEnv, unreadableSplit, exhausted } = _unwrap(sub);
+        if (exhausted) {
+            return [
+                true,
+                'sixteen or more stacked command wrappers — the guard did not read past them, fail-closed (git-history-discipline).',
+            ];
+        }
+        // `env -S` has its own syntax (council round 7): `\_` is decoded, but
+        // `${VAR}` expands and other escapes rewrite characters, which this guard
+        // cannot read — refused rather than guessed at.
+        if (unreadableSplit !== null) {
+            return [
+                true,
+                `'env -S' string '${unreadableSplit}' uses an expansion or escape this guard cannot read — fail-closed (git-history-discipline). Spell the command out without 'env -S'.`,
+            ];
+        }
+        const payload = depth <= 3 ? _shell_payload(sub) : null;
+        if (payload !== null) {
+            // The assignment is inherited by the payload's git, so the pair is
+            // judged together (council round 1: `HUSKY=0 sh -c 'git commit'`).
+            if (hookspathEnv !== null && _looks_like_git_invocation(payload)) {
+                return [true, `'${hookspathEnv}' disables git hooks via hooksPath (git-history-discipline)`];
+            }
+            const [blocked, reason] = _check_command(payload, depth + 1);
+            if (blocked) {
+                return [true, reason];
+            }
+            // No `continue`: a payload found past an unresolved head may be an
+            // operand of the real command, so git is still checked (council round 5).
+        }
         const git_tokens = _git_base(sub);
         if (git_tokens === null) {
             continue;
         }
+        if (hookspathEnv !== null) {
+            return [true, `'${hookspathEnv}' disables git hooks via hooksPath (git-history-discipline)`];
+        }
         const [blocked, reason] = _is_blocked(git_tokens);
         if (blocked) {
             return [true, reason];
```

## What to answer

1. What behaviour changes, including what follows from it that the diff does not state?
2. Which authority or safety boundary becomes wider or narrower, and in which direction?
3. Does the change weaken anything that judges it — a test, a gate, a threshold, this review? The standard is quoted rather than paraphrased: the implementer never silently weakens an assertion, deletes, skips or xfails a failing test, lowers a threshold, or changes fixture semantics to fit the code. Does this change do any of those?
4. Is another host or projection left as a way around the control this change touches?
5. Can it be undone, and how — by whom, with what authority, and against which revision?
6. What observation would show the claimed benefit to be false, and what rollback / kill-switch criteria does the change omit?
7. Would a smaller change do, and what does the larger one buy that the smaller one does not?
8. What does it add to standing instruction weight that every later session pays?
9. Could untrusted content steer the path this change opens, and what bounds it if so?

End with exactly one stance line of the form `STANCE: <ratified | confirmed-non-expanding | refused> | CONFIDENCE: <high | med | low> | DEALBREAKER: <yes | no>`.
