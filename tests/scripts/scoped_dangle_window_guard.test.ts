// Phase 4 Step 1 — guard the instrument before reading any count.
//
// road-to-skill-link-integrity-and-manifest-sync. The measurement this guards
// is "do agents actually follow a link to a skill that `projection.mode: scoped`
// prunes?" An unguarded count returns zero and closes the question as harmless,
// but zero is what a STOPPED CLOCK returns too — and the clock is stopped: the
// store is gitignored and machine-local (absent in any fresh checkout or
// worktree) and in the parent checkout it holds 181 records that all carry the
// same timestamp from one session on 2026-05-15.
//
// AC-6: the measurement cannot report a null while its instrument is dead or
// absent, and the guard is tested in BOTH directions.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    DANGLE_WINDOW_DAYS,
    FOLLOW_KINDS,
    instrument_verdict,
    scoped_dangle_follow_rate,
} from '../../src/scripts/lint_handoffs.js';

const REPO = path.resolve(import.meta.dirname, '..', '..');
const NOW = new Date('2026-08-23T12:00:00Z');

let tmp: string;
let store: string;

beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'sdwg-'));
    store = path.join(tmp, 'skill-usage.jsonl');
});
afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

function rows(entries: Array<{ ts: string; kind: string; slug: string }>): void {
    fs.writeFileSync(store, entries.map((e) => JSON.stringify(e)).join('\n') + '\n', 'utf-8');
}

describe('scoped-dangle instrument guard', () => {
    it('is dead on a MISSING file', () => {
        const v = instrument_verdict(path.join(tmp, 'nope.jsonl'), NOW);
        expect(v.instrument_live).toBe(false);
        expect(v.reason).toContain('instrument absent');
        expect(v.records).toBe(0);
    });

    it('is dead when the newest record predates the window', () => {
        // The real shape: one session, one timestamp, 100 days before NOW.
        rows([{ ts: '2026-05-15T13:44:17.594Z', kind: 'exposure', slug: 'humanizer' }]);
        const v = instrument_verdict(store, NOW);
        expect(v.instrument_live).toBe(false);
        expect(v.reason).toContain('instrument dead');
        expect(v.reason).toContain('99 days old');
        expect(v.records).toBe(1);
        expect(v.newest).toBe('2026-05-15T13:44:17.594Z');
    });

    it('is dead when every record has an unparseable timestamp', () => {
        fs.writeFileSync(store, '{"ts":"not-a-date","kind":"read","slug":"humanizer"}\n', 'utf-8');
        const v = instrument_verdict(store, NOW);
        expect(v.instrument_live).toBe(false);
        expect(v.reason).toContain('no parseable timestamp');
    });

    it('is live with one record inside the window, and reports the kinds it saw', () => {
        rows([
            { ts: '2026-08-22T09:00:00Z', kind: 'exposure', slug: 'humanizer' },
            { ts: '2026-05-15T13:44:17.594Z', kind: 'exposure', slug: 'canvas-design' },
        ]);
        const v = instrument_verdict(store, NOW);
        expect(v.instrument_live).toBe(true);
        expect(v.reason).toBe('');
        expect(v.records).toBe(2);
        expect(v.kinds).toEqual(['exposure']);
    });

    it('the window boundary is DANGLE_WINDOW_DAYS back, inclusive', () => {
        const edge = new Date(NOW.getTime() - DANGLE_WINDOW_DAYS * 86_400_000 + 1000);
        rows([{ ts: edge.toISOString(), kind: 'exposure', slug: 'humanizer' }]);
        expect(instrument_verdict(store, NOW).instrument_live).toBe(true);
        const past = new Date(NOW.getTime() - DANGLE_WINDOW_DAYS * 86_400_000 - 1000);
        rows([{ ts: past.toISOString(), kind: 'exposure', slug: 'humanizer' }]);
        expect(instrument_verdict(store, NOW).instrument_live).toBe(false);
    });
});

describe('scoped-dangle follow rate — attempts is null, never 0, on a dead instrument', () => {
    it('a dead instrument yields null attempts and a stated reason', () => {
        rows([{ ts: '2026-05-15T13:44:17.594Z', kind: 'exposure', slug: 'humanizer' }]);
        const r = scoped_dangle_follow_rate(
            path.join(REPO, 'src', 'skills'),
            REPO,
            store,
            'testsha',
            NOW,
        );
        expect(r.instrument_live).toBe(false);
        // The load-bearing assertion: NOT 0. A 0 here would be the false null.
        expect(r.attempts).toBeNull();
        expect(r.pruned_targets_hit).toBeNull();
        expect(r.instrument_reason).toContain('instrument dead');
        expect(r.null_branch).toContain('closes nothing');
        // The census half is still real regardless of the instrument.
        expect(r.scoped_dangles).toBe(24);
        expect(r.survivors_with_dangle).toBe(17);
    });

    it('a live instrument counts only FOLLOW_KINDS against a pruned slug', () => {
        const inWindow = '2026-08-22T09:00:00Z';
        rows([
            // pruned target + a follow kind → counts
            { ts: inWindow, kind: 'read', slug: 'humanizer' },
            // pruned target + exposure → does NOT count (exposure is not a follow)
            { ts: inWindow, kind: 'exposure', slug: 'humanizer' },
            // a follow kind against a SURVIVING skill → does not count
            { ts: inWindow, kind: 'read', slug: 'readme-writing' },
            // in a follow kind but outside the window → does not count
            { ts: '2026-05-15T13:44:17.594Z', kind: 'read', slug: 'canvas-design' },
        ]);
        const r = scoped_dangle_follow_rate(
            path.join(REPO, 'src', 'skills'),
            REPO,
            store,
            'testsha',
            NOW,
        );
        expect(r.instrument_live).toBe(true);
        expect(r.attempts).toBe(1);
        expect(r.pruned_targets_hit).toEqual(['humanizer']);
    });

    // Why the measurement is blocked even with a live clock.
    it('no follow event is emitted anywhere in the tree', () => {
        expect([...FOLLOW_KINDS].sort()).toEqual(['follow', 'read', 'read_attempt']);
        const committed = fs.readFileSync(
            path.join(REPO, 'agents', 'evidence', 'metrics', 'scoped-dangle-follow-rate.json'),
            'utf-8',
        );
        const row = JSON.parse(committed) as { instrument_kinds: string[]; attempts: number | null };
        // Whatever the committed row records, it must never claim a measured 0
        // while carrying a dead instrument.
        expect(row.attempts).toBeNull();
    });
});
