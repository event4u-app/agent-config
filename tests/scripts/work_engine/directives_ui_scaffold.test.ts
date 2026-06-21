// Golden-parity rig for the py2ts `directives/ui/scaffold` twin (ADR-200).
//
// Loader pattern (see directives_ui_design.test.ts). Asserts the
// `{outcome, questions, message}` projection across the non-greenfield no-op,
// the plan-stage delegate (token-seed line: brand-source-present vs default,
// driven off the process cwd — exercised deterministically in a tmpdir), the
// build-stage delegate (stack-directive resolution + page/route counts), and
// the fully-scaffolded success. The cwd is pinned per-fixture so the python3
// subprocess and the in-process tsx run see the same filesystem for the
// `tokens.json` brand-source probe.
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { DeliveryState } from '../../../src/agent-src/templates/scripts/work_engine/delivery_state.js';
import {
    AMBIGUITIES,
    BRAND_TOKEN_PATHS,
    DEFAULT_DIRECTIVE,
    PLAN_DIRECTIVE,
    STACK_DIRECTIVES,
    run,
} from '../../../src/agent-src/templates/scripts/work_engine/directives/ui/scaffold.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const WE = path.join(REPO_ROOT, 'src', 'agent-src', 'templates', 'scripts', 'work_engine');
const DS_PY = path.join(WE, 'delivery_state.py');
const MOD_PY = path.join(WE, 'directives', 'ui', 'scaffold.py');

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

function runPy(body: string, args: string[], cwd: string): SpawnSyncReturns<string> {
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
    return spawnSync('python3', ['-c', `${loader}\n${body}`, ...args], { encoding: 'utf8', cwd });
}

function pyRun(payloadJson: string, cwd: string): string {
    const body = [
        'payload = json.loads(sys.argv[1])',
        'st = delivery_state.DeliveryState(**payload)',
        'r = mod.run(st)',
        'out = {"outcome": r.outcome.value, "questions": r.questions, "message": r.message}',
        'sys.stdout.write(json.dumps(out, ensure_ascii=False))',
    ].join('\n');
    const r = runPy(body, [payloadJson], cwd);
    if (r.status !== 0) throw new Error(`py run failed: ${r.stderr || r.stdout}`);
    return r.stdout;
}

function tsRun(payload: Record<string, unknown>, cwd: string): string {
    const prev = process.cwd();
    process.chdir(cwd);
    try {
        const st = new DeliveryState(payload as never);
        const r = run(st);
        return JSON.stringify({ outcome: r.outcome, questions: r.questions, message: r.message });
    } finally {
        process.chdir(prev);
    }
}

const PY = hasPython3();
const describePy = PY ? describe : describe.skip;

const GF = { greenfield: true, greenfield_decision: 'scaffold' };

// Two pinned cwds: one with no tokens.json (default token-seed line), one with
// a tokens.json present (brand-source token-seed line).
let dirNoTokens: string;
let dirWithTokens: string;

beforeAll(() => {
    dirNoTokens = fs.mkdtempSync(path.join(os.tmpdir(), 'scaffold-notok-'));
    dirWithTokens = fs.mkdtempSync(path.join(os.tmpdir(), 'scaffold-tok-'));
    fs.writeFileSync(path.join(dirWithTokens, 'tokens.json'), '{}', 'utf8');
});

afterAll(() => {
    fs.rmSync(dirNoTokens, { recursive: true, force: true });
    fs.rmSync(dirWithTokens, { recursive: true, force: true });
});

