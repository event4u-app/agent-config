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
//     blocked-by-export, not silently skipped.
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

import { afterEach, describe, expect, it } from 'vitest';

import {
    CouncilResponse,
    ExternalAIClient,
} from '../../../src/scripts/ai_council/clients.js';
import type { Price, PriceTable } from '../../../src/scripts/ai_council/pricing.js';
import {
    CouncilDisabledError,
    build_members,
    cmd_debate,
    cmd_run,
    _parse_siblings_overrides,
} from '../../../src/scripts/council_cli.js';

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
