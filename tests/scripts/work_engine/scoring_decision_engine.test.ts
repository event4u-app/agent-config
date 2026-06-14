// Golden-parity tests for work_engine/scoring/decision_engine.ts vs
// decision_engine.py (ADR-094 py2ts Phase 1 — scoring subpackage).
//
// `scoring/decision_engine.py` imports only stdlib (`os`, `dataclasses`,
// `typing`) — loaded via the direct-file importlib loader. Covers: parse()
// defaults / unknown-key rejection / per-field coercion + error text,
// evaluate_gates() conflict-priority + per-phase routing + action resolution
// (with an injected is_interactive so the TTY/CI path is deterministic), and
// the gate-reason strings (which carry `repr()`-formatted values — a byte
// surface). The `CI` env path is exercised by passing is_interactive
// explicitly so the suite stays deterministic regardless of the runner env.
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
    ALLOWED_KEYS,
    DecisionEngineConfigError,
    DecisionEngineSettings,
    GATE_PRIORITY,
    GateDecision,
    evaluate_gates,
    parse,
} from '../../../src/agent-src/templates/scripts/work_engine/scoring/decision_engine.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const PY = path.join(
    REPO_ROOT,
    'src',
    'agent-src',
    'templates',
    'scripts',
    'work_engine',
    'scoring',
    'decision_engine.py',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

const PY_LOADER = [
    'import sys, json, importlib.util, dataclasses',
    `spec = importlib.util.spec_from_file_location("de", ${JSON.stringify(PY)})`,
    'de = importlib.util.module_from_spec(spec)',
    'sys.modules["de"] = de',
    'spec.loader.exec_module(de)',
].join('\n');

/** Python: parse(data) → asdict, or {"error": <msg>} on DecisionEngineConfigError. */
function pyParse(data: unknown): unknown {
    const body = [
        'data = json.loads(sys.argv[1])',
        'try:',
        '    s = de.parse(data)',
        '    sys.stdout.write(json.dumps(dataclasses.asdict(s)))',
        'except de.DecisionEngineConfigError as exc:',
        '    sys.stdout.write(json.dumps({"error": str(exc)}))',
    ].join('\n');
    const r = spawnSync('python3', ['-c', `${PY_LOADER}\n${body}`, JSON.stringify(data ?? null)], {
        encoding: 'utf8',
    });
    if (r.status !== 0) {
        throw new Error(`python3 failed: ${r.stderr || r.stdout}`);
    }
    return JSON.parse(r.stdout);
}

/** Python: evaluate_gates(parse(settings), ...) with a fixed is_interactive. */
function pyEvaluate(
    settings: Record<string, unknown>,
    phase: string,
    confidence_band: string | null,
    risk_class: string | null,
    memory_hits: number,
    interactive: boolean,
): unknown {
    const body = [
        'p = json.loads(sys.argv[1])',
        's = de.parse(p["settings"])',
        'dec = de.evaluate_gates(s, phase=p["phase"], confidence_band=p["cb"], risk_class=p["rc"], memory_hits=p["mh"], is_interactive=lambda: p["interactive"])',
        'sys.stdout.write(json.dumps(dataclasses.asdict(dec) if dec is not None else None))',
    ].join('\n');
    const payload = {
        settings,
        phase,
        cb: confidence_band,
        rc: risk_class,
        mh: memory_hits,
        interactive,
    };
    const r = spawnSync('python3', ['-c', `${PY_LOADER}\n${body}`, JSON.stringify(payload)], {
        encoding: 'utf8',
    });
    if (r.status !== 0) {
        throw new Error(`python3 failed: ${r.stderr || r.stdout}`);
    }
    return JSON.parse(r.stdout);
}

function gateToDict(d: GateDecision | null): unknown {
    if (d === null) {
        return null;
    }
    return { gate_id: d.gate_id, phase: d.phase, reason: d.reason, action: d.action };
}

function settingsToDict(s: DecisionEngineSettings): Record<string, unknown> {
    return {
        surface_traces: s.surface_traces,
        min_confidence: s.min_confidence,
        block_on_risk: s.block_on_risk,
        require_memory_hits: s.require_memory_hits,
        on_block: s.on_block,
        ask_timeout_seconds: s.ask_timeout_seconds,
        on_block_fallback: s.on_block_fallback,
    };
}

