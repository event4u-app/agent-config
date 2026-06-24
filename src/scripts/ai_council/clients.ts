// External-AI clients for the council — byte-identical TypeScript twin of
// `src/scripts/ai_council/clients.py` (py2ts migration, ADR-200).
//
// Mirrors the contract from `scripts/skill_trigger_eval.py`:
// - Tokens come exclusively from `~/.event4u/agent-config/<provider>.key`
//   (legacy `~/.config/agent-config/<provider>.key` is read as a fallback so
//   pre-2.4 installs keep working until the user moves the files into the new
//   namespace).
// - File mode must be exactly 0o600. Drift is a hard abort.
// - No environment-variable fallback. No keychain fallback.
// - Real SDKs (`anthropic`, `openai`) are *soft* dependencies — the module
//   imports cleanly without them; only `ask()` requires them.
//
// Tests inject mock clients via the `client=` constructor argument and never
// hit the real API.
//
// Mode contract:
// - `billable=true` clients (AnthropicClient, OpenAIClient, GeminiClient,
//   XAIClient, PerplexityClient) participate in the cost gate — projected USD
//   spend is checked before each call.
// - `billable=false` clients (ManualClient, vendor-official CliClient
//   subclasses — AnthropicCliClient, OpenAICliClient, GeminiCliClient) skip the
//   USD cost gate entirely. Spend = $0 to us; provider-side limits are the
//   user's concern.
// - `billable=true` CLI subclasses (XAICliClient, PerplexityCliClient) wrap
//   community-maintained CLIs that consume the same API key as their `api`
//   counterparts — they participate in the USD cost gate. `mode: cli` here is
//   an ergonomic shortcut, not a billing change.
//
// CLI subclasses additionally consult the optional
// `cli_call_budget.max_calls_per_day.<provider>` quota with state persisted at
// `~/.event4u/agent-config/cli-calls.json` (daily UTC reset).
//
// TRANSPORT SEAM (TS-only, for tests): the Python original calls
// `subprocess.run` directly inside `CliClient.ask`. The twin routes that one
// call through the protected `_runSubprocess(cmd, stdinPayload)` instance
// method so a test subclass can stub the transport without live processes —
// it returns `{ returncode, stdout, stderr }` or throws a `SubprocessError`
// shaped like the Python exceptions (`timeout` / `file_not_found` / `os`).
// The default implementation shells out via `spawnSync`, matching
// `subprocess.run(..., capture_output=True, text=True, timeout=..., check=False)`.

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

import * as user_global_paths from '../_lib/user_global_paths.js';
import { appendEvent } from './events_log.js';

export const ANTHROPIC_KEY_FILENAME = 'anthropic.key';
export const OPENAI_KEY_FILENAME = 'openai.key';

// Canonical write target under the new namespace. Reads route via
// `_resolveKeyPath` so a key still sitting in the legacy
// `~/.config/agent-config/` tree keeps working.
export const ANTHROPIC_KEY_PATH = user_global_paths.write_target(ANTHROPIC_KEY_FILENAME);
export const OPENAI_KEY_PATH = user_global_paths.write_target(OPENAI_KEY_FILENAME);

/** Return the active key path, preferring the new namespace. */
function _resolveKeyPath(filename: string): string {
    const found = user_global_paths.resolve_with_fallback(filename);
    if (found !== null) {
        return found;
    }
    return user_global_paths.write_target(filename);
}

export const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-4-5';
export const DEFAULT_OPENAI_MODEL = 'gpt-4o';
export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-pro';
export const DEFAULT_XAI_MODEL = 'grok-4';
export const DEFAULT_PERPLEXITY_MODEL = 'sonar-pro';

// OpenAI-API-compatible endpoints. xAI and Perplexity both expose the
// `/v1/chat/completions` shape, so their clients reuse the `openai` SDK with a
// custom `base_url`. Gemini has its own SDK (`google-genai`).
export const XAI_BASE_URL = 'https://api.x.ai/v1';
export const PERPLEXITY_BASE_URL = 'https://api.perplexity.ai';

// Per-call output budget when no caller-supplied value reaches `ask()`. The CLI
// resolves the live default from `ai_council.max_output_tokens` in
// `.agent-settings.yml`; this constant is only the abstract-base / direct-API
// fallback when nothing else is wired up.
export const DEFAULT_MAX_TOKENS = 2048;

// Expansion target when the user sets `max_output_tokens: 0` ("unlimited") in
// settings. Anthropic requires `max_tokens` to be a positive integer, so 0 is
// widened to this safe ceiling before the SDK call. Big enough for current
// frontier models (Sonnet/GPT-4o headroom ≥ 16k); raise explicitly in settings
// if a larger budget is genuinely needed.
export const UNLIMITED_TOKENS_FALLBACK = 16384;

// OpenAI reasoning models (o1, o3, o4 families) reject `max_tokens` and the
// `system` role; they require `max_completion_tokens` and accept only `user`
// (and `developer`) messages.
const _REASONING_PREFIXES: readonly string[] = ['o1', 'o3', 'o4'];

export function _is_reasoning_model(model: string): boolean {
    const name = model.toLowerCase();
    return _REASONING_PREFIXES.some((p) => name === p || name.startsWith(`${p}-`));
}

/** Raised when a provider key file violates the 0600 contract. */
export class KeyGateError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'KeyGateError';
    }
}

/** Raised when a CLI member cannot be constructed (binary missing, etc.). */
export class CliClientError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'CliClientError';
    }
}

/** Normalised output from a single council member (dataclass `CouncilResponse`). */
export class CouncilResponse {
    provider: string;
    model: string;
    text: string;
    input_tokens: number;
    output_tokens: number;
    latency_ms: number;
    error: string | null;
    metadata: Record<string, unknown>;

    constructor(opts: {
        provider: string;
        model: string;
        text: string;
        input_tokens?: number;
        output_tokens?: number;
        latency_ms?: number;
        error?: string | null;
        metadata?: Record<string, unknown>;
    }) {
        this.provider = opts.provider;
        this.model = opts.model;
        this.text = opts.text;
        this.input_tokens = opts.input_tokens ?? 0;
        this.output_tokens = opts.output_tokens ?? 0;
        this.latency_ms = opts.latency_ms ?? 0;
        this.error = opts.error ?? null;
        // Python dataclass uses `field(default_factory=dict)` — each instance
        // gets its own fresh dict.
        this.metadata = opts.metadata ?? {};
    }
}

// ── monotonic clock seam ──────────────────────────────────────────────
// Python uses `time.monotonic()`. latency_ms is non-deterministic; tests
// normalise it. Exposed so tests can pin it if they choose.
let _monotonicSource: () => number = () => {
    // performance.now() is monotonic milliseconds; the Python original is
    // seconds, but we only ever compute `int((now - t0) * 1000)`, so feeding
    // milliseconds here and dropping the *1000 keeps the same arithmetic.
    return performance.now();
};

function _nowMs(): number {
    return _monotonicSource();
}

function _elapsedMs(t0: number): number {
    // Mirrors Python `int((time.monotonic() - t0) * 1000)` — here both sides are
    // already in ms, so just truncate toward zero.
    return Math.trunc(_nowMs() - t0);
}

/** Test seam: override the monotonic clock (ms). Returns the previous source. */
export function _setMonotonicSource(fn: () => number): () => number {
    const prev = _monotonicSource;
    _monotonicSource = fn;
    return prev;
}

/** Shared 0600-gated key loader. Refuses anything outside the contract. */
function _loadKey(p: string, prefix: string, installScript: string): string {
    if (!fs.existsSync(p)) {
        throw new KeyGateError(
            `Key not found at ${p}.\n` + `    Install it with: bash ${installScript}`,
        );
    }
    const st = fs.statSync(p);
    const mode = st.mode & 0o777;
    if (mode !== 0o600) {
        throw new KeyGateError(
            `Unsafe permissions on ${p}: got ${_octRepr(mode)}, expected 0o600.\n` +
                `    Fix:  chmod 600 ${p}`,
        );
    }
    const key = fs.readFileSync(p, { encoding: 'utf-8' }).trim();
    if (!key) {
        throw new KeyGateError(`${p} is empty.`);
    }
    if (!key.startsWith(prefix)) {
        throw new KeyGateError(`${p} does not look like a ${_pyRepr(prefix)}-prefixed key.`);
    }
    return key;
}

export function load_anthropic_key(p: string | null = null): string {
    const resolved = p !== null ? p : _resolveKeyPath(ANTHROPIC_KEY_FILENAME);
    return _loadKey(resolved, 'sk-ant-', 'src/scripts/install_anthropic_key.sh');
}

export function load_openai_key(p: string | null = null): string {
    const resolved = p !== null ? p : _resolveKeyPath(OPENAI_KEY_FILENAME);
    return _loadKey(resolved, 'sk-', 'src/scripts/install_openai_key.sh');
}

// ── attribute-access helpers (mirror Python getattr) ──────────────────

/**
 * Mirror Python `getattr(obj, name, default)` over the duck-typed mock /
 * SDK-response objects the clients consume. Returns the attribute value, or
 * `fallback` when the attribute is absent / object is null. Methods are
 * returned bound so they can be invoked by the caller.
 */
