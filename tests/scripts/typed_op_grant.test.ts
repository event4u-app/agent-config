/**
 * `T9` — a typed op reaches an exact-object ask after the council check, and a
 * council verdict alone never produces the grant.
 * `road-to-adversarial-verification-and-long-runs` 7.3.
 *
 * The asymmetry is the design: the council may subtract and never add. Every
 * case below drives the direction the implementation could plausibly have gone
 * wrong — a clearance read as a grant, a veto overridden by a later yes, an
 * unavailable council read as a veto, and a category accepted as an object.
 *
 * The exactness, verb and turn blocks are the four holes an independent pass
 * found on 2026-09-14: a punctuation run and a category both granting, a blank
 * verb granting, and a confirmation that could not say which turn it came from.
 * Each was observed red against the pre-fix module before its fix landed.
 */

import { describe, expect, it } from 'vitest';

import {
    grantFor,
    objectIsExact,
    verdictAloneGrants,
    type CouncilVerdict,
    type ExactObjectAsk,
} from '../../src/scripts/_lib/typed_op_grant.js';

const TURN = 'turn-42';

const ask = (over: Partial<ExactObjectAsk> = {}): ExactObjectAsk => ({
    op: 'force-push',
    object: 'drain/adversarial-verification @ 0e100f17c',
    confirmed: true,
    confirmed_turn: TURN,
    ...over,
});

const ALL_VERDICTS: CouncilVerdict[] = ['in-mission', 'out-of-mission', 'unavailable', null];

describe('the council may veto, never grant', () => {
    it.each(ALL_VERDICTS)('no verdict alone grants (%s)', (v) => {
        expect(verdictAloneGrants(v)).toBe(false);
    });

    it('a clearance is NOT a grant — the ask still has to happen', () => {
        const d = grantFor('in-mission', ask({ confirmed: false }), TURN);
        expect(d.state).toBe('ask-required');
        expect(d.reason).toMatch(/which is not a grant/);
    });

    it('a veto is not overridden by a later confirmation', () => {
        // An advisory veto is not a veto. This is the direction a naive
        // "confirmed wins" implementation gets wrong.
        expect(grantFor('out-of-mission', ask({ confirmed: true }), TURN).state).toBe('vetoed');
    });

    it('an UNAVAILABLE council does not block the op', () => {
        // The council is a filter; its absence removes a filter. Treating
        // unavailability as a veto makes an unconfigured council a silent kill
        // switch on every typed op.
        expect(grantFor('unavailable', ask(), TURN).state).toBe('granted');
        expect(grantFor(null, ask(), TURN).state).toBe('granted');
    });
});

describe('the ask names the exact object', () => {
    it('a confirmed ask with a concrete object grants', () => {
        expect(grantFor('in-mission', ask(), TURN).state).toBe('granted');
    });

    it.each(['branches', 'the branch', 'everything', 'it'])(
        'a CATEGORY (%s) is not an object and does not grant',
        (object) => {
            const d = grantFor('in-mission', ask({ object }), TURN);
            expect(d.state).toBe('ask-required');
            expect(d.reason).toMatch(/category rather than an object/);
        },
    );

    it.each(['!!!!!!!!', 'all-branches', 'category-1'])(
        'the length-and-punctuation heuristic used to accept %s — it no longer does',
        (object) => {
            // All three passed the old `length >= 8 && one non-letter` check, so
            // a Hard-Floor confirmation over any of them reached `granted`. The
            // first names nothing at all; the other two name a class rather than
            // a thing. Red against the pre-fix module.
            const d = grantFor('in-mission', ask({ object }), TURN);
            expect(d.state).toBe('ask-required');
            expect(d.reason).toMatch(/category rather than an object/);
        },
    );

    it('an object with no alphanumeric run is refused even for an UNDECLARED op', () => {
        // The universal floor, which is the tier that applies to every op. An op
        // with no declared shape keeps the looser heuristic, but nothing gets
        // past "names nothing at all".
        expect(objectIsExact('some-unknown-op', '!!!!!!!!')).toBe(false);
        expect(grantFor(null, ask({ op: 'some-unknown-op', object: '!!!!!!!!' }), TURN).state).toBe(
            'ask-required',
        );
    });

    it('an undeclared op still accepts an object the old heuristic accepted', () => {
        // Risk 1 in the other direction: refusing every undeclared op would make
        // its Hard-Floor ask unanswerable. This is the documented residual, and
        // it is asserted rather than left implicit.
        expect(objectIsExact('some-unknown-op', 'invoice-2026-09-14')).toBe(true);
    });

    it('an unconfirmed ask never grants, whatever the object says', () => {
        expect(grantFor('in-mission', ask({ confirmed: false }), TURN).state).toBe('ask-required');
    });

    it('T9 — the full sequence: council check, then exact-object ask, then execute', () => {
        const pending = ask({ confirmed: false });
        expect(grantFor('in-mission', pending, TURN).state).toBe('ask-required');
        expect(grantFor('in-mission', { ...pending, confirmed: true }, TURN).state).toBe('granted');
    });

    it('the granted reason names both the op and the object', () => {
        const d = grantFor('in-mission', ask(), TURN);
        expect(d.reason).toContain('force-push');
        expect(d.reason).toContain('drain/adversarial-verification @ 0e100f17c');
    });
});

