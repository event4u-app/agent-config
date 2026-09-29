/**
 * The hook exit-code table — one frozen definition, imported everywhere.
 *
 * road-to-a-kernel-that-guards-its-plumbing 4.1.
 *
 * WHAT WAS WRONG. Thirty-three files under `src/scripts/hooks/` each declared
 * their own `const EXIT_ALLOW = 0` / `EXIT_BLOCK = 1` / `EXIT_WARN = 2`, two of
 * them under a third name (`EXIT_OK`). Thirty-three copies of a contract is
 * thirty-three places it can be changed in one and not the others, and the
 * change that matters here is not a typo: exit 1 and exit 2 mean the OPPOSITE
 * things on Claude Code from what they mean in this tree's internal language
 * (`host_semantics.ts` exists entirely to lower one onto the other). A number
 * that means "advisory" here and "hard deny" there is not a constant anyone
 * should be re-deriving per file.
 *
 * WHAT THE TABLE ADDS BEYOND THE NUMBERS. `owner` and `authorizedBy` — who
 * decides that a concern emits this code, and what authorises the dispatcher to
 * act on it. A bare `1` in a concern says nothing about whether that concern was
 * ever allowed to refuse; the manifest's `severity` is what authorises it, and
 * the dispatcher enforces that ceiling (`_is_advisory`). Recording it beside the
 * number is what makes the table a contract rather than an enum.
 *
 * WHAT IS NOT IN SCOPE. The `*-dispatcher.sh` trampolines carry inline
 * `process.exit(0)` in a `node -e` one-liner that reads a workspace root off
 * stdin. They are shell, they cannot import, and their exit code is the
 * one-liner's, never a verdict. `lint_exit_codes` scans `.ts` only.
 */

/** Allow — the concern has no objection. The overwhelmingly common verdict. */
export const EXIT_ALLOW = 0;

/** Block — the concern refuses. Only a `severity: blocking` concern may. */
export const EXIT_BLOCK = 1;

/** Warn — advisory. The dispatcher exits 0 and surfaces the reason. */
export const EXIT_WARN = 2;

/**
 * Error — the concern crashed or could not decide.
 *
 * `3` is the floor, not the only value: the dispatcher treats every rc ≥ 3 the
 * same way, and what that way IS depends on the concern's declared severity.
 */
export const EXIT_ERROR = 3;

export interface ExitCodeRow {
    /** The numeric code, or its floor for the open-ended error band. */
    readonly code: number;
    readonly name: 'allow' | 'block' | 'warn' | 'error';
    readonly meaning: string;
    /** Who decides a concern emits this code. */
    readonly owner: string;
    /** What authorises the dispatcher to act on it. */
    readonly authorizedBy: string;
}

/**
 * The frozen table. Ordered by code; the last row is a band, not a value.
 *
 * `as const` plus `Object.freeze` rather than a plain array: this is the kind of
 * structure a later convenience ("just push a row for the new verdict") turns
 * into a fourth dialect, and the whole point of the file is that there is one.
 */
export const EXIT_CODES: readonly ExitCodeRow[] = Object.freeze([
    Object.freeze({
        code: EXIT_ALLOW,
        name: 'allow',
        meaning: 'no objection; the dispatcher passes the call through',
        owner: 'every concern — the default verdict',
        authorizedBy: 'nothing; allowing needs no authority',
    }),
    Object.freeze({
        code: EXIT_BLOCK,
        name: 'block',
        meaning: 'refuse the call; the dispatcher lowers this onto the host deny channel',
        owner: 'a concern declared `severity: blocking` in hook_manifest.yaml',
        authorizedBy:
            'the manifest entry plus its row in the BLOCKING_ALLOWLIST of ' +
            'tests/hooks/concern_severity.test.ts — an advisory concern emitting this is ' +
            'downgraded to warn by dispatch_hook._is_advisory',
    }),
    Object.freeze({
        code: EXIT_WARN,
        name: 'warn',
        meaning: 'advisory; the dispatcher exits 0 and surfaces the reason',
        owner: 'any concern',
        authorizedBy:
            'nothing; warning is the ceiling for an advisory concern and is always available ' +
            'to a blocking one',
    }),
    Object.freeze({
        code: EXIT_ERROR,
        name: 'error',
        meaning:
            'the concern crashed, timed out, or could not decide — any rc >= 3. The dispatcher ' +
            'resolves it by the concern`s declared severity, never by the number itself',
        owner: 'no concern emits this on purpose; the runtime does',
        authorizedBy:
            'hook_manifest.yaml `fail_closed` and `severity` together — see ' +
            'docs/contracts/hook-architecture-v1.md § Exit-code semantics',
    }),
] as const);

/** The row a raw exit code resolves to, or `null` for a negative code. */
export function rowFor(code: number): ExitCodeRow | null {
    if (code >= EXIT_ERROR) {
        return EXIT_CODES[3] ?? null;
    }
    return EXIT_CODES.find((r) => r.code === code) ?? null;
}
