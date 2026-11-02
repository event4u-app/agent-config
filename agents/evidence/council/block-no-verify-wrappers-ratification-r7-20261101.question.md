<!-- evidence-type: analysis -->

# Ratification review — block-no-verify reads git behind exec wrappers — round 7

You are an independent reviewer for a change in the `event4u/agent-config` repository. One file in it, `src/scripts/hooks/block_no_verify.ts`, is the PreToolUse guard that refuses `git … --no-verify` and hook-disabling `core.hooksPath` overrides. It is on the ratification gate's list, so the change needs a two-provider verdict under ADR-268 § 4: an agent may change that file but may not ratify its own change.

subject: 6c0244323d077cfb91d57e3cc51e0f24a5f06c8548fa55a1d2e114366640ef01

(The digest covers `src/scripts/hooks/block_no_verify.ts` at commit `46ea72f259`, computed with `./scripts-run src/scripts/ratification_subject`.)

## Background

Two external release reviews (19.1.0 and 19.2.0) reported command shapes the guard allowed. Reproduced at `2ccb435632` with `block_no_verify --command "<cmd>"` (exit 0 = allowed): `env git commit --no-verify`, `env FOO=1 git commit --no-verify`, `command git …`, `exec git …`, `nice git …`, `nohup git …`, `time git …`, `sudo git …`, `timeout 30 git …`, `xargs git …`, `/usr/bin/git commit --no-verify`, `sh -c 'git commit --no-verify'`, `eval 'git commit --no-verify'`, `git --config-env=core.hooksPath=X commit`, `GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=core.hooksPath GIT_CONFIG_VALUE_0=/dev/null git commit`. The plain `git commit --no-verify` was refused. The guard's command-position detection only skipped leading `VAR=value` assignments and required the literal token `git`.

A later roadmap (`later/road-to-a-hard-floor-the-shell-cannot-talk-past`, Phase 1) plans a shared shell segmenter that replaces this parser; this change closes the reproduced shapes in the existing parser in the meantime.

## Round 6, and what changed

Round 6 (prompt `…-r6-20261101.question.md`, subject `143e55ba…`): anthropic `ratified`, openai `refused`:

- **`env -S` re-joined the arguments after its string without quoting**, so `env -S 'sh -c' 'git commit --no-verify'` re-parsed as `sh -c git commit --no-verify` and the shell payload read as `git` alone. The trailing arguments are now single-quoted (with `'\''` escaping) before the payload is parsed again, so their boundaries survive. Rows: that command and `env -S 'bash -lc' 'git commit -m x --no-verify'`; control `env -S 'sh -c' 'git status'`.
- **The interpreter-operand false refusal** is accepted and pinned as the fallback's second stated price: `env printf '%s\n' sh -c 'git commit --no-verify'` is refused.

## Round 5, and what changed

Round 5 (prompt `…-r5-20261101.question.md`, subject `1909f275…`): anthropic `ratified`, openai `refused` on one finding: a payload found past an unresolved head took precedence and `continue`d, so `stdbuf --output L git commit --no-verify sh -c HEAD` checked `HEAD` and skipped git. The `continue` is removed: the payload is checked and then the segment's git is checked as well, and either refuses. Rows: that command, and `nohup git commit --no-verify eval x`.

## Round 4, and what changed

Round 4 (prompt `…-r4-20261101.question.md`, subject `a3155d53…`): anthropic `ratified`, openai `refused`:

- **`env -S` consumed its string twice** (the bundle branch advanced, then the value-option table advanced again), so `env -S 'env' git commit --no-verify` lost git. Each spelling (`-S <s>`, `-S<s>`, `-vS <s>`, `--split-string[=<s>]`) now consumes its string exactly once and `continue`s past the table. Rows: `env -S 'env' git commit --no-verify`, `env -S'env' git …`; control `env -S 'FOO=1' npm test`.
- **The fallback did not reach interpreters.** `_shell_payload` now applies the same rule as `_git_base`: after a wrapper, if the head is neither git nor an interpreter, a later `sh|…|pwsh -c` or `eval` is found and its payload checked. Rows: `stdbuf --output L sh -c 'git commit --no-verify'`, `… eval '…'`, `HUSKY=0 stdbuf --output L sh -c 'git commit -m x'`; control `stdbuf --output L sh -c 'git status'`.
- **The "no other allowed shape changes" claim** is withdrawn in those words: the fallback refuses the family of wrapped commands whose operands include a `git` token, of which `timeout 5 echo git commit --no-verify` is the pinned example.

