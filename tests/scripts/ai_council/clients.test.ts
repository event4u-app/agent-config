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
// Python import (HISTORICAL — the oracle is gone): this header used to describe
// how the python3 differential loaded `clients.py`. There is no `clients.py`
// anywhere in the tree and no `.py` file under `src/scripts/ai_council/` at all
// — the Python side was retired with the py2ts port. The `py3`-guarded cases
// below that still run compare against small inline scripts, not against a
// ported module. Kept as a note rather than deleted because a reviewer read the
// old wording as a live parity contract and filed a port-the-change finding
// against a file that does not exist.
//
// latency_ms is wall-clock non-determinism — every parsed CouncilResponse here
// is built from a stubbed transport with the clock untouched, and assertions
// never read latency_ms except to confirm it is an integer >= 0.

import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import type {
    CouncilResponse} from '../../../src/scripts/ai_council/clients.js';
import {
    AnthropicClient,
    AnthropicCliClient,
    assertCacheBreakpointOrder,
    CliClient,
    DEFAULT_ANTHROPIC_CLI_MODEL,
    DEFAULT_ANTHROPIC_MODEL,
    DEFAULT_CLI_TIMEOUT_SECONDS,
    DEFAULT_GEMINI_MODEL,
    DEFAULT_MAX_TOKENS,
    DEFAULT_OPENAI_MODEL,
    DEFAULT_PERPLEXITY_MODEL,
    DEFAULT_PROMPT_CACHE_TTL,
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
    _foldSystemPrompt,
    _is_reasoning_model,
    _read_until_marker,
    load_anthropic_key,
    load_openai_key,
    CLI_CONSUMER_COUNCIL,
    CLI_CONSUMER_TEAM,
    QUOTA_SOURCE_LOCAL_BUDGET,
    QUOTA_SOURCE_PROVIDER,
    quota_summary_line,
    record_cli_call,
    reset_cli_call_counts,
    load_cli_call_attribution,
    load_cli_call_counts,
    SubprocessError,
    type SubprocessResult,
    type TextInputStream,
    type TextOutputStream,
} from '../../../src/scripts/ai_council/clients.js';
import { hasPython3, oracleFile, REPO_ROOT, runPyCode } from './_harness.js';

