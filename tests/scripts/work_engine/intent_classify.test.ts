// Tests for the work_engine `intent/classify` twin (ADR-094).
//
// `classify_intent` and `directive_set_for` are pure string functions;
// `populate_routing` mutates a WorkState in place.
import { describe, expect, it } from 'vitest';

import { Input, WorkState } from '../../../src/agent-src/templates/scripts/work_engine/state.js';
import {
    INTENT_BACKEND,
    INTENT_MIXED,
    INTENT_UI_BUILD,
    INTENT_UI_IMPROVE,
    INTENT_UI_TRIVIAL,
    KNOWN_INTENTS,
    ValueError,
    classify_intent,
    directive_set_for,
    populate_routing,
} from '../../../src/agent-src/templates/scripts/work_engine/intent/classify.js';

describe('intent/classify — TS-side unit checks', () => {
    it('label constants', () => {
        expect(INTENT_BACKEND).toBe('backend-coding');
        expect(INTENT_MIXED).toBe('mixed');
        expect([...KNOWN_INTENTS].sort()).toEqual([
            'backend-coding',
            'mixed',
            'ui-build',
            'ui-fix',
            'ui-improve',
            'ui-trivial',
        ]);
    });

    it('directive_set_for maps every label', () => {
        expect(directive_set_for(INTENT_UI_BUILD)).toBe('ui');
        expect(directive_set_for(INTENT_UI_IMPROVE)).toBe('ui');
        expect(directive_set_for('ui-fix')).toBe('ui');
        expect(directive_set_for(INTENT_UI_TRIVIAL)).toBe('ui-trivial');
        expect(directive_set_for(INTENT_MIXED)).toBe('mixed');
        expect(directive_set_for(INTENT_BACKEND)).toBe('backend');
    });

    it('directive_set_for throws ValueError on unknown', () => {
        expect(() => directive_set_for('nope')).toThrow(ValueError);
    });

    it('populate_routing: diff/file route straight to ui-improve', () => {
        const st = new WorkState({ input: new Input('diff', { raw: '--- a\n+++ b\n@@ -1 +1 @@\n' }) });
        populate_routing(st);
        expect(st.intent).toBe('ui-improve');
        expect(st.directive_set).toBe('ui');
    });

    it('populate_routing: prompt envelope classifies from raw', () => {
        const st = new WorkState({ input: new Input('prompt', { raw: 'make the button red' }) });
        populate_routing(st);
        expect(st.intent).toBe('ui-trivial');
        expect(st.directive_set).toBe('ui-trivial');
    });

    it('populate_routing: ticket uses title + first AC', () => {
        const st = new WorkState({
            input: new Input('ticket', {
                title: 'Redesign the dashboard',
                acceptance_criteria: ['improve the layout', ''],
            }),
        });
        populate_routing(st);
        expect(st.intent).toBe('ui-improve');
    });

    it('populate_routing: idempotent / override-safe (non-backend untouched)', () => {
        const st = new WorkState({
            input: new Input('prompt', { raw: 'make the button red' }),
            intent: 'mixed',
            directive_set: 'mixed',
        });
        populate_routing(st);
        expect(st.intent).toBe('mixed');
        expect(st.directive_set).toBe('mixed');
    });

    it('populate_routing: backend default stays backend', () => {
        const st = new WorkState({ input: new Input('prompt', { raw: 'add a queue worker' }) });
        populate_routing(st);
        expect(st.intent).toBe('backend-coding');
        expect(st.directive_set).toBe('backend');
    });
});

describe('intent/classify — a game is a build', () => {
    it.each([
        'build a full samurai game with missions',
        'create a 3d action game',
        'build me a game',
        'scaffold the puzzle game',
        'implement a new platformer game',
    ])('"%s" routes as a full-stack build', (prompt) => {
        expect(classify_intent(prompt)).toBe(INTENT_MIXED);
    });

    it.each(['add a log level', 'set the scene for the import', 'game theory of the auction', 'add a plugin hook'])(
        '"%s" does not',
        (prompt) => {
            expect(classify_intent(prompt)).not.toBe(INTENT_MIXED);
        },
    );
});
