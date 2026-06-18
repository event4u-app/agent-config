// Pure-TS gap coverage for the `directives/ui/review` twin — ported from the
// python spec `tests/work_engine/test_step_review.py`. No python3, no golden
// oracle: build a `DeliveryState`, call `review.run`, assert
// `{outcome, questions}` + state mutations directly against the twin.
//
// Focus per the py2ts gap brief: stack-dispatch (`ui-design-review-<stack>`),
// the `STACK_DIRECTIVES == KNOWN_STACKS` invariant, partial-envelope halts,
// success-path round-trips, plus the a11y + preview gates the existing golden
// rig exercises only via the python projection.
import { describe, expect, it } from 'vitest';

import {
    AGENT_DIRECTIVE_PREFIX,
    DeliveryState,
    Outcome,
} from '../../../src/agent-src/templates/scripts/work_engine/delivery_state.js';
import {
    AMBIGUITIES,
    STACK_DIRECTIVES,
    run,
} from '../../../src/agent-src/templates/scripts/work_engine/directives/ui/review.js';
import { KNOWN_STACKS } from '../../../src/agent-src/templates/scripts/work_engine/stack/detect.js';

type Json = Record<string, unknown>;

/** First surfaced question — non-empty on every BLOCKED path under test. */
function q0(questions: string[]): string {
    return questions[0] ?? '';
}

/**
 * Build a DeliveryState shaped like a UI-routed envelope post-apply.
 *
 * Mirrors the python `_ui_state`: a *well-formed* success envelope (findings +
 * review_clean, no own preview) injects `preview: {render_ok: true}` so the
 * preview gate does not fire for fixtures focused on a different property.
 * Halt-path fixtures (empty dict, missing findings/clean, non-dict, explicit
 * preview) are left untouched.
 */
function uiState(opts: { stack?: string | null; ui_review?: unknown } = {}): DeliveryState {
    const stack = opts.stack === undefined ? 'blade-livewire-flux' : opts.stack;
    const state = new DeliveryState({
        ticket: {
            id: 'UI-3',
            title: 'Render dark mode toggle',
            raw: 'Render dark mode toggle',
        },
    });
    let review = opts.ui_review;
    if (review !== undefined && review !== null) {
        if (
            typeof review === 'object' &&
            !Array.isArray(review) &&
            'findings' in (review as Json) &&
            'review_clean' in (review as Json) &&
            !('preview' in (review as Json))
        ) {
            review = { ...(review as Json), preview: { render_ok: true } };
        }
        state.ui_review = review as Json;
    }
    if (stack != null) state.stack = { frontend: stack, mtime: 0.0 };
    return state;
}

function uiStateWithAudit(opts: { audit: Json | null; ui_review: Json }): DeliveryState {
    const state = uiState({ ui_review: opts.ui_review });
    if (opts.audit != null) state.ui_audit = opts.audit;
    return state;
}

// --- first-pass directive halt ----------------------------------------------

describe('review — first-pass directive halt', () => {
    it('emits a directive when ui_review is missing', () => {
        const result = run(uiState({ ui_review: null }));
        expect(result.outcome).toBe(Outcome.BLOCKED);
        expect(q0(result.questions).startsWith(AGENT_DIRECTIVE_PREFIX)).toBe(true);
        expect(q0(result.questions)).toContain('ui-design-review-blade-livewire-flux');
    });

    it('emits a directive when ui_review is an empty dict', () => {
        const result = run(uiState({ ui_review: {} }));
        expect(result.outcome).toBe(Outcome.BLOCKED);
        expect(q0(result.questions).startsWith(AGENT_DIRECTIVE_PREFIX)).toBe(true);
    });

    it('emits a directive when ui_review is non-dict', () => {
        const result = run(uiState({ ui_review: ['nope'] }));
        expect(result.outcome).toBe(Outcome.BLOCKED);
        expect(q0(result.questions).startsWith(AGENT_DIRECTIVE_PREFIX)).toBe(true);
    });
});

// --- stack dispatch ---------------------------------------------------------

describe('review — stack dispatch', () => {
    it('dispatches to react-shadcn and names it in the body', () => {
        const result = run(uiState({ stack: 'react-shadcn', ui_review: null }));
        expect(q0(result.questions)).toContain('ui-design-review-react-shadcn');
        expect(result.questions.join('\n')).toContain('`react-shadcn`');
    });

    it('dispatches to vue', () => {
        const result = run(uiState({ stack: 'vue', ui_review: null }));
        expect(q0(result.questions)).toContain('ui-design-review-vue');
    });

    it('falls back to plain when the stack is missing', () => {
        const result = run(uiState({ stack: null, ui_review: null }));
        expect(q0(result.questions)).toContain('ui-design-review-plain');
    });

    it('falls back to plain when the stack is unknown', () => {
        const state = uiState({ stack: null, ui_review: null });
        state.stack = { frontend: 'svelte', mtime: 0.0 };
        const result = run(state);
        expect(q0(result.questions)).toContain('ui-design-review-plain');
    });

    it('STACK_DIRECTIVES keys match KNOWN_STACKS exactly', () => {
        expect(new Set(Object.keys(STACK_DIRECTIVES))).toEqual(new Set(KNOWN_STACKS));
    });
});

