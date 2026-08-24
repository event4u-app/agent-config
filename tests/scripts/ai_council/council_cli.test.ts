// Pure-TS behaviour test for the council CLI twin (`src/scripts/council_cli.ts`).
//
// PARTIAL port of `tests/ai_council/test_cli.py` — covers the units the task
// scopes (`build_members`, `_parse_siblings_overrides`, the rounds-resolution
// reachable via the exported surface, and `cmd_run` / `cmd_debate` unit paths)
// that are cleanly testable against the twin's EXPORTED surface without
// modifying it. No existing `.ts` test covers `council_cli`, so this is the
// first.
//
// Scope notes (faithful-port limits, all driven by the twin's export surface,
// not by dropping coverage):
//   • `_resolve_rounds` is module-private (not exported) and `REPO_ROOT` is not
//     monkeypatchable from TS, so the Python `cmd_run --confirm` rounds-payload
//     tests (which write under a monkeypatched REPO_ROOT/agents/runtime/council/
//     responses/) cannot run without editing the twin. The rounds chain's
//     reachable surface — `cmd_run` without `--confirm` returns 0 before any
//     output write — is covered here; the confirm-write variants are noted as
//     blocked-by-export, not silently skipped. The one exception:
//     `_postRunQuorum` — the pure post-run presence/quorum re-derivation
//     `cmd_run --confirm` calls right after `consult()` — IS exported, so it
//     is tested directly against constructed `members`/`responses` fixtures
//     (the `_postRunQuorum` describe block below), without going through
//     `cmd_run`'s file-write path at all.
//   • `build_members` siblings POSITIVE fan-out (constructs N real API clients)
//     needs the `AnthropicClient` ctor to accept a key; the Python test
//     monkeypatches `council_cli.AnthropicClient`, which in TS is an import
//     binding only replaceable via a full clients-module mock. The
//     CLI-specific VALIDATION logic (unknown / disabled / conflict / manual
//     guards, all of which throw before construction) is covered; the positive
//     construction path is exercised by the existing `clients` twin tests.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import {
    CouncilResponse,
    ExternalAIClient,
} from '../../../src/scripts/ai_council/clients.js';
import type { Price, PriceTable } from '../../../src/scripts/ai_council/pricing.js';
import type { EnvironmentReport } from '../../../src/scripts/_lib/environment_detector.js';
import { load_council_config } from '../../../src/scripts/ai_council/config.js';
import type { QuorumResult } from '../../../src/scripts/ai_council/quorum.js';
import {
    consult,
    render,
    CouncilQuestion,
    type CliFallbackOptions,
} from '../../../src/scripts/ai_council/orchestrator.js';
import {
    CouncilDisabledError,
    build_members,
    cmd_debate,
    cmd_render,
    cmd_run,
    _parse_siblings_overrides,
    _synthesize_ai_council_block,
    _postRunQuorum,
    _format_quorum_line,
} from '../../../src/scripts/council_cli.js';


// The council's necessity-classifier emits to the events log, whose default
// path is `<repo_root>/agents/runtime/council/events.log` — INSIDE the worktree.
// `cmd_debate` reaches that emit, so running this file wrote a real log into the
// repo. Harmless alone, but vitest runs files in PARALLEL: the read-only witness
// in `tests/scripts/witness/reach_doctor_readonly.test.ts` asserts that NO path
// in the worktree (tracked or gitignored) appears while it runs, so whenever
// sharding put the two in the same shard the witness failed on
// `porcelain-new: !! agents/runtime/`. Nothing here asserts the log, so switch
// it off for this file.
const _NO_EVENTS_LOG = 'AGENT_CONFIG_NO_EVENTS_LOG';
let _savedNoEventsLog: string | undefined;

beforeAll(() => {
    _savedNoEventsLog = process.env[_NO_EVENTS_LOG];
    process.env[_NO_EVENTS_LOG] = '1';
});

afterAll(() => {
    if (_savedNoEventsLog === undefined) delete process.env[_NO_EVENTS_LOG];
    else process.env[_NO_EVENTS_LOG] = _savedNoEventsLog;
});

// ── stubs (mirror the Python _StubMember / _ManualStub / _fake_table) ──

class StubMember extends ExternalAIClient {
    private _response: CouncilResponse;
    constructor(name: string, model: string, response: CouncilResponse) {
        super();
        this.name = name;
        this.model = model;
        this.billable = true;
        this._response = response;
    }
    override ask(): CouncilResponse {
        return this._response;
    }
}

function fakeTable(): PriceTable {
    const prices = new Map<string, Price>();
    prices.set('anthropic claude-x', {
        provider: 'anthropic',
        model: 'claude-x',
        input_per_1m_usd: 3.0,
        output_per_1m_usd: 15.0,
    });
    prices.set('openai gpt-x', {
        provider: 'openai',
        model: 'gpt-x',
        input_per_1m_usd: 2.5,
        output_per_1m_usd: 10.0,
    });
    return {
        last_updated: '2026-01-01',
        currency: 'USD',
        unit: 'per_1M_tokens',
        source: 'test-fixture',
        prices,
    };
}

const _tmpDirs: string[] = [];
function mkTmp(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'council-cli-'));
    _tmpDirs.push(d);
    return d;
}
afterEach(() => {
    while (_tmpDirs.length > 0) {
        const d = _tmpDirs.pop();
        if (d) {
            fs.rmSync(d, { recursive: true, force: true });
        }
    }
});

// `cmd_run` / `cmd_debate` take a structural `args` object; build the minimal
// shape each path reads. Cast through unknown — the twin uses `_getattr`, so
// only the named fields are inspected.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Args = any;

// ── _parse_siblings_overrides ─────────────────────────────────────────

describe('_parse_siblings_overrides', () => {
    it('accepts two models', () => {
        const out = _parse_siblings_overrides(['anthropic=claude-sonnet-4-5,claude-opus-4-1']);
        expect(out).toEqual({ anthropic: ['claude-sonnet-4-5', 'claude-opus-4-1'] });
    });

    it('rejects a single model', () => {
        expect(() => _parse_siblings_overrides(['anthropic=claude-sonnet-4-5'])).toThrow(/≥ 2 distinct/);
    });

    it('rejects duplicate models', () => {
        expect(() =>
            _parse_siblings_overrides(['anthropic=claude-sonnet-4-5,claude-sonnet-4-5']),
        ).toThrow(/≥ 2 distinct/);
    });

    it('rejects a repeated provider', () => {
        expect(() =>
            _parse_siblings_overrides(['anthropic=a,b', 'anthropic=c,d']),
        ).toThrow(/repeated/);
    });

    it('rejects a missing equals', () => {
        expect(() => _parse_siblings_overrides(['anthropic-a-b'])).toThrow(/expects/);
    });
});

// ── build_members guards ──────────────────────────────────────────────

describe('build_members guards', () => {
    it('raises when council is disabled', () => {
        expect(() => build_members({ ai_council: { enabled: false } })).toThrow(CouncilDisabledError);
        expect(() => build_members({ ai_council: { enabled: false } })).toThrow(/enabled is false/);
    });

    it('raises when no member is enabled', () => {
        const settings = {
            ai_council: {
                enabled: true,
                members: { anthropic: { enabled: false }, openai: { enabled: false } },
            },
        };
        expect(() => build_members(settings)).toThrow(CouncilDisabledError);
        expect(() => build_members(settings)).toThrow(/no council member/);
    });
});

