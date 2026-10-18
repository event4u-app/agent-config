<!-- evidence-type: analysis -->

<!-- A prompt given to the council on 2026-10-18 for branch drain/road-to-one-detector-and-the-senders-we-own-20261018b,
     round 4c, third pass, committed verbatim so the verdict recorded beside it can be checked
     against what was actually asked. Not edited after the run. -->

# Review branch drain/road-to-one-detector-and-the-senders-we-own-20261018b, round 4c third pass — the credential-read guard's command grammar

A ratification decision under ADR-268 § 4 on a new `pre_tool_use` guard and its policy. Reviewed
commit `702802f59`. The second pass (both seats REQUEST_CHANGES) closed findings 2–5, 8, 10 and 11
of the first pass and found the command grammar still generic; what changed:

1. **Wrapper option arity.** Each wrapper lists the options that take a separate argument —
   `sudo` (`-u -g -U -C -h -p -r -t -D -R` and their long forms), `doas` (`-u -C`), `nice`
   (`-n --adjustment`), `timeout` (`-s --signal -k --kill-after`, then one duration), `stdbuf`
   (`-i -o -e`), `time` (`-f -o`), `exec` (`-a`); `command`, `builtin` and `nohup` take none. A
   `--long=value` form and an unlisted flag take none. So `sudo -u root env`,
   `sudo --user root env`, `timeout --signal TERM 5 env`, `timeout -k 2 10s cat .env` and
   `exec -a name env` reach the real command.
2. **`env`** is parsed as a wrapper: its options (`-u --unset -C --chdir -S --split-string` take an
   argument) and assignments are skipped; nothing left means it prints the environment
   (`env -u PATH`, `env FOO=1`); otherwise the rest is the command (`env -C /tmp cat .env`). A
   `-S` string is judged as a command of its own (`env -S 'cat .env'`). `printenv` dumps only with
   no name operand.
3. **`cp`/`mv` target directories.** With `-t DIR`, `-tDIR`, `--target-directory DIR` or
   `--target-directory=DIR`, every operand is a source; otherwise the sources are all operands but
   the last. `-S`/`--suffix` take an argument. `cp -t backup .env`,
   `cp --target-directory=backup .env` and `mv --target-directory backup .env` are refused;
   `cp -t backup .env.example` passes.
4. **`.pem` names** match `key`, `private` or `secret` only as a whole token of the name (split on
   `-`, `_`, `.`), or an `id_` prefix: `monkey.pem` and `secretary-ca.pem` pass, `tls.key.pem` and
   `private.pem` refuse.
5. **`/proc`** matches only an absolute normalised path, so a repository file `proc/self/environ`
   passes.
6. **Windows paths** in a refusal are named by the basename after reading backslashes as
   separators, so `C:\\Users\\someone\\project\\.env` is named `.env`.

