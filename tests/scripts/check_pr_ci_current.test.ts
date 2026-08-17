/**
 * Is the open PR's CI verdict about the code actually on the branch?
 *
 * Every case is anchored to something measured on one run (2026-08-17, PR #1391):
 * a fix committed locally while the PR still carried the failure, a green run
 * that had executed against the pre-fix commit, and a branch behind its OWN
 * remote counterpart because *Update branch* was pressed on the PR. None of the
 * three is visible from a green local gate, which is why this exists.
 *
 * `decide` is pure over gathered facts, so the whole verdict table is testable
 * without a network or a forge — the alternative would be a gate whose only
 * proof is that it happened to pass once against a live PR.
 */

import { describe, expect, it } from 'vitest';

import { decide, main, type Facts } from '../../src/scripts/check_pr_ci_current.js';

const SHA_A = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const SHA_B = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

function facts(over: Partial<Facts> = {}): Facts {
    return {
        pr: 1391,
        prHead: SHA_A,
        localHead: SHA_A,
        checksHead: SHA_A,
        rows: [{ state: 'SUCCESS', name: 'Consistency' }],
        unobservable: null,
        relation: 'equal',
        ...over,
    };
}

describe('the green path', () => {
    it('passes when the PR head, the local head and the checks head all agree', () => {
        const v = decide(facts());
        expect(v.exit).toBe(0);
        expect(v.message).toMatch(/green on its own head/);
    });

    it('treats SKIPPED and NEUTRAL as non-failures', () => {
        const v = decide(
            facts({
                rows: [
                    { state: 'SUCCESS', name: 'a' },
                    { state: 'SKIPPED', name: 'b' },
                    { state: 'NEUTRAL', name: 'c' },
                ],
            }),
        );
        expect(v.exit).toBe(0);
        expect(v.scanned).toBe(3);
    });
});

describe('the three measured failure modes', () => {
    it('blocks unpushed local work AFTER a push — the PR does not contain the fix', () => {
        const v = decide(facts({ localHead: SHA_B, relation: 'ahead' }));
        expect(v.exit).toBe(1);
        expect(v.message).toMatch(/does NOT contain what is committed here/);
    });

    it('but the SAME state passes in --pre-push mode, or it would refuse every push', () => {
        // The chicken-and-egg this mode resolves: before a push, local ahead of the
        // PR head is the normal state of every branch carrying work. A gate that
        // called that a defect would block every push there is.
        const v = decide(facts({ localHead: SHA_B, relation: 'ahead' }), { prePush: true });
        expect(v.exit).toBe(0);
        expect(v.message).toMatch(/normal state before a/);
    });

    it('blocks a STALE green — the sharpest case, because it reads as SUCCESS', () => {
        const v = decide(facts({ checksHead: SHA_B }));
        expect(v.exit).toBe(1);
        expect(v.message).toMatch(/STALE VERDICT/);
        // The row set is all-SUCCESS; only the SHA comparison separates this from
        // a pass, so a gate that skipped it would report green here.
        expect(facts({ checksHead: SHA_B }).rows.every((r) => r.state === 'SUCCESS')).toBe(true);
    });

    it('blocks a foreign PR head in BOTH modes — Update branch was pressed', () => {
        // Opposite direction, opposite correct action: this one needs a merge, not
        // a push, so --pre-push must NOT tolerate it. An equality test would have
        // collapsed the two into one indistinguishable mismatch.
        for (const rel of ['behind', 'diverged'] as const) {
            for (const prePush of [false, true]) {
                const v = decide(facts({ prHead: SHA_B, checksHead: SHA_B, relation: rel }), { prePush });
                expect(v.exit, `${rel}/${String(prePush)}`).toBe(1);
                expect(v.message).toMatch(/never force over it/);
            }
        }
    });
});

describe('absence is never a pass', () => {
    it('blocks when the PR reports no checks at all', () => {
        const v = decide(facts({ rows: [] }));
        expect(v.exit).toBe(1);
        expect(v.message).toMatch(/no checks at all/);
    });

    it('blocks while checks are still running — pending is a reason to wait', () => {
        for (const state of ['PENDING', 'QUEUED', 'IN_PROGRESS']) {
            const v = decide(facts({ rows: [{ state, name: 'Consistency' }] }));
            expect(v.exit, state).toBe(1);
            expect(v.message).toMatch(/still running/);
        }
    });

    it('blocks on a red check on the current head, naming it', () => {
        const v = decide(facts({ rows: [{ state: 'FAILURE', name: 'Consistency' }] }));
        expect(v.exit).toBe(1);
        expect(v.message).toMatch(/RED on its current head.*FAILURE Consistency/);
    });
});

describe('degrade rather than block', () => {
    it('exits 0 when nothing could be observed, and says it is unverified', () => {
        const v = decide(facts({ unobservable: 'gh could not be reached' }));
        expect(v.exit).toBe(0);
        // Load-bearing: the caller distinguishes a pass from a degrade on this
        // prefix, and the CLI keeps the line loud even under --quiet.
        expect(v.message.startsWith('unverified')).toBe(true);
        expect(v.scanned).toBe(0);
    });

    it('exits 0 with no open PR — there is no remote verdict to be current with', () => {
        const v = decide(facts({ pr: null }));
        expect(v.exit).toBe(0);
        expect(v.message).toMatch(/no open PR/);
    });

    it('unobservable outranks every other fact, so a half-read state cannot block', () => {
        const v = decide(facts({ unobservable: 'timeout', localHead: SHA_B, rows: [], relation: 'diverged' }));
        expect(v.exit).toBe(0);
    });
});

describe('CLI', () => {
    it('refuses --repo with no value rather than scanning the wrong tree', () => {
        expect(main(['--repo'])).toBe(1);
        expect(main(['--repo', '--quiet'])).toBe(1);
    });

    it('rejects an unknown argument', () => {
        expect(main(['--nope'])).toBe(1);
    });

    it('--help exits 0', () => {
        expect(main(['--help'])).toBe(0);
    });
});
