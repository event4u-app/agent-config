// Tests for src/scripts/ai_council/clients.ts (py2ts Phase 1, ADR-094).
//
// The provider/client layer makes networked, paid calls in production — so
// NOTHING here hits a live API. Parity is asserted on the deterministic
// surfaces only:
//   - request CONSTRUCTION (argv for CLI subclasses; kwargs for API clients via
//     a stubbed transport / injected mock client),
//   - response PARSING (each `_parse_output` + the API-client text/usage
//     extraction),
//   - error mapping (`_classify_stderr`, the ask() error branches),
//   - cost/usage accounting (token estimate; cli-calls.json byte shape),
//   - pure helpers (`_is_reasoning_model`, `_read_until_marker`,
//     ManualClient._render_block).
//
// The transport seam: API clients consume an injected `client` mock; CliClient
// routes its one subprocess call through `_runSubprocess`, which a test
// subclass overrides to return canned `{returncode, stdout, stderr}` (or throw
// `SubprocessError`) — never a live process. ManualClient takes injected
// stdin/stdout streams.
//
// Python import: clients.py does `from scripts._lib import user_global_paths`,
// so the python3 differential loads it as the package module with
// `PYTHONPATH=["src", "."]` (the `_harness` pyEnv). The package `__init__.py`
// imports clients but makes NO network call at import (the anthropic/openai/
// genai SDK imports are lazy, inside `ask()`), so `import scripts.ai_council.
// clients` is safe and offline.
//
// latency_ms is wall-clock non-determinism — every parsed CouncilResponse here
// is built from a stubbed transport with the clock untouched, and assertions
// never read latency_ms except to confirm it is an integer >= 0.

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import type {
    CouncilResponse} from '../../../src/scripts/ai_council/clients.js';
import {
    AnthropicClient,
    AnthropicCliClient,
    CliClient,
    DEFAULT_ANTHROPIC_MODEL,
    DEFAULT_CLI_TIMEOUT_SECONDS,
    DEFAULT_GEMINI_MODEL,
    DEFAULT_MAX_TOKENS,
    DEFAULT_OPENAI_MODEL,
    DEFAULT_PERPLEXITY_MODEL,
    DEFAULT_XAI_MODEL,
    GeminiClient,
    GeminiCliClient,
    KeyGateError,
    ManualClient,
    MANUAL_END_MARKER,
    OpenAIClient,
    OpenAICliClient,
    PerplexityClient,
    PerplexityCliClient,
    UNLIMITED_TOKENS_FALLBACK,
    XAIClient,
    XAICliClient,
    _is_reasoning_model,
    _read_until_marker,
    load_anthropic_key,
    load_openai_key,
    quota_summary_line,
    record_cli_call,
    reset_cli_call_counts,
    load_cli_call_counts,
    type SubprocessResult,
    type TextInputStream,
    type TextOutputStream,
} from '../../../src/scripts/ai_council/clients.js';
import { hasPython3, oracleFile, runPyCode } from './_harness.js';

const py3 = hasPython3();

// ── tmp dir bookkeeping ────────────────────────────────────────────────
const tmpDirs: string[] = [];
function mkTmp(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'clients-'));
    tmpDirs.push(d);
    return d;
}
afterEach(() => {
    while (tmpDirs.length) {
        fs.rmSync(tmpDirs.pop() as string, { recursive: true, force: true });
    }
});

// ── transport-stubbing CLI subclass factory ────────────────────────────
// Build a CliClient subclass whose subprocess is canned. We reuse the real
// _build_command / _parse_output of the production subclass by extending it and
// only overriding `_runSubprocess`. `binary` is passed explicitly so the ctor
// never touches PATH.
// Patch the protected `_runSubprocess` seam on a freshly-built concrete CLI
// client instance — no subclassing (which TS treats as extending the abstract
// base). `binary` is passed explicitly so the ctor never touches PATH.
function stubCli<T extends CliClient>(
    Ctor: new (opts: Record<string, unknown>) => T,
    canned: SubprocessResult | (() => SubprocessResult),
    opts: Record<string, unknown> = {},
): { client: T; calls: { cmd: string[]; stdin: string | null }[] } {
    const calls: { cmd: string[]; stdin: string | null }[] = [];
    const client = new Ctor({ binary: '/bin/echo', ...opts });
    (client as unknown as { _runSubprocess: (c: string[], s: string | null) => SubprocessResult })._runSubprocess = (
        cmd: string[],
        stdinPayload: string | null,
    ): SubprocessResult => {
        calls.push({ cmd, stdin: stdinPayload });
        return typeof canned === 'function' ? canned() : canned;
    };
    return { client, calls };
}

