/**
 * Provided-artifact port gates — `road-to-provided-artifact-honesty` Phase 2.
 *
 * Two behaviours, both measured red in the Phase-0 baseline:
 *
 *   1. HONEST REFUSAL — a finished artifact handed over with no
 *      `design-system.json` used to be rebuilt from the five-key brief in
 *      silence. `design` now names every value the brief cannot carry and
 *      asks first.
 *   2. COVERAGE LEDGER — `apply` never read `state.ui_design` at all, so a
 *      dropped handler or a lost keyframe left no trace anywhere. Every
 *      declared interaction, keyframe, and asset must now appear in exactly
 *      one coverage bucket, or apply refuses the envelope.
 *
 * Fixtures: `daf-port-baseline`, `daf-port-interactions`
 * (tests/design-artifacts/eval-fixtures.md).
 *
 * The non-port regressions matter as much as the port assertions: this slot
 * is optional, and a brief without it must behave exactly as it did before.
 */
import { describe, expect, it } from 'vitest';

import { DeliveryState } from '../../../src/agent-src/templates/scripts/work_engine/delivery_state.js';
import { from_dict } from '../../../src/agent-src/templates/scripts/work_engine/state.js';
import {
    PROVIDED_ARTIFACT_KEY,
    UNCARRIED_BY_THE_BRIEF,
    has_design_system,
    provided_artifact,
    run as designRun,
} from '../../../src/agent-src/templates/scripts/work_engine/directives/ui/design.js';
import {
    COVERAGE_BUCKETS,
    coverage_gaps,
    run as applyRun,
} from '../../../src/agent-src/templates/scripts/work_engine/directives/ui/apply.js';

/** A complete, confirmed brief — the shape every gate below starts from. */
function brief(extra: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        layout: 'two screens, tab-switched',
        components: ['tabs', 'card', 'disclosure', 'subscribe form'],
        states: {
            empty: 'no agreements yet',
            loading: 'skeleton cards',
            error: 'could not load the archive',
            success: 'Filed. The Monday summary is on its way.',
            disabled: 'submit disabled while filing',
        },
        microcopy: { submit: 'Send me the summary' },
        a11y: 'tabs expose aria-selected; disclosure exposes aria-expanded',
        design_confirmed: true,
        ...extra,
    };
}

/** The port envelope the fixture artifact would produce. */
function portArtifact(extra: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        path: 'tests/design-artifacts/fixtures/design.html',
        interactions: ['screen switch', 'disclosure toggle', 'subscribe submit'],
        keyframes: ['rule-draw'],
        assets: [],
        ...extra,
    };
}

function stateWith(ui_design: Record<string, unknown> | null, ui_apply?: unknown): DeliveryState {
    const ticket: Record<string, unknown> = { id: 'T-1', title: 'port the handover' };
    if (ui_apply !== undefined) ticket['ui_apply'] = ui_apply;
    return new DeliveryState({
        ticket: ticket as never,
        ui_design: ui_design as never,
        stack: { frontend: 'plain' } as never,
    });
}

describe('design — honest refusal on a provided artifact', () => {
    it('halts and names every uncarried value class when no contract came with it', () => {
        const r = designRun(stateWith(brief({ [PROVIDED_ARTIFACT_KEY]: portArtifact() })));
        expect(r.outcome).toBe('blocked');
        const body = r.questions.join('\n');
        // The loss list is the point — assert the whole set, not a sample.
        for (const loss of UNCARRIED_BY_THE_BRIEF) {
            expect(body).toContain(loss);
        }
        expect(body).toContain('design.html');
        expect(r.message).toContain(String(UNCARRIED_BY_THE_BRIEF.length));
    });

    it('offers supplying the contract as the recommended option, not aborting', () => {
        const body = designRun(
            stateWith(brief({ [PROVIDED_ARTIFACT_KEY]: portArtifact() })),
        ).questions.join('\n');
        expect(body).toMatch(/\*\*Recommendation: 2\b/);
        expect(body).toContain('design-system.json');
    });

    it('proceeds once a design_system accompanies the artifact', () => {
        const r = designRun(
            stateWith(
                brief({
                    [PROVIDED_ARTIFACT_KEY]: portArtifact({
                        design_system: {
                            source: { kind: 'html', ref: 'design.html' },
                            colors: { light: { bg: '#f5f1ea', accent: '#c96442' } },
                            motion: { durations: { rule: '600ms' }, easings: { rule: 'ease-out' } },
                        },
                    }),
                }),
            ),
        );
        expect(r.outcome).toBe('success');
    });

    it('proceeds once the stated losses are acknowledged', () => {
        const r = designRun(
            stateWith(brief({ [PROVIDED_ARTIFACT_KEY]: portArtifact({ loss_acknowledged: true }) })),
        );
        expect(r.outcome).toBe('success');
    });

    it('an empty artifact envelope is not a port', () => {
        expect(provided_artifact(brief({ [PROVIDED_ARTIFACT_KEY]: {} }))).toBeNull();
        expect(designRun(stateWith(brief({ [PROVIDED_ARTIFACT_KEY]: {} }))).outcome).toBe('success');
    });

    it('a brief with no provided artifact is unaffected', () => {
        expect(designRun(stateWith(brief())).outcome).toBe('success');
        expect(provided_artifact(brief())).toBeNull();
    });

    it('the refusal fires before sign-off, not after', () => {
        // design_confirmed is deliberately absent: the loss must be stated
        // before the user is asked to confirm a brief built on it.
        const b = brief({ [PROVIDED_ARTIFACT_KEY]: portArtifact() });
        delete b['design_confirmed'];
        const body = designRun(stateWith(b)).questions.join('\n');
        expect(body).toContain('would be rebuilt from taste');
        expect(body).not.toContain('Design brief is ready');
    });

    it('has_design_system rejects an empty contract object', () => {
        expect(has_design_system(portArtifact({ design_system: {} }) as never)).toBe(false);
        expect(has_design_system(portArtifact({ design_system: { source: {} } }) as never)).toBe(true);
    });
});

