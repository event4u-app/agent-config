/**
 * File resolver — wrap a path reference as an {@link Input} envelope.
 *
 * TypeScript twin of `work_engine/resolvers/file.py` (ADR-094 py2ts —
 * work_engine foundation). Public API names stay snake_case to mirror the
 * Python module 1:1 (per ADR-094 — Python style is part of the contract).
 *
 * The resolver is the R3 Phase 1 entry point for the "improve this existing
 * component/page" surface: a user hands the engine a path (e.g.,
 * `resources/views/dashboard.blade.php` or `src/components/Sidebar.tsx`),
 * the resolver normalises it, and the dispatcher routes the envelope through
 * the UI-track `ui-improve` directive set.
 *
 * Like `work_engine.resolvers.prompt` and `.diff`, this module is
 * intentionally thin: it normalises and rejects garbage payloads, nothing
 * more. Existence checks, mtime caching, and content reads are deferred to
 * the `analyze` step / the audit directive — a resolver doing I/O at the
 * command-shell boundary would couple the envelope build to filesystem state
 * and break replay-against-state-files.
 *
 * The envelope mirrors the prompt and diff resolvers so a single refiner code
 * path can read all three — `{path, reconstructed_ac, assumptions}`. The
 * only material difference is the path-shape check that rejects values that
 * are obviously not paths (absolute URLs, empty strings, control chars).
 */
import * as path from 'node:path';

import { Input } from '../state.js';

export const KIND = 'file';
/** Wire value carried in {@link Input.kind}. */

const _MIN_PATH_LEN = 1;
/**
 * Minimum non-whitespace character count for a resolvable path.
 *
 * A 1-char path is rare but legal (`a`); the bar exists only to reject
 * literal empty / whitespace-only payloads which carry no signal at all.
 */

const _FORBIDDEN_PREFIXES: readonly string[] = [
    'http://',
    'https://',
    'ftp://',
    'file://',
];
/**
 * Prefixes that signal the caller passed a URL, not a filesystem path.
 *
 * The diff resolver handles patch URLs at a future R3 layer; the file
 * resolver only accepts on-disk references. Rejecting URLs explicitly
 * keeps misuse loud instead of letting the audit step discover it later.
 * The check is case-insensitive.
 */

/** Raised when a payload cannot be resolved into a file envelope. */
export class FileResolverError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'FileResolverError';
        Object.setPrototypeOf(this, FileResolverError.prototype);
    }
}

/**
 * Return an {@link Input} carrying the path + empty refinement slots.
 *
 * @param path_ The user-supplied path reference. The resolver normalises only
 *   by stripping leading/trailing whitespace; case, separators, and the
 *   relative-vs-absolute distinction are all preserved verbatim so the
 *   downstream audit step reads exactly what the user wrote.
 * @returns Envelope of shape
 *   `{"kind": "file", "data": {"path": <path>, "reconstructed_ac": [],
 *   "assumptions": []}}`. The two empty lists are placeholders the
 *   `refine-prompt` skill writes into on the rebound from `refine`; they are
 *   kept to preserve a single-shape envelope across all prompt-like resolvers.
 * @throws {@link FileResolverError} If `path` is not a string, is empty /
 *   whitespace-only, contains a NUL byte (filesystem-illegal everywhere), or
 *   is a URL (use the diff resolver for remote-PR / patch URLs in a future R3
 *   phase).
 */
export function build_envelope(path_: unknown): Input {
    if (typeof path_ !== 'string') {
        throw new FileResolverError(
            `path must be a string; got ${pyTypeName(path_)}`,
        );
    }
    const stripped = pyStrip(path_);
    if (stripped.length < _MIN_PATH_LEN) {
        throw new FileResolverError(
            'path is empty or whitespace-only — nothing to resolve',
        );
    }
    if (stripped.includes('\x00')) {
        throw new FileResolverError(
            'path contains a NUL byte; filesystem references must be ' +
                'NUL-free',
        );
    }
    const lowered = stripped.toLowerCase();
    if (_FORBIDDEN_PREFIXES.some((prefix) => lowered.startsWith(prefix))) {
        throw new FileResolverError(
            `path looks like a URL (${pyStrRepr(pySlice(stripped, 32))}); the file resolver ` +
                'only accepts on-disk references — use the diff resolver for ' +
                'PR or patch URLs',
        );
    }
    // Normalise separators *only* on Windows-style backslashes so
    // `resources\\views\\foo.blade.php` round-trips as POSIX. Native
    // POSIX paths are returned untouched so the audit step's identity
    // comparison against directory listings stays trivial.
    const normalised =
        path.sep === '/' ? stripped.replace(/\\/g, '/') : stripped;
    return new Input(KIND, {
        path: normalised,
        reconstructed_ac: [],
        assumptions: [],
    });
}

// ── Python-parity helpers ───────────────────────────────────────────────

/**
 * Mirror Python `str.strip()` — see `resolvers/prompt.ts` for the parity note.
 */
function pyStrip(s: string): string {
    return s.trim();
}

/**
 * Mirror Python `s[:n]` over code points. The error path renders `stripped[:32]`
 * via `!r`; Python slices by code point, not UTF-16 unit, so use the spread
 * iterator to slice on code-point boundaries before re-joining.
 */
function pySlice(s: string, n: number): string {
    return [...s].slice(0, n).join('');
}

/**
 * Mirror Python `repr(str)` — prefers single quotes, switches to double quotes
 * only when the string contains a single quote but no double quote, and escapes
 * backslash plus the active quote and the standard control characters. Matches
 * the `state.py` twin's `pyStrRepr` so the `{...!r}` error tail is byte-equal.
 */
function pyStrRepr(s: string): string {
    const hasSingle = s.includes("'");
    const hasDouble = s.includes('"');
    const quote = hasSingle && !hasDouble ? '"' : "'";
    let out = quote;
    for (const ch of s) {
        const code = ch.codePointAt(0) as number;
        if (ch === '\\') out += '\\\\';
        else if (ch === quote) out += '\\' + quote;
        else if (ch === '\n') out += '\\n';
        else if (ch === '\r') out += '\\r';
        else if (ch === '\t') out += '\\t';
        else if (code < 0x20 || code === 0x7f) {
            out += `\\x${code.toString(16).padStart(2, '0')}`;
        } else {
            out += ch;
        }
    }
    return out + quote;
}

/** Python `type(x).__name__` for the non-string `isinstance` guard branch. */
function pyTypeName(v: unknown): string {
    if (v === null) return 'NoneType';
    if (v === undefined) return 'NoneType';
    if (typeof v === 'boolean') return 'bool';
    if (typeof v === 'string') return 'str';
    if (typeof v === 'number') return Number.isInteger(v) ? 'int' : 'float';
    if (Array.isArray(v)) return 'list';
    return 'dict';
}
