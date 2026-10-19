<!-- evidence-type: analysis -->

<!-- A prompt given to the council on 2026-10-18 for branch drain/road-to-one-detector-and-the-senders-we-own-20261018b,
     round 4c, second pass, committed verbatim so the verdict recorded beside it can be checked
     against what was actually asked. Not edited after the run. -->

# Review branch drain/road-to-one-detector-and-the-senders-we-own-20261018b, round 4c second pass — the credential-read guard

A ratification decision under ADR-268 § 4 on a new `pre_tool_use` guard and its policy; the
trade-off is what the guard refuses against what it lets an agent still do. Reviewed commit
`4ce4f5db1`. The first pass of 4c (both seats REQUEST_CHANGES) named bypasses; what changed:

1. **`cp`, `mv`, `source`, `.` were treated as non-reading** (both). `source` and `.` are now
   ordinary readers (refused on a credential path). `cp` and `mv` read their sources and only write
   their destination: a credential-class SOURCE is refused (`cp .env /dev/stdout`, `cp .env x`,
   `mv .env renamed.txt`), a credential-class destination is not (`cp .env.example .env`, the
   usual setup step, passes).
2. **Option-embedded paths** (anthropic): a word with `=` is judged both whole and after the first
   `=`, so `--config=.env` and `--defaults-file=~/.my.cnf` are refused.
3. **Missing files** (anthropic): `.git-credentials`, `.my.cnf`, `.pgpass` joined the class list.
4. **Nested and array inputs** (both): every string held under a path key (`file_path`, `path`,
   `paths`, `files`, `file_paths`, …) at any depth and inside arrays is read; a string under any
   other key is not, so `note: ".env"` in prose passes.
5. **Command substitution** (anthropic): the shared `invokedSegments` parser already unwraps
   `$(…)`, backticks, `<(…)`, `sh -c` and `eval`; `echo $(cat .env)`, `` echo `cat .env` `` and
   `cat <<< "$(cat .env)"` are now regression tests, all refused.
6. **Wrappers** (openai): `command`, `builtin`, `exec`, `sudo`, `doas`, `nice`, `nohup`, `time`,
   `stdbuf`, `timeout` (with their flags and amounts) are looked through, and the command word is
   compared by basename, so `/usr/bin/env`, `command env`, `sudo env`, `nice -n 5 printenv` are
   refused; `command -v node` and `sudo ls -la /root` pass.
7. **`.pem`/`.key` false positives** (openai): `.pem` counts only when its name says key
   (`key|private|secret|id_`): `server-key.pem` refuses, `ca.pem`, `cert.pem`, `chain.pem` pass. The
   cost — a key named like a certificate is not caught by name — is stated in the source. `.key`,
   `.p12`, `.pfx`, `.ppk`, `.jks`, `.keystore` stay.
8. **Compound template names** (openai): the last suffix decides, so `.env.local.example` and
   `.env.production.template` pass.
9. **`/proc` aliases** (openai): paths are POSIX-normalised first, so
   `/proc/self/../self/environ` is refused; a symlink stays residue.
10. **"Only fail-closed layer" wording** (both): the guard, the manifest entry, the allowlist note
    and the admission row now call it best-effort prevention over the shapes it recognises, which
    allows what it cannot decide.
11. **Tests not shown** (both): the test file is included below in full (19 cases).

Kept, with the reason: `wc` stays non-reading (it prints counts, not content); the refusal names the
basename only, because a full path can carry a user name and the class plus basename is enough to
act on; `printenv NAME` passes because a single named variable is a choice, not a dump.

For each defect report file:line, the failure scenario and a severity. Say whether each first-pass
finding is closed. State your stance (APPROVE or REQUEST_CHANGES) and the single highest-leverage
change.

