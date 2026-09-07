/**
 * The structured-ask surface — one shared definition of "a host's own question
 * tool", read by every consumer that needs it.
 *
 * Three consumers exist and they must not each invent their own answer:
 *
 *   - `probe_unblocked_ask.ts` partitions hand-back ask turns into `text` and
 *     `native`, where `native` means the turn carried a call to such a tool.
 *   - `hooks/one_question_per_ask_hook.ts` denies a call carrying more than one
 *     question.
 *   - `_lib/host_capability.ts` carries the boolean `structured_ask` capability;
 *     the per-host SHAPE lives here rather than in the manifest, because every
 *     manifest field is a strict boolean that `asBool` coerces — a nested object
 *     put there would normalize silently to `false`.
 *
 * What is observed, and what is a shape guess — the line is drawn explicitly.
 *
 * `STRUCTURED_ASK_SHAPES` is **empty**. No host in this repository's registry
 * carries an observed structured-ask tool, so there is no per-host tool name to
 * match on, and inventing one from a vendor's documentation is exactly what
 * `host-capability-manifest.md` § Observation protocol forbids.
 *
 * `STRUCTURED_ASK_TOOL_NAME_RE` is therefore a **name-shape pattern, not a host
 * fact**. It exists so that if such a tool ever appears in a transcript, the
 * probe MEASURES it rather than missing it — and so the number it reports today
 * (zero) is a measurement rather than an absence of instrumentation. A reader
 * must not read a match as evidence that a named host ships that tool; the only
 * thing that establishes that is an observation written into
 * `STRUCTURED_ASK_SHAPES` with the protocol's four-part citation.
 *
 * Consequence, stated rather than discovered later: `native` is expected to be
 * **0** on every corpus this repo can scan today. That is the honest reading of
 * a capability nobody has observed, not a broken detector.
 */

/** The per-host shape of a structured-ask tool, once one has been OBSERVED. */
export interface StructuredAskShape {
    /** The tool name as it appears in a transcript's `tool_use` block. */
    readonly tool: string;
    /** How many questions one call may carry. `1` is the shape this repo wants. */
    readonly max_questions: number;
    /** How many options one question may offer. */
    readonly max_options_per_question: number;
    /** Whether the host's picker admits a free-text answer alongside the options. */
    readonly free_text: boolean;
}

/**
 * Observed per-host structured-ask shapes.
 *
 * EMPTY, deliberately. A row is written only from an observation in a real
 * session under `contexts/execution/host-capability-manifest.md` § Observation
 * protocol — host · host version · transcript reference · date. Never from a
 * host's documentation, and never by analogy to another host.
 */
export const STRUCTURED_ASK_SHAPES: Readonly<Record<string, StructuredAskShape>> = {};

/** The observed shape for `hostId`, or `undefined` when none has been observed. */
export function structuredAskShape(
    hostId: string | null | undefined,
): StructuredAskShape | undefined {
    if (hostId === null || hostId === undefined) {
        return undefined;
    }
    return STRUCTURED_ASK_SHAPES[hostId];
}

/**
 * Name-SHAPE pattern for a structured-ask tool. See the module header: this is
 * a matcher, not a claim about any host.
 */
export const STRUCTURED_ASK_TOOL_NAME_RE = /^(ask[_-]?user[_-]?question|user[_-]?question|ask[_-]?question)s?$/i;

/**
 * Is `name` a structured-ask tool call?
 *
 * An observed per-host shape wins outright — that is a fact about the host. The
 * name-shape pattern is the fallback, and it is why the probe can report a
 * measured zero instead of nothing at all.
 */
export function isStructuredAskTool(name: string, hostId?: string | null): boolean {
    const shape = structuredAskShape(hostId);
    if (shape !== undefined) {
        return name === shape.tool;
    }
    return STRUCTURED_ASK_TOOL_NAME_RE.test(name);
}

/**
 * How many questions a structured-ask tool payload carries.
 *
 * Returns `-1` when the payload's shape is not recognised at all — a caller
 * that gates on this must treat `-1` as "cannot tell", never as "one". The two
 * recognised shapes are the only ones a picker can plausibly use: an array of
 * question objects under a `questions`-like key, or a single question field.
 *
 * A `questions` array of length 0 is 0, not 1: an empty ask is malformed and a
 * gate should be able to say so.
 */
export function countStructuredAskQuestions(input: unknown): number {
    if (input === null || typeof input !== 'object' || Array.isArray(input)) {
        return -1;
    }
    const src = input as Record<string, unknown>;
    for (const key of ['questions', 'question_list', 'items', 'prompts']) {
        const v = src[key];
        if (Array.isArray(v)) {
            return v.length;
        }
    }
    for (const key of ['question', 'prompt', 'header']) {
        if (typeof src[key] === 'string' && (src[key] as string).trim() !== '') {
            return 1;
        }
    }
    return -1;
}
