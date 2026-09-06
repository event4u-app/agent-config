// Tests for src/scripts/check_beta_review_markers.ts (py2ts Phase 4 / Wave 4c).
//
// No pytest suite exists for this module, so this is a focused differential
// suite over check_one() (the per-file marker logic + the 90-day window)
// plus a golden-parity layer that runs python3 vs tsx on the REAL REPO
// (skipped without python3). The date-window arithmetic is exercised against
// a fixed "today" ordinal so the test is stable across calendar days.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as bm from '../../src/scripts/check_beta_review_markers.js';



function write(p: string, content: string): void {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content, 'utf-8');
}

// 2026-01-01 as a UTC epoch-day ordinal (the units check_one() compares in).
const TODAY = Math.floor(Date.UTC(2026, 0, 1) / 86400000);

describe('check_beta_review_markers — behavioural spec', () => {
    let tmp: string;
    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-'));
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    it('non-beta contract is ignored', () => {
        const p = path.join(tmp, 'c.md');
        write(p, '---\nstability: stable\n---\n');
        expect(bm.check_one(p, TODAY)).toEqual([]);
    });

    it('beta with no marker is an error', () => {
        const p = path.join(tmp, 'c.md');
        write(p, '---\nstability: beta\n---\n');
        const v = bm.check_one(p, TODAY);
        expect(v).toHaveLength(1);
        expect(v[0]!.severity).toBe('error');
        expect(v[0]!.reason).toContain('no review marker');
    });

    it('beta with exactly one promote-to marker is clean', () => {
        const p = path.join(tmp, 'c.md');
        write(p, '---\nstability: beta\npromote-to: stable\n---\n');
        expect(bm.check_one(p, TODAY)).toEqual([]);
    });

    it('beta with two markers is an error', () => {
        const p = path.join(tmp, 'c.md');
        write(p, '---\nstability: beta\npromote-to: stable\nsuperseded-by: other\n---\n');
        const v = bm.check_one(p, TODAY);
        expect(v).toHaveLength(1);
        expect(v[0]!.reason).toContain('multiple beta-review markers set');
    });

    it('keep-beta-until within 90 days is clean', () => {
        const p = path.join(tmp, 'c.md');
        // 2026-01-01 + 90 days = 2026-04-01 exactly → allowed.
        write(p, '---\nstability: beta\nkeep-beta-until: 2026-04-01\n---\n');
        expect(bm.check_one(p, TODAY)).toEqual([]);
    });

    it('keep-beta-until past the 90-day window is an error', () => {
        const p = path.join(tmp, 'c.md');
        write(p, '---\nstability: beta\nkeep-beta-until: 2026-04-02\n---\n');
        const v = bm.check_one(p, TODAY);
        expect(v).toHaveLength(1);
        expect(v[0]!.reason).toContain('exceeds the 90-day window');
        expect(v[0]!.reason).toContain('max: 2026-04-01');
    });

    // --- The LOWER bound (road-to-contract-review-deadlines Phase 1.1) ------
    //
    // Until 2026-08-25 the gate compared keep-beta-until only against
    // today + 90 and errored when the date was too far in the FUTURE. A date
    // arbitrarily far in the PAST passed, so the gate reported every one of the
    // 86 lapsed contracts as clean. These cases pin the floor.

    it('a keep-beta-until in the PAST is reported', () => {
        const p = path.join(tmp, 'c.md');
        // TODAY is 2026-01-01; this is one day before it.
        write(p, '---\nstability: beta\nkeep-beta-until: 2025-12-31\n---\n');
        const v = bm.check_one(p, TODAY);
        expect(v).toHaveLength(1);
        expect(v[0]!.reason).toContain('has LAPSED');
        expect(v[0]!.reason).toContain('2025-12-31');
    });

    it('the lapsed finding names the age in days, not just the fact', () => {
        const p = path.join(tmp, 'c.md');
        write(p, '---\nstability: beta\nkeep-beta-until: 2025-12-22\n---\n');
        const v = bm.check_one(p, TODAY);
        // 2025-12-22 -> 2026-01-01 is 10 days. The age is what tells a reader
        // whether they are looking at a fresh miss or a year-old one.
        expect(v[0]!.reason).toContain('10 day(s) ago');
    });

    it('a lapse OUTSIDE the frozen baseline is an ERROR', () => {
        const p = path.join(tmp, 'c.md');
        write(p, '---\nstability: beta\nkeep-beta-until: 2025-12-31\n---\n');
        const v = bm.check_one(p, TODAY)[0]!;
        // A tmp fixture is by construction not one of the 86 inherited
        // contracts, so it is a FRESH lapse and must fail. This assertion is the
        // ratchet: without it the baseline file is a plain allowlist.
        //
        // It replaced an earlier assertion that pinned `warning`
        // unconditionally, which was correct while the gate shipped flat-report
        // and became wrong the moment step 0.2 chose the ratchet. It is recorded
        // rather than quietly swapped because the test caught its own
        // obsolescence — which is what it was for.
        expect(v.severity).toBe('error');
        expect(v.reason).toContain('FRESH lapse');
    });

    it('today itself is NOT lapsed — the boundary is exclusive', () => {
        const p = path.join(tmp, 'c.md');
        // A deadline of today has not passed. An off-by-one here would report
        // every contract on the morning its window closes.
        write(p, '---\nstability: beta\nkeep-beta-until: 2026-01-01\n---\n');
        expect(bm.check_one(p, TODAY)).toEqual([]);
    });

    it('a date inside the window is still clean after the floor was added', () => {
        const p = path.join(tmp, 'c.md');
        write(p, '---\nstability: beta\nkeep-beta-until: 2026-02-01\n---\n');
        expect(bm.check_one(p, TODAY)).toEqual([]);
    });
});

