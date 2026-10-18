<!-- evidence-type: analysis -->

<!-- A prompt given to the council on 2026-10-18 for branch drain/road-to-one-detector-and-the-senders-we-own-20261018b,
     round 4c, ninth pass, committed verbatim so the verdict recorded beside it can be checked
     against what was actually asked. Not edited after the run. -->

# Review branch drain/road-to-one-detector-and-the-senders-we-own-20261018b, round 4c ninth pass — the host as an argument

A ratification decision under ADR-268 § 4 on a new `pre_tool_use` guard. Reviewed commit
`0c48fc10d`. The eighth pass (2/2 REQUEST_CHANGES) agreed the ordinary POSIX false positive was
closed, and found two things: reading drive-letter and UNC spellings as Windows paths on a POSIX
host refused literal filenames the host does not open as credential files; and the module-level
test seam changed classification for every caller in the process. Both seats recommended the
host-faithful contract with an explicit policy argument.

What changed (host-faithful contract chosen):

- `PathHost = 'posix' | 'windows'`, and `HOST` read once from `process.platform`. A backslash
  separates on a Windows host only. The path's spelling decides nothing.
- The host is an explicit argument with that default on `credentialFileClass`,
  `credentialMention`, `segmentVerdict` and `verdictFor`, and a required one on the internal
  `mentionIn` and `credentialAmong`. The module-level mutable seam is gone.
- Tests judge each case on both hosts through `verdictFor(..., host)`: `dir\\.env` (quoted
  both ways), `.ssh\\id_rsa`, drive-absolute, UNC, drive-relative and root-relative paths refuse
  on Windows and pass on POSIX; a Read of `dir\\.env` and of a drive path likewise. A backslash the
  shell consumes as an escape (`cat .e\\nv`, `cat dir\\/.env`) and a file whose own name ends in
  `.key` refuse on both hosts. Seen red with the separator forced on and forced off.
- The earlier Windows-path cases moved from the host-default suite to the Windows host.

The question for the decision: is the guard ready to ratify — every named bypass refused on the
host that would open the file, and nothing refused that the host does not open as a credential
file? Name anything that still blocks ratification.

For each defect report file:line, the failure scenario and a severity. Say whether each
eighth-pass finding is closed. State your stance (APPROVE or REQUEST_CHANGES) and the single
highest-leverage change.