// Same resolution the shared harness uses — the cross-process booking test below
// needs to spawn real `tsx` processes, which is the only way to exercise a
// cross-process lock from a single-threaded test runner.
const TSX_BIN =
    process.env.TSX_BIN ??
    path.join(
        REPO_ROOT,
        'node_modules',
        '.bin',
        process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
    );

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
    // `cli_calls_path` defaults to a per-call temp file, and that default is
    // load-bearing rather than tidiness.
    //
    // Stubbing `_runSubprocess` does NOT stop `ask()` from booking: step 3 of
    // `ask()` calls `_recordCallQuietly()` unconditionally, which falls back to
    // `_cliCallsStatePath()` — the developer's REAL user-global
    // `~/.event4u/agent-config/cli-calls.json`. Every `stubCli(...).ask(...)` in
    // this file was therefore spending the operator's live daily quota.
    //
    // Measured on this machine, 2026-08-17, before the fix: one run of this file
    // booked +36 real calls (anthropic +8, openai +11, gemini +7, xai +5,
    // perplexity +5). Against the shipped cap of 50/provider/day, TWO runs of
    // one test file exhaust the council — which is exactly the symptom that
    // opened `road-to-council-quota-accounting-truth`: counters at 72/63/99 with
    // no council exchange ever recorded. The overrun was test pollution, not a
    // race and not a late gate.
    //
    // Overridable: a test that wants the real resolution can pass
    // `cli_calls_path` explicitly, including `null`.
    const client = new Ctor({
        cli_calls_path: path.join(mkTmp(), 'cli-calls.json'),
        binary: '/bin/echo',
        ...opts,
    });
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
        // The CLI default is asserted on its PROPERTY rather than its value: it
        // must be a vendor alias for "the latest model in a band", never a dated
        // id. A value assertion here would have to be edited on every refresh
        // and would therefore never fail for the reason that matters — a dated
        // id creeping back into the code default, which is precisely how the
        // stale pin survived in the template for as long as it did.
        //
        // The API default above is DELIBERATELY still a dated id and is not part
        // of this: `/v1/messages` takes model ids, not CLI aliases, so `sonnet`
        // would 404 there. That path keeps a real staleness surface and this
        // change does not close it.
        expect(DEFAULT_ANTHROPIC_CLI_MODEL).toMatch(/^(fable|opus|sonnet|haiku)$/);
        expect(DEFAULT_OPENAI_MODEL).toBe('gpt-4o');
        expect(DEFAULT_GEMINI_MODEL).toBe('gemini-2.5-pro');
        expect(DEFAULT_XAI_MODEL).toBe('grok-4');
        expect(DEFAULT_PERPLEXITY_MODEL).toBe('sonar-pro');
        expect(DEFAULT_MAX_TOKENS).toBe(2048);
        expect(UNLIMITED_TOKENS_FALLBACK).toBe(16384);
        // DELIBERATE DIVERGENCE from the Python mirror (2026-08-13): 120 → 300,
        // matching the API transport, which diverged the same way in 2026-06-24
        // for the same symptom. The mirrored source is retired and cannot be
        // reintroduced (`no-python-in-src`), so parity here documents where a
        // value CAME FROM — it cannot outrank a live-behaviour repair. Measured:
        // at 120 a deep design run returned `0/2 present — INCONCLUSIVE`, both
        // members `error: timeout` at ~123 s.
        expect(DEFAULT_CLI_TIMEOUT_SECONDS).toBe(300.0);
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
        // Caching is explicit opt-in (default OFF): a plain client sends plain
        // string system + user — no cache_control, no surprise write premium.
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

    it('opt-in: enable_prompt_cache=true sends cache-controlled system + user blocks', () => {
        let captured: Record<string, unknown> | null = null;
        const mock = {
            messages: {
                create(kwargs: Record<string, unknown>) {
                    captured = kwargs;
                    return fakeAnthropicResponse('ok', 1, 2);
                },
            },
        };
        new AnthropicClient({ client: mock, enable_prompt_cache: true }).ask('SYS', 'USER', 99);
        expect(captured).toEqual({
            model: 'claude-sonnet-4-5',
            max_tokens: 99,
            system: [{ type: 'text', text: 'SYS', cache_control: { type: 'ephemeral' } }],
            messages: [
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: 'USER', cache_control: { type: 'ephemeral' } },
                    ],
                },
            ],
        });
    });

    it('parses cache_creation/cache_read tokens from usage (0 when absent)', () => {
        const mockCached = {
            messages: {
                create: () => ({
                    content: [{ type: 'text', text: 'ok' }],
                    usage: {
                        input_tokens: 100,
                        output_tokens: 20,
                        cache_creation_input_tokens: 300,
                        cache_read_input_tokens: 1200,
                    },
                }),
            },
        };
        const r = new AnthropicClient({ client: mockCached }).ask('s', 'u');
        expect(r.cache_creation_input_tokens).toBe(300);
        expect(r.cache_read_input_tokens).toBe(1200);
        // Absent cache fields default to 0.
        const r0 = new AnthropicClient({
            client: { messages: { create: () => fakeAnthropicResponse('ok', 5, 6) } },
        }).ask('s', 'u');
        expect(r0.cache_creation_input_tokens).toBe(0);
        expect(r0.cache_read_input_tokens).toBe(0);
    });

    it('joins text blocks and skips a leading thinking block (extended-thinking models)', () => {
        // Regression: extended-thinking models (e.g. claude-fable-5) return a
        // `thinking` block FIRST. The legacy `content[0].text` extraction dropped
        // the real answer (observed live: 3191 output_tokens, text len 0).
        const mock = {
            messages: {
                create: () => ({
                    content: [
                        { type: 'thinking', thinking: 'internal reasoning…' },
                        { type: 'text', text: 'the real answer' },
                    ],
                    usage: { input_tokens: 5, output_tokens: 9 },
                }),
            },
        };
        const r = new AnthropicClient({ client: mock }).ask('s', 'u');
        expect(r.text).toBe('the real answer');
        expect(r.output_tokens).toBe(9);
    });

    it('concatenates multiple text blocks in order', () => {
        const mock = {
            messages: {
                create: () => ({
                    content: [
                        { type: 'text', text: 'part one ' },
                        { type: 'text', text: 'part two' },
                    ],
                    usage: { input_tokens: 1, output_tokens: 2 },
                }),
            },
        };
        expect(new AnthropicClient({ client: mock }).ask('s', 'u').text).toBe('part one part two');
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
            '/bin/echo', '--print', '--output-format', 'json', '--model', 'sonnet',
            '--tools', '', '--append-system-prompt', 'SYS',
        ]);
        expect(calls[0]!.stdin).toBe('USER');
        expect(r.text).toBe('hi');
        expect(r.input_tokens).toBe(1);
        expect(r.output_tokens).toBe(2);
        expect(r.metadata.cli).toBe(true);
    });

    it('AnthropicCliClient grants the spawned agent NO tools, for every system prompt', () => {
        // Asserted as a property rather than left to the argv literal above.
        // The literal is the shape a refactor reorders or a "cleanup" drops, and
        // the sibling openai defect survived precisely because its argv test
        // pinned the broken command as expected — a test that transcribes the
        // command cannot notice the command is wrong.
        //
        // `claude` is an agentic CLI: absent `--tools`, the spawned session gets
        // the full built-in set. A council member reads a question and returns
        // an opinion, so any tool at all is an over-broad grant
        // (`tool-safety` § Least Agency).
        for (const sys of ['', 'SYS', 'a'.repeat(5000)]) {
            const { client, calls } = stubCli(AnthropicCliClient, { returncode: 0, stdout: '{}', stderr: '' });
            client.ask(sys, 'USER', 100);
            const cmd = calls[0]!.cmd;
            const at = cmd.indexOf('--tools');
            expect(at).toBeGreaterThan(-1);
            expect(cmd[at + 1]).toBe('');
        }
    });

    it('the CLI spawn runs OUTSIDE the caller repository, so no project hook chain reaches the member', () => {
        // Exercised through the REAL `_runSubprocess` — the stub used elsewhere
        // in this file replaces the spawn wholesale and would happily pass while
        // the cwd option was missing, which is the "defined but not wired" shape
        // this assertion exists to refuse. `/bin/pwd` prints the directory the
        // child actually ran in, so the spawn option is what is measured rather
        // than a constant that merely exists.
        class PwdClient extends AnthropicCliClient {
            protected override _build_command(): string[] {
                return ['/bin/pwd'];
            }
            protected override _stdin_payload(): string | null {
                return null;
            }
        }
        const c = new PwdClient({ binary: '/bin/pwd' });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where = ((c as any)._runSubprocess(['/bin/pwd'], null) as { stdout: string }).stdout.trim();
        expect(where).not.toBe('');
        // macOS reports /var/folders/… for a /private/var/folders/… tmpdir, so
        // compare on the resolved real path rather than the string.
        expect(fs.realpathSync(where)).toBe(fs.realpathSync(os.tmpdir()));
        expect(fs.existsSync(path.join(where, 'CLAUDE.md'))).toBe(false);
        expect(fs.existsSync(path.join(where, '.claude'))).toBe(false);
    });

    // ── Phase 5 — least-agency parity across the CLI members ──
    //
    // Baseline recorded 2026-08-23 before this landed:
    // `grep -nE -- "--sandbox|--approval-mode|read-only" clients.ts` returned 0.
    // One of five CLI members carried a bound (`--tools ''`, anthropic) behind a
    // 26-line Least-Agency justification, and the same file built four further
    // members with no equivalent — one of them passing `--skip-git-repo-check`,
    // a guard REMOVAL, with no counterpart. Same role, three enforcement levels.
    //
    // Asserted as a PROPERTY, not transcribed into the argv literal: the sibling
    // openai defect survived for months precisely because its argv test pinned
    // the broken command as expected, and a test that transcribes the command
    // cannot notice the command is wrong.
    //
    // Flags probed against real binaries on 2026-08-23, versions pinned:
    //   codex-cli 0.148.0  → `--sandbox read-only`
    //                        (possible values: read-only, workspace-write,
    //                         danger-full-access)
    //   gemini 0.50.0      → `--approval-mode plan`
    //                        (documented as "plan (read-only mode)")
    // xai (`grok`) and perplexity (`perplexity`) are NOT probed: neither binary
    // resolves on this machine, so their bound is undetermined and is recorded
    // as an honest null in the roadmap rather than asserted here. A member whose
    // bound was never determined must not be rendered as bounded.
    it('OpenAICliClient spawns codex under a read-only sandbox', () => {
        for (const sys of ['', 'SYS', 'a'.repeat(5000)]) {
            const { client, calls } = stubCli(OpenAICliClient, { returncode: 0, stdout: '', stderr: '' });
            client.ask(sys, 'USER', 1);
            const cmd = calls[0]!.cmd;
            const at = cmd.indexOf('--sandbox');
            expect(at).toBeGreaterThan(-1);
            expect(cmd[at + 1]).toBe('read-only');
            // The guard removal keeps its counterpart in the same argv: the
            // trust gate is what makes a worktree usable, the sandbox is what
            // bounds what the session may then do. Dropping either alone is the
            // asymmetry this phase closes.
            expect(cmd).toContain('--skip-git-repo-check');
        }
    });

    it('GeminiCliClient spawns gemini in plan (read-only) approval mode', () => {
        for (const sys of ['', 'SYS', 'a'.repeat(5000)]) {
            const { client, calls } = stubCli(GeminiCliClient, { returncode: 0, stdout: '{}', stderr: '' });
            client.ask(sys, 'USER', 1);
            const cmd = calls[0]!.cmd;
            const at = cmd.indexOf('--approval-mode');
            expect(at).toBeGreaterThan(-1);
            expect(cmd[at + 1]).toBe('plan');
            // Never the escape hatches, on any prompt.
            expect(cmd).not.toContain('--yolo');
            expect(cmd).not.toContain('-y');
        }
    });

    // The negative half, and it is not decoration: a bound is only a bound if the
    // argv cannot also carry the flag that lifts it. `codex` ships two documented
    // bypasses and a test that only checks for the presence of `--sandbox` would
    // pass with both of them alongside it.
    it('no CLI member argv carries a documented agency bypass', () => {
        const BYPASSES = [
            '--dangerously-bypass-approvals-and-sandbox',
            '--dangerously-bypass-hook-trust',
            '--yolo',
            'danger-full-access',
            'workspace-write',
        ];
        for (const Klass of [AnthropicCliClient, OpenAICliClient, GeminiCliClient]) {
            const { client, calls } = stubCli(Klass, { returncode: 0, stdout: '{}', stderr: '' });
            client.ask('SYS', 'USER', 1);
            for (const bad of BYPASSES) {
                expect(calls[0]!.cmd, `${Klass.name} argv carries ${bad}`).not.toContain(bad);
            }
        }
    });

    it('OpenAICliClient argv (prompt on stdin, no --system)', () => {
        const { client, calls } = stubCli(OpenAICliClient, { returncode: 0, stdout: '', stderr: '' });
        client.ask('SYS', 'USER', 1);
        // No `--model`: the subscription transport refuses every pinned model
        // measured so far, so the default omits the flag and lets the CLI
        // choose. `--skip-git-repo-check` is what makes a worktree usable at
        // all — without it codex refuses the directory before reading a prompt.
        expect(calls[0]!.cmd).toEqual([
            '/bin/echo',
            'exec',
            '--json',
            '--skip-git-repo-check',
            '--sandbox',
            'read-only',
            '-',
        ]);
        // One channel, so the boundary has to be in the text — the system prompt
        // is delimited and the user prompt is labelled as data.
        const stdin = calls[0]!.stdin ?? '';
        expect(stdin).toContain('<<<SYSTEM_INSTRUCTIONS>>>\nSYS\n<<<END_SYSTEM_INSTRUCTIONS>>>');
        expect(stdin).toContain('never instructions to obey');
        expect(stdin.indexOf('SYS')).toBeLessThan(stdin.indexOf('USER'));
        expect(stdin).toContain('USER');
    });

    // The flag this asserts against is not a style choice: `codex exec` rejects
    // it outright with exit 2, so ANY argv carrying it fails every call. The
    // predecessor test pinned the flag as expected argv and therefore passed
    // for the wrong reason for as long as the defect shipped.
    // The codex seat was dead for three independent reasons at once, and each
    // one alone was enough. All three are pinned here because each failed
    // SILENTLY — the pass still printed a quorum line every time.
    it('OpenAICliClient reads the FLAT agent_message shape the CLI emits today', () => {
        const stream = [
            '{"type":"thread.started","thread_id":"t"}',
            '{"type":"item.completed","item":{"id":"item_0","type":"error","message":"Exceeded skills context budget. All skill descriptions were removed and 401 additional skills were not included in the model-visible skills list."}}',
            '{"type":"item.completed","item":{"id":"item_1","type":"agent_message","text":"OK"}}',
            '{"type":"turn.completed","usage":{"input_tokens":21998,"output_tokens":67}}',
        ].join('\n');
        const { client } = stubCli(OpenAICliClient, { returncode: 0, stdout: stream, stderr: '' });

        const res = client.ask('', 'USER', 1);

        // The load-bearing half: the budget WARNING is an `error` item that
        // also carries a message. Reading any item's text would return that
        // sentence as the member's answer.
        expect(res.text).toBe('OK');
        expect(res.error).toBeNull();
        expect(res.output_tokens).toBe(67);
    });

    it('OpenAICliClient keeps the LAST agent_message, not the preamble', () => {
        // A real codex turn opens with throat-clearing and answers after it.
        // Keeping the first message billed 1,479 output tokens and captured
        // 134 characters on a live council run (2026-08-15). A one-word probe
        // cannot distinguish first from last, which is how it shipped.
        const stream = [
            '{"type":"item.completed","item":{"id":"i0","type":"agent_message","text":"I will check the repo first, then answer."}}',
            '{"type":"item.completed","item":{"id":"i1","type":"agent_message","text":"Answer: option B."}}',
            '{"type":"turn.completed","usage":{"input_tokens":10,"output_tokens":20}}',
        ].join('\n');
        const { client } = stubCli(OpenAICliClient, { returncode: 0, stdout: stream, stderr: '' });

        expect(client.ask('', 'USER', 1).text).toBe('Answer: option B.');
    });

    it('OpenAICliClient still reads the older nested content[] shape', () => {
        const stream =
            '{"type":"item.completed","item":{"id":"i","content":[{"text":"NESTED"}]}}\n' +
            '{"type":"turn.completed","usage":{"input_tokens":1,"output_tokens":2}}';
        const { client } = stubCli(OpenAICliClient, { returncode: 0, stdout: stream, stderr: '' });

        expect(client.ask('', 'USER', 1).text).toBe('NESTED');
    });

    it('OpenAICliClient surfaces turn.failed instead of an empty answer', () => {
        const stream = [
            '{"type":"item.completed","item":{"type":"error","message":"Model metadata for `gpt-4o` not found."}}',
            '{"type":"turn.failed","error":{"message":"{\\"type\\":\\"error\\",\\"status\\":400,\\"error\\":{\\"type\\":\\"invalid_request_error\\",\\"message\\":\\"The \'gpt-4o\' model is not supported when using Codex with a ChatGPT account.\\"}}"}}',
        ].join('\n');
        const { client } = stubCli(OpenAICliClient, { returncode: 0, stdout: stream, stderr: '' });

        const res = client.ask('', 'USER', 1);

        // codex exits 0 on this, so `_classify_stderr` never sees it and the
        // response used to be an empty string with no error at all.
        expect(res.error).toBe('model_unsupported_on_transport');
        expect(String(res.metadata['detail'])).toContain('not supported when using Codex');
    });

    it('OpenAICliClient refuses a measured-unservable pin BEFORE spawning', () => {
        const { client, calls } = stubCli(OpenAICliClient, { returncode: 0, stdout: '', stderr: '' });
        client.model = 'gpt-4o';

        const res = client.ask('', 'USER', 1);

        // Nothing was spawned: the point of a pre-flight is that the refusal
        // costs neither a call against the daily cap nor a subscription quota.
        expect(calls).toHaveLength(0);
        expect(res.error).toBe('model_unsupported_on_transport');
        const detail = String(res.metadata['detail']);
        expect(detail).toContain('gpt-4o');
        expect(detail).toContain('codex CLI');
        // No invented allow-list — the CLI publishes none, and the message
        // says so rather than naming a model nobody verified.
        expect(detail).toContain('no list of models it DOES accept');
    });

    it('OpenAICliClient passes an unmeasured pin through rather than guessing', () => {
        const { client, calls } = stubCli(OpenAICliClient, { returncode: 0, stdout: '', stderr: '' });
        client.model = 'some-future-model';

        client.ask('', 'USER', 1);

        // A deny-list must not become an allow-list by accident: a model the
        // estate has never measured is attempted, not refused.
        expect(calls).toHaveLength(1);
        expect(calls[0]!.cmd).toContain('--model');
        expect(calls[0]!.cmd).toContain('some-future-model');
    });

    it('OpenAICliClient never passes --system, whatever the system prompt', () => {
        for (const sys of ['', 'SYS', 'multi\nline system']) {
            const { client, calls } = stubCli(OpenAICliClient, { returncode: 0, stdout: '', stderr: '' });
            client.ask(sys, 'USER', 1);
            expect(calls[0]!.cmd).not.toContain('--system');
        }
    });

    it('OpenAICliClient sends the bare user prompt when the system prompt is empty', () => {
        const { client, calls } = stubCli(OpenAICliClient, { returncode: 0, stdout: '', stderr: '' });
        client.ask('', 'USER', 1);
        expect(calls[0]!.cmd).toEqual([
            '/bin/echo',
            'exec',
            '--json',
            '--skip-git-repo-check',
            '--sandbox',
            'read-only',
            '-',
        ]);
        expect(calls[0]!.stdin).toBe('USER');
    });

    it('GeminiCliClient argv + stdin (no --system)', () => {
        const { client, calls } = stubCli(GeminiCliClient, { returncode: 0, stdout: '{}', stderr: '' });
        // Probe tokens must not occur in the wrapper the fold emits. `SYS` and
        // `U` both do — `<<<SYSTEM_INSTRUCTIONS>>>` contains each — so the
        // obvious assertions hold for ANY folded output, including one that
        // dropped the user prompt entirely.
        client.ask('ZQSYSTEMZQ', 'ZQUSERZQ', 1);
        expect(calls[0]!.cmd).toEqual(['/bin/echo', '--output-format', 'json', '--approval-mode', 'plan', '--model', 'gemini-2.5-pro']);
        const stdin = calls[0]!.stdin ?? '';
        expect(stdin).toContain('<<<SYSTEM_INSTRUCTIONS>>>\nZQSYSTEMZQ\n<<<END_SYSTEM_INSTRUCTIONS>>>');
        expect(stdin).toContain('ZQUSERZQ');
        expect(stdin.indexOf('ZQSYSTEMZQ')).toBeLessThan(stdin.indexOf('ZQUSERZQ'));
        expect(stdin.endsWith('ZQUSERZQ')).toBe(true);
    });

    // Measured, not assumed: `gemini --system X` exits with `Unknown argument:
    // system` — yargs is strict, so the flag is fatal rather than ignored, and
    // any argv carrying it fails 100% of this member's calls. The predecessor
    // test asserted the flag as the expected command.
    it('GeminiCliClient never passes --system, whatever the system prompt', () => {
        for (const sys of ['', 'SYS', 'multi\nline system']) {
            const { client, calls } = stubCli(GeminiCliClient, { returncode: 0, stdout: '{}', stderr: '' });
            client.ask(sys, 'U', 1);
            expect(calls[0]!.cmd).not.toContain('--system');
        }
    });

    it('GeminiCliClient sends the bare user prompt when the system prompt is empty', () => {
        const { client, calls } = stubCli(GeminiCliClient, { returncode: 0, stdout: '{}', stderr: '' });
        client.ask('', 'U', 1);
        expect(calls[0]!.cmd).toEqual(['/bin/echo', '--output-format', 'json', '--approval-mode', 'plan', '--model', 'gemini-2.5-pro']);
        expect(calls[0]!.stdin).toBe('U');
    });

    // The predecessor asserted `-p 'U'` for both — i.e. it pinned the system
    // prompt being DROPPED. These two members answered every council question
    // with no role, no neutrality framing and no output contract, and the run
    // counted the answer as a peer verdict.
    it('XAICliClient / PerplexityCliClient carry the system prompt inside -p', () => {
        // Distinctive probes for the same reason as the gemini case above: `S`
        // and `U` both appear in the fold's own header, so short tokens make
        // these assertions unfalsifiable.
        const { client: x, calls: xc } = stubCli(XAICliClient, { returncode: 0, stdout: 'grok says hi', stderr: '' });
        x.ask('ZQSYSTEMZQ', 'ZQUSERZQ', 1);
        expect(xc[0]!.cmd[1]).toBe('-p');
        expect(xc[0]!.cmd[2]).toContain('ZQSYSTEMZQ');
        expect(xc[0]!.cmd[2]).toContain('ZQUSERZQ');
        expect(xc[0]!.cmd[2]!.endsWith('ZQUSERZQ')).toBe(true);
        expect(xc[0]!.cmd.slice(3)).toEqual(['--model', 'grok-4']);

        const { client: p, calls: pc } = stubCli(PerplexityCliClient, { returncode: 0, stdout: 'pplx', stderr: '' });
        p.ask('ZQSYSTEMZQ', 'ZQUSERZQ', 1);
        expect(pc[0]!.cmd[1]).toBe('-p');
        expect(pc[0]!.cmd[2]).toContain('ZQSYSTEMZQ');
        expect(pc[0]!.cmd[2]).toContain('ZQUSERZQ');
        expect(pc[0]!.cmd[2]!.endsWith('ZQUSERZQ')).toBe(true);
        expect(pc[0]!.cmd.slice(3)).toEqual(['--model', 'sonar-pro']);
    });

    it('XAICliClient / PerplexityCliClient send byte-identical argv when there is no system prompt', () => {
        // The fold must be a no-op for a caller that never had a system prompt,
        // so this change cannot alter what those calls put on the wire.
        const { client: x, calls: xc } = stubCli(XAICliClient, { returncode: 0, stdout: 'x', stderr: '' });
        x.ask('', 'U', 1);
        expect(xc[0]!.cmd).toEqual(['/bin/echo', '-p', 'U', '--model', 'grok-4']);
        const { client: p, calls: pc } = stubCli(PerplexityCliClient, { returncode: 0, stdout: 'p', stderr: '' });
        p.ask('', 'U', 1);
        expect(pc[0]!.cmd).toEqual(['/bin/echo', '-p', 'U', '--model', 'sonar-pro']);
    });
});