## Round 3, and what changed — a strategy change, not another row

Round 3 (prompt `…-r3-20261101.question.md`, subject `d43747e7…`): anthropic `ratified`, openai `refused`, on `env -S'git commit --no-verify'` (attached and bundled `-vS`) and `stdbuf --output L git …`. That was the third round in a row to find an option spelling the closed table did not model, so another row would have bought one more round, not closure.

What changed instead: after at least one wrapper was peeled, `start` is only as good as the option table that found it. A head there that is not git no longer clears the segment — the first later token whose basename is `git` is read as git. A spelling the table misses can therefore no longer hide git; the table now decides only how many commands are refused that need not be. The price, pinned by a test: `timeout 5 echo git commit --no-verify` is refused (a wrapped command with `git` as an operand), while `timeout 5 echo commit --no-verify` and an unwrapped `echo git commit --no-verify` stay allowed. `command -v` is exempt from the fallback because it runs nothing (`env command -v git commit --no-verify` stays allowed). The round-2 numeric-head skip and exhaustion flag are subsumed and removed. `env -S` attached and bundled forms are read as payloads; `stdbuf --output L`, `--output=L` and `timeout --preserve-status --foreground 5` are rows.

Not changed and stated: a hooksPath assignment is refused whatever its value and even if a later `env -u`/`-i` would drop it; refusing those costs nothing a legitimate command needs.

## Round 2, and what changed

Round 2 (prompt `…-r2-20261101.question.md`, subject `c0d52e26…`): anthropic `ratified`, openai `refused`. Findings and disposition:

- **High — `command` lookup detection read git's arguments.** `command git commit --no-verify -v` stopped unwrapping on git's own `-v`. Now only `command`'s own option prefix (the dash-led tokens before the executable) counts. Rows: that command is refused; `command -pv git` stays allowed.
- **High — `xargs --max-lines 1 git …`.** GNU `--max-lines` takes an optional argument, attached only, so a separate `1` is in command position. The parser now skips a token of digits alone after a wrapper's options (no program is named by digits). Rows: `--max-lines 1` and `--max-lines=1`; also `nice -n5` and `nice --adjustment=5`.
- **Medium — controls did not test argument ownership.** The rows above are those tests.
- **Medium — exhaustion guesses executable position.** Now reported only when a wrapper is still in command position after sixteen, so sixteen wrappers in front of `echo` are allowed; past that, the first `git` is read as git — fail-closed by intent, pinned by a test that also states the false refusal it causes (`17 × env echo git commit --no-verify`).

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
- Tests: 53 refused shapes, 19 allowed controls and three pinned policies. All 175 tests of the file and all 1025 hook tests pass.

