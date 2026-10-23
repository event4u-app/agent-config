/**
 * The `chat/completions` client for a `base_url` route. Separate from
 * `free_route.ts` so the config loader, which sits in the hook bundle, does not
 * pull the client layer in.
 */

import { curlJsonPost, type JsonPost } from './api_transport.js';
import { CouncilResponse, ExternalAIClient } from './clients.js';
import type { ContentClass } from './content_ceiling.js';
import { familyOf, servedMatches, type RouteBilling } from './free_route.js';
import { policyExclusionReason, type PolicyExclusion } from './seat_policy.js';

export interface FreeRouteClientOptions {
    readonly name: string;
    readonly model: string;
    readonly base_url: string;
    readonly api_key: string | null;
    readonly billing: RouteBilling;
    readonly content_ceiling: ContentClass;
    readonly post?: JsonPost;
}

/**
 * `chat/completions` against a route. Distinct from `_OpenAICompatibleClient`
 * because a keyless route must send no Authorization header at all, and
 * because its answer is only kept when the served model is the requested one.
 * Paid provider clients keep `model_served` as attribution only.
 */
export class FreeRouteClient extends ExternalAIClient {
    readonly base_url: string;
    readonly billing: RouteBilling;
    readonly content_ceiling: ContentClass;
    private readonly _apiKey: string | null;
    private readonly _post: JsonPost;

    constructor(opts: FreeRouteClientOptions) {
        super();
        this.name = opts.name;
        this.model = opts.model;
        this.base_url = opts.base_url.replace(/\/+$/, '');
        this.billing = opts.billing;
        this.content_ceiling = opts.content_ceiling;
        this.billable = opts.billing === 'per-token';
        this._apiKey = opts.api_key;
        this._post = opts.post ?? curlJsonPost;
    }

    private _refused(exclusion: PolicyExclusion, detail: string, latency_ms: number, served = ''): CouncilResponse {
        return new CouncilResponse({
            provider: this.name,
            model: this.model,
            model_served: served,
            text: '',
            latency_ms,
            error: `${exclusion}: ${policyExclusionReason(exclusion, this.name)} — ${detail}`,
            metadata: { absent_reason: exclusion, billing: this.billing, route: this.base_url },
        });
    }

    override ask(system_prompt: string, user_prompt: string, max_tokens = 2048): CouncilResponse {
        const t0 = performance.now();
        const headers = this._apiKey === null ? [] : [`authorization: Bearer ${this._apiKey}`];
        let response: Record<string, unknown>;
        try {
            response = (this._post(`${this.base_url}/chat/completions`, headers, {
                model: this.model,
                max_tokens,
                messages: [
                    { role: 'system', content: system_prompt },
                    { role: 'user', content: user_prompt },
                ],
            }) ?? {}) as Record<string, unknown>;
        } catch (exc) {
            const msg = exc instanceof Error ? exc.message : String(exc);
            const ms = Math.trunc(performance.now() - t0);
            if (/^HTTP 402\b/.test(msg)) return this._refused('policy_unproven_cost', 'the route answered 402; no paid fallback is tried', ms);
            return new CouncilResponse({ provider: this.name, model: this.model, text: '', latency_ms: ms, error: msg });
        }
        const ms = Math.trunc(performance.now() - t0);
        const served = typeof response['model'] === 'string' ? response['model'] : '';
        if (!servedMatches(this.model, served)) {
            return this._refused('policy_model_mismatch', `requested ${this.model}, served ${served || '(none reported)'}`, ms, served);
        }
        const choices = Array.isArray(response['choices']) ? (response['choices'] as Record<string, unknown>[]) : [];
        const message = (choices[0]?.['message'] ?? {}) as Record<string, unknown>;
        const usage = (response['usage'] ?? {}) as Record<string, unknown>;
        const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
        return new CouncilResponse({
            provider: this.name,
            model: this.model,
            model_served: served,
            text: typeof message['content'] === 'string' ? message['content'] : '',
            input_tokens: num(usage['prompt_tokens']),
            output_tokens: num(usage['completion_tokens']),
            latency_ms: ms,
            metadata: { family: familyOf(served), billing: this.billing, route: this.base_url, billable: this.billable },
        });
    }
}
