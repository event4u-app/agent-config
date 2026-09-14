/**
 * `T9` — a typed op reaches an exact-object ask after the council check, and a
 * council verdict alone never produces the grant.
 * `road-to-adversarial-verification-and-long-runs` 7.3.
 *
 * The asymmetry is the design: the council may subtract and never add. Every
 * case below drives the direction the implementation could plausibly have gone
 * wrong — a clearance read as a grant, a veto overridden by a later yes, an
 * unavailable council read as a veto, and a category accepted as an object.
 */

import { describe, expect, it } from 'vitest';

import {
    grantFor,
    verdictAloneGrants,
    type CouncilVerdict,
    type ExactObjectAsk,
} from '../../src/scripts/_lib/typed_op_grant.js';

const ask = (over: Partial<ExactObjectAsk> = {}): ExactObjectAsk => ({
    op: 'force-push',
    object: 'drain/adversarial-verification @ 0e100f17c',
    confirmed: true,
    ...over,
});

const ALL_VERDICTS: CouncilVerdict[] = ['in-mission', 'out-of-mission', 'unavailable', null];

describe('the council may veto, never grant', () => {
    it.each(ALL_VERDICTS)('no verdict alone grants (%s)', (v) => {
        expect(verdictAloneGrants(v)).toBe(false);
    });

    it('a clearance is NOT a grant — the ask still has to happen', () => {
        const d = grantFor('in-mission', ask({ confirmed: false }));
        expect(d.state).toBe('ask-required');
        expect(d.reason).toMatch(/which is not a grant/);
    });

    it('a veto is not overridden by a later confirmation', () => {
        // An advisory veto is not a veto. This is the direction a naive
        // "confirmed wins" implementation gets wrong.
        expect(grantFor('out-of-mission', ask({ confirmed: true })).state).toBe('vetoed');
    });

    it('an UNAVAILABLE council does not block the op', () => {
        // The council is a filter; its absence removes a filter. Treating
        // unavailability as a veto makes an unconfigured council a silent kill
        // switch on every typed op.
        expect(grantFor('unavailable', ask()).state).toBe('granted');
        expect(grantFor(null, ask()).state).toBe('granted');
    });
});

describe('the ask names the exact object', () => {
    it('a confirmed ask with a concrete object grants', () => {
        expect(grantFor('in-mission', ask()).state).toBe('granted');
    });

    it.each(['branches', 'the branch', 'everything', 'it'])(
        'a CATEGORY (%s) is not an object and does not grant',
        (object) => {
            const d = grantFor('in-mission', ask({ object }));
            expect(d.state).toBe('ask-required');
            expect(d.reason).toMatch(/category rather than an object/);
        },
    );

    it('an unconfirmed ask never grants, whatever the object says', () => {
        expect(grantFor('in-mission', ask({ confirmed: false })).state).toBe('ask-required');
    });

    it('T9 — the full sequence: council check, then exact-object ask, then execute', () => {
        const pending = ask({ confirmed: false });
        expect(grantFor('in-mission', pending).state).toBe('ask-required');
        expect(grantFor('in-mission', { ...pending, confirmed: true }).state).toBe('granted');
    });

    it('the granted reason names both the op and the object', () => {
        const d = grantFor('in-mission', ask());
        expect(d.reason).toContain('force-push');
        expect(d.reason).toContain('drain/adversarial-verification @ 0e100f17c');
    });
});