```diff
diff --git a/src/scripts/_lib/credential_files.ts b/src/scripts/_lib/credential_files.ts
index 3a8b3a50e..4e37072b2 100644
--- a/src/scripts/_lib/credential_files.ts
+++ b/src/scripts/_lib/credential_files.ts
@@ -9,8 +9,9 @@
  * decided from the path alone, never from content — the guard runs before the
  * file is opened.
  *
- * Pure: no I/O, no dependency.
+ * Pure: no I/O. The one import is `node:path`'s POSIX normaliser.
  */
+import * as path from 'node:path';
 
 export type CredentialFileClass =
     | 'env-file'
@@ -31,7 +32,14 @@ export const CREDENTIAL_CLASS_LABEL: Readonly<Record<CredentialFileClass, string
 /** `.env.<suffix>` names that document keys rather than hold values. */
 const ENV_TEMPLATE_SUFFIXES: ReadonlySet<string> = new Set(['example', 'sample', 'template', 'dist', 'defaults', 'schema']);
 
-const KEY_EXTENSIONS: readonly string[] = ['.pem', '.key', '.p12', '.pfx', '.ppk', '.jks', '.keystore'];
+const KEY_EXTENSIONS: readonly string[] = ['.key', '.p12', '.pfx', '.ppk', '.jks', '.keystore'];
+/**
+ * `.pem` holds public certificates as often as private keys, so it counts only
+ * when the name says key: `server-key.pem`, `private.pem`, `id_rsa.pem` refuse;
+ * `ca.pem`, `cert.pem`, `chain.pem` pass. The cost, accepted: a private key named
+ * like a certificate is not caught by name.
+ */
+const KEY_PEM_NAME = /(?:key|private|secret|id_)/i;
 const SSH_KEY = /^id_(?:rsa|dsa|ecdsa|ed25519)(?:_sk)?$/;
 
 /** Path tails (after a `/` or at the start) of cloud, CLI and registry credential files. */
@@ -44,6 +52,9 @@ const CREDENTIAL_TAILS: ReadonlyArray<readonly [string, CredentialFileClass]> =
     ['.kube/config', 'cloud-credentials'],
     ['.docker/config.json', 'cloud-credentials'],
     ['.config/gh/hosts.yml', 'cloud-credentials'],
+    ['.git-credentials', 'cloud-credentials'],
+    ['.my.cnf', 'registry-credentials'],
+    ['.pgpass', 'registry-credentials'],
     ['.npmrc', 'registry-credentials'],
     ['.pypirc', 'registry-credentials'],
     ['.netrc', 'registry-credentials'],
@@ -59,18 +70,22 @@ const PROC_ENVIRON = /^\/proc\/[^/]+\/environ$/;
 
 /** The credential class of a path, or null. Decided from the path alone. */
 export function credentialFileClass(rawPath: string): CredentialFileClass | null {
-    const p = rawPath.trim().replace(/\\/g, '/').replace(/\/+$/, '');
-    if (p === '') return null;
-    if (PROC_ENVIRON.test(p)) return 'process-environment';
+    const trimmed = rawPath.trim().replace(/\\/g, '/').replace(/\/+$/, '');
+    if (trimmed === '') return null;
+    // `.` and `..` segments resolved, so `/proc/self/../self/environ` is the file it names.
+    const p = path.posix.normalize(trimmed);
+    if (PROC_ENVIRON.test(p) || PROC_ENVIRON.test(`/${p}`)) return 'process-environment';
     const base = p.slice(p.lastIndexOf('/') + 1);
     if (base === '.env' || base === '.envrc') return 'env-file';
     if (base.startsWith('.env.')) {
-        const suffix = base.slice('.env.'.length).toLowerCase();
-        return ENV_TEMPLATE_SUFFIXES.has(suffix) ? null : 'env-file';
+        // The LAST suffix decides: `.env.local.example` documents keys, `.env.local` holds values.
+        const last = base.slice(base.lastIndexOf('.') + 1).toLowerCase();
+        return ENV_TEMPLATE_SUFFIXES.has(last) ? null : 'env-file';
     }
     if (SSH_KEY.test(base)) return 'private-key';
     const lower = base.toLowerCase();
     if (KEY_EXTENSIONS.some((ext) => lower.endsWith(ext) && lower.length > ext.length)) return 'private-key';
+    if (lower.endsWith('.pem') && KEY_PEM_NAME.test(lower.slice(0, -4))) return 'private-key';
     for (const [tail, cls] of CREDENTIAL_TAILS) {
         if (p === tail || p.endsWith(`/${tail}`)) return cls;
     }
@@ -78,14 +93,20 @@ export function credentialFileClass(rawPath: string): CredentialFileClass | null
 }
 
 /**
- * Command words that act on a path without printing what it holds. A credential
- * path given to any other command is treated as a read, because the set of
- * commands that print a file is open and the set that do not is small.
+ * Command words that act on a path without printing or executing what it holds.
+ * A credential path given to any other command is treated as a read, because
+ * the set of commands that print a file is open and the set that do not is
+ * small. `cp`, `mv`, `source` and `.` are NOT here: `cp .env /dev/stdout` prints
+ * it, `source .env` runs it, and a copy or a rename launders the path for the
+ * next command.
  */
 const NON_READING_COMMANDS: ReadonlySet<string> = new Set([
-    'ls', 'stat', 'test', '[', 'touch', 'rm', 'mv', 'cp', 'chmod', 'chown', 'mkdir', 'wc', 'source', '.',
+    'ls', 'stat', 'test', '[', 'touch', 'rm', 'chmod', 'chown', 'mkdir', 'wc',
 ]);
 
+/** Words that run the command after them: `command env`, `sudo cat .env`, `nice -n 5 env`. */
+const WRAPPERS: ReadonlySet<string> = new Set(['command', 'builtin', 'exec', 'sudo', 'doas', 'nice', 'nohup', 'time', 'stdbuf', 'timeout']);
+
 /** `git` subcommands that name a path without printing its content. */
 const NON_READING_GIT: ReadonlySet<string> = new Set(['add', 'rm', 'mv', 'check-ignore', 'ls-files', 'status']);
 
@@ -104,8 +125,15 @@ const REDIRECT_PREFIX = /^(?:\d*[<>]{1,2}&?|&>{1,2})/;
 export function segmentVerdict(segment: string): { class: CredentialFileClass; what: string } | null {
     const words = commandWords(segment);
     let i = 0;
-    while (i < words.length && ASSIGNMENT.test(words[i] as string)) i += 1;
-    const cmd = words[i] ?? '';
+    for (;;) {
+        while (i < words.length && ASSIGNMENT.test(words[i] as string)) i += 1;
+        const head = (words[i] ?? '').replace(/^.*\//, '');
+        if (!WRAPPERS.has(head)) break;
+        i += 1;
+        // A wrapper's own flags and a `timeout`/`nice` amount are not the command.
+        while (i < words.length && (/^-/.test(words[i] as string) || /^\d+[smhd]?$/.test(words[i] as string))) i += 1;
+    }
+    const cmd = (words[i] ?? '').replace(/^.*\//, '');
     const args = words.slice(i + 1);
     const operands = args.filter((a) => !a.startsWith('-'));
 
@@ -119,12 +147,26 @@ export function segmentVerdict(segment: string): { class: CredentialFileClass; w
         ((cmd === 'declare' || cmd === 'typeset') && operands.length === 0 && args.some((a) => /^-[a-zA-Z]*[xp]/.test(a)));
     if (dumpsEnv) return { class: 'process-environment', what: `\`${cmd}\`` };
 