// ── the global-mode key, both shapes ──────────────────────────────────
//
// `load_settings` hands `build_members` a SYNTHESIZED block whose global mode
// sits at the top level (`_synthesize_ai_council_block` flattens
// `defaults.mode` → `mode`). But `build_members` is on the exported surface,
// so a caller — the MCP tool path, a test, any embedder — can legitimately
// hand it the RAW `.ai-council.yml` shape, where the same value lives under
// `defaults.mode`. Reading only the flat key silently drops the documented
// default on that path and falls through to the built-in.
//
// road-to-zero-ceremony-detection Phase 2: both shapes must resolve.

describe('build_members — global transport mode key shapes', () => {
    /** A single cli-mode member whose binary override avoids a PATH lookup. */
    function settingsWith(aiExtra: Record<string, unknown>): Record<string, unknown> {
        return {
            ai_council: {
                enabled: true,
                members: {
                    anthropic: {
                        enabled: true,
                        model: 'claude-sonnet-4-5',
                        binary: process.execPath,
                    },
                },
                ...aiExtra,
            },
        };
    }

    it('honours the flattened top-level `mode` (the synthesized shape)', () => {
        const members = build_members(settingsWith({ mode: 'cli' }));
        expect(members).toHaveLength(1);
        expect((members[0] as { transport?: string }).transport).toBe('cli');
    });

    it('honours the nested `defaults.mode` (the raw .ai-council.yml shape)', () => {
        const members = build_members(settingsWith({ defaults: { mode: 'cli' } }));
        expect(members).toHaveLength(1);
        expect((members[0] as { transport?: string }).transport).toBe('cli');
    });

    it('prefers the flattened key when both shapes are present', () => {
        const members = build_members(
            settingsWith({ mode: 'cli', defaults: { mode: 'manual' } }),
        );
        expect((members[0] as { transport?: string }).transport).toBe('cli');
    });

    it('still lets a per-member mode override either shape', () => {
        const settings = {
            ai_council: {
                enabled: true,
                defaults: { mode: 'cli' },
                members: {
                    anthropic: {
                        enabled: true,
                        model: 'claude-sonnet-4-5',
                        mode: 'manual',
                    },
                },
            },
        };
        const members = build_members(settings);
        expect((members[0] as { transport?: string }).transport).toBe('manual');
    });
});

// ── build_members — siblings validation ───────────────────────────────

describe('build_members siblings validation', () => {
    it('unknown provider raises', () => {
        const settings = {
            ai_council: {
                enabled: true,
                mode: 'api',
                members: { anthropic: { enabled: true, model: 'claude-sonnet-4-5' } },
            },
        };
        expect(() =>
            build_members(settings, { siblings_overrides: { openai: ['gpt-4o', 'o1'] } }),
        ).toThrow(/unknown member/);
    });

    it('disabled provider raises', () => {
        const settings = {
            ai_council: {
                enabled: true,
                mode: 'api',
                members: { anthropic: { enabled: false, model: 'claude-sonnet-4-5' } },
            },
        };
        expect(() =>
            build_members(settings, {
                siblings_overrides: { anthropic: ['claude-sonnet-4-5', 'claude-opus-4-1'] },
            }),
        ).toThrow(/not .*enabled/);
    });

    it('conflicts with a model override on the same member', () => {
        const settings = {
            ai_council: {
                enabled: true,
                mode: 'api',
                members: { anthropic: { enabled: true, model: 'claude-sonnet-4-5' } },
            },
        };
        expect(() =>
            build_members(settings, {
                model_overrides: { anthropic: 'claude-opus-4-1' },
                siblings_overrides: { anthropic: ['claude-sonnet-4-5', 'claude-opus-4-1'] },
            }),
        ).toThrow(/same member/);
    });

    it('rejects manual mode (requires mode=api)', () => {
        const settings = {
            ai_council: {
                enabled: true,
                mode: 'manual',
                members: { anthropic: { enabled: true, mode: 'manual' } },
            },
        };
        expect(() =>
            build_members(settings, {
                siblings_overrides: { anthropic: ['claude-sonnet-4-5', 'claude-opus-4-1'] },
            }),
        ).toThrow(/mode=api/);
    });
});

// ── build_members — mode: auto (road-to-always-on-orchestration Phase 3.1) ──
//
// Regression cover for the break a predecessor session reproduced live: the
// loader default flipped `defaults.mode` from `'api'` to `'auto'`
// (`config.ts::_build_defaults`), but this file's hand-rolled
// `mode === 'api' | 'cli' | 'manual'` switch had no `'auto'` case — every
// enabled member fell through to the final `else` and killed the whole
// invocation, even on a config that never named a transport at all.
// `environment_report` is the test-only DI knob (mirrors the existing
// `settings`/`members`/`table` pattern on `cmd_run`/`cmd_estimate`) that lets
// these tests exercise the `auto` chain deterministically instead of poking
// real `$PATH` / `$HOME` / env-key state that differs per machine and per CI
// run.

/** No CLI binary, no auth, no key — every provider is unresolvable via `auto`. */
function emptyReport(): EnvironmentReport {
    return { hosts: [], auth: [], keys: [] };
}

const _TEST_KEY_VAR = 'COUNCIL_CLI_TEST_KEY';

