// Pure-TS gap coverage for the `directives/ui/polish` twin — ported from the
// python spec `tests/work_engine/test_step_polish.py`. No python3, no golden
// oracle: build a `DeliveryState`, call `polish.run`, assert the
// `{outcome, questions}` shape directly against the twin.
//
// Focus per the py2ts gap brief: stack-dispatch (`ui-polish-<stack>`), the
// `STACK_DIRECTIVES == KNOWN_STACKS` invariant, the bounded loop / ceiling
// halt, and defensive `rounds` parsing — the behaviours the existing golden
// rig exercises only via the python projection.
import { describe, expect, it } from 'vitest';

import {
    AGENT_DIRECTIVE_PREFIX,
    DeliveryState,
    Outcome,
} from '../../../src/agent-src/templates/scripts/work_engine/delivery_state.js';
import {
    POLISH_CEILING,
    STACK_DIRECTIVES,
    TOKEN_REPEAT_THRESHOLD,
    TOKEN_VIOLATION_KIND,
    run,
} from '../../../src/agent-src/templates/scripts/work_engine/directives/ui/polish.js';
import { KNOWN_STACKS } from '../../../src/agent-src/templates/scripts/work_engine/stack/detect.js';

type Json = Record<string, unknown>;

/** First surfaced question — non-empty on every BLOCKED path under test. */
function q0(questions: string[]): string {
    return questions[0] ?? '';
}

function uiState(opts: {
    stack?: string | null;
    ui_review?: Json | null;
    ui_polish?: Json | null;
    ui_audit?: Json | null;
} = {}): DeliveryState {
    const stack = opts.stack === undefined ? 'blade-livewire-flux' : opts.stack;
    const state = new DeliveryState({
        ticket: {
            id: 'UI-4',
            title: 'Polish dark mode toggle',
            raw: 'Polish dark mode toggle',
        },
    });
    if (opts.ui_review != null) state.ui_review = opts.ui_review;
    if (opts.ui_polish != null) state.ui_polish = opts.ui_polish;
    if (opts.ui_audit != null) state.ui_audit = opts.ui_audit;
    if (stack != null) state.stack = { frontend: stack, mtime: 0.0 };
    return state;
}

// --- success / no-op paths --------------------------------------------------

describe('polish — success / no-op paths', () => {
    it('succeeds when review is clean', () => {
        const result = run(uiState({ ui_review: { findings: [], review_clean: true } }));
        expect(result.outcome).toBe(Outcome.SUCCESS);
    });

    it('succeeds when findings empty even if clean flag is false', () => {
        const result = run(uiState({ ui_review: { findings: [], review_clean: false } }));
        expect(result.outcome).toBe(Outcome.SUCCESS);
    });

    it('succeeds with clean flag after max rounds (ship-as-is replay)', () => {
        const result = run(
            uiState({
                ui_review: {
                    findings: [{ path: 'label', issue: 'wrong copy' }],
                    review_clean: true,
                },
                ui_polish: { rounds: 2, applied: [] },
            }),
        );
        expect(result.outcome).toBe(Outcome.SUCCESS);
    });
});

// --- bounded loop -----------------------------------------------------------

describe('polish — bounded loop directives', () => {
    it('emits the stack directive on the first round', () => {
        const result = run(
            uiState({
                ui_review: {
                    findings: [{ path: 'label', issue: 'wrong copy' }],
                    review_clean: false,
                },
                ui_polish: null,
            }),
        );
        expect(result.outcome).toBe(Outcome.BLOCKED);
        expect(q0(result.questions).startsWith(AGENT_DIRECTIVE_PREFIX)).toBe(true);
        expect(q0(result.questions)).toContain('ui-polish-blade-livewire-flux');
        const body = result.questions.join('\n');
        expect(body.includes('1 of 2') || body.toLowerCase().includes('round 1')).toBe(true);
    });

    it('emits the directive on the second round', () => {
        const result = run(
            uiState({
                ui_review: {
                    findings: [{ path: 'label', issue: 'wrong copy' }],
                    review_clean: false,
                },
                ui_polish: { rounds: 1, applied: [{ path: 'label', fix: 'x' }] },
            }),
        );
        expect(result.outcome).toBe(Outcome.BLOCKED);
        expect(q0(result.questions).startsWith(AGENT_DIRECTIVE_PREFIX)).toBe(true);
        const body = result.questions.join('\n');
        expect(body.includes('2 of 2') || body.toLowerCase().includes('round 2')).toBe(true);
    });
});