// --- partial envelope halts -------------------------------------------------

describe('review — partial envelope halts', () => {
    it('halts when the findings key is missing', () => {
        const result = run(uiState({ ui_review: { review_clean: true } }));
        expect(result.outcome).toBe(Outcome.BLOCKED);
        expect(result.questions.join('\n').toLowerCase()).toContain('findings');
    });

    it('halts when findings is not a list', () => {
        const result = run(
            uiState({ ui_review: { findings: 'all good', review_clean: true } }),
        );
        expect(result.outcome).toBe(Outcome.BLOCKED);
        expect(result.questions.join('\n').toLowerCase()).toContain('findings');
    });

    it('halts when review_clean is missing (findings count surfaced)', () => {
        const result = run(
            uiState({ ui_review: { findings: [{ path: 'x', issue: 'y' }] } }),
        );
        expect(result.outcome).toBe(Outcome.BLOCKED);
        const body = result.questions.join('\n');
        expect(body).toContain('review_clean');
        expect(body).toContain('1');
    });

    it('halts when review_clean is not a bool', () => {
        const result = run(uiState({ ui_review: { findings: [], review_clean: 'yes' } }));
        expect(result.outcome).toBe(Outcome.BLOCKED);
        expect(result.questions.join('\n')).toContain('review_clean');
    });
});

// --- success path -----------------------------------------------------------

describe('review — success path', () => {
    it('succeeds with a clean envelope', () => {
        const result = run(uiState({ ui_review: { findings: [], review_clean: true } }));
        expect(result.outcome).toBe(Outcome.SUCCESS);
    });

    it('succeeds with a dirty envelope (polish entry shape)', () => {
        const result = run(
            uiState({
                ui_review: {
                    findings: [{ path: 'label', issue: 'wrong copy' }],
                    review_clean: false,
                },
            }),
        );
        expect(result.outcome).toBe(Outcome.SUCCESS);
    });

    it('does not enforce clean matches findings count (ship-as-is replay)', () => {
        const result = run(
            uiState({
                ui_review: {
                    findings: [{ path: 'label', issue: 'wrong copy' }],
                    review_clean: true,
                },
            }),
        );
        expect(result.outcome).toBe(Outcome.SUCCESS);
    });
});

// --- R4 Phase 1: a11y gate --------------------------------------------------

