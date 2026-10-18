<!-- evidence-type: analysis -->

<!-- A prompt given to the council on 2026-10-18 for branch drain/road-to-one-detector-and-the-senders-we-own-20261018b,
     round 4c, fourth pass, committed verbatim so the verdict recorded beside it can be checked
     against what was actually asked. Not edited after the run. -->

# Review branch drain/road-to-one-detector-and-the-senders-we-own-20261018b, round 4c fourth pass — stop parsing what cannot be parsed

A ratification decision under ADR-268 § 4 on a new `pre_tool_use` guard and its policy; the
trade-off is precision against an open grammar. Reviewed commit `0378e2cd4`. The third pass (both
seats REQUEST_CHANGES) closed the `.pem`, `/proc` and Windows-name findings and showed that the
wrapper tables keep losing to option clustering (`sudo -nu root cat .env`, `cp -vt backup .env`),
`timeout .5s`, and `env -S` composition. Its recommendation was a conservative parser that refuses
unknown wrapper grammar. That is the approach taken:

1. **A wrapped segment is no longer parsed.** If the command word (after leading assignments, by
   basename) is one of `command builtin exec nohup sudo doas nice timeout stdbuf time xargs watch
   unbuffer`, the guard does not try to find the wrapped command: any credential path anywhere in
   the segment — a word, a redirect target or an option value — refuses, and so does a word whose
   basename is `env` or `printenv`. `sudo -nu root cat .env`, `timeout .5s cat .env`,
   `xargs -a list.txt cat .env`, `sudo -E env` refuse; `sudo -nu root ls /root` and
   `timeout .5s npm test` pass (no credential path, no environment dump). The accepted cost: a
   wrapped command that names a credential path without reading it (`sudo rm .env`) refuses too.
2. **`env` is parsed as `env` parses itself.** Each `-S`/`--split-string` value (separate, inline
   `-S'…'`, or `--split-string=…`) is split into words and spliced into `env`'s own argv; then
   options are skipped (`--unset`/`--chdir` and a short cluster ending in `u` or `C` take the next
   word) and assignments are skipped. Nothing left means it prints the environment
   (`env -u PATH`, `env -iu PATH`, `env FOO=1`); otherwise the remainder is judged as the command it
   runs, and any credential path in `env`'s words refuses as a fallback. So `env -S 'cat' .env` and
   `env -S '-u PATH cat .env'` refuse, `env -i PATH=/bin node app.js` passes.
3. **`cp`/`mv`**: a target directory in any spelling — `-t DIR`, a short cluster ending in `t`
   (`-vt DIR`, `-ft DIR`), `-tDIR`, `--target-directory[=DIR]` — makes every operand a source.
4. **Words are split the way the shell joins them**: a quoted run adjacent to unquoted text is one
   word, quotes are removed, a backslash escapes. This is what makes `-S'cat .env'` one argument.
5. The Windows-name test now also asserts the verdict is non-null and of class `env-file`.

The dispatch bundle reads 1,542,107 B of 1,550,000.

For each defect report file:line, the failure scenario and a severity. Say whether each third-pass
finding is closed. State your stance (APPROVE or REQUEST_CHANGES) and the single highest-leverage
change.

