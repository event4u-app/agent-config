/**
 * Migrate a v0 `DeliveryState` JSON file to the v1 schema.
 *
 * TypeScript twin of `work_engine/migration/v0_to_v1.py` (ADR-096 py2ts
 * Phase 1 — work_engine TOP/integration layer). Public API names stay
 * snake_case to mirror the Python module 1:1 (per ADR-096 — Python style is
 * part of the contract).
 *
 * The v0 era used `.implement-ticket-state.json` and stored the ticket
 * under a flat `ticket` key. v1 wraps the payload under `input.kind`
 * / `input.data` and adds `intent`, `directive_set`, and
 * `version`. The default destination is `.work-state.json` next to
 * the v0 file; the v0 file is renamed to `.implement-ticket-state.json.bak`
 * to preserve the rollback surface.
 *
 * The module is both importable and runnable:
 *
 *     node node_modules/.bin/tsx work_engine/migration/v0_to_v1.ts .implement-ticket-state.json
 *
 * Idempotency: `migrate_payload` accepts a payload that already looks
 * like v1 and returns it unchanged. `migrate_file` refuses to migrate
 * twice — if the destination already exists it raises rather than
 * silently overwriting work.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import {
    DEFAULT_DIRECTIVE_SET,
    DEFAULT_INTENT,
    SCHEMA_VERSION,
    SchemaError,
    type Dict,
    type JsonValue,
} from '../state.js';

export const DEFAULT_V0_FILENAME = '.implement-ticket-state.json';
/**
 * Path the dispatcher used while the engine still lived under
 * `implement_ticket`. The migration looks here when no source path is
 * passed on the CLI.
 */

export const DEFAULT_V1_FILENAME = '.work-state.json';
/** Canonical filename for the v1 wire format. */

export const BACKUP_SUFFIX = '.bak';
/**
 * Appended to the v0 source path when the migration archives it.
 *
 * If the `.bak` slot is already taken (re-running the migration after
 * an aborted run, manual rollback, etc.) the rotator falls back to
 * `.bak.1`, `.bak.2`, ... — see {@link _rotate_backup_path}. The
 * migration never silently overwrites an existing backup.
 */

const _MAX_BACKUP_ROTATIONS = 999;
/**
 * Hard ceiling on rotated backup filenames; surfaces an explicit
 * {@link SchemaError} instead of looping forever if a checkout has
 * hundreds of stale backups.
 */

/**
 * Return the next free `.bak` slot for `source`.
 *
 * Tries `source.bak` first, then `source.bak.1`,
 * `source.bak.2`, ... up to {@link _MAX_BACKUP_ROTATIONS}. The
 * rotator only inspects existence — collision-safe by construction —
 * and never deletes or overwrites prior backups.
 */
export function _rotate_backup_path(source: string): string {
    // Python `source.with_suffix(source.suffix + BACKUP_SUFFIX)`: append the
    // backup suffix to the existing suffix. `Path.with_suffix` replaces the
    // final extension, so `.json` → `.json.bak` is exactly `source + ".bak"`
    // here because BACKUP_SUFFIX leads with a dot and there is no embedded
    // dot to collide with. Mirror `_with_suffix` semantics for parity.
    const primary = _with_suffix(source, _suffix(source) + BACKUP_SUFFIX);
    if (!_exists(primary)) {
        return primary;
    }
    for (let index = 1; index <= _MAX_BACKUP_ROTATIONS; index++) {
        const candidate = _with_suffix(primary, _suffix(primary) + `.${index}`);
        if (!_exists(candidate)) {
            return candidate;
        }
    }
    throw new SchemaError(
        `refusing to rotate backup for ${source}: more than ` +
            `${_MAX_BACKUP_ROTATIONS} stale .bak files already exist; ` +
            'clean them up before re-running the migration',
    );
}

/**
 * Return the v1 form of `payload`.
 *
 * A payload that already declares `version: 1` is returned
 * unchanged (deep-copied via `JSON.parse(JSON.stringify(...))` so the
 * caller cannot accidentally mutate the input). Anything else is
 * treated as v0 and wrapped: `ticket` becomes `input.data`,
 * `input.kind` is set to `"ticket"`, and the engine defaults are
 * filled in.
 *
 * @throws SchemaError If the payload is not a dict, declares a higher version
 *   than this migration knows about, or lacks a `ticket` key.
 */
