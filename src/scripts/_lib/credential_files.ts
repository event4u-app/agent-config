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
 * Words that run the command after them, each with the options that take a
 * separate argument — `sudo -u root env` runs `env`, not `root`. A `--long=value`
 * form and an unlisted flag take none. `timeout` also takes one duration.
 */
const WRAPPER_ARG_FLAGS: ReadonlyMap<string, ReadonlySet<string>> = new Map([
    ['command', new Set<string>()],
    ['builtin', new Set<string>()],
    ['exec', new Set(['-a'])],
    ['nohup', new Set<string>()],
    ['sudo', new Set(['-u', '-g', '-U', '-C', '-h', '-p', '-r', '-t', '-D', '-R', '--user', '--group', '--other-user', '--close-from', '--host', '--prompt', '--role', '--type', '--chdir', '--chroot'])],
    ['doas', new Set(['-u', '-C'])],
    ['nice', new Set(['-n', '--adjustment'])],
    ['timeout', new Set(['-s', '--signal', '-k', '--kill-after'])],
    ['stdbuf', new Set(['-i', '-o', '-e', '--input', '--output', '--error'])],
    ['time', new Set(['-f', '--format', '-o', '--output'])],
]);

/** `env`'s own options that take an argument; `-S` / `--split-string` carries a command. */
const ENV_ARG_FLAGS: ReadonlySet<string> = new Set(['-u', '--unset', '-C', '--chdir', '-S', '--split-string']);

const base = (w: string): string => w.replace(/^.*\//, '');

/** Index of the first word after a run of options, skipping each listed flag's separate argument. */
function skipOptions(words: readonly string[], i: number, argFlags: ReadonlySet<string>): number {
    while (i < words.length) {
        const w = words[i] as string;
        if (w === '--') return i + 1;
        if (!w.startsWith('-') || w === '-') return i;
        i += argFlags.has(w) ? 2 : 1;
    }
    return i;
}

/** `git` subcommands that name a path without printing its content. */
const NON_READING_GIT: ReadonlySet<string> = new Set(['add', 'rm', 'mv', 'check-ignore', 'ls-files', 'status']);

/** Split one command segment into words, dropping quotes; redirection operators stay attached to nothing. */
export function commandWords(segment: string): string[] {
    const words: string[] = [];
    const re = /"((?:[^"\\]|\\.)*)"|'([^']*)'|(\S+)/g;
    for (const m of segment.matchAll(re)) words.push(m[1] ?? m[2] ?? m[3] ?? '');
    return words;
}

const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;
const REDIRECT_PREFIX = /^(?:\d*[<>]{1,2}&?|&>{1,2})/;

type Verdict = { class: CredentialFileClass; what: string } | null;

const named = (cls: CredentialFileClass, p: string): Verdict => ({ class: cls, what: `\`${credentialBasename(p)}\`` });

/** The basename a refusal may name: backslashes read as separators, so no Windows path leaks whole. */
export function credentialBasename(p: string): string {
    return path.posix.basename(p.replace(/\\/g, '/'));
}

/** Why a command segment is refused, or null. `segment` starts at its command word. */
export function segmentVerdict(segment: string, depth = 0): Verdict {
    const words = commandWords(segment);
    let i = 0;
    for (;;) {
        while (i < words.length && ASSIGNMENT.test(words[i] as string)) i += 1;
        const head = base(words[i] ?? '');
        if (head === 'env') {
            // `env` either prints the environment or runs the command after its
            // options and assignments; `-S` carries a command string of its own.
            let j = i + 1;
            while (j < words.length) {
                const w = words[j] as string;
                if (w === '--') {
                    j += 1;
                    break;
                }
                if (!w.startsWith('-') || w === '-') break;
                const split = w === '-S' || w === '--split-string' ? words[j + 1] : /^(?:-S|--split-string=)(.+)$/.exec(w)?.[1];
                if (split !== undefined && depth < 3) {
                    const inner = segmentVerdict(split, depth + 1);
                    if (inner !== null) return inner;
                }
                j += ENV_ARG_FLAGS.has(w) ? 2 : 1;
            }
            while (j < words.length && ASSIGNMENT.test(words[j] as string)) j += 1;
            if (j >= words.length) return { class: 'process-environment', what: '`env`' };
            i = j;
            continue;
        }
        const argFlags = WRAPPER_ARG_FLAGS.get(head);
        if (argFlags === undefined) break;
        i = skipOptions(words, i + 1, argFlags);
        if (head === 'timeout' && /^\d+(?:\.\d+)?[smhd]?$/.test(words[i] ?? '')) i += 1;
    }
    const cmd = base(words[i] ?? '');
    const args = words.slice(i + 1);
    const operands = args.filter((a) => !a.startsWith('-'));

    // Printing the whole environment: `printenv` with no name, `export` with no
    // name, a bare `set` (`set -e` only sets options), and `declare -x|-p` with
    // no name.
    const dumpsEnv =
        (cmd === 'printenv' && operands.length === 0) ||
        (cmd === 'export' && operands.length === 0) ||
        (cmd === 'set' && args.length === 0) ||
        ((cmd === 'declare' || cmd === 'typeset') && operands.length === 0 && args.some((a) => /^-[a-zA-Z]*[xp]/.test(a)));
    if (dumpsEnv) return { class: 'process-environment', what: `\`${cmd}\`` };

    // A copy or a rename reads its sources and only writes its destination:
    // `cp .env.example .env` creates the file, while `cp .env /dev/stdout` prints
    // it and `cp .env x` or `mv .env x` launders it for the next command. With a
    // target directory (`-t DIR`, `--target-directory=DIR`) every operand is a
    // source.
    if (cmd === 'cp' || cmd === 'mv') {
        const sources: string[] = [];
        let targetGiven = false;
        for (let k = 0; k < args.length; k += 1) {
            const a = args[k] as string;
            if (a === '-t' || a === '--target-directory' || a === '-S' || a === '--suffix') {
                if (a === '-t' || a === '--target-directory') targetGiven = true;
                k += 1;
            } else if (/^(?:-t.+|--target-directory=.*)$/.test(a)) {
                targetGiven = true;
            } else if (!a.startsWith('-')) {
                sources.push(a);
            }
        }
        for (const src of targetGiven ? sources : sources.slice(0, -1)) {
            const cls = credentialFileClass(src);
            if (cls !== null) return named(cls, src);
        }
        return null;
    }
    const reads = !(NON_READING_COMMANDS.has(cmd) || (cmd === 'git' && NON_READING_GIT.has(operands[0] ?? '')));
    if (!reads) return null;
    for (const w of words.slice(i + 1)) {
        const target = w.replace(REDIRECT_PREFIX, '');
        // `--config=.env`, `--defaults-file=~/.my.cnf`: the value of an option is a path too.
        const candidates = target.includes('=') ? [target, target.slice(target.indexOf('=') + 1)] : [target];
        for (const c of candidates) {
            const cls = credentialFileClass(c);
            if (cls !== null) return named(cls, c);
        }
    }
    return null;
}