function _getattr(obj: unknown, name: string, fallback: unknown): unknown {
    if (obj === null || obj === undefined) {
        return fallback;
    }
    if (typeof obj === 'object' || typeof obj === 'function') {
        const rec = obj as Record<string, unknown>;
        if (name in rec) {
            return rec[name];
        }
        // Walk the prototype chain for class-instance shaped mocks.
        const val = (obj as Record<string, unknown>)[name];
        if (val !== undefined) {
            return val;
        }
    }
    return fallback;
}

/** Abstract base for council members. */
export abstract class ExternalAIClient {
    name = '';
    model = '';
    billable = true; // API-mode subclasses spend money; manual doesn't.
    transport = 'api'; // "api" | "cli" | "manual" — surfaced in session manifest.
    subscription_label = ''; // vendor-CLI label (e.g. "claude") for non-billable transports.

    /**
     * Send one independent query. Must never raise on network/API failure —
     * return a `CouncilResponse` with `error` set instead. Other members should
     * not be blocked by one failure.
     */
    abstract ask(
        system_prompt: string,
        user_prompt: string,
        max_tokens?: number,
    ): CouncilResponse;
}

/** Shared ctor-options shape for the API clients. */
interface ApiClientOptions {
    model?: string | undefined;
    client?: unknown;
    api_key?: string | null | undefined;
}

/** Shared ctor-options shape for the CLI clients. */
interface CliClientOptions {
    model?: string | undefined;
    binary?: string | null | undefined;
    timeout_seconds?: number | undefined;
    max_calls_per_day?: number | null | undefined;
    warn_at?: number | undefined;
    cli_calls_path?: string | null | undefined;
}

/**
 * Synchronous JSON POST via `curl` (no Node SDK, no Python). Matches the
 * council's `spawnSync` transport model so the live-call clients stay
 * synchronous. Returns the parsed response JSON (the provider HTTP APIs return
 * exactly the SDK response shape `ask()` reads). Throws on transport failure or
 * a non-2xx status so `ask()`'s catch surfaces it as a member error.
 */