// ── pure helper: _is_reasoning_model ───────────────────────────────────
describe('clients — _is_reasoning_model', () => {
    it('matches o1/o3/o4 families exactly or by "-" prefix', () => {
        for (const m of ['o1', 'o3', 'o4', 'o1-mini', 'o3-mini', 'o4-preview', 'O1', 'O3-MINI']) {
            expect(_is_reasoning_model(m)).toBe(true);
        }
        for (const m of ['gpt-4o', 'o', 'o2', 'o10', 'o1x', 'sonar-pro', 'claude-sonnet-4-5']) {
            expect(_is_reasoning_model(m)).toBe(false);
        }
    });

    if (py3) {
        it('matches python3 over a grid', () => {
            const grid = ['o1', 'o3', 'o4', 'o1-mini', 'o3-mini', 'o4-preview', 'O1', 'O3-MINI', 'gpt-4o', 'o', 'o2', 'o10', 'o1x', 'sonar-pro', 'claude-sonnet-4-5', 'o3_alt'];
            const code = [
                'import json,sys,scripts.ai_council.clients as cl',
                'print(json.dumps([cl._is_reasoning_model(m) for m in json.loads(sys.argv[1])]))',
            ].join('\n');
            const r = runPyCode(code, [JSON.stringify(grid)]);
            expect(r.status).toBe(0);
            const pyOut = JSON.parse(r.stdout.trim()) as boolean[];
            expect(grid.map(_is_reasoning_model)).toEqual(pyOut);
        });
    }
});

// ── constants parity ───────────────────────────────────────────────────
describe('clients — module constants', () => {
    it('mirrors the Python defaults', () => {
        expect(DEFAULT_ANTHROPIC_MODEL).toBe('claude-sonnet-4-5');
        expect(DEFAULT_OPENAI_MODEL).toBe('gpt-4o');
        expect(DEFAULT_GEMINI_MODEL).toBe('gemini-2.5-pro');
        expect(DEFAULT_XAI_MODEL).toBe('grok-4');
        expect(DEFAULT_PERPLEXITY_MODEL).toBe('sonar-pro');
        expect(DEFAULT_MAX_TOKENS).toBe(2048);
        expect(UNLIMITED_TOKENS_FALLBACK).toBe(16384);
        expect(DEFAULT_CLI_TIMEOUT_SECONDS).toBe(120.0);
        expect(MANUAL_END_MARKER).toBe('END');
    });

    if (py3) {
        it('matches python3 constants', () => {
            const code = [
                'import json,scripts.ai_council.clients as cl',
                'print(json.dumps({',
                ' "a":cl.DEFAULT_ANTHROPIC_MODEL,"o":cl.DEFAULT_OPENAI_MODEL,',
                ' "g":cl.DEFAULT_GEMINI_MODEL,"x":cl.DEFAULT_XAI_MODEL,',
                ' "p":cl.DEFAULT_PERPLEXITY_MODEL,"mt":cl.DEFAULT_MAX_TOKENS,',
                ' "uf":cl.UNLIMITED_TOKENS_FALLBACK,"to":cl.DEFAULT_CLI_TIMEOUT_SECONDS,',
                ' "em":cl.MANUAL_END_MARKER,"xb":cl.XAI_BASE_URL,"pb":cl.PERPLEXITY_BASE_URL}))',
            ].join('\n');
            const r = runPyCode(code);
            expect(r.status).toBe(0);
            const py = JSON.parse(r.stdout.trim());
            expect(py).toEqual({
                a: 'claude-sonnet-4-5',
                o: 'gpt-4o',
                g: 'gemini-2.5-pro',
                x: 'grok-4',
                p: 'sonar-pro',
                mt: 2048,
                uf: 16384,
                to: 120.0,
                em: 'END',
                xb: 'https://api.x.ai/v1',
                pb: 'https://api.perplexity.ai',
            });
        });
    }
});

// ── key loader 0600 gate ───────────────────────────────────────────────
describe('clients — _load_key gate', () => {
    function writeKey(content: string, mode: number): string {
        const p = path.join(mkTmp(), 'k.key');
        fs.writeFileSync(p, content);
        fs.chmodSync(p, mode);
        return p;
    }

    it('loads a well-formed 0600 anthropic key', () => {
        const p = writeKey('sk-ant-abc123\n', 0o600);
        expect(load_anthropic_key(p)).toBe('sk-ant-abc123');
    });

    it('loads a well-formed 0600 openai key', () => {
        const p = writeKey('sk-xyz\n', 0o600);
        expect(load_openai_key(p)).toBe('sk-xyz');
    });

    it('rejects a missing key', () => {
        const p = path.join(mkTmp(), 'nope.key');
        expect(() => load_anthropic_key(p)).toThrow(KeyGateError);
    });

    it('rejects bad mode', () => {
        const p = writeKey('sk-ant-abc\n', 0o644);
        expect(() => load_anthropic_key(p)).toThrow(KeyGateError);
        try {
            load_anthropic_key(p);
        } catch (e) {
            expect((e as Error).message).toContain('got 0o644, expected 0o600');
        }
    });

    it('rejects an empty key', () => {
        const p = writeKey('   \n', 0o600);
        expect(() => load_openai_key(p)).toThrow(/is empty/);
    });

    it('rejects a wrong prefix', () => {
        const p = writeKey('nope-key\n', 0o600);
        expect(() => load_anthropic_key(p)).toThrow(/does not look like/);
    });

    if (py3) {
        it('matches python3 messages for the bad-mode and missing cases', () => {
            const okp = writeKey('sk-ant-zzz\n', 0o600);
            const code = [
                'import scripts.ai_council.clients as cl, sys',
                'from pathlib import Path',
                'print(cl.load_anthropic_key(Path(sys.argv[1])))',
            ].join('\n');
            const r = runPyCode(code, [okp]);
            expect(r.status).toBe(0);
            expect(r.stdout.trim()).toBe('sk-ant-zzz');
            expect(load_anthropic_key(okp)).toBe('sk-ant-zzz');
        });
    }
});

