/**
 * Behavioural spec for the violation ratchet (`src/scripts/_lib/gate_baseline.ts`).
 *
 * The ratchet exists because repairing a dead scan root REVEALS pre-existing
 * debt, and both obvious responses are wrong: hard-failing turns `main` red on
 * debt the repair did not cause, and suppressing reproduces the green-on-nothing
 * failure the repair exists to end.
 *
 * Two properties carry the whole design and both are asserted below against
 * fixtures rather than described in prose:
 *
 *   1. It only turns one way — at-or-below passes, above fails.
 *   2. It EXPIRES. A baseline that never drops is suppression with extra steps,
 *      so a stale entry fails even though its count has not risen. That is the
 *      counter-intuitive case, and it is the one a future refactor is most
 *      likely to "simplify" away, so it gets the most explicit coverage.
 *
 * `today` is injected everywhere — a clock-dependent test that passes in
 * August and fails in October would be its own small version of this bug.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

import {
    BASELINE_REL,
    STALE_AFTER_DAYS,
    checkRatchet,
    loadBaselines,
} from '../../src/scripts/_lib/gate_baseline.js';

const REPO = path.resolve(new URL('.', import.meta.url).pathname, '..', '..');

const tmpDirs: string[] = [];
function mkRepo(gates: Record<string, unknown>): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ratchet-'));
    tmpDirs.push(root);
    fs.mkdirSync(path.join(root, 'src', 'config'), { recursive: true });
    fs.writeFileSync(path.join(root, BASELINE_REL), `${JSON.stringify({ gates }, null, 2)}\n`);
    return root;
}
afterAll(() => {
    for (const d of tmpDirs) fs.rmSync(d, { recursive: true, force: true });
});

const ENTRY = { count: 18, landed: '2026-08-02', note: 'tier-metadata backfill backlog' };

describe('gate_baseline — a gate with no recorded baseline', () => {
    it('passes on zero violations', () => {
        const v = checkRatchet({ gate: 'g', actual: 0, repoRoot: mkRepo({}), today: '2026-08-02' });
        expect(v.status).toBe('unbaselined');
        expect(v.ok).toBe(true);
    });

    it('fails on any violation — the ratchet must not weaken the default', () => {
        const v = checkRatchet({ gate: 'g', actual: 1, repoRoot: mkRepo({}), today: '2026-08-02' });
        expect(v.status).toBe('unbaselined');
        expect(v.ok).toBe(false);
        expect(v.message).toContain('no recorded baseline');
    });

    it('treats a missing baseline file as an empty ratchet, not an error', () => {
        const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'ratchet-none-'));
        tmpDirs.push(empty);
        expect(loadBaselines(empty).gates).toEqual({});
        expect(checkRatchet({ gate: 'g', actual: 0, repoRoot: empty, today: '2026-08-02' }).ok).toBe(true);
    });
});

describe('gate_baseline — the ratchet turns one way', () => {
    it('passes at exactly the baseline', () => {
        const v = checkRatchet({ gate: 'g', actual: 18, repoRoot: mkRepo({ g: ENTRY }), today: '2026-08-02' });
        expect(v.status).toBe('within');
        expect(v.ok).toBe(true);
        expect(v.message).toContain('known debt');
    });

    it('fails one over the baseline, and names how many are new', () => {
        const v = checkRatchet({ gate: 'g', actual: 19, repoRoot: mkRepo({ g: ENTRY }), today: '2026-08-02' });
        expect(v.status).toBe('regressed');
        expect(v.ok).toBe(false);
        expect(v.message).toContain('1 new');
    });

    it('refuses to present raising the baseline as a fix', () => {
        const v = checkRatchet({ gate: 'g', actual: 25, repoRoot: mkRepo({ g: ENTRY }), today: '2026-08-02' });
        expect(v.message).toMatch(/Raising the baseline .* is a defect, not a fix/);
    });

    it('passes under the baseline but asks for it to be tightened', () => {
        const v = checkRatchet({ gate: 'g', actual: 4, repoRoot: mkRepo({ g: ENTRY }), today: '2026-08-02' });
        expect(v.status).toBe('improved');
        expect(v.ok).toBe(true);
        expect(v.message).toContain('Lower it to 4');
    });
});

describe('gate_baseline — expiry is what separates a ratchet from an allowlist', () => {
    const dayAfter = (iso: string, days: number): string =>
        new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

    it('still passes on the last day of the window', () => {
        const v = checkRatchet({
            gate: 'g',
            actual: 18,
            repoRoot: mkRepo({ g: ENTRY }),
            today: dayAfter(ENTRY.landed, STALE_AFTER_DAYS),
        });
        expect(v.ageDays).toBe(STALE_AFTER_DAYS);
        expect(v.status).toBe('within');
        expect(v.ok).toBe(true);
    });

    it('fails the day after, even though nothing regressed', () => {
        const v = checkRatchet({
            gate: 'g',
            actual: 18,
            repoRoot: mkRepo({ g: ENTRY }),
            today: dayAfter(ENTRY.landed, STALE_AFTER_DAYS + 1),
        });
        expect(v.status).toBe('stale');
        expect(v.ok).toBe(false);
        expect(v.message).toContain('suppression with extra steps');
        expect(v.message).toContain(ENTRY.note);
    });

    it('lowering the count clears the expiry regardless of age — real progress, not paperwork', () => {
        const v = checkRatchet({
            gate: 'g',
            actual: 17,
            repoRoot: mkRepo({ g: ENTRY }),
            today: dayAfter(ENTRY.landed, STALE_AFTER_DAYS + 400),
        });
        expect(v.status).toBe('improved');
        expect(v.ok).toBe(true);
    });

    it('a reaffirmed block resets the clock, and the reason it demands lands in the diff', () => {
        const reaffirmed = { ...ENTRY, reaffirmed: { date: '2026-09-20', reason: 'blocked on the tier backfill' } };
        const v = checkRatchet({
            gate: 'g',
            actual: 18,
            repoRoot: mkRepo({ g: reaffirmed }),
            today: '2026-09-25',
        });
        expect(v.status).toBe('within');
        expect(v.ageDays).toBe(5);
    });
});

describe('gate_baseline — the shipped baseline file', () => {
    it('parses, and every entry carries a dated, explained debt', () => {
        const shipped = loadBaselines(REPO);
        for (const [gate, entry] of Object.entries(shipped.gates)) {
            expect(Number.isInteger(entry.count), gate).toBe(true);
            expect(entry.count, gate).toBeGreaterThan(0);
            expect(entry.landed, gate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
            // A bare number with no explanation is the allowlist this file refuses to be.
            expect((entry.note ?? '').length, gate).toBeGreaterThan(40);
            if (entry.reaffirmed) {
                expect(entry.reaffirmed.date, gate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
                expect((entry.reaffirmed.reason ?? '').length, gate).toBeGreaterThan(10);
            }
        }
    });
});