function _curlJsonPost(url: string, extraHeaders: string[], body: unknown): unknown {
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
        throw new Error(`curl exited ${r.status ?? 'null'}: ${(r.stderr ?? '').toString().slice(0, 500)}`);
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

export class AnthropicClient extends ExternalAIClient {
    override name = 'anthropic';
    override billable = true;
    private _client: unknown;

    constructor(opts: ApiClientOptions = {}) {
        super();
        this.model = opts.model ?? DEFAULT_ANTHROPIC_MODEL;
        if (opts.client !== undefined && opts.client !== null) {
            this._client = opts.client;
            return;
        }
        const api_key = opts.api_key ?? null;
        if (api_key === null) {
            throw new Error(
                'AnthropicClient requires explicit api_key or injected client. ' +
                    'Use load_anthropic_key() — no env-var fallback.',
            );
        }
        // Live transport: curl → Anthropic Messages API (synchronous, no Node
        // SDK, no Python). The HTTP response is the same shape `ask()` reads
        // (`content[0].text`, `usage.{input_tokens,output_tokens}`). Tests still
        // inject a mock `client` above and never reach this path.
        this._client = {
            messages: {
                create: (kwargs: Record<string, unknown>): unknown =>
                    _curlJsonPost(
                        'https://api.anthropic.com/v1/messages',
                        [`x-api-key: ${api_key}`, 'anthropic-version: 2023-06-01'],
                        kwargs,
                    ),
            },
        };
    }

    override ask(
        system_prompt: string,
        user_prompt: string,
        max_tokens: number = DEFAULT_MAX_TOKENS,
    ): CouncilResponse {
        const t0 = _nowMs();
        let response: unknown;
        try {
            const messages = _getattr(this._client, 'messages', null);
            const create = _getattr(messages, 'create', null) as
                | ((kwargs: Record<string, unknown>) => unknown)
                | null;
            if (typeof create !== 'function') {
                throw new TypeError("'messages.create' is not callable");
            }
            response = create.call(messages, {
                model: this.model,
                max_tokens,
                system: system_prompt,
                messages: [{ role: 'user', content: user_prompt }],
            });
        } catch (exc) {
            return new CouncilResponse({
                provider: this.name,
                model: this.model,
                text: '',
                latency_ms: _elapsedMs(t0),
                error: _excString(exc),
            });
        }
        const latency_ms = _elapsedMs(t0);
        let text = '';
        const content = _getattr(response, 'content', null);
        if (_pyTruthy(content)) {
            const first = (content as unknown[])[0];
            text = (_getattr(first, 'text', '') as string) || '';
        }
        const usage = _getattr(response, 'usage', null);
        return new CouncilResponse({
            provider: this.name,
            model: this.model,
            text,
            input_tokens: usage ? (_getattr(usage, 'input_tokens', 0) as number) : 0,
            output_tokens: usage ? (_getattr(usage, 'output_tokens', 0) as number) : 0,
            latency_ms,
        });
    }
}

export class OpenAIClient extends ExternalAIClient {
    override name = 'openai';
    override billable = true;
    private _client: unknown;

    constructor(opts: ApiClientOptions = {}) {
        super();
        this.model = opts.model ?? DEFAULT_OPENAI_MODEL;
        if (opts.client !== undefined && opts.client !== null) {
            this._client = opts.client;
            return;
        }
        const api_key = opts.api_key ?? null;
        if (api_key === null) {
            throw new Error(
                'OpenAIClient requires explicit api_key or injected client. ' +
                    'Use load_openai_key() — no env-var fallback.',
            );
        }
        // Live transport: curl → OpenAI Chat Completions API (synchronous, no
        // Node SDK, no Python). The HTTP response is the same shape `ask()`
        // reads (`choices[0].message.content`, `usage.{prompt_tokens,
        // completion_tokens}`). Tests still inject a mock `client` above.
        this._client = {
            chat: {
                completions: {
                    create: (kwargs: Record<string, unknown>): unknown =>
                        _curlJsonPost(
                            'https://api.openai.com/v1/chat/completions',
                            [`authorization: Bearer ${api_key}`],
                            kwargs,
                        ),
                },
            },
        };
    }

    override ask(
        system_prompt: string,
        user_prompt: string,
        max_tokens: number = DEFAULT_MAX_TOKENS,
    ): CouncilResponse {
        const t0 = _nowMs();
        const kwargs: Record<string, unknown> = { model: this.model };
        if (_is_reasoning_model(this.model)) {
            // o1/o3/o4 reasoning models reject `max_tokens` and `system` role.
            kwargs['max_completion_tokens'] = max_tokens;
            kwargs['messages'] = [
                { role: 'user', content: `${system_prompt}\n\n---\n\n${user_prompt}` },
            ];
        } else {
            kwargs['max_tokens'] = max_tokens;
            kwargs['messages'] = [
                { role: 'system', content: system_prompt },
                { role: 'user', content: user_prompt },
            ];
        }
        let response: unknown;
        try {
            const chat = _getattr(this._client, 'chat', null);
            const completions = _getattr(chat, 'completions', null);
            const create = _getattr(completions, 'create', null) as
                | ((kwargs: Record<string, unknown>) => unknown)
                | null;
            if (typeof create !== 'function') {
                throw new TypeError("'chat.completions.create' is not callable");
            }
            response = create.call(completions, kwargs);
        } catch (exc) {
            return new CouncilResponse({
                provider: this.name,
                model: this.model,
                text: '',
                latency_ms: _elapsedMs(t0),
                error: _excString(exc),
            });
        }
        const latency_ms = _elapsedMs(t0);
        let text: unknown = '';
        const choices = _getattr(response, 'choices', null);
        if (_pyTruthy(choices)) {
            const first = (choices as unknown[])[0];
            const msg = _getattr(first, 'message', null);
            text = msg ? _getattr(msg, 'content', '') : '';
        }
        const usage = _getattr(response, 'usage', null);
        return new CouncilResponse({
            provider: this.name,
            model: this.model,
            text: (text as string) || '',
            input_tokens: usage ? (_getattr(usage, 'prompt_tokens', 0) as number) : 0,
            output_tokens: usage ? (_getattr(usage, 'completion_tokens', 0) as number) : 0,
            latency_ms,
        });
    }
}

// ── Gemini / xAI / Perplexity (Phase 0 — Step 6) ─────────────────────

/**
 * Google Gemini via the `google-genai` SDK.
 *
 * Lazy-imports `google.genai` on first `ask()` so disabled members do not
 * require the SDK to be installed. Tests inject a mock client shaped like
 * `genai.Client(api_key=...)` — `self._client.models.generate_content(...)`
 * returns an object with `.text` and
 * `.usage_metadata.{prompt_token_count, candidates_token_count}`.
 */
export class GeminiClient extends ExternalAIClient {
    override name = 'gemini';
    override billable = true;
    private _client: unknown;

    constructor(opts: ApiClientOptions = {}) {
        super();
        this.model = opts.model ?? DEFAULT_GEMINI_MODEL;
        if (opts.client !== undefined && opts.client !== null) {
            this._client = opts.client;
            return;
        }
        const api_key = opts.api_key ?? null;
        if (api_key === null) {
            throw new Error(
                'GeminiClient requires explicit api_key or injected client. ' +
                    'Use `api_key_ref: env:GEMINI_API_KEY` in ~/.event4u/agent-config/settings/.ai-council.yml.',
            );
        }
        throw new Error('google-genai package not installed. `pip install google-genai`.');
    }

    override ask(
        system_prompt: string,
        user_prompt: string,
        max_tokens: number = DEFAULT_MAX_TOKENS,
    ): CouncilResponse {
        const t0 = _nowMs();
        const contents = `${system_prompt}\n\n---\n\n${user_prompt}`;
        let response: unknown;
        try {
            const models = _getattr(this._client, 'models', null);
            const generate = _getattr(models, 'generate_content', null) as
                | ((kwargs: Record<string, unknown>) => unknown)
                | null;
            if (typeof generate !== 'function') {
                throw new TypeError("'models.generate_content' is not callable");
            }
            response = generate.call(models, {
                model: this.model,
                contents,
                config: { max_output_tokens: max_tokens },
            });
        } catch (exc) {
            return new CouncilResponse({
                provider: this.name,
                model: this.model,
                text: '',
                latency_ms: _elapsedMs(t0),
                error: _excString(exc),
            });
        }
        const latency_ms = _elapsedMs(t0);
        const text = (_getattr(response, 'text', '') as string) || '';
        const usage = _getattr(response, 'usage_metadata', null);
        return new CouncilResponse({
            provider: this.name,
            model: this.model,
            text,
            input_tokens: usage ? (_getattr(usage, 'prompt_token_count', 0) as number) : 0,
            output_tokens: usage ? (_getattr(usage, 'candidates_token_count', 0) as number) : 0,
            latency_ms,
        });
    }
}

/**
 * Shared shape for OpenAI-API-compatible providers (xAI, Perplexity).
 *
 * Both vendors implement `/v1/chat/completions` and accept the `openai` Python
 * SDK with a custom `base_url`. The reasoning-model branch from `OpenAIClient`
 * is intentionally omitted — neither xAI nor Perplexity ships a reasoning model
 * that requires `max_completion_tokens` as of 2026-05-14.
 */
export class _OpenAICompatibleClient extends ExternalAIClient {
    override billable = true;
    base_url = '';
    protected _client: unknown;

    constructor(opts: { model: string; client?: unknown; api_key?: string | null | undefined }) {
        super();
        this.model = opts.model;
        if (opts.client !== undefined && opts.client !== null) {
            this._client = opts.client;
            return;
        }
        const api_key = opts.api_key ?? null;
        if (api_key === null) {
            throw new Error(
                `${this.constructor.name} requires explicit api_key or injected client.`,
            );
        }
        throw new Error('openai package not installed. `pip install openai`.');
    }

    override ask(
        system_prompt: string,
        user_prompt: string,
        max_tokens: number = DEFAULT_MAX_TOKENS,
    ): CouncilResponse {
        const t0 = _nowMs();
        let response: unknown;
        try {
            const chat = _getattr(this._client, 'chat', null);
            const completions = _getattr(chat, 'completions', null);
            const create = _getattr(completions, 'create', null) as
                | ((kwargs: Record<string, unknown>) => unknown)
                | null;
            if (typeof create !== 'function') {
                throw new TypeError("'chat.completions.create' is not callable");
            }
            response = create.call(completions, {
                model: this.model,
                max_tokens,
                messages: [
                    { role: 'system', content: system_prompt },
                    { role: 'user', content: user_prompt },
                ],
            });
        } catch (exc) {
            return new CouncilResponse({
                provider: this.name,
                model: this.model,
                text: '',
                latency_ms: _elapsedMs(t0),
                error: _excString(exc),
            });
        }
        const latency_ms = _elapsedMs(t0);
        let text: unknown = '';
        const choices = _getattr(response, 'choices', null);
        if (_pyTruthy(choices)) {
            const first = (choices as unknown[])[0];
            const msg = _getattr(first, 'message', null);
            text = msg ? _getattr(msg, 'content', '') : '';
        }
        const usage = _getattr(response, 'usage', null);
        return new CouncilResponse({
            provider: this.name,
            model: this.model,
            text: (text as string) || '',
            input_tokens: usage ? (_getattr(usage, 'prompt_tokens', 0) as number) : 0,
            output_tokens: usage ? (_getattr(usage, 'completion_tokens', 0) as number) : 0,
            latency_ms,
        });
    }
}

/** xAI Grok via the OpenAI-compatible endpoint at api.x.ai/v1. */
export class XAIClient extends _OpenAICompatibleClient {
    override name = 'xai';
    override base_url = XAI_BASE_URL;

    constructor(opts: ApiClientOptions = {}) {
        super({ model: opts.model ?? DEFAULT_XAI_MODEL, client: opts.client, api_key: opts.api_key });
    }
}

/** Perplexity via the OpenAI-compatible endpoint at api.perplexity.ai. */
export class PerplexityClient extends _OpenAICompatibleClient {
    override name = 'perplexity';
    override base_url = PERPLEXITY_BASE_URL;

    constructor(opts: ApiClientOptions = {}) {
        super({
            model: opts.model ?? DEFAULT_PERPLEXITY_MODEL,
            client: opts.client,
            api_key: opts.api_key,
        });
    }
}

// ── CLI transport (step-1 Phase 1+) ──────────────────────────────────

export const CLI_CALLS_FILENAME = 'cli-calls.json';

// Default subprocess timeout (seconds) for a single CLI call. Long enough for
// the largest frontier models to think; short enough to surface a hung
// subprocess without freezing the council run.
export const DEFAULT_CLI_TIMEOUT_SECONDS = 120.0;

/** Return the canonical write target for the daily-quota counter. */
function _cliCallsStatePath(): string {
    return user_global_paths.write_target(CLI_CALLS_FILENAME);
}

export function _today_utc_iso(): string {
    // Python: datetime.now(timezone.utc).date().isoformat() → "YYYY-MM-DD".
    const d = new Date();
    const y = d.getUTCFullYear().toString().padStart(4, '0');
    const m = (d.getUTCMonth() + 1).toString().padStart(2, '0');
    const day = d.getUTCDate().toString().padStart(2, '0');
    return `${y}-${m}-${day}`;
}

/** Return today's per-provider call counts. Empty dict on UTC rollover. */
export function load_cli_call_counts(p: string | null = null): Record<string, number> {
    const target = p !== null ? p : _cliCallsStatePath();
    if (!fs.existsSync(target)) {
        return {};
    }
    let data: unknown;
    try {
        data = JSON.parse(fs.readFileSync(target, { encoding: 'utf-8' }));
    } catch {
        // json.JSONDecodeError / OSError
        return {};
    }
    if (!_isPlainObject(data) || (data as Record<string, unknown>)['date'] !== _today_utc_iso()) {
        return {};
    }
    const counts = (data as Record<string, unknown>)['counts'];
    if (!_isPlainObject(counts)) {
        return {};
    }
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(counts as Record<string, unknown>)) {
        // Python: int(v) for k, v in counts.items() if isinstance(v, (int, str)).
        // bool is an int subclass in Python and would pass; mirror by accepting
        // booleans too. Floats are rejected (not int|str).
        if (typeof v === 'number' && Number.isInteger(v)) {
            out[String(k)] = _pyInt(v);
        } else if (typeof v === 'boolean') {
            out[String(k)] = v ? 1 : 0;
        } else if (typeof v === 'string') {
            out[String(k)] = _pyIntFromStr(v);
        }
    }
    return out;
}

/** Increment today's call count for `provider`. Returns new total. */
export function record_cli_call(provider: string, p: string | null = null): number {
    const target = p !== null ? p : _cliCallsStatePath();
    const counts = load_cli_call_counts(target);
    counts[provider] = (counts[provider] ?? 0) + 1;
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(
        target,
        _jsonDumpsIndent2({ date: _today_utc_iso(), counts }),
        { encoding: 'utf-8' },
    );
    return counts[provider];
}

/**
 * Reset the per-provider call counter (step-8 P1, `council quota --reset`).
 *
 * `provider=null` clears all providers (today's record). Otherwise only the
 * named provider's count is removed; other providers and the UTC date marker
 * are preserved. Returns the post-reset counts.
 */
export function reset_cli_call_counts(
    provider: string | null = null,
    p: string | null = null,
): Record<string, number> {
    const target = p !== null ? p : _cliCallsStatePath();
    let counts = load_cli_call_counts(target);
    if (provider === null) {
        counts = {};
    } else {
        delete counts[provider];
    }
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(
        target,
        _jsonDumpsIndent2({ date: _today_utc_iso(), counts }),
        { encoding: 'utf-8' },
    );
    return counts;
}

/**
 * Build the pre-run quota summary line (step-8 P1, D1 + D4).
 *
 * Returns `[summary, warn_providers]` where `summary` is the formatted
 * one-liner (empty string when no CLI member has a configured cap) and
 * `warn_providers` is the subset whose `used / max_calls_per_day` ratio crossed
 * `warn_at`. Uncapped providers (`max_calls_per_day is None`) are omitted from
 * the summary entirely — they cannot exceed a threshold that does not exist.
 */