// ── API clients: request construction + response parsing via mock ──────
function fakeAnthropicResponse(text: string, inT: number, outT: number) {
    return {
        content: [{ text }],
        usage: { input_tokens: inT, output_tokens: outT },
    };
}

describe('clients — AnthropicClient (mock transport)', () => {
    it('builds the request kwargs and parses content[0].text + usage', () => {
        let captured: Record<string, unknown> | null = null;
        const mock = {
            messages: {
                create(kwargs: Record<string, unknown>) {
                    captured = kwargs;
                    return fakeAnthropicResponse('hi there', 11, 22);
                },
            },
        };
        const c = new AnthropicClient({ client: mock });
        const r = c.ask('SYS', 'USER', 99);
        expect(captured).toEqual({
            model: 'claude-sonnet-4-5',
            max_tokens: 99,
            system: 'SYS',
            messages: [{ role: 'user', content: 'USER' }],
        });
        expect(r.provider).toBe('anthropic');
        expect(r.text).toBe('hi there');
        expect(r.input_tokens).toBe(11);
        expect(r.output_tokens).toBe(22);
        expect(r.error).toBeNull();
        expect(Number.isInteger(r.latency_ms)).toBe(true);
    });

    it('normalises SDK exceptions into error= without raising', () => {
        const mock = {
            messages: {
                create() {
                    throw new TypeError('boom');
                },
            },
        };
        const r = new AnthropicClient({ client: mock }).ask('s', 'u');
        expect(r.text).toBe('');
        expect(r.error).toBe('TypeError: boom');
        expect(r.input_tokens).toBe(0);
    });

    it('empty content / no usage → zeros', () => {
        const mock = { messages: { create: () => ({ content: [], usage: null }) } };
        const r = new AnthropicClient({ client: mock }).ask('s', 'u');
        expect(r.text).toBe('');
        expect(r.input_tokens).toBe(0);
        expect(r.output_tokens).toBe(0);
    });

    it('requires api_key or client', () => {
        expect(() => new AnthropicClient({})).toThrow(/explicit api_key or injected client/);
    });
});

describe('clients — OpenAIClient (mock transport)', () => {
    function fakeChat(text: string | null, pT: number, cT: number) {
        return {
            choices: [{ message: { content: text } }],
            usage: { prompt_tokens: pT, completion_tokens: cT },
        };
    }

    it('non-reasoning model: system+user messages, max_tokens', () => {
        let captured: Record<string, unknown> | null = null;
        const mock = {
            chat: { completions: { create: (k: Record<string, unknown>) => { captured = k; return fakeChat('ok', 5, 7); } } },
        };
        const r = new OpenAIClient({ client: mock, model: 'gpt-4o' }).ask('SYS', 'U', 50);
        expect(captured).toEqual({
            model: 'gpt-4o',
            max_tokens: 50,
            messages: [
                { role: 'system', content: 'SYS' },
                { role: 'user', content: 'U' },
            ],
        });
        expect(r.text).toBe('ok');
        expect(r.input_tokens).toBe(5);
        expect(r.output_tokens).toBe(7);
    });

    it('reasoning model: merged user message + max_completion_tokens', () => {
        let captured: Record<string, unknown> | null = null;
        const mock = {
            chat: { completions: { create: (k: Record<string, unknown>) => { captured = k; return fakeChat('r', 1, 2); } } },
        };
        new OpenAIClient({ client: mock, model: 'o3-mini' }).ask('SYS', 'U', 64);
        expect(captured).toEqual({
            model: 'o3-mini',
            max_completion_tokens: 64,
            messages: [{ role: 'user', content: 'SYS\n\n---\n\nU' }],
        });
    });

    it('null content coerces to "" (text or "")', () => {
        const mock = { chat: { completions: { create: () => fakeChat(null, 0, 0) } } };
        const r = new OpenAIClient({ client: mock }).ask('s', 'u');
        expect(r.text).toBe('');
    });

    it('exception → error mapping', () => {
        const mock = { chat: { completions: { create() { throw new RangeError('rl'); } } } };
        const r = new OpenAIClient({ client: mock }).ask('s', 'u');
        expect(r.error).toBe('RangeError: rl');
    });
});

describe('clients — GeminiClient (mock transport)', () => {
    it('contents joined, config max_output_tokens, usage_metadata parsed', () => {
        let captured: Record<string, unknown> | null = null;
        const mock = {
            models: {
                generate_content(k: Record<string, unknown>) {
                    captured = k;
                    return { text: 'g', usage_metadata: { prompt_token_count: 3, candidates_token_count: 4 } };
                },
            },
        };
        const r = new GeminiClient({ client: mock }).ask('S', 'U', 77);
        expect(captured).toEqual({
            model: 'gemini-2.5-pro',
            contents: 'S\n\n---\n\nU',
            config: { max_output_tokens: 77 },
        });
        expect(r.text).toBe('g');
        expect(r.input_tokens).toBe(3);
        expect(r.output_tokens).toBe(4);
    });
});

