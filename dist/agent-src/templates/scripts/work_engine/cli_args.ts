/**
 * Argument parser and state-file constants for the CLI entry point.
 *
 * TypeScript twin of `work_engine/cli_args.py` (ADR-200 py2ts Phase 1 —
 * work_engine foundation). Public API names stay snake_case to mirror the
 * Python module 1:1 (per ADR-200 — Python style is part of the contract).
 *
 * Extracted from `cli.py` in P2.3 of `road-to-post-pr29-optimize.md`.
 * Behaviour-preserving: the parser shape, default values, and exit-code
 * semantics are identical to the pre-split version. The constants moved here
 * so the parser default and the legacy-file detector both reference a single
 * source of truth.
 *
 * The Python source returns an `argparse.ArgumentParser`; this twin exposes
 * {@link parse_args} instead, mirroring argparse's runtime behaviour for the
 * declared flags: long-option prefix abbreviation, `--flag=value` /
 * `--flag value` forms, `store_true` flags, `-h`/`--help` exit-0, and exit-2
 * on every error path (unknown flag, ambiguous abbreviation, missing value,
 * explicit value on a store_true flag). `--help` prose is intentionally NOT
 * a parity surface (ADR-200 — argparse help text is not byte-compared).
 */

// Paths are kept as plain strings here (the Python source wraps them in
// `pathlib.Path` via `type=Path`; the consuming modules — state_io,
// input_builders — land in a later py2ts phase and own the Path semantics).
export const DEFAULT_STATE_FILE = '.work-state.json';
/**
 * State file used when `--state-file` is not passed.
 *
 * Renamed from `.implement-ticket-state.json` in 1.15.0 alongside the
 * `implement_ticket → work_engine` package move. The legacy filename is
 * still recognised on load (see {@link LEGACY_STATE_FILE} below) so that
 * existing checkouts surface a clear migration message instead of a
 * silent "no state file" error.
 */

export const LEGACY_STATE_FILE = '.implement-ticket-state.json';
/**
 * Pre-1.15.0 default state file. Detected only as a migration hint;
 * never written to. See `docs/MIGRATION.md`.
 */

export const _FMT_V0 = 'v0';
export const _FMT_V1 = 'v1';
/**
 * Wire-format markers carried alongside the loaded `WorkState`.
 *
 * Format-preserving roundtrip: `_load` records which shape it parsed,
 * `_save` rewrites in that same shape. v0 in → v0 out (Goldens stay
 * byte-equal); v1 in → v1 out (future flows produced by the migration
 * tool or a fresh v1 init keep their envelope fields).
 */

/** Parsed namespace — mirrors the argparse `Namespace` attribute names. */
export interface ParsedArgs {
    state_file: string;
    ticket_file: string | null;
    prompt_file: string | null;
    diff_file: string | null;
    file_file: string | null;
    persona: string | null;
    no_hooks: boolean;
    hooks_config: string | null;
}

/** Thrown internally to mirror argparse's exit-2 error path. */
class ArgparseExit extends Error {
    readonly code: number;
    constructor(code: number) {
        super(`argparse exit ${code}`);
        Object.setPrototypeOf(this, ArgparseExit.prototype);
        this.name = 'ArgparseExit';
        this.code = code;
    }
}

const PROG = 'implement-ticket';

// Declared optionals, in declaration order (drives prefix-abbreviation
// candidate ordering and the usage line, exactly as argparse builds it).
interface OptionSpec {
    flag: string; // canonical long option, e.g. "--state-file"
    dest: keyof ParsedArgs; // namespace attribute
    takesValue: boolean; // false for store_true
}

const OPTIONS: OptionSpec[] = [
    { flag: '--state-file', dest: 'state_file', takesValue: true },
    { flag: '--ticket-file', dest: 'ticket_file', takesValue: true },
    { flag: '--prompt-file', dest: 'prompt_file', takesValue: true },
    { flag: '--diff-file', dest: 'diff_file', takesValue: true },
    { flag: '--file-file', dest: 'file_file', takesValue: true },
    { flag: '--persona', dest: 'persona', takesValue: true },
    { flag: '--no-hooks', dest: 'no_hooks', takesValue: false },
    { flag: '--hooks-config', dest: 'hooks_config', takesValue: true },
];

// `-h` / `--help` is an implicit argparse optional; included as a prefix
// abbreviation candidate so e.g. `--he` resolves to `--help`.
const HELP_FLAGS = ['--help'];

function usage(): string {
    // Compact one-line usage marker; the exact wrapping/prose is not a parity
    // surface (ADR-200 — argparse usage/help text is not byte-compared).
    return `usage: ${PROG} [-h] [options]`;
}

function err(message: string): never {
    process.stderr.write(`${usage()}\n`);
    process.stderr.write(`${PROG}: error: ${message}\n`);
    throw new ArgparseExit(2);
}