export function quota_summary_line(
    clients: CliClient[],
    opts: { cli_calls_path?: string | null } = {},
): [string, string[]] {
    const cliCallsPath = opts.cli_calls_path ?? null;
    // Python: [c for c in clients if getattr(c, "max_calls_per_day", None)]
    // → truthy check (None or 0 both falsy).
    const capped = clients.filter((c) => _pyTruthy(_getattr(c, 'max_calls_per_day', null)));
    if (capped.length === 0) {
        return ['', []];
    }
    const counts = load_cli_call_counts(cliCallsPath);
    const parts: string[] = [];
    const warn: string[] = [];
    for (const c of capped) {
        const name = _getattr(c, 'name', '?') as string;
        const used = _pyInt(counts[name] ?? 0);
        const limit = _pyInt((c.max_calls_per_day as number));
        parts.push(`${name} ${used}/${limit}`);
        const ratio = limit > 0 ? used / limit : 0.0;
        const warnAt = Number(_getattr(c, 'warn_at', 0.8));
        if (ratio >= warnAt) {
            warn.push(name);
        }
    }
    const prefix = warn.length > 0 ? '⚠️  ' : '';
    return [`${prefix}council:quota · ${parts.join(' · ')}`, warn];
}

/** Transport-seam result, shaped like a finished `subprocess.run`. */
export interface SubprocessResult {
    returncode: number;
    stdout: string;
    stderr: string;
}

/** Transport-seam error kinds, mirroring the Python exception branches. */
export type SubprocessErrorKind = 'timeout' | 'file_not_found' | 'os';

/** Typed transport error so a stub can model each Python exception branch. */
export class SubprocessError extends Error {
    kind: SubprocessErrorKind;
    osName: string;
    constructor(kind: SubprocessErrorKind, osName = 'OSError') {
        super(kind);
        this.name = 'SubprocessError';
        this.kind = kind;
        this.osName = osName;
    }
}

/**
 * Shell-out council member — subscription-authed transport.
 *
 * Spawns a locally-installed provider CLI. Auth is delegated to the binary
 * itself (Claude CLI, Codex CLI, Gemini CLI, etc. use the user's logged-in
 * subscription session). Spend is $0 from this loader's perspective —
 * `billable=false` keeps the USD cost gate from firing.
 *
 * Provider subscription quotas are guarded by the optional
 * `cli_call_budget.max_calls_per_day.<provider>` config. Counter state lives at
 * `~/.event4u/agent-config/cli-calls.json` and resets on UTC date rollover.
 *
 * Subclass contract:
 * - `name`: provider key (`anthropic`, `openai`, `gemini`, …).
 * - `default_binary`: executable name resolved via PATH when the member-level
 *   `binary:` field is not set.
 * - `_build_command(system_prompt, user_prompt, max_tokens)`: return the argv.
 * - `_parse_output(stdout, stderr)`: return a partial `CouncilResponse`.
 *
 * Construction validates the binary up front — a missing CLI fails fast with
 * `CliClientError`.
 *
 * Stderr heuristics map known failure shapes to short error codes:
 * - `auth_expired`, `timeout`, `cli_quota_exhausted`, `parse_failed`,
 *   `exit_<N>`.
 */
export abstract class CliClient extends ExternalAIClient {
    override billable = false;
    override transport = 'cli';
    default_binary = '';

    timeout_seconds: number;
    max_calls_per_day: number | null;
    warn_at: number;
    binary!: string;
    protected _cli_calls_path: string | null;

    static _AUTH_FAILURE_PATTERNS: readonly string[] = [
        'authentication',
        'unauthorized',
        'auth failed',
        'auth_error',
        'login',
        'not logged in',
        'session expired',
        'invalid credentials',
    ];
    static _TIMEOUT_PATTERNS: readonly string[] = ['timeout', 'timed out', 'deadline exceeded'];
    static _QUOTA_PATTERNS: readonly string[] = [
        'rate limit',
        'rate_limit',
        'rate-limit',
        'quota exceeded',
        'too many requests',
        '429',
        'usage limit',
    ];

    constructor(opts: CliClientOptions & { model: string }) {
        super();
        this.model = opts.model;
        this.timeout_seconds = opts.timeout_seconds ?? DEFAULT_CLI_TIMEOUT_SECONDS;
        this.max_calls_per_day = opts.max_calls_per_day ?? null;
        this.warn_at = opts.warn_at ?? 0.8;
        this._cli_calls_path = opts.cli_calls_path ?? null;
        const binary = opts.binary ?? null;
        if (binary !== null) {
            this.binary = binary;
        } else {
            if (!this.default_binary) {
                throw new CliClientError(
                    `${this.constructor.name}: no \`default_binary\` set on subclass; ` +
                        'either fix the class or pass `binary=` explicitly.',
                );
            }
            const resolved = _which(this.default_binary);
            if (resolved === null) {
                throw new CliClientError(
                    `${this.constructor.name}: binary ${_pyRepr(this.default_binary)} ` +
                        'not found on PATH. Install the provider CLI or set ' +
                        `\`members.${this.name}.binary:\` in ~/.event4u/agent-config/settings/.ai-council.yml.`,
                );
            }
            this.binary = resolved;
        }
    }

    // ── subclass hooks ────────────────────────────────────────────

    /** Return the argv list the subprocess should execute. */
    protected abstract _build_command(
        system_prompt: string,
        user_prompt: string,
        max_tokens: number,
    ): string[];

    /** Parse provider-specific stdout into a CouncilResponse. */
    protected abstract _parse_output(stdout: string, stderr: string): CouncilResponse;

    /** Return text to send on stdin, or `null` to inherit caller's stdin. */
    protected _stdin_payload(system_prompt: string, user_prompt: string): string | null {
        void system_prompt;
        void user_prompt;
        return null;
    }

    /**
     * Transport seam (default impl). Mirror
     * `subprocess.run(cmd, input=..., capture_output=True, text=True,
     * timeout=..., check=False)`. Throws `SubprocessError` for the timeout /
     * ENOENT / OSError branches so `ask()` can classify them exactly as the
     * Python original does. Tests override this to inject canned output without
     * spawning a process.
     */
    protected _runSubprocess(cmd: string[], stdinPayload: string | null): SubprocessResult {
        const argv0 = cmd[0] ?? '';
        const spawnOpts: Parameters<typeof spawnSync>[2] = {
            encoding: 'utf-8',
            timeout: Math.round(this.timeout_seconds * 1000),
        };
        if (stdinPayload !== null) {
            spawnOpts.input = stdinPayload;
        }
        const r = spawnSync(argv0, cmd.slice(1), spawnOpts);
        if (r.error) {
            const err = r.error as NodeJS.ErrnoException;
            if ((r as { signal?: string | null }).signal === 'SIGTERM' || err.code === 'ETIMEDOUT') {
                throw new SubprocessError('timeout');
            }
            if (err.code === 'ENOENT') {
                throw new SubprocessError('file_not_found');
            }
            throw new SubprocessError('os', err.code ?? 'OSError');
        }
        // spawnSync sets status=null + signal on timeout-kill on some platforms.
        if ((r as { signal?: string | null }).signal === 'SIGTERM' && r.status === null) {
            throw new SubprocessError('timeout');
        }
        return {
            returncode: r.status ?? 0,
            stdout: r.stdout != null ? String(r.stdout) : '',
            stderr: r.stderr != null ? String(r.stderr) : '',
        };
    }

    // ── ask() ──────────────────────────────────────────────────────