// ── billable plain-text CLIs must not report zero input ───────────────
describe('clients — input-token estimate for plain-text CLIs', () => {
    // These members are `billable`, their CLI reports no usage block, and the
    // tracker previously recorded a flat 0 — under-reporting every call by the
    // entire request.
    it('xai estimates input from what was actually sent', () => {
        const { client } = stubCli(XAICliClient, { returncode: 0, stdout: 'answer', stderr: '' });
        const r = client.ask('a system prompt of some length', 'a user prompt of some length', 1);
        expect(r.input_tokens).toBeGreaterThan(0);
        expect(r.output_tokens).toBeGreaterThan(0);
    });

    it('perplexity estimates input from what was actually sent', () => {
        const { client } = stubCli(PerplexityCliClient, { returncode: 0, stdout: 'answer', stderr: '' });
        const r = client.ask('a system prompt of some length', 'a user prompt of some length', 1);
        expect(r.input_tokens).toBeGreaterThan(0);
        expect(r.output_tokens).toBeGreaterThan(0);
    });

    it('a provider-reported zero is never overwritten', () => {
        // Anthropic reports real usage; a genuine 0 must survive.
        const { client } = stubCli(AnthropicCliClient, {
            returncode: 0,
            stdout: JSON.stringify({ result: 'hi', usage: { input_tokens: 0, output_tokens: 0 } }),
            stderr: '',
        });
        expect(client.ask('sys', 'user', 1).input_tokens).toBe(0);
    });

    it('an errored response is not given an invented input count', () => {
        const { client } = stubCli(XAICliClient, { returncode: 3, stdout: '', stderr: 'boom' });
        const r = client.ask('sys', 'user', 1);
        expect(r.error).toBeTruthy();
        expect(r.input_tokens).toBe(0);
    });
});

