// Golden-parity rig for the py2ts `directives/ui/polish` twin (ADR-094).
//
// Loader pattern (see directives_ui_trivial__skipped.test.ts). Asserts the
// `{outcome, questions, message}` projection across: review-clean / no-findings
// success, the delegate-with-round-count path (incl. matched-token auto-convert
// line), the token-extraction halt (insertion-ordered repeats, `isalnum`-based
// suggested-name slug, `×` count), the subjective ceiling halt, the a11y
// ceiling halt (extension-available vs spent, truncated to 5 + "... and N
// more"), and the extension-aware effective ceiling.
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { DeliveryState } from '../../../src/agent-src/templates/scripts/work_engine/delivery_state.js';
import {
    A11Y_VIOLATION_KIND,
    AMBIGUITIES,
    POLISH_CEILING,
    TOKEN_REPEAT_THRESHOLD,
    TOKEN_VIOLATION_KIND,
    run,
} from '../../../src/agent-src/templates/scripts/work_engine/directives/ui/polish.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const WE = path.join(REPO_ROOT, 'src', 'agent-src', 'templates', 'scripts', 'work_engine');
const DS_PY = path.join(WE, 'delivery_state.py');
const MOD_PY = path.join(WE, 'directives', 'ui', 'polish.py');

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

const tokenFinding = (value: string) => ({ kind: 'token_violation', category: 'colors', value });
const a11yFinding = (rule: string) => ({ kind: 'a11y_violation', rule, selector: `.${rule}`, severity: 'serious' });

describePy('directives/ui/polish — golden parity (python3 vs tsx)', () => {
    const fixtures: Array<[string, Record<string, unknown>]> = [
        ['review_clean true → success', { ticket: {}, ui_review: { review_clean: true, findings: [{ x: 1 }] } }],
        ['no findings → success', { ticket: {}, ui_review: { review_clean: false, findings: [] } }],
        ['unclean, round 0 → delegate (round 1 of 2)', {
            ticket: {},
            ui_review: { review_clean: false, findings: [{ a: 1 }, { b: 2 }] },
        }],
        ['delegate with matched-token auto-convert line', {
            ticket: {},
            ui_review: { review_clean: false, findings: [tokenFinding('#fff')] },
            ui_audit: { design_tokens: { colors: { white: '#fff' } } },
            ui_polish: { rounds: 0 },
        }],
        ['token extraction halt (unmatched repeats >2, slug + ×)', {
            ticket: {},
            ui_review: {
                review_clean: false,
                findings: [tokenFinding('#abc123'), tokenFinding('#abc123'), tokenFinding('#abc123')],
            },
            ui_audit: { design_tokens: {} },
            ui_polish: { rounds: 0 },
        }],
        ['token repeats exactly threshold (2) → no extraction, delegate', {
            ticket: {},
            ui_review: {
                review_clean: false,
                findings: [tokenFinding('#abc123'), tokenFinding('#abc123')],
            },
            ui_audit: { design_tokens: {} },
            ui_polish: { rounds: 0 },
        }],
        ['subjective ceiling reached (rounds 2) → ceiling halt', {
            ticket: {},
            ui_review: { review_clean: false, findings: [{ note: 'spacing off' }] },
            ui_polish: { rounds: 2 },
        }],
        ['a11y ceiling, extension available → a11y halt with extend option', {
            ticket: {},
            ui_review: { review_clean: false, findings: [a11yFinding('color-contrast'), a11yFinding('label')] },
            ui_polish: { rounds: 2 },
        }],
        ['a11y ceiling, extension spent → accept/abort only', {
            ticket: {},
            ui_review: { review_clean: false, findings: [a11yFinding('color-contrast')] },
            ui_polish: { rounds: 3, extension_used: true },
        }],
        ['a11y ceiling, >5 findings → truncation "... and N more"', {
            ticket: {},
            ui_review: {
                review_clean: false,
                findings: [
                    a11yFinding('r1'), a11yFinding('r2'), a11yFinding('r3'),
                    a11yFinding('r4'), a11yFinding('r5'), a11yFinding('r6'), a11yFinding('r7'),
                ],
            },
            ui_polish: { rounds: 2 },
        }],
        ['extension lifts ceiling to 3 → still delegates at round 2', {
            ticket: {},
            ui_review: { review_clean: false, findings: [{ note: 'x' }] },
            ui_polish: { rounds: 2, extension_used: true },
        }],
        ['suggested-name slug from non-alnum value', {
            ticket: {},
            ui_review: {
                review_clean: false,
                findings: [
                    { kind: 'token_violation', category: 'spacing', value: '12px !important' },
                    { kind: 'token_violation', category: 'spacing', value: '12px !important' },
                    { kind: 'token_violation', category: 'spacing', value: '12px !important' },
                ],
            },
            ui_audit: { design_tokens: {} },
            ui_polish: { rounds: 0 },
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

describe('directives/ui/polish — TS-side unit checks', () => {
    it('constants + ambiguities', () => {
        expect(POLISH_CEILING).toBe(2);
        expect(TOKEN_REPEAT_THRESHOLD).toBe(2);
        expect(A11Y_VIOLATION_KIND).toBe('a11y_violation');
        expect(TOKEN_VIOLATION_KIND).toBe('token_violation');
        expect(AMBIGUITIES).toHaveLength(4);
    });
});
