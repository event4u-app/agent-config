/**
 * The council's synchronous HTTP transport, and the per-provider shims that
 * turn it into the SDK-shaped callables `clients.ts::ask()` reads.
 *
 * Extracted from `clients.ts` (road-to-admissible-council-seats 1.1). Two
 * reasons, and only the first is about tidiness:
 *
 * 1. `clients.ts` is ~1,370 lines past the 1,500-line ceiling
 *    `check_source_size_budget` ratchets, so every line added there costs one
 *    excess line. The three shims below are new code; putting them in a file
 *    UNDER the ceiling is what lets 1.1 land without raising a baseline.
 * 2. Before 1.1 exactly one provider (OpenAI) had a live transport and the
 *    other four constructors threw `… package not installed. pip install …`
 *    after the api-key check — so `mode: api` was dead for gemini, xai and
 *    perplexity. A shared shim module is the honest home for "how this
 *    package actually reaches a provider over HTTP", rather than four
 *    copies of the same curl call inside four constructors.
 *
 * The injectable seam. Every shim takes a `JsonPost` rather than calling `curlJsonPost` directly.
 * A test can then construct a REAL client with a REAL api_key — exercising
 * the shim-building path a mock `client:` object skips entirely — and still
 * make no network call. That is the difference between testing the transport
 * and testing around it.
 */

import { spawnSync } from 'node:child_process';

/** The one network primitive. Swappable so tests never reach the network. */
export type JsonPost = (url: string, extraHeaders: string[], body: unknown) => unknown;

export const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

/**
 * Synchronous JSON POST via `curl` (no Node SDK, no Python). Matches the
 * council's `spawnSync` transport model so the live-call clients stay
 * synchronous. Returns the parsed response JSON (the provider HTTP APIs return
 * exactly the SDK response shape `ask()` reads). Throws on transport failure or
 * a non-2xx status so `ask()`'s catch surfaces it as a member error.
 */
export function curlJsonPost(url: string, extraHeaders: string[], body: unknown): unknown {
    const args = ['-sS', '-X', 'POST', url, '-H', 'content-type: application/json'];
    for (const h of extraHeaders) {
        args.push('-H', h);
    }
    // `--connect-timeout` fast-fails a dead host; `--max-time` lets curl abort
    // itself cleanly (surfacing a real `curl exited` error with stderr) ~10s
    // before the `spawnSync` timeout would kill it with an opaque ETIMEDOUT.
    // A full 16k-token generation legitimately runs several minutes, so the
    // ceiling is 300s, not 120s (the old value timed out long Anthropic calls).
    args.push('--connect-timeout', '30', '--max-time', '290');
    args.push('-w', '\n%{http_code}', '--data-binary', '@-');
    const r = spawnSync('curl', args, {
        input: JSON.stringify(body),
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
        timeout: 300_000,
    });
    if (r.error) {
        throw new Error(`curl spawn failed: ${(r.error as Error).message}`);
    }
    if (r.status !== 0) {
        throw new Error(
            `curl exited ${r.status ?? 'null'}: ${(r.stderr ?? '').toString().slice(0, 500)}`,
        );
    }
    const out = (r.stdout ?? '').toString();
    const nl = out.lastIndexOf('\n');
    const httpCode = (nl >= 0 ? out.slice(nl + 1) : out).trim();
    const bodyText = nl >= 0 ? out.slice(0, nl) : out;
    if (!/^2\d\d$/.test(httpCode)) {
        throw new Error(`HTTP ${httpCode}: ${bodyText.slice(0, 500)}`);
    }
    return JSON.parse(bodyText);
}

/**
 * `chat.completions.create` over any OpenAI-compatible `/v1/chat/completions`.
 * Used by OpenAI itself and by the two OpenAI-compatible vendors (xAI,
 * Perplexity), whose only difference is the base URL.
 *
 * `baseUrl` is passed rather than read off `this.base_url`: a subclass field
 * initializer (`override base_url = XAI_BASE_URL`) runs AFTER the base
 * constructor, so reading the field during construction would silently build
 * every compatible client against the empty string.
 */
export function openAiCompatibleClient(
    baseUrl: string,
    apiKey: string,
    post: JsonPost = curlJsonPost,
): unknown {
    const url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
    return {
        chat: {
            completions: {
                create: (kwargs: Record<string, unknown>): unknown =>
                    post(url, [`authorization: Bearer ${apiKey}`], kwargs),
            },
        },
    };
}

/**
 * `models.generate_content` over the Gemini REST API, normalised to the
 * `google-genai` SDK response shape `GeminiClient.ask()` reads.
 *
 * The normalisation is the whole point and is not cosmetic: REST answers with
 * `candidates[0].content.parts[*].text` and `usageMetadata.promptTokenCount`,
 * while `ask()` reads `.text`, `.model_version` and
 * `.usage_metadata.{prompt_token_count, candidates_token_count}`. Rewriting
 * `ask()` to read REST instead would break every injected SDK-shaped mock in
 * the existing tests, so the adapter lives here, at the transport boundary,
 * where a shape mismatch is a transport concern.
 */
export function geminiRestClient(
    apiKey: string,
    post: JsonPost = curlJsonPost,
    baseUrl: string = GEMINI_BASE_URL,
): unknown {
    return {
        models: {
            generate_content: (kwargs: Record<string, unknown>): unknown => {
                const model = String(kwargs['model'] ?? '');
                const cfg = (kwargs['config'] ?? {}) as Record<string, unknown>;
                const url = `${baseUrl.replace(/\/+$/, '')}/models/${model}:generateContent`;
                const raw = post(
                    url,
                    [`x-goog-api-key: ${apiKey}`],
                    {
                        contents: [{ role: 'user', parts: [{ text: String(kwargs['contents'] ?? '') }] }],
                        generationConfig: { maxOutputTokens: cfg['max_output_tokens'] ?? null },
                    },
                );
                return normaliseGeminiRest(raw);
            },
        },
    };
}

/** REST envelope → the `google-genai` SDK response shape. Exported for tests. */
export function normaliseGeminiRest(raw: unknown): {
    text: string;
    model_version: string;
    usage_metadata: { prompt_token_count: number; candidates_token_count: number };
} {
    const env = (raw ?? {}) as Record<string, unknown>;
    const candidates = Array.isArray(env['candidates']) ? (env['candidates'] as unknown[]) : [];
    const first = (candidates[0] ?? {}) as Record<string, unknown>;
    const content = (first['content'] ?? {}) as Record<string, unknown>;
    const parts = Array.isArray(content['parts']) ? (content['parts'] as unknown[]) : [];
    const text = parts
        .map((p) => String(((p ?? {}) as Record<string, unknown>)['text'] ?? ''))
        .join('');
    const usage = (env['usageMetadata'] ?? {}) as Record<string, unknown>;
    const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
    return {
        text,
        model_version: String(env['modelVersion'] ?? ''),
        usage_metadata: {
            prompt_token_count: num(usage['promptTokenCount']),
            candidates_token_count: num(usage['candidatesTokenCount']),
        },
    };
}