```diff
diff --git a/src/scripts/_lib/credential_files.ts b/src/scripts/_lib/credential_files.ts
index 0b52b9445..f4fbb4330 100644
--- a/src/scripts/_lib/credential_files.ts
+++ b/src/scripts/_lib/credential_files.ts
@@ -69,27 +69,20 @@ const CREDENTIAL_TAILS: ReadonlyArray<readonly [string, CredentialFileClass]> =
 const PROC_ENVIRON = /^\/proc\/[^/]+\/environ$/;
 
 /**
- * Whether a backslash separates path segments. On Windows it does; on a POSIX
- * host a backslash the shell keeps is a filename character (`'dir\.env'` is one
- * file), so reading it as a separator there refuses a file that is not a
- * credential file. A drive-letter or UNC path is read as a Windows path on any
- * host: its syntax says what it is.
+ * The host whose filesystem decides what a path names. A backslash separates
+ * path segments on Windows only: on a POSIX host it is a filename character, so
+ * `'dir\\.env'` — and `'C:\\project\\.env'` too — is one file there, not `.env`.
+ * Read from the platform, never from the path's spelling; callers that judge a
+ * path for another host pass it.
  */
-let backslashSeparates = process.platform === 'win32';
-const WINDOWS_PATH = /^(?:[A-Za-z]:\\|\\\\)/;
+export type PathHost = 'posix' | 'windows';
+export const HOST: PathHost = process.platform === 'win32' ? 'windows' : 'posix';
 
-/** Test seam: force the host's backslash reading, or `null` to restore it. */
-export function _setBackslashSeparatesForTest(value: boolean | null): void {
-    backslashSeparates = value ?? process.platform === 'win32';
-}
-
-function separated(p: string): string {
-    return backslashSeparates || WINDOWS_PATH.test(p) ? p.replace(/\\/g, '/') : p;
-}
+const separated = (p: string, host: PathHost): string => (host === 'windows' ? p.replace(/\\/g, '/') : p);
 
 /** The credential class of a path, or null. Decided from the path alone. */
-export function credentialFileClass(rawPath: string): CredentialFileClass | null {
-    const trimmed = separated(rawPath.trim()).replace(/\/+$/, '');
+export function credentialFileClass(rawPath: string, host: PathHost = HOST): CredentialFileClass | null {
+    const trimmed = separated(rawPath.trim(), host).replace(/\/+$/, '');
     if (trimmed === '') return null;
     // `.` and `..` segments resolved, so `/proc/self/../self/environ` is the file it names.
     const p = path.posix.normalize(trimmed);
@@ -202,30 +195,30 @@ const base = (w: string): string => w.replace(/^.*\//, '');
  * a path cannot hold unquoted — whitespace, quotes, redirections, pipes,
  * separators, parentheses, `=`, `,`, backticks — so `cat<.env`, `--config=.env`
  * and `<(cat .env)` all expose the path, and an attached short option
- * (`xargs -a.env`) is read both whole and without its `-x` prefix. A Windows
- * path is a path: `credentialFileClass` reads its backslashes as separators.
+ * (`xargs -a.env`) is read both whole and without its `-x` prefix. On a Windows
+ * host a backslash path is a path: `credentialFileClass` separates on it there.
  */
-export function credentialMention(text: string): Verdict {
+export function credentialMention(text: string, host: PathHost = HOST): Verdict {
     // Two readings of one segment, because neither alone matches the shell: the
     // raw text (a Windows path, an attached `cat<.env`), and each word the shell
     // would build — quotes joined, escapes applied only where the shell applies
     // them (`cat .e''nv`, an unquoted `cat .e\nv`) — each cut at the same
-    // characters. Whether a backslash separates is the path's decision, not the
-    // reading's (see `separated`).
+    // characters. Whether a backslash separates is the host's decision, not the
+    // reading's (see `PathHost`).
     const readings = [text, ...commandWords(text)];
     for (const reading of readings) {
-        const v = mentionIn(reading);
+        const v = mentionIn(reading, host);
         if (v !== null) return v;
     }
     return null;
 }
 
-function mentionIn(text: string): Verdict {
+function mentionIn(text: string, host: PathHost): Verdict {
     for (const raw of text.split(/[\s'"<>|;&()`=,]+/)) {
         if (raw === '') continue;
         const candidates = raw.startsWith('-') ? [raw, raw.replace(/^-+[A-Za-z]?/, '')] : [raw];
         for (const c of candidates) {
-            const cls = c === '' ? null : credentialFileClass(c);
+            const cls = c === '' ? null : credentialFileClass(c, host);
             if (cls !== null) return named(cls, c);
         }
     }
@@ -233,9 +226,9 @@ function mentionIn(text: string): Verdict {
 }
 
 /** The first credential path among words the shell already built — judged as data, never re-parsed. */
