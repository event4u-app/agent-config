<!-- evidence-type: analysis -->

# Ratification review — block-no-verify reads git behind exec wrappers — round 2

You are an independent reviewer for a change in the `event4u/agent-config` repository. One file in it, `src/scripts/hooks/block_no_verify.ts`, is the PreToolUse guard that refuses `git … --no-verify` and hook-disabling `core.hooksPath` overrides. It is on the ratification gate's list, so the change needs a two-provider verdict under ADR-268 § 4: an agent may change that file but may not ratify its own change.

subject: c0d52e26fe1d5a7ed023fab9f42a5cf9db63c35edc76e7f44b3507f209c6965d

(The digest covers `src/scripts/hooks/block_no_verify.ts` at commit `32dfcef96c`, computed with `./scripts-run src/scripts/ratification_subject`.)

## Background

Two external release reviews (19.1.0 and 19.2.0) reported command shapes the guard allowed. Reproduced at `2ccb435632` with `block_no_verify --command "<cmd>"` (exit 0 = allowed): `env git commit --no-verify`, `env FOO=1 git commit --no-verify`, `command git …`, `exec git …`, `nice git …`, `nohup git …`, `time git …`, `sudo git …`, `timeout 30 git …`, `xargs git …`, `/usr/bin/git commit --no-verify`, `sh -c 'git commit --no-verify'`, `eval 'git commit --no-verify'`, `git --config-env=core.hooksPath=X commit`, `GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=core.hooksPath GIT_CONFIG_VALUE_0=/dev/null git commit`. The plain `git commit --no-verify` was refused. The guard's command-position detection only skipped leading `VAR=value` assignments and required the literal token `git`.

A later roadmap (`later/road-to-a-hard-floor-the-shell-cannot-talk-past`, Phase 1) plans a shared shell segmenter that replaces this parser; this change closes the reproduced shapes in the existing parser in the meantime.

## Round 1, and what changed

Round 1 (prompt `agents/evidence/council/block-no-verify-wrappers-ratification-r1-20261101.question.md`, subject `0aee9615…`): anthropic `ratified`, openai `refused`. The findings and their disposition:

- **High — a hook-disabling assignment was lost across shell recursion** (`HUSKY=0 sh -c 'git commit -m x'` allowed). Fixed: the assignment is read before the payload branch, and an assignment together with a payload that invokes git is refused. Rows: `HUSKY=0 sh -c 'git commit -m x'`, the `GIT_CONFIG_*` + `bash -c` form; control `HUSKY=0 sh -c 'npm test'` stays allowed.
- **High — the wrapper option model.** `xargs --replace` takes its optional argument attached only, so listing it as value-consuming swallowed `git`. Removed from the table, with a comment saying why; `--process-slot-var` added. `env -S` / `--split-string` is now read as a payload; `sudo -U` / `--other-user` and the other value-taking sudo long options added. Rows: `xargs --replace git commit --no-verify`, `xargs -I{} git …`, `env -S 'git commit --no-verify'`, `sudo -U bob git …`.
- **Medium — `command -v` / `-V` was refused as if it executed its operands.** It now stops unwrapping, so `command -v git commit --no-verify` and `command -V git` are allowed controls.
- **The sixteen-wrapper cap stopped reading silently.** It now reports exhaustion, and a git found past it is read as git.
- From anthropic's gap list: `fish`, `csh`, `tcsh` and `pwsh` join the `-c` interpreters. Not addressed, and stated: symlinked or Windows-path git, wrappers outside the table, nesting deeper than 3. These are the shared segmenter's job (`later/road-to-a-hard-floor-the-shell-cannot-talk-past` Phase 1).
- Kept deliberately: a `GIT_CONFIG_PARAMETERS` value naming `core.hooksPath`, or a `GIT_CONFIG_KEY_<n>=core.hooksPath` without a matching count, is refused. Both name a hooksPath override in the environment git reads; refusing the incomplete form costs nothing a legitimate command needs.

## What the change does (both rounds)