describe('scoring/decision_engine — constants', () => {
    it('ALLOWED_KEYS + GATE_PRIORITY', () => {
        expect([...ALLOWED_KEYS].sort()).toEqual(
            [
                'ask_timeout_seconds',
                'block_on_risk',
                'min_confidence',
                'on_block',
                'on_block_fallback',
                'require_memory_hits',
                'surface_traces',
            ].sort(),
        );
        expect([...GATE_PRIORITY]).toEqual(['block_on_risk', 'require_memory_hits', 'min_confidence']);
    });
});

describe('scoring/decision_engine — parse', () => {
    it('null / empty → defaults, no gate active', () => {
        const d = parse(null);
        expect(d.min_confidence).toBe('off');
        expect(d.any_gate_active).toBe(false);
        expect(parse({}).any_gate_active).toBe(false);
    });

    it('unknown key → DecisionEngineConfigError with sorted names', () => {
        expect(() => parse({ bogus: 1, zzz: 2 })).toThrow(DecisionEngineConfigError);
        try {
            parse({ zzz: 2, bogus: 1 });
        } catch (e) {
            expect((e as Error).message).toContain('unknown key(s): bogus, zzz');
        }
    });

    it('YAML off-as-false accepted for levels; True rejected', () => {
        expect(parse({ min_confidence: false }).min_confidence).toBe('off');
        expect(() => parse({ min_confidence: true })).toThrow(DecisionEngineConfigError);
    });

    it('negative ask_timeout_seconds rejected', () => {
        expect(() => parse({ ask_timeout_seconds: -1 })).toThrow(/must be >= 0/);
    });

    it('bool given to int field rejected', () => {
        expect(() => parse({ ask_timeout_seconds: true })).toThrow(/expected int, got bool/);
    });

    it('any_gate_active true when a gate is set', () => {
        expect(parse({ min_confidence: 'high' }).any_gate_active).toBe(true);
        expect(parse({ require_memory_hits: true }).any_gate_active).toBe(true);
    });
});

describe('scoring/decision_engine — evaluate_gates', () => {
    it('no gate active → null', () => {
        const s = parse({});
        expect(
            evaluate_gates(s, {
                phase: 'plan',
                confidence_band: 'low',
                risk_class: 'high',
                memory_hits: 0,
            }),
        ).toBeNull();
    });

    it('min_confidence floor fires on plan when band below', () => {
        const s = parse({ min_confidence: 'high' });
        const d = evaluate_gates(s, {
            phase: 'plan',
            confidence_band: 'medium',
            risk_class: null,
            memory_hits: 0,
        });
        expect(d?.gate_id).toBe('min_confidence');
        expect(d?.phase).toBe('plan');
        expect(d?.action).toBe('stop');
        expect(d?.reason).toContain("confidence_band='medium' below floor");
    });

    it('block_on_risk ceiling fires on implement', () => {
        const s = parse({ block_on_risk: 'medium' });
        const d = evaluate_gates(s, {
            phase: 'implement',
            confidence_band: null,
            risk_class: 'high',
            memory_hits: 0,
        });
        expect(d?.gate_id).toBe('block_on_risk');
        expect(d?.reason).toContain("risk_class='high' at/above ceiling");
    });

    it('require_memory_hits fires on refine when hits < 1', () => {
        const s = parse({ require_memory_hits: true });
        const d = evaluate_gates(s, {
            phase: 'refine',
            confidence_band: null,
            risk_class: null,
            memory_hits: 0,
        });
        expect(d?.gate_id).toBe('require_memory_hits');
        expect(d?.reason).toContain('memory_hits=0 but require_memory_hits=true');
    });

    it('on_block=ask resolves via injected is_interactive', () => {
        const s = parse({ min_confidence: 'high', on_block: 'ask' });
        const interactive = evaluate_gates(s, {
            phase: 'plan',
            confidence_band: 'low',
            risk_class: null,
            memory_hits: 0,
            is_interactive: () => true,
        });
        expect(interactive?.action).toBe('ask');
        const headless = evaluate_gates(s, {
            phase: 'plan',
            confidence_band: 'low',
            risk_class: null,
            memory_hits: 0,
            is_interactive: () => false,
        });
        expect(headless?.action).toBe('ask_timeout');
    });

    it('gate maps only to its own phase', () => {
        const s = parse({ min_confidence: 'high' });
        // min_confidence only fires on `plan`; on `implement` it returns null.
        expect(
            evaluate_gates(s, {
                phase: 'implement',
                confidence_band: 'low',
                risk_class: null,
                memory_hits: 0,
            }),
        ).toBeNull();
    });
});