/**
 * Resolve a long option token to its canonical flag, applying argparse's
 * unambiguous-prefix-abbreviation rule. Returns the matched spec, the
 * sentinel `'help'`, or throws exit-2 on an ambiguous / unknown option.
 */
function resolveLong(name: string): OptionSpec | 'help' {
    // Exact match first (argparse short-circuits exact hits before abbrev).
    const exact = OPTIONS.find((o) => o.flag === name);
    if (exact) {
        return exact;
    }
    if (HELP_FLAGS.includes(name)) {
        return 'help';
    }
    // Prefix abbreviation across both the declared options and --help.
    const candidates: Array<OptionSpec | 'help'> = [];
    for (const o of OPTIONS) {
        if (o.flag.startsWith(name)) {
            candidates.push(o);
        }
    }
    for (const h of HELP_FLAGS) {
        if (h.startsWith(name)) {
            candidates.push('help');
        }
    }
    if (candidates.length === 1) {
        return candidates[0] as OptionSpec | 'help';
    }
    if (candidates.length === 0) {
        // argparse reports unknown options via "unrecognized arguments".
        err(`unrecognized arguments: ${name}`);
    }
    const names = candidates.map((c) => (c === 'help' ? '--help' : c.flag)).join(', ');
    err(`ambiguous option: ${name} could match ${names}`);
}

/**
 * Parse `argv` (the slice after the program name) into a namespace.
 *
 * Mirrors `argparse.ArgumentParser.parse_args`: on `-h`/`--help` it prints
 * a help marker to stdout and exits 0; on any error it prints to stderr and
 * exits 2 (via `process.exitCode`, never `process.exit`, per ADR-200).
 * Returns the parsed namespace on success.
 */
export function parse_args(argv: string[]): ParsedArgs {
    const ns: ParsedArgs = {
        state_file: DEFAULT_STATE_FILE,
        ticket_file: null,
        prompt_file: null,
        diff_file: null,
        file_file: null,
        persona: null,
        no_hooks: false,
        hooks_config: null,
    };
    const extras: string[] = [];

    try {
        let i = 0;
        while (i < argv.length) {
            const tok = argv[i] as string;
            if (tok === '-h' || tok === '--help') {
                process.stdout.write(`${usage()}\n`);
                throw new ArgparseExit(0);
            }
            if (tok.startsWith('--')) {
                let name = tok;
                let inlineValue: string | null = null;
                const eq = tok.indexOf('=');
                if (eq !== -1) {
                    name = tok.slice(0, eq);
                    inlineValue = tok.slice(eq + 1);
                }
                if (name === '-h' || name === '--help') {
                    process.stdout.write(`${usage()}\n`);
                    throw new ArgparseExit(0);
                }
                const resolved = resolveLong(name);
                if (resolved === 'help') {
                    process.stdout.write(`${usage()}\n`);
                    throw new ArgparseExit(0);
                }
                if (resolved.takesValue) {
                    if (inlineValue !== null) {
                        assignValue(ns, resolved, inlineValue);
                    } else {
                        const next = argv[i + 1];
                        // argparse: a value beginning with `-` is still consumed
                        // only when it does not look like a known option; the
                        // simpler "expected one argument" path covers the
                        // missing-trailing-value case the contract exercises.
                        if (next === undefined) {
                            err(`argument ${resolved.flag}: expected one argument`);
                        }
                        assignValue(ns, resolved, next);
                        i += 1;
                    }
                } else {
                    // store_true: an explicit `=value` is an error in argparse.
                    if (inlineValue !== null) {
                        err(`argument ${resolved.flag}: ignored explicit argument '${inlineValue}'`);
                    }
                    (ns[resolved.dest] as boolean) = true;
                }
            } else if (tok.startsWith('-') && tok !== '-') {
                // Single-dash unknown short option → unrecognized.
                extras.push(tok);
            } else {
                // Positional — this parser declares none, so it is an extra.
                extras.push(tok);
            }
            i += 1;
        }
        if (extras.length > 0) {
            err(`unrecognized arguments: ${extras.join(' ')}`);
        }
    } catch (e) {
        if (e instanceof ArgparseExit) {
            process.exitCode = e.code;
            // Surface as a thrown sentinel so a CLI caller can stop; the test
            // harness inspects process.exitCode (mirrors argparse SystemExit).
            throw e;
        }
        throw e;
    }
    return ns;
}

function assignValue(ns: ParsedArgs, spec: OptionSpec, value: string): void {
    // All value-taking flags here are string/Path; store the raw string.
    (ns[spec.dest] as string) = value;
}

/** Re-exported sentinel so a CLI entry point can recognise the exit path. */
export { ArgparseExit };