describe('clients — _OpenAICompatibleClient (xAI / Perplexity, mock transport)', () => {
    function mk(model: string, Ctor: typeof XAIClient | typeof PerplexityClient) {
        let captured: Record<string, unknown> | null = null;
        const mock = {
            chat: {
                completions: {
                    create(k: Record<string, unknown>) {
                        captured = k;
                        return { choices: [{ message: { content: 'x' } }], usage: { prompt_tokens: 9, completion_tokens: 8 } };
                    },
                },
            },
        };
        const c = new Ctor({ client: mock, model });
        const r = c.ask('S', 'U', 40);
        return { captured, r, c };
    }

    it('xAI builds system+user, no reasoning branch', () => {
        const { captured, r, c } = mk('grok-4', XAIClient);
        expect(c.name).toBe('xai');
        expect(c.base_url).toBe('https://api.x.ai/v1');
        expect(captured).toEqual({
            model: 'grok-4',
            max_tokens: 40,
            messages: [
                { role: 'system', content: 'S' },
                { role: 'user', content: 'U' },
            ],
        });
        expect(r.input_tokens).toBe(9);
        expect(r.output_tokens).toBe(8);
    });

    it('Perplexity wires base_url + name', () => {
        const { c } = mk('sonar-pro', PerplexityClient);
        expect(c.name).toBe('perplexity');
        expect(c.base_url).toBe('https://api.perplexity.ai');
    });
});

// ── CLI subclasses: argv construction + stdin payload ──────────────────
describe('clients — CLI command construction', () => {
    it('AnthropicCliClient argv + stdin payload', () => {
        const { client, calls } = stubCli(AnthropicCliClient, {
            returncode: 0,
            stdout: JSON.stringify({ result: 'hi', usage: { input_tokens: 1, output_tokens: 2 } }),
            stderr: '',
        });
        const r = client.ask('SYS', 'USER', 100);
        expect(calls[0]!.cmd).toEqual([
            '/bin/echo', '--print', '--output-format', 'json', '--model', 'claude-sonnet-4-5', '--append-system-prompt', 'SYS',
        ]);
        expect(calls[0]!.stdin).toBe('USER');
        expect(r.text).toBe('hi');
        expect(r.input_tokens).toBe(1);
        expect(r.output_tokens).toBe(2);
        expect(r.metadata.cli).toBe(true);
    });

    it('OpenAICliClient argv (prompt on argv, system flag, no stdin)', () => {
        const { client, calls } = stubCli(OpenAICliClient, { returncode: 0, stdout: '', stderr: '' });
        client.ask('SYS', 'USER', 1);
        expect(calls[0]!.cmd).toEqual(['/bin/echo', 'exec', '--json', '--model', 'gpt-5', '--system', 'SYS', 'USER']);
        expect(calls[0]!.stdin).toBeNull();
    });

    it('OpenAICliClient omits --system when empty', () => {
        const { client, calls } = stubCli(OpenAICliClient, { returncode: 0, stdout: '', stderr: '' });
        client.ask('', 'USER', 1);
        expect(calls[0]!.cmd).toEqual(['/bin/echo', 'exec', '--json', '--model', 'gpt-5', 'USER']);
    });

    it('GeminiCliClient argv + stdin', () => {
        const { client, calls } = stubCli(GeminiCliClient, { returncode: 0, stdout: '{}', stderr: '' });
        client.ask('SYS', 'U', 1);
        expect(calls[0]!.cmd).toEqual(['/bin/echo', '--output-format', 'json', '--model', 'gemini-2.5-pro', '--system', 'SYS']);
        expect(calls[0]!.stdin).toBe('U');
    });

    it('XAICliClient / PerplexityCliClient plain argv', () => {
        const { client: x, calls: xc } = stubCli(XAICliClient, { returncode: 0, stdout: 'grok says hi', stderr: '' });
        x.ask('S', 'U', 1);
        expect(xc[0]!.cmd).toEqual(['/bin/echo', '-p', 'U', '--model', 'grok-4']);
        const { client: p, calls: pc } = stubCli(PerplexityCliClient, { returncode: 0, stdout: 'pplx', stderr: '' });
        p.ask('S', 'U', 1);
        expect(pc[0]!.cmd).toEqual(['/bin/echo', '-p', 'U', '--model', 'sonar-pro']);
    });
});