export function migrate_payload(payload: JsonValue): Dict {
    if (!_isPlainDict(payload)) {
        throw new SchemaError(
            `v0 state must be a JSON object; got ${_pyTypeName(payload)}`,
        );
    }
    const p = payload as Record<string, JsonValue>;

    const declared_version = _get(p, 'version', undefined);
    if (declared_version === SCHEMA_VERSION) {
        return JSON.parse(JSON.stringify(p)) as Dict;
    }
    if (declared_version !== undefined && declared_version !== null) {
        throw new SchemaError(
            `cannot migrate from version ${_pyRepr(declared_version)} to ` +
                `${SCHEMA_VERSION}; this script only handles v0 (no version key)`,
        );
    }

    if (!('ticket' in p)) {
        throw new SchemaError(
            "v0 state must carry a 'ticket' key; got keys: " +
                _pyReprList(_sortedStr(Object.keys(p))),
        );
    }
    const ticket = p['ticket'];
    if (!_isPlainDict(ticket)) {
        throw new SchemaError(
            `v0 state.ticket must be a JSON object; got ${_pyTypeName(ticket)}`,
        );
    }

    return {
        version: SCHEMA_VERSION,
        input: { kind: 'ticket', data: ticket },
        intent: DEFAULT_INTENT,
        directive_set: DEFAULT_DIRECTIVE_SET,
        persona: _get(p, 'persona', 'senior-engineer') as JsonValue,
        memory: [...((_get(p, 'memory', []) as JsonValue[]) ?? [])],
        plan: _get(p, 'plan', null) as JsonValue,
        changes: [...((_get(p, 'changes', []) as JsonValue[]) ?? [])],
        tests: _get(p, 'tests', null) as JsonValue,
        verify: _get(p, 'verify', null) as JsonValue,
        outcomes: { ...((_get(p, 'outcomes', {}) as Dict) ?? {}) },
        questions: [...((_get(p, 'questions', []) as JsonValue[]) ?? [])],
        report: _get(p, 'report', '') as JsonValue,
    };
}

/**
 * Migrate the v0 state file at `source` and write the v1 result.
 *
 * `destination` defaults to {@link DEFAULT_V1_FILENAME} next to
 * `source`. When `backup` is true (the default) the original
 * file is renamed with {@link BACKUP_SUFFIX} appended; when false,
 * the original is left untouched. The destination must not exist —
 * refusing to overwrite is the safety net against accidental
 * double-migration on CI.
 *
 * Returns the destination path on success.
 */
export function migrate_file(
    source: string,
    opts: { destination?: string | null; backup?: boolean } = {},
): string {
    const destination = opts.destination ?? null;
    const backup = opts.backup ?? true;

    if (!_isFile(source)) {
        throw new SchemaError(`v0 state file not found: ${source}`);
    }

    const raw = fs.readFileSync(source, 'utf-8');
    let payload: JsonValue;
    try {
        payload = JSON.parse(raw) as JsonValue;
    } catch (exc) {
        // Python `json.JSONDecodeError` → "invalid JSON in {source}: {exc}".
        throw new SchemaError(`invalid JSON in ${source}: ${(exc as Error).message}`);
    }

    const target = destination ?? _with_name(source, DEFAULT_V1_FILENAME);
    if (_exists(target)) {
        throw new SchemaError(
            `refusing to overwrite existing destination ${target}; ` +
                'delete or rename it first',
        );
    }

    const migrated = migrate_payload(payload);
    fs.mkdirSync(_parent(target), { recursive: true });
    fs.writeFileSync(
        target,
        _jsonDumps(migrated) + '\n',
        'utf-8',
    );

    if (backup) {
        const backup_path = _rotate_backup_path(source);
        // Python `shutil.move(str(source), str(backup_path))` — rename within
        // the same directory; `fs.renameSync` matches that fast path.
        fs.renameSync(source, backup_path);
    }

    return target;
}

/**
 * CLI entry point — `node node_modules/.bin/tsx work_engine/migration/v0_to_v1.ts`.
 *
 * Exits `0` on success, `2` on any {@link SchemaError} so the
 * invoking shell can branch on the failure category. Returns the exit
 * code (the caller sets `process.exitCode`, never `process.exit`, per
 * ADR-096).
 */
export function main(argv: string[] | null = null): number {
    const args = _parse_args(argv ?? process.argv.slice(2));
    if (args === null) {
        // `-h` / `--help` already printed usage and signalled exit 0.
        return 0;
    }

    let target: string;
    try {
        target = migrate_file(args.source, {
            destination: args.destination,
            backup: !args.no_backup,
        });
    } catch (exc) {
        if (exc instanceof SchemaError) {
            process.stderr.write(`error: ${exc.message}\n`);
            return 2;
        }
        throw exc;
    }

    process.stdout.write(`migrated ${args.source} → ${target}\n`);
    return 0;
}