    override ask(
        system_prompt: string,
        user_prompt: string,
        max_tokens: number = DEFAULT_MAX_TOKENS,
    ): CouncilResponse {
        const t0 = _nowMs();

        // 1. quota gate — local counter check before spawning anything.
        if (this.max_calls_per_day !== null) {
            const counts = load_cli_call_counts(this._cli_calls_path);
            const used = counts[this.name] ?? 0;
            if (used >= this.max_calls_per_day) {
                // step-8 D3 — record the block on the persistent events log.
                try {
                    appendEvent({
                        lens: '',
                        invocation: '',
                        action: 'block_quota',
                        verdict: '',
                        provider_caps: {
                            [this.name]: { mode: 'cli', model: this.model },
                        },
                        original_ask: user_prompt,
                        cli_calls_used: used,
                        cli_calls_max: this.max_calls_per_day,
                    });
                } catch {
                    // never crash ask()
                }
                return new CouncilResponse({
                    provider: this.name,
                    model: this.model,
                    text: '',
                    latency_ms: _elapsedMs(t0),
                    error: 'cli_quota_exhausted',
                    metadata: {
                        cli: true,
                        cli_calls_used: used,
                        cli_calls_max: this.max_calls_per_day,
                    },
                });
            }
        }

        // 2. build command + spawn.
        const cmd = this._build_command(system_prompt, user_prompt, max_tokens);
        const stdinPayload = this._stdin_payload(system_prompt, user_prompt);
        let proc: SubprocessResult;
        try {
            proc = this._runSubprocess(cmd, stdinPayload);
        } catch (exc) {
            if (exc instanceof SubprocessError) {
                if (exc.kind === 'timeout') {
                    return new CouncilResponse({
                        provider: this.name,
                        model: this.model,
                        text: '',
                        latency_ms: _elapsedMs(t0),
                        error: 'timeout',
                        metadata: { cli: true, timeout_seconds: this.timeout_seconds },
                    });
                }
                if (exc.kind === 'file_not_found') {
                    return new CouncilResponse({
                        provider: this.name,
                        model: this.model,
                        text: '',
                        latency_ms: _elapsedMs(t0),
                        error: 'binary_missing',
                        metadata: { cli: true, binary: this.binary },
                    });
                }
                // OSError
                return new CouncilResponse({
                    provider: this.name,
                    model: this.model,
                    text: '',
                    latency_ms: _elapsedMs(t0),
                    error: `os_error: ${exc.osName}`,
                    metadata: { cli: true },
                });
            }
            throw exc;
        }

        // 3. record the call — even failures count against the quota so a broken
        //    CLI cannot burn the whole budget in a tight loop.
        try {
            record_cli_call(this.name, this._cli_calls_path);
        } catch {
            // state-file write failure is non-fatal here.
        }

        const latency_ms = _elapsedMs(t0);

        // 4. non-zero exit → classify and bail.
        if (proc.returncode !== 0) {
            const code = (this.constructor as typeof CliClient)._classify_stderr(
                proc.stderr || '',
                proc.returncode,
            );
            return new CouncilResponse({
                provider: this.name,
                model: this.model,
                text: '',
                latency_ms,
                error: code,
                metadata: {
                    cli: true,
                    returncode: proc.returncode,
                    stderr_tail: (proc.stderr || '').slice(-500),
                },
            });
        }

        // 5. parse stdout via the subclass hook.
        let response: CouncilResponse;
        try {
            response = this._parse_output(proc.stdout || '', proc.stderr || '');
        } catch (exc) {
            return new CouncilResponse({
                provider: this.name,
                model: this.model,
                text: proc.stdout || '',
                latency_ms,
                error: `parse_failed: ${_excTypeName(exc)}`,
                metadata: { cli: true, stderr_tail: (proc.stderr || '').slice(-500) },
            });
        }
        response.latency_ms = latency_ms;
        const meta: Record<string, unknown> = { ...response.metadata };
        if (!('cli' in meta)) {
            meta['cli'] = true;
        }
        response.metadata = meta;
        return response;
    }

    static _classify_stderr(stderr: string, returncode: number): string {
        const haystack = stderr.toLowerCase();
        if (this._AUTH_FAILURE_PATTERNS.some((p) => haystack.includes(p))) {
            return 'auth_expired';
        }
        if (this._TIMEOUT_PATTERNS.some((p) => haystack.includes(p))) {
            return 'timeout';
        }
        if (this._QUOTA_PATTERNS.some((p) => haystack.includes(p))) {
            return 'cli_quota_exhausted';
        }
        return `exit_${returncode}`;
    }
}

/**
 * Claude via the official `claude` CLI (subscription-authed).
 *
 * Invokes `claude --print --output-format json` and consumes the structured
 * envelope: `{"result": str, "usage": {"input_tokens": int, "output_tokens":
 * int}, "session_id": str, ...}`. The prompt is piped on stdin so it never
 * collides with argv length limits.
 */
export class AnthropicCliClient extends CliClient {
    override name = 'anthropic';
    override default_binary = 'claude';
    override subscription_label = 'claude-pro';

    constructor(opts: CliClientOptions = {}) {
        super({
            model: opts.model ?? 'claude-sonnet-4-5',
            binary: opts.binary,
            timeout_seconds: opts.timeout_seconds,
            max_calls_per_day: opts.max_calls_per_day,
            warn_at: opts.warn_at,
            cli_calls_path: opts.cli_calls_path,
        });
    }

    protected override _build_command(
        system_prompt: string,
        user_prompt: string,
        max_tokens: number,
    ): string[] {
        void user_prompt;
        void max_tokens;
        return [
            this.binary,
            '--print',
            '--output-format',
            'json',
            '--model',
            this.model,
            '--append-system-prompt',
            system_prompt,
        ];
    }

    protected override _stdin_payload(system_prompt: string, user_prompt: string): string | null {
        void system_prompt;
        return user_prompt;
    }

    protected override _parse_output(stdout: string, stderr: string): CouncilResponse {
        void stderr;
        const envelope = _jsonLoads(stdout);
        if (!_isPlainObject(envelope)) {
            throw new ValueError('expected JSON object at the top level of claude CLI output');
        }
        const env = envelope as Record<string, unknown>;
        const text = _pyStr(_dictGet(env, 'result', '')).trim();
        let usage = _dictGet(env, 'usage', null);
        if (!_pyTruthy(usage)) {
            usage = {};
        }
        if (!_isPlainObject(usage)) {
            usage = {};
        }
        const usageObj = usage as Record<string, unknown>;
        const meta: Record<string, unknown> = {};
        const session_id = _dictGet(env, 'session_id', undefined);
        if (_pyTruthy(session_id)) {
            meta['session_id'] = _pyStr(session_id);
        }
        const total_cost = _dictGet(env, 'total_cost_usd', null);
        if (total_cost !== null && total_cost !== undefined) {
            meta['reported_cost_usd'] = total_cost;
        }
        const duration_ms = _dictGet(env, 'duration_ms', null);
        if (duration_ms !== null && duration_ms !== undefined) {
            meta['reported_duration_ms'] = duration_ms;
        }
        return new CouncilResponse({
            provider: this.name,
            model: this.model,
            text,
            input_tokens: _pyIntCoerce(_dictGet(usageObj, 'input_tokens', 0)),
            output_tokens: _pyIntCoerce(_dictGet(usageObj, 'output_tokens', 0)),
            metadata: meta,
        });
    }
}

/**
 * OpenAI via the official `codex` CLI (subscription-authed).
 *
 * Invokes `codex exec --json <prompt>` and consumes the newline-delimited JSON
 * event stream. The user prompt rides on argv (Codex does not read prompts from
 * stdin in `exec` mode); the system prompt is passed via `--system` when
 * non-empty.
 *
 * Output shape: one JSON object per line. The terminal event has
 * `type == "item.completed"` with the final assistant message in
 * `item.content[0].text`; a separate `type == "turn.completed"` event carries
 * token usage in `usage.input_tokens` / `usage.output_tokens`.
 */
export class OpenAICliClient extends CliClient {
    override name = 'openai';
    override default_binary = 'codex';
    override subscription_label = 'chatgpt-plus';

    static override _AUTH_FAILURE_PATTERNS: readonly string[] = [
        ...CliClient._AUTH_FAILURE_PATTERNS,
        'codex login',
        'auth_required',
        '401',
    ];

    constructor(opts: CliClientOptions = {}) {
        super({
            model: opts.model ?? 'gpt-5',
            binary: opts.binary,
            timeout_seconds: opts.timeout_seconds,
            max_calls_per_day: opts.max_calls_per_day,
            warn_at: opts.warn_at,
            cli_calls_path: opts.cli_calls_path,
        });
    }

    protected override _build_command(
        system_prompt: string,
        user_prompt: string,
        max_tokens: number,
    ): string[] {
        void max_tokens;
        const cmd = [this.binary, 'exec', '--json', '--model', this.model];
        if (system_prompt) {
            cmd.push('--system', system_prompt);
        }
        cmd.push(user_prompt);
        return cmd;
    }

    protected override _parse_output(stdout: string, stderr: string): CouncilResponse {
        void stderr;
        let text = '';
        let input_tokens = 0;
        let output_tokens = 0;
        const meta: Record<string, unknown> = {};
        for (let line of _splitlines(stdout)) {
            line = line.trim();
            if (!line) {
                continue;
            }
            let event: unknown;
            try {
                event = _jsonLoads(line);
            } catch (exc) {
                if (exc instanceof JSONDecodeError) {
                    continue;
                }
                throw exc;
            }
            if (!_isPlainObject(event)) {
                continue;
            }
            const ev = event as Record<string, unknown>;
            const event_type = _dictGet(ev, 'type', undefined);
            if (event_type === 'item.completed') {
                let item = _dictGet(ev, 'item', null);
                if (!_pyTruthy(item)) {
                    item = {};
                }
                if (_isPlainObject(item)) {
                    const itemObj = item as Record<string, unknown>;
                    let content = _dictGet(itemObj, 'content', null);
                    if (!_pyTruthy(content)) {
                        content = [];
                    }
                    if (Array.isArray(content)) {
                        const chunks: string[] = [];
                        for (const entry of content) {
                            if (_isPlainObject(entry) && _pyTruthy(_dictGet(entry as Record<string, unknown>, 'text', undefined))) {
                                chunks.push(_pyStr((entry as Record<string, unknown>)['text']));
                            }
                        }
                        if (chunks.length > 0) {
                            text = chunks.join('\n').trim();
                        }
                    }
                    if (_pyTruthy(_dictGet(itemObj, 'id', undefined))) {
                        meta['item_id'] = _pyStr(itemObj['id']);
                    }
                }
            } else if (event_type === 'turn.completed') {
                let usage = _dictGet(ev, 'usage', null);
                if (!_pyTruthy(usage)) {
                    usage = {};
                }
                if (_isPlainObject(usage)) {
                    const usageObj = usage as Record<string, unknown>;
                    input_tokens = _pyIntCoerce(_dictGet(usageObj, 'input_tokens', 0));
                    output_tokens = _pyIntCoerce(_dictGet(usageObj, 'output_tokens', 0));
                }
            } else if (event_type === 'session.created') {
                if (_pyTruthy(_dictGet(ev, 'session_id', undefined))) {
                    meta['session_id'] = _pyStr(ev['session_id']);
                }
            }
        }
        return new CouncilResponse({
            provider: this.name,
            model: this.model,
            text,
            input_tokens,
            output_tokens,
            metadata: meta,
        });
    }
}