// --- The no-growth baseline ratchet (Phase 0.2, AI council 2/2) -------------
//
// The decision was neither "report" nor "fail" but a ratchet: the 86 contracts
// already lapsed on 2026-08-25 WARN as inherited debt, and any lapsed contract
// outside that frozen list is an ERROR. These cases pin the half that does the
// work — a baseline that cannot grow. Without the fresh-lapse error the file is
// just an allowlist, and an allowlist that only ever absorbs new entries is the
// permanent exception registry one seat warned it could become.
describe('lapsed-beta baseline ratchet', () => {
    const REAL = 'docs/contracts/some-inherited-contract.md';
    const FRESH = 'docs/contracts/a-brand-new-contract.md';
    let root: string;

    beforeEach(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'lapsed-baseline-'));
        fs.mkdirSync(path.join(root, 'src', 'config'), { recursive: true });
        fs.writeFileSync(
            path.join(root, 'src', 'config', 'lapsed-beta-baseline.json'),
            JSON.stringify({ schema_version: 'lapsed-beta-baseline-v1', contracts: [REAL] }),
        );
        bm._resetLapsedBaseline();
    });

    afterEach(() => {
        fs.rmSync(root, { recursive: true, force: true });
        bm._resetLapsedBaseline();
    });

    it('loads the frozen list', () => {
        expect(bm.loadLapsedBaseline(root).has(REAL)).toBe(true);
        expect(bm.loadLapsedBaseline(root).has(FRESH)).toBe(false);
    });

    it('an ABSENT baseline file means no inherited debt, not everything inherited', () => {
        // The file is DELETED in the same change that flips the severity, so
        // absent is the success state. Defaulting the other way would silence
        // the gate permanently at the exact moment it should start biting.
        const bare = fs.mkdtempSync(path.join(os.tmpdir(), 'lapsed-none-'));
        bm._resetLapsedBaseline();
        expect(bm.loadLapsedBaseline(bare).size).toBe(0);
        fs.rmSync(bare, { recursive: true, force: true });
        bm._resetLapsedBaseline();
    });
});

// --- Golden parity on the REAL REPO -----------------------------------------