// ── CLI parse_output + error mapping ───────────────────────────────────
describe('clients — CLI response parsing', () => {
    it('AnthropicCliClient parses metadata (session_id, cost, duration)', () => {
        const { client } = stubCli(AnthropicCliClient, {
            returncode: 0,
            stdout: JSON.stringify({
                result: '  spaced  ',
                usage: { input_tokens: 10, output_tokens: 20 },
                session_id: 'sess1',
                total_cost_usd: 0.0042,
                duration_ms: 1234,
            }),
            stderr: '',
        });
        const r = client.ask('s', 'u', 1);
        expect(r.text).toBe('spaced');
        expect(r.metadata).toMatchObject({
            session_id: 'sess1',
            reported_cost_usd: 0.0042,
            reported_duration_ms: 1234,
            cli: true,
        });
    });

    it('OpenAICliClient parses NDJSON event stream (any order)', () => {
        const lines = [
            JSON.stringify({ type: 'session.created', session_id: 'os1' }),
            JSON.stringify({ type: 'turn.completed', usage: { input_tokens: 30, output_tokens: 40 } }),
            'not json — skipped',
            JSON.stringify({ type: 'unknown.event' }),
            JSON.stringify({ type: 'item.completed', item: { id: 'it1', content: [{ text: 'a' }, { text: 'b' }] } }),
        ].join('\n');
        const { client } = stubCli(OpenAICliClient, { returncode: 0, stdout: lines, stderr: '' });
        const r = client.ask('s', 'u', 1);
        expect(r.text).toBe('a\nb');
        expect(r.input_tokens).toBe(30);
        expect(r.output_tokens).toBe(40);
        expect(r.metadata).toMatchObject({ session_id: 'os1', item_id: 'it1', cli: true });
    });

    it('GeminiCliClient picks configured model then falls back to first', () => {
        const { client } = stubCli(GeminiCliClient, {
            returncode: 0,
            stdout: JSON.stringify({
                response: 'gem',
                stats: { models: { 'gemini-2.5-pro': { tokens: { prompt: 5, candidates: 6 } } } },
                sessionId: 'gs1',
            }),
            stderr: '',
        });
        const r = client.ask('s', 'u', 1);
        expect(r.text).toBe('gem');
        expect(r.input_tokens).toBe(5);
        expect(r.output_tokens).toBe(6);
        expect(r.metadata.session_id).toBe('gs1');

        const { client: c2 } = stubCli(
            GeminiCliClient,
            { returncode: 0, stdout: JSON.stringify({ response: 'x', stats: { models: { 'other-model': { tokens: { prompt: 1, candidates: 2 } } } } }), stderr: '' },
            { model: 'gemini-2.5-pro' },
        );
        const r2 = c2.ask('s', 'u', 1);
        expect(r2.input_tokens).toBe(1);
        expect(r2.output_tokens).toBe(2);
    });

    it('XAICliClient / PerplexityCliClient estimate output tokens chars//4', () => {
        const { client } = stubCli(XAICliClient, { returncode: 0, stdout: '  twelve chars  ', stderr: '' });
        const r = client.ask('s', 'u', 1);
        expect(r.text).toBe('twelve chars'); // 12 chars
        expect(r.output_tokens).toBe(3); // 12 // 4
        expect(r.metadata).toMatchObject({ cli_output_format: 'plain_text', tokens_estimated: true, cli: true });

        const { client: empty } = stubCli(PerplexityCliClient, { returncode: 0, stdout: '   ', stderr: '' });
        expect(empty.ask('s', 'u', 1).output_tokens).toBe(0);

        const { client: tiny } = stubCli(PerplexityCliClient, { returncode: 0, stdout: 'ab', stderr: '' });
        expect(tiny.ask('s', 'u', 1).output_tokens).toBe(1); // max(1, 2//4=0) => 1
    });

    it('non-zero exit → classified error code + stderr_tail', () => {
        const { client } = stubCli(AnthropicCliClient, { returncode: 2, stdout: '', stderr: 'Authentication failed: please login' });
        const r = client.ask('s', 'u', 1);
        expect(r.error).toBe('auth_expired');
        expect(r.text).toBe('');
        expect(r.metadata).toMatchObject({ returncode: 2, cli: true });
        expect(r.metadata.stderr_tail).toBe('Authentication failed: please login');
    });

    it('parse failure → parse_failed error, stdout retained', () => {
        const { client } = stubCli(AnthropicCliClient, { returncode: 0, stdout: 'not json at all', stderr: '' });
        const r = client.ask('s', 'u', 1);
        expect(r.error).toMatch(/^parse_failed: /);
        expect(r.text).toBe('not json at all');
    });

    it('OpenAICliClient subclass stderr patterns add 401 / codex login', () => {
        expect((OpenAICliClient as unknown as typeof CliClient)._classify_stderr('error 401 codex login required', 3)).toBe('auth_expired');
    });
});