describe('build_members — mode: auto', () => {
    afterEach(() => {
        delete process.env[_TEST_KEY_VAR];
    });

    it('resolves via the api-key rung instead of throwing on the literal mode=auto', () => {
        process.env[_TEST_KEY_VAR] = 'sk-test-key';
        const settings = {
            ai_council: {
                enabled: true,
                mode: 'auto',
                members: {
                    anthropic: {
                        enabled: true,
                        model: 'claude-sonnet-4-5',
                        api_key_ref: `env:${_TEST_KEY_VAR}`,
                    },
                },
            },
        };
        const members = build_members(settings, { environment_report: emptyReport() });
        expect(members).toHaveLength(1);
        expect((members[0] as { transport?: string }).transport).toBe('api');
    });

    it('records absent (with a machine-readable AbsentReason) rather than crashing when nothing resolves', () => {
        const settings = {
            ai_council: {
                enabled: true,
                mode: 'auto',
                members: { anthropic: { enabled: true, model: 'claude-sonnet-4-5' } },
            },
        };
        const skipped: Record<string, unknown>[] = [];
        // Every enabled member ends up absent, so this still throws — but with
        // the graded-degradation reason, never the old "no transport — mode=auto"
        // crash that fired regardless of whether the member could ever work.
        expect(() =>
            build_members(settings, { environment_report: emptyReport(), skipped }),
        ).toThrow(/no council member could be constructed/);
        expect(skipped).toHaveLength(1);
        expect(skipped[0]?.['member']).toBe('anthropic');
        expect(skipped[0]?.['reason']).toBe('no_binary');
    });

    it('one absent + one present member: the pass continues instead of being killed, and quorum concludes (majority of 2 = 1)', () => {
        process.env[_TEST_KEY_VAR] = 'sk-test-key';
        const settings = {
            ai_council: {
                enabled: true,
                mode: 'auto',
                members: {
                    anthropic: {
                        enabled: true,
                        model: 'claude-sonnet-4-5',
                        api_key_ref: `env:${_TEST_KEY_VAR}`,
                    },
                    openai: { enabled: true, model: 'gpt-4o' },
                },
            },
        };
        const skipped: Record<string, unknown>[] = [];
        const quorum_out: { result: QuorumResult | null } = { result: null };
        const members = build_members(settings, {
            environment_report: emptyReport(),
            skipped,
            quorum_out,
        });
        expect(members.map((m) => m.name)).toEqual(['anthropic']);
        expect(skipped).toHaveLength(1);
        expect(skipped[0]?.['member']).toBe('openai');
        expect(skipped[0]?.['reason']).toBe('no_binary');
        expect(quorum_out.result).toEqual({
            status: 'concluded',
            threshold: 1,
            total: 2,
            present: 1,
        });
    });

    it('an explicit `quorum: 2` makes the same partial pass INCONCLUSIVE instead of concluded', () => {
        process.env[_TEST_KEY_VAR] = 'sk-test-key';
        const settings = {
            ai_council: {
                enabled: true,
                mode: 'auto',
                quorum: 2,
                members: {
                    anthropic: {
                        enabled: true,
                        model: 'claude-sonnet-4-5',
                        api_key_ref: `env:${_TEST_KEY_VAR}`,
                    },
                    openai: { enabled: true, model: 'gpt-4o' },
                },
            },
        };
        const quorum_out: { result: QuorumResult | null } = { result: null };
        build_members(settings, { environment_report: emptyReport(), quorum_out });
        expect(quorum_out.result).toEqual({
            status: 'inconclusive',
            threshold: 2,
            total: 2,
            present: 1,
        });
    });

    // m2 fix (independent-review finding): `resolveMemberTransport`'s `auto`
    // chain defaults `apiKeyPresent` to "a key-file or env-key auth record
    // exists for this provider" (`hasSource` over the environment report)
    // whenever the member config carries no explicit `api_key_ref` at all.
    // gemini's OWN construction contract is stricter — `_construct_api_member`
    // requires an EXPLICIT `api_key_ref` and refuses the legacy-fallback other
    // providers get. A generic `GEMINI_API_KEY`-shaped env record (detected by
    // the environment report, injected here to avoid depending on this
    // machine's real env) satisfying the permissive auto-chain read while
    // `api_key_ref` was never configured used to throw `CouncilDisabledError`
    // UNCAUGHT — killing the whole pass instead of marking gemini absent.
    it('gemini resolves transport=api via a generic env-key record but has no configured api_key_ref: absent, pass continues', () => {
        process.env[_TEST_KEY_VAR] = 'sk-test-key';
        const settings = {
            ai_council: {
                enabled: true,
                mode: 'auto',
                members: {
                    anthropic: {
                        enabled: true,
                        model: 'claude-sonnet-4-5',
                        api_key_ref: `env:${_TEST_KEY_VAR}`,
                    },
                    gemini: { enabled: true, model: 'gemini-2.5-pro' },
                },
            },
        };
        const reportWithGeminiEnvKey: EnvironmentReport = {
            hosts: [],
            auth: [{ provider: 'gemini', source: 'env-key', evidence: 'env:GEMINI_API_KEY' }],
            keys: [],
        };
        const skipped: Record<string, unknown>[] = [];
        const members = build_members(settings, {
            environment_report: reportWithGeminiEnvKey,
            skipped,
        });
        expect(members.map((m) => m.name)).toEqual(['anthropic']);
        expect(skipped).toHaveLength(1);
        expect(skipped[0]?.['member']).toBe('gemini');
        expect(skipped[0]?.['reason']).toBe('no_auth');
        expect(skipped[0]?.['detail']).toMatch(/api_key_ref/);
    });
});

// ── _synthesize_ai_council_block — quorum forwarding ───────────────────
//
// `config.ts::_build_config` already validated `cfg.quorum`, but the
// synthesized block never forwarded it — `build_members` always saw
// `ai['quorum'] === undefined` and silently fell back to `'majority'`
// regardless of what the user configured.

describe('_synthesize_ai_council_block — quorum', () => {
    it('forwards a configured integer quorum into the synthesized block', () => {
        const dir = mkTmp();
        const yamlPath = path.join(dir, '.ai-council.yml');
        fs.writeFileSync(
            yamlPath,
            [
                'enabled: true',
                'defaults:',
                '  mode: api',
                'cost_budget:',
                '  max_total_usd: 20.0',
                'quorum: 2',
                'members:',
                '  anthropic:',
                '    enabled: true',
                '    model: claude-x',
                '    api_key_ref: env:ANTHROPIC_KEY',
                '',
            ].join('\n'),
            'utf-8',
        );
        const cfg = load_council_config(yamlPath);
        expect(cfg.quorum).toBe(2);
        const synthesized = _synthesize_ai_council_block(cfg);
        expect(synthesized['quorum']).toBe(2);
    });

    it('defaults to majority when the config omits quorum', () => {
        const dir = mkTmp();
        const yamlPath = path.join(dir, '.ai-council.yml');
        fs.writeFileSync(
            yamlPath,
            [
                'enabled: true',
                'defaults:',
                '  mode: api',
                'cost_budget:',
                '  max_total_usd: 20.0',
                'members:',
                '  anthropic:',
                '    enabled: true',
                '    model: claude-x',
                '    api_key_ref: env:ANTHROPIC_KEY',
                '',
            ].join('\n'),
            'utf-8',
        );
        const cfg = load_council_config(yamlPath);
        const synthesized = _synthesize_ai_council_block(cfg);
        expect(synthesized['quorum']).toBe('majority');
    });

    // The same defect class, one key later: `quorum_min_present` is
    // validated by `_build_config`, and a synthesized block that drops it
    // would pin every `floor_would_hold` to the default no matter what the
    // operator configured — validated-but-ignored, exactly as `quorum` was.
    it('forwards a configured quorum_min_present into the synthesized block', () => {
        const dir = mkTmp();
        const yamlPath = path.join(dir, '.ai-council.yml');
        fs.writeFileSync(
            yamlPath,
            [
                'enabled: true',
                'defaults:',
                '  mode: api',
                'cost_budget:',
                '  max_total_usd: 20.0',
                'quorum_min_present: 3',
                'members:',
                '  anthropic:',
                '    enabled: true',
                '    model: claude-x',
                '    api_key_ref: env:ANTHROPIC_KEY',
                '',
            ].join('\n'),
            'utf-8',
        );
        const cfg = load_council_config(yamlPath);
        expect(cfg.quorum_min_present).toBe(3);
        const synthesized = _synthesize_ai_council_block(cfg);
        expect(synthesized['quorum_min_present']).toBe(3);
    });

    it('forwards the ADR-224 default when the config omits the floor', () => {
        const dir = mkTmp();
        const yamlPath = path.join(dir, '.ai-council.yml');
        fs.writeFileSync(
            yamlPath,
            [
                'enabled: true',
                'defaults:',
                '  mode: api',
                'cost_budget:',
                '  max_total_usd: 20.0',
                'members:',
                '  anthropic:',
                '    enabled: true',
                '    model: claude-x',
                '    api_key_ref: env:ANTHROPIC_KEY',
                '',
            ].join('\n'),
            'utf-8',
        );
        const cfg = load_council_config(yamlPath);
        const synthesized = _synthesize_ai_council_block(cfg);
        expect(synthesized['quorum_min_present']).toBe(2);
    });

    // Third instance of the same defect, and the one with money attached:
    // `build_members` reads `ai_council.fallback.api_on_quota` off THIS block,
    // so a dropped key means no config file can ever turn quota fall-through
    // on — while the contract, the template and the unit tests all say it can.
    it('forwards fallback.api_on_quota into the synthesized block', () => {
        const dir = mkTmp();
        const yamlPath = path.join(dir, '.ai-council.yml');
        fs.writeFileSync(
            yamlPath,
            [
                'enabled: true',
                'defaults:',
                '  mode: api',
                'cost_budget:',
                '  max_total_usd: 20.0',
                'fallback:',
                '  api_on_quota: true',
                'members:',
                '  anthropic:',
                '    enabled: true',
                '    model: claude-x',
                '    api_key_ref: env:ANTHROPIC_KEY',
                '',
            ].join('\n'),
            'utf-8',
        );
        const cfg = load_council_config(yamlPath);
        expect(cfg.fallback.api_on_quota).toBe(true);
        const synthesized = _synthesize_ai_council_block(cfg);
        expect((synthesized['fallback'] as Record<string, unknown>)['api_on_quota']).toBe(true);
    });

    it('forwards the spend-safe default when the config omits the block', () => {
        const dir = mkTmp();
        const yamlPath = path.join(dir, '.ai-council.yml');
        fs.writeFileSync(
            yamlPath,
            [
                'enabled: true',
                'defaults:',
                '  mode: api',
                'cost_budget:',
                '  max_total_usd: 20.0',
                'members:',
                '  anthropic:',
                '    enabled: true',
                '    model: claude-x',
                '    api_key_ref: env:ANTHROPIC_KEY',
                '',
            ].join('\n'),
            'utf-8',
        );
        const cfg = load_council_config(yamlPath);
        const synthesized = _synthesize_ai_council_block(cfg);
        expect((synthesized['fallback'] as Record<string, unknown>)['api_on_quota']).toBe(false);
    });
});

