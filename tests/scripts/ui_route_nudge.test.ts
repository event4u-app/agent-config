/**
 * `ui_route_nudge` — the decision logic of the UI-write reminder.
 *
 * It runs parallel to the two UI rules; it does not read their triggers. The
 * coupling that does exist is pinned in `ui_rule_triggers.test.ts`.
 *
 * Four properties carry the weight, and each has a way of failing that would
 * be invisible in production:
 *
 *   1. it warns on an unconsulted UI write — the case it exists for;
 *   2. it goes quiet once the session HAS consulted — otherwise it nags the
 *      exact agent that did the right thing;
 *   3. it goes quiet after `MAX_NUDGES` regardless — the anti-loop valve,
 *      without which a deliberate-but-undeclared pattern traps the agent;
 *   4. the latch means the skill was OPENED, not that its name appeared
 *      somewhere — one false positive silences both the nudge and the metric
 *      that shares its event stream.
 *
 * The logic is tested through `decide`, which is pure. The filesystem and the
 * envelope shape are tested separately so a payload-shape change cannot hide
 * behind a passing logic test.
 */
import { describe, expect, it } from 'vitest';

import {
    MAX_NUDGES,
    MAX_SESSIONS,
    decide,
    pruneSessions,
    extractEvent,
    isConsultation,
    isUiWrite,
    nudgeReason,
    type SessionState,
    type ToolEvent,
} from '../../src/scripts/hooks/ui_route_nudge_hook.js';

const fresh: SessionState = { consulted: false, nudges: 0 };

function write(file: string): ToolEvent {
    return { file, isWrite: true };
}
function read(file: string): ToolEvent {
    return { file, isWrite: false };
}

describe('event classification', () => {
    it('treats a write to a UI file as a UI write', () => {
        expect(isUiWrite(write('src/components/Card.tsx'))).toBe(true);
        expect(isUiWrite(write('resources/views/home.blade.php'))).toBe(true);
    });

    it('does not treat a backend write as a UI write', () => {
        expect(isUiWrite(write('app/Http/Controllers/CheckoutController.php'))).toBe(false);
        expect(isUiWrite(write('src/scripts/lint_design_slop.ts'))).toBe(false);
    });

    it('does not treat a read of a UI file as a write', () => {
        expect(isUiWrite(read('src/components/Card.tsx'))).toBe(false);
    });

    it('counts opening a design surface as consultation', () => {
        expect(isConsultation(read('src/skills/fe-design/SKILL.md'))).toBe(true);
        expect(isConsultation(read('src/skills/existing-ui-audit/SKILL.md'))).toBe(true);
        expect(isConsultation(read('dist/agent-src/skills/design-review/SKILL.md'))).toBe(true);
    });

    it('does not latch on a path that merely contains the skill name', () => {
        // The rule file is not the skill. Latching here silenced the nudge for
        // a whole session and counted as a consultation in the metric.
        expect(isConsultation(read('src/rules/design-review-after-ui-write.md'))).toBe(false);
        expect(isConsultation(read('tests/scripts/fe_design_triggers.test.ts'))).toBe(false);
    });

    it('does not count a write as consultation, even to a design surface', () => {
        expect(isConsultation({ file: 'src/skills/fe-design/SKILL.md', isWrite: true })).toBe(
            false,
        );
    });
});

describe('decide', () => {
    it('warns on an unconsulted UI write', () => {
        const result = decide(write('src/components/Card.tsx'), fresh);

        expect(result.warn).toBe(true);
        expect(result.state.nudges).toBe(1);
    });

    it('stays silent once the session has consulted', () => {
        const consulted: SessionState = { consulted: true, nudges: 0 };

        expect(decide(write('src/components/Card.tsx'), consulted).warn).toBe(false);
    });

    it('latches consultation and does not warn on the consulting read itself', () => {
        const result = decide(read('src/skills/fe-design/SKILL.md'), fresh);

        expect(result.warn).toBe(false);
        expect(result.state.consulted).toBe(true);
    });

    it('goes silent after MAX_NUDGES — the anti-loop valve', () => {
        let state = fresh;
        let warnings = 0;
        for (let i = 0; i < MAX_NUDGES + 3; i += 1) {
            const result = decide(write('src/components/Card.tsx'), state);
            state = result.state;
            if (result.warn) warnings += 1;
        }

        expect(warnings).toBe(MAX_NUDGES);
    });

    it('ignores a non-UI write entirely', () => {
        const result = decide(write('src/scripts/foo.ts'), fresh);

        expect(result.warn).toBe(false);
        expect(result.state).toEqual(fresh);
    });
});

describe('extractEvent', () => {
    it('reads the nested payload shape the dispatcher sends', () => {
        const event = extractEvent({
            payload: { tool_input: { file_path: 'src/components/Card.tsx', content: '<div/>' } },
        });

        expect(event).toEqual({ file: 'src/components/Card.tsx', isWrite: true });
    });

    it('reads the flat legacy shape too', () => {
        const event = extractEvent({
            tool_input: { file_path: 'a.vue', new_string: 'x' },
        });

        expect(event?.isWrite).toBe(true);
    });

    it('does not turn a search into a consultation', () => {
        // A grep whose pattern happens to name a skill is not the skill being
        // read; `command` is not collected at all, so `git log -- src/skills/
        // fe-design` cannot latch either.
        const event = extractEvent({ tool_input: { pattern: 'fe-design' } })!;

        expect(isConsultation(event)).toBe(false);
    });

    it('returns null when there is no tool input to read', () => {
        expect(extractEvent({ payload: {} })).toBeNull();
    });
});

describe('nudgeReason', () => {
    it('names the file and the skip conditions rather than scolding', () => {
        const reason = nudgeReason('src/components/Card.tsx');

        expect(reason).toContain('src/components/Card.tsx');
        expect(reason).toContain('existing-ui-audit');
        expect(reason).toContain('ui-trivial');
    });
});

describe('state hygiene', () => {
    it('keeps the file bounded by dropping the oldest sessions', () => {
        const all: Record<string, SessionState> = {};
        for (let i = 0; i < MAX_SESSIONS + 10; i += 1) {
            all[`session-${i}`] = { consulted: false, nudges: 1 };
        }

        const pruned = pruneSessions(all);

        expect(Object.keys(pruned)).toHaveLength(MAX_SESSIONS);
        // Oldest dropped, newest kept.
        expect(pruned['session-0']).toBeUndefined();
        expect(pruned[`session-${MAX_SESSIONS + 9}`]).toBeDefined();
    });

    it('leaves a small file untouched', () => {
        const all = { a: { consulted: true, nudges: 0 } };

        expect(pruneSessions(all)).toEqual(all);
    });
});
