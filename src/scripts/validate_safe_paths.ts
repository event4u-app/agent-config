#!/usr/bin/env tsx
/**
 * Sensitive-path denylist — refuses files that almost certainly hold secrets or PII.
 *
 * TypeScript twin of `src/scripts/validate_safe_paths.py` (ADR-092, Phase 4 /
 * Wave 4c). The public API and CLI contract are mirrored EXACTLY — same
 * exported snake_case names (`is_sensitive`, `assert_safe`,
 * `SensitivePathError`), same denylist regex / component set / token list,
 * same CLI exit codes (0 safe, 2 sensitive / usage), stdout/stderr split, and
 * byte-identical messages. No behaviour changes — latent bugs replicated.
 *
 * Phase 0 of step-16-telegraph-substance. Gates Phase 2 (`scripts/condense_memory.py`):
 * any consumer-supplied path must pass `assert_safe()` before bytes are read or
 * shipped to a third-party API.
 *
 * Public API:
 *     is_sensitive(path: string) -> boolean
 *     assert_safe(path: string) -> void     // throws SensitivePathError
 *
 * CLI:
 *     tsx validate_safe_paths.ts <path>   // exit 0 = safe, 2 = sensitive
 */

import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** Raised when a path matches the sensitive-file denylist. Subclass of TS Error;
 * mirrors the Python `SensitivePathError(ValueError)` so the parity test that
 * asserts "is a ValueError" maps to "is an Error" / carries the name. */
export class SensitivePathError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'SensitivePathError';
    }
}

// Filenames that almost certainly hold secrets or PII. Matched against the
// basename only (case-insensitive). Anchored start-to-end like the Python
// `re.compile(..., re.IGNORECASE).match` + `$` (Python `match` anchors start,
// regex carries an explicit trailing `$`).
const SENSITIVE_BASENAME_REGEX = new RegExp(
    '^(' +
        '\\.env(\\..+)?' +
        '|\\.netrc' +
        '|credentials(\\..+)?' +
        '|secrets?(\\..+)?' +
        '|passwords?(\\..+)?' +
        '|id_(rsa|dsa|ecdsa|ed25519)(\\.pub)?' +
        '|authorized_keys' +
        '|known_hosts' +
        '|.*\\.(pem|key|p12|pfx|crt|cer|jks|keystore|asc|gpg)' +
        ')$',
    'i',
);

// Path components (any segment, case-insensitive) that mark a sensitive directory.
const SENSITIVE_PATH_COMPONENTS: ReadonlySet<string> = new Set([
    '.ssh',
    '.aws',
    '.gnupg',
    '.kube',
    '.docker',
]);

// Substring tokens checked against the normalised basename (separators stripped
// so `api-key`, `api_key`, `apikey` all match).
const SENSITIVE_NAME_TOKENS: readonly string[] = [
    'secret',
    'credential',
    'password',
    'passwd',
    'apikey',
    'accesskey',
    'token',
    'privatekey',
];

const _SEP_STRIP_RE = /[_\-\s.]/g;

/**
 * Mirror Python `pathlib.Path(p).name` — the final path component, dropping any
 * trailing slash. POSIX-style separators are honoured even on the host since
 * the Python module operates on POSIX-flavoured repo-relative strings.
 */
function _pathName(p: string): string {
    const norm = p.replace(/[/\\]+$/, '');
    const idx = Math.max(norm.lastIndexOf('/'), norm.lastIndexOf('\\'));
    return idx === -1 ? norm : norm.slice(idx + 1);
}

/**
 * Mirror Python `pathlib.Path(p).parts` (the segments that matter for the
 * component check). Splits on both separators; drops empty segments.
 */
function _pathParts(p: string): string[] {
    return p.split(/[/\\]+/).filter((s) => s.length > 0);
}

/** Return true if `p` matches the sensitive-file denylist. */
export function is_sensitive(p: string): boolean {
    const name = _pathName(p);
    if (SENSITIVE_BASENAME_REGEX.test(name)) {
        return true;
    }
    const loweredParts = new Set(_pathParts(p).map((s) => s.toLowerCase()));
    for (const comp of SENSITIVE_PATH_COMPONENTS) {
        if (loweredParts.has(comp)) {
            return true;
        }
    }
    const lower = name.toLowerCase().replace(_SEP_STRIP_RE, '');
    return SENSITIVE_NAME_TOKENS.some((tok) => lower.includes(tok));
}

/**
 * Throw `SensitivePathError` if `p` matches the denylist.
 *
 * Intended as a hard guard at the top of any function that reads bytes from
 * a consumer-supplied path and ships them to a third-party API. Override is
 * intentional: the user must rename the file if the heuristic is wrong.
 */
export function assert_safe(p: string): void {
    if (is_sensitive(p)) {
        throw new SensitivePathError(
            `Refusing to operate on ${p}: filename or path looks sensitive ` +
                '(credentials, keys, secrets, or known private directories). ' +
                'Rename the file if this is a false positive.',
        );
    }
}

export function _main(argv: readonly string[]): number {
    // argv mirrors Python sys.argv: argv[0] is the program, argv[1] the path.
    if (argv.length !== 2 || argv[1] === '-h' || argv[1] === '--help') {
        process.stderr.write(
            'usage: validate_safe_paths.py <path>\n' +
                '  exit 0 — path is safe\n' +
                '  exit 2 — path matches the sensitive-file denylist\n',
        );
        return argv.length === 2 && (argv[1] === '-h' || argv[1] === '--help') ? 0 : 2;
    }
    const target = argv[1] as string;
    try {
        assert_safe(target);
    } catch (exc) {
        if (exc instanceof SensitivePathError) {
            process.stderr.write(`SensitivePathError: ${exc.message}\n`);
            return 2;
        }
        throw exc;
    }
    process.stdout.write(`safe: ${target}\n`);
    return 0;
}

const _HERE = fileURLToPath(import.meta.url);
const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    // Python passes the full sys.argv (program name + args); replicate by
    // prepending a placeholder program name to the user args.
    process.exit(_main(['validate_safe_paths.ts', ...process.argv.slice(2)]));
}