// ── cmd_render — handoff round-trip (road-to-always-on-orchestration Phase 4.1) ──
//
// `cmd_run` writes `payload['handoff']`; `cmd_render` reads it back and
// forwards it to `render()`. This exercises that round-trip at the file
// boundary WITHOUT going through `cmd_run --confirm` — `_validate_council_output_path`
// pins `cmd_run`'s own `--output` under the repo's real
// `agents/runtime/council/responses/` (not monkeypatchable, per the
// faithful-port scope note at the top of this file), but `cmd_render`'s
// `--responses` INPUT carries no such restriction, so a hand-built payload
// under `mkTmp()` is a faithful, disk-isolated proxy for what `cmd_run` would
// have written.

function captureStdout(fn: () => number): { rc: number; out: string } {
    const captured: string[] = [];
    const origWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((chunk: string | Uint8Array): boolean => {
        captured.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf-8'));
        return true;
    }) as typeof process.stdout.write;
    let rc: number;
    try {
        rc = fn();
    } finally {
        process.stdout.write = origWrite;
    }
    return { rc, out: captured.join('') };
}

describe('cmd_render — handoff round-trip', () => {
    it('a payload carrying a populated handoff block renders the Handoff section', () => {
        const dir = mkTmp();
        const responsesPath = path.join(dir, 'responses.json');
        fs.writeFileSync(
            responsesPath,
            JSON.stringify({
                schema_version: 1,
                mode: 'prompt',
                responses: [{ provider: 'anthropic', model: 'claude-x', input_tokens: 1, output_tokens: 1, latency_ms: 1, error: null, text: 'hi' }],
                handoff: {
                    decision: 'ship now',
                    rejected_alternatives: [{ option: 'wait a sprint', reason: 'backed by 0 member(s), weight 0.00 of 1.33 needed to conclude' }],
                    constraints: null,
                },
            }),
            'utf-8',
        );
        const { rc, out } = captureStdout(() => cmd_render({ responses: responsesPath } as Args));
        expect(rc).toBe(0);
        expect(out).toContain('### Handoff');
        expect(out).toContain('**Decision:** ship now');
        expect(out).toContain('- **wait a sprint** — backed by 0 member(s), weight 0.00 of 1.33 needed to conclude');
    });

    it('a payload with no `handoff` key at all (pre-Phase-4.1 artefact) renders byte-identically — no Handoff section', () => {
        const dir = mkTmp();
        const responsesPath = path.join(dir, 'responses.json');
        fs.writeFileSync(
            responsesPath,
            JSON.stringify({
                schema_version: 1,
                mode: 'prompt',
                responses: [{ provider: 'anthropic', model: 'claude-x', input_tokens: 1, output_tokens: 1, latency_ms: 1, error: null, text: 'hi' }],
            }),
            'utf-8',
        );
        const { rc, out } = captureStdout(() => cmd_render({ responses: responsesPath } as Args));
        expect(rc).toBe(0);
        expect(out).not.toContain('Handoff');
    });

    it('an honest all-null handoff (attempted, nothing structured found) renders no Handoff section either', () => {
        const dir = mkTmp();
        const responsesPath = path.join(dir, 'responses.json');
        fs.writeFileSync(
            responsesPath,
            JSON.stringify({
                schema_version: 1,
                mode: 'prompt',
                stance_tally: true,
                responses: [{ provider: 'anthropic', model: 'claude-x', input_tokens: 1, output_tokens: 1, latency_ms: 1, error: null, text: 'no stance line here' }],
                handoff: { decision: null, rejected_alternatives: null, constraints: null },
            }),
            'utf-8',
        );
        const { rc, out } = captureStdout(() => cmd_render({ responses: responsesPath } as Args));
        expect(rc).toBe(0);
        expect(out).not.toContain('Handoff');
        // the underlying Vote Tally block still shows the (unresolved) split —
        // handoff being empty does not suppress the rest of the report.
        expect(out).toContain('### Vote Tally');
    });
});

// ── cmd_render — quorum / absent_members round-trip (M4, independent-review finding) ──
//
// `cmd_run` writes `payload['quorum']` (Phase 3.3) and `payload['absent_members']`
// (Phase 3.2), but `cmd_render` never read either back — the same
// forwarded-handoff gap the block above closes for `handoff`, now closed for
// the graded-degradation fields too.

describe('cmd_render — quorum/absent_members round-trip', () => {
    it('a payload carrying quorum + absent_members renders both sections', () => {
        const dir = mkTmp();
        const responsesPath = path.join(dir, 'responses.json');
        fs.writeFileSync(
            responsesPath,
            JSON.stringify({
                schema_version: 1,
                mode: 'prompt',
                responses: [{ provider: 'anthropic', model: 'claude-x', input_tokens: 1, output_tokens: 1, latency_ms: 1, error: null, text: 'hi' }],
                quorum: { status: 'inconclusive', threshold: 2, total: 3, present: 1 },
                absent_members: [
                    { member: 'openai', reason: 'timeout', detail: 'timeout' },
                    { member: 'gemini', reason: 'quota', detail: 'cli_quota_exhausted' },
                ],
            }),
            'utf-8',
        );
        const { rc, out } = captureStdout(() => cmd_render({ responses: responsesPath } as Args));
        expect(rc).toBe(0);
        expect(out).toContain('**Quorum:** 1/3 present, needed 2 — INCONCLUSIVE — release gate holds.');
        expect(out).toContain('### Absent Members');
        expect(out).toContain('openai');
        expect(out).toContain('gemini');
    });

    it('a payload with no `quorum`/`absent_members` keys at all (pre-Phase-3.2/3.3 artefact) renders byte-identically — no Quorum/Absent section', () => {
        const dir = mkTmp();
        const responsesPath = path.join(dir, 'responses.json');
        fs.writeFileSync(
            responsesPath,
            JSON.stringify({
                schema_version: 1,
                mode: 'prompt',
                responses: [{ provider: 'anthropic', model: 'claude-x', input_tokens: 1, output_tokens: 1, latency_ms: 1, error: null, text: 'hi' }],
            }),
            'utf-8',
        );
        const { rc, out } = captureStdout(() => cmd_render({ responses: responsesPath } as Args));
        expect(rc).toBe(0);
        expect(out).not.toContain('Quorum');
        expect(out).not.toContain('Absent Members');
    });

    it('a malformed absent_members entry (missing `detail`) is dropped, not thrown', () => {
        const dir = mkTmp();
        const responsesPath = path.join(dir, 'responses.json');
        fs.writeFileSync(
            responsesPath,
            JSON.stringify({
                schema_version: 1,
                mode: 'prompt',
                responses: [{ provider: 'anthropic', model: 'claude-x', input_tokens: 1, output_tokens: 1, latency_ms: 1, error: null, text: 'hi' }],
                absent_members: [{ member: 'openai' }, { member: 'gemini', reason: 'timeout', detail: 'timeout' }],
            }),
            'utf-8',
        );
        const { rc, out } = captureStdout(() => cmd_render({ responses: responsesPath } as Args));
        expect(rc).toBe(0);
        expect(out).toContain('### Absent Members');
        expect(out).not.toContain('openai');
        expect(out).toContain('gemini');
    });

    it('a legacy `reason` outside the AbsentReason enum (e.g. "unavailable") still renders the row, with a null reason', () => {
        const dir = mkTmp();
        const responsesPath = path.join(dir, 'responses.json');
        fs.writeFileSync(
            responsesPath,
            JSON.stringify({
                schema_version: 1,
                mode: 'prompt',
                responses: [{ provider: 'anthropic', model: 'claude-x', input_tokens: 1, output_tokens: 1, latency_ms: 1, error: null, text: 'hi' }],
                absent_members: [{ member: 'openai', reason: 'unavailable', detail: 'exit_1' }],
            }),
            'utf-8',
        );
        const { rc, out } = captureStdout(() => cmd_render({ responses: responsesPath } as Args));
        expect(rc).toBe(0);
        expect(out).toContain('### Absent Members');
        expect(out).toContain('openai');
        expect(out).toContain('exit_1');
    });
});