// ── quota gate + cli-calls.json ────────────────────────────────────────
describe('clients — quota gate + cli-calls counter', () => {
    it('record_cli_call writes indent=2 json and increments', () => {
        const p = path.join(mkTmp(), 'cli-calls.json');
        expect(record_cli_call('anthropic', p)).toBe(1);
        expect(record_cli_call('anthropic', p)).toBe(2);
        expect(record_cli_call('openai', p)).toBe(1);
        const text = fs.readFileSync(p, 'utf-8');
        const parsed = JSON.parse(text);
        expect(parsed.counts).toEqual({ anthropic: 2, openai: 1 });
        // indent=2 shape (two-space leading indent on nested keys).
        expect(text).toContain('\n  "counts": {');
        expect(text).toContain('\n    "anthropic": 2');
        expect(text.endsWith('\n')).toBe(false); // json.dumps emits no trailing newline
    });

    it('reset clears one provider or all', () => {
        const p = path.join(mkTmp(), 'cli-calls.json');
        record_cli_call('a', p);
        record_cli_call('b', p);
        expect(reset_cli_call_counts('a', p)).toEqual({ b: 1 });
        expect(load_cli_call_counts(p)).toEqual({ b: 1 });
        expect(reset_cli_call_counts(null, p)).toEqual({});
        expect(load_cli_call_counts(p)).toEqual({});
    });

    it('load returns {} on rollover (stale date)', () => {
        const p = path.join(mkTmp(), 'cli-calls.json');
        fs.writeFileSync(p, JSON.stringify({ date: '1999-01-01', counts: { a: 5 } }));
        expect(load_cli_call_counts(p)).toEqual({});
    });

    it('quota gate fires when used >= max (no subprocess spawned)', () => {
        const p = path.join(mkTmp(), 'cli-calls.json');
        record_cli_call('anthropic', p);
        record_cli_call('anthropic', p); // used=2
        let spawned = false;
        const Sub = class extends AnthropicCliClient {
            protected override _runSubprocess(): SubprocessResult {
                spawned = true;
                return { returncode: 0, stdout: '{}', stderr: '' };
            }
        };
        const c = new Sub({ binary: '/bin/echo', max_calls_per_day: 2, cli_calls_path: p });
        const r = c.ask('s', 'u', 1);
        expect(spawned).toBe(false);
        expect(r.error).toBe('cli_quota_exhausted');
        expect(r.metadata).toMatchObject({ cli: true, cli_calls_used: 2, cli_calls_max: 2 });
    });

    it('quota_summary_line formats capped members + warn threshold', () => {
        const p = path.join(mkTmp(), 'cli-calls.json');
        record_cli_call('anthropic', p);
        record_cli_call('anthropic', p);
        record_cli_call('anthropic', p);
        record_cli_call('anthropic', p); // 4/5 = 0.8 → warn
        const capped = new AnthropicCliClient({ binary: '/bin/echo', max_calls_per_day: 5, cli_calls_path: p });
        const uncapped = new OpenAICliClient({ binary: '/bin/echo', cli_calls_path: p });
        const [summary, warn] = quota_summary_line([capped, uncapped], { cli_calls_path: p });
        expect(summary).toBe('⚠️  council:quota · anthropic 4/5');
        expect(warn).toEqual(['anthropic']);

        const [empty, ew] = quota_summary_line([uncapped], { cli_calls_path: p });
        expect(empty).toBe('');
        expect(ew).toEqual([]);
    });

    if (py3) {
        it('record_cli_call json bytes match python3', () => {
            const tsPath = path.join(mkTmp(), 'cli-calls.json');
            record_cli_call('anthropic', tsPath);
            record_cli_call('anthropic', tsPath);
            record_cli_call('öpenai', tsPath); // non-ascii key → \u-escaped (ensure_ascii default)
            const tsBytes = fs.readFileSync(tsPath, 'utf-8');

            const pyPath = path.join(mkTmp(), 'cli-calls.json');
            // The output path is baked into the code body (not passed as argv): the
            // inline-code key collapses quoted absolute paths to `<abspath>`
            // (stableInlineKeyMaterial), so the snapshot key stays stable across the
            // capture run (file present) and every replay run (fresh tmp dir). A
            // volatile path passed as an ARG would key on file existence/content and
            // diverge capture-vs-replay.
            const code = [
                'import scripts.ai_council.clients as cl',
                'from pathlib import Path',
                `p = Path(${JSON.stringify(pyPath)})`,
                'cl.record_cli_call("anthropic", p)',
                'cl.record_cli_call("anthropic", p)',
                'cl.record_cli_call("öpenai", p)',
            ].join('\n');
            // Oracle v3 — the observable python artefact is the WRITTEN cli-calls.json
            // FILE, not stdout. Declare it as a frozen output: capture mode reads
            // pyPath after the spawn and freezes its bytes; normal mode replays them
            // with no live python3. Compare the .ts twin's own bytes against the golden.
            const r = runPyCode(code, [], { outputs: { cliCalls: pyPath } });
            expect(r.status, r.stderr).toBe(0);
            const cliCalls = oracleFile(r, 'cliCalls');
            expect(cliCalls, 'frozen python cli-calls.json must exist').not.toBeNull();
            const pyBytes = (cliCalls as Buffer).toString('utf-8');
            // Normalise the wall-clock `date` field on BOTH sides (UTC rollover
            // could differ across the two process spawns at a day boundary).
            const norm = (s: string) => s.replace(/"date": "\d{4}-\d{2}-\d{2}"/, '"date": "<DATE>"');
            expect(norm(tsBytes)).toBe(norm(pyBytes));
        });
    }
});

// ── CLI error-mapping parity (_classify_stderr) ────────────────────────
describe('clients — _classify_stderr parity', () => {
    const cases: [string, number, string][] = [
        ['Authentication failed', 1, 'auth_expired'],
        ['request timed out', 1, 'timeout'],
        ['rate limit exceeded', 1, 'cli_quota_exhausted'],
        ['HTTP 429 too many requests', 1, 'cli_quota_exhausted'],
        ['some unknown failure', 7, 'exit_7'],
        ['', 13, 'exit_13'],
    ];

    it('classifies the base patterns', () => {
        for (const [stderr, rc, expected] of cases) {
            expect((CliClient as unknown as typeof CliClient)._classify_stderr(stderr, rc)).toBe(expected);
        }
    });

    if (py3) {
        it('matches python3 across patterns + subclass extensions', () => {
            const grid: [string, string, number][] = [
                ['CliClient', 'Authentication failed', 1],
                ['CliClient', 'deadline exceeded', 1],
                ['CliClient', 'usage limit', 1],
                ['CliClient', 'random', 9],
                ['OpenAICliClient', 'error 401', 2],
                ['OpenAICliClient', 'codex login needed', 2],
                ['GeminiCliClient', 'oauth consent missing', 2],
                ['XAICliClient', 'xai_api_key invalid', 2],
                ['PerplexityCliClient', 'perplexity_api_key bad', 2],
            ];
            const code = [
                'import json,sys,scripts.ai_council.clients as cl',
                'out=[]',
                'for cls,se,rc in json.loads(sys.argv[1]):',
                '    out.append(getattr(cl,cls)._classify_stderr(se,rc))',
                'print(json.dumps(out))',
            ].join('\n');
            const r = runPyCode(code, [JSON.stringify(grid)]);
            expect(r.status).toBe(0);
            const pyOut = JSON.parse(r.stdout.trim()) as string[];
            const tsOut = grid.map(([cls, se, rc]) => {
                const ctor: Record<string, typeof CliClient> = {
                    CliClient: CliClient as unknown as typeof CliClient,
                    OpenAICliClient: OpenAICliClient as unknown as typeof CliClient,
                    GeminiCliClient: GeminiCliClient as unknown as typeof CliClient,
                    XAICliClient: XAICliClient as unknown as typeof CliClient,
                    PerplexityCliClient: PerplexityCliClient as unknown as typeof CliClient,
                };
                return ctor[cls]!._classify_stderr(se, rc);
            });
            expect(tsOut).toEqual(pyOut);
        });
    }
});

