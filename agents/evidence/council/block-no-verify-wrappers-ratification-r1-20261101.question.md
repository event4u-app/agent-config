<!-- evidence-type: analysis -->

# Ratification review — block-no-verify reads git behind exec wrappers — round 1

You are an independent reviewer for a change in the `event4u/agent-config` repository. One file in it, `src/scripts/hooks/block_no_verify.ts`, is the PreToolUse guard that refuses `git … --no-verify` and hook-disabling `core.hooksPath` overrides. It is on the ratification gate's list, so the change needs a two-provider verdict under ADR-268 § 4: an agent may change that file but may not ratify its own change.

subject: 0aee9615a39356a5bf439792ee0560b3160a3f2bd98536c6ecbfda92c6ac465e

(The digest covers `src/scripts/hooks/block_no_verify.ts` at commit `43c8d5a1cf`, computed with `./scripts-run src/scripts/ratification_subject`.)

## Background

Two external release reviews (19.1.0 and 19.2.0) reported command shapes the guard allowed. Reproduced at `2ccb435632` with `block_no_verify --command "<cmd>"` (exit 0 = allowed): `env git commit --no-verify`, `env FOO=1 git commit --no-verify`, `command git …`, `exec git …`, `nice git …`, `nohup git …`, `time git …`, `sudo git …`, `timeout 30 git …`, `xargs git …`, `/usr/bin/git commit --no-verify`, `sh -c 'git commit --no-verify'`, `eval 'git commit --no-verify'`, `git --config-env=core.hooksPath=X commit`, `GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=core.hooksPath GIT_CONFIG_VALUE_0=/dev/null git commit`. The plain `git commit --no-verify` was refused. The guard's command-position detection only skipped leading `VAR=value` assignments and required the literal token `git`.

A later roadmap (`later/road-to-a-hard-floor-the-shell-cannot-talk-past`, Phase 1) plans a shared shell segmenter that replaces this parser; this change closes the reproduced shapes in the existing parser in the meantime.

## What the change does

- `_unwrap(tokens)` peels leading env assignments and a closed table of exec wrappers (`env`, `command`, `exec`, `builtin`, `nice`, `nohup`, `time`, `sudo`, `doas`, `stdbuf`, `timeout`, `xargs`), skipping each wrapper's own options (and the values of the options that take one) and `timeout`'s duration. It also reports a hook-disabling assignment met on the way: `GIT_CONFIG_KEY_<n>=core.hooksPath`, a `GIT_CONFIG_PARAMETERS` value naming `core.hooksPath`, or `HUSKY=0`.
- `_git_base` uses `_unwrap` and accepts a path-prefixed git (`/usr/bin/git`).
- `_shell_payload(tokens)` returns the payload of `sh|bash|zsh|ksh|dash -c '<payload>'` (also bundled `-lc`) and the words after `eval`; `_check_command` recurses into it at the existing depth bound (3).
- `_is_blocked` reads `--config-env core.hooksPath=…` / `--config-env=core.hooksPath=…`, and `--config-env` joins the global options that consume a value.
- Tests: 27 refused shapes and 11 allowed controls (`env git status`, `nice -n 5 git log`, `command -v git`, `sh -c 'git status'`, `eval 'echo --no-verify'`, `GIT_CONFIG_KEY_0=user.name … git commit`, `git --config-env=user.name=NAME commit`, `echo env git commit --no-verify`, `HUSKY=1 git commit`, …). The refused set was seen red (25 failures) before the change; all 133 tests of the file and all 986 hook tests pass after it.

No existing refusal is removed and no allowed shape outside the new rows changes.

## The diff