describePy('directives/ui/scaffold — golden parity (python3 vs tsx)', () => {
    // Fixtures whose output does not depend on cwd run in dirNoTokens.
    const plainFixtures: Array<[string, Record<string, unknown>]> = [
        // Non-greenfield-scaffold flows → SUCCESS no-op.
        ['no ui_audit → SUCCESS', { ticket: { title: 'x' } }],
        ['ui_audit not greenfield → SUCCESS', { ticket: {}, ui_audit: { components_found: [] } }],
        ['greenfield decision=external_reference → SUCCESS', {
            ticket: {},
            ui_audit: { greenfield: true, greenfield_decision: 'external_reference' },
        }],
        // Build stage — stack resolution + counts.
        ['build, no stack → ui-scaffold-plain', {
            ticket: {},
            ui_audit: GF,
            ui_scaffold: { routes: ['/'], pages: ['Home'] },
        }],
        ['build, react-shadcn stack', {
            ticket: {},
            ui_audit: GF,
            stack: { frontend: 'react-shadcn' },
            ui_scaffold: { routes: ['/', '/about'], pages: ['Home', 'About'], layout_strategy: 'sidebar' },
        }],
        ['build, blade-livewire-flux stack', {
            ticket: {},
            ui_audit: GF,
            stack: { frontend: 'blade-livewire-flux' },
            ui_scaffold: { component_manifest: ['Card'], pages: ['P'], routes: [] },
        }],
        ['build, unknown stack → fallback plain', {
            ticket: {},
            ui_audit: GF,
            stack: { frontend: 'svelte' },
            ui_scaffold: { layout_strategy: 'stack' },
        }],
        ['build, stack not a dict → plain', {
            ticket: {},
            ui_audit: GF,
            stack: 'react-shadcn',
            ui_scaffold: { routes: [] },
        }],
        ['build, pages/routes non-list → 0 counts', {
            ticket: {},
            ui_audit: GF,
            ui_scaffold: { routes: 'home', pages: 'home', layout_strategy: 'x' },
        }],
        ['build, scaffolded=false (not True)', {
            ticket: {},
            ui_audit: GF,
            ui_scaffold: { routes: ['/'], scaffolded: false },
        }],
        ['build, scaffolded truthy non-True (1)', {
            ticket: {},
            ui_audit: GF,
            ui_scaffold: { routes: ['/'], scaffolded: 1 },
        }],
        // Fully scaffolded → SUCCESS.
        ['scaffolded=true → SUCCESS', {
            ticket: {},
            ui_audit: GF,
            ui_scaffold: { routes: ['/'], scaffolded: true },
        }],
        // pages-only is NOT planned → plan delegate (default token-seed).
        ['pages-only scaffold → plan delegate', {
            ticket: { title: 'App' },
            ui_audit: GF,
            ui_scaffold: { pages: ['Home'] },
        }],
        ['empty dict scaffold → plan delegate', { ticket: {}, ui_audit: GF, ui_scaffold: {} }],
    ];

    for (const [label, payload] of plainFixtures) {
        it(`byte-identical StepResult — ${label}`, () => {
            const json = JSON.stringify(payload);
            const py = pyRun(json, dirNoTokens);
            const ts = tsRun(JSON.parse(json) as Record<string, unknown>, dirNoTokens);
            expect(JSON.parse(ts)).toEqual(JSON.parse(py));
        });
    }

    // Plan-stage fixtures, run in BOTH cwds to exercise the two token-seed lines.
    const planFixtures: Array<[string, Record<string, unknown>]> = [
        ['plan delegate, raw preview', { ticket: { raw: '  build  a   shop ' }, ui_audit: GF }],
        ['plan delegate, no app_spec/scaffold', { ticket: { title: 'Store' }, ui_audit: GF }],
        ['plan delegate, no title → (no title)', { ticket: {}, ui_audit: GF }],
    ];
    for (const [label, payload] of planFixtures) {
        for (const [cwdLabel, cwd] of [['no tokens.json', () => dirNoTokens], ['tokens.json present', () => dirWithTokens]] as const) {
            it(`byte-identical StepResult — ${label} (${cwdLabel})`, () => {
                const json = JSON.stringify(payload);
                const py = pyRun(json, cwd());
                const ts = tsRun(JSON.parse(json) as Record<string, unknown>, cwd());
                expect(JSON.parse(ts)).toEqual(JSON.parse(py));
            });
        }
    }
});

describe('directives/ui/scaffold — TS-side unit checks', () => {
    it('constants + ambiguities', () => {
        expect(PLAN_DIRECTIVE).toBe('ui-scaffold-plan');
        expect(DEFAULT_DIRECTIVE).toBe('ui-scaffold-plain');
        expect(STACK_DIRECTIVES).toEqual({
            'blade-livewire-flux': 'ui-scaffold-blade-livewire-flux',
            'react-shadcn': 'ui-scaffold-react-shadcn',
            vue: 'ui-scaffold-vue',
            plain: 'ui-scaffold-plain',
        });
        expect([...BRAND_TOKEN_PATHS]).toEqual([
            'tokens.json',
            'assets/tokens.json',
            'resources/tokens.json',
            'agents/settings/brand/tokens.json',
        ]);
        expect(AMBIGUITIES).toHaveLength(2);
        expect(AMBIGUITIES.map((a) => a.code)).toEqual([
            'scaffold_plan_missing',
            'scaffold_build_pending',
        ]);
    });
});
