/**
 * File-based input builders and the load-or-build dispatch helper.
 *
 * TypeScript twin of `work_engine/input_builders.py` (ADR-096 py2ts Phase 1 —
 * work_engine TOP/integration layer). Public API names stay snake_case to
 * mirror the Python module 1:1 (per ADR-096 — Python style is part of the
 * contract).
 *
 * Extracted from `cli.py` in P2.3 of `road-to-post-pr29-optimize.md`. Owns the
 * CLI's "first run" path: when no state file exists, build a fresh `WorkState`
 * from `--ticket-file`, `--prompt-file`, `--diff-file` or `--file-file`. Every
 * builder is byte-identical in behaviour to the pre-split version.
 */

import * as fs from 'node:fs';

import { _FMT_V0, _FMT_V1, type ParsedArgs } from './cli_args.js';
import { _CLIError } from './errors.js';
import { populate_routing } from './intent/classify.js';
import { DiffResolverError, build_envelope as _build_diff_envelope } from './resolvers/diff.js';
import { FileResolverError, build_envelope as _build_file_envelope } from './resolvers/file.js';
import { PromptResolverError, build_envelope as _build_prompt_envelope } from './resolvers/prompt.js';
import { Input, WorkState, type Dict } from './state.js';
import { _load, _maybe_raise_legacy_hint, _read_json } from './state_io.js';

/**
 * Return the WorkState to dispatch against plus its wire format.
 *
 * Either loaded from `state_file` (format-preserving) or freshly built from
 * `--ticket-file` (R1), `--prompt-file` (R2), `--diff-file` (R3) or
 * `--file-file` (R3). Fresh ticket files default to v0 wire format so newly
 * captured Goldens stay byte-equal with the pre-Phase-4 baseline; the prompt /
 * diff / file paths emit v1 directly (v0 has no envelope concept for these
 * kinds). v1 round-trips for state files already on disk in v1 shape.
 */
export function _load_or_build(state_file: string, args: ParsedArgs): [WorkState, string] {
    if (_exists(state_file)) {
        return _load(state_file);
    }
    _maybe_raise_legacy_hint(state_file);
    const inputs: Array<[string, string | null]> = [
        ['--ticket-file', args.ticket_file],
        ['--prompt-file', args.prompt_file],
        ['--diff-file', args.diff_file],
        ['--file-file', args.file_file],
    ];
    const supplied = inputs.filter(([, value]) => value !== null).map(([name]) => name);
    if (supplied.length > 1) {
        throw new _CLIError(
            `${supplied.join(', ')} are mutually exclusive; pass exactly ` +
                'one when building an initial state.',
        );
    }
    if (supplied.length === 0) {
        throw new _CLIError(
            `No state file at ${state_file} and no --ticket-file, ` +
                '--prompt-file, --diff-file, or --file-file given; cannot ' +
                'build an initial state.',
        );
    }
    if (args.prompt_file !== null) {
        return [_build_from_prompt_file(args), _FMT_V1];
    }
    if (args.diff_file !== null) {
        return [_build_from_diff_file(args), _FMT_V1];
    }
    if (args.file_file !== null) {
        return [_build_from_file_file(args), _FMT_V1];
    }
    const ticket = _read_json(args.ticket_file as string);
    if (!_isPlainDict(ticket)) {
        throw new _CLIError(
            `--ticket-file must carry a JSON object; got ${_pyTypeName(ticket)}.`,
        );
    }
    const work = new WorkState({ input: new Input('ticket', ticket as Dict) });
    if (args.persona) {
        work.persona = args.persona;
    }
    populate_routing(work);
    return [work, _FMT_V0];
}

/**
 * Read `--prompt-file` as raw text and wrap it in a prompt envelope.
 *
 * The file is read verbatim (UTF-8) and handed to the prompt resolver, which
 * validates non-emptiness and returns the canonical
 * `Input(kind="prompt", data={raw, reconstructed_ac, assumptions})` envelope.
 * Persona is honoured the same way as the ticket path.
 */
export function _build_from_prompt_file(args: ParsedArgs): WorkState {
    let raw: string;
    try {
        raw = fs.readFileSync(args.prompt_file as string, 'utf-8');
    } catch (exc) {
        throw new _CLIError(`Cannot read ${args.prompt_file}: ${_osErrorText(exc, args.prompt_file as string)}`);
    }
    let envelope: Input;
    try {
        envelope = _build_prompt_envelope(raw);
    } catch (exc) {
        if (exc instanceof PromptResolverError) {
            throw new _CLIError(`--prompt-file is not a valid prompt: ${exc.message}`);
        }
        throw exc;
    }
    const work = new WorkState({ input: envelope });
    if (args.persona) {
        work.persona = args.persona;
    }
    populate_routing(work);
    return work;
}