// ── cmd_run — estimate-only path (no --confirm, returns before output write) ──

describe('cmd_run', () => {
    it('without --confirm is estimate-only and writes no output', () => {
        const dir = mkTmp();
        const q = path.join(dir, 'ask.txt');
        fs.writeFileSync(q, 'hi', 'utf-8');
        const out_path = path.join(dir, 'out.json');
        const members = [new StubMember('openai', 'gpt-x', new CouncilResponse({ provider: 'openai', model: 'gpt-x', text: 'x' }))];
        const args: Args = {
            question: q,
            input_mode: 'prompt',
            max_tokens: 10,
            mode_override: null,
            original_ask: '',
            confirm: false,
            output: out_path,
            rounds: 1,
        };
        const captured: string[] = [];
        const origWrite = process.stdout.write.bind(process.stdout);
        process.stdout.write = ((chunk: string | Uint8Array): boolean => {
            captured.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf-8'));
            return true;
        }) as typeof process.stdout.write;
        let rc: number;
        try {
            rc = cmd_run(args, { settings: { ai_council: { enabled: true } }, members, table: fakeTable() });
        } finally {
            process.stdout.write = origWrite;
        }
        expect(rc).toBe(0);
        expect(fs.existsSync(out_path)).toBe(false);
        expect(captured.join('')).toContain('No --confirm flag');
    });
});

// ── _postRunQuorum — quorum measures usable responses, not construction (M3) ──
//
// `cmd_run --confirm` calls this right after `consult()` returns, so
// `members[i]` and `responses[i]` are always index-aligned in production —
// the fixtures below preserve that alignment. Regression target: a member
// that CONSTRUCTED fine (so `build_members`'s pre-run quorum counted it
// `present`) but whose `ask()` call failed mid-flight must NOT count as
// present here.