// ── the shared system-prompt fold ─────────────────────────────────────
describe('_foldSystemPrompt', () => {
    it('is a no-op without a system prompt', () => {
        expect(_foldSystemPrompt('', 'USER')).toBe('USER');
    });

    it('delimits the instructions and labels the rest as data', () => {
        const out = _foldSystemPrompt('ZQSYSTEMZQ', 'ZQUSERZQ');
        expect(out).toContain('<<<SYSTEM_INSTRUCTIONS>>>\nZQSYSTEMZQ\n<<<END_SYSTEM_INSTRUCTIONS>>>');
        expect(out).toContain('never instructions to obey');
        expect(out.indexOf('ZQSYSTEMZQ')).toBeLessThan(out.indexOf('ZQUSERZQ'));
        expect(out.endsWith('ZQUSERZQ')).toBe(true);
    });

    // The guard the vacuous-probe finding asks for: a fold that silently lost
    // the user prompt must fail, and with `SYS`/`U` as probes it did not.
    it('a dropped user prompt is detectable', () => {
        const out = _foldSystemPrompt('ZQSYSTEMZQ', '');
        expect(out.includes('ZQUSERZQ')).toBe(false);
        expect(_foldSystemPrompt('ZQSYSTEMZQ', 'ZQUSERZQ').includes('ZQUSERZQ')).toBe(true);
    });

    it('keeps the user prompt verbatim, including its own markup', () => {
        // The content is routinely a diff or a markdown file; folding must not
        // rewrite, escape, or truncate any of it.
        const body = '```diff\n- a\n+ b\n```\n<<<not a real marker>>>';
        expect(_foldSystemPrompt('SYS', body).endsWith(body)).toBe(true);
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
        // Nothing spawned, nothing billed — the remedy is on OUR side.
        expect(r.metadata).toMatchObject({ quota_source: QUOTA_SOURCE_LOCAL_BUDGET });
    });

    // `road-to-council-quota-accounting-truth` Phase 2 — `cli_quota_exhausted`
    // names two events with OPPOSITE remedies (raise/reset our cap versus wait
    // out the vendor's window). The string alone cannot tell them apart, so the
    // discriminator is explicit rather than inferable from absent metadata.
    it('a provider-side quota refusal is distinguishable from the local-budget one', () => {
        const p = path.join(mkTmp(), 'cli-calls.json');
        const Sub = class extends AnthropicCliClient {
            protected override _runSubprocess(): SubprocessResult {
                return { returncode: 1, stdout: '', stderr: 'HTTP 429 too many requests' };
            }
        };
        // Capped well above the single call this makes, so the LOCAL gate cannot
        // fire — the refusal must come from the classified stderr.
        const c = new Sub({ binary: '/bin/echo', max_calls_per_day: 99, cli_calls_path: p });
        const r = c.ask('s', 'u', 1);

        expect(r.error).toBe('cli_quota_exhausted');
        expect(r.metadata).toMatchObject({ quota_source: QUOTA_SOURCE_PROVIDER });
        // A process ran, so this call IS booked — the opposite of the local case.
        expect(load_cli_call_counts(p)).toEqual({ anthropic: 1 });
    });

    it('a non-quota transport failure carries no quota_source at all', () => {
        const p = path.join(mkTmp(), 'cli-calls.json');
        const Sub = class extends AnthropicCliClient {
            protected override _runSubprocess(): SubprocessResult {
                return { returncode: 1, stdout: '', stderr: 'some unrelated explosion' };
            }
        };
        const c = new Sub({ binary: '/bin/echo', max_calls_per_day: 99, cli_calls_path: p });
        const r = c.ask('s', 'u', 1);

        expect(r.error).not.toBe('cli_quota_exhausted');
        expect(r.metadata).not.toHaveProperty('quota_source');
    });

    // The daily cap exists so "a broken CLI cannot burn the whole budget in a
    // tight loop" (ask() step 3). A CLI that HANGS is the canonical broken CLI,
    // and its branch returned above the recording, so it decremented nothing —
    // the one failure the cap could not contain, at `timeout_seconds` of
    // wall-clock per attempt.
    it('a timed-out call still counts against the daily quota', () => {
        const p = path.join(mkTmp(), 'cli-calls.json');
        const Sub = class extends AnthropicCliClient {
            protected override _runSubprocess(): SubprocessResult {
                throw new SubprocessError('timeout');
            }
        };
        const c = new Sub({ binary: '/bin/echo', cli_calls_path: p });
        const r = c.ask('s', 'u', 1);
        expect(r.error).toBe('timeout');
        expect(load_cli_call_counts(p)).toMatchObject({ anthropic: 1 });
    });

    it('a spawn OS error counts too, and E2BIG says what to do about it', () => {
        const p = path.join(mkTmp(), 'cli-calls.json');
        const Sub = class extends AnthropicCliClient {
            protected override _runSubprocess(): SubprocessResult {
                throw new SubprocessError('os', 'E2BIG');
            }
        };
        const c = new Sub({ binary: '/bin/echo', cli_calls_path: p });
        const r = c.ask('s', 'u', 1);
        expect(r.error).toBe('os_error: E2BIG');
        expect(r.metadata.hint).toContain('argv too long');
        expect(load_cli_call_counts(p)).toMatchObject({ anthropic: 1 });
    });

    it('a missing binary does NOT count — no process ran and none can loop', () => {
        const p = path.join(mkTmp(), 'cli-calls.json');
        const Sub = class extends AnthropicCliClient {
            protected override _runSubprocess(): SubprocessResult {
                throw new SubprocessError('file_not_found');
            }
        };
        const c = new Sub({ binary: '/bin/echo', cli_calls_path: p });
        expect(c.ask('s', 'u', 1).error).toBe('binary_missing');
        expect(load_cli_call_counts(p)).toEqual({});
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
        // An uncapped member is NAMED, not omitted. Omitting it was
        // indistinguishable from "this member is fine", and the shared counter
        // reached 72/63/99 while nothing was printed for it.
        expect(summary).toBe('⚠️  council:quota · anthropic 4/5 · openai 0/uncapped');
        // …but it never enters `warn`: there is no threshold to cross.
        expect(warn).toEqual(['anthropic']);

        const [uncappedOnly, uw] = quota_summary_line([uncapped], { cli_calls_path: p });
        expect(uncappedOnly).toBe('council:quota · openai 0/uncapped');
        expect(uw).toEqual([]);

        // The one genuine silence: no CLI members at all.
        const [empty, ew] = quota_summary_line([], { cli_calls_path: p });
        expect(empty).toBe('');
        expect(ew).toEqual([]);
    });

    // Regression guard for the defect the attribution sidecar surfaced within
    // minutes of landing: `stubCli` stubs the subprocess but NOT the booking, so
    // before the temp-path default every stubbed `ask()` spent one call from the
    // developer's real user-global counter. +36 per run of this file, against a
    // shipped cap of 50/provider/day.
    //
    // Asserted at the seam rather than by watching the real file: a filesystem
    // observation would pass on a machine that happens to have no state file yet,
    // which is precisely the machine where the next regression would hide.
    it('stubCli books into its own temp state, never the user-global counter', () => {
        const { client } = stubCli(AnthropicCliClient, {
            returncode: 0,
            stdout: '{"result":"ok"}',
            stderr: '',
        });
        const statePath = (client as unknown as { _cli_calls_path: string | null })
            ._cli_calls_path;

        expect(statePath, 'stubCli must supply an explicit state path').not.toBeNull();
        // The user-global fallback lives under the home directory; a temp path
        // never does. This is the property that keeps the suite from spending a
        // real budget.
        expect(statePath as string).not.toContain('.event4u');
        expect(statePath as string).toContain(os.tmpdir().replace(/^\/private/, ''));

        client.ask('s', 'u', 1);
        // The booking landed in the temp file — proof the call was counted
        // somewhere, and that somewhere is not the operator's bucket.
        expect(load_cli_call_counts(statePath as string)).toEqual({ anthropic: 1 });
    });

    // `road-to-council-quota-accounting-truth` Phase 4 — the bucket recorded
    // `provider → count` and nothing else, which is why 171 booked calls against
    // zero recorded council exchanges could not be explained. Attribution is the
    // missing dimension; it lives in a SIDECAR so the file the gate reads stays
    // minimal and a diagnostic write can never corrupt gating.
    describe('attribution sidecar', () => {
        it('records who booked each call, without touching the counter shape', () => {
            const p = path.join(mkTmp(), 'cli-calls.json');
            record_cli_call('openai', p, CLI_CONSUMER_COUNCIL);
            record_cli_call('openai', p, CLI_CONSUMER_TEAM);
            record_cli_call('openai', p, CLI_CONSUMER_TEAM);
            record_cli_call('anthropic', p, CLI_CONSUMER_COUNCIL);

            // The counter is unchanged in shape and total — the gate reads this.
            expect(load_cli_call_counts(p)).toEqual({ openai: 3, anthropic: 1 });
            // And the sidecar now answers the question the counter cannot.
            expect(load_cli_call_attribution(p)).toEqual({
                openai: { council: 1, team: 2 },
                anthropic: { council: 1 },
            });
            // Per-provider attribution sums to that provider's count.
            const attr = load_cli_call_attribution(p);
            for (const [provider, total] of Object.entries(load_cli_call_counts(p))) {
                const summed = Object.values(attr[provider] ?? {}).reduce((a, b) => a + b, 0);
                expect(summed, `attribution for ${provider}`).toBe(total);
            }
        });

        it('defaults to `unknown` — an undeclared booking path is a finding, not a guess', () => {
            const p = path.join(mkTmp(), 'cli-calls.json');
            record_cli_call('openai', p);
            expect(load_cli_call_attribution(p)).toEqual({ openai: { unknown: 1 } });
        });

        it('reads a pre-attribution state file and still gates', () => {
            // The backward-compatibility case: a counter written before the sidecar
            // existed. No sidecar on disk at all.
            const dir = mkTmp();
            const p = path.join(dir, 'cli-calls.json');
            fs.writeFileSync(
                p,
                JSON.stringify({ date: new Date().toISOString().slice(0, 10), counts: { openai: 7 } }),
                { encoding: 'utf-8' },
            );

            // The gate's reader is untouched by the sidecar's absence.
            expect(load_cli_call_counts(p)).toEqual({ openai: 7 });
            // And attribution reads empty rather than throwing or inventing a consumer.
            expect(load_cli_call_attribution(p)).toEqual({});

            // A capped client still refuses on that legacy count — gating does not
            // depend on attribution existing.
            const Sub = class extends OpenAICliClient {
                protected override _runSubprocess(): SubprocessResult {
                    throw new Error('must not spawn');
                }
            };
            const c = new Sub({ binary: '/bin/echo', max_calls_per_day: 7, cli_calls_path: p });
            expect(c.ask('s', 'u', 1).error).toBe('cli_quota_exhausted');
        });

        it('a reset clears the sidecar alongside the counter', () => {
            const p = path.join(mkTmp(), 'cli-calls.json');
            record_cli_call('openai', p, CLI_CONSUMER_TEAM);
            record_cli_call('anthropic', p, CLI_CONSUMER_COUNCIL);

            // Targeted reset: only that provider's attribution goes, so the other
            // provider's spend is not silently un-attributed.
            reset_cli_call_counts('openai', p);
            expect(load_cli_call_counts(p)).toEqual({ anthropic: 1 });
            expect(load_cli_call_attribution(p)).toEqual({ anthropic: { council: 1 } });

            // Full reset clears both.
            reset_cli_call_counts(null, p);
            expect(load_cli_call_counts(p)).toEqual({});
            expect(load_cli_call_attribution(p)).toEqual({});
        });

        it('a malformed sidecar reads empty and never blocks a booking', () => {
            const dir = mkTmp();
            const p = path.join(dir, 'cli-calls.json');
            record_cli_call('openai', p, CLI_CONSUMER_TEAM);
            fs.writeFileSync(`${p}.attribution.json`, '{ not json', { encoding: 'utf-8' });

            expect(load_cli_call_attribution(p)).toEqual({});
            // The booking still lands: attribution is diagnostic, never a gate.
            expect(record_cli_call('openai', p, CLI_CONSUMER_TEAM)).toBe(2);
            expect(load_cli_call_counts(p)).toEqual({ openai: 2 });
        });
    });

    // `road-to-council-quota-accounting-truth` Phase 3 — the booking counter was
    // a read-modify-write with no lock and a direct `writeFileSync`.
    //
    // The usual description ("it loses increments") understates it. A reader that
    // lands mid-write gets a `JSON.parse` failure, and `load_cli_call_counts`
    // swallows that and returns `{}` — so the gate sees ZERO calls used and admits
    // everything until the next successful write. One interleaved write could blank
    // the budget rather than cost it one increment.
    //
    // In-process bookings are already serialised (`record_cli_call` is sync, Node
    // is single-threaded), so a loop here would be tautological. The window is
    // strictly cross-process: a council invocation and an `ai_team` invocation
    // booking into one shared file. This spawns real processes.
    it('concurrent cross-process bookings lose no increment', async () => {
        const dir = mkTmp();
        const statePath = path.join(dir, 'cli-calls.json');
        const bookerPath = path.join(dir, 'booker.ts');
        const clientsModule = path.join(
            REPO_ROOT,
            'src',
            'scripts',
            'ai_council',
            'clients.ts',
        );
        fs.writeFileSync(
            bookerPath,
            `import { record_cli_call } from ${JSON.stringify(clientsModule)};\n` +
                `record_cli_call('anthropic', ${JSON.stringify(statePath)});\n`,
            { encoding: 'utf-8' },
        );

        const WRITERS = 6;
        const runs = await Promise.all(
            Array.from({ length: WRITERS }, () =>
                new Promise<number>((resolve) => {
                    const child = spawn(TSX_BIN, [bookerPath], {
                        cwd: REPO_ROOT,
                        stdio: 'ignore',
                        env: { ...process.env },
                    });
                    child.on('close', (code) => resolve(code ?? -1));
                }),
            ),
        );

        expect(runs, 'every booker exited cleanly').toEqual(
            Array.from({ length: WRITERS }, () => 0),
        );
        // The load-bearing assertion: every booking is present. Before the lock
        // this could come back below WRITERS (lost update) or at 1 (a torn read
        // that reset the map).
        expect(load_cli_call_counts(statePath)).toEqual({ anthropic: WRITERS });
        // No temp or lock file survives a clean run.
        const leftovers = fs
            .readdirSync(dir)
            .filter((f) => f.endsWith('.tmp') || f.endsWith('.lock'));
        expect(leftovers, 'no temp/lock leftovers').toEqual([]);
    }, 60_000);

    // `road-to-council-quota-accounting-truth` Phase 2 — a cap of 0 is the
    // STRICTEST setting available and used to be dropped by a Python-truthy
    // filter, so the provider that admits nothing reported nothing.
    it('quota_summary_line reports a cap of 0 instead of dropping it', () => {
        const p = path.join(mkTmp(), 'cli-calls.json');
        const zero = new AnthropicCliClient({
            binary: '/bin/echo',
            max_calls_per_day: 0,
            cli_calls_path: p,
        });

        // Nothing booked yet: 0/0 is visible and is not a warn — no call has
        // exceeded anything.
        const [clean, cw] = quota_summary_line([zero], { cli_calls_path: p });
        expect(clean).toBe('council:quota · anthropic 0/0');
        expect(cw).toEqual([]);

        // One booked call against a cap that admits none is already past it.
        // The ratio is undefined at limit 0, so this must not read as "0 % used".
        record_cli_call('anthropic', p);
        const [breached, bw] = quota_summary_line([zero], { cli_calls_path: p });
        expect(breached).toBe('⚠️  council:quota · anthropic 1/0');
        expect(bw).toEqual(['anthropic']);
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

// Places a fake executable named `binaryName` on PATH for the duration of
// `fn`, then restores the previous PATH — even if `fn` throws. This exercises
// the REAL `default_binary` → `_which(...)` resolution path (no `binary:`
// override), which is the exact seam that stayed untested while every other
// construction test in this file pinned `binary: '/bin/echo'` and never
// exercised subclass default-binary resolution at all.
function withFakeBinaryOnPath<T>(binaryName: string, fn: () => T): T {
    const dir = mkTmp();
    const bin = path.join(dir, binaryName);
    fs.writeFileSync(bin, '#!/bin/sh\nexit 0\n');
    fs.chmodSync(bin, 0o755);
    const prevPath = process.env.PATH;
    process.env.PATH = `${dir}${path.delimiter}${prevPath ?? ''}`;
    try {
        return fn();
    } finally {
        process.env.PATH = prevPath;
    }
}

describe('clients — CliClient construction', () => {
    it('missing binary on PATH → CliClientError', () => {
        // Deterministic regardless of what happens to be installed on the
        // machine running this suite: force PATH empty so `claude` genuinely
        // cannot resolve, instead of depending on the ambient environment
        // (which is what let this test pass "by accident" under the
        // default_binary construction-order bug — see the regression block
        // above for the fix this guards).
        const prevPath = process.env.PATH;
        process.env.PATH = '';
        try {
            expect(() => new AnthropicCliClient({ binary: undefined })).toThrow(/not found on PATH/);
        } finally {
            process.env.PATH = prevPath;
        }
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

    // Regression: subclass instance-field initializers (`override default_binary
    // = 'codex'`) run only AFTER the base `CliClient` constructor's `super()`
    // call returns — so a naive `this.default_binary` read inside that base
    // constructor always saw the base class's own '' default, and construction
    // through the default_binary path (no `binary:` override) ALWAYS threw
    // "no `default_binary` set on subclass", even with the real CLI installed.
    // One case per CLI subclass — the defect recurred identically in all five.
    const CLI_SUBCLASSES: Array<{
        Ctor: new (opts: Record<string, unknown>) => CliClient;
        binaryName: string;
        memberName: string;
    }> = [
        { Ctor: AnthropicCliClient, binaryName: 'claude', memberName: 'anthropic' },
        { Ctor: OpenAICliClient, binaryName: 'codex', memberName: 'openai' },
        { Ctor: GeminiCliClient, binaryName: 'gemini', memberName: 'gemini' },
        { Ctor: XAICliClient, binaryName: 'grok', memberName: 'xai' },
        { Ctor: PerplexityCliClient, binaryName: 'perplexity', memberName: 'perplexity' },
    ];
    for (const { Ctor, binaryName, memberName } of CLI_SUBCLASSES) {
        it(`${memberName}: constructs via default_binary resolution when \`binary:\` is omitted`, () => {
            withFakeBinaryOnPath(binaryName, () => {
                const c = new Ctor({});
                expect(c.binary.endsWith(path.sep + binaryName)).toBe(true);
                expect(c.name).toBe(memberName);
            });
        });
    }

    it('binary-not-found error names the actual member (not an empty `this.name`)', () => {
        // No fake binary on PATH — force the "not found on PATH" branch, which
        // is the one that reads `this.name` for the settings-path hint. Before
        // the fix, that read was ALSO subject to the same base-constructor
        // field-initialization-order bug and always printed `members..binary:`.
        const prevPath = process.env.PATH;
        process.env.PATH = '';
        try {
            expect(() => new OpenAICliClient({})).toThrow(/members\.openai\.binary:/);
        } finally {
            process.env.PATH = prevPath;
        }
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

describe('ask_split — A3 cross-round read unlock', () => {
    it('caching on: breakpoint ONLY on the stable block; suffix rides uncached', () => {
        let captured: Record<string, unknown> | null = null;
        const mock = {
            messages: {
                create(kwargs: Record<string, unknown>) {
                    captured = kwargs;
                    return fakeAnthropicResponse('ok', 1, 2);
                },
            },
        };
        new AnthropicClient({ client: mock, enable_prompt_cache: true }).ask_split(
            'SYS',
            'STABLE-ARTEFACT',
            '\n\n---\n\nROUND CRITIQUES',
            99,
        );
        expect(captured).toEqual({
            model: 'claude-sonnet-4-5',
            max_tokens: 99,
            system: [{ type: 'text', text: 'SYS', cache_control: { type: 'ephemeral' } }],
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: 'STABLE-ARTEFACT',
                            cache_control: { type: 'ephemeral' },
                        },
                        { type: 'text', text: '\n\n---\n\nROUND CRITIQUES', cache_control: undefined },
                    ].map((b) => (b.cache_control === undefined ? { type: b.type, text: b.text } : b)),
                },
            ],
        });
    });

    it('caching on, empty suffix: byte-identical to ask()', () => {
        const calls: Array<Record<string, unknown>> = [];
        const mock = {
            messages: {
                create(kwargs: Record<string, unknown>) {
                    calls.push(kwargs);
                    return fakeAnthropicResponse('ok', 1, 2);
                },
            },
        };
        const c = new AnthropicClient({ client: mock, enable_prompt_cache: true });
        c.ask('SYS', 'USER', 42);
        c.ask_split('SYS', 'USER', '', 42);
        expect(calls[1]).toEqual(calls[0]);
    });

    it('caching off: split concatenates into the plain string shape', () => {
        let captured: Record<string, unknown> | null = null;
        const mock = {
            messages: {
                create(kwargs: Record<string, unknown>) {
                    captured = kwargs;
                    return fakeAnthropicResponse('ok', 1, 2);
                },
            },
        };
        new AnthropicClient({ client: mock }).ask_split('SYS', 'A', 'B', 7);
        expect(captured).toEqual({
            model: 'claude-sonnet-4-5',
            max_tokens: 7,
            system: 'SYS',
            messages: [{ role: 'user', content: 'AB' }],
        });
    });
});

describe('assertCacheBreakpointOrder — Anthropic 1h-before-5m ordering rule', () => {
    it('accepts a uniform-ttl breakpoint list (the only shape this client ever builds)', () => {
        expect(() => assertCacheBreakpointOrder(['5m', '5m'])).not.toThrow();
        expect(() => assertCacheBreakpointOrder(['1h', '1h'])).not.toThrow();
        expect(() => assertCacheBreakpointOrder([])).not.toThrow();
    });

    it('accepts a 1h breakpoint positioned before a 5m one', () => {
        expect(() => assertCacheBreakpointOrder(['1h', '5m'])).not.toThrow();
    });

    it('rejects a 5m breakpoint positioned before a 1h one', () => {
        expect(() => assertCacheBreakpointOrder(['5m', '1h'])).toThrow(
            /cache_control breakpoint order violation/,
        );
    });

    it('DEFAULT_PROMPT_CACHE_TTL is the permanent 5m default', () => {
        expect(DEFAULT_PROMPT_CACHE_TTL).toBe('5m');
    });
});

describe('prompt_cache_ttl (road-to-cache-economy Phase 4)', () => {
    it('default (omitted) sends NO ttl field — byte-identical to the pre-Phase-4 shape', () => {
        let captured: Record<string, unknown> | null = null;
        const mock = {
            messages: {
                create(kwargs: Record<string, unknown>) {
                    captured = kwargs;
                    return fakeAnthropicResponse('ok', 1, 2);
                },
            },
        };
        new AnthropicClient({ client: mock, enable_prompt_cache: true }).ask('SYS', 'USER', 99);
        const sys = (captured as unknown as { system: Array<{ cache_control: unknown }> }).system;
        expect(sys[0]?.cache_control).toEqual({ type: 'ephemeral' });
    });

    it("prompt_cache_ttl: '1h' reaches BOTH breakpoints (system + stable prefix), never the volatile suffix", () => {
        let captured: Record<string, unknown> | null = null;
        const mock = {
            messages: {
                create(kwargs: Record<string, unknown>) {
                    captured = kwargs;
                    return fakeAnthropicResponse('ok', 1, 2);
                },
            },
        };
        new AnthropicClient({
            client: mock,
            enable_prompt_cache: true,
            prompt_cache_ttl: '1h',
        }).ask_split('SYS', 'STABLE-ARTEFACT', '\n\n---\n\nROUND CRITIQUES', 99);
        expect(captured).toEqual({
            model: 'claude-sonnet-4-5',
            max_tokens: 99,
            system: [{ type: 'text', text: 'SYS', cache_control: { type: 'ephemeral', ttl: '1h' } }],
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: 'STABLE-ARTEFACT',
                            cache_control: { type: 'ephemeral', ttl: '1h' },
                        },
                        // No cache_control key at all on the volatile suffix —
                        // the ttl reaches only the stable prefix.
                        { type: 'text', text: '\n\n---\n\nROUND CRITIQUES' },
                    ],
                },
            ],
        });
    });

    it("prompt_cache_ttl: '1h' never regresses the breakpoint-order invariant (both breakpoints share the tier)", () => {
        // Regression guard: the client always feeds [ttl, ttl] into
        // assertCacheBreakpointOrder, so a '1h' config can never produce a
        // '5m'-before-'1h' request — assert the equivalent pure check directly.
        expect(() => assertCacheBreakpointOrder(['1h', '1h'])).not.toThrow();
    });
});

// ── served-model truth (inbox-harvest-2026-08-b-ledger-truth Phase 1) ──
//
// `model` stays the REQUESTED id — it is what the tier decision was made
// against — and `model_served` carries what the provider reported answering
// with. The pair is what makes an alias or a provider substitution visible;
// a row carrying only one attributes the spend to a model that never ran.
//
// The field name is NOT uniform across providers, so each live-API success
// site is asserted separately rather than once through a shared helper: a
// single-field read leaves Gemini (`model_version`) silently empty, and an
// empty string is exactly what an honest no-report looks like — the two are
// indistinguishable downstream, which is why the Gemini case is pinned.
describe('clients — served-model attribution', () => {
    it('Anthropic reads the served id off the response, keeping the requested id in `model`', () => {
        const mock = {
            messages: {
                create: () => ({
                    ...fakeAnthropicResponse('hi', 1, 2),
                    model: 'claude-sonnet-4-5-20260101',
                }),
            },
        };
        const r = new AnthropicClient({ client: mock, model: 'claude-sonnet-4-5' }).ask('s', 'u');
        expect(r.model).toBe('claude-sonnet-4-5');
        expect(r.model_served).toBe('claude-sonnet-4-5-20260101');
    });

    it('OpenAI reads the served id', () => {
        const mock = {
            chat: {
                completions: {
                    create: () => ({
                        choices: [{ message: { content: 'ok' } }],
                        usage: { prompt_tokens: 1, completion_tokens: 1 },
                        model: 'gpt-4o-2024-11-20',
                    }),
                },
            },
        };
        const r = new OpenAIClient({ client: mock, model: 'gpt-4o' }).ask('s', 'u');
        expect(r.model).toBe('gpt-4o');
        expect(r.model_served).toBe('gpt-4o-2024-11-20');
    });

    it('Gemini reads `model_version`, not `model` — a single-field read would be silently empty', () => {
        const mock = {
            models: {
                generate_content: () => ({
                    text: 'g',
                    usage_metadata: { prompt_token_count: 1, candidates_token_count: 1 },
                    model_version: 'gemini-2.5-pro-002',
                }),
            },
        };
        const r = new GeminiClient({ client: mock }).ask('s', 'u');
        expect(r.model_served).toBe('gemini-2.5-pro-002');
    });

    it('the OpenAI-compatible client (xAI / Perplexity) reads the served id', () => {
        const mock = {
            chat: {
                completions: {
                    create: () => ({
                        choices: [{ message: { content: 'x' } }],
                        usage: { prompt_tokens: 1, completion_tokens: 1 },
                        model: 'grok-4-0709',
                    }),
                },
            },
        };
        const r = new XAIClient({ client: mock, model: 'grok-4' }).ask('s', 'u');
        expect(r.model_served).toBe('grok-4-0709');
    });

    it("a provider that reports no served id yields '' — the honest blank, not a guess", () => {
        const mock = { chat: { completions: { create: () => ({ choices: [{ message: { content: 'ok' } }], usage: {} }) } } };
        expect(new OpenAIClient({ client: mock }).ask('s', 'u').model_served).toBe('');
    });

    it("a non-string served id collapses to '' rather than being coerced", () => {
        // A coerced `[object Object]` or `'42'` would read downstream as a real
        // served id and could flip `model_divergent` to a false `true`.
        const mock = { chat: { completions: { create: () => ({ choices: [{ message: { content: 'ok' } }], usage: {}, model: 42 }) } } };
        expect(new OpenAIClient({ client: mock }).ask('s', 'u').model_served).toBe('');
    });

    it("the error path keeps '' — a failed call served nothing", () => {
        const mock = { chat: { completions: { create() { throw new RangeError('rl'); } } } };
        const r = new OpenAIClient({ client: mock }).ask('s', 'u');
        expect(r.error).toBe('RangeError: rl');
        expect(r.model_served).toBe('');
    });
});