- `_unwrap(tokens)` peels leading env assignments and a closed table of exec wrappers (`env`, `command`, `exec`, `builtin`, `nice`, `nohup`, `time`, `sudo`, `doas`, `stdbuf`, `timeout`, `xargs`), skipping each wrapper's own options (and the values of the options that take one) and `timeout`'s duration. It also reports a hook-disabling assignment met on the way: `GIT_CONFIG_KEY_<n>=core.hooksPath`, a `GIT_CONFIG_PARAMETERS` value naming `core.hooksPath`, or `HUSKY=0`.
- `_git_base` uses `_unwrap` and accepts a path-prefixed git (`/usr/bin/git`).
- `_shell_payload(tokens)` returns the payload of `sh|bash|zsh|ksh|dash -c '<payload>'` (also bundled `-lc`) and the words after `eval`; `_check_command` recurses into it at the existing depth bound (3).
- `_is_blocked` reads `--config-env core.hooksPath=…` / `--config-env=core.hooksPath=…`, and `--config-env` joins the global options that consume a value.
- Tests: 34 refused shapes and 14 allowed controls (round 1 claimed 27 refused; the array then held 26). The round-1 set was seen red (25 failures) before the first change; the 8 round-2 rows below were seen red (8 failures) before the second; all 146 tests of the file and all 997 hook tests pass after it.

No existing refusal is removed and no allowed shape outside the new rows changes.

## The diff

