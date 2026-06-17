/**
 * Read and validate the persisted `.work-state.json` envelope.
 *
 * TypeScript twin of `src/scripts/_cli/explain_last/state_loader.py`
 * (ADR-200). Behaviour mirrors the Python original EXACTLY — the same
 * three raising failure modes, the same exit codes (1 / 2 / 0), and the
 * same byte-identical messages (including the `version={value!r}` Python
 * repr). No behaviour changes.
 *
 * The work-engine writes a versioned schema documented at
 * `work_engine.state` (template) and mirrored to consumer projects.
 * Phase 2 of the explain roadmap only ever reads the file. Schema-bumps
 * are caught by `loadState` and surface a discoverable error rather than
 * rendering nonsense.
 */
import * as fs from 'node:fs';

export const EXPECTED_VERSION = 1;

/** Raised when the state file is missing, unreadable, or version-skewed. */
export class StateLoadError extends Error {
    readonly exitCode: number;

    constructor(message: string, options: { exitCode?: number } = {}) {
        super(message);
        this.name = 'StateLoadError';
        this.exitCode = options.exitCode ?? 2;
    }
}

/** Python `repr()` for the values that can land in `version` (scalars). */
function _pyRepr(value: unknown): string {
    if (value === null || value === undefined) {
        return 'None';
    }
    if (typeof value === 'boolean') {
        return value ? 'True' : 'False';
    }
    if (typeof value === 'string') {
        // CPython prefers single quotes unless the string contains a single
        // quote and no double quote. Version values are simple, but stay
        // faithful for the message text.
        if (value.includes("'") && !value.includes('"')) {
            return `"${value}"`;
        }
        return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
    }
    return String(value);
}

/**
 * Return the parsed state dict or throw `StateLoadError`.
 *
 * Validation is intentionally permissive — unknown keys pass through
 * because the schema is additive. Only three failure modes raise:
 *
 * 1. File does not exist.
 * 2. File is not valid JSON.
 * 3. `version` field is present and not equal to `EXPECTED_VERSION`.
 *
 * A missing `version` field is treated as legacy (v0) and raises the same
 * skew message; the CLI converts the raise into the user-facing "trace
 * format upgraded; rerun the upstream command on this branch to
 * regenerate" hint required by the council fix.
 */
export function load_state(state_file: string): Record<string, unknown> {
    if (!fs.existsSync(state_file)) {
        throw new StateLoadError(`state file not found: ${state_file}`, {
            exitCode: 1,
        });
    }
    let text: string;
    try {
        text = fs.readFileSync(state_file, 'utf-8');
    } catch (exc) {
        throw new StateLoadError(
            `cannot read state file ${state_file}: ${_osErr(exc)}`,
        );
    }
    let payload: unknown;
    try {
        payload = JSON.parse(text);
    } catch (exc) {
        throw new StateLoadError(
            `state file ${state_file} is not valid JSON: ${_jsonErr(exc, text)}`,
        );
    }
    if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
        throw new StateLoadError(
            `state file ${state_file} must contain a JSON object`,
        );
    }
    const version = (payload as Record<string, unknown>).version;
    if (version !== EXPECTED_VERSION) {
        throw new StateLoadError(
            'trace format upgraded; rerun the upstream command on '
            + 'this branch to regenerate '
            + `(found version=${_pyRepr(version === undefined ? null : version)}, expected ${EXPECTED_VERSION})`,
            { exitCode: 0 }, // informational, not a failure (council fix).
        );
    }
    return payload as Record<string, unknown>;
}

/** Best-effort message text for an OS-level read error. */
function _osErr(exc: unknown): string {
    if (exc instanceof Error) {
        return exc.message;
    }
    return String(exc);
}

/** Best-effort message text for a JSON parse error (callers only print it). */
function _jsonErr(exc: unknown, _text: string): string {
    if (exc instanceof Error) {
        return exc.message;
    }
    return String(exc);
}