// --- Upcoming-lapse horizon + the inherited/fresh binding --------------------
//
// The horizon exists because the gate otherwise reports a contract on the day
// it lapses, which is the day it is already too late. These cases pin the two
// properties that make the report worth printing: it names a contract that is
// about to enter the ERROR branch, and it names NO contract already carrying
// the inherited warning.
//
// The baseline-exclusion case is deliberately impossible in the real tree — a
// baselined contract is already lapsed, so it cannot also be forward-dated.
// That is exactly why it is tested: without it the guard is indistinguishable
// from no guard at all, and a vacuous guard silently stops holding the first
// time a baseline entry is re-dated forward.
describe('upcoming-lapse horizon', () => {
    let root: string;
    const CONTRACTS = 'docs/contracts';

    function contract(name: string, body: string): string {
        const p = path.join(root, CONTRACTS, name);
        write(p, body);
        return p;
    }

    function baseline(entries: readonly string[]): void {
        write(
            path.join(root, 'src', 'config', 'lapsed-beta-baseline.json'),
            JSON.stringify({ schema_version: 'lapsed-beta-baseline-v1', contracts: entries }),
        );
        bm._resetLapsedBaseline();
    }

    beforeEach(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'beta-horizon-'));
        bm._resetLapsedBaseline();
    });
    afterEach(() => {
        fs.rmSync(root, { recursive: true, force: true });
        bm._resetLapsedBaseline();
    });

    it('names a fresh contract whose window closes inside the horizon', () => {
        baseline([]);
        const p = contract('soon.md', '---\nstability: beta\nkeep-beta-until: 2026-01-08\n---\n');
        const u = bm.upcoming_one(p, TODAY, 14, root);
        expect(u).not.toBeNull();
        expect(u!.file).toBe('docs/contracts/soon.md');
        expect(u!.daysOut).toBe(7);
    });

    it('does NOT name a contract that is in the frozen baseline', () => {
        const rel = 'docs/contracts/baselined.md';
        baseline([rel]);
        const p = contract(
            'baselined.md',
            '---\nstability: beta\nkeep-beta-until: 2026-01-08\n---\n',
        );
        // Same date, same horizon, same everything as the case above — only
        // baseline membership differs, so a null here is the guard firing.
        expect(bm.upcoming_one(p, TODAY, 14, root)).toBeNull();
    });

    it('does NOT name a contract beyond the horizon', () => {
        baseline([]);
        const p = contract('later.md', '---\nstability: beta\nkeep-beta-until: 2026-03-01\n---\n');
        expect(bm.upcoming_one(p, TODAY, 14, root)).toBeNull();
    });

    it('does NOT name an already-lapsed contract — that is the violation branch', () => {
        baseline([]);
        const p = contract('past.md', '---\nstability: beta\nkeep-beta-until: 2025-12-01\n---\n');
        expect(bm.upcoming_one(p, TODAY, 14, root)).toBeNull();
    });

    it('does NOT name a non-beta contract', () => {
        baseline([]);
        const p = contract(
            'stable.md',
            '---\nstability: stable\nkeep-beta-until: 2026-01-08\n---\n',
        );
        expect(bm.upcoming_one(p, TODAY, 14, root)).toBeNull();
    });

    it('a horizon of 0 names nothing', () => {
        baseline([]);
        const p = contract('soon.md', '---\nstability: beta\nkeep-beta-until: 2026-01-08\n---\n');
        expect(bm.upcoming_one(p, TODAY, 0, root)).toBeNull();
    });
});

// The label and the severity are one fact printed twice. A run that says
// `inherited` while erroring, or `FRESH` while warning, would be worse than
// printing neither — so these cases move a single contract across the baseline
// boundary and assert BOTH move together. Without this, the label is prose.
describe('inherited/fresh label moves with the exit-code severity', () => {
    let root: string;
    const REL = 'docs/contracts/moving.md';

    function setup(entries: readonly string[]): string {
        const p = path.join(root, REL);
        write(p, '---\nstability: beta\nkeep-beta-until: 2025-12-01\n---\n');
        write(
            path.join(root, 'src', 'config', 'lapsed-beta-baseline.json'),
            JSON.stringify({ schema_version: 'lapsed-beta-baseline-v1', contracts: entries }),
        );
        bm._resetLapsedBaseline();
        return p;
    }

    beforeEach(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'beta-label-'));
        bm._resetLapsedBaseline();
    });
    afterEach(() => {
        fs.rmSync(root, { recursive: true, force: true });
        bm._resetLapsedBaseline();
    });

    it('in the baseline: label says inherited AND severity is warning', () => {
        const p = setup([REL]);
        const v = bm.check_one(p, TODAY, root);
        expect(v).toHaveLength(1);
        expect(v[0]!.reason).toContain('inherited');
        expect(v[0]!.reason).not.toContain('FRESH');
        expect(v[0]!.severity).toBe('warning');
    });

    it('out of the baseline: label says FRESH AND severity is error', () => {
        const p = setup([]);
        const v = bm.check_one(p, TODAY, root);
        expect(v).toHaveLength(1);
        expect(v[0]!.reason).toContain('FRESH');
        expect(v[0]!.reason).not.toContain('inherited');
        expect(v[0]!.severity).toBe('error');
    });

    it('deleting the baseline file turns every inherited warning into an error', () => {
        // AC-3's second half: the baseline is load-bearing, and removing it is
        // not a silent pass. Sensitivity check — the assertion above would also
        // hold if `loadLapsedBaseline` defaulted everything to fresh, so this
        // case starts from the green state and removes only the file.
        const p = setup([REL]);
        expect(bm.check_one(p, TODAY, root)[0]!.severity).toBe('warning');
        fs.rmSync(path.join(root, 'src', 'config', 'lapsed-beta-baseline.json'));
        bm._resetLapsedBaseline();
        expect(bm.check_one(p, TODAY, root)[0]!.severity).toBe('error');
    });
});
