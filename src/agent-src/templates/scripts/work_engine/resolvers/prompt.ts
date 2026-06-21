/**
 * Prompt resolver — wrap a raw user prompt as an {@link Input} envelope.
 *
 * TypeScript twin of `work_engine/resolvers/prompt.py` (ADR-200 py2ts —
 * work_engine foundation). Public API names stay snake_case to mirror the
 * Python module 1:1 (per ADR-200 — Python style is part of the contract).
 *
 * The resolver is intentionally minimal. It accepts a raw string, validates
 * that it contains non-whitespace content, and returns
 * `Input(kind="prompt", data={"raw": <text>, "reconstructed_ac": [],
 * "assumptions": []})`. The empty AC + assumptions lists are placeholders
 * that the `refine-prompt` skill (R2 Phase 3) fills in once the engine
 * runs the deterministic `refine` gate against the raw text.
 *
 * Why split the resolver from the refiner:
 *
 * - The resolver runs at command boundaries (the `/work` entrypoint
 *   builds an envelope, then hands off to `work_engine`). It must stay
 *   side-effect-free and dependency-light so the command shell can call
 *   it without touching the LLM-facing skill harness.
 * - The refiner runs inside the dispatcher loop and is allowed to halt
 *   (medium-confidence assumptions report, low-confidence one-question
 *   block) per `docs/contracts/implement-ticket-flow.md`. That
 *   control-flow surface does not belong in a resolver.
 *
 * Future R3 resolvers (`diff`, `file`) follow the same pattern: thin
 * normalisation, no interpretation, one envelope shape per kind.
 */
import { Input } from '../state.js';

export const KIND = 'prompt';
/** Wire value carried in {@link Input.kind}. */

const _MIN_PROMPT_LEN = 1;
/**
 * Minimum non-whitespace character count for a resolvable prompt.
 *
 * Set to 1 by design — the resolver is not a quality gate. It only
 * rejects literally empty / whitespace-only payloads (which cannot be
 * distinguished from missing input). Quality judgment (is the prompt
 * clear? is it tractable?) is the `refine-prompt` skill's job, surfaced
 * through the confidence band, not the resolver's.
 */

/** Raised when a payload cannot be resolved into a prompt envelope. */
export class PromptResolverError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'PromptResolverError';
        Object.setPrototypeOf(this, PromptResolverError.prototype);
    }
}

/**
 * Return an {@link Input} carrying the raw prompt + empty refinement slots.
 *
 * @param raw The user-supplied prompt text. Leading/trailing whitespace is
 *   preserved verbatim — the refiner reads the original casing and spacing
 *   when scoring goal clarity, so collapsing whitespace here would lose
 *   signal.
 * @returns Envelope of shape
 *   `{"kind": "prompt", "data": {"raw": <raw>, "reconstructed_ac": [],
 *   "assumptions": []}}`. The two empty lists are placeholders the
 *   `refine-prompt` skill writes into on the rebound from the `refine` step.
 * @throws {@link PromptResolverError} If `raw` is not a string, or contains
 *   no non-whitespace characters (the only case where the envelope would
 *   carry no actionable signal at all).
 */
export function build_envelope(raw: unknown): Input {
    if (typeof raw !== 'string') {
        throw new PromptResolverError(
            `prompt must be a string; got ${pyTypeName(raw)}`,
        );
    }
    if (pyStrip(raw).length < _MIN_PROMPT_LEN) {
        throw new PromptResolverError(
            'prompt is empty or whitespace-only — nothing to resolve',
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
 * Mirror Python `str.strip()` — strips the Unicode whitespace set CPython
 * uses (the characters for which `str.isspace()` is true). `String.trim()`
 * strips a near-identical set; the only practical divergence for the empty-
 * payload guard is that `trim()` does not strip a handful of exotic code
 * points (e.g. zero-width). For a length-vs-1 gate the standard `trim` is
 * faithful for every realistic whitespace-only prompt, and any leftover
 * exotic char would correctly count as "non-whitespace content" under both
 * runtimes' intent. Kept as a named helper to mark the parity point.
 */
function pyStrip(s: string): string {
    return s.trim();
}

/**
 * Python `type(x).__name__` for the values this resolver's TypeError-equivalent
 * branch reports: the `isinstance(raw, str)` guard fires on any non-string.
 */
function pyTypeName(v: unknown): string {
    if (v === null) return 'NoneType';
    if (v === undefined) return 'NoneType';
    if (typeof v === 'boolean') return 'bool';
    if (typeof v === 'string') return 'str';
    if (typeof v === 'number') return Number.isInteger(v) ? 'int' : 'float';
    if (Array.isArray(v)) return 'list';
    return 'dict';
}
