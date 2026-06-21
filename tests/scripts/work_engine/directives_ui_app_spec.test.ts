// Golden-parity rig for the py2ts `directives/ui/app_spec` twin (ADR-200).
//
// Loader pattern (see directives_ui_design.test.ts). Asserts the
// `{outcome, questions, message}` projection across the non-greenfield no-op,
// the explicit bypass, the first-pass delegate (with raw/title/id preview +
// the >80-codepoint truncation), the unconfirmed confirm/edit/bypass halt
// (page/entity summarize: str items, dict name/title/path fallback, unnamed,
// the ", …" overflow suffix), and the confirmed success.
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { DeliveryState } from '../../../src/agent-src/templates/scripts/work_engine/delivery_state.js';
import {
    AMBIGUITIES,
    run,
} from '../../../src/agent-src/templates/scripts/work_engine/directives/ui/app_spec.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const WE = path.join(REPO_ROOT, 'src', 'agent-src', 'templates', 'scripts', 'work_engine');
const DS_PY = path.join(WE, 'delivery_state.py');
const MOD_PY = path.join(WE, 'directives', 'ui', 'app_spec.py');

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
        'out = {"outcome": r.outcome.value, "questions": r.questions, "message": r.message}',
        'sys.stdout.write(json.dumps(out, ensure_ascii=False))',
    ].join('\n');
    const r = runPy(body, [payloadJson]);
    if (r.status !== 0) throw new Error(`py run failed: ${r.stderr || r.stdout}`);
    return r.stdout;
}

function tsRun(payload: Record<string, unknown>): string {
    const st = new DeliveryState(payload as never);
    const r = run(st);
    return JSON.stringify({ outcome: r.outcome, questions: r.questions, message: r.message });
}

const PY = hasPython3();
const describePy = PY ? describe : describe.skip;

const GF = { greenfield: true, greenfield_decision: 'scaffold' };
const longTitle = 'word '.repeat(40).trim(); // 199 chars, > 80 codepoints

describePy('directives/ui/app_spec — golden parity (python3 vs tsx)', () => {
    const fixtures: Array<[string, Record<string, unknown>]> = [
        // Non-greenfield-scaffold flows → SUCCESS no-op (byte-identical).
        ['no ui_audit → SUCCESS', { ticket: { title: 'x' } }],
        ['ui_audit not greenfield → SUCCESS', { ticket: {}, ui_audit: { components_found: [] } }],
        ['greenfield but decision=bare → SUCCESS', {
            ticket: {},
            ui_audit: { greenfield: true, greenfield_decision: 'bare' },
        }],
        ['greenfield true but decision missing → SUCCESS', {
            ticket: {},
            ui_audit: { greenfield: true },
        }],
        // Bypass — honoured before populated-check.
        ['bypassed spec → SUCCESS', {
            ticket: {},
            ui_audit: GF,
            app_spec: { bypassed: true },
        }],
        ['bypassed truthy (non-bool) → SUCCESS', {
            ticket: {},
            ui_audit: GF,
            app_spec: { bypassed: 'yes', pages: [] },
        }],
        // First-pass delegate.
        ['no app_spec → delegate', { ticket: { title: 'Build a CRM' }, ui_audit: GF }],
        ['empty dict app_spec → delegate', { ticket: {}, ui_audit: GF, app_spec: {} }],
        ['app_spec pages not a list → delegate', {
            ticket: { id: 'TCK-9' },
            ui_audit: GF,
            app_spec: { pages: 'home' },
        }],
        ['delegate with raw preview (whitespace collapse)', {
            ticket: { raw: '  build   a\tmulti-page   app  ' },
            ui_audit: GF,
        }],
        ['delegate with long preview (>80 codepoints, truncated)', {
            ticket: { raw: longTitle },
            ui_audit: GF,
        }],
        ['delegate with no title → (no title)', { ticket: {}, ui_audit: GF }],
        // Unconfirmed halt — summarize variants.
        ['unconfirmed, string pages + entities', {
            ticket: { raw: 'the dashboard' },
            ui_audit: GF,
            app_spec: { pages: ['Home', 'Settings'], entity_model: ['User', 'Account'] },
        }],
        ['unconfirmed, dict pages name/title/path fallback + unnamed', {
            ticket: {},
            ui_audit: GF,
            app_spec: {
                pages: [{ name: 'Home' }, { title: 'About' }, { path: '/contact' }, {}],
                entity_model: [],
            },
        }],
        ['unconfirmed, >3 pages → overflow suffix', {
            ticket: {},
            ui_audit: GF,
            app_spec: { pages: ['A', 'B', 'C', 'D'], entity_model: ['E1'] },
        }],
        ['unconfirmed, mixed non-str/dict items filtered out', {
            ticket: {},
            ui_audit: GF,
            app_spec: { pages: ['Keep', 5, ['nested'], { name: 'Card' }], entity_model: [null, 'Real'] },
        }],
        ['unconfirmed, empty pages + entities → (none)', {
            ticket: {},
            ui_audit: GF,
            app_spec: { pages: [], entity_model: [] },
        }],
        ['unconfirmed, confirmed=false (not True)', {
            ticket: {},
            ui_audit: GF,
            app_spec: { pages: ['Home'], confirmed: false },
        }],
        // Confirmed → SUCCESS.
        ['confirmed=true → SUCCESS', {
            ticket: {},
            ui_audit: GF,
            app_spec: { pages: ['Home'], confirmed: true },
        }],
        ['confirmed truthy but not True (1) → unconfirmed halt', {
            ticket: {},
            ui_audit: GF,
            app_spec: { pages: ['Home'], confirmed: 1 },
        }],
    ];
    for (const [label, payload] of fixtures) {
        it(`byte-identical StepResult — ${label}`, () => {
            const json = JSON.stringify(payload);
            const py = pyRun(json);
            const ts = tsRun(JSON.parse(json) as Record<string, unknown>);
            expect(JSON.parse(ts)).toEqual(JSON.parse(py));
        });
    }
});

describe('directives/ui/app_spec — TS-side unit checks', () => {
    it('ambiguities', () => {
        expect(AMBIGUITIES).toHaveLength(2);
        expect(AMBIGUITIES.map((a) => a.code)).toEqual(['app_spec_missing', 'app_spec_unconfirmed']);
    });
});