describe('_postRunQuorum', () => {
    it('both members error → inconclusive (majority of 2 = 1, present = 0)', () => {
        const members = [
            new StubMember('anthropic', 'claude-x', new CouncilResponse({ provider: 'anthropic', model: 'claude-x', text: '', error: 'auth_expired' })),
            new StubMember('openai', 'gpt-x', new CouncilResponse({ provider: 'openai', model: 'gpt-x', text: '', error: 'timeout' })),
        ];
        const responses = members.map((m) => m.ask());
        const { quorum, absent } = _postRunQuorum(members, responses, {});
        expect(quorum).toEqual({ status: 'inconclusive', threshold: 1, total: 2, present: 0 });
        expect(absent).toEqual([
            { member: 'anthropic', reason: 'no_auth', detail: 'auth_expired' },
            { member: 'openai', reason: 'timeout', detail: 'timeout' },
        ]);
    });

    it('one error (quota) + one ok → concluded (majority of 2 = 1, present = 1), absent carries the quota mapping', () => {
        const members = [
            new StubMember('anthropic', 'claude-x', new CouncilResponse({ provider: 'anthropic', model: 'claude-x', text: 'a real answer' })),
            new StubMember('openai', 'gpt-x', new CouncilResponse({ provider: 'openai', model: 'gpt-x', text: '', error: 'cli_quota_exhausted' })),
        ];
        const responses = members.map((m) => m.ask());
        const { quorum, absent } = _postRunQuorum(members, responses, {});
        expect(quorum).toEqual({ status: 'concluded', threshold: 1, total: 2, present: 1 });
        expect(absent).toEqual([{ member: 'openai', reason: 'quota', detail: 'cli_quota_exhausted' }]);
    });

    // A seat saved by the mid-flight fallback must count as PRESENT. The
    // reading should already give that — the twin's response replaces the seat
    // index-aligned, so this function sees a non-empty, error-free answer and
    // never learns which transport produced it. Pinned rather than trusted:
    // the whole point of the fallback is not losing the seat, and nothing else
    // in the tree would fail if a future edit started keying attendance on the
    // declared member's transport instead of on the response.
    it('a seat answered by the api twin counts as present, not absent', () => {
        const twinAnswer = new CouncilResponse({
            provider: 'anthropic',
            model: 'claude-x',
            text: 'answered over the api rung',
            metadata: {
                fallback_from: 'cli',
                fallback_reason: 'auth_rejected',
                fallback_original_error: 'auth_expired',
                transport: 'api',
            },
        });
        const members = [
            new StubMember('anthropic', 'claude-x', twinAnswer),
            new StubMember('openai', 'gpt-x', new CouncilResponse({ provider: 'openai', model: 'gpt-x', text: 'b' })),
        ];
        const responses = members.map((m) => m.ask());
        const { quorum, absent } = _postRunQuorum(members, responses, {});
        expect(quorum).toEqual({ status: 'concluded', threshold: 1, total: 2, present: 2 });
        expect(absent).toEqual([]);
    });

    it('a fallback that was REFUSED by the retry budget still counts as absent', () => {
        // The mirror case: `fallback_skipped: cost_budget` means the original
        // failure stands, so the seat is lost. Metadata must not rescue it.
        const members = [
            new StubMember('anthropic', 'claude-x', new CouncilResponse({
                provider: 'anthropic',
                model: 'claude-x',
                text: '',
                error: 'auth_expired',
                metadata: { fallback_skipped: 'cost_budget' },
            })),
        ];
        const responses = members.map((m) => m.ask());
        const { quorum, absent } = _postRunQuorum(members, responses, {});
        expect(quorum).toEqual({ status: 'inconclusive', threshold: 1, total: 1, present: 0 });
        expect(absent).toEqual([{ member: 'anthropic', reason: 'no_auth', detail: 'auth_expired' }]);
    });

    it('a missing response entry (index past the end of `responses`) counts as absent, never as present', () => {
        const members = [new StubMember('anthropic', 'claude-x', new CouncilResponse({ provider: 'anthropic', model: 'claude-x', text: 'ok' }))];
        const { quorum, absent } = _postRunQuorum(members, [], {});
        expect(quorum).toEqual({ status: 'inconclusive', threshold: 1, total: 1, present: 0 });
        expect(absent).toEqual([{ member: 'anthropic', reason: 'unavailable', detail: 'no response' }]);
    });

    // Round 7 § 5.2 — attendance is a NON-EMPTY answer, not the absence of an
    // error. Measured: a 290 s curl timeout returned an empty body with NO error
    // set in two sessions, and the banner printed `2/2 present` — a single-voice
    // verdict presented as convergence, on a paid run.
    it('an empty response body with NO error counts as ABSENT, not present', () => {
        const members = [
            new StubMember('anthropic', 'claude-x', new CouncilResponse({ provider: 'anthropic', model: 'claude-x', text: '' })),
            new StubMember('openai', 'gpt-x', new CouncilResponse({ provider: 'openai', model: 'gpt-x', text: 'a real answer' })),
        ];
        const responses = members.map((m) => m.ask());
        const { quorum, absent } = _postRunQuorum(members, responses, {});
        expect(quorum).toEqual({ status: 'concluded', threshold: 1, total: 2, present: 1 });
        expect(absent).toEqual([
            { member: 'anthropic', reason: 'unavailable', detail: 'empty response body' },
        ]);
    });

    it('whitespace-only text is empty too — a body of newlines is not an answer', () => {
        const members = [
            new StubMember('anthropic', 'claude-x', new CouncilResponse({ provider: 'anthropic', model: 'claude-x', text: '\n \n' })),
        ];
        const responses = members.map((m) => m.ask());
        const { quorum } = _postRunQuorum(members, responses, {});
        expect(quorum.present).toBe(0);
    });

    it('a real answer still counts — the change must not deduct a working member', () => {
        const members = [
            new StubMember('anthropic', 'claude-x', new CouncilResponse({ provider: 'anthropic', model: 'claude-x', text: 'ok' })),
            new StubMember('openai', 'gpt-x', new CouncilResponse({ provider: 'openai', model: 'gpt-x', text: 'ok' })),
        ];
        const responses = members.map((m) => m.ask());
        const { quorum, absent } = _postRunQuorum(members, responses, {});
        expect(quorum).toEqual({ status: 'concluded', threshold: 1, total: 2, present: 2 });
        expect(absent).toEqual([]);
    });

    it('an explicit `quorum: 2` over 3 members with 2 present is still inconclusive (2 < 2 is false, so this is concluded) — sanity on the setting passthrough', () => {
        const members = [
            new StubMember('anthropic', 'claude-x', new CouncilResponse({ provider: 'anthropic', model: 'claude-x', text: 'ok' })),
            new StubMember('openai', 'gpt-x', new CouncilResponse({ provider: 'openai', model: 'gpt-x', text: 'ok' })),
            new StubMember('gemini', 'gemini-x', new CouncilResponse({ provider: 'gemini', model: 'gemini-x', text: '', error: 'exit_1' })),
        ];
        const responses = members.map((m) => m.ask());
        const { quorum, absent } = _postRunQuorum(members, responses, { quorum: 2 });
        expect(quorum).toEqual({ status: 'concluded', threshold: 2, total: 3, present: 2 });
        expect(absent).toEqual([{ member: 'gemini', reason: 'unavailable', detail: 'exit_1' }]);
    });

    // Step 2.3 — a member that said SOMETHING no parser could read is neither
    // present nor plainly absent. The byte check at the top of the loop admits
    // it (`text.trim() !== ''` is true of a prose refusal), so before this it
    // was folded into `N/N present` and the banner claimed an attendance the
    // run never established. `present-unparsed` is its own bucket: excluded
    // from `present`, counted in `unparsed`, and rendered as such.
    it('a non-empty answer no parser could read is present-unparsed, not present', () => {
        const members = [
            new StubMember('anthropic', 'claude-x', new CouncilResponse({ provider: 'anthropic', model: 'claude-x', text: 'a real answer' })),
            new StubMember('openai', 'gpt-x', new CouncilResponse({ provider: 'openai', model: 'gpt-x', text: 'I would rather not answer that.' })),
        ];
        const responses = members.map((m) => m.ask());
        const { quorum, absent } = _postRunQuorum(members, responses, {}, new Map([['openai', 'parse_failed']]));
        expect(quorum).toEqual({ status: 'concluded', threshold: 1, total: 2, present: 1, unparsed: 1 });
        expect(absent).toEqual([{ member: 'openai', reason: 'unparsed', detail: 'answer present, no parser could read it' }]);
    });

    // The mirror, asserted rather than assumed: an outcome that is NOT
    // `parse_failed` must leave attendance exactly where it was, and `unparsed`
    // must be absent from the shape rather than present-and-zero — every
    // existing assertion in this block is an exact-shape `toEqual`, so a
    // defaulted `unparsed: 0` would be a silent breaking change to the payload.
    it('a `parsed` outcome leaves the shape byte-identical — no `unparsed` key', () => {
        const members = [
            new StubMember('anthropic', 'claude-x', new CouncilResponse({ provider: 'anthropic', model: 'claude-x', text: 'a real answer' })),
            new StubMember('openai', 'gpt-x', new CouncilResponse({ provider: 'openai', model: 'gpt-x', text: '[]' })),
        ];
        const responses = members.map((m) => m.ask());
        const { quorum } = _postRunQuorum(members, responses, {}, new Map([['anthropic', 'parsed'], ['openai', 'empty']]));
        expect(quorum).toEqual({ status: 'concluded', threshold: 1, total: 2, present: 2 });
    });

    // An unparseable answer from a member that ALSO errored stays classified by
    // the error. The transport failure is the stronger fact and the one the
    // absent-member table already renders; re-labelling it `unparsed` would
    // lose the auth/timeout/quota distinction `AbsentReason` exists to carry.
    it('a transport error outranks an unparsed outcome for the same member', () => {
        const members = [
            new StubMember('anthropic', 'claude-x', new CouncilResponse({ provider: 'anthropic', model: 'claude-x', text: '', error: 'auth_expired' })),
        ];
        const responses = members.map((m) => m.ask());
        const { quorum, absent } = _postRunQuorum(members, responses, {}, new Map([['anthropic', 'parse_failed']]));
        expect(quorum).toEqual({ status: 'inconclusive', threshold: 1, total: 1, present: 0 });
        expect(absent).toEqual([{ member: 'anthropic', reason: 'no_auth', detail: 'auth_expired' }]);
    });
});

// ── the rendered banner carries the unparsed bucket (Step 2.3, AC-2) ──
describe('_format_quorum_line — present-unparsed', () => {
    it('two members, one unparseable → the banner does not read 2/2 present and names the bucket', () => {
        const line = _format_quorum_line({ status: 'concluded', threshold: 1, total: 2, present: 1, unparsed: 1 });
        expect(line).not.toContain('2/2 present');
        expect(line).toContain('present-unparsed');
        expect(line).toContain('1/2 present');
    });

    it('no unparsed members leaves the line byte-identical to before', () => {
        const line = _format_quorum_line({ status: 'concluded', threshold: 1, total: 2, present: 2 });
        expect(line).not.toContain('present-unparsed');
    });
});

// ── cmd_debate — disclosure + refusal cap (all return before output write) ──

function debateArgs(dir: string, opts: { rounds?: number; confirm?: boolean } = {}): Args {
    const q = path.join(dir, 'ask.txt');
    fs.writeFileSync(q, 'Design trade-off: monolith vs microservices', 'utf-8');
    return {
        question: q,
        input_mode: 'prompt',
        max_tokens: 128,
        mode_override: null,
        original_ask: '',
        confirm: opts.confirm ?? false,
        output: path.join(dir, 'debate-out'),
        rounds: opts.rounds ?? 2,
        model: null,
        siblings: null,
        proceed_anyway: false,
        invocation: 'agent',
        continue_as_debate: null,
        auto_continue: true,
        depth: 'standard',
    };
}