+    // A copy or a rename reads its sources and only writes its destination:
+    // `cp .env.example .env` creates the file, while `cp .env /dev/stdout` prints
+    // it and `cp .env x` or `mv .env x` launders it for the next command.
+    if (cmd === 'cp' || cmd === 'mv') {
+        for (const src of operands.slice(0, -1)) {
+            const cls = credentialFileClass(src);
+            if (cls !== null) return { class: cls, what: `\`${path.posix.basename(src)}\`` };
+        }
+        return null;
+    }
     const reads = !(NON_READING_COMMANDS.has(cmd) || (cmd === 'git' && NON_READING_GIT.has(operands[0] ?? '')));
     if (!reads) return null;
     for (const w of words.slice(i + 1)) {
         const target = w.replace(REDIRECT_PREFIX, '');
-        const cls = credentialFileClass(target);
-        if (cls !== null) return { class: cls, what: `\`${target}\`` };
+        // `--config=.env`, `--defaults-file=~/.my.cnf`: the value of an option is a path too.
+        const candidates = target.includes('=') ? [target, target.slice(target.indexOf('=') + 1)] : [target];
+        for (const c of candidates) {
+            const cls = credentialFileClass(c);
+            if (cls !== null) return { class: cls, what: `\`${path.posix.basename(c)}\`` };
+        }
     }
     return null;
 }