// --- ceiling halt -----------------------------------------------------------

describe('polish — ceiling halt', () => {
    it('halts at ceiling when review still dirty (user-decision, not directive)', () => {
        const result = run(
            uiState({
                ui_review: {
                    findings: [
                        { path: 'label', issue: 'wrong copy' },
                        { path: 'btn', issue: 'missing aria-label' },
                    ],
                    review_clean: false,
                },
                ui_polish: { rounds: 2, applied: [] },
            }),
        );
        expect(result.outcome).toBe(Outcome.BLOCKED);
        const body = result.questions.join('\n');
        expect(q0(result.questions).startsWith(AGENT_DIRECTIVE_PREFIX)).toBe(false);
        expect(body.toLowerCase()).toContain('ceiling');
        expect(body).toContain('Ship as-is');
        expect(body).toContain('Abort');
        expect(body).toContain('Hand off');
    });

    it('surfaces the findings count at ceiling', () => {
        const result = run(
            uiState({
                ui_review: {
                    findings: [0, 1, 2].map((i) => ({ path: `f${i}`, issue: 'x' })),
                    review_clean: false,
                },
                ui_polish: { rounds: 2, applied: [] },
            }),
        );
        expect(result.questions.join('\n')).toContain('3');
    });

    it('refuses a third round even with a higher rounds value', () => {
        const result = run(
            uiState({
                ui_review: {
                    findings: [{ path: 'x', issue: 'y' }],
                    review_clean: false,
                },
                ui_polish: { rounds: 5, applied: [] },
            }),
        );
        expect(result.outcome).toBe(Outcome.BLOCKED);
        expect(result.questions.join('\n')).toContain('Ship as-is');
    });
});

// --- stack dispatch ---------------------------------------------------------

describe('polish — stack dispatch', () => {
    it('dispatches to the react-shadcn directive', () => {
        const result = run(
            uiState({
                stack: 'react-shadcn',
                ui_review: { findings: [{ path: 'x', issue: 'y' }], review_clean: false },
            }),
        );
        expect(q0(result.questions)).toContain('ui-polish-react-shadcn');
    });

    it('falls back to plain when the stack is missing', () => {
        const result = run(
            uiState({
                stack: null,
                ui_review: { findings: [{ path: 'x', issue: 'y' }], review_clean: false },
            }),
        );
        expect(q0(result.questions)).toContain('ui-polish-plain');
    });

    it('STACK_DIRECTIVES keys match KNOWN_STACKS exactly', () => {
        expect(new Set(Object.keys(STACK_DIRECTIVES))).toEqual(new Set(KNOWN_STACKS));
    });
});

// --- defensive parsing ------------------------------------------------------

describe('polish — defensive rounds parsing', () => {
    it('treats a non-int rounds as zero (first-round directive, not ceiling)', () => {
        const result = run(
            uiState({
                ui_review: { findings: [{ path: 'x', issue: 'y' }], review_clean: false },
                ui_polish: { rounds: 'two', applied: [] },
            }),
        );
        expect(result.outcome).toBe(Outcome.BLOCKED);
        expect(q0(result.questions).startsWith(AGENT_DIRECTIVE_PREFIX)).toBe(true);
    });

    it('treats a bool rounds (true) as zero — not round 1', () => {
        const result = run(
            uiState({
                ui_review: { findings: [{ path: 'x', issue: 'y' }], review_clean: false },
                ui_polish: { rounds: true, applied: [] },
            }),
        );
        expect(result.outcome).toBe(Outcome.BLOCKED);
        expect(q0(result.questions).startsWith(AGENT_DIRECTIVE_PREFIX)).toBe(true);
        const body = result.questions.join('\n');
        expect(body.includes('1 of 2') || body.toLowerCase().includes('round 1')).toBe(true);
    });
});