/**
 * Google Gemini via the official `gemini` CLI (free-tier subscription).
 *
 * Invokes `gemini --prompt <prompt> --output-format json` and consumes the
 * structured envelope: `{"response": str, "stats": {"models": {"<model>":
 * {"tokens": {"prompt": int, "candidates": int}}}}, ...}`. Prompt is piped on
 * stdin to dodge argv limits.
 */
export class GeminiCliClient extends CliClient {
    override name = 'gemini';
    override default_binary = 'gemini';
    override subscription_label = 'gemini-pro';

    static override _AUTH_FAILURE_PATTERNS: readonly string[] = [
        ...CliClient._AUTH_FAILURE_PATTERNS,
        'interactive consent could not be obtained',
        'please run `gemini`',
        'oauth',
    ];

    constructor(opts: CliClientOptions = {}) {
        super({
            model: opts.model ?? 'gemini-2.5-pro',
            binary: opts.binary,
            timeout_seconds: opts.timeout_seconds,
            max_calls_per_day: opts.max_calls_per_day,
            warn_at: opts.warn_at,
            cli_calls_path: opts.cli_calls_path,
        });
    }

    protected override _build_command(
        system_prompt: string,
        user_prompt: string,
        max_tokens: number,
    ): string[] {
        void user_prompt;
        void max_tokens;
        const cmd = [this.binary, '--output-format', 'json', '--model', this.model];
        if (system_prompt) {
            cmd.push('--system', system_prompt);
        }
        return cmd;
    }

    protected override _stdin_payload(system_prompt: string, user_prompt: string): string | null {
        void system_prompt;
        return user_prompt;
    }

    protected override _parse_output(stdout: string, stderr: string): CouncilResponse {
        void stderr;
        const envelope = _jsonLoads(stdout);
        if (!_isPlainObject(envelope)) {
            throw new ValueError('expected JSON object at the top level of gemini CLI output');
        }
        const env = envelope as Record<string, unknown>;
        const text = _pyStr(_dictGet(env, 'response', '')).trim();
        let input_tokens = 0;
        let output_tokens = 0;
        let stats = _dictGet(env, 'stats', null);
        if (!_pyTruthy(stats)) {
            stats = {};
        }
        if (_isPlainObject(stats)) {
            let models = _dictGet(stats as Record<string, unknown>, 'models', null);
            if (!_pyTruthy(models)) {
                models = {};
            }
            if (_isPlainObject(models)) {
                const modelsObj = models as Record<string, unknown>;
                // gemini emits per-model token counts; pick the configured model
                // if present, else the first model in the envelope.
                let model_stats: unknown = modelsObj[this.model];
                if (!_isPlainObject(model_stats)) {
                    model_stats = _firstDictValue(modelsObj) ?? {};
                }
                let tokens: unknown;
                if (_isPlainObject(model_stats)) {
                    tokens = _dictGet(model_stats as Record<string, unknown>, 'tokens', null);
                    if (!_pyTruthy(tokens)) {
                        tokens = {};
                    }
                } else {
                    tokens = {};
                }
                if (_isPlainObject(tokens)) {
                    const tokensObj = tokens as Record<string, unknown>;
                    input_tokens = _pyIntCoerce(_dictGet(tokensObj, 'prompt', 0));
                    output_tokens = _pyIntCoerce(_dictGet(tokensObj, 'candidates', 0));
                }
            }
        }
        const meta: Record<string, unknown> = {};
        let session_id = _dictGet(env, 'sessionId', undefined);
        if (!_pyTruthy(session_id)) {
            session_id = _dictGet(env, 'session_id', undefined);
        }
        if (_pyTruthy(session_id)) {
            meta['session_id'] = _pyStr(session_id);
        }
        return new CouncilResponse({
            provider: this.name,
            model: this.model,
            text,
            input_tokens,
            output_tokens,
            metadata: meta,
        });
    }
}

/**
 * xAI Grok via the community `grok` CLI (Superagent project).
 *
 * Community-maintained wrapper around the xAI API — **not** an official
 * subscription transport. The CLI consumes `XAI_API_KEY` from its own
 * environment, so every call is paid per-token exactly as `XAIClient` (api
 * transport) would be. `mode: cli` here is an ergonomic shortcut; it does NOT
 * bypass the USD cost gate.
 *
 * Invokes `grok -p <prompt>`. Output is plain text — no JSON envelope.
 * `_parse_output` returns the trimmed stdout and estimates token counts
 * heuristically (chars / 4) for the audit-trail.
 */
export class XAICliClient extends CliClient {
    override name = 'xai';
    override default_binary = 'grok';
    override billable = true; // community CLI consumes an API key — billable applies

    static override _AUTH_FAILURE_PATTERNS: readonly string[] = [
        ...CliClient._AUTH_FAILURE_PATTERNS,
        'xai_api_key',
        '401',
        'unauthorized',
    ];

    constructor(opts: CliClientOptions = {}) {
        super({
            model: opts.model ?? DEFAULT_XAI_MODEL,
            binary: opts.binary,
            timeout_seconds: opts.timeout_seconds,
            max_calls_per_day: opts.max_calls_per_day,
            warn_at: opts.warn_at,
            cli_calls_path: opts.cli_calls_path,
        });
    }

    protected override _build_command(
        system_prompt: string,
        user_prompt: string,
        max_tokens: number,
    ): string[] {
        void system_prompt;
        void max_tokens;
        const cmd = [this.binary, '-p', user_prompt];
        if (this.model) {
            cmd.push('--model', this.model);
        }
        return cmd;
    }

    protected override _parse_output(stdout: string, stderr: string): CouncilResponse {
        void stderr;
        const text = stdout.trim();
        // Plain-text CLIs surface no token usage — estimate from text length so
        // the audit trail and post-call tracker stay populated. chars / 4
        // mirrors `pricing.estimate_input_tokens`.
        const output_tokens = text ? Math.max(1, Math.trunc(_pyLen(text) / 4)) : 0;
        return new CouncilResponse({
            provider: this.name,
            model: this.model,
            text,
            input_tokens: 0,
            output_tokens,
            metadata: { cli_output_format: 'plain_text', tokens_estimated: true },
        });
    }
}

/**
 * Perplexity via the community `perplexity` CLI (npm package).
 *
 * Community-maintained wrapper around the Perplexity API — **not** an official
 * subscription transport. The CLI consumes `PERPLEXITY_API_KEY` from its own
 * environment, so every call is paid per-token exactly as `PerplexityClient`
 * (api transport) would be. `mode: cli` here is an ergonomic shortcut; it does
 * NOT bypass the USD cost gate.
 *
 * Invokes `perplexity -p <prompt>`. Output is plain text — no JSON envelope.
 */
export class PerplexityCliClient extends CliClient {
    override name = 'perplexity';
    override default_binary = 'perplexity';
    override billable = true; // community CLI consumes an API key — billable applies

    static override _AUTH_FAILURE_PATTERNS: readonly string[] = [
        ...CliClient._AUTH_FAILURE_PATTERNS,
        'perplexity_api_key',
        '401',
        'unauthorized',
    ];

    constructor(opts: CliClientOptions = {}) {
        super({
            model: opts.model ?? DEFAULT_PERPLEXITY_MODEL,
            binary: opts.binary,
            timeout_seconds: opts.timeout_seconds,
            max_calls_per_day: opts.max_calls_per_day,
            warn_at: opts.warn_at,
            cli_calls_path: opts.cli_calls_path,
        });
    }

    protected override _build_command(
        system_prompt: string,
        user_prompt: string,
        max_tokens: number,
    ): string[] {
        void system_prompt;
        void max_tokens;
        const cmd = [this.binary, '-p', user_prompt];
        if (this.model) {
            cmd.push('--model', this.model);
        }
        return cmd;
    }

    protected override _parse_output(stdout: string, stderr: string): CouncilResponse {
        void stderr;
        const text = stdout.trim();
        const output_tokens = text ? Math.max(1, Math.trunc(_pyLen(text) / 4)) : 0;
        return new CouncilResponse({
            provider: this.name,
            model: this.model,
            text,
            input_tokens: 0,
            output_tokens,
            metadata: { cli_output_format: 'plain_text', tokens_estimated: true },
        });
    }
}

