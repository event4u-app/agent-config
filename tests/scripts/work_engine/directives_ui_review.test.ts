// Golden-parity rig for the py2ts `directives/ui/review` twin (ADR-094).
//
// Loader pattern (see directives_ui_trivial__skipped.test.ts). `review.run` can
// mutate `state.ui_review` (synthesises a11y findings, forces
// `review_clean = False`), so the projection includes the StepResult AND the
// mutated `state.ui_review`. Covers: first-pass delegate, findings-missing /
// review_clean-missing shape halts, the a11y gate (baseline / accepted /
// severity-floor filtering, dedup, synthesis + review_clean flip), the
// a11y-pending halt, and the preview-render gate (skip / failed / ok).
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { DeliveryState } from '../../../src/agent-src/templates/scripts/work_engine/delivery_state.js';
import {
    AMBIGUITIES,
    DEFAULT_SEVERITY_FLOOR,
    SEVERITY_ORDER,
    run,
} from '../../../src/agent-src/templates/scripts/work_engine/directives/ui/review.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const WE = path.join(REPO_ROOT, 'src', 'agent-src', 'templates', 'scripts', 'work_engine');
const DS_PY = path.join(WE, 'delivery_state.py');
const MOD_PY = path.join(WE, 'directives', 'ui', 'review.py');

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
        'out = {"outcome": r.outcome.value, "questions": r.questions, "message": r.message, "ui_review": st.ui_review}',
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
        ui_review: st.ui_review,
    });
}

const PY = hasPython3();
const describePy = PY ? describe : describe.skip;

describePy('directives/ui/review — golden parity (python3 vs tsx)', () => {
    const fixtures: Array<[string, Record<string, unknown>]> = [
        ['no review → delegate', { ticket: {} }],
        ['empty dict review → delegate', { ticket: {}, ui_review: {} }],
        ['findings missing → shape halt', { ticket: {}, ui_review: { review_clean: true } }],
        ['findings not a list → shape halt', { ticket: {}, ui_review: { findings: 'nope', review_clean: true } }],
        ['review_clean missing → shape halt (findings count)', {
            ticket: {},
            ui_review: { findings: [{ a: 1 }, { b: 2 }] },
        }],
        ['review_clean not a bool → shape halt', {
            ticket: {},
            ui_review: { findings: [], review_clean: 'yes' },
        }],
        ['well-formed, no a11y / no preview → success', {
            ticket: {},
            ui_review: { findings: [], review_clean: true },
        }],
        ['audit baseline declared but review.a11y missing → pending halt', {
            ticket: {},
            ui_audit: { a11y_baseline: [] },
            ui_review: { findings: [], review_clean: true },
        }],
        ['a11y violations above floor → synthesise + flip review_clean', {
            ticket: {},
            ui_audit: { a11y_baseline: [] },
            ui_review: {
                findings: [],
                review_clean: true,
                a11y: { violations: [{ rule: 'color-contrast', selector: '.btn', severity: 'serious' }] },
            },
        }],
        ['a11y violation below floor → no actionable, success', {
            ticket: {},
            ui_audit: { a11y_baseline: [] },
            ui_review: {
                findings: [],
                review_clean: true,
                a11y: { violations: [{ rule: 'minor-thing', selector: '.x', severity: 'minor' }] },
            },
        }],
        ['a11y violation in baseline → filtered out, success', {
            ticket: {},
            ui_audit: { a11y_baseline: [{ rule: 'color-contrast', selector: '.btn' }] },
            ui_review: {
                findings: [],
                review_clean: true,
                a11y: { violations: [{ rule: 'color-contrast', selector: '.btn', severity: 'critical' }] },
            },
        }],
        ['a11y violation in accepted → filtered out, success', {
            ticket: {},
            ui_audit: { a11y_baseline: [] },
            ui_review: {
                findings: [],
                review_clean: true,
                a11y: {
                    violations: [{ rule: 'r', selector: '.s', severity: 'serious' }],
                    accepted_violations: [{ rule: 'r', selector: '.s' }],
                },
            },
        }],
        ['a11y synthesis dedup (existing finding) → no duplicate', {
            ticket: {},
            ui_audit: { a11y_baseline: [] },
            ui_review: {
                findings: [{ kind: 'a11y_violation', rule: 'r', selector: '.s', severity: 'serious' }],
                review_clean: false,
                a11y: { violations: [{ rule: 'r', selector: '.s', severity: 'serious' }] },
            },
        }],
        ['custom severity_floor critical → serious filtered out', {
            ticket: {},
            ui_audit: { a11y_baseline: [] },
            ui_review: {
                findings: [],
                review_clean: true,
                a11y: {
                    violations: [{ rule: 'r', selector: '.s', severity: 'serious' }],
                    severity_floor: 'critical',
                },
            },
        }],
        ['preview render_ok false → preview-failed halt (error line)', {
            ticket: {},
            ui_review: { findings: [], review_clean: true, preview: { render_ok: false, error: 'timeout' } },
        }],
        ['preview render_ok false, no error → "(none reported)"', {
            ticket: {},
            ui_review: { findings: [], review_clean: true, preview: { render_ok: false } },
        }],
        ['preview skipped → success', {
            ticket: {},
            ui_review: { findings: [], review_clean: true, preview: { skipped: true, render_ok: false } },
        }],
        ['preview render_ok true → success', {
            ticket: {},
            ui_review: { findings: [], review_clean: true, preview: { render_ok: true, screenshot_path: 'x.png' } },
        }],
    ];
    for (const [label, payload] of fixtures) {
        it(`byte-identical StepResult + ui_review — ${label}`, () => {
            const json = JSON.stringify(payload);
            const py = pyRun(json);
            const ts = tsRun(JSON.parse(json) as Record<string, unknown>);
            expect(JSON.parse(ts)).toEqual(JSON.parse(py));
        });
    }
});

describe('directives/ui/review — TS-side unit checks', () => {
    it('constants + ambiguities', () => {
        expect(DEFAULT_SEVERITY_FLOOR).toBe('moderate');
        expect(SEVERITY_ORDER).toEqual({ minor: 0, moderate: 1, serious: 2, critical: 3 });
        expect(AMBIGUITIES).toHaveLength(6);
    });
});