// ── Argument parsing ─────────────────────────────────────────────────────
//
// The Python source uses `argparse` with a single optional positional
// (`source`, default `.implement-ticket-state.json`) plus `--destination`
// and `--no-backup`. argparse `--help`/error prose is not a parity surface
// (ADR-096); the parser mirrors argparse's runtime behaviour: long-option
// prefix abbreviation, `--flag=value` / `--flag value` forms, the store_true
// `--no-backup`, `-h`/`--help` exit-0, exit-2 on every error path.

interface MigrationArgs {
    source: string;
    destination: string | null;
    no_backup: boolean;
}

const _PROG = 'work_engine.migration.v0_to_v1';

interface _OptionSpec {
    flag: string;
    dest: 'destination' | 'no_backup';
    takesValue: boolean;
}

const _OPTIONS: _OptionSpec[] = [
    { flag: '--destination', dest: 'destination', takesValue: true },
    { flag: '--no-backup', dest: 'no_backup', takesValue: false },
];

const _HELP_FLAGS = ['--help'];

function _usage(): string {
    // Compact one-line usage marker; the exact wrapping/prose is not a parity
    // surface (ADR-096 — argparse usage/help text is not byte-compared).
    return `usage: ${_PROG} [-h] [--destination DESTINATION] [--no-backup] [source]`;
}

function _argErr(message: string): never {
    process.stderr.write(`${_usage()}\n`);
    process.stderr.write(`${_PROG}: error: ${message}\n`);
    process.exitCode = 2;
    throw new _ArgparseExit(2);
}

function _resolveLong(name: string): _OptionSpec | 'help' {
    const exact = _OPTIONS.find((o) => o.flag === name);
    if (exact) {
        return exact;
    }
    if (_HELP_FLAGS.includes(name)) {
        return 'help';
    }
    const candidates: Array<_OptionSpec | 'help'> = [];
    for (const o of _OPTIONS) {
        if (o.flag.startsWith(name)) {
            candidates.push(o);
        }
    }
    for (const h of _HELP_FLAGS) {
        if (h.startsWith(name)) {
            candidates.push('help');
        }
    }
    if (candidates.length === 1) {
        return candidates[0] as _OptionSpec | 'help';
    }
    if (candidates.length === 0) {
        _argErr(`unrecognized arguments: ${name}`);
    }
    const names = candidates.map((c) => (c === 'help' ? '--help' : c.flag)).join(', ');
    _argErr(`ambiguous option: ${name} could match ${names}`);
}

/** Thrown internally to mirror argparse's exit path (sentinel). */
class _ArgparseExit extends Error {
    readonly code: number;
    constructor(code: number) {
        super(`argparse exit ${code}`);
        Object.setPrototypeOf(this, _ArgparseExit.prototype);
        this.name = 'ArgparseExit';
        this.code = code;
    }
}

/**
 * Parse `argv` (the slice after the program name). Returns `null` on
 * `-h`/`--help` (usage printed, exit 0 signalled); throws {@link _ArgparseExit}
 * (with `process.exitCode` set to 2) on any error path. Mirrors the argparse
 * positional default of `.implement-ticket-state.json`.
 */
function _parse_args(argv: string[]): MigrationArgs | null {
    const args: MigrationArgs = {
        source: DEFAULT_V0_FILENAME,
        destination: null,
        no_backup: false,
    };
    const positionals: string[] = [];
    const extras: string[] = [];
    let sawSource = false;

    let i = 0;
    while (i < argv.length) {
        const tok = argv[i] as string;
        if (tok === '-h' || tok === '--help') {
            process.stdout.write(`${_usage()}\n`);
            return null;
        }
        if (tok.startsWith('--')) {
            let name = tok;
            let inlineValue: string | null = null;
            const eq = tok.indexOf('=');
            if (eq !== -1) {
                name = tok.slice(0, eq);
                inlineValue = tok.slice(eq + 1);
            }
            const resolved = _resolveLong(name);
            if (resolved === 'help') {
                process.stdout.write(`${_usage()}\n`);
                return null;
            }
            if (resolved.takesValue) {
                if (inlineValue !== null) {
                    args.destination = inlineValue;
                } else {
                    const next = argv[i + 1];
                    if (next === undefined) {
                        _argErr(`argument ${resolved.flag}: expected one argument`);
                    }
                    args.destination = next as string;
                    i += 1;
                }
            } else {
                if (inlineValue !== null) {
                    _argErr(`argument ${resolved.flag}: ignored explicit argument '${inlineValue}'`);
                }
                args.no_backup = true;
            }
        } else if (tok.startsWith('-') && tok !== '-') {
            extras.push(tok);
        } else if (!sawSource) {
            args.source = tok;
            sawSource = true;
            positionals.push(tok);
        } else {
            extras.push(tok);
        }
        i += 1;
    }
    if (extras.length > 0) {
        _argErr(`unrecognized arguments: ${extras.join(' ')}`);
    }
    return args;
}