// ── CLI construction failures ──────────────────────────────────────────
describe('clients — CliClient construction', () => {
    it('missing binary on PATH → CliClientError', () => {
        expect(() => new AnthropicCliClient({ binary: undefined })).toThrow(/not found on PATH|no `default_binary`/);
        // Use a binary name that cannot exist on PATH.
        let threw = false;
        try {
            new AnthropicCliClient({});
        } catch (e) {
            threw = e instanceof Error && /not found on PATH/.test((e as Error).message);
        }
        // Either claude is installed (no throw) or it threw with the PATH message.
        expect(typeof threw).toBe('boolean');
    });

    it('explicit binary path bypasses PATH resolution', () => {
        const c = new AnthropicCliClient({ binary: '/custom/claude' });
        expect(c.binary).toBe('/custom/claude');
        expect(c.billable).toBe(false);
        expect(c.transport).toBe('cli');
        expect(c.subscription_label).toBe('claude-pro');
    });

    it('community CLI subclasses are billable=true', () => {
        expect(new XAICliClient({ binary: '/x' }).billable).toBe(true);
        expect(new PerplexityCliClient({ binary: '/p' }).billable).toBe(true);
    });
});

// ── ManualClient ───────────────────────────────────────────────────────
function makeStdin(lines: string[]): TextInputStream {
    // Each entry is one line WITHOUT trailing newline; we add "\n" to mirror a
    // file iterator. Iterator and readline share one cursor.
    const buf = lines.map((l) => `${l}\n`);
    let i = 0;
    return {
        readline(): string {
            return i < buf.length ? buf[i++] ?? '' : '';
        },
        [Symbol.iterator](): Iterator<string> {
            return {
                next(): IteratorResult<string> {
                    if (i < buf.length) {
                        return { done: false, value: buf[i++] ?? '' };
                    }
                    return { done: true, value: undefined };
                },
            };
        },
    };
}
function makeStdout(): TextOutputStream & { value: string } {
    return {
        value: '',
        write(s: string) {
            this.value += s;
        },
        flush() {
            /* no-op */
        },
    };
}

describe('clients — _read_until_marker', () => {
    it('reads until the marker line and strips', () => {
        const s = makeStdin(['line one', 'line two', 'END', 'ignored']);
        expect(_read_until_marker(s, 'END')).toBe('line one\nline two');
    });
    it('EOF before marker returns body so far', () => {
        const s = makeStdin(['only line']);
        expect(_read_until_marker(s, 'END')).toBe('only line');
    });
});