describe('the per-op shape is what makes an object exact', () => {
    it('a push names a ref AND a commit — either alone is not the object', () => {
        expect(objectIsExact('force-push', 'drain/adversarial-verification @ 0e100f17c')).toBe(true);
        // The remote is optional: the shipped object above names none. What is
        // NOT optional is the pair.
        expect(objectIsExact('force-push', 'origin/drain/x-rest @ abc1234')).toBe(true);
        expect(objectIsExact('force-push', '0e100f17c')).toBe(false);
        expect(objectIsExact('force-push', 'drain/adversarial-verification')).toBe(false);
    });

    it('a send names a recipient AND a subject', () => {
        expect(objectIsExact('send', 'ops@example.com — Q3 invoice reminder')).toBe(true);
        expect(objectIsExact('send', 'ops@example.com')).toBe(false);
        expect(objectIsExact('send', 'the customers')).toBe(false);
    });

    it('a purchase names an amount AND a card suffix', () => {
        expect(objectIsExact('purchase', 'EUR 42.00 on card ending 4242')).toBe(true);
        expect(objectIsExact('purchase', 'EUR 42.00')).toBe(false);
        expect(objectIsExact('purchase', 'the annual subscription')).toBe(false);
    });

    it('the op is matched case-insensitively and untrimmed', () => {
        // A shape that could be dodged by capitalising the verb would not be one.
        expect(objectIsExact('  Force-Push ', 'all-branches')).toBe(false);
    });
});

describe('the ask names the verb, and a blank verb never grants', () => {
    it.each([
        ['empty', ''],
        ['spaces', '   '],
        ['a tab', '\t'],
    ])('an op that is %s does not grant', (_label, op) => {
        // The object says WHAT; the op says what is about to happen TO it. Before
        // the fix nothing validated the op at all, so a well-formed object with a
        // blank verb reached `granted` — the half of the sentence that separates
        // a push from a delete was the unchecked half.
        const d = grantFor('in-mission', ask({ op }), TURN);
        expect(d.state).toBe('ask-required');
        expect(d.reason).toMatch(/names no operation/);
    });

    it('the blank verb is refused before the object is even considered', () => {
        // Otherwise a blank verb with a bad object would report the object
        // problem and hide the verb one.
        const d = grantFor('in-mission', ask({ op: '', object: 'all-branches' }), TURN);
        expect(d.reason).toMatch(/names no operation/);
    });
});

describe('the confirmation has to be THIS turn', () => {
    it('a confirmation from a PRIOR turn does not grant', () => {
        // The replay-across-restart case: an ask persisted into a mission record
        // and read back after a restart carries `confirmed: true` from a turn
        // that is over. A bare boolean cannot tell the two apart.
        const d = grantFor('in-mission', ask({ confirmed_turn: 'turn-7' }), TURN);
        expect(d.state).toBe('ask-required');
        expect(d.reason).toMatch(/was given in turn turn-7, not this turn/);
    });

    it('a confirmation carrying no turn does not grant', () => {
        for (const confirmed_turn of ['', '   ']) {
            const d = grantFor('in-mission', ask({ confirmed_turn }), TURN);
            expect(d.state).toBe('ask-required');
            expect(d.reason).toMatch(/carries no turn/);
        }
    });

    it('a caller that cannot say what turn it is gets no grant either', () => {
        // Fail closed on the other side too: an empty `currentTurn` would
        // otherwise make every stale confirmation match.
        expect(grantFor('in-mission', ask({ confirmed_turn: '' }), '').state).toBe('ask-required');
    });

    it('the turn is compared exactly, not loosely', () => {
        expect(grantFor('in-mission', ask({ confirmed_turn: 'turn-420' }), 'turn-42').state).toBe(
            'ask-required',
        );
    });
});
