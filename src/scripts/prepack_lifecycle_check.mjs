/**
 * prepack_lifecycle_check.mjs — gate 3 of the prepack guard.
 *
 * Every `package.json` lifecycle script that runs on the CONSUMER side
 * (preinstall / install / postinstall / prepare) must only reference file
 * targets that exist AND are covered by the `files` pack whitelist. This is
 * the structural fix for the 9.8.0 dead-postinstall class: a hook pointing at
 * `dist/scripts/postinstall_gui.js` that nothing built failed silently on
 * every install for months because the check was one-time, not standing.
 *
 * Pure module (no top-level side effects) so the red/green test can exercise
 * it with a fabricated package.json — prepack-check.mjs is the CLI caller.
 */

/** Lifecycle scripts npm executes in a CONSUMER install of the tarball. */
export const CONSUMER_LIFECYCLE_SCRIPTS = ['preinstall', 'install', 'postinstall', 'prepare'];

/**
 * Extract file-path targets from a shell command line: arguments following
 * `node` / `bash` / `sh` interpreters. Flags and shell operators are skipped.
 */
export function extractScriptTargets(command) {
    const targets = [];
    // Split on shell connectors so each simple command is scanned on its own.
    for (const segment of command.split(/&&|\|\||;|\|/)) {
        const tokens = segment.trim().split(/\s+/);
        for (let i = 0; i < tokens.length - 1; i += 1) {
            if (!/^(node|bash|sh)$/.test(tokens[i])) continue;
            for (let j = i + 1; j < tokens.length; j += 1) {
                const tok = tokens[j];
                if (tok.startsWith('-')) continue; // interpreter flag
                // Shell noise (redirections, subshell tokens) ends the scan.
                if (/[<>()[\]]/.test(tok)) break;
                targets.push(tok);
                break;
            }
        }
    }
    return targets;
}

/** Whitelist membership — same semantics as prepack-check's isShipped(). */
export function isShippedPath(relPath, files) {
    const posix = relPath.split('\\').join('/');
    const prefixes = files.filter((f) => f.endsWith('/')).map((f) => f.replace(/\/+$/, '') + '/');
    const exact = new Set(files.filter((f) => !f.endsWith('/')));
    if (exact.has(posix)) return true;
    return prefixes.some((p) => posix.startsWith(p));
}

/**
 * Check every consumer-side lifecycle script of `pkg`.
 *
 * @param pkg parsed package.json ({ scripts, files })
 * @param existsFn (relPath: string) => boolean — injectable for tests
 * @returns string[] — human-readable errors; empty = green
 */
export function checkLifecycleTargets(pkg, existsFn) {
    const errors = [];
    const scripts = pkg.scripts ?? {};
    const files = pkg.files ?? [];
    for (const name of CONSUMER_LIFECYCLE_SCRIPTS) {
        const command = scripts[name];
        if (typeof command !== 'string' || command.length === 0) continue;
        for (const target of extractScriptTargets(command)) {
            if (!existsFn(target)) {
                errors.push(
                    `scripts.${name} references '${target}', which does not exist ` +
                        '(dead lifecycle script — fails silently on every consumer install)',
                );
                continue;
            }
            if (!isShippedPath(target, files)) {
                errors.push(
                    `scripts.${name} references '${target}', which is not covered by the ` +
                        'package.json `files` whitelist (missing from the published tarball)',
                );
            }
        }
    }
    return errors;
}
