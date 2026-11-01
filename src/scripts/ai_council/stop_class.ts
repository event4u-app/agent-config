// Why a provider stopped generating — the fact a parseable-but-cut-off answer hides.
//
// A member answer that hit `max_tokens` can still end in a well-formed STANCE line
// or a valid JSON array, and every reader downstream (stance tally, findings parse,
// quorum) used to judge it by its text alone. So a truncated answer counted as a
// full vote. The provider tells us when it cut the answer short; this module reads
// that signal and normalises it to one vocabulary.
//
// Never guesses: a stop reason that is absent, or one this table does not know,
// is `unknown` — not `complete`. `unknown` keeps today's behaviour (the answer is
// judged by its text), so the CLI transports, which report no stop reason, are
// unaffected.

export type StopClass = 'complete' | 'truncated' | 'context_exceeded' | 'unknown';

const ANTHROPIC: Readonly<Record<string, StopClass>> = {
    end_turn: 'complete',
    stop_sequence: 'complete',
    tool_use: 'complete',
    max_tokens: 'truncated',
    model_context_window_exceeded: 'context_exceeded',
};

const OPENAI_COMPATIBLE: Readonly<Record<string, StopClass>> = {
    stop: 'complete',
    length: 'truncated',
};

const GEMINI: Readonly<Record<string, StopClass>> = {
    STOP: 'complete',
    MAX_TOKENS: 'truncated',
};

function field(obj: unknown, name: string): unknown {
    return obj !== null && typeof obj === 'object' ? (obj as Record<string, unknown>)[name] : undefined;
}

function lookup(table: Readonly<Record<string, StopClass>>, raw: unknown): StopClass {
    return typeof raw === 'string' && Object.prototype.hasOwnProperty.call(table, raw) ? table[raw]! : 'unknown';
}

/** Anthropic Messages API: top-level `stop_reason`. */
export function anthropicStopClass(response: unknown): StopClass {
    return lookup(ANTHROPIC, field(response, 'stop_reason'));
}

/** OpenAI Chat Completions and compatible APIs: `choices[0].finish_reason`. */
export function openAiStopClass(response: unknown): StopClass {
    const choices = field(response, 'choices');
    return lookup(OPENAI_COMPATIBLE, Array.isArray(choices) ? field(choices[0], 'finish_reason') : undefined);
}

/**
 * Gemini generateContent: `candidates[0].finishReason` on the raw REST envelope,
 * or the top-level `finish_reason` that `normaliseGeminiRest` carries it as.
 */
export function geminiStopClass(response: unknown): StopClass {
    const normalised = field(response, 'finish_reason');
    if (typeof normalised === 'string' && normalised !== '') {
        return lookup(GEMINI, normalised);
    }
    const candidates = field(response, 'candidates');
    return lookup(GEMINI, Array.isArray(candidates) ? field(candidates[0], 'finishReason') : undefined);
}

const STOP_CLASSES: ReadonlySet<string> = new Set(['complete', 'truncated', 'context_exceeded', 'unknown']);

/** Read a persisted `stop_class` back; anything that is not one of the four values is dropped. */
export function storedStopClass(raw: unknown): { stop_class?: StopClass } {
    return typeof raw === 'string' && STOP_CLASSES.has(raw) ? { stop_class: raw as StopClass } : {};
}

/**
 * True when the provider says the answer was cut short. Such an answer is an
 * abstention, never a full vote, however well its text parses.
 */
export function isIncompleteStop(stop_class: StopClass | undefined): boolean {
    return stop_class === 'truncated' || stop_class === 'context_exceeded';
}
