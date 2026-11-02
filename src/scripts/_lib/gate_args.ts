/**
 * One strict argv parser for gates.
 *
 * Measured 2026-11-02: 186 of 348 `check_*`/`lint_*` gates exit 0 on a flag
 * they do not know and print nothing about it, so a typo in `--strict` or
 * `--base` runs the lenient gate green (road-to-checks-that-name-their-catch,
 * C1). This wraps `node:util` `parseArgs({ strict: true })`: an unknown flag,
 * a missing value or a stray positional is a usage error that names itself.
 */
import { parseArgs, type ParseArgsConfig } from 'node:util';

/** Exit code a gate returns when its argv cannot be parsed. */
export const USAGE_EXIT = 2;

export type GateOptions = NonNullable<ParseArgsConfig['options']>;

export type GateArgsResult<O extends GateOptions> =
    | { ok: true; values: ReturnType<typeof parseArgs<{ options: O; strict: true; allowPositionals: boolean }>>['values']; positionals: string[] }
    | { ok: false; message: string };

/**
 * Parse a gate's argv strictly. Never throws: a parse failure comes back as a
 * message the caller prints before returning {@link USAGE_EXIT}.
 */
export function parseGateArgs<O extends GateOptions>(
    gate: string,
    argv: readonly string[],
    options: O,
    opts: { allowPositionals?: boolean } = {},
): GateArgsResult<O> {
    try {
        const { values, positionals } = parseArgs({
            args: [...argv],
            options,
            strict: true,
            allowPositionals: opts.allowPositionals ?? false,
        });
        return { ok: true, values: values as never, positionals };
    } catch (e) {
        return { ok: false, message: `${gate}: ${(e as Error).message}` };
    }
}