```diff
diff --git a/src/scripts/hooks/block_no_verify.ts b/src/scripts/hooks/block_no_verify.ts
index 8a5caab088..3ee2882689 100644
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
@@ -260,13 +261,93 @@ function _split_subcommands(tokens: string[]): string[][] {
     return groups;
 }
 
-function _git_base(tokens: string[]): string[] | null {
+/**
+ * Commands that run their remaining arguments as a command, with the options
+ * that consume a value. Without this, `env git commit --no-verify` put `env` in
+ * command position and the guard saw no git (release review 19.2.0, M7).
+ */
+const _EXEC_WRAPPERS: ReadonlyMap<string, { readonly withValue: ReadonlySet<string>; readonly positional: number }> =
+    new Map([
+        ['env', { withValue: new Set(['-u', '--unset', '-C', '--chdir']), positional: 0 }],
+        ['command', { withValue: new Set<string>(), positional: 0 }],
+        ['exec', { withValue: new Set(['-a']), positional: 0 }],
+        ['builtin', { withValue: new Set<string>(), positional: 0 }],
+        ['nice', { withValue: new Set(['-n', '--adjustment']), positional: 0 }],
+        ['nohup', { withValue: new Set<string>(), positional: 0 }],
+        ['time', { withValue: new Set(['-f', '--format', '-o', '--output']), positional: 0 }],
+        ['sudo', { withValue: new Set(['-u', '--user', '-g', '--group', '-h', '--host', '-p', '--prompt', '-C', '-D', '--chdir', '-r', '-t', '-T']), positional: 0 }],
+        ['doas', { withValue: new Set(['-u', '-C']), positional: 0 }],
+        ['stdbuf', { withValue: new Set(['-i', '-o', '-e']), positional: 0 }],
+        ['timeout', { withValue: new Set(['-s', '--signal', '-k', '--kill-after']), positional: 1 }],
+        ['xargs', { withValue: new Set(['-a', '-d', '-E', '-I', '-L', '-n', '-P', '-s', '--arg-file', '--delimiter', '--max-args', '--max-procs', '--max-chars', '--replace']), positional: 0 }],
+    ]);
+
+/** Interpreters whose `-c <payload>` is a command list (`sh -c '…'`). */
+const _SHELL_RE = /^(?:ba|z|k|da)?sh$/;
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
+export function _unwrap(tokens: string[]): { start: number; hookspathEnv: string | null } {
     let i = 0;
-    while (i < tokens.length && _is_env_assignment(tokens[i] as string)) {
+    let hookspathEnv: string | null = null;
+    for (let guard = 0; guard < 16 && i < tokens.length; guard += 1) {
+        while (i < tokens.length && _is_env_assignment(tokens[i] as string)) {
+            if (hookspathEnv === null && _env_sets_hookspath(tokens[i] as string)) hookspathEnv = tokens[i] as string;
+            i += 1;
+        }
+        const spec = _EXEC_WRAPPERS.get(_basename(tokens[i] ?? ''));
+        if (spec === undefined) break;
         i += 1;
+        while (i < tokens.length && (tokens[i] as string).startsWith('-')) {
+            const opt = tokens[i] as string;
+            i += spec.withValue.has(opt) ? 2 : 1;
+            if (opt === '--') break;
+        }
+        i += spec.positional;
+    }
+    return { start: i, hookspathEnv };
+}
+
+/** The payload of `sh -c '<payload>'` or `eval <words…>`, or null. */
+export function _shell_payload(tokens: string[]): string | null {
+    const { start } = _unwrap(tokens);
+    const head = _basename(tokens[start] ?? '');
+    if (head === 'eval') {
+        const words = tokens.slice(start + 1);
+        return words.length > 0 ? words.join(' ') : null;
+    }
+    if (!_SHELL_RE.test(head)) return null;
+    for (let k = start + 1; k < tokens.length; k += 1) {
+        const tok = tokens[k] as string;
+        if (!tok.startsWith('-')) return null;
+        if (/^-[a-z]*c[a-z]*$/.test(tok)) return tokens[k + 1] ?? null;
     }
-    if (i < tokens.length && tokens[i] === 'git') {
-        return tokens.slice(i);
+    return null;
+}
+
+function _git_base(tokens: string[]): string[] | null {
+    const { start } = _unwrap(tokens);
+    if (start < tokens.length && _basename(tokens[start] as string) === 'git') {
+        return ['git', ...tokens.slice(start + 1)];
     }
     return null;
 }
@@ -391,6 +472,12 @@ function _is_blocked(git_tokens: string[]): [boolean, string] {
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
@@ -590,10 +677,22 @@ function _check_command(cmd: string, depth = 0): [boolean, string] {
     }
 
     for (const sub of _split_subcommands(tokens)) {
+        const payload = depth <= 3 ? _shell_payload(sub) : null;
+        if (payload !== null) {
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
+        const { hookspathEnv } = _unwrap(sub);
+        if (hookspathEnv !== null) {
+            return [true, `'${hookspathEnv}' disables git hooks via hooksPath (git-history-discipline)`];
+        }
         const [blocked, reason] = _is_blocked(git_tokens);
         if (blocked) {
             return [true, reason];
diff --git a/tests/scripts/hooks/block_no_verify.test.ts b/tests/scripts/hooks/block_no_verify.test.ts
index d1c2a9b1b5..097a8846db 100644
--- a/tests/scripts/hooks/block_no_verify.test.ts
+++ b/tests/scripts/hooks/block_no_verify.test.ts
@@ -407,3 +407,61 @@ describe('short -n is scoped to the subcommands where it can bypass a hook', ()
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
