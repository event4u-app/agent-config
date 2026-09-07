// Fixtures for ask-before-park (`_lib/blocked_by_marker.ts`),
// road-to-asked-not-parked 3.1 and 3.2.
//
// These are the fixture runs those two steps verify against. The three that
// matter most are negative: a timeout must not become consent, a
// non-interactive context must not become consent, and NO path may return the
// conservative default as an answer. A decision module never seen refuse has
// unknown sensitivity, so each of the three is asserted directly rather than
// inferred from the happy path.
import { describe, expect, it } from 'vitest';

import {
    BLOCKED_BY_MARKER_RE,
    decideAsk,
    parkAfterDecline,
    parseBlockedByMarker,
    renderBlockedByMarker,
    type AskContext,
} from '../../src/scripts/_lib/blocked_by_marker.js';

const BASE: AskContext = {
    id: 'kernel-ask-form-authority',
    question: 'Authorize the ask-form delta, decline it, or defer it with a reason?',
    conservativeDefault: 'defer — leave the kernel rules unchanged',
    interactive: true,
};

describe('the marker grammar', () => {
    it('still accepts the pre-existing shape', () => {
        const m = parseBlockedByMarker('- [ ] step <!-- blocked-by: some-id -->');
        expect(m).toEqual({ id: 'some-id', asked: null, reason: null });
    });

    it('accepts an asked field', () => {
        expect(parseBlockedByMarker('<!-- blocked-by: some-id | asked: yes -->')).toEqual({
            id: 'some-id',
            asked: true,
            reason: null,
        });
        expect(
            parseBlockedByMarker('<!-- blocked-by: some-id | asked: no — no TTY in CI -->'),
        ).toEqual({ id: 'some-id', asked: false, reason: 'no TTY in CI' });
    });

    it('round-trips through the renderer', () => {
        for (const marker of [
            { id: 'x', asked: null, reason: null },
            { id: 'x', asked: true, reason: null },
            { id: 'x', asked: false, reason: 'non-interactive run' },
        ]) {
            expect(parseBlockedByMarker(renderBlockedByMarker(marker))).toEqual(marker);
        }
    });

    it('refuses to render `asked: no` with no reason', () => {
        expect(() => renderBlockedByMarker({ id: 'x', asked: false, reason: null })).toThrow(
            /needs a reason/,
        );
        expect(() => renderBlockedByMarker({ id: 'x', asked: false, reason: '  ' })).toThrow(
            /needs a reason/,
        );
    });

    it('does not match prose that merely mentions the syntax', () => {
        expect(BLOCKED_BY_MARKER_RE.test('the marker is written blocked-by: some-id')).toBe(false);
    });
});

describe('3.1 — a user decision is put to the user before it is parked', () => {
    it('an interactive run asks and writes NO marker', () => {
        const d = decideAsk(BASE);
        expect(d.action).toBe('ask');
        expect(d.marker).toBeNull();
        expect(d.surfaced).toBe(BASE.question);
    });

    it('an answer ends the block with nothing parked', () => {
        const d = decideAsk({ ...BASE, answer: 'decline' });
        expect(d.action).toBe('answered');
        expect(d.marker).toBeNull();
    });

    it('a non-interactive run writes `asked: no` WITH a reason', () => {
        const d = decideAsk({
            ...BASE,
            interactive: false,
            nonInteractiveReason: 'CI, no TTY',
        });
        expect(d.action).toBe('park');
        expect(d.marker).toBe(
            '<!-- blocked-by: kernel-ask-form-authority | asked: no — CI, no TTY -->',
        );
        expect(parseBlockedByMarker(d.marker as string)?.reason).toBe('CI, no TTY');
    });

    it('a non-interactive run with no stated reason still records that none was recorded', () => {
        // The failure mode is a silent `asked: no`, not an unhelpful one.
        const d = decideAsk({ ...BASE, interactive: false });
        expect(parseBlockedByMarker(d.marker as string)?.reason).toMatch(/not recorded/);
    });

    it('a decline records that the question WAS put', () => {
        expect(parseBlockedByMarker(parkAfterDecline('some-id'))).toEqual({
            id: 'some-id',
            asked: true,
            reason: null,
        });
    });
});

describe('3.2 — a timeout is never consent', () => {
    it('a timed-out ask ends the run `approval-required`', () => {
        const d = decideAsk({ ...BASE, timedOut: true });
        expect(d.action).toBe('approval-required');
        expect(d.terminal).toBe('approval-required');
    });

    it('the unanswered question is surfaced verbatim', () => {
        const d = decideAsk({ ...BASE, timedOut: true });
        expect(d.surfaced).toContain(BASE.question);
    });

    it('the conservative default is named and NOT adopted', () => {
        const d = decideAsk({ ...BASE, timedOut: true });
        expect(d.surfaced).toContain('NOT adopted');
        expect(d.surfaced).toContain(BASE.conservativeDefault);
        expect(d.defaultAdopted).toBe(false);
    });

    it('a timeout outranks non-interactivity — asked-and-unanswered is not could-not-ask', () => {
        const d = decideAsk({ ...BASE, interactive: false, timedOut: true });
        expect(d.action).toBe('approval-required');
        expect(parseBlockedByMarker(d.marker as string)?.asked).toBe(true);
    });

    it('NO path adopts the default without an answer', () => {
        const paths: AskContext[] = [
            BASE,
            { ...BASE, timedOut: true },
            { ...BASE, interactive: false, nonInteractiveReason: 'hook context' },
            { ...BASE, answer: 'decline' },
            { ...BASE, answer: '   ' },
        ];
        for (const ctx of paths) {
            expect(decideAsk(ctx).defaultAdopted).toBe(false);
        }
    });

    it('a blank answer is not an answer', () => {
        expect(decideAsk({ ...BASE, answer: '   ' }).action).toBe('ask');
    });
});
