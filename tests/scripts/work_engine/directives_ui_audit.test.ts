// Golden-parity rig for the py2ts `directives/ui/audit` twin (ADR-094).
//
// Loader pattern (see directives_ui_trivial__skipped.test.ts). `audit.run`
// mutates `state.ui_audit` (writes `audit_path`), so the projection includes
// the StepResult AND the mutated `state.ui_audit`. Covers: first-pass delegate,
// greenfield-undecided halt, greenfield-decided success (records
// `audit_path = "greenfield"`), shadcn version-mismatch soft halt (`int()` of
// the parsed major), idempotent re-entry on a recorded path, high-confidence
// success (`STRONG_SIMILARITY` + `TIE_GAP` + `float()` coercion), and the
// ambiguous candidate-pick halt with the `.2f` similarity rendering
// (round-half-to-even, e.g. 0.125 → 0.12).
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { DeliveryState } from '../../../src/agent-src/templates/scripts/work_engine/delivery_state.js';
import {
    AMBIGUITIES,
    STRONG_SIMILARITY,
    TESTED_AGAINST_SHADCN_MAJOR,
    TIE_GAP,
    run,
} from '../../../src/agent-src/templates/scripts/work_engine/directives/ui/audit.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const WE = path.join(REPO_ROOT, 'src', 'agent-src', 'templates', 'scripts', 'work_engine');
const DS_PY = path.join(WE, 'delivery_state.py');
const MOD_PY = path.join(WE, 'directives', 'ui', 'audit.py');

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

function runPy(body: string, args: string[] = []): SpawnSyncReturns<string> {
    const loader = [
        'import sys, json, importlib.util',
        `_dspec = importlib.util.spec_from_file_location("delivery_state", ${JSON.stringify(DS_PY)})`,
        'delivery_state = importlib.util.module_from_spec(_dspec)',
        'sys.modules["delivery_state"] = delivery_state',
        '_dspec.loader.exec_module(delivery_state)',
        `_src = open(${JSON.stringify(MOD_PY)}, encoding="utf-8").read()`,
        '_src = _src.replace("from ...delivery_state import", "from delivery_state import")',
        'mod = type(sys)("mod")',
        'exec(compile(_src, "mod", "exec"), mod.__dict__)',
    ].join('\n');
    return spawnSync('python3', ['-c', `${loader}\n${body}`, ...args], { encoding: 'utf8' });
}

function pyRun(payloadJson: string): string {
    const body = [
        'payload = json.loads(sys.argv[1])',
        'st = delivery_state.DeliveryState(**payload)',
        'r = mod.run(st)',
        'out = {"outcome": r.outcome.value, "questions": r.questions, "message": r.message, "ui_audit": st.ui_audit}',
        'sys.stdout.write(json.dumps(out, ensure_ascii=False))',
    ].join('\n');
    const r = runPy(body, [payloadJson]);
    if (r.status !== 0) throw new Error(`py run failed: ${r.stderr || r.stdout}`);
    return r.stdout;
}

function tsRun(payload: Record<string, unknown>): string {
    const st = new DeliveryState(payload as never);
    const r = run(st);
    return JSON.stringify({
        outcome: r.outcome,
        questions: r.questions,
        message: r.message,
        ui_audit: st.ui_audit,
    });
}

const PY = hasPython3();
const describePy = PY ? describe : describe.skip;

describePy('directives/ui/audit — golden parity (python3 vs tsx)', () => {
    const fixtures: Array<[string, Record<string, unknown>]> = [
        ['no audit → delegate', { ticket: { title: 'New screen' } }],
        ['empty dict audit → delegate', { ticket: {}, ui_audit: {} }],
        ['greenfield, no decision → halt', { ticket: {}, ui_audit: { greenfield: true } }],
        ['greenfield, decided → success records audit_path', {
            ticket: {},
            ui_audit: { greenfield: true, greenfield_decision: 'scaffold' },
        }],
        ['greenfield, decided, audit_path already set → unchanged success', {
            ticket: {},
            ui_audit: { greenfield: true, greenfield_decision: 'bare', audit_path: 'greenfield' },
        }],
        ['shadcn major mismatch → soft halt', {
            ticket: {},
            ui_audit: { components_found: [{ name: 'A', similarity: 0.9 }], shadcn_inventory: { version: 'v3.1.0' } },
            // confidence medium by default → would be ambiguous, but mismatch halts first
        }],
        ['shadcn major matches → no halt (then ambiguous path)', {
            ticket: { confidence: { band: 'medium' } },
            ui_audit: { components_found: [{ name: 'A', similarity: 0.9 }], shadcn_inventory: { version: '2.4.0' } },
        }],
        ['shadcn version unparseable → skipped', {
            ticket: { confidence: { band: 'high' } },
            ui_audit: { components_found: [{ name: 'A', similarity: 0.95 }], shadcn_inventory: { version: 'latest' } },
        }],
        ['idempotent: audit_path high_confidence → success', {
            ticket: {},
            ui_audit: { components_found: [{ name: 'A' }], audit_path: 'high_confidence' },
        }],
        ['high confidence (band high, strong, no tie) → success', {
            ticket: { confidence: { band: 'high' } },
            ui_audit: { components_found: [{ name: 'A', similarity: 0.9 }, { name: 'B', similarity: 0.4 }] },
        }],
        ['high band but tie within TIE_GAP → ambiguous', {
            ticket: { confidence: { band: 'high' } },
            ui_audit: { components_found: [{ name: 'A', similarity: 0.9 }, { name: 'B', similarity: 0.88 }] },
        }],
        ['high band but below STRONG_SIMILARITY → ambiguous', {
            ticket: { confidence: { band: 'high' } },
            ui_audit: { components_found: [{ name: 'A', similarity: 0.5 }] },
        }],
        ['medium band → ambiguous (.2f banker rounding 0.125→0.12)', {
            ticket: { confidence: { band: 'medium' } },
            ui_audit: { components_found: [{ name: 'A', similarity: 0.125 }, { name: 'B', similarity: 0.7449 }] },
        }],
        ['ambiguous with path fallback + similarity as string', {
            ticket: { confidence: { band: 'medium' } },
            ui_audit: { components_found: [{ path: 'src/X.tsx', similarity: '0.62' }, { name: 'Y' }] },
        }],
        ['diff input_kind → high band default', {
            ticket: { input_kind: 'diff' },
            ui_audit: { components_found: [{ name: 'A', similarity: 0.85 }] },
        }],
        ['ambiguous, no matches at all → build-new recommendation', {
            ticket: { confidence: { band: 'medium' } },
            ui_audit: { components_found: [], greenfield: false },
        }],
    ];
    for (const [label, payload] of fixtures) {
        it(`byte-identical StepResult + ui_audit — ${label}`, () => {
            const json = JSON.stringify(payload);
            const py = pyRun(json);
            const ts = tsRun(JSON.parse(json) as Record<string, unknown>);
            expect(JSON.parse(ts)).toEqual(JSON.parse(py));
        });
    }
});

describe('directives/ui/audit — TS-side unit checks', () => {
    it('constants + ambiguities', () => {
        expect(STRONG_SIMILARITY).toBe(0.7);
        expect(TIE_GAP).toBe(0.05);
        expect(TESTED_AGAINST_SHADCN_MAJOR).toBe(2);
        expect(AMBIGUITIES).toHaveLength(4);
    });
});