```diff
diff --git a/src/scripts/hooks/block_no_verify.ts b/src/scripts/hooks/block_no_verify.ts
index 8a5caab088..16d0fec362 100644
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
@@ -260,13 +261,116 @@ function _split_subcommands(tokens: string[]): string[][] {
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
+    start: number;
+    hookspathEnv: string | null;
+    exhausted: boolean;
+    splitString: string | null;
+} {
     let i = 0;
-    while (i < tokens.length && _is_env_assignment(tokens[i] as string)) {
+    let hookspathEnv: string | null = null;
+    let splitString: string | null = null;
+    for (let guard = 0; guard < 16; guard += 1) {
+        while (i < tokens.length && _is_env_assignment(tokens[i] as string)) {
+            if (hookspathEnv === null && _env_sets_hookspath(tokens[i] as string)) hookspathEnv = tokens[i] as string;
+            i += 1;
+        }
+        const head = _basename(tokens[i] ?? '');
+        const spec = _EXEC_WRAPPERS.get(head);
+        if (spec === undefined) return { start: i, hookspathEnv, exhausted: false, splitString };
+        // `command -v` / `-V` looks a name up; it runs nothing.
+        if (head === 'command' && tokens.slice(i + 1).some((t) => /^-[a-zA-Z]*[vV]/.test(t))) {
+            return { start: i, hookspathEnv, exhausted: false, splitString };
+        }
         i += 1;
+        while (i < tokens.length && (tokens[i] as string).startsWith('-')) {
+            const opt = tokens[i] as string;
+            if (head === 'env' && (opt === '-S' || opt === '--split-string')) splitString = tokens[i + 1] ?? null;
+            else if (head === 'env' && opt.startsWith('--split-string=')) splitString = opt.slice('--split-string='.length);
+            i += spec.withValue.has(opt) ? 2 : 1;
+            if (opt === '--') break;
+        }
+        i += spec.positional;
+    }
+    // Sixteen stacked wrappers is not a real command; report it rather than stop
+    // reading silently, so the caller can refuse a git found further along.
+    return { start: i, hookspathEnv, exhausted: true, splitString };
+}
+
+/** The payload of `sh -c '<payload>'`, `eval <words…>` or `env -S '<payload>'`, or null. */
+export function _shell_payload(tokens: string[]): string | null {
+    const { start, splitString } = _unwrap(tokens);
+    if (splitString !== null) return [splitString, ...tokens.slice(start)].join(' ');
+    const head = _basename(tokens[start] ?? '');
+    if (head === 'eval') {
+        const words = tokens.slice(start + 1);
+        return words.length > 0 ? words.join(' ') : null;
     }
-    if (i < tokens.length && tokens[i] === 'git') {
-        return tokens.slice(i);
+    if (!_SHELL_RE.test(head)) return null;
+    for (let k = start + 1; k < tokens.length; k += 1) {
+        const tok = tokens[k] as string;
+        if (!tok.startsWith('-')) return null;
+        if (/^-[a-z]*c[a-z]*$/.test(tok)) return tokens[k + 1] ?? null;
+    }
+    return null;
+}
+
+function _git_base(tokens: string[]): string[] | null {
+    const { start, exhausted } = _unwrap(tokens);
+    if (start < tokens.length && _basename(tokens[start] as string) === 'git') {
+        return ['git', ...tokens.slice(start + 1)];
+    }
+    if (exhausted) {
+        const at = tokens.findIndex((t, k) => k >= start && _basename(t) === 'git');
+        if (at !== -1) return ['git', ...tokens.slice(at + 1)];
     }
     return null;
 }
@@ -391,6 +495,12 @@ function _is_blocked(git_tokens: string[]): [boolean, string] {
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
@@ -590,10 +700,27 @@ function _check_command(cmd: string, depth = 0): [boolean, string] {
     }
 
     for (const sub of _split_subcommands(tokens)) {
+        const { hookspathEnv } = _unwrap(sub);
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
+            continue;
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
diff --git a/tests/scripts/hooks/block_no_verify.test.ts b/tests/scripts/hooks/block_no_verify.test.ts
index d1c2a9b1b5..83b93ff64e 100644
--- a/tests/scripts/hooks/block_no_verify.test.ts
+++ b/tests/scripts/hooks/block_no_verify.test.ts
@@ -407,3 +407,73 @@ describe('short -n is scoped to the subcommands where it can bypass a hook', ()
         });
     }
 });
+
+// Release reviews 19.1.0 / 19.2.0 (round inbox-2026-11-d): a wrapper in command
+// position hid git from `_git_base`, which only skipped `VAR=x` assignments.
+// Reproduced at 2ccb435632: every BYPASSED line below returned exit 0.
+describe('block_no_verify — exec wrappers and config-env forms', () => {
+    const BYPASSED = [
+        'env git commit --no-verify -m x',
+        'env FOO=1 git commit --no-verify -m x',
+        'env -i git commit --no-verify',
+        'env -u HOME git commit -n -m x',
+        'command git commit --no-verify -m x',
+        'exec git commit --no-verify',
+        'nice git commit --no-verify',
+        'nice -n 5 git commit --no-verify',
+        'nohup git commit --no-verify',
+        'time git commit --no-verify',
+        'sudo git commit --no-verify',
+        'sudo -u bob git commit --no-verify',
+        'timeout 30 git commit --no-verify',
+        'xargs git commit --no-verify',
+        '/usr/bin/git commit --no-verify',
+        'env /usr/bin/git commit --no-verify',
+        "sh -c 'git commit --no-verify'",
+        "bash -c 'git commit --no-verify -m x'",
+        "env bash -lc 'git commit --no-verify'",
+        "eval 'git commit --no-verify'",
+        'git --config-env=core.hooksPath=X commit',
+        'git --config-env core.hooksPath=X commit',
+        'GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=core.hooksPath GIT_CONFIG_VALUE_0=/dev/null git commit',
+        "GIT_CONFIG_PARAMETERS=\"'core.hooksPath'='/dev/null'\" git commit",
+        'env GIT_CONFIG_KEY_0=core.hooksPath GIT_CONFIG_VALUE_0=/dev/null GIT_CONFIG_COUNT=1 git commit',
+        'HUSKY=0 git commit -m x',
+        // Council round 1 (openai): composition and option-model gaps.
+        "HUSKY=0 sh -c 'git commit -m x'",
+        "GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=core.hooksPath GIT_CONFIG_VALUE_0=/dev/null bash -c 'git commit -m x'",
+        'xargs --replace git commit --no-verify',
+        'xargs -I{} git commit --no-verify',
+        "env -S 'git commit --no-verify'",
+        'sudo -U bob git commit --no-verify',
+        "fish -c 'git commit --no-verify'",
+        "csh -c 'git commit --no-verify'",
+    ];
+    for (const cmd of BYPASSED) {
+        it(`blocks: ${cmd}`, () => {
+            expect(_check_command(cmd)[0]).toBe(true);
+        });
+    }
+
+    const ALLOWED = [
+        'env git status',
+        'nice -n 5 git log --oneline',
+        'command -v git',
+        'time git fetch',
+        "sh -c 'git status'",
+        "eval 'echo --no-verify'",
+        'env FOO=1 npm test',
+        'GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=user.name GIT_CONFIG_VALUE_0=x git commit -m y',
+        'git --config-env=user.name=NAME commit -m y',
+        'echo env git commit --no-verify',
+        'HUSKY=1 git commit -m x',
+        'command -v git commit --no-verify',
+        'command -V git',
+        "HUSKY=0 sh -c 'npm test'",
+    ];
+    for (const cmd of ALLOWED) {
+        it(`allows: ${cmd}`, () => {
+            expect(_check_command(cmd)[0]).toBe(false);
+        });
+    }
+});
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
