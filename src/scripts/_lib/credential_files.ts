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

/**
 * Whether a backslash separates path segments. On Windows it does; on a POSIX
 * host a backslash the shell keeps is a filename character (`'dir\.env'` is one
 * file), so reading it as a separator there refuses a file that is not a
 * credential file. A drive-letter or UNC path is read as a Windows path on any
 * host: its syntax says what it is.
 */
let backslashSeparates = process.platform === 'win32';
const WINDOWS_PATH = /^(?:[A-Za-z]:\\|\\\\)/;

/** Test seam: force the host's backslash reading, or `null` to restore it. */
export function _setBackslashSeparatesForTest(value: boolean | null): void {
    backslashSeparates = value ?? process.platform === 'win32';
}

function separated(p: string): string {
    return backslashSeparates || WINDOWS_PATH.test(p) ? p.replace(/\\/g, '/') : p;
}

/** The credential class of a path, or null. Decided from the path alone. */
export function credentialFileClass(rawPath: string): CredentialFileClass | null {
    const trimmed = separated(rawPath.trim()).replace(/\/+$/, '');
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
                if (segment[j] === '\\' && segment[j + 1] === '\n') {
                    j += 1; // a line continuation: both characters go
                    continue;
                }
                if (segment[j] === '\\' && j + 1 < segment.length && '$`"\\'.includes(segment[j + 1] as string)) j += 1;
                word += segment[j];
            }
            i = j;
        } else if (ch === '\\' && i + 1 < segment.length) {
            // An escaped character joins the word; an escaped newline is a continuation and adds nothing.
            if (segment[i + 1] !== '\n') word += segment[i + 1];
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
 * (`xargs -a.env`) is read both whole and without its `-x` prefix. A Windows
 * path is a path: `credentialFileClass` reads its backslashes as separators.
 */
export function credentialMention(text: string): Verdict {
    // Two readings of one segment, because neither alone matches the shell: the
    // raw text (a Windows path, an attached `cat<.env`), and each word the shell
    // would build — quotes joined, escapes applied only where the shell applies
    // them (`cat .e''nv`, an unquoted `cat .e\nv`) — each cut at the same
    // characters. Whether a backslash separates is the path's decision, not the
    // reading's (see `separated`).
    const readings = [text, ...commandWords(text)];
    for (const reading of readings) {
        const v = mentionIn(reading);
        if (v !== null) return v;
    }
    return null;
}

function mentionIn(text: string): Verdict {
    for (const raw of text.split(/[\s'"<>|;&()`=,]+/)) {
        if (raw === '') continue;
        const candidates = raw.startsWith('-') ? [raw, raw.replace(/^-+[A-Za-z]?/, '')] : [raw];
        for (const c of candidates) {
            const cls = c === '' ? null : credentialFileClass(c);
            if (cls !== null) return named(cls, c);
        }
    }
    return null;
}

/** The first credential path among words the shell already built — judged as data, never re-parsed. */
function credentialAmong(words: readonly string[]): Verdict {
    for (const w of words) {
        const v = mentionIn(w);
        if (v !== null) return v;
    }
    return null;
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
