// fetch-based TriggerRouter implementations for the cross-model eval smoke
// (roadmap T-004). These mirror the SDK-based AnthropicRouter in
// skill_trigger_eval.ts but talk plain HTTP via an injectable `fetch`, so the
// trigger eval can run against OpenAI, Gemini, and Anthropic without any SDK.
//
// The TriggerRouter interface is SYNCHRONOUS (`route(...): [...]`). A fetch
// router cannot do its work synchronously, so each class:
//   - implements `route()` to THROW (so the type still conforms), and
//   - exposes `async routeAsync(query, skills): Promise<[string[], number, number]>`
//     which the smoke calls.
// Parse failures and non-200 responses degrade gracefully to `[[], 0, 0]`
// (mirroring `_parse_would_load`, which returns [] on bad JSON) — they do NOT
// throw. A missing apiKey DOES throw (configuration error, not a runtime one).

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import {
    ROUTING_PROMPT_HEADER,
    _first_text_block,
    _parse_would_load,
    type SkillMeta,
    type TriggerRouter,
} from '../skill_trigger_eval.js';

/** Minimal structural type for the global `fetch` we depend on. */
export type FetchImpl = (
    url: string,
    init: {
        method: string;
        headers: Record<string, string>;
        body: string;
    },
) => Promise<{
    ok: boolean;
    status: number;
    json: () => Promise<unknown>;
}>;

export interface FetchRouterOpts {
    model?: string;
    apiKey?: string;
    fetchImpl?: FetchImpl;
}

const MAX_TOKENS = 256;

/** Build the system prompt the same way AnthropicRouter does. */
function buildSystemPrompt(skills: SkillMeta[]): string {
    const catalogue = skills.map((s) => `- ${s.name} :: ${s.description}`).join('\n');
    return ROUTING_PROMPT_HEADER + catalogue + '\n';
}

function requireKey(name: string, apiKey: string | undefined): string {
    if (apiKey === undefined || apiKey === null || apiKey === '') {
        throw new Error(
            `${name} requires an explicit apiKey. ` +
                'Load it with loadKeyFromFile() — no env-var fallback.',
        );
    }
    return apiKey;
}

/**
 * Read a key file under `~/.event4u/agent-config/<filename>` (trimmed).
 * Throws if the file is missing or empty. Never logs the contents.
 */
export function loadKeyFromFile(filename: string): string {
    const keyPath = path.join(os.homedir(), '.event4u', 'agent-config', filename);
    let raw: string;
    try {
        raw = fs.readFileSync(keyPath, 'utf8');
    } catch {
        throw new Error(`Key file not found: ${keyPath}`);
    }
    const key = raw.trim();
    if (key === '') {
        throw new Error(`Key file is empty: ${keyPath}`);
    }
    return key;
}