```diff
diff --git a/src/scripts/_lib/credential_files.ts b/src/scripts/_lib/credential_files.ts
index b23954013..0bb635715 100644
--- a/src/scripts/_lib/credential_files.ts
+++ b/src/scripts/_lib/credential_files.ts
@@ -105,106 +105,180 @@ const NON_READING_COMMANDS: ReadonlySet<string> = new Set([
 ]);
 
 /**
- * Words that run the command after them, each with the options that take a
- * separate argument — `sudo -u root env` runs `env`, not `root`. A `--long=value`
- * form and an unlisted flag take none. `timeout` also takes one duration.
+ * Words that run the command after them: `sudo`, `nice`, `timeout`, …. Their
+ * option grammars differ and clustering (`sudo -nu root`) defeats any table of
+ * them, so a segment that starts with one is judged conservatively instead of
+ * parsed: any credential path anywhere in it refuses, and so does an `env` or a
+ * `printenv` anywhere in it.
  */
-const WRAPPER_ARG_FLAGS: ReadonlyMap<string, ReadonlySet<string>> = new Map([
-    ['command', new Set<string>()],
-    ['builtin', new Set<string>()],
-    ['exec', new Set(['-a'])],
-    ['nohup', new Set<string>()],
-    ['sudo', new Set(['-u', '-g', '-U', '-C', '-h', '-p', '-r', '-t', '-D', '-R', '--user', '--group', '--other-user', '--close-from', '--host', '--prompt', '--role', '--type', '--chdir', '--chroot'])],
-    ['doas', new Set(['-u', '-C'])],
-    ['nice', new Set(['-n', '--adjustment'])],
-    ['timeout', new Set(['-s', '--signal', '-k', '--kill-after'])],
-    ['stdbuf', new Set(['-i', '-o', '-e', '--input', '--output', '--error'])],
-    ['time', new Set(['-f', '--format', '-o', '--output'])],
+const WRAPPERS: ReadonlySet<string> = new Set([
+    'command', 'builtin', 'exec', 'nohup', 'sudo', 'doas', 'nice', 'timeout', 'stdbuf', 'time', 'xargs', 'watch', 'unbuffer',
 ]);
 
-/** `env`'s own options that take an argument; `-S` / `--split-string` carries a command. */
-const ENV_ARG_FLAGS: ReadonlySet<string> = new Set(['-u', '--unset', '-C', '--chdir', '-S', '--split-string']);
-
-const base = (w: string): string => w.replace(/^.*\//, '');
-
-/** Index of the first word after a run of options, skipping each listed flag's separate argument. */
-function skipOptions(words: readonly string[], i: number, argFlags: ReadonlySet<string>): number {
-    while (i < words.length) {
-        const w = words[i] as string;
-        if (w === '--') return i + 1;
-        if (!w.startsWith('-') || w === '-') return i;
-        i += argFlags.has(w) ? 2 : 1;
-    }
-    return i;
-}
-
 /** `git` subcommands that name a path without printing its content. */
 const NON_READING_GIT: ReadonlySet<string> = new Set(['add', 'rm', 'mv', 'check-ignore', 'ls-files', 'status']);
 
-/** Split one command segment into words, dropping quotes; redirection operators stay attached to nothing. */
+/**
+ * Split one command segment into words the way the shell joins them: quoted
+ * and unquoted runs with no space between them are one word (`-S'cat .env'` is
+ * `-Scat .env`), quotes are removed, and a backslash escapes the next character.
+ */
 export function commandWords(segment: string): string[] {
     const words: string[] = [];
-    const re = /"((?:[^"\\]|\\.)*)"|'([^']*)'|(\S+)/g;
-    for (const m of segment.matchAll(re)) words.push(m[1] ?? m[2] ?? m[3] ?? '');
+    let word = '';
+    let inWord = false;
+    for (let i = 0; i < segment.length; i += 1) {
+        const ch = segment[i] as string;
+        if (/\s/.test(ch)) {
+            if (inWord) words.push(word);
+            word = '';
+            inWord = false;
+            continue;
+        }
+        inWord = true;
+        if (ch === "'") {
+            const end = segment.indexOf("'", i + 1);
+            word += segment.slice(i + 1, end === -1 ? segment.length : end);
+            i = end === -1 ? segment.length : end;
+        } else if (ch === '"') {
+            let j = i + 1;
+            for (; j < segment.length && segment[j] !== '"'; j += 1) {
+                if (segment[j] === '\\' && j + 1 < segment.length) j += 1;
+                word += segment[j];
+            }
+            i = j;
+        } else if (ch === '\\' && i + 1 < segment.length) {
+            word += segment[i + 1];
+            i += 1;
+        } else {
+            word += ch;
+        }
+    }
+    if (inWord) words.push(word);
     return words;
 }
 
 const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;
 const REDIRECT_PREFIX = /^(?:\d*[<>]{1,2}&?|&>{1,2})/;
+const VARIABLE_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
 
 type Verdict = { class: CredentialFileClass; what: string } | null;
 
-const named = (cls: CredentialFileClass, p: string): Verdict => ({ class: cls, what: `\`${credentialBasename(p)}\`` });
-
 /** The basename a refusal may name: backslashes read as separators, so no Windows path leaks whole. */
 export function credentialBasename(p: string): string {
     return path.posix.basename(p.replace(/\\/g, '/'));
 }
 