// --- constant mirrors -------------------------------------------------------

describe('polish — schema-mirror constants', () => {
    it('POLISH_CEILING is 2', () => {
        expect(POLISH_CEILING).toBe(2);
    });

    it('TOKEN_REPEAT_THRESHOLD is 2', () => {
        expect(TOKEN_REPEAT_THRESHOLD).toBe(2);
    });
});

// --- token-violation refactor ----------------------------------------------

function tokenFinding(
    category: string,
    value: string,
    path = 'Component.razor',
): Json {
    return {
        kind: TOKEN_VIOLATION_KIND,
        category,
        value,
        path,
        issue: `hardcoded ${category} value \`${value}\``,
    };
}

describe('polish — token-violation classifier', () => {
    it('auto-converts when token matches an existing design token (no halt)', () => {
        const result = run(
            uiState({
                ui_review: {
                    findings: [
                        tokenFinding('colors', '#3b82f6', 'Button.blade.php'),
                        tokenFinding('colors', '#3b82f6', 'Card.blade.php'),
                    ],
                    review_clean: false,
                },
                ui_audit: {
                    components_found: [],
                    design_tokens: { colors: { primary: '#3b82f6' } },
                },
            }),
        );
        expect(result.outcome).toBe(Outcome.BLOCKED);
        expect(q0(result.questions).startsWith(AGENT_DIRECTIVE_PREFIX)).toBe(true);
        const body = result.questions.join('\n');
        expect(
            body.includes('2 token-violation match') || body.includes('auto-convert'),
        ).toBe(true);
    });

    it('halts when an unmatched value repeats above the threshold', () => {
        const result = run(
            uiState({
                ui_review: {
                    findings: [0, 1, 2].map((i) =>
                        tokenFinding('colors', '#abcdef', `f${i}.blade.php`),
                    ),
                    review_clean: false,
                },
                ui_audit: { design_tokens: { colors: { primary: '#3b82f6' } } },
            }),
        );
        expect(result.outcome).toBe(Outcome.BLOCKED);
        expect(q0(result.questions).startsWith(AGENT_DIRECTIVE_PREFIX)).toBe(false);
        const body = result.questions.join('\n');
        expect(body).toContain('#abcdef');
        expect(body).toContain('Extract');
        expect(body).toContain('Inline');
        expect(body).toContain('Abort');
    });

    it('does not halt at exactly the threshold (strict >)', () => {
        const result = run(
            uiState({
                ui_review: {
                    findings: [
                        tokenFinding('spacing', '13px', 'A.blade.php'),
                        tokenFinding('spacing', '13px', 'B.blade.php'),
                    ],
                    review_clean: false,
                },
                ui_audit: { design_tokens: { spacing: { sm: '8px' } } },
            }),
        );
        expect(result.outcome).toBe(Outcome.BLOCKED);
        expect(q0(result.questions).startsWith(AGENT_DIRECTIVE_PREFIX)).toBe(true);
        expect(result.questions.join('\n')).not.toContain('Extract');
    });

    it('halts when audit missing — no tokens known → value unmatched', () => {
        const result = run(
            uiState({
                ui_review: {
                    findings: [0, 1, 2].map(() => tokenFinding('colors', '#deadbe')),
                    review_clean: false,
                },
            }),
        );
        expect(result.outcome).toBe(Outcome.BLOCKED);
        expect(result.questions.join('\n')).toContain('Extract');
    });

    it('ignores non-token findings in the classifier', () => {
        const result = run(
            uiState({
                ui_review: {
                    findings: [
                        { path: 'label', issue: 'wrong copy' },
                        { path: 'btn', issue: 'missing aria-label' },
                    ],
                    review_clean: false,
                },
                ui_audit: { design_tokens: { colors: { primary: '#fff' } } },
            }),
        );
        expect(result.outcome).toBe(Outcome.BLOCKED);
        expect(q0(result.questions).startsWith(AGENT_DIRECTIVE_PREFIX)).toBe(true);
        const body = result.questions.join('\n');
        expect(body).not.toContain('Extract');
        expect(body).not.toContain('token-violation match');
    });

    it('ceiling overrides the token-extraction halt', () => {
        const result = run(
            uiState({
                ui_review: {
                    findings: [0, 1, 2].map(() => tokenFinding('colors', '#abcdef')),
                    review_clean: false,
                },
                ui_polish: { rounds: 2, applied: [] },
                ui_audit: { design_tokens: { colors: {} } },
            }),
        );
        const body = result.questions.join('\n');
        expect(body).toContain('Ship as-is');
        expect(body).not.toContain('Extract');
    });
});

