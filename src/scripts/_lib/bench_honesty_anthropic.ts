// egress-content: fixed-corpus — sends only the committed honesty-bench corpora, the arm surfaces built from src/rules/ and internal/bench/corpora/honesty-arms/, and the model's own earlier replies
/**
 * The billable provider for the honesty bench (road-to-a-challenge-the-bench-has-measured
 * Phase 2): one Anthropic Messages API call per turn, with the model, the
 * temperature and the token cap pinned for the whole run.
 *
 * The system prompt and the newest message carry `cache_control`, so a
 * multi-turn ladder re-reads its earlier turns from the prompt cache instead
 * of paying full input price for them on every turn. Usage is returned per
 * call, cache reads and writes included, so the run can price what it spent
 * rather than what it estimated.
 *
 * The key is read when the first call is made, never at import, so a dry run
 * and the tests never touch a credential.
 */
import { load_anthropic_key } from '../ai_council/clients.js';

export const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
export const ANTHROPIC_API_VERSION = '2023-06-01';

export interface BenchMessage {
    role: string;
    content: string;
}

export interface BenchCallUsage {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens: number;
    cache_read_input_tokens: number;
}

export interface BenchCallResult {
    text: string;
    served_model: string;
    usage: BenchCallUsage;
}

export interface AnthropicBenchOptions {
    model: string;
    temperature: number;
    maxTokens: number;
    /** Attempts per call on 429 / 5xx / overloaded before the run fails. */
    maxAttempts?: number;
    keyPath?: string | null;
    fetchImpl?: typeof fetch;
    sleep?: (ms: number) => Promise<void>;
}

interface ApiResponse {
    model?: string;
    content?: Array<{ type?: string; text?: string }>;
    usage?: Partial<BenchCallUsage>;
}

/** The request body for one call. Exported so a test can pin its shape without a network. */
export function buildBody(opts: AnthropicBenchOptions, system: string, messages: readonly BenchMessage[]): Record<string, unknown> {
    const last = messages.length - 1;
    return {
        model: opts.model,
        max_tokens: opts.maxTokens,
        temperature: opts.temperature,
        ...(system === '' ? {} : { system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }] }),
        messages: messages.map((m, i) => ({
            role: m.role,
            content: [{ type: 'text', text: m.content, ...(i === last ? { cache_control: { type: 'ephemeral' } } : {}) }],
        })),
    };
}

function retryable(status: number): boolean {
    return status === 429 || status === 408 || status >= 500;
}

export class AnthropicBenchClient {
    private key: string | null = null;
    private readonly _fetch: typeof fetch;
    private readonly sleep: (ms: number) => Promise<void>;

    constructor(private readonly opts: AnthropicBenchOptions) {
        this._fetch = opts.fetchImpl ?? fetch;
        this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    }

    async complete(system: string, messages: readonly BenchMessage[]): Promise<BenchCallResult> {
        this.key ??= load_anthropic_key(this.opts.keyPath ?? null);
        const body = JSON.stringify(buildBody(this.opts, system, messages));
        const attempts = this.opts.maxAttempts ?? 6;
        let lastError = '';
        for (let attempt = 1; attempt <= attempts; attempt += 1) {
            const resp = await this._fetch(ANTHROPIC_MESSAGES_URL, {
                method: 'POST',
                headers: { 'x-api-key': this.key, 'anthropic-version': ANTHROPIC_API_VERSION, 'content-type': 'application/json' },
                body,
            });
            if (resp.ok) {
                const data = (await resp.json()) as ApiResponse;
                const text = (data.content ?? []).filter((b) => b.type === 'text').map((b) => b.text ?? '').join('');
                const u = data.usage ?? {};
                return {
                    text,
                    served_model: data.model ?? this.opts.model,
                    usage: {
                        input_tokens: u.input_tokens ?? 0,
                        output_tokens: u.output_tokens ?? 0,
                        cache_creation_input_tokens: u.cache_creation_input_tokens ?? 0,
                        cache_read_input_tokens: u.cache_read_input_tokens ?? 0,
                    },
                };
            }
            lastError = `HTTP ${String(resp.status)}: ${(await resp.text()).slice(0, 300)}`;
            if (!retryable(resp.status) || attempt === attempts) break;
            await this.sleep(Math.min(60_000, 2_000 * 2 ** (attempt - 1)));
        }
        throw new Error(`bench_honesty_anthropic: ${this.opts.model} failed: ${lastError}`);
    }
}