// ── Manual mode (Phase 2b) ───────────────────────────────────────────

export const MANUAL_END_MARKER = 'END'; // line containing only this terminates a paste block.

/** Minimal line-reading stream interface (mirrors Python `TextIO`). */
export interface TextInputStream {
    /** Yield successive lines (each may keep its trailing "\n"), like iterating a Python file. */
    [Symbol.iterator](): Iterator<string>;
    /** Read a single line (with trailing newline), or '' at EOF — Python `readline()`. */
    readline(): string;
}

/** Minimal write stream interface (mirrors Python `TextIO`). */
export interface TextOutputStream {
    write(s: string): void;
    flush(): void;
}

/**
 * Read lines from `stream` until a line equal to `marker` (after strip).
 *
 * Returns the joined body without the marker line. EOF before the marker is
 * treated as end-of-input — the body collected so far is returned.
 */
export function _read_until_marker(stream: TextInputStream, marker: string): string {
    const body: string[] = [];
    for (const raw of stream) {
        const line = _rstripNewline(raw);
        if (line.trim() === marker) {
            break;
        }
        body.push(line);
    }
    return body.join('\n').trim();
}

/**
 * Copy-paste council member — user is the transport.
 *
 * `ask()` renders the system prompt + artefact as one Markdown block, prints it
 * to stdout, and reads pasted replies from stdin. After each pasted reply,
 * surfaces a 1/2/3 menu (more · next · abort). Loops until the user picks 2 or
 * 3.
 *
 * Spend is $0 — `billable=false` makes the orchestrator skip the cost gate.
 *
 * Tests inject `stdin` / `stdout` streams. Production usage falls back to
 * process stdin / stdout.
 */
export class ManualClient extends ExternalAIClient {
    override billable = false;
    override transport = 'manual';
    provider_label: string;
    private _stdin: TextInputStream;
    private _stdout: TextOutputStream;
    private _end_marker: string;

    constructor(
        opts: {
            name?: string;
            model?: string;
            provider_label?: string;
            stdin?: TextInputStream | null;
            stdout?: TextOutputStream | null;
            end_marker?: string;
        } = {},
    ) {
        super();
        this.name = opts.name ?? 'manual';
        this.model = opts.model ?? 'manual';
        this.provider_label = opts.provider_label ?? 'your LLM web UI';
        this._stdin = opts.stdin ?? _defaultStdin();
        this._stdout = opts.stdout ?? _defaultStdout();
        this._end_marker = opts.end_marker ?? MANUAL_END_MARKER;
    }

    override ask(
        system_prompt: string,
        user_prompt: string,
        max_tokens: number = DEFAULT_MAX_TOKENS,
    ): CouncilResponse {
        void max_tokens; // accepted for ABC parity
        const t0 = _nowMs();
        const rounds: string[] = [];
        let block = this._render_block(system_prompt, user_prompt, null);
        this._emit(block);

        try {
            for (;;) {
                const reply = _read_until_marker(this._stdin, this._end_marker);
                rounds.push(reply);
                const choice = this._ask_menu(_pyLen(reply));

                if (choice === '2') {
                    // done with this member
                    break;
                }
                if (choice === '3') {
                    // abort the council run
                    return new CouncilResponse({
                        provider: this.name,
                        model: this.model,
                        text: '',
                        latency_ms: _elapsedMs(t0),
                        error: 'manual_aborted',
                        metadata: { rounds: rounds.length, manual: true },
                    });
                }
                // choice == "1": collect follow-up, re-emit context block.
                const follow_up = this._read_follow_up();
                if (!follow_up) {
                    break; // empty follow-up → treat as "done with this member"
                }
                rounds.push(`[follow-up sent]\n${follow_up}`);
                block = this._render_block(system_prompt, user_prompt, follow_up);
                this._emit(block);
            }
        } catch (exc) {
            return new CouncilResponse({
                provider: this.name,
                model: this.model,
                text: rounds.join('\n\n'),
                latency_ms: _elapsedMs(t0),
                error: _excString(exc),
                metadata: { rounds: rounds.length, manual: true },
            });
        }

        const text = rounds.join('\n\n---\n\n').trim();
        return new CouncilResponse({
            provider: this.name,
            model: this.model,
            text,
            latency_ms: _elapsedMs(t0),
            metadata: { rounds: rounds.length, manual: true },
        });
    }

    // ── helpers ──────────────────────────────────────────────────────

    private _emit(text: string): void {
        this._stdout.write(text);
        this._stdout.write('\n');
        this._stdout.flush();
    }

    private _render_block(
        system_prompt: string,
        user_prompt: string,
        follow_up: string | null,
    ): string {
        const bar = '═'.repeat(67);
        const head =
            `${bar}\n` +
            `Manual council member: ${this.provider_label}\n` +
            'Paste this block into the web UI · then paste the reply below.\n' +
            `${bar}`;
        let body: string;
        if (follow_up !== null) {
            body = `[Follow-up — paste this into the SAME chat thread]\n\n${follow_up}`;
        } else {
            body = `${system_prompt}\n\n---\n\n${user_prompt}`;
        }
        const tail =
            `${bar}\n` +
            `End your pasted reply with a line containing only: ${this._end_marker}\n` +
            `${bar}`;
        return `${head}\n\n${body}\n\n${tail}`;
    }

    private _ask_menu(reply_chars: number): string {
        const prompt =
            `\nReply received (${reply_chars} chars). Now what?\n` +
            '  1. More feedback for this member (continue this thread)\n' +
            '  2. Done with this member, move to the next\n' +
            '  3. Abort the council run\n\n' +
            'Choose 1/2/3: ';
        this._stdout.write(prompt);
        this._stdout.flush();
        const line = this._stdin.readline().trim();
        if (line === '1' || line === '2' || line === '3') {
            return line;
        }
        // unknown input → treat as "next" so we never block forever in tests / piped runs.
        return '2';
    }

    private _read_follow_up(): string {
        this._emit(
            `\nType your follow-up question, end with a line containing only: ${this._end_marker}`,
        );
        return _read_until_marker(this._stdin, this._end_marker);
    }
}

// ── primitives ─────────────────────────────────────────────────────────

/** Python `ValueError`. */
export class ValueError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ValueError';
    }
}

/** Python `json.JSONDecodeError`. */
export class JSONDecodeError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'JSONDecodeError';
    }
}

/** `json.loads` that raises `JSONDecodeError` (not the native SyntaxError). */
function _jsonLoads(s: string): unknown {
    try {
        return JSON.parse(s);
    } catch (exc) {
        throw new JSONDecodeError(exc instanceof Error ? exc.message : String(exc));
    }
}

/** True for a plain object (Python `isinstance(x, dict)`), not array / null. */
function _isPlainObject(x: unknown): x is Record<string, unknown> {
    return typeof x === 'object' && x !== null && !Array.isArray(x);
}

/** Mirror Python truthiness: '', 0, 0.0, false, null/undefined, [], {} are falsy. */
function _pyTruthy(x: unknown): boolean {
    if (x === null || x === undefined) {
        return false;
    }
    if (typeof x === 'boolean') {
        return x;
    }
    if (typeof x === 'number') {
        return x !== 0;
    }
    if (typeof x === 'string') {
        return x.length > 0;
    }
    if (Array.isArray(x)) {
        return x.length > 0;
    }
    if (typeof x === 'object') {
        return Object.keys(x as Record<string, unknown>).length > 0;
    }
    return true;
}

/** `dict.get(key, default)` over a duck-typed object. */
function _dictGet(obj: Record<string, unknown>, key: string, fallback: unknown): unknown {
    return key in obj ? obj[key] : fallback;
}

/** First dict-typed value in insertion order (mirrors `next(v for v ... if isinstance(v, dict))`). */
function _firstDictValue(obj: Record<string, unknown>): Record<string, unknown> | undefined {
    for (const v of Object.values(obj)) {
        if (_isPlainObject(v)) {
            return v;
        }
    }
    return undefined;
}

/** Python `str(x)`. */
function _pyStr(x: unknown): string {
    if (x === null) {
        return 'None';
    }
    if (x === undefined) {
        // Defensive: undefined never reaches str() in the Python flow; treat as
        // empty per the `.get(..., "")` defaults that precede every call.
        return '';
    }
    if (typeof x === 'boolean') {
        return x ? 'True' : 'False';
    }
    return String(x);
}

/**
 * Python `int(x or 0)` applied to JSON-loaded values where the source code does
 * `int(usage.get("k", 0) or 0)` — None/0/"" coerce to 0, ints pass, numeric
 * strings parse. Floats truncate toward zero.
 */
function _pyIntCoerce(x: unknown): number {
    // `x or 0` first: falsy → 0.
    if (!_pyTruthy(x)) {
        return 0;
    }
    if (typeof x === 'number') {
        return Math.trunc(x);
    }
    if (typeof x === 'boolean') {
        return x ? 1 : 0;
    }
    if (typeof x === 'string') {
        return _pyIntFromStr(x);
    }
    // int() on a dict/list raises TypeError in Python — surface it.
    throw new TypeError(`int() argument must be a number or string, not ${typeof x}`);
}