-function credentialAmong(words: readonly string[]): Verdict {
+function credentialAmong(words: readonly string[], host: PathHost): Verdict {
     for (const w of words) {
-        const v = mentionIn(w);
+        const v = mentionIn(w, host);
         if (v !== null) return v;
     }
     return null;
@@ -308,7 +301,7 @@ export function copySources(args: readonly string[]): string[] {
 }
 
 /** Why a command segment is refused, or null. `segment` starts at its command word. */
-export function segmentVerdict(segment: string, depth = 0): Verdict {
+export function segmentVerdict(segment: string, host: PathHost = HOST, depth = 0): Verdict {
     const words = commandWords(segment);
     let i = 0;
     while (i < words.length && ASSIGNMENT.test(words[i] as string)) i += 1;
@@ -319,13 +312,13 @@ export function segmentVerdict(segment: string, depth = 0): Verdict {
         if (args.some((a) => base(a) === 'env' || base(a) === 'printenv')) {
             return { class: 'process-environment', what: `\`${cmd} … env\`` };
         }
-        return credentialMention(segment);
+        return credentialMention(segment, host);
     }
     if (cmd === 'env') {
         const ran = envCommand(args);
         if (ran.length === 0) return { class: 'process-environment', what: '`env`' };
-        if (depth >= 3) return credentialAmong(ran);
-        return segmentVerdict(ran.map((w) => (/\s/.test(w) ? `'${w}'` : w)).join(' '), depth + 1) ?? credentialAmong(args);
+        if (depth >= 3) return credentialAmong(ran, host);
+        return segmentVerdict(ran.map((w) => (/\s/.test(w) ? `'${w}'` : w)).join(' '), host, depth + 1) ?? credentialAmong(args, host);
     }
 
     const operands = args.filter((a) => !a.startsWith('-'));
@@ -342,8 +335,8 @@ export function segmentVerdict(segment: string, depth = 0): Verdict {
     // A copy or a rename reads its sources and only writes its destination:
     // `cp .env.example .env` creates the file, while `cp .env /dev/stdout` prints
     // it and `cp .env x` or `mv .env x` launders it for the next command.
-    if (cmd === 'cp' || cmd === 'mv') return credentialAmong(copySources(args));
+    if (cmd === 'cp' || cmd === 'mv') return credentialAmong(copySources(args), host);
 
     const reads = !(NON_READING_COMMANDS.has(cmd) || (cmd === 'git' && NON_READING_GIT.has(operands[0] ?? '')));
-    return reads ? credentialMention(segment) : null;
+    return reads ? credentialMention(segment, host) : null;
 }
diff --git a/src/scripts/hooks/block_credential_reads.ts b/src/scripts/hooks/block_credential_reads.ts
index 554309776..ed90a26b3 100644
--- a/src/scripts/hooks/block_credential_reads.ts
+++ b/src/scripts/hooks/block_credential_reads.ts
@@ -50,8 +50,10 @@ import {
     CREDENTIAL_CLASS_LABEL,
     credentialBasename,
     credentialFileClass,
+    HOST,
     segmentVerdict,
     type CredentialFileClass,
+    type PathHost,
 } from '../_lib/credential_files.js';
 import { isEnvKillSwitchActive } from '../_lib/env_kill_switch.js';
 import { invokedSegments } from './git_command_classifier.js';
@@ -90,19 +92,19 @@ export interface Refusal {
     readonly what: string;
 }
 
-/** The refusal for one tool call, or null. Pure. */
-export function verdictFor(toolName: string, input: JsonObject): Refusal | null {
+/** The refusal for one tool call, or null. Pure: the host whose paths are judged is an argument. */
+export function verdictFor(toolName: string, input: JsonObject, host: PathHost = HOST): Refusal | null {
     const tool = toolName.trim().toLowerCase();
     if (!NON_READING_TOOLS.has(tool)) {
         for (const v of pathValues(input, false, [])) {
-            const cls = credentialFileClass(v);
+            const cls = credentialFileClass(v, host);
             if (cls !== null) return { class: cls, what: `\`${credentialBasename(v)}\`` };
         }
     }
     const cmd = input['command'];
     if (typeof cmd === 'string' && cmd !== '') {
         for (const segment of invokedSegments(cmd)) {
-            const r = segmentVerdict(segment);
+            const r = segmentVerdict(segment, host);
             if (r !== null) return r;
         }
     }
diff --git a/tests/scripts/hooks/block_credential_reads.test.ts b/tests/scripts/hooks/block_credential_reads.test.ts
index b16d101fb..e00e12425 100644
--- a/tests/scripts/hooks/block_credential_reads.test.ts
+++ b/tests/scripts/hooks/block_credential_reads.test.ts
@@ -9,7 +9,7 @@
  */
 import { afterEach, describe, expect, it } from 'vitest';
 
-import { _setBackslashSeparatesForTest, credentialFileClass, segmentVerdict } from '../../../src/scripts/_lib/credential_files.js';
+import { credentialFileClass, segmentVerdict, type PathHost } from '../../../src/scripts/_lib/credential_files.js';
 import { denyMessage, KILL_SWITCH, main, verdictFor } from '../../../src/scripts/hooks/block_credential_reads.js';
 import { clearHookStdinOverride, setHookStdinOverride } from '../../../src/scripts/hooks/hook_stdin.js';
 import { emitFor, isBlockCapable } from '../../../src/scripts/hooks/host_semantics.js';
@@ -25,7 +25,6 @@ function run(tool: string, input: Record<string, string>): number {
 
 afterEach(() => {
     delete process.env[KILL_SWITCH];
-    _setBackslashSeparatesForTest(null);
 });
 
 // One red and one green path per class: the green is the nearest legitimate neighbour.
@@ -155,13 +154,12 @@ describe('the tool and command surface', () => {
             'head<certs/tls.key',
             'node app.js<config/.env.local',
             'xargs -a.env echo',
-            'cat "C:\\Users\\someone\\project\\.env"',
             'diff --from-file=.env a b',
             'paste - <(cat .env)',
         ]) {
             expect(run('Bash', { command: cmd }), cmd).toBe(1);
         }
-        for (const cmd of ['cat<notes.txt', 'xargs -a list.txt echo', 'cat "C:\\Users\\someone\\project\\.env.example"']) {
+        for (const cmd of ['cat<notes.txt', 'xargs -a list.txt echo']) {
             expect(run('Bash', { command: cmd }), cmd).toBe(0);
         }
     });
@@ -185,24 +183,35 @@ describe('the tool and command surface', () => {
         }
     });
 
-    it('reads a backslash as a separator only where the host or the path syntax makes it one (council round 4c, seventh pass)', () => {
-        // On a POSIX host a backslash the shell keeps is a filename character:
-        // `dir\.env` is one file, not `.env` in `dir`.
-        _setBackslashSeparatesForTest(false);
-        for (const cmd of ["cat 'dir\\.env'", 'cat "dir\\.env"', "cat '.ssh\\id_rsa'"]) {
-            expect(run('Bash', { command: cmd }), JSON.stringify(cmd)).toBe(0);
+    it('reads a backslash as a separator on a Windows host only (council round 4c, seventh and eighth passes)', () => {
+        const bash = (command: string, host: PathHost) => verdictFor('Bash', { command }, host);
+        const read = (file_path: string, host: PathHost) => verdictFor('Read', { file_path }, host);
+        // Each of these names `.env` or a key in a directory on Windows, and one
+        // file whose name holds a backslash on a POSIX host.
+        const separatorDecides = [
+            "cat 'dir\\.env'",
+            'cat "dir\\.env"',
+            "cat '.ssh\\id_rsa'",
+            'cat "C:\\Users\\someone\\project\\.env"',
+            "cat '\\\\server\\share\\.env'",
+            "cat 'C:dir\\.env'",
+            "cat '\\Users\\x\\.env'",
+        ];
+        for (const cmd of separatorDecides) {
+            expect(bash(cmd, 'windows'), `windows ${JSON.stringify(cmd)}`).not.toBeNull();
+            expect(bash(cmd, 'posix'), `posix ${JSON.stringify(cmd)}`).toBeNull();
         }
-        expect(run('Read', { file_path: 'dir\\.env' })).toBe(0);
-        // A drive-letter or UNC path is a Windows path whatever the host.
-        for (const cmd of ['cat "C:\\Users\\someone\\project\\.env"', "cat '\\\\server\\share\\.env'"]) {
-            expect(run('Bash', { command: cmd }), JSON.stringify(cmd)).toBe(1);
+        for (const p of ['dir\\.env', 'C:\\Users\\someone\\project\\.env']) {
+            expect(read(p, 'windows'), `windows ${p}`).not.toBeNull();
+            expect(read(p, 'posix'), `posix ${p}`).toBeNull();
         }
-        // On a Windows host every backslash separates.
-        _setBackslashSeparatesForTest(true);
-        for (const cmd of ["cat 'dir\\.env'", 'cat "dir\\.env"', "cat '.ssh\\id_rsa'"]) {
-            expect(run('Bash', { command: cmd }), JSON.stringify(cmd)).toBe(1);
+        expect(bash('cat "C:\\Users\\someone\\project\\.env.example"', 'windows')).toBeNull();
+        // A backslash the shell consumes as an escape names the same file on both hosts.
+        for (const host of ['posix', 'windows'] as const) {
+            for (const cmd of ['cat .e\\nv', 'cat dir\\/.env', "cat 'certs\\tls.key'"]) {
+                expect(bash(cmd, host), `${host} ${JSON.stringify(cmd)}`).not.toBeNull();
+            }
         }
-        expect(run('Read', { file_path: 'dir\\.env' })).toBe(1);
     });
 
     it('a .pem counts only when a name token says key, and only an absolute /proc path is the environment', () => {
@@ -215,7 +224,7 @@ describe('the tool and command surface', () => {
     });
 
     it('names a Windows path by its basename only', () => {
-        const r = verdictFor('Read', { file_path: 'C:\\Users\\someone\\project\\.env' });
+        const r = verdictFor('Read', { file_path: 'C:\\Users\\someone\\project\\.env' }, 'windows');
         expect(r).not.toBeNull();
         expect(r?.class).toBe('env-file');
         expect(r?.what).toBe('`.env`');
```
