/**
 * Diff resolver — wrap a unified-diff payload as an {@link Input} envelope.
 *
 * TypeScript twin of `work_engine/resolvers/diff.py` (ADR-096 py2ts —
 * work_engine foundation). Public API names stay snake_case to mirror the
 * Python module 1:1 (per ADR-096 — Python style is part of the contract).
 *
 * The resolver is the R3 Phase 1 entry point for the "improve this screen via
 * diff/PR" surface: a user (or `/work` adapter) hands the engine a patch text,
 * the resolver normalises it, and the dispatcher routes it through the UI-track
 * `ui-improve` directive set.
 *
 * Like `work_engine.resolvers.prompt`, this module is intentionally thin:
 * it normalises and rejects garbage payloads, nothing more. Reconstruction of
 * acceptance criteria + assumptions + confidence is the job of the
 * `refine-prompt` skill (R2 Phase 3) running against the diff once the engine
 * hits the `refine` step. Keeping the split sharp means the envelope shape
 * stays cheap to round-trip through state and the heavy lifting stays with the
 * agent-directive halt where it belongs.
 *
 * The envelope mirrors the prompt resolver's shape so a single refiner code
 * path can read both — `{raw, reconstructed_ac, assumptions}`. The only
 * material difference is the heuristic header check that rejects payloads
 * that obviously are not unified-diff text.
 */
import { Input } from '../state.js';

export const KIND = 'diff';
/** Wire value carried in {@link Input.kind}. */

const _MIN_DIFF_LEN = 1;
/**
 * Minimum non-whitespace character count before the heuristic runs.
 *
 * The resolver is not a *quality* gate; it only rejects literally empty
 * payloads and obvious non-diffs. A semantically empty diff (e.g., headers but
 * no hunks) is still accepted so the refiner can score its tractability and
 * surface a `low`-band halt where appropriate.
 */

const _DIFF_MARKERS: readonly RegExp[] = [
    /^diff --git /m,
    /^--- /m,
    /^\+\+\+ /m,
    /^@@ /m,
    /^Index: /m,
];
/**
 * Heuristic markers that flag a payload as a unified or git-style diff.
 *
 * A payload qualifies if **any** marker matches — the resolver accepts unified
 * diffs (`--- `/`+++ `/`@@ `), `git diff` output (`diff --git`), and
 * the legacy `Index: ` SVN/CVS header. The match is anchored at line start so
 * quoted snippets inside prose ("the function `--- foo` failed") do not pass
 * the gate.
 */

/** Raised when a payload cannot be resolved into a diff envelope. */
export class DiffResolverError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'DiffResolverError';
        Object.setPrototypeOf(this, DiffResolverError.prototype);
    }
}

/**
 * Return an {@link Input} carrying the raw diff + empty refinement slots.
 *
 * @param raw The user-supplied diff text. Whitespace is preserved verbatim —
 *   the refiner reads original spacing/casing when scoring goal clarity, and
 *   a unified-diff round-trip cannot tolerate normalised whitespace.
 * @returns Envelope of shape
 *   `{"kind": "diff", "data": {"raw": <raw>, "reconstructed_ac": [],
 *   "assumptions": []}}`. The two empty lists are placeholders the
 *   `refine-prompt` skill writes into on the rebound from `refine`.
 * @throws {@link DiffResolverError} If `raw` is not a string, contains no
 *   non-whitespace characters, or does not match any {@link _DIFF_MARKERS}.
 *   The marker check guards against accidentally routing free-form prose
 *   through the diff path.
 */
export function build_envelope(raw: unknown): Input {
    if (typeof raw !== 'string') {
        throw new DiffResolverError(
            `diff must be a string; got ${pyTypeName(raw)}`,
        );
    }
    if (pyStrip(raw).length < _MIN_DIFF_LEN) {
        throw new DiffResolverError(
            'diff is empty or whitespace-only — nothing to resolve',
        );
    }
    if (!_DIFF_MARKERS.some((marker) => reSearch(marker, raw))) {
        throw new DiffResolverError(
            'payload does not look like a unified diff — expected one of ' +
                "'diff --git', '--- ', '+++ ', '@@ ', or 'Index: ' headers",
        );
    }
    return new Input(KIND, {
        raw: raw,
        reconstructed_ac: [],
        assumptions: [],
    });
}

// ── Python-parity helpers ───────────────────────────────────────────────

/**
 * Mirror Python `re.Pattern.search` for a boolean hit. The patterns carry the
 * `m` (MULTILINE) flag so `^` matches at every line start, identical to
 * `re.compile(..., re.MULTILINE)`. The regexes are flag-only (no `g`), so a
 * fresh `.test` has no `lastIndex` state to reset between calls.
 */
function reSearch(pattern: RegExp, text: string): boolean {
    return pattern.test(text);
}

/**
 * Mirror Python `str.strip()` — see `resolvers/prompt.ts` for the parity note.
 * `String.trim()` is faithful for every realistic whitespace-only payload.
 */
function pyStrip(s: string): string {
    return s.trim();
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