Every case above is a regression test (the test file's delta is below). The dispatch bundle reads
1,541,867 B of 1,550,000.

For each defect report file:line, the failure scenario and a severity. Say whether each
second-pass finding is closed. State your stance (APPROVE or REQUEST_CHANGES) and the single
highest-leverage change.

```diff
diff --git a/src/scripts/_lib/credential_files.ts b/src/scripts/_lib/credential_files.ts
index 4e37072b2..b23954013 100644
--- a/src/scripts/_lib/credential_files.ts
+++ b/src/scripts/_lib/credential_files.ts
@@ -39,7 +39,7 @@ const KEY_EXTENSIONS: readonly string[] = ['.key', '.p12', '.pfx', '.ppk', '.jks
  * `ca.pem`, `cert.pem`, `chain.pem` pass. The cost, accepted: a private key named
  * like a certificate is not caught by name.
  */
-const KEY_PEM_NAME = /(?:key|private|secret|id_)/i;
+const KEY_PEM_NAME = /(?:^|[-_.])(?:key|private|secret)(?:$|[-_.])|^id_/i;
 const SSH_KEY = /^id_(?:rsa|dsa|ecdsa|ed25519)(?:_sk)?$/;
 
 /** Path tails (after a `/` or at the start) of cloud, CLI and registry credential files. */
@@ -74,7 +74,7 @@ export function credentialFileClass(rawPath: string): CredentialFileClass | null
     if (trimmed === '') return null;
     // `.` and `..` segments resolved, so `/proc/self/../self/environ` is the file it names.
     const p = path.posix.normalize(trimmed);
-    if (PROC_ENVIRON.test(p) || PROC_ENVIRON.test(`/${p}`)) return 'process-environment';
+    if (PROC_ENVIRON.test(p)) return 'process-environment';
     const base = p.slice(p.lastIndexOf('/') + 1);
     if (base === '.env' || base === '.envrc') return 'env-file';
     if (base.startsWith('.env.')) {
@@ -104,8 +104,39 @@ const NON_READING_COMMANDS: ReadonlySet<string> = new Set([
     'ls', 'stat', 'test', '[', 'touch', 'rm', 'chmod', 'chown', 'mkdir', 'wc',
 ]);
 
-/** Words that run the command after them: `command env`, `sudo cat .env`, `nice -n 5 env`. */
-const WRAPPERS: ReadonlySet<string> = new Set(['command', 'builtin', 'exec', 'sudo', 'doas', 'nice', 'nohup', 'time', 'stdbuf', 'timeout']);
+/**
+ * Words that run the command after them, each with the options that take a
+ * separate argument — `sudo -u root env` runs `env`, not `root`. A `--long=value`
+ * form and an unlisted flag take none. `timeout` also takes one duration.
+ */
+const WRAPPER_ARG_FLAGS: ReadonlyMap<string, ReadonlySet<string>> = new Map([
+    ['command', new Set<string>()],
+    ['builtin', new Set<string>()],
+    ['exec', new Set(['-a'])],
+    ['nohup', new Set<string>()],
+    ['sudo', new Set(['-u', '-g', '-U', '-C', '-h', '-p', '-r', '-t', '-D', '-R', '--user', '--group', '--other-user', '--close-from', '--host', '--prompt', '--role', '--type', '--chdir', '--chroot'])],
+    ['doas', new Set(['-u', '-C'])],
+    ['nice', new Set(['-n', '--adjustment'])],
+    ['timeout', new Set(['-s', '--signal', '-k', '--kill-after'])],
+    ['stdbuf', new Set(['-i', '-o', '-e', '--input', '--output', '--error'])],
+    ['time', new Set(['-f', '--format', '-o', '--output'])],
+]);
+
+/** `env`'s own options that take an argument; `-S` / `--split-string` carries a command. */
+const ENV_ARG_FLAGS: ReadonlySet<string> = new Set(['-u', '--unset', '-C', '--chdir', '-S', '--split-string']);
+
+const base = (w: string): string => w.replace(/^.*\//, '');
+
+/** Index of the first word after a run of options, skipping each listed flag's separate argument. */
+function skipOptions(words: readonly string[], i: number, argFlags: ReadonlySet<string>): number {
+    while (i < words.length) {
+        const w = words[i] as string;
+        if (w === '--') return i + 1;
+        if (!w.startsWith('-') || w === '-') return i;
+        i += argFlags.has(w) ? 2 : 1;
+    }
+    return i;
+}
 
 /** `git` subcommands that name a path without printing its content. */
 const NON_READING_GIT: ReadonlySet<string> = new Set(['add', 'rm', 'mv', 'check-ignore', 'ls-files', 'status']);
@@ -121,27 +152,59 @@ export function commandWords(segment: string): string[] {
 const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;
 const REDIRECT_PREFIX = /^(?:\d*[<>]{1,2}&?|&>{1,2})/;
 
+type Verdict = { class: CredentialFileClass; what: string } | null;
+
+const named = (cls: CredentialFileClass, p: string): Verdict => ({ class: cls, what: `\`${credentialBasename(p)}\`` });
+
+/** The basename a refusal may name: backslashes read as separators, so no Windows path leaks whole. */
+export function credentialBasename(p: string): string {
+    return path.posix.basename(p.replace(/\\/g, '/'));
+}
+
 /** Why a command segment is refused, or null. `segment` starts at its command word. */