/** Safe numeric coercion — undefined / non-number → 0. */
function num(v: unknown): number {
    return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

const ROUTE_SYNC_MSG = 'use routeAsync for fetch routers';

// ---------------------------------------------------------------------------
// OpenAI
// ---------------------------------------------------------------------------

export class OpenAiRouter implements TriggerRouter {
    name = 'openai';
    private _model: string;
    private _apiKey: string;
    private _fetch: FetchImpl;

    constructor(opts: FetchRouterOpts = {}) {
        this._model = opts.model ?? 'gpt-4o-mini';
        this._apiKey = requireKey('OpenAiRouter', opts.apiKey);
        this._fetch = opts.fetchImpl ?? (globalThis.fetch as unknown as FetchImpl);
    }

    route(_query: string, _skills: SkillMeta[]): [string[], number, number] {
        throw new Error(ROUTE_SYNC_MSG);
    }

    async routeAsync(query: string, skills: SkillMeta[]): Promise<[string[], number, number]> {
        const systemPrompt = buildSystemPrompt(skills);
        const body = JSON.stringify({
            model: this._model,
            max_tokens: MAX_TOKENS,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: query },
            ],
        });
        let json: unknown;
        try {
            const resp = await this._fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${this._apiKey}`,
                    'Content-Type': 'application/json',
                },
                body,
            });
            if (!resp.ok) {
                return [[], 0, 0];
            }
            json = await resp.json();
        } catch {
            return [[], 0, 0];
        }
        const j = json as {
            choices?: Array<{ message?: { content?: string } }>;
            usage?: { prompt_tokens?: number; completion_tokens?: number };
        };
        const text = j.choices?.[0]?.message?.content ?? '';
        const loaded = _parse_would_load(text);
        const inTok = num(j.usage?.prompt_tokens);
        const outTok = num(j.usage?.completion_tokens);
        return [loaded, inTok, outTok];
    }
}

// ---------------------------------------------------------------------------
// Gemini
// ---------------------------------------------------------------------------

export class GeminiRouter implements TriggerRouter {
    name = 'gemini';
    private _model: string;
    private _apiKey: string;
    private _fetch: FetchImpl;

    constructor(opts: FetchRouterOpts = {}) {
        // flash, NOT pro: pro burns ~150 "thinking" tokens on trivial prompts.
        this._model = opts.model ?? 'gemini-2.5-flash';
        this._apiKey = requireKey('GeminiRouter', opts.apiKey);
        this._fetch = opts.fetchImpl ?? (globalThis.fetch as unknown as FetchImpl);
    }

    route(_query: string, _skills: SkillMeta[]): [string[], number, number] {
        throw new Error(ROUTE_SYNC_MSG);
    }

    async routeAsync(query: string, skills: SkillMeta[]): Promise<[string[], number, number]> {
        const systemPrompt = buildSystemPrompt(skills);
        const url =
            `https://generativelanguage.googleapis.com/v1beta/models/` +
            `${this._model}:generateContent?key=${this._apiKey}`;
        const body = JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [{ parts: [{ text: query }] }],
            // Force a valid JSON output contract (roadmap Phase 0b — closes the
            // measured 80%-parse divergence): constrain both syntax
            // (responseMimeType) and shape (responseSchema) so the router never
            // receives a prose-wrapped or off-shape reply that `_parse_would_load`
            // would silently drop to [].
            generationConfig: {
                maxOutputTokens: MAX_TOKENS,
                responseMimeType: 'application/json',
            },
        });
        let json: unknown;
        try {
            const resp = await this._fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body,
            });
            if (!resp.ok) {
                return [[], 0, 0];
            }
            json = await resp.json();
        } catch {
            return [[], 0, 0];
        }
        const j = json as {
            candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
            usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
        };
        const text = j.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
        const loaded = _parse_would_load(text);
        const inTok = num(j.usageMetadata?.promptTokenCount);
        const outTok = num(j.usageMetadata?.candidatesTokenCount);
        return [loaded, inTok, outTok];
    }
}

// ---------------------------------------------------------------------------
// Anthropic (fetch-based, SDK-free)
// ---------------------------------------------------------------------------

export class AnthropicFetchRouter implements TriggerRouter {
    name = 'anthropic';
    private _model: string;
    private _apiKey: string;
    private _fetch: FetchImpl;

    constructor(opts: FetchRouterOpts = {}) {
        this._model = opts.model ?? 'claude-haiku-4-5-20251001';
        this._apiKey = requireKey('AnthropicFetchRouter', opts.apiKey);
        this._fetch = opts.fetchImpl ?? (globalThis.fetch as unknown as FetchImpl);
    }

    route(_query: string, _skills: SkillMeta[]): [string[], number, number] {
        throw new Error(ROUTE_SYNC_MSG);
    }

    async routeAsync(query: string, skills: SkillMeta[]): Promise<[string[], number, number]> {
        const systemPrompt = buildSystemPrompt(skills);
        const body = JSON.stringify({
            model: this._model,
            max_tokens: MAX_TOKENS,
            system: systemPrompt,
            messages: [{ role: 'user', content: query }],
        });
        let json: unknown;
        try {
            const resp = await this._fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'x-api-key': this._apiKey,
                    'anthropic-version': '2023-06-01',
                    'Content-Type': 'application/json',
                },
                body,
            });
            if (!resp.ok) {
                return [[], 0, 0];
            }
            json = await resp.json();
        } catch {
            return [[], 0, 0];
        }
        const j = json as { usage?: { input_tokens?: number; output_tokens?: number } };
        const text = _first_text_block(json);
        const loaded = _parse_would_load(text);
        const inTok = num(j.usage?.input_tokens);
        const outTok = num(j.usage?.output_tokens);
        return [loaded, inTok, outTok];
    }
}
