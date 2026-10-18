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
 * Pure: no I/O, no dependency.
 */

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

const KEY_EXTENSIONS: readonly string[] = ['.pem', '.key', '.p12', '.pfx', '.ppk', '.jks', '.keystore'];
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
    const p = rawPath.trim().replace(/\\/g, '/').replace(/\/+$/, '');
    if (p === '') return null;
    if (PROC_ENVIRON.test(p)) return 'process-environment';
    const base = p.slice(p.lastIndexOf('/') + 1);
    if (base === '.env' || base === '.envrc') return 'env-file';
    if (base.startsWith('.env.')) {
        const suffix = base.slice('.env.'.length).toLowerCase();
        return ENV_TEMPLATE_SUFFIXES.has(suffix) ? null : 'env-file';
    }
    if (SSH_KEY.test(base)) return 'private-key';
    const lower = base.toLowerCase();
    if (KEY_EXTENSIONS.some((ext) => lower.endsWith(ext) && lower.length > ext.length)) return 'private-key';
    for (const [tail, cls] of CREDENTIAL_TAILS) {
        if (p === tail || p.endsWith(`/${tail}`)) return cls;
    }
    return null;
}

/**
 * Command words that act on a path without printing what it holds. A credential
 * path given to any other command is treated as a read, because the set of
 * commands that print a file is open and the set that do not is small.
 */
const NON_READING_COMMANDS: ReadonlySet<string> = new Set([
    'ls', 'stat', 'test', '[', 'touch', 'rm', 'mv', 'cp', 'chmod', 'chown', 'mkdir', 'wc', 'source', '.',
]);

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

/** Why a command segment is refused, or null. `segment` starts at its command word. */
export function segmentVerdict(segment: string): { class: CredentialFileClass; what: string } | null {
    const words = commandWords(segment);
    let i = 0;
    while (i < words.length && ASSIGNMENT.test(words[i] as string)) i += 1;
    const cmd = words[i] ?? '';
    const args = words.slice(i + 1);
    const operands = args.filter((a) => !a.startsWith('-'));

    // Printing the whole environment: `env` / `printenv` with nothing to run,
    // `export` with no name, a bare `set` (`set -e` only sets options), and
    // `declare -x|-p` with no name.
    const dumpsEnv =
        ((cmd === 'env' || cmd === 'printenv') && operands.every((a) => ASSIGNMENT.test(a)) && !args.includes('--')) ||
        (cmd === 'export' && operands.length === 0) ||
        (cmd === 'set' && args.length === 0) ||
        ((cmd === 'declare' || cmd === 'typeset') && operands.length === 0 && args.some((a) => /^-[a-zA-Z]*[xp]/.test(a)));
    if (dumpsEnv) return { class: 'process-environment', what: `\`${cmd}\`` };

    const reads = !(NON_READING_COMMANDS.has(cmd) || (cmd === 'git' && NON_READING_GIT.has(operands[0] ?? '')));
    if (!reads) return null;
    for (const w of words.slice(i + 1)) {
        const target = w.replace(REDIRECT_PREFIX, '');
        const cls = credentialFileClass(target);
        if (cls !== null) return { class: cls, what: `\`${target}\`` };
    }
    return null;
}
