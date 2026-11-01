// The normalised per-member answer, split out of `clients.ts` (which sits far
// past `check_source_size_budget`'s ceiling) when it gained `stop_class`.
// `clients.ts` re-exports it, so every existing importer is untouched.
import type { StopClass } from './stop_class.js';

/** Normalised output from a single council member (dataclass `CouncilResponse`). */
export class CouncilResponse {
    provider: string;
    model: string;
    // The model id the provider reported serving, when it reports one. NEVER
    // overwrites `model`: that is the REQUESTED id, and it is what the tier
    // decision was made against — keeping both is what makes a silent alias or
    // provider substitution detectable at all. Attribution-only; no consumer
    // may route on it. Defaults to '' (the honest value for a transport that
    // reports no served id, e.g. every CLI client) so existing callers and the
    // persisted response JSON stay backward-compatible.
    model_served: string;
    text: string;
    /** Pre-rewrite reply; `null` when nothing rewrote `text`. See inline_findings.ts. */
    raw_text: string | null;
    input_tokens: number;
    output_tokens: number;
    // Prompt-cache accounting (Anthropic). `cache_read_input_tokens` bill at
    // ~0.1× input; `cache_creation_input_tokens` at 1.25×/2×. Both default 0
    // (no cache, or a provider that does not report them) so existing callers
    // and the persisted response JSON stay backward-compatible.
    cache_creation_input_tokens: number;
    cache_read_input_tokens: number;
    latency_ms: number;
    error: string | null;
    metadata: Record<string, unknown>;
    // Why the provider stopped generating (see `stop_class.ts`). OPTIONAL and
    // left unset rather than defaulted: absent means `unknown`, and an unset
    // key keeps every existing exact-shape assertion and persisted record
    // unchanged for the transports (every CLI seat) that report no stop reason.
    declare stop_class?: StopClass;

    constructor(opts: {
        provider: string;
        model: string;
        model_served?: string;
        text: string;
        raw_text?: string | null;
        input_tokens?: number;
        output_tokens?: number;
        cache_creation_input_tokens?: number;
        cache_read_input_tokens?: number;
        latency_ms?: number;
        error?: string | null;
        metadata?: Record<string, unknown>;
        stop_class?: StopClass;
    }) {
        this.provider = opts.provider;
        this.model = opts.model;
        this.model_served = opts.model_served ?? '';
        this.text = opts.text;
        this.raw_text = opts.raw_text ?? null;
        this.input_tokens = opts.input_tokens ?? 0;
        this.output_tokens = opts.output_tokens ?? 0;
        this.cache_creation_input_tokens = opts.cache_creation_input_tokens ?? 0;
        this.cache_read_input_tokens = opts.cache_read_input_tokens ?? 0;
        this.latency_ms = opts.latency_ms ?? 0;
        this.error = opts.error ?? null;
        // Python dataclass uses `field(default_factory=dict)` — each instance
        // gets its own fresh dict.
        this.metadata = opts.metadata ?? {};
        if (opts.stop_class !== undefined) {
            this.stop_class = opts.stop_class;
        }
    }
}