describe('review — a11y gate', () => {
    it('passes when no baseline and no a11y envelope (pre-R4)', () => {
        const result = run(uiState({ ui_review: { findings: [], review_clean: true } }));
        expect(result.outcome).toBe(Outcome.SUCCESS);
    });

    it('halts pending when baseline declared but review skipped a11y', () => {
        const result = run(
            uiStateWithAudit({
                audit: { a11y_baseline: [] },
                ui_review: { findings: [], review_clean: true },
            }),
        );
        expect(result.outcome).toBe(Outcome.BLOCKED);
        const body = result.questions.join('\n').toLowerCase();
        expect(body).toContain('a11y');
        expect(body).toContain('baseline');
    });

    it('filters even without a baseline when an envelope is present', () => {
        const state = uiStateWithAudit({
            audit: null,
            ui_review: {
                findings: [],
                review_clean: true,
                a11y: {
                    violations: [{ rule: 'label', selector: 'input', severity: 'serious' }],
                },
            },
        });
        const result = run(state);
        expect(result.outcome).toBe(Outcome.SUCCESS);
        const review = state.ui_review as Json;
        expect(review['review_clean']).toBe(false);
        const findings = review['findings'] as Json[];
        expect(findings).toHaveLength(1);
        expect(findings[0]?.['kind']).toBe('a11y_violation');
        expect(findings[0]?.['rule']).toBe('label');
    });

    it('filters baseline (pre-existing) violations', () => {
        const state = uiStateWithAudit({
            audit: {
                a11y_baseline: [
                    { rule: 'color-contrast', selector: 'h1', severity: 'moderate' },
                ],
            },
            ui_review: {
                findings: [],
                review_clean: true,
                a11y: {
                    violations: [
                        { rule: 'color-contrast', selector: 'h1', severity: 'moderate' },
                    ],
                },
            },
        });
        const result = run(state);
        expect(result.outcome).toBe(Outcome.SUCCESS);
        const review = state.ui_review as Json;
        expect(review['review_clean']).toBe(true);
        expect(review['findings']).toEqual([]);
    });

    it('filters violations below the severity floor', () => {
        const state = uiStateWithAudit({
            audit: { a11y_baseline: [] },
            ui_review: {
                findings: [],
                review_clean: true,
                a11y: {
                    violations: [{ rule: 'region', selector: 'main', severity: 'minor' }],
                    severity_floor: 'moderate',
                },
            },
        });
        const result = run(state);
        expect(result.outcome).toBe(Outcome.SUCCESS);
        const review = state.ui_review as Json;
        expect(review['review_clean']).toBe(true);
        expect(review['findings']).toEqual([]);
    });

    it('filters accepted violations', () => {
        const state = uiStateWithAudit({
            audit: { a11y_baseline: [] },
            ui_review: {
                findings: [],
                review_clean: true,
                a11y: {
                    violations: [
                        { rule: 'aria-roles', selector: '[role=tab]', severity: 'serious' },
                    ],
                    accepted_violations: [{ rule: 'aria-roles', selector: '[role=tab]' }],
                },
            },
        });
        const result = run(state);
        expect(result.outcome).toBe(Outcome.SUCCESS);
        const review = state.ui_review as Json;
        expect(review['review_clean']).toBe(true);
        expect(review['findings']).toEqual([]);
    });

    it('synthesizes actionable findings (floor applied)', () => {
        const state = uiStateWithAudit({
            audit: { a11y_baseline: [] },
            ui_review: {
                findings: [],
                review_clean: true,
                a11y: {
                    violations: [
                        { rule: 'label', selector: 'input#email', severity: 'serious' },
                        { rule: 'color-contrast', selector: 'h1', severity: 'critical' },
                        { rule: 'region', selector: 'main', severity: 'minor' },
                    ],
                    severity_floor: 'moderate',
                },
            },
        });
        const result = run(state);
        expect(result.outcome).toBe(Outcome.SUCCESS);
        const review = state.ui_review as Json;
        expect(review['review_clean']).toBe(false);
        const findings = review['findings'] as Json[];
        expect(findings).toHaveLength(2);
        expect(new Set(findings.map((f) => f['rule']))).toEqual(
            new Set(['label', 'color-contrast']),
        );
        for (const f of findings) expect(f['kind']).toBe('a11y_violation');
    });

    it('is idempotent on re-entry (no duplicate synthesised findings)', () => {
        const state = uiStateWithAudit({
            audit: { a11y_baseline: [] },
            ui_review: {
                findings: [],
                review_clean: true,
                a11y: {
                    violations: [{ rule: 'label', selector: 'input', severity: 'serious' }],
                },
            },
        });
        run(state);
        run(state);
        run(state);
        const findings = (state.ui_review as Json)['findings'] as Json[];
        expect(findings).toHaveLength(1);
        expect(findings[0]?.['rule']).toBe('label');
    });

    it('preserves existing non-a11y findings', () => {
        const state = uiStateWithAudit({
            audit: { a11y_baseline: [] },
            ui_review: {
                findings: [{ path: 'header', issue: 'wrong padding' }],
                review_clean: false,
                a11y: {
                    violations: [{ rule: 'label', selector: 'input', severity: 'serious' }],
                },
            },
        });
        const result = run(state);
        expect(result.outcome).toBe(Outcome.SUCCESS);
        const findings = (state.ui_review as Json)['findings'] as Json[];
        expect(findings).toHaveLength(2);
        expect(findings.filter((f) => f['kind'] === 'a11y_violation')).toHaveLength(1);
    });

    it('defaults unknown severity to the floor (does not weaken the gate)', () => {
        const state = uiStateWithAudit({
            audit: { a11y_baseline: [] },
            ui_review: {
                findings: [],
                review_clean: true,
                a11y: {
                    violations: [{ rule: 'label', selector: 'input', severity: 'bogus' }],
                    severity_floor: 'moderate',
                },
            },
        });
        const result = run(state);
        expect(result.outcome).toBe(Outcome.SUCCESS);
        const review = state.ui_review as Json;
        expect(review['review_clean']).toBe(false);
        expect((review['findings'] as Json[])).toHaveLength(1);
    });

    it('runs the pending halt only after the basic shape gates', () => {
        const result = run(
            uiStateWithAudit({
                audit: { a11y_baseline: [] },
                ui_review: { review_clean: true }, // findings missing
            }),
        );
        expect(result.outcome).toBe(Outcome.BLOCKED);
        const body = result.questions.join('\n').toLowerCase();
        expect(body).toContain('findings');
        expect(body).not.toContain('a11y');
    });

    it('declares review_a11y_pending in the AMBIGUITIES table', () => {
        const codes = new Set(AMBIGUITIES.map((e) => e['code']));
        expect(codes.has('review_a11y_pending')).toBe(true);
    });
});