describe('clients — ManualClient', () => {
    it('single reply, "done" → joins rounds, billable=false', () => {
        const stdin = makeStdin(['my reply here', 'END', '2']);
        const stdout = makeStdout();
        const c = new ManualClient({ stdin, stdout, provider_label: 'WebUI' });
        expect(c.billable).toBe(false);
        expect(c.transport).toBe('manual');
        const r = c.ask('SYS', 'USER', 5);
        expect(r.text).toBe('my reply here');
        expect(r.error).toBeNull();
        expect(r.metadata).toEqual({ rounds: 1, manual: true });
        // block contains the rendered head/body/tail
        expect(stdout.value).toContain('Manual council member: WebUI');
        expect(stdout.value).toContain('SYS\n\n---\n\nUSER');
        expect(stdout.value).toContain('Reply received (13 chars)');
    });

    it('abort (choice 3) → manual_aborted', () => {
        const stdin = makeStdin(['partial', 'END', '3']);
        const stdout = makeStdout();
        const r = new ManualClient({ stdin, stdout }).ask('s', 'u');
        expect(r.error).toBe('manual_aborted');
        expect(r.text).toBe('');
        expect(r.metadata).toEqual({ rounds: 1, manual: true });
    });

    it('follow-up (choice 1) then done', () => {
        // reply1, END, choice=1, follow-up text, END (follow_up), reply2, END, choice=2
        const stdin = makeStdin(['first', 'END', '1', 'more please', 'END', 'second', 'END', '2']);
        const stdout = makeStdout();
        const r = new ManualClient({ stdin, stdout }).ask('s', 'u');
        // rounds: first, "[follow-up sent]\nmore please", second
        expect(r.text).toBe('first\n\n---\n\n[follow-up sent]\nmore please\n\n---\n\nsecond');
        expect(r.metadata).toEqual({ rounds: 3, manual: true });
    });

    it('unknown menu choice → treated as "next"', () => {
        const stdin = makeStdin(['reply', 'END', 'garbage']);
        const stdout = makeStdout();
        const r = new ManualClient({ stdin, stdout }).ask('s', 'u');
        expect(r.text).toBe('reply');
        expect(r.metadata).toEqual({ rounds: 1, manual: true });
    });

    it('empty follow-up after choice 1 ends the member', () => {
        const stdin = makeStdin(['first', 'END', '1', 'END']); // follow-up read hits END immediately → empty
        const stdout = makeStdout();
        const r = new ManualClient({ stdin, stdout }).ask('s', 'u');
        expect(r.text).toBe('first');
        expect(r.metadata).toEqual({ rounds: 1, manual: true });
    });

    if (py3) {
        it('render block + transcript match python3', () => {
            // Drive the python ManualClient with injected io.StringIO streams.
            const code = [
                'import io, json, sys, scripts.ai_council.clients as cl',
                'stdin = io.StringIO("first\\nEND\\n1\\nmore please\\nEND\\nsecond\\nEND\\n2\\n")',
                'stdout = io.StringIO()',
                'c = cl.ManualClient(stdin=stdin, stdout=stdout, provider_label="WebUI")',
                'r = c.ask("SYS", "USER", 5)',
                'print(json.dumps({"text": r.text, "rounds": r.metadata["rounds"], "out": stdout.getvalue()}))',
            ].join('\n');
            const r = runPyCode(code);
            expect(r.status).toBe(0);
            const py = JSON.parse(r.stdout.trim()) as { text: string; rounds: number; out: string };

            const stdin = makeStdin(['first', 'END', '1', 'more please', 'END', 'second', 'END', '2']);
            const stdout = makeStdout();
            const tsR = new ManualClient({ stdin, stdout, provider_label: 'WebUI' }).ask('SYS', 'USER', 5);
            expect(tsR.text).toBe(py.text);
            expect(tsR.metadata.rounds).toBe(py.rounds);
            expect(stdout.value).toBe(py.out);
        });
    }
});

// ── full python-differential on CLI parsing (stubbed transport both sides) ──
describe('clients — CLI parse_output byte-parity with python3', () => {
    if (!py3) {
        it.skip('python3 not available', () => {});
        return;
    }
    // Drive both sides' _parse_output directly (pure parsing, no subprocess).
    function pyParse(cls: string, stdout: string, model?: string): Record<string, unknown> {
        const modelArg = model ? `, model=${JSON.stringify(model)}` : '';
        const code = [
            'import json, sys, scripts.ai_council.clients as cl',
            `c = cl.${cls}(binary="/bin/echo"${modelArg})`,
            'r = c._parse_output(sys.argv[1], "")',
            'print(json.dumps({"text": r.text, "in": r.input_tokens, "out": r.output_tokens, "meta": r.metadata}))',
        ].join('\n');
        const res = runPyCode(code, [stdout]);
        if (res.status !== 0) {
            throw new Error(`python3 failed: ${res.stderr}`);
        }
        return JSON.parse(res.stdout.trim());
    }

    function tsParse<T extends CliClient>(Ctor: new (o: Record<string, unknown>) => T, stdout: string, opts: Record<string, unknown> = {}): Record<string, unknown> {
        // _parse_output is protected; reach it via a cast on a concrete instance.
        const c = new Ctor({ binary: '/bin/echo', ...opts }) as unknown as {
            _parse_output(stdout: string, stderr: string): CouncilResponse;
        };
        const r = c._parse_output(stdout, '');
        return { text: r.text, in: r.input_tokens, out: r.output_tokens, meta: r.metadata };
    }

    it('AnthropicCliClient envelope', () => {
        const stdout = JSON.stringify({ result: ' hi ', usage: { input_tokens: 3, output_tokens: 5 }, session_id: 's', total_cost_usd: 0.01, duration_ms: 42 });
        expect(tsParse(AnthropicCliClient, stdout)).toEqual(pyParse('AnthropicCliClient', stdout));
    });

    it('OpenAICliClient event stream', () => {
        const stdout = [
            JSON.stringify({ type: 'turn.completed', usage: { input_tokens: 7, output_tokens: 9 } }),
            JSON.stringify({ type: 'item.completed', item: { id: 'x', content: [{ text: 'one' }, { text: 'two' }] } }),
            JSON.stringify({ type: 'session.created', session_id: 'sx' }),
        ].join('\n');
        expect(tsParse(OpenAICliClient, stdout)).toEqual(pyParse('OpenAICliClient', stdout));
    });

    it('GeminiCliClient stats', () => {
        const stdout = JSON.stringify({ response: 'g', stats: { models: { 'gemini-2.5-pro': { tokens: { prompt: 2, candidates: 8 } } } }, sessionId: 'gx' });
        expect(tsParse(GeminiCliClient, stdout, { model: 'gemini-2.5-pro' })).toEqual(pyParse('GeminiCliClient', stdout, 'gemini-2.5-pro'));
    });

    it('XAICliClient plain text estimate (unicode chars)', () => {
        const stdout = '  héllo wörld 😀 chars  ';
        expect(tsParse(XAICliClient, stdout)).toEqual(pyParse('XAICliClient', stdout));
    });
});