diff --git a/src/scripts/hooks/block_credential_reads.ts b/src/scripts/hooks/block_credential_reads.ts
index 3fb14f215..2f5eb7a66 100644
--- a/src/scripts/hooks/block_credential_reads.ts
+++ b/src/scripts/hooks/block_credential_reads.ts
@@ -4,9 +4,11 @@
  * command that prints the process environment — road-to-one-detector-and-the-
  * senders-we-own 1.1.
  *
- * Prevention is the only fail-closed layer of the egress work: a value that is
- * never read cannot reach a model provider through any later bug. Everything the
- * session reads goes into the conversation, so a `.env` read is a `.env` sent.
+ * Prevention ahead of the egress stage: a value that is never read cannot reach
+ * a model provider through any later bug, and everything the session reads goes
+ * into the conversation, so a `.env` read is a `.env` sent. It is a best-effort
+ * guard over the shapes it recognises, not a boundary: it allows what it cannot
+ * decide (`fail_closed: false`), and the residue below is not caught.
  *
  * What it refuses, with the class list in `_lib/credential_files.ts` (shared
  * with the installer's native deny tier):
@@ -15,8 +17,11 @@
  *     file (`.env`, `.env.*`, `.envrc` — `.env.example` and the other template
  *     names pass), a private key, a cloud or CLI credential file, or a
  *     package-registry credential file;
- *   - a shell command that hands such a path to anything but a short list of
- *     commands that do not print what the file holds (`ls`, `cp`, `rm`, …);
+ *   - a shell command that hands such a path — as an argument, a redirect or an
+ *     option value (`--config=.env`) — to anything but a short list of commands
+ *     that neither print nor run it (`ls`, `rm`, `chmod`, …), looking through
+ *     `sudo`/`command`/`nice`-style wrappers, `sh -c`, `eval` and command
+ *     substitutions;
  *   - a shell command that prints the environment (`env`, `printenv`, a bare
  *     `export`, a bare `set`, `declare -x`).
  *
@@ -51,7 +56,21 @@ type JsonObject = { [k: string]: JsonValue };
 
 export const KILL_SWITCH = 'AGENT_CONFIG_ALLOW_CREDENTIAL_READS';
 
-const PATH_KEYS: readonly string[] = ['file_path', 'path', 'target_file', 'filename', 'filePath', 'notebook_path'];
+const PATH_KEYS: ReadonlySet<string> = new Set([
+    'file_path', 'path', 'target_file', 'filename', 'filePath', 'notebook_path', 'paths', 'files', 'file_paths',
+]);
+
+/** Every string held under a path key, at any depth and inside arrays. */
+function pathValues(v: JsonValue | undefined, underPathKey: boolean, out: string[]): string[] {
+    if (typeof v === 'string') {
+        if (underPathKey && v !== '') out.push(v);
+    } else if (Array.isArray(v)) {
+        for (const x of v) pathValues(x, underPathKey, out);
+    } else if (isObject(v)) {
+        for (const [k, x] of Object.entries(v)) pathValues(x, underPathKey || PATH_KEYS.has(k), out);
+    }
+    return out;
+}
 
 /** Tools that write a value the model already has, or list names without content. */
 const NON_READING_TOOLS: ReadonlySet<string> = new Set(['write', 'create_file', 'glob', 'ls', 'list_dir', 'file_search']);
@@ -69,9 +88,7 @@ export interface Refusal {
 export function verdictFor(toolName: string, input: JsonObject): Refusal | null {
     const tool = toolName.trim().toLowerCase();
     if (!NON_READING_TOOLS.has(tool)) {
-        for (const key of PATH_KEYS) {
-            const v = input[key];
-            if (typeof v !== 'string' || v === '') continue;
+        for (const v of pathValues(input, false, [])) {
             const cls = credentialFileClass(v);
             if (cls !== null) return { class: cls, what: `\`${path.basename(v)}\`` };
         }
```

```ts
/**
 * `block_credential_reads` — road-to-one-detector-and-the-senders-we-own 1.1.
 *
 * Per file class a red and a green case on a deny-capable slot, and a warn
 * assertion on a slot that cannot refuse. Every allow-branch the guard declares
 * has a case too: a blocking concern whose allow paths are untested is one bad
 * envelope away from wedging a session. No fixture holds a credential value —
 * the guard decides from paths and command words alone.
 */
import { afterEach, describe, expect, it } from 'vitest';

import { credentialFileClass, segmentVerdict } from '../../../src/scripts/_lib/credential_files.js';
import { denyMessage, KILL_SWITCH, main, verdictFor } from '../../../src/scripts/hooks/block_credential_reads.js';
import { clearHookStdinOverride, setHookStdinOverride } from '../../../src/scripts/hooks/hook_stdin.js';
import { emitFor, isBlockCapable } from '../../../src/scripts/hooks/host_semantics.js';

function run(tool: string, input: Record<string, string>): number {
    setHookStdinOverride(JSON.stringify({ payload: { tool_name: tool, tool_input: input } }));
    try {
        return main();
    } finally {
        clearHookStdinOverride();
    }
}

afterEach(() => {
    delete process.env[KILL_SWITCH];
});

// One red and one green path per class: the green is the nearest legitimate neighbour.
const CLASSES: ReadonlyArray<{ cls: string; red: string; green: string }> = [
    { cls: 'env-file', red: 'app/.env', green: 'app/.env.example' },
    { cls: 'env-file', red: '.env.production.local', green: '.env.sample' },
    { cls: 'private-key', red: '/home/u/.ssh/id_ed25519', green: '/home/u/.ssh/id_ed25519.pub' },
    { cls: 'private-key', red: 'certs/server.key', green: 'docs/key.md' },
    { cls: 'cloud-credentials', red: '/home/u/.aws/credentials', green: '/home/u/.aws/notes.txt' },
    { cls: 'cloud-credentials', red: '/home/u/.config/gh/hosts.yml', green: '/home/u/.config/gh/config.yml' },
    { cls: 'registry-credentials', red: 'pkg/.npmrc', green: 'pkg/.nvmrc' },
    { cls: 'registry-credentials', red: '/home/u/.cargo/credentials.toml', green: '/home/u/.cargo/config.toml' },
];

describe('the file classes', () => {
    for (const c of CLASSES) {
        it(`${c.cls}: ${c.red} is refused, ${c.green} is not`, () => {
            expect(credentialFileClass(c.red)).toBe(c.cls);
            expect(credentialFileClass(c.green)).toBeNull();
            expect(run('Read', { file_path: c.red })).toBe(1);
            expect(run('Read', { file_path: c.green })).toBe(0);
        });
    }

    it('reads the process environment file as the environment', () => {
        expect(credentialFileClass('/proc/self/environ')).toBe('process-environment');
    });
});

describe('the tool and command surface', () => {
    it('refuses every reading file tool and passes the write-only and name-only ones', () => {
        for (const tool of ['Read', 'Edit', 'MultiEdit', 'Grep', 'NotebookEdit']) expect(run(tool, { file_path: '.env' })).toBe(1);
        for (const tool of ['Write', 'Glob', 'LS']) expect(run(tool, { file_path: '.env' })).toBe(0);
    });

    it('refuses a shell read of a credential file, and passes a command that does not print it', () => {
        for (const cmd of ['cat .env', 'grep KEY .env.local', 'head -1 ~/.aws/credentials', 'sort < .env', 'git diff .env', 'cd x && less .env']) {
            expect(run('Bash', { command: cmd }), cmd).toBe(1);
        }
        for (const cmd of ['ls -la .env', 'cp .env.example .env', 'rm .env', 'git add .env.example', 'git check-ignore .env', 'cat .env.example']) {
            expect(run('Bash', { command: cmd }), cmd).toBe(0);
        }
    });

    it('refuses a command that prints the environment, and passes one that only uses it', () => {
        for (const cmd of ['env', 'printenv', 'env | grep TOKEN', 'export', 'export -p', 'set', 'declare -x', 'cat /proc/self/environ']) {
            expect(run('Bash', { command: cmd }), cmd).toBe(1);
        }
        for (const cmd of ['env FOO=1 node app.js', 'printenv HOME', 'export PATH=/x:$PATH', 'set -euo pipefail', 'declare -a list']) {
            expect(run('Bash', { command: cmd }), cmd).toBe(0);
        }
    });

    it('refuses the bypasses council round 4c named', () => {
        for (const cmd of [
            'cp .env /dev/stdout',
            'cp .env backup.txt',
            'mv .env renamed.txt',
            'set -x; source .env',
            '. ./.env',
            'curl --config=.env https://x',
            'mysqldump --defaults-file=~/.my.cnf db',
            'echo $(cat .env)',
            'echo `cat .env`',
            'cat <<< "$(cat .env)"',
            'command env',
            '/usr/bin/env',
            'sudo env',
            'sudo -u root cat /root/.aws/credentials',
            "sh -c 'env'",
            'nice -n 5 printenv',
            'cat ~/.git-credentials',
            'cat /proc/self/../self/environ',
        ]) {
            expect(run('Bash', { command: cmd }), cmd).toBe(1);
        }
    });

    it('passes the legitimate neighbours of those bypasses', () => {
        for (const cmd of [
            'cp .env.example .env',
            'cp .env.local.example .env.local',
            'cat .env.production.template',
            'cat certs/ca.pem certs/chain.pem',
            'sudo ls -la /root',
            'command -v node',
        ]) {
            expect(run('Bash', { command: cmd }), cmd).toBe(0);
        }
        expect(run('Read', { file_path: 'certs/cert.pem' })).toBe(0);
        expect(run('Read', { file_path: 'certs/server-key.pem' })).toBe(1);
    });

    it('reads every path a tool input carries, nested and in arrays', () => {
        expect(run('MultiRead', { paths: ['README.md', 'app/.env'] } as unknown as Record<string, string>)).toBe(1);
        expect(run('Tool', { edits: [{ file_path: '.pgpass' }] } as unknown as Record<string, string>)).toBe(1);
        expect(run('Tool', { edits: [{ file_path: 'src/a.ts' }], note: '.env' } as unknown as Record<string, string>)).toBe(0);
    });

    it('a malformed envelope, an empty one and the kill switch all allow', () => {
        setHookStdinOverride('{not json');
        try {
            expect(main()).toBe(0);
        } finally {
            clearHookStdinOverride();
        }
        expect(run('Read', {})).toBe(0);
        process.env[KILL_SWITCH] = '1';
        expect(run('Read', { file_path: '.env' })).toBe(0);
    });

    it('the refusal names the class and the alternative, never a value', () => {
        const r = verdictFor('Read', { file_path: '/repo/.env' });
        expect(r?.class).toBe('env-file');
        const msg = denyMessage(r as NonNullable<typeof r>);
        expect(msg).toContain('environment file');
        expect(msg).toContain('process.env.NAME');
        expect(segmentVerdict('printenv')?.class).toBe('process-environment');
    });
});

describe('what the host does with the refusal', () => {
    it('a deny-capable slot refuses the call', () => {
        expect(isBlockCapable('claude', 'pre_tool_use')).toBe(true);
        const e = emitFor('claude', 'pre_tool_use', 'block', ['blocked'], 1);
        expect(e.exit).toBe(2);
    });

    it('a slot that cannot refuse only warns', () => {
        expect(isBlockCapable('claude', 'post_tool_use')).toBe(false);
        const e = emitFor('claude', 'post_tool_use', 'block', ['blocked'], 1);
        expect(e.exit).toBe(0);
        expect(JSON.parse(e.stdout).hookSpecificOutput.additionalContext).toContain('blocked');
    });
});
```