No existing refusal is removed. Allowed shapes that change beyond the rows: wrapped commands with a `git` operand, or an interpreter-shaped operand whose payload is refused (the fallback's two stated prices).

## The diff

```diff
diff --git a/src/scripts/hooks/block_no_verify.ts b/src/scripts/hooks/block_no_verify.ts
index 8a5caab088..5002ec7209 100644
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
@@ -260,13 +261,172 @@ function _split_subcommands(tokens: string[]): string[][] {
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
+    /** At least one wrapper was peeled, so `start` rests on the option table. */
+    wrapped: boolean;
+    /** `command -v` / `-V`: a lookup, which runs nothing. */
+    lookup: boolean;
+    splitString: string | null;
+} {
     let i = 0;
-    while (i < tokens.length && _is_env_assignment(tokens[i] as string)) {
+    let hookspathEnv: string | null = null;
+    let splitString: string | null = null;
+    let wrapped = false;
+    for (let guard = 0; guard < 16; guard += 1) {
+        while (i < tokens.length && _is_env_assignment(tokens[i] as string)) {
+            if (hookspathEnv === null && _env_sets_hookspath(tokens[i] as string)) hookspathEnv = tokens[i] as string;
+            i += 1;
+        }
+        const head = _basename(tokens[i] ?? '');
+        const spec = _EXEC_WRAPPERS.get(head);
+        if (spec === undefined) return { start: i, hookspathEnv, wrapped, lookup: false, splitString };
+        // `command -v` / `-V` looks a name up; it runs nothing. Only `command`'s
+        // own options count: `-v` after the executable is that program's flag.
+        if (head === 'command') {
+            let k = i + 1;
+            let lookup = false;
+            while (k < tokens.length && (tokens[k] as string).startsWith('-') && tokens[k] !== '--') {
+                if (/^-[a-zA-Z]*[vV]/.test(tokens[k] as string)) lookup = true;
+                k += 1;
+            }
+            if (lookup) return { start: i, hookspathEnv, wrapped, lookup: true, splitString };
+        }
+        wrapped = true;
         i += 1;
+        while (i < tokens.length && (tokens[i] as string).startsWith('-')) {
+            const opt = tokens[i] as string;
+            if (head === 'env') {
+                // `-S <s>`, `-S<s>`, a bundle ending in S (`-vS <s>`), or
+                // `--split-string[=<s>]` — each consumes its string exactly once.
+                const bundle = opt.startsWith('--') ? null : /^-[a-zA-Z]*S(.*)$/.exec(opt);
+                if (opt.startsWith('--split-string=')) {
+                    splitString = opt.slice('--split-string='.length);
+                    i += 1;
+                    continue;
+                }
+                if (opt === '--split-string' || (bundle !== null && bundle[1] === '')) {
+                    splitString = tokens[i + 1] ?? null;
+                    i += 2;
+                    continue;
+                }
+                if (bundle !== null) {
+                    splitString = bundle[1] as string;
+                    i += 1;
+                    continue;
+                }
+            }
+            i += spec.withValue.has(opt) ? 2 : 1;
+            if (opt === '--') break;
+        }
+        i += spec.positional;
+    }
+    return { start: i, hookspathEnv, wrapped, lookup: false, splitString };
+}
+
+function _sh_quote(token: string): string {
+    return `'${token.replace(/'/g, `'\\''`)}'`;
+}
+
+function _payload_at(tokens: string[], at: number): string | null {
+    const head = _basename(tokens[at] ?? '');
+    if (head === 'eval') {
+        const words = tokens.slice(at + 1);
+        return words.length > 0 ? words.join(' ') : null;
     }
-    if (i < tokens.length && tokens[i] === 'git') {
-        return tokens.slice(i);
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
+ * The payload of `sh -c '<payload>'`, `eval <words…>` or `env -S '<payload>'`,
+ * or null. After a wrapper, an interpreter is looked for past an unresolved
+ * head the same way `_git_base` looks for git (council round 4).
+ */
+export function _shell_payload(tokens: string[]): string | null {
+    const { start, splitString, wrapped, lookup } = _unwrap(tokens);
+    // `env -S` splits only its own string; the arguments after it keep their
+    // boundaries, so they are re-quoted before the payload is parsed again
+    // (council round 6: `env -S 'sh -c' 'git commit --no-verify'`).
+    if (splitString !== null) return [splitString, ...tokens.slice(start).map(_sh_quote)].join(' ');
+    const direct = _payload_at(tokens, start);
+    if (direct !== null || !wrapped || lookup || _basename(tokens[start] ?? '') === 'git') return direct;
+    for (let k = start + 1; k < tokens.length; k += 1) {
+        const p = _payload_at(tokens, k);
+        if (p !== null) return p;
+    }
+    return null;
+}
+
+function _git_base(tokens: string[]): string[] | null {
+    const { start, wrapped, lookup } = _unwrap(tokens);
+    if (start < tokens.length && _basename(tokens[start] as string) === 'git') {
+        return ['git', ...tokens.slice(start + 1)];
+    }
+    // After a wrapper, `start` is only as good as the option table that found
+    // it, and every round of review found a spelling the table missed
+    // (`xargs --max-lines 1`, `stdbuf --output L`, `env -S'…'`). So a head that
+    // is not git does not clear the segment: the first later `git` is read as
+    // git. Fail-closed by intent — `timeout 5 echo git commit --no-verify` is
+    // refused — and the shared segmenter (later/road-to-a-hard-floor-the-shell-
+    // cannot-talk-past Phase 1) is what retires the guess.
+    if (wrapped && !lookup) {
+        const at = tokens.findIndex((t, k) => k >= start && _basename(t) === 'git');
+        if (at !== -1) return ['git', ...tokens.slice(at + 1)];
     }
     return null;
 }
@@ -391,6 +551,12 @@ function _is_blocked(git_tokens: string[]): [boolean, string] {
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
@@ -590,10 +756,28 @@ function _check_command(cmd: string, depth = 0): [boolean, string] {
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
diff --git a/tests/scripts/hooks/block_no_verify.test.ts b/tests/scripts/hooks/block_no_verify.test.ts
index d1c2a9b1b5..a95c0dcacb 100644
--- a/tests/scripts/hooks/block_no_verify.test.ts
+++ b/tests/scripts/hooks/block_no_verify.test.ts
@@ -407,3 +407,128 @@ describe('short -n is scoped to the subcommands where it can bypass a hook', ()
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
+        // Council round 2 (openai): argument ownership.
+        'command git commit --no-verify -v',
+        'xargs --max-lines 1 git commit --no-verify',
+        'xargs --max-lines=1 git commit --no-verify',
+        'nice -n5 git commit --no-verify',
+        'nice --adjustment=5 git commit --no-verify',
+        // Council round 3 (openai): option spellings a closed table misses.
+        "env -S'git commit --no-verify'",
+        "env -vS 'git commit --no-verify'",
+        'stdbuf --output L git commit --no-verify',
+        'stdbuf --output=L git commit --no-verify',
+        'timeout --preserve-status --foreground 5 git commit --no-verify',
+        // Council round 4 (openai): composition after an unresolved head.
+        "env -S 'env' git commit --no-verify",
+        "env -S'env' git commit --no-verify",
+        "stdbuf --output L sh -c 'git commit --no-verify'",
+        "stdbuf --output L eval 'git commit --no-verify'",
+        "HUSKY=0 stdbuf --output L sh -c 'git commit -m x'",
+        // Council round 5 (openai): a shell-looking operand must not mask git.
+        'stdbuf --output L git commit --no-verify sh -c HEAD',
+        'nohup git commit --no-verify eval x',
+        // Council round 6 (openai): env -S keeps the argument boundaries after it.
+        "env -S 'sh -c' 'git commit --no-verify'",
+        "env -S 'bash -lc' 'git commit -m x --no-verify'",
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
+        'command -pv git',
+        'env command -v git commit --no-verify',
+        "env -S 'FOO=1' npm test",
+        "stdbuf --output L sh -c 'git status'",
+        "env -S 'sh -c' 'git status'",
+    ];
+    for (const cmd of ALLOWED) {
+        it(`allows: ${cmd}`, () => {
+            expect(_check_command(cmd)[0]).toBe(false);
+        });
+    }
+});
+
+// Stacked wrappers are read through: sixteen of them, then git, is still git.
+describe('block_no_verify — stacked wrappers', () => {
+    it('refuses git behind seventeen wrappers', () => {
+        const many = Array.from({ length: 17 }, () => 'env').join(' ');
+        expect(_check_command(`${many} git commit --no-verify`)[0]).toBe(true);
+    });
+});
+
+// Round 3 changed strategy: after a wrapper the guard does not trust its own
+// option table to find command position. If what it lands on is not git, the
+// first later `git` in the segment is read as git, so an option spelling the
+// table misses can no longer hide it. The table now only decides how many
+// commands are refused that need not be; the price is pinned here.
+describe('block_no_verify — after a wrapper, an unresolved head is fail-closed', () => {
+    it('refuses git as a wrapped echo operand (the named false refusal)', () => {
+        expect(_check_command('timeout 5 echo git commit --no-verify')[0]).toBe(true);
+    });
+    it('refuses an interpreter-shaped operand of a wrapped command (the second named false refusal)', () => {
+        expect(_check_command("env printf '%s\\n' sh -c 'git commit --no-verify'")[0]).toBe(true);
+    });
+    it('still allows a wrapped command with no git token, and a bare echo', () => {
+        expect(_check_command('timeout 5 echo commit --no-verify')[0]).toBe(false);
+        expect(_check_command('echo git commit --no-verify')[0]).toBe(false);
+    });
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