// --- R4 Phase 3: preview envelope gate --------------------------------------

describe('review — preview envelope gate', () => {
    it('render-capable + missing render_ok halts', () => {
        const result = run(
            uiState({
                stack: 'react-shadcn',
                ui_review: { findings: [], review_clean: true, preview: {} },
            }),
        );
        expect(result.outcome).toBe(Outcome.BLOCKED);
        const body = result.questions.join('\n').toLowerCase();
        expect(body).toContain('render evidence');
        expect(body).toContain('required');
        expect(body).toContain('render');
        expect(body).toContain('skip');
        expect(body).toContain('abort');
    });

    it('non-render-capable + missing render_ok passes (silent no-op)', () => {
        const result = run(
            uiState({
                stack: null,
                ui_review: { findings: [], review_clean: true, preview: {} },
            }),
        );
        expect(result.outcome).toBe(Outcome.SUCCESS);
    });

    it('render-capable + explicit skip passes', () => {
        const result = run(
            uiState({
                stack: 'react-shadcn',
                ui_review: {
                    findings: [],
                    review_clean: true,
                    preview: { skipped: true, skip_reason: 'no Playwright runner' },
                },
            }),
        );
        expect(result.outcome).toBe(Outcome.SUCCESS);
    });

    it('render-capable + non-dict preview halts (no silent pass)', () => {
        const result = run(
            uiState({
                stack: 'blade-livewire-flux',
                ui_review: { findings: [], review_clean: true, preview: null },
            }),
        );
        expect(result.outcome).toBe(Outcome.BLOCKED);
        expect(result.questions.join('\n').toLowerCase()).toContain('render evidence');
    });

    it('render_ok true passes', () => {
        const result = run(
            uiState({
                ui_review: {
                    findings: [],
                    review_clean: true,
                    preview: { render_ok: true, screenshot_path: 'tmp/preview/foo.png' },
                },
            }),
        );
        expect(result.outcome).toBe(Outcome.SUCCESS);
    });

    it('render_ok false halts with the error surfaced', () => {
        const result = run(
            uiState({
                ui_review: {
                    findings: [],
                    review_clean: true,
                    preview: {
                        render_ok: false,
                        error: 'ECONNREFUSED at http://localhost:5173',
                    },
                },
            }),
        );
        expect(result.outcome).toBe(Outcome.BLOCKED);
        const body = result.questions.join('\n').toLowerCase();
        expect(body).toContain('preview');
        expect(body).toContain('render');
        expect(body).toContain('econnrefused');
        expect(body).toContain('retry');
        expect(body).toContain('skip');
        expect(body).toContain('abort');
    });

    it('render_ok false without an error still halts (placeholder rendered)', () => {
        const result = run(
            uiState({
                ui_review: {
                    findings: [],
                    review_clean: true,
                    preview: { render_ok: false },
                },
            }),
        );
        expect(result.outcome).toBe(Outcome.BLOCKED);
        expect(result.questions.join('\n').toLowerCase()).toContain('none reported');
    });

    it('skipped round-trips through SUCCESS even with render_ok false', () => {
        const result = run(
            uiState({
                ui_review: {
                    findings: [],
                    review_clean: true,
                    preview: { render_ok: false, error: 'boom', skipped: true },
                },
            }),
        );
        expect(result.outcome).toBe(Outcome.SUCCESS);
    });

    it('runs after the a11y gate (ordering: shape → a11y → preview)', () => {
        const result = run(
            uiStateWithAudit({
                audit: { a11y_baseline: [] },
                ui_review: {
                    findings: [],
                    review_clean: true,
                    // No a11y key → a11y_pending halt fires first.
                    preview: { render_ok: false, error: 'boom' },
                },
            }),
        );
        expect(result.outcome).toBe(Outcome.BLOCKED);
        const body = result.questions.join('\n').toLowerCase();
        expect(body).toContain('a11y');
        expect(body).not.toContain('render');
    });

    it('declares the preview ambiguity codes in the AMBIGUITIES table', () => {
        const codes = new Set(AMBIGUITIES.map((e) => e['code']));
        expect(codes.has('preview_render_failed')).toBe(true);
        expect(codes.has('preview_render_required')).toBe(true);
    });
});
