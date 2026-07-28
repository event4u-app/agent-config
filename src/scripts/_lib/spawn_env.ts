/**
 * Hardened environment for spawned subprocesses
 * (road-to-runtime-security-hardening Phase 1).
 *
 * agent-config shells out to external CLIs (the AI-council transport spawns
 * `codex` / `claude` / `gemini`; hooks spawn `git`). By default `spawnSync`
 * inherits the full parent `process.env`, so any attacker-influenced env var in
 * the parent becomes a code-execution vector the moment the child (or a `git`
 * it invokes internally) runs:
 *
 *   - dynamic-loader preload/search-path (CWE-426 untrusted search path):
 *     LD_PRELOAD, LD_LIBRARY_PATH, DYLD_INSERT_LIBRARIES, DYLD_LIBRARY_PATH,
 *     GCONV_PATH — load attacker code into any spawned ELF/Mach-O.
 *   - git command-injection (CWE-88): GIT_EXTERNAL_DIFF, GIT_SSH,
 *     GIT_SSH_COMMAND, GIT_PROXY_COMMAND, any GIT_*_COMMAND, GIT_PAGER, PAGER —
 *     git runs these as shell commands (`core.pager` / external-diff RCE).
 *   - git config-injection (CWE-88): the GIT_CONFIG* family (GIT_CONFIG,
 *     GIT_CONFIG_GLOBAL/_SYSTEM, and inline GIT_CONFIG_COUNT / GIT_CONFIG_KEY_<n>
 *     / GIT_CONFIG_VALUE_<n>) sets ANY git config — `core.fsmonitor` runs shell
 *     on every `git status`; GIT_ALTERNATE_OBJECT_DIRECTORIES / HOSTALIASES
 *     redirect object stores / hostname resolution.
 *   - runtime auto-exec hooks: NODE_OPTIONS (`--require attacker.js`),
 *     BASH_ENV / ENV (sourced by non-interactive shells), PYTHONPATH /
 *     PYTHONSTARTUP / PYTHONINSPECT, PERL5OPT / PERL5LIB, RUBYOPT.
 *   - IFS — classic shell field-splitting hijack.
 *
 * This is the Least-Agency the `tool-safety` rule preaches, applied to our own
 * transport. We scrub by *family* (prefix + exact name), NOT via an allowlist:
 * the CLIs legitimately need arbitrary env (ANTHROPIC_API_KEY, XDG config
 * paths, proxy settings), so an allowlist would break them and rot as new
 * good vars appear. Deny-by-family removes the known execution vectors and
 * preserves everything else. This is standard, publicly-documented OWASP/CWE
 * knowledge — independently implemented here.
 */

/** Exact env-var names removed unconditionally. */
const DENY_EXACT: ReadonlySet<string> = new Set([
    // dynamic loader
    'LD_PRELOAD',
    'LD_LIBRARY_PATH',
    'LD_AUDIT',
    'DYLD_INSERT_LIBRARIES',
    'DYLD_LIBRARY_PATH',
    'DYLD_FRAMEWORK_PATH',
    'GCONV_PATH',
    // git command-injection
    'GIT_EXTERNAL_DIFF',
    'GIT_SSH',
    'GIT_SSH_COMMAND',
    'GIT_PROXY_COMMAND',
    'GIT_PAGER',
    'PAGER',
    // git config-injection: GIT_ALTERNATE_OBJECT_DIRECTORIES can point git at
    // attacker-controlled object stores; the GIT_CONFIG* family is handled by
    // prefix below (it is a general arbitrary-config-injection primitive).
    'GIT_ALTERNATE_OBJECT_DIRECTORIES',
    // git path-redirection: GIT_DIR / GIT_INDEX_FILE / GIT_NAMESPACE point a
    // child's git at an attacker-controlled repo, index file, or ref namespace
    // — ordinary git ops then read and write attacker state (low severity,
    // same family as GIT_ALTERNATE_OBJECT_DIRECTORIES above).
    'GIT_DIR',
    'GIT_INDEX_FILE',
    'GIT_NAMESPACE',
    // resolver hijack: HOSTALIASES remaps hostnames via an attacker file,
    // redirecting any network fetch the child performs (CWE-427-adjacent).
    'HOSTALIASES',
    // runtime auto-exec hooks
    'NODE_OPTIONS',
    'BASH_ENV',
    'ENV',
    'PYTHONPATH',
    'PYTHONSTARTUP',
    'PYTHONINSPECT',
    'PERL5OPT',
    'PERL5LIB',
    'RUBYOPT',
    // shell field-splitting
    'IFS',
]);

/**
 * Prefix families removed by pattern. `LD_` / `DYLD_` cover loader variants we
 * did not enumerate; `GIT_*_COMMAND` covers every git config-command hook; the
 * `GIT_CONFIG` family (GIT_CONFIG, GIT_CONFIG_GLOBAL, GIT_CONFIG_SYSTEM, and the
 * inline GIT_CONFIG_COUNT / GIT_CONFIG_KEY_<n> / GIT_CONFIG_VALUE_<n> trio) is a
 * general arbitrary-config-injection primitive — an attacker can set ANY git
 * config key, e.g. `core.fsmonitor` / `core.pager` / `core.sshCommand` /
 * `core.hooksPath` / `alias.*`, all of which git executes as shell on ordinary
 * operations (`git status` alone runs `core.fsmonitor`). The plain `GIT_*_COMMAND`
 * check missed it (no `_COMMAND` suffix), so it is denied by its own prefix.
 * (GIT_ASKPASS is intentionally NOT denied — it is a path, not a shell command,
 * and legitimate credential helpers need it; the *_COMMAND family is the
 * shell-executed one.)
 */
function isDeniedByFamily(name: string): boolean {
    if (name.startsWith('LD_') || name.startsWith('DYLD_')) return true;
    if (name.startsWith('GIT_') && name.endsWith('_COMMAND')) return true;
    if (name === 'GIT_CONFIG' || name.startsWith('GIT_CONFIG_')) return true;
    return false;
}

/**
 * Return a copy of the current environment with code-execution-injection
 * vectors scrubbed, then `overrides` applied. Pass the result as
 * `spawnSync`/`spawn`'s `env:` option.
 *
 * @param overrides values to set AFTER scrubbing (e.g. a scoped PATH or a
 *   package-root marker). Overrides win over both the inherited env and the
 *   deny-list, so a caller can deliberately re-supply a scrubbed var if it
 *   genuinely needs one — that is an explicit, reviewable decision at the call
 *   site, never an ambient inheritance.
 */
export function hardenedSpawnEnv(
    overrides: Record<string, string> = {},
): NodeJS.ProcessEnv {
    const out: NodeJS.ProcessEnv = {};
    for (const [key, value] of Object.entries(process.env)) {
        if (value === undefined) continue;
        if (DENY_EXACT.has(key)) continue;
        if (isDeniedByFamily(key)) continue;
        out[key] = value;
    }
    for (const [key, value] of Object.entries(overrides)) {
        out[key] = value;
    }
    return out;
}