-/** Why a command segment is refused, or null. `segment` starts at its command word. */
-export function segmentVerdict(segment: string, depth = 0): Verdict {
-    const words = commandWords(segment);
+const named = (cls: CredentialFileClass, p: string): Verdict => ({ class: cls, what: `\`${credentialBasename(p)}\`` });
+const base = (w: string): string => w.replace(/^.*\//, '');
+
+/** The first credential path among `words` — as a word, a redirect target or an option value. */
+function credentialAmong(words: readonly string[]): Verdict {
+    for (const w of words) {
+        const target = w.replace(REDIRECT_PREFIX, '');
+        // `--config=.env`, `--defaults-file=~/.my.cnf`: the value of an option is a path too.
+        const candidates = target.includes('=') ? [target, target.slice(target.indexOf('=') + 1)] : [target];
+        for (const c of candidates) {
+            const cls = credentialFileClass(c);
+            if (cls !== null) return named(cls, c);
+        }
+    }
+    return null;
+}
+
+/**
+ * `env`'s arguments with each `-S`/`--split-string` value spliced in as the
+ * arguments it stands for, then its options and assignments skipped. Returns the
+ * command it runs, or an empty list when it runs none and prints the
+ * environment. A short option cluster ending in `u`, `C` or `S` takes the next
+ * word, `--unset`/`--chdir` take the next word, and a `NAME` operand after them
+ * is the variable they name.
+ */
+export function envCommand(args: readonly string[]): string[] {
+    const stream: string[] = [];
+    for (let k = 0; k < args.length; k += 1) {
+        const a = args[k] as string;
+        if (a === '-S' || a === '--split-string') {
+            stream.push(...commandWords(args[k + 1] ?? ''));
+            k += 1;
+        } else if (/^--split-string=/.test(a) || /^-[a-zA-Z]*S.+$/.test(a)) {
+            stream.push(...commandWords(a.startsWith('--') ? a.slice('--split-string='.length) : a.slice(a.indexOf('S') + 1)));
+        } else {
+            stream.push(a);
+        }
+    }
     let i = 0;
-    for (;;) {
-        while (i < words.length && ASSIGNMENT.test(words[i] as string)) i += 1;
-        const head = base(words[i] ?? '');
-        if (head === 'env') {
-            // `env` either prints the environment or runs the command after its
-            // options and assignments; `-S` carries a command string of its own.
-            let j = i + 1;
-            while (j < words.length) {
-                const w = words[j] as string;
-                if (w === '--') {
-                    j += 1;
-                    break;
-                }
-                if (!w.startsWith('-') || w === '-') break;
-                const split = w === '-S' || w === '--split-string' ? words[j + 1] : /^(?:-S|--split-string=)(.+)$/.exec(w)?.[1];
-                if (split !== undefined && depth < 3) {
-                    const inner = segmentVerdict(split, depth + 1);
-                    if (inner !== null) return inner;
-                }
-                j += ENV_ARG_FLAGS.has(w) ? 2 : 1;
-            }
-            while (j < words.length && ASSIGNMENT.test(words[j] as string)) j += 1;
-            if (j >= words.length) return { class: 'process-environment', what: '`env`' };
-            i = j;
+    while (i < stream.length) {
+        const w = stream[i] as string;
+        if (w === '--') {
+            i += 1;
+            break;
+        }
+        if (w.startsWith('-') && w !== '-') {
+            i += w === '--unset' || w === '--chdir' || /^-[a-zA-Z]*[uC]$/.test(w) ? 2 : 1;
+            continue;
+        }
+        if (ASSIGNMENT.test(w)) {
+            i += 1;
             continue;
         }
-        const argFlags = WRAPPER_ARG_FLAGS.get(head);
-        if (argFlags === undefined) break;
-        i = skipOptions(words, i + 1, argFlags);
-        if (head === 'timeout' && /^\d+(?:\.\d+)?[smhd]?$/.test(words[i] ?? '')) i += 1;
+        break;
     }
+    while (i < stream.length && ASSIGNMENT.test(stream[i] as string)) i += 1;
+    return stream.slice(i);
+}
+
+/**
+ * The sources of a `cp` or `mv`: every operand but the destination, or every
+ * operand when a target directory is named (`-t DIR`, a cluster ending in `t`,
+ * `-tDIR`, `--target-directory[=DIR]`). `-S`/`--suffix` take the next word.
+ */
+export function copySources(args: readonly string[]): string[] {
+    const operands: string[] = [];
+    let targetGiven = false;
+    for (let k = 0; k < args.length; k += 1) {
+        const a = args[k] as string;
+        if (a === '--target-directory' || /^-[a-zA-Z]*t$/.test(a)) {
+            targetGiven = true;
+            k += 1;
+        } else if (/^--target-directory=/.test(a) || /^-[a-zA-Z]*t.+$/.test(a)) {
+            targetGiven = true;
+        } else if (a === '-S' || a === '--suffix') {
+            k += 1;
+        } else if (!a.startsWith('-') || a === '-') {
+            operands.push(a);
+        }
+    }
+    return targetGiven ? operands : operands.slice(0, -1);
+}
+
+/** Why a command segment is refused, or null. `segment` starts at its command word. */
+export function segmentVerdict(segment: string, depth = 0): Verdict {
+    const words = commandWords(segment);
+    let i = 0;
+    while (i < words.length && ASSIGNMENT.test(words[i] as string)) i += 1;
     const cmd = base(words[i] ?? '');
     const args = words.slice(i + 1);
-    const operands = args.filter((a) => !a.startsWith('-'));
 
+    if (WRAPPERS.has(cmd)) {
+        if (args.some((a) => base(a) === 'env' || base(a) === 'printenv')) {
+            return { class: 'process-environment', what: `\`${cmd} … env\`` };
+        }
+        return credentialAmong(args);
+    }
+    if (cmd === 'env') {
+        const ran = envCommand(args);
+        if (ran.length === 0) return { class: 'process-environment', what: '`env`' };
+        if (depth >= 3) return credentialAmong(ran);
+        return segmentVerdict(ran.map((w) => (/\s/.test(w) ? `'${w}'` : w)).join(' '), depth + 1) ?? credentialAmong(args);
+    }
+
+    const operands = args.filter((a) => !a.startsWith('-'));
     // Printing the whole environment: `printenv` with no name, `export` with no
     // name, a bare `set` (`set -e` only sets options), and `declare -x|-p` with
     // no name.
     const dumpsEnv =
-        (cmd === 'printenv' && operands.length === 0) ||
+        (cmd === 'printenv' && !operands.some((a) => VARIABLE_NAME.test(a))) ||
         (cmd === 'export' && operands.length === 0) ||
         (cmd === 'set' && args.length === 0) ||
         ((cmd === 'declare' || cmd === 'typeset') && operands.length === 0 && args.some((a) => /^-[a-zA-Z]*[xp]/.test(a)));
@@ -212,39 +286,9 @@ export function segmentVerdict(segment: string, depth = 0): Verdict {
 
     // A copy or a rename reads its sources and only writes its destination:
     // `cp .env.example .env` creates the file, while `cp .env /dev/stdout` prints
-    // it and `cp .env x` or `mv .env x` launders it for the next command. With a
-    // target directory (`-t DIR`, `--target-directory=DIR`) every operand is a
-    // source.
-    if (cmd === 'cp' || cmd === 'mv') {
-        const sources: string[] = [];
-        let targetGiven = false;
-        for (let k = 0; k < args.length; k += 1) {
-            const a = args[k] as string;
-            if (a === '-t' || a === '--target-directory' || a === '-S' || a === '--suffix') {
-                if (a === '-t' || a === '--target-directory') targetGiven = true;
-                k += 1;
-            } else if (/^(?:-t.+|--target-directory=.*)$/.test(a)) {
-                targetGiven = true;
-            } else if (!a.startsWith('-')) {
-                sources.push(a);
-            }
-        }
-        for (const src of targetGiven ? sources : sources.slice(0, -1)) {
-            const cls = credentialFileClass(src);
-            if (cls !== null) return named(cls, src);
-        }
-        return null;
-    }
+    // it and `cp .env x` or `mv .env x` launders it for the next command.
+    if (cmd === 'cp' || cmd === 'mv') return credentialAmong(copySources(args));
+
     const reads = !(NON_READING_COMMANDS.has(cmd) || (cmd === 'git' && NON_READING_GIT.has(operands[0] ?? '')));
-    if (!reads) return null;
-    for (const w of words.slice(i + 1)) {
-        const target = w.replace(REDIRECT_PREFIX, '');
-        // `--config=.env`, `--defaults-file=~/.my.cnf`: the value of an option is a path too.
-        const candidates = target.includes('=') ? [target, target.slice(target.indexOf('=') + 1)] : [target];
-        for (const c of candidates) {
-            const cls = credentialFileClass(c);
-            if (cls !== null) return named(cls, c);
-        }
-    }
-    return null;
+    return reads ? credentialAmong(args) : null;
 }
diff --git a/tests/scripts/hooks/block_credential_reads.test.ts b/tests/scripts/hooks/block_credential_reads.test.ts
index 4c194d584..57e56ab84 100644
--- a/tests/scripts/hooks/block_credential_reads.test.ts
+++ b/tests/scripts/hooks/block_credential_reads.test.ts
@@ -126,6 +126,27 @@ describe('the tool and command surface', () => {
         }
     });
 
+    it('judges a wrapped segment conservatively, and splices env -S into env (council round 4c, third pass)', () => {
+        for (const cmd of [
+            "env -S 'cat' .env",
+            "env -S '-u PATH cat .env'",
+            "env -S'cat .env'",
+            'env -iu PATH',
+            'cp -vt backup .env',
+            'mv -ft backup .env',
+            'cp -tbackup .env',
+            'sudo -nu root cat .env',
+            'timeout .5s cat .env',
+            'xargs -a list.txt cat .env',
+            'sudo -E env',
+        ]) {
+            expect(run('Bash', { command: cmd }), cmd).toBe(1);
+        }
+        for (const cmd of ['sudo -nu root ls /root', 'timeout .5s npm test', 'cp -vt backup .env.example', 'env -i PATH=/bin node app.js']) {
+            expect(run('Bash', { command: cmd }), cmd).toBe(0);
+        }
+    });
+
     it('a .pem counts only when a name token says key, and only an absolute /proc path is the environment', () => {
         expect(credentialFileClass('certs/monkey.pem')).toBeNull();
         expect(credentialFileClass('certs/secretary-ca.pem')).toBeNull();
@@ -137,6 +158,8 @@ describe('the tool and command surface', () => {
 
     it('names a Windows path by its basename only', () => {
         const r = verdictFor('Read', { file_path: 'C:\\Users\\someone\\project\\.env' });
+        expect(r).not.toBeNull();
+        expect(r?.class).toBe('env-file');
         expect(r?.what).toBe('`.env`');
     });
 
```