describe('apply — the coverage ledger', () => {
    const design = brief({ [PROVIDED_ARTIFACT_KEY]: portArtifact({ loss_acknowledged: true }) });

    it('refuses an envelope with no coverage report', () => {
        const r = applyRun(stateWith(design, { rendered: { 'a.html': 'ok' }, files: ['a.html'] }));
        expect(r.outcome).toBe('blocked');
        expect(r.questions.join('\n')).toContain('no `coverage` report');
    });

    it('names each declared item that no bucket accounts for', () => {
        const r = applyRun(
            stateWith(design, {
                rendered: { 'a.html': 'ok' },
                files: ['a.html'],
                coverage: { honoured: ['screen switch'], translated: [], flagged: [] },
            }),
        );
        expect(r.outcome).toBe('blocked');
        const body = r.questions.join('\n');
        expect(body).toContain('disclosure toggle');
        expect(body).toContain('subscribe submit');
        expect(body).toContain('rule-draw');
        // The one item that WAS accounted for must not be reported as a gap.
        expect(body).not.toMatch(/`interactions`: `screen switch`/);
    });

    it('accepts a report that accounts for every declared item, dropped ones included', () => {
        const r = applyRun(
            stateWith(design, {
                rendered: { 'a.html': 'ok' },
                files: ['a.html'],
                coverage: {
                    honoured: ['screen switch', 'disclosure toggle'],
                    translated: ['subscribe submit — translated to a form action'],
                    flagged: ['rule-draw — keyframe dropped, no motion layer in this stack'],
                },
            }),
        );
        expect(r.outcome).toBe('success');
    });

    it('a flagged loss is what keeps a dropped handler out of silence', () => {
        // The whole point of the gate: dropping a handler is allowed, hiding
        // it is not. Same envelope, once with the flag and once without.
        const withFlag = coverage_gaps(portArtifact() as never, {
            honoured: ['screen switch', 'disclosure toggle'],
            translated: [],
            flagged: ['subscribe submit — dropped', 'rule-draw — dropped', 'assets: none'],
        });
        const withoutFlag = coverage_gaps(portArtifact() as never, {
            honoured: ['screen switch', 'disclosure toggle'],
            translated: [],
            flagged: [],
        });
        expect(withFlag).toEqual([]);
        expect(withoutFlag.length).toBe(2);
    });

    it('a missing bucket is a gap, an empty bucket is not', () => {
        const bare = { interactions: [], keyframes: [], assets: [] };
        expect(coverage_gaps(bare as never, { honoured: [], translated: [], flagged: [] })).toEqual([]);
        for (const bucket of COVERAGE_BUCKETS) {
            const partial: Record<string, unknown> = {
                honoured: [],
                translated: [],
                flagged: [],
            };
            delete partial[bucket];
            expect(coverage_gaps(bare as never, partial)).toEqual([
                `\`coverage.${bucket}\` is missing (use an empty list if nothing qualifies)`,
            ]);
        }
    });

    it('a non-list bucket is rejected rather than silently skipped', () => {
        const gaps = coverage_gaps(portArtifact() as never, {
            honoured: 'all of it',
            translated: [],
            flagged: [],
        });
        expect(gaps[0]).toContain('must be a list of strings');
    });

    it('a non-port apply is unaffected by the ledger', () => {
        const r = applyRun(stateWith(brief(), { rendered: { 'a.html': 'ok' }, files: ['a.html'] }));
        expect(r.outcome).toBe('success');
    });

    it('the delegation directive tells the agent it is porting', () => {
        const body = applyRun(stateWith(design)).questions.join('\n');
        expect(body).toContain('This is a **port**');
        expect(body).toContain('coverage');
    });
});

describe('state schema — the artifact slot cannot be bypassed by type', () => {
    function withProvided(provided: unknown): () => unknown {
        return () =>
            from_dict({
                version: 1,
                input: { kind: 'prompt', value: 'x' },
                intent: 'implement',
                directive_set: 'ui',
                ui_design: { ...brief(), [PROVIDED_ARTIFACT_KEY]: provided },
            } as never);
    }

    it('accepts a well-formed envelope', () => {
        expect(withProvided(portArtifact())).not.toThrow();
    });

    it('rejects a stringly-typed inventory — the states: "n/a" bypass, repeated', () => {
        expect(withProvided(portArtifact({ interactions: 'three of them' }))).toThrow(
            /interactions must be a list/,
        );
    });

    it('rejects a non-object envelope, a non-string path, and a non-bool acknowledgement', () => {
        expect(withProvided('design.html')).toThrow(/must be a JSON object or null/);
        expect(withProvided(portArtifact({ path: 42 }))).toThrow(/path must be a string/);
        expect(withProvided(portArtifact({ loss_acknowledged: 'yes' }))).toThrow(
            /loss_acknowledged must be a boolean/,
        );
        expect(withProvided(portArtifact({ design_system: 'tokens.json' }))).toThrow(
            /design_system must be a JSON/,
        );
    });
});