describe('cmd_debate', () => {
    let logSpy: string[] = [];
    let errSpy: string[] = [];
    let origLog: typeof process.stdout.write;
    let origErr: typeof process.stderr.write;

    function captureStart() {
        logSpy = [];
        errSpy = [];
        origLog = process.stdout.write.bind(process.stdout);
        origErr = process.stderr.write.bind(process.stderr);
        process.stdout.write = ((chunk: string | Uint8Array): boolean => {
            logSpy.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf-8'));
            return true;
        }) as typeof process.stdout.write;
        process.stderr.write = ((chunk: string | Uint8Array): boolean => {
            errSpy.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf-8'));
            return true;
        }) as typeof process.stderr.write;
    }
    function captureStop() {
        process.stdout.write = origLog;
        process.stderr.write = origErr;
    }

    it('disclosure mode=always renders the block', () => {
        const dir = mkTmp();
        const members = [new StubMember('openai', 'gpt-x', new CouncilResponse({ provider: 'openai', model: 'gpt-x', text: 'r' }))];
        captureStart();
        let rc: number;
        try {
            rc = cmd_debate(debateArgs(dir), {
                settings: {
                    ai_council: {
                        enabled: true,
                        debate: {
                            max_cost_usd: 100.0,
                            cost_disclosure: { mode: 'always', show_per_member: true },
                        },
                    },
                },
                members,
                table: fakeTable(),
            });
        } finally {
            captureStop();
        }
        const out = logSpy.join('');
        expect(rc).toBe(0);
        expect(out).toContain('cost-disclosure');
        expect(out).toContain('per member');
    });

    it('disclosure mode=off suppresses the block', () => {
        const dir = mkTmp();
        const members = [new StubMember('openai', 'gpt-x', new CouncilResponse({ provider: 'openai', model: 'gpt-x', text: 'r' }))];
        captureStart();
        let rc: number;
        try {
            rc = cmd_debate(debateArgs(dir), {
                settings: {
                    ai_council: {
                        enabled: true,
                        debate: { max_cost_usd: 100.0, cost_disclosure: { mode: 'off' } },
                    },
                },
                members,
                table: fakeTable(),
            });
        } finally {
            captureStop();
        }
        expect(rc).toBe(0);
        expect(logSpy.join('')).not.toContain('cost-disclosure');
    });

    it('disclosure above_threshold skips the block when below the threshold', () => {
        const dir = mkTmp();
        const members = [new StubMember('openai', 'gpt-x', new CouncilResponse({ provider: 'openai', model: 'gpt-x', text: 'r' }))];
        captureStart();
        let rc: number;
        try {
            rc = cmd_debate(debateArgs(dir, { rounds: 1 }), {
                settings: {
                    ai_council: {
                        enabled: true,
                        debate: {
                            max_cost_usd: 100.0,
                            cost_disclosure: { mode: 'above_threshold', threshold_usd: 1000.0 },
                        },
                    },
                },
                members,
                table: fakeTable(),
            });
        } finally {
            captureStop();
        }
        expect(rc).toBe(0);
        expect(logSpy.join('')).not.toContain('cost-disclosure');
    });

    it('refusal cap blocks (exit 4) when the high-end estimate exceeds max_cost_usd', () => {
        const dir = mkTmp();
        const members = [new StubMember('openai', 'gpt-x', new CouncilResponse({ provider: 'openai', model: 'gpt-x', text: 'r' }))];
        captureStart();
        let rc: number;
        try {
            rc = cmd_debate(debateArgs(dir, { rounds: 4, confirm: true }), {
                settings: {
                    ai_council: {
                        enabled: true,
                        debate_max_rounds: 4,
                        debate: {
                            max_cost_usd: 0.000001, // impossibly low
                            cost_disclosure: { mode: 'always' },
                        },
                    },
                },
                members,
                table: fakeTable(),
            });
        } finally {
            captureStop();
        }
        const err = errSpy.join('');
        expect(rc).toBe(4);
        expect(err).toContain('refused');
        expect(err).toContain('max_cost_usd');
    });

    it('refusal cap of 0 disables the check', () => {
        const dir = mkTmp();
        const members = [new StubMember('openai', 'gpt-x', new CouncilResponse({ provider: 'openai', model: 'gpt-x', text: 'r' }))];
        captureStart();
        let rc: number;
        try {
            rc = cmd_debate(debateArgs(dir, { rounds: 1 }), {
                settings: {
                    ai_council: {
                        enabled: true,
                        debate: { max_cost_usd: 0, cost_disclosure: { mode: 'off' } },
                    },
                },
                members,
                table: fakeTable(),
            });
        } finally {
            captureStop();
        }
        expect(rc).toBe(0);
        expect(errSpy.join('')).not.toContain('refused');
    });
});

// ── the quorum banner names its phase ─────────────────────────────────
//
// A degraded `cmd_run` prints attendance twice and the two readings
// CONTRADICT each other: the pre-run line is derived from the constructed
// roster, the post-run line from who actually answered. Until 2026-08-12
// neither carried a phase, so `council:quorum · 2/2 present … concluded`
// and `council:quorum · 0/2 present … INCONCLUSIVE` were distinguishable
// only by reading order — and the first one is the wrong one.
//
// A unit test rather than an end-to-end one on purpose: the pre-run print is
// gated on `build_members` having populated `quorum_out`, which an injected
// roster skips, so the two-line shape is unreachable from any no-spend harness.
describe('_format_quorum_line — phase tag', () => {
    const concluded: QuorumResult = { status: 'concluded', threshold: 1, total: 2, present: 2 };
    const inconclusive: QuorumResult = { status: 'inconclusive', threshold: 1, total: 2, present: 0 };

    it('the two readings of one degraded run are distinguishable without reading order', () => {
        const pre = _format_quorum_line(concluded, 'pre_run');
        const post = _format_quorum_line(inconclusive, 'post_run');
        expect(pre).toContain('before the run');
        expect(post).toContain('after the run');
        // The property that actually matters: neither line can be mistaken for
        // the other by a reader or by a grep on the shared prefix.
        expect(pre).not.toEqual(post);
        expect(pre.includes('after the run')).toBe(false);
        expect(post.includes('before the run')).toBe(false);
    });

    it('an untagged line stays byte-identical to the pre-phase format', () => {
        // The estimate path prints exactly one attendance line, so a phase tag
        // there would claim a distinction it does not make.
        expect(_format_quorum_line(concluded)).toBe('council:quorum · 2/2 present, needed 1 — concluded.');
    });

    it('the post-run tag rides alongside the DEGRADED warning, not instead of it', () => {
        const post = _format_quorum_line(inconclusive, 'post_run');
        expect(post).toContain('after the run');
        expect(post).toContain('INCONCLUSIVE — release gate holds');
        expect(post).toContain('DEGRADED — 2 member(s) did not answer');
    });
});

// ── Phase 4 falsifiability gate: the whole chain, end to end ────────────────
//
// Every layer of this feature was tested in isolation and shipped broken
// twice anyway — once because the fallback sat behind a `billable` early
// return that the real CLI clients always take, once because the config key
// was dropped by the block `build_members` actually reads. Both would have
// failed this test on its first run. So the claim it registers is
// deliberately about the CHAIN, not about any one seam:
//
//   an eligible cli failure with a constructible api twin loses zero seats.
//
// config file → load_council_config → _synthesize_ai_council_block →
// build_members(fallback_out) → consult → api twin → rendered artefact.

