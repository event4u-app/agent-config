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
 * `STRUCTURED_ASK_SHAPES` carries **one** row, for `claude`, written from an
 * observation under `host-capability-manifest.md` § Observation protocol —
 * 48 `AskUserQuestion` `tool_use` blocks across host versions 2.1.252 to
 * 2.1.284, 2026-09-01 to 2026-10-02. Artifact:
 * `agents/evidence/analysis/structured-ask-host-observation-2026-10.md`.  code-comment-allow provenance-comment -- the observation protocol declares a row inadmissible without its artifact citation, so this pointer is part of the contract the row satisfies, not evidence duplicated from a roadmap
 * Every other host has no row, which is "never looked", and inventing one from
 * a vendor's documentation is exactly what that protocol forbids.
 *
 * `STRUCTURED_ASK_TOOL_NAME_RE` is a **name-shape pattern, not a host fact**,
 * and stays one even now that a host fact exists beside it: the pattern is what
 * every caller passing no host id still matches on. It exists so that a picker
 * appearing in a transcript is MEASURED rather than missed. A reader must not
 * read a match as evidence that a named host ships that tool; the only thing
 * that establishes that is an observation written into
 * `STRUCTURED_ASK_SHAPES` with the protocol's four-part citation.
 *
 * Consequence, stated rather than discovered later: `native` is **0** on every
 * corpus this repo can scan today — and the 2026-10 observation does NOT change
 * that, which is worth stating because it looks like it should.
 * `probe_unblocked_ask` partitions hand-back ask turns, and a picker call is
 * answered by a `tool_result` rather than by a free user turn, so it was never
 * in that probe's denominator. The zero means "no prose hand-back used a picker
 * instead"; it never meant "no picker exists".
 *
 * That makes the zero DEFINITIONAL for this probe, not a measurement of
 * scarcity, and the earlier wording claimed the opposite on both halves: it
 * called the zero a measurement, and attributed it to the capability being
 * unobserved. The capability is observed and the zero is unchanged, which is
 * the cleanest available proof that the two were never connected.
 */

/** The per-host shape of a structured-ask tool, once one has been OBSERVED. */
export interface StructuredAskShape {
    /** The tool name as it appears in a transcript's `tool_use` block. */
    readonly tool: string;
    /**
     * The largest question count OBSERVED in one call, never a host ceiling the
     * host was asked for and refused. `1` is also the shape this repo wants.
     */
    readonly max_questions: number;
    /** The largest option count OBSERVED on one question — same caveat. */
    readonly max_options_per_question: number;
    /**
     * Whether the host's picker admits a free-text answer alongside the options.
     * The WEAKEST of the four to establish, because it is read by negation — an
     * answer carrying none of the offered labels. A cancelled ask looks the same
     * from the outside, so a `true` here is "observed at least once", never a
     * count. The citing artifact carries the per-row basis.
     */
    readonly free_text: boolean;
}

/**
 * Observed per-host structured-ask shapes.
 *
 * A row is written only from an observation in a real session under
 * `contexts/execution/host-capability-manifest.md` § Observation protocol —
 * host · host version · transcript reference · date. Never from a host's
 * documentation, and never by analogy to another host.
 *
 * `claude`'s row is the first, and the two numeric fields are **observed
 * maxima over 48 calls, not host ceilings**: no call carried two questions, so
 * the host was never asked to accept two. The guard's threshold does not rest
 * on them — one question per call is this repo's own rule either way.
 */
export const STRUCTURED_ASK_SHAPES: Readonly<Record<string, StructuredAskShape>> = {
    claude: { tool: 'AskUserQuestion', max_questions: 1, max_options_per_question: 4, free_text: true },
};

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
 *
 * KNOWN ASYMMETRY, named rather than left for the next reader to hit. With a
 * row present, this returns `name === shape.tool`: ONE observed name becomes an
 * exclusive allowlist, so every other picker name is answered `false` on that
 * host — a universal negative from a single positive observation, which is the
 * shape of inference the observation protocol refuses elsewhere. It is left as
 * it is because the alternative (union of the row and the pattern) would make
 * an observed row buy nothing, and because no caller is affected today: the one
 * production caller, `hooks/one_question_per_ask_hook.ts`, passes no host id by
 * design and never reaches this branch. A caller that does start passing one
 * inherits the asymmetry, and `tests/scripts/ask_surface.test.ts` pins it so
 * the inheritance is visible rather than silent.
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