/**
 * Read `--diff-file` as raw text and wrap it in a diff envelope.
 *
 * The file is read verbatim (UTF-8) and handed to the diff resolver, which
 * validates the unified-diff header heuristic and returns the canonical
 * `Input(kind="diff", data={raw, reconstructed_ac, assumptions})` envelope.
 * `populate_routing` then routes the envelope to the UI-improve directive set
 * without running the prose classifier.
 */
export function _build_from_diff_file(args: ParsedArgs): WorkState {
    let raw: string;
    try {
        raw = fs.readFileSync(args.diff_file as string, 'utf-8');
    } catch (exc) {
        throw new _CLIError(`Cannot read ${args.diff_file}: ${_osErrorText(exc, args.diff_file as string)}`);
    }
    let envelope: Input;
    try {
        envelope = _build_diff_envelope(raw);
    } catch (exc) {
        if (exc instanceof DiffResolverError) {
            throw new _CLIError(`--diff-file is not a valid diff: ${exc.message}`);
        }
        throw exc;
    }
    const work = new WorkState({ input: envelope });
    if (args.persona) {
        work.persona = args.persona;
    }
    populate_routing(work);
    return work;
}

/**
 * Read `--file-file` as a single-line path and wrap it in a file envelope.
 *
 * The file is read verbatim (UTF-8); the first non-empty line is taken as the
 * path reference and handed to the file resolver, which validates path shape
 * (non-empty, NUL-free, not a URL) and returns the canonical
 * `Input(kind="file", data={path, reconstructed_ac, assumptions})` envelope.
 * Trailing whitespace and additional lines are ignored.
 */
export function _build_from_file_file(args: ParsedArgs): WorkState {
    let raw: string;
    try {
        raw = fs.readFileSync(args.file_file as string, 'utf-8');
    } catch (exc) {
        throw new _CLIError(`Cannot read ${args.file_file}: ${_osErrorText(exc, args.file_file as string)}`);
    }
    // Python: `raw.strip().splitlines()[0] if raw.strip() else ""`.
    const stripped = _pyStrip(raw);
    const path_ = stripped ? _firstLine(stripped) : '';
    let envelope: Input;
    try {
        envelope = _build_file_envelope(path_);
    } catch (exc) {
        if (exc instanceof FileResolverError) {
            throw new _CLIError(`--file-file does not carry a valid path: ${exc.message}`);
        }
        throw exc;
    }
    const work = new WorkState({ input: envelope });
    if (args.persona) {
        work.persona = args.persona;
    }
    populate_routing(work);
    return work;
}

// ── Python-parity helpers ────────────────────────────────────────────────

function _exists(p: string): boolean {
    try {
        fs.statSync(p);
        return true;
    } catch {
        return false;
    }
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
            return Number.isInteger(value as number) ? 'int' : 'float';
        case 'object':
            return 'dict';
        default:
            return typeof value;
    }
}

/** Python `str.strip()` — strip leading/trailing whitespace. */
function _pyStrip(s: string): string {
    // Python str.strip() with no arg removes ASCII + Unicode whitespace; JS \s
    // covers the common set adequately for the single-line-path contract.
    return s.replace(/^\s+/u, '').replace(/\s+$/u, '');
}

/**
 * Python `str.splitlines()[0]` on an already-`strip()`ped string.
 *
 * The caller consumes only the first line; the stripped input has no leading
 * boundary, so splitting on the universal-newline set and returning element 0
 * is byte-equivalent to `splitlines()[0]` for the single-line-path contract.
 */
function _firstLine(s: string): string {
    const m = s.split(/\r\n|[\n\r\v\f\x1c\x1d\x1e\x85\u2028\u2029]/u);
    return m[0] ?? '';
}

/**
 * Approximate the text of Python's `OSError` for a failed read (mirrors
 * `state_io.ts::_osErrorText`). The error *channel* (exit 2 via `_CLIError`)
 * and the *prefix* ("Cannot read <path>: ") stay identical; only the trailing
 * OS detail differs — tests normalise it.
 */
function _osErrorText(exc: unknown, p: string): string {
    const e = exc as NodeJS.ErrnoException;
    if (e && e.code === 'ENOENT') {
        return `[Errno 2] No such file or directory: '${p}'`;
    }
    if (e && e.code === 'EISDIR') {
        return `[Errno 21] Is a directory: '${p}'`;
    }
    if (e && e.code === 'EACCES') {
        return `[Errno 13] Permission denied: '${p}'`;
    }
    return e && e.message ? e.message : String(exc);
}