describe('mid-flight fallback — end to end from a config file', () => {
    const KEY_VAR = 'COUNCIL_FALLBACK_E2E_KEY';
    afterEach(() => {
        delete process.env[KEY_VAR];
    });

    /** A cli seat shaped like the real thing: subscription, non-billable. */
    class DeadCliSeat extends ExternalAIClient {
        calls = 0;
        constructor(private readonly stderr: string) {
            super();
            this.name = 'anthropic';
            this.model = 'claude-sonnet-4-5';
            this.billable = false;
            this.transport = 'cli';
            this.subscription_label = 'claude-pro';
        }
        override ask(): CouncilResponse {
            this.calls += 1;
            return new CouncilResponse({
                provider: this.name,
                model: this.model,
                text: '',
                error: this.stderr,
                latency_ms: 1,
            });
        }
    }

    /**
     * Drive the REAL chain — file → loader → synthesized block →
     * `build_members` → `fallback_out` — and hand back what it produced.
     *
     * The returned options are then used with `construct` swapped for a stub
     * (see `hermetic` below). The real factory genuinely builds an
     * `AnthropicClient`, and calling it would issue an HTTP request to
     * Anthropic — the first draft of this test did exactly that and came back
     * with a 401. A unit test that reaches the network is not a gate, it is a
     * flake, so the chain is exercised up to and including construction and
     * the transport itself is stubbed.
     */
    function fallbackOptionsFromConfig(yamlBody: string): CliFallbackOptions {
        const dir = mkTmp();
        const yamlPath = path.join(dir, '.ai-council.yml');
        fs.writeFileSync(yamlPath, yamlBody, 'utf-8');
        const cfg = load_council_config(yamlPath);
        const settings = { ai_council: _synthesize_ai_council_block(cfg) };
        const fallback_out: { options: CliFallbackOptions | null } = { options: null };
        build_members(settings, { environment_report: emptyReport(), fallback_out });
        if (fallback_out.options === null) {
            throw new Error('build_members did not populate fallback_out');
        }
        return fallback_out.options;
    }

    /**
     * The same options with the transport stubbed. `construct` still runs the
     * real factory first and asserts it produced an api client — that is the
     * link in the chain this test exists to prove — then returns a stub that
     * answers offline.
     */
    function hermetic(options: CliFallbackOptions, answer = 'answered over api'): CliFallbackOptions {
        return {
            api_on_quota: options.api_on_quota,
            construct: (provider: string) => {
                const real: ExternalAIClient | null = options.construct(provider);
                if (real === null) return null;
                expect(real.transport).toBe('api');
                const name = real.name;
                const model = real.model;
                const stub = new (class extends ExternalAIClient {
                    constructor() {
                        super();
                        this.name = name;
                        this.model = model;
                        this.transport = 'api';
                        this.billable = true;
                    }
                    override ask(): CouncilResponse {
                        return new CouncilResponse({
                            provider: this.name,
                            model: this.model,
                            text: answer,
                            latency_ms: 1,
                        });
                    }
                })();
                return stub;
            },
        };
    }

    const CONFIG = (apiOnQuota: boolean): string =>
        [
            'enabled: true',
            'cost_budget:',
            '  max_total_usd: 20.0',
            'fallback:',
            `  api_on_quota: ${apiOnQuota}`,
            'members:',
            '  anthropic:',
            '    enabled: true',
            '    model: claude-sonnet-4-5',
            `    api_key_ref: env:${KEY_VAR}`,
            '',
        ].join('\n');

    it('a provider-quota cli failure keeps the seat when the opt-in is on', () => {
        process.env[KEY_VAR] = 'sk-test-key';
        const options = fallbackOptionsFromConfig(CONFIG(true));
        // The chain carried the operator's decision all the way here. Before
        // the key was modelled this read `false` no matter what the file said.
        expect(options.api_on_quota).toBe(true);

        const seat = new DeadCliSeat('cli_quota_exhausted');
        const responses = consult(
            [seat],
            new CouncilQuestion({ mode: 'prompt', user_prompt: 'q' }),
            null,
            { cli_fallback: hermetic(options) },
        );

        expect(responses).toHaveLength(1);
        expect(responses[0]!.error).toBeNull();
        expect(responses[0]!.metadata['fallback_from']).toBe('cli');
        expect(responses[0]!.metadata['fallback_reason']).toBe('quota_exhausted');
        expect(responses[0]!.metadata['transport']).toBe('api');
        // The dead binary was called once, and the twin answered after it.
        expect(seat.calls).toBe(1);
        // …and the artefact a human reads says which transport answered.
        expect(render(responses)).toContain('fell back from cli: quota_exhausted');
    });

    it('the same failure loses the seat when the opt-in is off — the default', () => {
        process.env[KEY_VAR] = 'sk-test-key';
        const options = fallbackOptionsFromConfig(CONFIG(false));
        expect(options.api_on_quota).toBe(false);

        const seat = new DeadCliSeat('cli_quota_exhausted');
        const responses = consult(
            [seat],
            new CouncilQuestion({ mode: 'prompt', user_prompt: 'q' }),
            null,
            { cli_fallback: hermetic(options) },
        );
        expect(responses[0]!.error).toBe('cli_quota_exhausted');
        expect(responses[0]!.metadata['fallback_from']).toBeUndefined();
    });

    it('an auth failure keeps the seat with the opt-in OFF — the base classes never needed it', () => {
        process.env[KEY_VAR] = 'sk-test-key';
        const options = fallbackOptionsFromConfig(CONFIG(false));
        // `auth_expired`, not raw stderr prose: `CliClient` normalises the
        // binary's stderr to a short code before setting `error`, and
        // `classifyCliFailure` matches the code. Handing it prose here would
        // classify as `other` and test nothing.
        const seat = new DeadCliSeat('auth_expired');
        const responses = consult(
            [seat],
            new CouncilQuestion({ mode: 'prompt', user_prompt: 'q' }),
            null,
            { cli_fallback: hermetic(options) },
        );
        expect(responses[0]!.error).toBeNull();
        expect(responses[0]!.metadata['fallback_reason']).toBe('auth_rejected');
    });

    it('a provider with no api rung yields no twin — the factory returns null, it does not throw', () => {
        process.env[KEY_VAR] = 'sk-test-key';
        const options = fallbackOptionsFromConfig(CONFIG(true));
        // `perplexity` is not in this config, so the factory sees no
        // `api_key_ref` and the strict api contract refuses it. The refusal
        // must arrive as `null` — an escalation that throws would take down
        // the pass it was supposed to rescue.
        expect(options.construct('perplexity')).toBeNull();
    });

    it('a rotated key between construction and retry yields no twin, not a crash', () => {
        process.env[KEY_VAR] = 'sk-test-key';
        const options = fallbackOptionsFromConfig(CONFIG(true));
        // The factory resolves the key at CONSTRUCT time, so unsetting it here
        // is what a rotated or expired key looks like mid-pass.
        delete process.env[KEY_VAR];
        expect(options.construct('anthropic')).toBeNull();

        const seat = new DeadCliSeat('cli_quota_exhausted');
        const responses = consult(
            [seat],
            new CouncilQuestion({ mode: 'prompt', user_prompt: 'q' }),
            null,
            { cli_fallback: options },
        );
        // The original failure stands, unmodified. The seat is lost, which is
        // the honest outcome when there is nothing to fall back to.
        expect(responses[0]!.error).toBe('cli_quota_exhausted');
        expect(responses[0]!.metadata['fallback_from']).toBeUndefined();
    });
});