/** Python `int(value)` for an already-int-typed number (used in quota_summary_line). */
function _pyInt(n: number): number {
    return Math.trunc(n);
}

/** Python `int(str)` — strict base-10 with surrounding whitespace allowed. */
function _pyIntFromStr(s: string): number {
    const t = s.trim();
    if (!/^[+-]?\d+$/.test(t)) {
        throw new ValueError(`invalid literal for int() with base 10: ${_pyRepr(s)}`);
    }
    return parseInt(t, 10);
}

/** Python `len(str)` — Unicode code-point count, not UTF-16 units. */
function _pyLen(s: string): number {
    let n = 0;
    for (const _ of s) {
        void _;
        n += 1;
    }
    return n;
}

/** Python `str.rstrip("\n")` — strip only trailing newline chars. */
function _rstripNewline(s: string): string {
    let end = s.length;
    while (end > 0 && s[end - 1] === '\n') {
        end -= 1;
    }
    return s.slice(0, end);
}

/** Python `str.splitlines()` for the line shapes a CLI stream emits. */
function _splitlines(s: string): string[] {
    if (s === '') {
        return [];
    }
    // Python splitlines() splits on \n, \r, \r\n (and more); CLI JSONL only
    // ever uses \n / \r\n. Match the universal-newline subset that matters here.
    const out: string[] = [];
    let cur = '';
    for (let i = 0; i < s.length; i += 1) {
        const ch = s[i];
        if (ch === '\n') {
            out.push(cur);
            cur = '';
        } else if (ch === '\r') {
            out.push(cur);
            cur = '';
            if (s[i + 1] === '\n') {
                i += 1;
            }
        } else {
            cur += ch;
        }
    }
    if (cur !== '') {
        out.push(cur);
    }
    return out;
}

/** Render a value with Python `repr()` for the strings this module reprs. */
function _pyRepr(x: unknown): string {
    if (typeof x === 'string') {
        // Python prefers single quotes unless the string has a single quote and
        // no double quote.
        const hasSingle = x.includes("'");
        const hasDouble = x.includes('"');
        const quote = hasSingle && !hasDouble ? '"' : "'";
        let out = quote;
        for (const ch of x) {
            if (ch === '\\') {
                out += '\\\\';
            } else if (ch === quote) {
                out += `\\${quote}`;
            } else if (ch === '\n') {
                out += '\\n';
            } else if (ch === '\r') {
                out += '\\r';
            } else if (ch === '\t') {
                out += '\\t';
            } else {
                out += ch;
            }
        }
        return out + quote;
    }
    return String(x);
}

/** Python `oct(mode)` → "0o600" style string. */
function _octRepr(mode: number): string {
    return `0o${mode.toString(8)}`;
}

/** Build `f"{type(exc).__name__}: {exc}"` for caught errors. */
function _excString(exc: unknown): string {
    return `${_excTypeName(exc)}: ${_excMessage(exc)}`;
}

function _excTypeName(exc: unknown): string {
    if (exc instanceof KeyGateError) return 'KeyGateError';
    if (exc instanceof CliClientError) return 'CliClientError';
    if (exc instanceof ValueError) return 'ValueError';
    if (exc instanceof JSONDecodeError) return 'JSONDecodeError';
    if (exc instanceof TypeError) return 'TypeError';
    if (exc instanceof RangeError) return 'RangeError';
    if (exc instanceof Error) {
        return exc.name || 'Error';
    }
    return typeof exc;
}

function _excMessage(exc: unknown): string {
    if (exc instanceof Error) {
        return exc.message;
    }
    return String(exc);
}

/** `json.dumps(obj, indent=2)` — default ensure_ascii=True, insertion-order keys. */
function _jsonDumpsIndent2(value: unknown): string {
    return _jsonDumpsIndented(value, 2, 0);
}

function _jsonDumpsIndented(value: unknown, indent: number, level: number): string {
    if (value === null || value === undefined) {
        return 'null';
    }
    switch (typeof value) {
        case 'boolean':
            return value ? 'true' : 'false';
        case 'number':
            return _pyJsonNumber(value);
        case 'string':
            return _pyJsonStringAscii(value);
        case 'object':
            break;
        default:
            throw new TypeError(`Object of type ${typeof value} is not JSON serializable`);
    }
    const pad = ' '.repeat(indent * (level + 1));
    const closePad = ' '.repeat(indent * level);
    if (Array.isArray(value)) {
        if (value.length === 0) {
            return '[]';
        }
        const items = value.map((v) => pad + _jsonDumpsIndented(v, indent, level + 1));
        return `[\n${items.join(',\n')}\n${closePad}]`;
    }
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);
    if (keys.length === 0) {
        return '{}';
    }
    const items = keys.map(
        (k) => `${pad}${_pyJsonStringAscii(k)}: ${_jsonDumpsIndented(obj[k], indent, level + 1)}`,
    );
    return `{\n${items.join(',\n')}\n${closePad}}`;
}

/** Render a number like Python `json.dumps` (int vs float; JS has one type). */
function _pyJsonNumber(n: number): string {
    if (!Number.isFinite(n)) {
        if (Number.isNaN(n)) {
            return 'NaN';
        }
        return n > 0 ? 'Infinity' : '-Infinity';
    }
    return String(n);
}

/** Escape a string like Python `json.dumps(..., ensure_ascii=True)` (default). */
function _pyJsonStringAscii(s: string): string {
    let out = '"';
    for (const ch of s) {
        const code = ch.codePointAt(0) ?? 0;
        if (ch === '"') {
            out += '\\"';
        } else if (ch === '\\') {
            out += '\\\\';
        } else if (ch === '\b') {
            out += '\\b';
        } else if (ch === '\f') {
            out += '\\f';
        } else if (ch === '\n') {
            out += '\\n';
        } else if (ch === '\r') {
            out += '\\r';
        } else if (ch === '\t') {
            out += '\\t';
        } else if (code < 0x20) {
            out += `\\u${code.toString(16).padStart(4, '0')}`;
        } else if (code < 0x7f) {
            out += ch;
        } else if (code <= 0xffff) {
            out += `\\u${code.toString(16).padStart(4, '0')}`;
        } else {
            // Astral plane → surrogate pair, matching Python json.dumps default.
            const c = code - 0x10000;
            const hi = 0xd800 + (c >> 10);
            const lo = 0xdc00 + (c & 0x3ff);
            out += `\\u${hi.toString(16).padStart(4, '0')}\\u${lo.toString(16).padStart(4, '0')}`;
        }
    }
    return out + '"';
}

/** Python `shutil.which(name)` — resolve an executable on PATH. */
function _which(name: string): string | null {
    // Absolute / relative path with a separator: check directly (Python's which
    // checks the given path when it contains a dir component).
    if (name.includes(path.sep) || (path.sep !== '/' && name.includes('/'))) {
        return _isExecutable(name) ? name : null;
    }
    const pathEnv = process.env.PATH ?? '';
    if (!pathEnv) {
        return null;
    }
    const exts =
        process.platform === 'win32'
            ? (process.env.PATHEXT ?? '.COM;.EXE;.BAT;.CMD').split(';').filter(Boolean)
            : [''];
    for (const dir of pathEnv.split(path.delimiter)) {
        if (!dir) {
            continue;
        }
        for (const ext of exts) {
            const candidate = path.join(dir, name + ext);
            if (_isExecutable(candidate)) {
                return candidate;
            }
        }
    }
    return null;
}

function _isExecutable(p: string): boolean {
    try {
        const st = fs.statSync(p);
        if (!st.isFile()) {
            return false;
        }
        if (process.platform === 'win32') {
            return true;
        }
        // Any execute bit set (mirrors os.access(p, X_OK) closely enough).
        return (st.mode & 0o111) !== 0;
    } catch {
        return false;
    }
}

// ── default manual-mode streams (process stdin/stdout) ─────────────────

function _defaultStdout(): TextOutputStream {
    return {
        write(s: string): void {
            process.stdout.write(s);
        },
        flush(): void {
            // process.stdout is auto-flushing; no-op.
        },
    };
}

function _defaultStdin(): TextInputStream {
    // Production manual mode reads from process.stdin synchronously line by
    // line via fd 0. Tests always inject a stream, so this is the fallback.
    let buffer: string | null = null;
    let pos = 0;
    function ensure(): string {
        if (buffer === null) {
            try {
                buffer = fs.readFileSync(0, { encoding: 'utf-8' });
            } catch {
                buffer = '';
            }
        }
        return buffer;
    }
    function nextLine(): string {
        const buf = ensure();
        if (pos >= buf.length) {
            return '';
        }
        const nl = buf.indexOf('\n', pos);
        if (nl === -1) {
            const line = buf.slice(pos);
            pos = buf.length;
            return line;
        }
        const line = buf.slice(pos, nl + 1);
        pos = nl + 1;
        return line;
    }
    return {
        readline(): string {
            return nextLine();
        },
        [Symbol.iterator](): Iterator<string> {
            return {
                next(): IteratorResult<string> {
                    const line = nextLine();
                    if (line === '') {
                        return { done: true, value: undefined };
                    }
                    return { done: false, value: line };
                },
            };
        },
    };
}