// --- R4 Phase 2: a11y-blocking + one-shot extension ------------------------

function a11yFinding(rule = 'color-contrast', selector = '.x'): Json {
    return { kind: 'a11y_violation', rule, selector, severity: 'serious' };
}

describe('polish — a11y-blocking ceiling + one-shot extension', () => {
    it('emits the a11y-blocking halt at the ceiling with a11y findings', () => {
        const result = run(
            uiState({
                ui_review: { findings: [a11yFinding()], review_clean: false },
                ui_polish: { rounds: 2, applied: [], extension_used: false },
            }),
        );
        expect(result.outcome).toBe(Outcome.BLOCKED);
        const body = result.questions.join('\n');
        expect(body).toContain('a11y violation');
        expect(body).toContain('Extend');
        expect(body).toContain('Accept');
        expect(body).not.toContain('Ship as-is');
        expect(body).not.toContain('Hand off');
    });

    it('a11y halt takes precedence over the subjective ceiling halt', () => {
        const result = run(
            uiState({
                ui_review: {
                    findings: [a11yFinding(), { path: 'x', issue: 'subjective' }],
                    review_clean: false,
                },
                ui_polish: { rounds: 2, applied: [] },
            }),
        );
        const body = result.questions.join('\n');
        expect(body).toContain('Extend');
        expect(body).not.toContain('Ship as-is');
    });

    it('subjective-only findings keep the classic ceiling halt', () => {
        const result = run(
            uiState({
                ui_review: {
                    findings: [{ path: 'x', issue: 'subjective' }],
                    review_clean: false,
                },
                ui_polish: { rounds: 2, applied: [] },
            }),
        );
        const body = result.questions.join('\n');
        expect(body).toContain('Ship as-is');
        expect(body).toContain('Hand off');
        expect(body).not.toContain('Extend');
    });

    it('extension grants round three (delegation, not halt)', () => {
        const result = run(
            uiState({
                ui_review: { findings: [a11yFinding()], review_clean: false },
                ui_polish: { rounds: 2, applied: [], extension_used: true },
            }),
        );
        expect(result.outcome).toBe(Outcome.BLOCKED);
        expect(q0(result.questions).startsWith(AGENT_DIRECTIVE_PREFIX)).toBe(true);
        expect(result.questions.join('\n')).toContain('round 3 of 3');
    });

    it('exhausted extension drops the Extend option', () => {
        const result = run(
            uiState({
                ui_review: { findings: [a11yFinding()], review_clean: false },
                ui_polish: { rounds: 3, applied: [], extension_used: true },
            }),
        );
        expect(result.outcome).toBe(Outcome.BLOCKED);
        const body = result.questions.join('\n');
        expect(body).toContain('Accept');
        expect(body).toContain('Abort');
        expect(body).not.toContain('Extend');
    });

    it('a11y halt lists the findings', () => {
        const result = run(
            uiState({
                ui_review: {
                    findings: [
                        a11yFinding('color-contrast', '.btn'),
                        a11yFinding('label', 'input#name'),
                    ],
                    review_clean: false,
                },
                ui_polish: { rounds: 2, applied: [] },
            }),
        );
        const body = result.questions.join('\n');
        expect(body).toContain('color-contrast');
        expect(body).toContain('.btn');
        expect(body).toContain('label');
    });
});
