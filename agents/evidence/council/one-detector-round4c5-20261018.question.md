<!-- evidence-type: analysis -->

<!-- A prompt given to the council on 2026-10-18 for branch drain/road-to-one-detector-and-the-senders-we-own-20261018b,
     round 4c, fifth pass, committed verbatim so the verdict recorded beside it can be checked
     against what was actually asked. Not edited after the run. -->

# Review branch drain/road-to-one-detector-and-the-senders-we-own-20261018b, round 4c fifth pass — credential paths read from raw text

A ratification decision under ADR-268 § 4 on a new `pre_tool_use` guard; the trade-off is a
conservative refusal against an open shell grammar. Reviewed commit `483e71ae8`. The fourth pass
closed the wrapper, `timeout`, `cp -vt` and `env -S` findings for their spellings and found three
places where reading parsed words diverged from what the shell does:

1. **Attached redirections** (anthropic): `cat<.env`, `cat<".env"`, `head<secrets.key`.
2. **Attached short-option values** (openai): `xargs -a.env echo`.
3. **Double-quoted backslashes** (openai): the lexer dropped every backslash inside double quotes,
   so `cat "C:\\Users\\someone\\project\\.env"` lost its separators.

The change stops depending on word parsing for the question "is a credential path mentioned":
`credentialMention(text)` cuts the RAW segment text at every character an unquoted path cannot
hold — whitespace, quotes, `<`, `>`, `|`, `;`, `&`, parentheses, backtick, `=`, `,` — with
backslashes read as path separators, and judges every piece with `credentialFileClass`; a piece
starting with `-` is judged both whole and without its `-x` prefix. Every reading command, every
wrapped segment, and `env`'s fallback use it. Parsed words remain only where structure decides
(which command, `env`'s argv, `cp`/`mv` sources). Inside double quotes a backslash now escapes
only `$`, backtick, `"`, `\\` and newline, as in the shell. Regressions: the eight forms above and
`diff --from-file=.env a b`, `paste - <(cat .env)` refuse; `cat<notes.txt`, `xargs -a list.txt echo`
and a double-quoted Windows path to `.env.example` pass.

The whole module is included below after the delta, so the lexer and every branch can be read in
place. Known and accepted: the raw scan judges a mention, so an `echo` naming `.env` refuses; a
wrapped non-reader that names a credential path refuses; a program that opens the file by itself
is the recorded residue.

For each defect report file:line, the failure scenario and a severity. Say whether each
fourth-pass finding is closed. State your stance (APPROVE or REQUEST_CHANGES) and the single
highest-leverage change.

```diff
diff --git a/src/scripts/_lib/credential_files.ts b/src/scripts/_lib/credential_files.ts
index 0bb635715..c75ad7f81 100644
--- a/src/scripts/_lib/credential_files.ts
+++ b/src/scripts/_lib/credential_files.ts
@@ -141,9 +141,10 @@ export function commandWords(segment: string): string[] {
             word += segment.slice(i + 1, end === -1 ? segment.length : end);
             i = end === -1 ? segment.length : end;
         } else if (ch === '"') {
+            // Inside double quotes a backslash escapes only $ ` " \ and a newline.
             let j = i + 1;
             for (; j < segment.length && segment[j] !== '"'; j += 1) {
-                if (segment[j] === '\\' && j + 1 < segment.length) j += 1;
+                if (segment[j] === '\\' && j + 1 < segment.length && '$`"\\\n'.includes(segment[j + 1] as string)) j += 1;
                 word += segment[j];
             }
             i = j;
@@ -159,7 +160,6 @@ export function commandWords(segment: string): string[] {
 }
 
 const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;
-const REDIRECT_PREFIX = /^(?:\d*[<>]{1,2}&?|&>{1,2})/;
 const VARIABLE_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
 
 type Verdict = { class: CredentialFileClass; what: string } | null;
@@ -172,20 +172,32 @@ export function credentialBasename(p: string): string {
 const named = (cls: CredentialFileClass, p: string): Verdict => ({ class: cls, what: `\`${credentialBasename(p)}\`` });
 const base = (w: string): string => w.replace(/^.*\//, '');
 
-/** The first credential path among `words` — as a word, a redirect target or an option value. */
-function credentialAmong(words: readonly string[]): Verdict {
-    for (const w of words) {
-        const target = w.replace(REDIRECT_PREFIX, '');
-        // `--config=.env`, `--defaults-file=~/.my.cnf`: the value of an option is a path too.
-        const candidates = target.includes('=') ? [target, target.slice(target.indexOf('=') + 1)] : [target];
+/**
+ * The first credential path mentioned anywhere in `text`, read from the raw
+ * characters rather than from parsed words: the text is cut at every character
+ * a path cannot hold unquoted — whitespace, quotes, redirections, pipes,
+ * separators, parentheses, `=`, `,`, backticks — so `cat<.env`, `--config=.env`
+ * and `<(cat .env)` all expose the path, and an attached short option
+ * (`xargs -a.env`) is read both whole and without its `-x` prefix. Backslashes
+ * read as separators, so a Windows path is a path.
+ */
+export function credentialMention(text: string): Verdict {
+    for (const raw of text.replace(/\\/g, '/').split(/[\s'"<>|;&()`=,]+/)) {
+        if (raw === '') continue;
+        const candidates = raw.startsWith('-') ? [raw, raw.replace(/^-+[A-Za-z]?/, '')] : [raw];
         for (const c of candidates) {
-            const cls = credentialFileClass(c);
+            const cls = c === '' ? null : credentialFileClass(c);
             if (cls !== null) return named(cls, c);
         }
     }
     return null;
 }
 
+/** The first credential path among parsed words (each judged as raw text). */
+function credentialAmong(words: readonly string[]): Verdict {
+    return credentialMention(words.join(' '));
+}
+
 /**
  * `env`'s arguments with each `-S`/`--split-string` value spliced in as the
  * arguments it stands for, then its options and assignments skipped. Returns the
@@ -264,7 +276,7 @@ export function segmentVerdict(segment: string, depth = 0): Verdict {
         if (args.some((a) => base(a) === 'env' || base(a) === 'printenv')) {
             return { class: 'process-environment', what: `\`${cmd} … env\`` };
         }
-        return credentialAmong(args);
+        return credentialMention(segment);
     }
     if (cmd === 'env') {
         const ran = envCommand(args);
@@ -290,5 +302,5 @@ export function segmentVerdict(segment: string, depth = 0): Verdict {
     if (cmd === 'cp' || cmd === 'mv') return credentialAmong(copySources(args));
 
     const reads = !(NON_READING_COMMANDS.has(cmd) || (cmd === 'git' && NON_READING_GIT.has(operands[0] ?? '')));
-    return reads ? credentialAmong(args) : null;
+    return reads ? credentialMention(segment) : null;
 }
diff --git a/tests/scripts/hooks/block_credential_reads.test.ts b/tests/scripts/hooks/block_credential_reads.test.ts
index 57e56ab84..14099b6f7 100644
--- a/tests/scripts/hooks/block_credential_reads.test.ts
+++ b/tests/scripts/hooks/block_credential_reads.test.ts
@@ -147,6 +147,24 @@ describe('the tool and command surface', () => {
         }
     });
 
+    it('reads credential paths from the raw text, not only from parsed words (council round 4c, fourth pass)', () => {
+        for (const cmd of [
+            'cat<.env',
+            'cat<".env"',
+            'head<certs/tls.key',
+            'node app.js<config/.env.local',
+            'xargs -a.env echo',
+            'cat "C:\\Users\\someone\\project\\.env"',
+            'diff --from-file=.env a b',
+            'paste - <(cat .env)',
+        ]) {
+            expect(run('Bash', { command: cmd }), cmd).toBe(1);
+        }
+        for (const cmd of ['cat<notes.txt', 'xargs -a list.txt echo', 'cat "C:\\Users\\someone\\project\\.env.example"']) {
+            expect(run('Bash', { command: cmd }), cmd).toBe(0);
+        }
+    });
+
     it('a .pem counts only when a name token says key, and only an absolute /proc path is the environment', () => {
         expect(credentialFileClass('certs/monkey.pem')).toBeNull();
         expect(credentialFileClass('certs/secretary-ca.pem')).toBeNull();
```

```ts
/**
 * Which files hold credentials by construction, and which commands print the
 * process environment — the one list the `pre_tool_use` read guard
 * (`hooks/block_credential_reads.ts`) and the installer's native deny tier read
 * (road-to-one-detector-and-the-senders-we-own 1.1, 1.2).
 *
 * Prevention is the only fail-closed layer the egress work has: a value that is
 * never read cannot leak through any later bug. So the classes are file KINDS,
 * decided from the path alone, never from content — the guard runs before the
 * file is opened.
 *
 * Pure: no I/O. The one import is `node:path`'s POSIX normaliser.
 */
import * as path from 'node:path';

export type CredentialFileClass =
    | 'env-file'
    | 'private-key'
    | 'cloud-credentials'
    | 'registry-credentials'
    | 'process-environment';

/** What each class is, for a refusal a reader can act on. */
export const CREDENTIAL_CLASS_LABEL: Readonly<Record<CredentialFileClass, string>> = {
    'env-file': 'an environment file (.env)',
    'private-key': 'a private key',
    'cloud-credentials': 'a cloud or CLI credential file',
    'registry-credentials': 'a package-registry credential file',
    'process-environment': 'a process environment',
};

/** `.env.<suffix>` names that document keys rather than hold values. */
const ENV_TEMPLATE_SUFFIXES: ReadonlySet<string> = new Set(['example', 'sample', 'template', 'dist', 'defaults', 'schema']);

const KEY_EXTENSIONS: readonly string[] = ['.key', '.p12', '.pfx', '.ppk', '.jks', '.keystore'];
/**
 * `.pem` holds public certificates as often as private keys, so it counts only
 * when the name says key: `server-key.pem`, `private.pem`, `id_rsa.pem` refuse;
 * `ca.pem`, `cert.pem`, `chain.pem` pass. The cost, accepted: a private key named
 * like a certificate is not caught by name.
 */
const KEY_PEM_NAME = /(?:^|[-_.])(?:key|private|secret)(?:$|[-_.])|^id_/i;
const SSH_KEY = /^id_(?:rsa|dsa|ecdsa|ed25519)(?:_sk)?$/;

/** Path tails (after a `/` or at the start) of cloud, CLI and registry credential files. */
const CREDENTIAL_TAILS: ReadonlyArray<readonly [string, CredentialFileClass]> = [
    ['.aws/credentials', 'cloud-credentials'],
    ['.config/gcloud/application_default_credentials.json', 'cloud-credentials'],
    ['.config/gcloud/credentials.db', 'cloud-credentials'],
    ['.azure/accessTokens.json', 'cloud-credentials'],
    ['.azure/msal_token_cache.json', 'cloud-credentials'],
    ['.kube/config', 'cloud-credentials'],
    ['.docker/config.json', 'cloud-credentials'],
    ['.config/gh/hosts.yml', 'cloud-credentials'],
    ['.git-credentials', 'cloud-credentials'],
    ['.my.cnf', 'registry-credentials'],
    ['.pgpass', 'registry-credentials'],
    ['.npmrc', 'registry-credentials'],
    ['.pypirc', 'registry-credentials'],
    ['.netrc', 'registry-credentials'],
    ['_netrc', 'registry-credentials'],
    ['.gem/credentials', 'registry-credentials'],
    ['.cargo/credentials', 'registry-credentials'],
    ['.cargo/credentials.toml', 'registry-credentials'],
    ['.composer/auth.json', 'registry-credentials'],
    ['.config/composer/auth.json', 'registry-credentials'],
];

const PROC_ENVIRON = /^\/proc\/[^/]+\/environ$/;

/** The credential class of a path, or null. Decided from the path alone. */
export function credentialFileClass(rawPath: string): CredentialFileClass | null {
    const trimmed = rawPath.trim().replace(/\\/g, '/').replace(/\/+$/, '');
    if (trimmed === '') return null;
    // `.` and `..` segments resolved, so `/proc/self/../self/environ` is the file it names.
    const p = path.posix.normalize(trimmed);
    if (PROC_ENVIRON.test(p)) return 'process-environment';
    const base = p.slice(p.lastIndexOf('/') + 1);
    if (base === '.env' || base === '.envrc') return 'env-file';
    if (base.startsWith('.env.')) {
        // The LAST suffix decides: `.env.local.example` documents keys, `.env.local` holds values.
        const last = base.slice(base.lastIndexOf('.') + 1).toLowerCase();
        return ENV_TEMPLATE_SUFFIXES.has(last) ? null : 'env-file';
    }
    if (SSH_KEY.test(base)) return 'private-key';
    const lower = base.toLowerCase();
    if (KEY_EXTENSIONS.some((ext) => lower.endsWith(ext) && lower.length > ext.length)) return 'private-key';
    if (lower.endsWith('.pem') && KEY_PEM_NAME.test(lower.slice(0, -4))) return 'private-key';
    for (const [tail, cls] of CREDENTIAL_TAILS) {
        if (p === tail || p.endsWith(`/${tail}`)) return cls;
    }
    return null;
}

/**
 * Command words that act on a path without printing or executing what it holds.
 * A credential path given to any other command is treated as a read, because
 * the set of commands that print a file is open and the set that do not is
 * small. `cp`, `mv`, `source` and `.` are NOT here: `cp .env /dev/stdout` prints
 * it, `source .env` runs it, and a copy or a rename launders the path for the
 * next command.
 */
const NON_READING_COMMANDS: ReadonlySet<string> = new Set([
    'ls', 'stat', 'test', '[', 'touch', 'rm', 'chmod', 'chown', 'mkdir', 'wc',
]);

/**
 * Words that run the command after them: `sudo`, `nice`, `timeout`, …. Their
 * option grammars differ and clustering (`sudo -nu root`) defeats any table of
 * them, so a segment that starts with one is judged conservatively instead of
 * parsed: any credential path anywhere in it refuses, and so does an `env` or a
 * `printenv` anywhere in it.
 */
const WRAPPERS: ReadonlySet<string> = new Set([
    'command', 'builtin', 'exec', 'nohup', 'sudo', 'doas', 'nice', 'timeout', 'stdbuf', 'time', 'xargs', 'watch', 'unbuffer',
]);

/** `git` subcommands that name a path without printing its content. */
const NON_READING_GIT: ReadonlySet<string> = new Set(['add', 'rm', 'mv', 'check-ignore', 'ls-files', 'status']);

/**
 * Split one command segment into words the way the shell joins them: quoted
 * and unquoted runs with no space between them are one word (`-S'cat .env'` is
 * `-Scat .env`), quotes are removed, and a backslash escapes the next character.
 */
export function commandWords(segment: string): string[] {
    const words: string[] = [];
    let word = '';
    let inWord = false;
    for (let i = 0; i < segment.length; i += 1) {
        const ch = segment[i] as string;
        if (/\s/.test(ch)) {
            if (inWord) words.push(word);
            word = '';
            inWord = false;
            continue;
        }
        inWord = true;
        if (ch === "'") {
            const end = segment.indexOf("'", i + 1);
            word += segment.slice(i + 1, end === -1 ? segment.length : end);
            i = end === -1 ? segment.length : end;
        } else if (ch === '"') {
            // Inside double quotes a backslash escapes only $ ` " \ and a newline.
            let j = i + 1;
            for (; j < segment.length && segment[j] !== '"'; j += 1) {
                if (segment[j] === '\\' && j + 1 < segment.length && '$`"\\\n'.includes(segment[j + 1] as string)) j += 1;
                word += segment[j];
            }
            i = j;
        } else if (ch === '\\' && i + 1 < segment.length) {
            word += segment[i + 1];
            i += 1;
        } else {
            word += ch;
        }
    }
    if (inWord) words.push(word);
    return words;
}

const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;
const VARIABLE_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

type Verdict = { class: CredentialFileClass; what: string } | null;

/** The basename a refusal may name: backslashes read as separators, so no Windows path leaks whole. */
export function credentialBasename(p: string): string {
    return path.posix.basename(p.replace(/\\/g, '/'));
}

const named = (cls: CredentialFileClass, p: string): Verdict => ({ class: cls, what: `\`${credentialBasename(p)}\`` });
const base = (w: string): string => w.replace(/^.*\//, '');

/**
 * The first credential path mentioned anywhere in `text`, read from the raw
 * characters rather than from parsed words: the text is cut at every character
 * a path cannot hold unquoted — whitespace, quotes, redirections, pipes,
 * separators, parentheses, `=`, `,`, backticks — so `cat<.env`, `--config=.env`
 * and `<(cat .env)` all expose the path, and an attached short option
 * (`xargs -a.env`) is read both whole and without its `-x` prefix. Backslashes
 * read as separators, so a Windows path is a path.
 */
export function credentialMention(text: string): Verdict {
    for (const raw of text.replace(/\\/g, '/').split(/[\s'"<>|;&()`=,]+/)) {
        if (raw === '') continue;
        const candidates = raw.startsWith('-') ? [raw, raw.replace(/^-+[A-Za-z]?/, '')] : [raw];
        for (const c of candidates) {
            const cls = c === '' ? null : credentialFileClass(c);
            if (cls !== null) return named(cls, c);
        }
    }
    return null;
}

/** The first credential path among parsed words (each judged as raw text). */
function credentialAmong(words: readonly string[]): Verdict {
    return credentialMention(words.join(' '));
}

/**
 * `env`'s arguments with each `-S`/`--split-string` value spliced in as the
 * arguments it stands for, then its options and assignments skipped. Returns the
 * command it runs, or an empty list when it runs none and prints the
 * environment. A short option cluster ending in `u`, `C` or `S` takes the next
 * word, `--unset`/`--chdir` take the next word, and a `NAME` operand after them
 * is the variable they name.
 */
export function envCommand(args: readonly string[]): string[] {
    const stream: string[] = [];
    for (let k = 0; k < args.length; k += 1) {
        const a = args[k] as string;
        if (a === '-S' || a === '--split-string') {
            stream.push(...commandWords(args[k + 1] ?? ''));
            k += 1;
        } else if (/^--split-string=/.test(a) || /^-[a-zA-Z]*S.+$/.test(a)) {
            stream.push(...commandWords(a.startsWith('--') ? a.slice('--split-string='.length) : a.slice(a.indexOf('S') + 1)));
        } else {
            stream.push(a);
        }
    }
    let i = 0;
    while (i < stream.length) {
        const w = stream[i] as string;
        if (w === '--') {
            i += 1;
            break;
        }
        if (w.startsWith('-') && w !== '-') {
            i += w === '--unset' || w === '--chdir' || /^-[a-zA-Z]*[uC]$/.test(w) ? 2 : 1;
            continue;
        }
        if (ASSIGNMENT.test(w)) {
            i += 1;
            continue;
        }
        break;
    }
    while (i < stream.length && ASSIGNMENT.test(stream[i] as string)) i += 1;
    return stream.slice(i);
}

/**
 * The sources of a `cp` or `mv`: every operand but the destination, or every
 * operand when a target directory is named (`-t DIR`, a cluster ending in `t`,
 * `-tDIR`, `--target-directory[=DIR]`). `-S`/`--suffix` take the next word.
 */
export function copySources(args: readonly string[]): string[] {
    const operands: string[] = [];
    let targetGiven = false;
    for (let k = 0; k < args.length; k += 1) {
        const a = args[k] as string;
        if (a === '--target-directory' || /^-[a-zA-Z]*t$/.test(a)) {
            targetGiven = true;
            k += 1;
        } else if (/^--target-directory=/.test(a) || /^-[a-zA-Z]*t.+$/.test(a)) {
            targetGiven = true;
        } else if (a === '-S' || a === '--suffix') {
            k += 1;
        } else if (!a.startsWith('-') || a === '-') {
            operands.push(a);
        }
    }
    return targetGiven ? operands : operands.slice(0, -1);
}

/** Why a command segment is refused, or null. `segment` starts at its command word. */
export function segmentVerdict(segment: string, depth = 0): Verdict {
    const words = commandWords(segment);
    let i = 0;
    while (i < words.length && ASSIGNMENT.test(words[i] as string)) i += 1;
    const cmd = base(words[i] ?? '');
    const args = words.slice(i + 1);

    if (WRAPPERS.has(cmd)) {
        if (args.some((a) => base(a) === 'env' || base(a) === 'printenv')) {
            return { class: 'process-environment', what: `\`${cmd} … env\`` };
        }
        return credentialMention(segment);
    }
    if (cmd === 'env') {
        const ran = envCommand(args);
        if (ran.length === 0) return { class: 'process-environment', what: '`env`' };
        if (depth >= 3) return credentialAmong(ran);
        return segmentVerdict(ran.map((w) => (/\s/.test(w) ? `'${w}'` : w)).join(' '), depth + 1) ?? credentialAmong(args);
    }

    const operands = args.filter((a) => !a.startsWith('-'));
    // Printing the whole environment: `printenv` with no name, `export` with no
    // name, a bare `set` (`set -e` only sets options), and `declare -x|-p` with
    // no name.
    const dumpsEnv =
        (cmd === 'printenv' && !operands.some((a) => VARIABLE_NAME.test(a))) ||
        (cmd === 'export' && operands.length === 0) ||
        (cmd === 'set' && args.length === 0) ||
        ((cmd === 'declare' || cmd === 'typeset') && operands.length === 0 && args.some((a) => /^-[a-zA-Z]*[xp]/.test(a)));
    if (dumpsEnv) return { class: 'process-environment', what: `\`${cmd}\`` };

    // A copy or a rename reads its sources and only writes its destination:
    // `cp .env.example .env` creates the file, while `cp .env /dev/stdout` prints
    // it and `cp .env x` or `mv .env x` launders it for the next command.
    if (cmd === 'cp' || cmd === 'mv') return credentialAmong(copySources(args));

    const reads = !(NON_READING_COMMANDS.has(cmd) || (cmd === 'git' && NON_READING_GIT.has(operands[0] ?? '')));
    return reads ? credentialMention(segment) : null;
}
```