describe('scoring/decision_engine — class wrappers', () => {
    it('GateDecision + DecisionEngineSettings are frozen', () => {
        const g = new GateDecision({ gate_id: 'x', phase: 'plan', reason: 'r', action: 'stop' });
        expect(() => {
            // @ts-expect-error frozen
            g.action = 'warn';
        }).toThrow();
        const s = new DecisionEngineSettings({ min_confidence: 'high' });
        expect(() => {
            // @ts-expect-error frozen
            s.min_confidence = 'low';
        }).toThrow();
    });
});

const PARSE_CASES: unknown[] = [
    null,
    {},
    { surface_traces: true },
    { surface_traces: 'yes' },
    { min_confidence: 'HIGH', block_on_risk: 'low' },
    { min_confidence: false },
    { min_confidence: true }, // error
    { bogus: 1 }, // error
    { on_block: 'warn', on_block_fallback: 'warn', ask_timeout_seconds: 5 },
    { on_block: 'bananas' }, // error
    { ask_timeout_seconds: -3 }, // error
    { ask_timeout_seconds: true }, // error
    { require_memory_hits: 'off' },
    { min_confidence: 42 }, // error: expected string
    'not-a-mapping', // error
];

const EVAL_CASES: Array<{
    settings: Record<string, unknown>;
    phase: string;
    cb: string | null;
    rc: string | null;
    mh: number;
    interactive: boolean;
}> = [
    { settings: {}, phase: 'plan', cb: 'low', rc: 'high', mh: 0, interactive: true },
    { settings: { min_confidence: 'high' }, phase: 'plan', cb: 'medium', rc: null, mh: 0, interactive: true },
    { settings: { min_confidence: 'high' }, phase: 'plan', cb: 'high', rc: null, mh: 0, interactive: true },
    { settings: { min_confidence: 'medium' }, phase: 'plan', cb: null, rc: null, mh: 0, interactive: false },
    { settings: { block_on_risk: 'medium' }, phase: 'implement', cb: null, rc: 'high', mh: 0, interactive: true },
    { settings: { block_on_risk: 'high' }, phase: 'implement', cb: null, rc: 'medium', mh: 0, interactive: true },
    { settings: { require_memory_hits: true }, phase: 'refine', cb: null, rc: null, mh: 0, interactive: true },
    { settings: { require_memory_hits: true }, phase: 'refine', cb: null, rc: null, mh: 2, interactive: true },
    {
        settings: { min_confidence: 'high', on_block: 'ask' },
        phase: 'plan',
        cb: 'low',
        rc: null,
        mh: 0,
        interactive: false,
    },
    {
        settings: { min_confidence: 'high', on_block: 'warn' },
        phase: 'plan',
        cb: 'low',
        rc: null,
        mh: 0,
        interactive: true,
    },
];

describe.runIf(hasPython3())('scoring/decision_engine — python parity', () => {
    it.each(PARSE_CASES.map((c, i) => [i, c] as const))(
        'parse case #%i matches CPython (settings or error text)',
        (_i, data) => {
            const expected = pyParse(data) as Record<string, unknown>;
            let got: Record<string, unknown>;
            try {
                got = settingsToDict(parse(data));
            } catch (e) {
                got = { error: (e as Error).message };
            }
            expect(got).toEqual(expected);
        },
    );

    it.each(EVAL_CASES.map((c, i) => [i, c] as const))(
        'evaluate_gates case #%i matches CPython',
        (_i, c) => {
            const expected = pyEvaluate(c.settings, c.phase, c.cb, c.rc, c.mh, c.interactive);
            const got = gateToDict(
                evaluate_gates(parse(c.settings), {
                    phase: c.phase,
                    confidence_band: c.cb,
                    risk_class: c.rc,
                    memory_hits: c.mh,
                    is_interactive: () => c.interactive,
                }),
            );
            expect(got).toEqual(expected);
        },
    );
});