-export function segmentVerdict(segment: string): { class: CredentialFileClass; what: string } | null {
+export function segmentVerdict(segment: string, depth = 0): Verdict {
     const words = commandWords(segment);
     let i = 0;
     for (;;) {
         while (i < words.length && ASSIGNMENT.test(words[i] as string)) i += 1;
-        const head = (words[i] ?? '').replace(/^.*\//, '');
-        if (!WRAPPERS.has(head)) break;
-        i += 1;
-        // A wrapper's own flags and a `timeout`/`nice` amount are not the command.
-        while (i < words.length && (/^-/.test(words[i] as string) || /^\d+[smhd]?$/.test(words[i] as string))) i += 1;
+        const head = base(words[i] ?? '');
+        if (head === 'env') {
+            // `env` either prints the environment or runs the command after its
+            // options and assignments; `-S` carries a command string of its own.
+            let j = i + 1;
+            while (j < words.length) {
+                const w = words[j] as string;
+                if (w === '--') {
+                    j += 1;
+                    break;
+                }
+                if (!w.startsWith('-') || w === '-') break;
+                const split = w === '-S' || w === '--split-string' ? words[j + 1] : /^(?:-S|--split-string=)(.+)$/.exec(w)?.[1];
+                if (split !== undefined && depth < 3) {
+                    const inner = segmentVerdict(split, depth + 1);
+                    if (inner !== null) return inner;
+                }
+                j += ENV_ARG_FLAGS.has(w) ? 2 : 1;
+            }
+            while (j < words.length && ASSIGNMENT.test(words[j] as string)) j += 1;
+            if (j >= words.length) return { class: 'process-environment', what: '`env`' };
+            i = j;
+            continue;
+        }
+        const argFlags = WRAPPER_ARG_FLAGS.get(head);
+        if (argFlags === undefined) break;
+        i = skipOptions(words, i + 1, argFlags);
+        if (head === 'timeout' && /^\d+(?:\.\d+)?[smhd]?$/.test(words[i] ?? '')) i += 1;
     }
-    const cmd = (words[i] ?? '').replace(/^.*\//, '');
+    const cmd = base(words[i] ?? '');
     const args = words.slice(i + 1);
     const operands = args.filter((a) => !a.startsWith('-'));
 
-    // Printing the whole environment: `env` / `printenv` with nothing to run,
-    // `export` with no name, a bare `set` (`set -e` only sets options), and
-    // `declare -x|-p` with no name.
+    // Printing the whole environment: `printenv` with no name, `export` with no
+    // name, a bare `set` (`set -e` only sets options), and `declare -x|-p` with
+    // no name.
     const dumpsEnv =
-        ((cmd === 'env' || cmd === 'printenv') && operands.every((a) => ASSIGNMENT.test(a)) && !args.includes('--')) ||
+        (cmd === 'printenv' && operands.length === 0) ||
         (cmd === 'export' && operands.length === 0) ||
         (cmd === 'set' && args.length === 0) ||
         ((cmd === 'declare' || cmd === 'typeset') && operands.length === 0 && args.some((a) => /^-[a-zA-Z]*[xp]/.test(a)));
@@ -149,11 +212,26 @@ export function segmentVerdict(segment: string): { class: CredentialFileClass; w
 
     // A copy or a rename reads its sources and only writes its destination:
     // `cp .env.example .env` creates the file, while `cp .env /dev/stdout` prints
-    // it and `cp .env x` or `mv .env x` launders it for the next command.
+    // it and `cp .env x` or `mv .env x` launders it for the next command. With a
+    // target directory (`-t DIR`, `--target-directory=DIR`) every operand is a
+    // source.
     if (cmd === 'cp' || cmd === 'mv') {
-        for (const src of operands.slice(0, -1)) {
+        const sources: string[] = [];
+        let targetGiven = false;
+        for (let k = 0; k < args.length; k += 1) {
+            const a = args[k] as string;
+            if (a === '-t' || a === '--target-directory' || a === '-S' || a === '--suffix') {
+                if (a === '-t' || a === '--target-directory') targetGiven = true;
+                k += 1;
+            } else if (/^(?:-t.+|--target-directory=.*)$/.test(a)) {
+                targetGiven = true;
+            } else if (!a.startsWith('-')) {
+                sources.push(a);
+            }
+        }
+        for (const src of targetGiven ? sources : sources.slice(0, -1)) {
             const cls = credentialFileClass(src);
-            if (cls !== null) return { class: cls, what: `\`${path.posix.basename(src)}\`` };
+            if (cls !== null) return named(cls, src);
         }
         return null;
     }
@@ -165,7 +243,7 @@ export function segmentVerdict(segment: string): { class: CredentialFileClass; w
         const candidates = target.includes('=') ? [target, target.slice(target.indexOf('=') + 1)] : [target];
         for (const c of candidates) {
             const cls = credentialFileClass(c);
-            if (cls !== null) return { class: cls, what: `\`${path.posix.basename(c)}\`` };
+            if (cls !== null) return named(cls, c);
         }
     }
     return null;
diff --git a/src/scripts/hooks/block_credential_reads.ts b/src/scripts/hooks/block_credential_reads.ts
index 2f5eb7a66..554309776 100644
--- a/src/scripts/hooks/block_credential_reads.ts
+++ b/src/scripts/hooks/block_credential_reads.ts
@@ -46,7 +46,13 @@ import * as fs from 'node:fs';
 import * as path from 'node:path';
 import { fileURLToPath, pathToFileURL } from 'node:url';
 
-import { CREDENTIAL_CLASS_LABEL, credentialFileClass, segmentVerdict, type CredentialFileClass } from '../_lib/credential_files.js';
+import {
+    CREDENTIAL_CLASS_LABEL,
+    credentialBasename,
+    credentialFileClass,
+    segmentVerdict,
+    type CredentialFileClass,
+} from '../_lib/credential_files.js';
 import { isEnvKillSwitchActive } from '../_lib/env_kill_switch.js';
 import { invokedSegments } from './git_command_classifier.js';
 import { readHookStdin } from './hook_stdin.js';
@@ -90,7 +96,7 @@ export function verdictFor(toolName: string, input: JsonObject): Refusal | null
     if (!NON_READING_TOOLS.has(tool)) {
         for (const v of pathValues(input, false, [])) {
             const cls = credentialFileClass(v);
-            if (cls !== null) return { class: cls, what: `\`${path.basename(v)}\`` };
+            if (cls !== null) return { class: cls, what: `\`${credentialBasename(v)}\`` };
         }
     }
     const cmd = input['command'];
diff --git a/tests/scripts/hooks/block_credential_reads.test.ts b/tests/scripts/hooks/block_credential_reads.test.ts
index 13160b3cd..4c194d584 100644
--- a/tests/scripts/hooks/block_credential_reads.test.ts
+++ b/tests/scripts/hooks/block_credential_reads.test.ts
@@ -103,6 +103,43 @@ describe('the tool and command surface', () => {
         }
     });
 
+    it('reads command grammar the way the command does (council round 4c, second pass)', () => {
+        for (const cmd of [
+            'sudo -u root env',
+            'sudo --user root env',
+            'sudo --user=root printenv',
+            'env -u PATH',
+            'env FOO=1',
+            "env -S 'cat .env'",
+            'env -C /tmp cat .env',
+            'cp -t backup .env',
+            'cp --target-directory=backup .env',
+            'mv --target-directory backup .env',
+            'timeout --signal TERM 5 env',
+            'timeout -k 2 10s cat .env',
+            'exec -a name env',
+        ]) {
+            expect(run('Bash', { command: cmd }), cmd).toBe(1);
+        }
+        for (const cmd of ['sudo -u root ls /root', 'timeout 5 npm test', 'env FOO=1 node app.js', 'cp -t backup .env.example']) {
+            expect(run('Bash', { command: cmd }), cmd).toBe(0);
+        }
+    });
+
+    it('a .pem counts only when a name token says key, and only an absolute /proc path is the environment', () => {
+        expect(credentialFileClass('certs/monkey.pem')).toBeNull();
+        expect(credentialFileClass('certs/secretary-ca.pem')).toBeNull();
+        expect(credentialFileClass('certs/tls.key.pem')).toBe('private-key');
+        expect(credentialFileClass('certs/private.pem')).toBe('private-key');
+        expect(credentialFileClass('docs/proc/self/environ')).toBeNull();
+        expect(credentialFileClass('proc/self/environ')).toBeNull();
+    });
+
+    it('names a Windows path by its basename only', () => {
+        const r = verdictFor('Read', { file_path: 'C:\\Users\\someone\\project\\.env' });
+        expect(r?.what).toBe('`.env`');
+    });
+
     it('passes the legitimate neighbours of those bypasses', () => {
         for (const cmd of [
             'cp .env.example .env',
```