// ── Path / filesystem parity helpers ─────────────────────────────────────

/** Python `Path.suffix` — the final dotted extension (incl. the dot), or "". */
function _suffix(p: string): string {
    const base = path.basename(p);
    const dot = base.lastIndexOf('.');
    // Python: a leading dot (dotfile, no other dot) has no suffix.
    if (dot <= 0) {
        return '';
    }
    return base.slice(dot);
}

/** Python `Path.with_suffix(newSuffix)` — replace the final extension. */
function _with_suffix(p: string, newSuffix: string): string {
    const dir = path.dirname(p);
    const base = path.basename(p);
    const cur = _suffix(p);
    const stem = cur ? base.slice(0, base.length - cur.length) : base;
    const joined = stem + newSuffix;
    return dir === '.' && !p.includes('/') && !p.includes(path.sep) ? joined : path.join(dir, joined);
}

/** Python `Path.with_name(name)` — same directory, replaced basename. */
function _with_name(p: string, name: string): string {
    const dir = path.dirname(p);
    return dir === '.' && !p.includes('/') && !p.includes(path.sep) ? name : path.join(dir, name);
}

/** Python `Path.parent` — the containing directory. */
function _parent(p: string): string {
    return path.dirname(p);
}

function _exists(p: string): boolean {
    try {
        fs.statSync(p);
        return true;
    } catch {
        return false;
    }
}

function _isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

// ── Python-parity primitives (mirrors state_io.ts) ───────────────────────

/**
 * Mirror Python `json.dumps(obj, indent=2, ensure_ascii=False)`.
 *
 * For round-tripped JSON, `JSON.stringify` with a 2-space indent matches
 * CPython byte-for-byte: 2-space indent, `": "` key separator, `{}` / `[]`
 * for empties, non-ASCII verbatim. Same rationale as `state_io.ts::_jsonDumps`:
 * no float/int tag survives JSON parsing, so the CPython `N.0` divergence
 * cannot arise here.
 */
function _jsonDumps(obj: Dict): string {
    return JSON.stringify(obj, null, 2);
}

/** `dict.get(key, default)`. */
function _get(obj: Record<string, JsonValue>, key: string, dflt: unknown): unknown {
    return key in obj ? obj[key] : dflt;
}

/** Python `isinstance(x, dict)` — plain object only (not array, not null). */
function _isPlainDict(value: unknown): boolean {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Python `type(x).__name__` for the JSON value shapes the messages emit. */
function _pyTypeName(value: unknown): string {
    if (value === null || value === undefined) {
        return 'NoneType';
    }
    if (Array.isArray(value)) {
        return 'list';
    }
    switch (typeof value) {
        case 'string':
            return 'str';
        case 'boolean':
            return 'bool';
        case 'number':
            return Number.isInteger(value) ? 'int' : 'float';
        case 'object':
            return 'dict';
        default:
            return typeof value;
    }
}

/** Python `repr(x)` for the scalar shapes interpolated via `{value!r}`. */
function _pyRepr(value: unknown): string {
    if (value === null || value === undefined) {
        return 'None';
    }
    if (value === true) {
        return 'True';
    }
    if (value === false) {
        return 'False';
    }
    if (typeof value === 'string') {
        return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
    }
    return String(value);
}

/** Python `repr(list_of_str)` — `['a', 'b']`. */
function _pyReprList(values: string[]): string {
    return '[' + values.map((v) => _pyRepr(v)).join(', ') + ']';
}

/** Python `sorted(list_of_str)` — code-point ascending. */
function _sortedStr(values: string[]): string[] {
    return [...values].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

// `python3 -m work_engine.migration.v0_to_v1` parity: run main() when invoked
// directly. tsx sets `import.meta.url` to the entry file URL.
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}
