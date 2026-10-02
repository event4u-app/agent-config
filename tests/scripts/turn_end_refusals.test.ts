/**
 * Turn-end refusal accounting — `road-to-stop-gate-honesty` Phase 1, asserted.
 *
 * The cases are the roadmap's own `verify:` lines and its Risk Register, not a
 * happy-path smoke test: per-detector counting that does NOT pool (step 1.1),
 * a TTL that keeps the fresh and drops the aged (step 1.2), a version split that
 * can say "unrecorded" rather than guessing (step 1.3), and — the one that
 * matters most — the denominator the reader must refuse to inflate.
 *
 * Two of these are mutation-verified in the sense the estate asks for: the
 * multi-detector case FAILS against the pre-change writer (which stored
 * `findings[0]` only), and the legacy-record case FAILS against a reader that
 * requires a `counts` block.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    DETECTOR_IDS,
    DISPATCH_CENSORED_DETECTORS,
    REFUSAL_STATE_MAX_AGE_DAYS,
    SHADOW_LAYERS,
    collectRefusalStats,
    collectShadowStats,
    countsOf,
    retryConditionedShare,
    deriveSessionKey,
    emptyCounts,
    foldRefusal,
    parseRecord,
    pruneAgedRefusalState,
    readSessionCounts,
    refusalStateDir,
    sessionRefusalFile,
    sessionShadowFile,
    shadowSetBy,
    foldShadow,
    parseShadowRecord,
    type RefusalRecord,
} from '../../src/scripts/_lib/turn_end_refusals.js';

let root: string;

function writeRecord(sessionId: string, rec: Record<string, unknown>): string {
    const file = sessionRefusalFile(root, deriveSessionKey(sessionId));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${JSON.stringify(rec, null, 2)}\n`);
    return file;
}

function daysAgo(n: number): string {
    return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
}

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'turn-end-refusals-'));
});

afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

describe('the record shape', () => {
    it('parses the legacy three-field record the field already holds', () => {
        // 36 of these existed on the maintainer machine when counting shipped.
        // A reader that rejects them throws away the only field evidence there is.
        const rec = parseRecord(
            JSON.stringify({
                refused_at: '2026-08-13T14:43:18.801Z',
                refused_turn: 14,
                detector: 'language',
            }),
        );
        expect(rec).not.toBeNull();
        expect(countsOf(rec!)).toEqual({ ...emptyCounts(), language: 1 });
    });

    it('rejects a record whose detector is not one this gate can emit', () => {
        expect(
            parseRecord(
                JSON.stringify({ refused_at: 'x', refused_turn: 1, detector: 'invented' }),
            ),
        ).toBeNull();
    });

    it('returns null rather than throwing on malformed JSON', () => {
        expect(parseRecord('{not json')).toBeNull();
    });

    it('treats a present-but-all-zero counts block as one refusal, not zero', () => {
        // A record whose writer knew about counts and recorded none would
        // otherwise report a refusal that left no trace of which detector fired.
        const rec = parseRecord(
            JSON.stringify({
                refused_at: '2026-08-13T00:00:00.000Z',
                refused_turn: 3,
                detector: 'promissory',
                counts: { promissory: 0, language: 0, verification: 0, completion: 0 },
            }),
        );
        expect(countsOf(rec!)).toEqual({ ...emptyCounts(), promissory: 1 });
    });
});

describe('step 1.1 — per detector, never pooled', () => {
    it('counts EVERY detector of one refusal, not just the first', () => {
        // The pre-change writer stored `findings[0].detector`. A turn tripping
        // language AND verification counted as one language refusal, and the
        // detector that lost the tie was invisible — which is exactly the
        // pooling step 1.1 forbids.
        const rec = foldRefusal(null, {
            detectors: ['language', 'verification'],
            turnOrdinal: 7,
            at: '2026-08-17T10:00:00.000Z',
        });
        expect(rec.counts).toEqual({ ...emptyCounts(), language: 1, verification: 1 });
        expect(rec.detector).toBe('language'); // compatibility field, unchanged
        expect(rec.refused_turn).toBe(7); // the re-entrancy marker survives
        expect(rec.refused_prompt_id).toBeUndefined(); // absent payload id stays absent
    });

    it('records the host prompt id beside the ordinal, and never in its place', () => {
        // The pair is the point: the ordinal stays the re-entrancy key, and the
        // id is what lets a later reading tell one prompt whose ordinal drifted
        // from two genuine turns. A refusal carrying no id does NOT inherit the
        // previous one — that would read as an identity the payload never sent.
        let rec = foldRefusal(null, {
            detectors: ['pending-decision'],
            turnOrdinal: 3,
            at: '2026-09-11T10:00:00.000Z',
            promptId: 'p-aaaa',
        });
        expect(rec.refused_prompt_id).toBe('p-aaaa');
        expect(rec.refused_turn).toBe(3);

        rec = foldRefusal(rec, {
            detectors: ['pending-decision'],
            turnOrdinal: 4,
            at: '2026-09-11T10:01:00.000Z',
            promptId: 'p-aaaa',
        });
        expect(rec.refused_prompt_id).toBe('p-aaaa'); // same prompt, drifted ordinal
        expect(rec.refused_turn).toBe(4);

        rec = foldRefusal(rec, {
            detectors: ['pending-decision'],
            turnOrdinal: 5,
            at: '2026-09-11T10:02:00.000Z',
        });
        expect(rec.refused_prompt_id).toBeUndefined();
    });

    it('accumulates across refusals in the same session', () => {
        let rec: RefusalRecord | null = null;
        rec = foldRefusal(rec, {
            detectors: ['verification'],
            turnOrdinal: 1,
            at: '2026-08-17T10:00:00.000Z',
        });
        rec = foldRefusal(rec, {
            detectors: ['verification'],
            turnOrdinal: 4,
            at: '2026-08-17T11:00:00.000Z',
        });
        expect(rec.counts?.verification).toBe(2);
        expect(rec.first_refused_at).toBe('2026-08-17T10:00:00.000Z');
        expect(rec.refused_at).toBe('2026-08-17T11:00:00.000Z');
        expect(rec.refused_turn).toBe(4);
    });

    it('promotes a legacy record to counts without losing its one refusal', () => {
        const legacy = parseRecord(
            JSON.stringify({
                refused_at: '2026-08-13T00:00:00.000Z',
                refused_turn: 2,
                detector: 'promissory',
            }),
        );
        const next = foldRefusal(legacy, {
            detectors: ['language'],
            turnOrdinal: 5,
            at: '2026-08-17T10:00:00.000Z',
        });
        expect(next.counts).toEqual({ ...emptyCounts(), promissory: 1, language: 1 });
    });

    it('aggregates per detector and reports the sessions-with-refusals denominator', () => {
        writeRecord('s1', {
            refused_at: '2026-08-17T10:00:00.000Z',
            refused_turn: 1,
            detector: 'verification',
            counts: { verification: 3, language: 1 },
        });
        writeRecord('s2', {
            refused_at: '2026-08-16T10:00:00.000Z',
            refused_turn: 2,
            detector: 'promissory',
        });
        const stats = collectRefusalStats(root);
        expect(stats.sessionsWithRefusals).toBe(2);
        expect(stats.total).toBe(5);
        expect(stats.byDetector).toEqual({
            ...emptyCounts(),
            verification: 3,
            language: 1,
            promissory: 1,
        });
        expect(stats.legacyRecords).toBe(1);
        expect(stats.byPeriod.map((p) => p.period)).toEqual(['2026-08-17', '2026-08-16']);
        expect(stats.byPeriod[0]!.total).toBe(4);
    });

    it('reads this session’s own counts back for the register record', () => {
        writeRecord('sess-abc', {
            refused_at: '2026-08-17T10:00:00.000Z',
            refused_turn: 1,
            detector: 'language',
            counts: { language: 2 },
        });
        expect(readSessionCounts(root, 'sess-abc')).toEqual({ ...emptyCounts(), language: 2 });
        expect(readSessionCounts(root, 'never-refused')).toBeNull();
    });

    it('covers every detector the gate can emit', () => {
        // A detector added to the gate without being added here would silently
        // stop being counted. The roadmap's own prose says three; the gate has
        // six — this case is what caught detector F's addition and made the
        // ledger update part of shipping it rather than a follow-up nobody
        // filed.
        expect([...DETECTOR_IDS]).toEqual([
            'promissory',
            'language',
            'verification',
            'completion',
            'pending-decision',
            'untested',
        ]);
    });

    it('the zeroed counter covers every id, so no detector aggregates to NaN', () => {
        // The half the assertion above does not make. `emptyCounts` was a
        // four-key object literal, which satisfies
        // `Record<RefusalDetectorId, number>` for the union of the day and reads
        // back `undefined` for the next id added — turning every `+=` in the
        // rollup into `NaN` with no type error anywhere. Deriving it from
        // `DETECTOR_IDS` is the fix; this pins that it stays derived.
        const zeroed = emptyCounts();
        expect(Object.keys(zeroed).sort()).toEqual([...DETECTOR_IDS].sort());
        for (const id of DETECTOR_IDS) expect(zeroed[id]).toBe(0);
    });
});

describe('step 1.2 — the TTL the header admitted was missing', () => {
    it('keeps fresh records and drops aged ones', () => {
        writeRecord('fresh', {
            refused_at: daysAgo(1),
            refused_turn: 1,
            detector: 'language',
        });
        writeRecord('aged', {
            refused_at: daysAgo(REFUSAL_STATE_MAX_AGE_DAYS + 5),
            refused_turn: 1,
            detector: 'language',
        });
        const result = pruneAgedRefusalState(root);
        expect(result.scanned).toBe(2);
        expect(result.pruned).toBe(1);
        expect(result.kept).toBe(1);
        expect(fs.existsSync(sessionRefusalFile(root, deriveSessionKey('fresh')))).toBe(true);
        expect(fs.existsSync(sessionRefusalFile(root, deriveSessionKey('aged')))).toBe(false);
    });

    it('keeps a record it cannot parse rather than deleting it', () => {
        const dir = refusalStateDir(root);
        fs.mkdirSync(dir, { recursive: true });
        const file = path.join(dir, 'garbage.json');
        fs.writeFileSync(file, '{not json');
        const result = pruneAgedRefusalState(root);
        expect(result.pruned).toBe(0);
        expect(fs.existsSync(file)).toBe(true);
    });

    it('ages on the record’s own stamp, never on the filesystem mtime', () => {
        // A checkout or an rsync rewrites mtimes. Pruning on them would delete a
        // live corpus or preserve a dead one at random.
        const file = writeRecord('old-content-new-mtime', {
            refused_at: daysAgo(REFUSAL_STATE_MAX_AGE_DAYS + 1),
            refused_turn: 1,
            detector: 'verification',
        });
        const now = new Date();
        fs.utimesSync(file, now, now);
        expect(pruneAgedRefusalState(root).pruned).toBe(1);
    });

    it('is a no-op on a workspace that never refused a turn', () => {
        expect(pruneAgedRefusalState(root)).toEqual({ scanned: 0, pruned: 0, kept: 0 });
    });

    /**
     * Step 2.1 put a second record shape in this directory, and its filename
     * ends `.json` like every other. `parseRecord` rejects it for lacking
     * `refused_at`, and the unparseable branch above KEEPS what it cannot
     * read — correct for a corrupt refusal record and exactly wrong here,
     * because a shadow record is perfectly readable and would then never age
     * out. That is the unbounded growth this pruner exists to prevent,
     * reintroduced by the instrument.
     */
    function writeShadow(sessionId: string, lastAt: string): string {
        const file = sessionShadowFile(root, deriveSessionKey(sessionId));
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(
            file,
            `${JSON.stringify({ would_refuse_again: [], retries_observed: { stop_hook_active: 1, refused_turn: 0 }, dropped: 0, first_at: lastAt, last_at: lastAt }, null, 2)}\n`,
        );
        return file;
    }

    it('prunes an aged SHADOW record on its own last_at clock', () => {
        const aged = writeShadow('shadow-aged', daysAgo(REFUSAL_STATE_MAX_AGE_DAYS + 5));
        const fresh = writeShadow('shadow-fresh', daysAgo(1));
        const result = pruneAgedRefusalState(root);
        expect(result.scanned).toBe(2);
        expect(result.pruned).toBe(1);
        expect(fs.existsSync(aged)).toBe(false);
        expect(fs.existsSync(fresh)).toBe(true);
    });

    /**
     * Keep-on-unparseable is NOT inherited from the refusal branch, and the
     * asymmetry is the point. A refusal record that will not parse may still
     * carry the wedge marker, so deleting it is refused. A shadow record is
     * pure measurement with nothing to protect — keeping a corrupt one means
     * it never ages out at all, i.e. the unbounded growth this pruner exists
     * to stop, surviving for exactly the subset nobody can read.
     */
    it('keeps a FRESH shadow record whose last_at is unreadable', () => {
        const dir = refusalStateDir(root);
        fs.mkdirSync(dir, { recursive: true });
        const file = path.join(dir, 'deadbeef.shadow.json');
        fs.writeFileSync(file, '{not json');
        expect(pruneAgedRefusalState(root).pruned).toBe(0);
        expect(fs.existsSync(file)).toBe(true);
    });

    it('prunes an AGED shadow record whose last_at is unreadable, on the mtime', () => {
        const dir = refusalStateDir(root);
        fs.mkdirSync(dir, { recursive: true });
        const file = path.join(dir, 'cafebabe.shadow.json');
        fs.writeFileSync(file, '{not json');
        const old = new Date(Date.parse(daysAgo(REFUSAL_STATE_MAX_AGE_DAYS + 5)));
        fs.utimesSync(file, old, old);
        expect(pruneAgedRefusalState(root).pruned).toBe(1);
        expect(fs.existsSync(file)).toBe(false);
    });

    it('a corrupt REFUSAL record of the same age is still kept', () => {
        // The other half of the asymmetry, asserted rather than argued: an
        // unreadable refusal record may carry the wedge marker.
        const dir = refusalStateDir(root);
        fs.mkdirSync(dir, { recursive: true });
        const file = path.join(dir, 'f00dface.json');
        fs.writeFileSync(file, '{not json');
        const old = new Date(Date.parse(daysAgo(REFUSAL_STATE_MAX_AGE_DAYS + 5)));
        fs.utimesSync(file, old, old);
        expect(pruneAgedRefusalState(root).pruned).toBe(0);
        expect(fs.existsSync(file)).toBe(true);
    });

    /**
     * NAMED FOR WHAT IT COVERS, after a review found the previous name
     * overpromised. It pins the OUTCOME — a shadow record moves no rollup
     * number — and it does NOT cover the explicit `SHADOW_SUFFIX` skip in
     * `collectRefusalStats`, which can be deleted with this file still green
     * because `parseRecord` rejects the shape anyway. That skip is
     * defence-in-depth against a future loosening of the parser, its own
     * comment says so, and a test cannot observe a guard whose removal changes
     * nothing today. Calling this coverage of the skip would be the tautology
     * this suite exists to avoid.
     */
    it('a shadow record moves no number in the refusal rollup', () => {
        writeShadow('counted-nowhere', daysAgo(1));
        const stats = collectRefusalStats(root);
        expect(stats.sessionsWithRefusals).toBe(0);
        expect(stats.total).toBe(0);
    });
});

describe('step 1.3 — the version split, and what it cannot answer', () => {
    it('splits by the version recorded ON the refusal', () => {
        writeRecord('a', {
            refused_at: '2026-08-17T10:00:00.000Z',
            refused_turn: 1,
            detector: 'verification',
            counts: { verification: 2 },
            agent_config_version: '13.0.0',
        });
        writeRecord('b', {
            refused_at: '2026-08-16T10:00:00.000Z',
            refused_turn: 1,
            detector: 'language',
            counts: { language: 1 },
            agent_config_version: '12.1.0',
        });
        const stats = collectRefusalStats(root);
        const byVersion = Object.fromEntries(stats.byVersion.map((v) => [v.version, v.total]));
        expect(byVersion).toEqual({ '13.0.0': 2, '12.1.0': 1 });
        expect(stats.unversionedRecords).toBe(0);
    });

    it('reports pre-stamping records as unrecorded rather than attributing them', () => {
        // The corpus written before this shipped carries no version. Assigning
        // it to the currently installed one would manufacture the very
        // correlation claim 10 asks us to TEST.
        writeRecord('legacy', {
            refused_at: '2026-08-13T10:00:00.000Z',
            refused_turn: 1,
            detector: 'promissory',
        });
        const stats = collectRefusalStats(root);
        expect(stats.unversionedRecords).toBe(1);
        expect(stats.byVersion.map((v) => v.version)).toEqual(['(unrecorded)']);
    });
});

describe('Q1 — the shadow rollup (step 2.2)', () => {
    function writeShadow(sessionId: string, rec: Record<string, unknown>): string {
        const file = sessionShadowFile(root, deriveSessionKey(sessionId));
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, `${JSON.stringify(rec, null, 2)}\n`);
        return file;
    }

    function shadow(over: Record<string, unknown> = {}): Record<string, unknown> {
        return {
            would_refuse_again: [],
            retries_observed: { stop_hook_active: 0, refused_turn: 0 },
            dropped: 0,
            first_at: '2026-09-30T22:32:24.942Z',
            last_at: '2026-09-30T22:32:24.942Z',
            ...over,
        };
    }

    it('divides rows by retries ON THE SAME LAYER, never pooled', () => {
        // The defect this pins is the one an independent review caught on the
        // producer: a `stop_hook_active` retry follows ANY stop concern's
        // block, so a pooled denominator reads another concern's retries
        // against this gate's refusals. Both layers carry traffic here and the
        // two shares are deliberately different, so a pooled reader cannot
        // land on either by accident.
        writeShadow('s1', {
            would_refuse_again: [
                { detector: 'language', turn: 3, at: '2026-09-30T10:00:00.000Z', layer: 'stop_hook_active' },
                { detector: 'promissory', turn: 9, at: '2026-09-30T11:00:00.000Z', layer: 'refused_turn' },
                { detector: 'promissory', turn: 11, at: '2026-09-30T12:00:00.000Z', layer: 'refused_turn' },
            ],
            retries_observed: { stop_hook_active: 4, refused_turn: 4 },
        });
        const stats = collectShadowStats(root);
        expect(retryConditionedShare(stats, 'stop_hook_active', 'language')).toBeCloseTo(0.25, 10);
        expect(retryConditionedShare(stats, 'refused_turn', 'promissory')).toBeCloseTo(0.5, 10);
        // Cross terms are zero, not the pooled 3/8 a layer-blind reader prints.
        expect(retryConditionedShare(stats, 'refused_turn', 'language')).toBe(0);
        expect(retryConditionedShare(stats, 'stop_hook_active', 'promissory')).toBe(0);
    });

    it('returns null on an empty denominator and zero on an empty numerator', () => {
        // Opposite findings. Zero is about the DETECTOR — retries happened and
        // it would have refused none. Null is about the SAMPLE — nothing was
        // observed. A reader that prints 0 % for both publishes the second as
        // the first, which is the reading `retries_observed` exists to prevent.
        writeShadow('s1', shadow({ retries_observed: { stop_hook_active: 3, refused_turn: 0 } }));
        const stats = collectShadowStats(root);
        expect(retryConditionedShare(stats, 'stop_hook_active', 'language')).toBe(0);
        expect(retryConditionedShare(stats, 'refused_turn', 'language')).toBeNull();
    });

    it('sums retries and rows across sessions', () => {
        writeShadow('s1', {
            would_refuse_again: [
                { detector: 'verification', turn: 2, at: '2026-09-28T10:00:00.000Z', layer: 'stop_hook_active' },
            ],
            retries_observed: { stop_hook_active: 1, refused_turn: 0 },
            first_at: '2026-09-28T10:00:00.000Z',
            last_at: '2026-09-28T10:00:00.000Z',
        });
        writeShadow('s2', {
            would_refuse_again: [
                { detector: 'verification', turn: 5, at: '2026-09-30T10:00:00.000Z', layer: 'stop_hook_active' },
            ],
            retries_observed: { stop_hook_active: 3, refused_turn: 0 },
            first_at: '2026-09-30T10:00:00.000Z',
            last_at: '2026-09-30T10:00:00.000Z',
        });
        const stats = collectShadowStats(root);
        expect(stats.files).toBe(2);
        expect(retryConditionedShare(stats, 'stop_hook_active', 'verification')).toBeCloseTo(0.5, 10);
        expect(stats.earliest).toBe('2026-09-28T10:00:00.000Z');
        expect(stats.latest).toBe('2026-09-30T10:00:00.000Z');
    });

    it('counts one retry refused by two detectors once for EACH, and says so in `rows`', () => {
        // `turn-end-detector-demotion.md` § Attribution: "A retry firing
        // several detectors counts once for each." So `rows` exceeds `retries`
        // here legitimately, and each per-detector share stays within [0, 1].
        writeShadow('s1', {
            would_refuse_again: [
                { detector: 'language', turn: 4, at: '2026-09-30T10:00:00.000Z', layer: 'stop_hook_active' },
                { detector: 'promissory', turn: 4, at: '2026-09-30T10:00:00.000Z', layer: 'stop_hook_active' },
            ],
            retries_observed: { stop_hook_active: 1, refused_turn: 0 },
        });
        const stats = collectShadowStats(root);
        const bucket = stats.byLayer.find((b) => b.layer === 'stop_hook_active')!;
        expect(bucket.rows).toBe(2);
        expect(bucket.retries).toBe(1);
        expect(retryConditionedShare(stats, 'stop_hook_active', 'language')).toBe(1);
        expect(retryConditionedShare(stats, 'stop_hook_active', 'promissory')).toBe(1);
    });

    it('reads REFUSAL records as nothing, and shadow records as nothing but shadow', () => {
        // The two shapes share a directory and an extension. A rollup that
        // globs `*.json` reads each refusal record as an unparseable shadow
        // file and inflates `unreadable` — which would make every rate read as
        // a floor when it is not.
        writeRecord('s1', {
            refused_at: '2026-09-30T10:00:00.000Z',
            refused_turn: 7,
            detector: 'language',
        });
        writeShadow('s2', shadow({ retries_observed: { stop_hook_active: 2, refused_turn: 0 } }));
        const stats = collectShadowStats(root);
        expect(stats.files).toBe(1);
        expect(stats.unreadable).toBe(0);
    });

    it('counts an unparseable shadow file rather than dropping it silently', () => {
        const file = sessionShadowFile(root, deriveSessionKey('s1'));
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, '{ this is not json\n');
        const stats = collectShadowStats(root);
        expect(stats.files).toBe(0);
        expect(stats.unreadable).toBe(1);
    });

    it('carries `dropped` forward so a capped row array is readable as a sample', () => {
        writeShadow('s1', {
            would_refuse_again: [
                { detector: 'language', turn: 4, at: '2026-09-30T10:00:00.000Z', layer: 'stop_hook_active' },
            ],
            retries_observed: { stop_hook_active: 5, refused_turn: 0 },
            dropped: 12,
        });
        expect(collectShadowStats(root).dropped).toBe(12);
    });

    it('is empty, not throwing, when the state directory does not exist', () => {
        const stats = collectShadowStats(path.join(root, 'nope'));
        expect(stats.files).toBe(0);
        expect(stats.byLayer.map((b) => b.layer)).toEqual([...SHADOW_LAYERS]);
        for (const layer of SHADOW_LAYERS) {
            for (const id of DETECTOR_IDS) expect(retryConditionedShare(stats, layer, id)).toBeNull();
        }
    });
});

describe('Q1 rollup — the 2026-10-01 review round', () => {
    function writeShadow2(sessionId: string, rec: Record<string, unknown>): void {
        const file = sessionShadowFile(root, deriveSessionKey(sessionId));
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, `${JSON.stringify(rec, null, 2)}\n`);
    }

    it('does not let an ABSENT timestamp win the earliest comparison', () => {
        // m1. `parseShadowRecord` coerces a missing `first_at` to `''`, and
        // `'' < '<any ISO stamp>'` is true, so a record lacking the field used
        // to take the window start and the report printed an empty start beside
        // a real end. An absent timestamp is not an earlier one.
        writeShadow2('s1', {
            would_refuse_again: [],
            retries_observed: { stop_hook_active: 1, refused_turn: 0 },
            dropped: 0,
            last_at: '2026-09-30T10:00:00.000Z',
        });
        writeShadow2('s2', {
            would_refuse_again: [],
            retries_observed: { stop_hook_active: 1, refused_turn: 0 },
            dropped: 0,
            first_at: '2026-09-28T10:00:00.000Z',
            last_at: '2026-09-29T10:00:00.000Z',
        });
        const stats = collectShadowStats(root);
        expect(stats.files).toBe(2);
        expect(stats.earliest).toBe('2026-09-28T10:00:00.000Z');
        expect(stats.latest).toBe('2026-09-30T10:00:00.000Z');
    });

    it('names exactly the three detectors an open dispatch suppresses', () => {
        // M2. `runDetectors` skips these three when a dispatch is open and the
        // shadow record carries no dispatch flag, so their denominators would
        // absorb silences nobody observed. Pinned as a SET rather than checked
        // at the render layer, because the gate is where the suppression lives
        // and a drift between the two is invisible in the output.
        expect([...DISPATCH_CENSORED_DETECTORS].sort()).toEqual(
            ['completion', 'promissory', 'untested'],
        );
        // …and the three that are NOT censored are the three the gate runs
        // unconditionally. If a detector moves sides in the gate, this is the
        // line that should stop being true.
        const reported = DETECTOR_IDS.filter((d) => !DISPATCH_CENSORED_DETECTORS.has(d));
        expect([...reported].sort()).toEqual(['language', 'pending-decision', 'verification']);
    });
});

describe('who set stop_hook_active — road-to-neighbours-that-pull-their-weight 3.1', () => {
    // The lane's premise, in one sentence: `stop_hook_active` is the HOST's
    // answer and the host sets it on ANY stop hook's block, so before this field
    // a retry caused by a neighbour's concern and one caused by this gate were
    // the same row.

    it('no prior refusal of ours reads foreign', () => {
        // Nothing written. The refusal record is absent, so this gate provably
        // never refused in this session — and the host set the flag anyway.
        expect(shadowSetBy(root, deriveSessionKey('s-none'))).toBe('foreign');
    });

    it('a prior refusal of ours reads ours', () => {
        writeRecord('s-ours', {
            refused_at: '2026-10-01T00:00:00.000Z',
            refused_turn: 3,
            detector: 'verification',
            counts: { ...emptyCounts(), verification: 1 },
        });
        expect(shadowSetBy(root, deriveSessionKey('s-ours'))).toBe('ours');
    });

    it('a present but unreadable record reads unknown, never foreign', () => {
        // The distinction this field exists for. "We did not refuse" and "we
        // cannot tell whether we refused" are different findings, and reporting
        // the second as the first would make a corrupt state file read as
        // evidence that a neighbour acted.
        const file = sessionRefusalFile(root, deriveSessionKey('s-broken'));
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, '{ not json');
        expect(shadowSetBy(root, deriveSessionKey('s-broken'))).toBe('unknown');
    });

    it('a well-formed JSON record that is not a refusal record reads unknown', () => {
        const file = sessionRefusalFile(root, deriveSessionKey('s-shape'));
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, JSON.stringify({ something: 'else' }));
        expect(shadowSetBy(root, deriveSessionKey('s-shape'))).toBe('unknown');
    });

    it('foldShadow stamps every row it adds', () => {
        const rec = foldShadow(null, {
            detectors: ['verification', 'language'],
            turnOrdinal: 7,
            at: '2026-10-02T00:00:00.000Z',
            layer: 'stop_hook_active',
            setBy: 'foreign',
        });
        expect(rec.would_refuse_again.map((r) => r.set_by)).toEqual(['foreign', 'foreign']);
    });

    it('foldShadow defaults to unknown when the caller cannot establish it', () => {
        // Never `foreign`: a missing answer is not evidence of a neighbour.
        const rec = foldShadow(null, {
            detectors: ['verification'],
            turnOrdinal: 1,
            at: '2026-10-02T00:00:00.000Z',
            layer: 'stop_hook_active',
        });
        expect(rec.would_refuse_again[0]?.set_by).toBe('unknown');
    });

    it('a row written before the field existed parses as unknown, not dropped', () => {
        // An old row is still a real observation of a retry. Dropping it would
        // silently lower Q1's numerator against an unchanged denominator.
        const parsed = parseShadowRecord(
            JSON.stringify({
                would_refuse_again: [
                    { detector: 'verification', turn: 2, at: '2026-09-01T00:00:00.000Z', layer: 'refused_turn' },
                ],
                retries_observed: { stop_hook_active: 0, refused_turn: 1 },
                dropped: 0,
                first_at: '2026-09-01T00:00:00.000Z',
                last_at: '2026-09-01T00:00:00.000Z',
            }),
        );
        expect(parsed?.would_refuse_again).toHaveLength(1);
        expect(parsed?.would_refuse_again[0]?.set_by).toBe('unknown');
    });

    it('a row with a garbage set_by parses as unknown rather than being dropped', () => {
        const parsed = parseShadowRecord(
            JSON.stringify({
                would_refuse_again: [
                    { detector: 'language', turn: 4, at: '2026-10-02T00:00:00.000Z', layer: 'stop_hook_active', set_by: 'maybe' },
                ],
                retries_observed: { stop_hook_active: 1, refused_turn: 0 },
                dropped: 0,
                first_at: '2026-10-02T00:00:00.000Z',
                last_at: '2026-10-02T00:00:00.000Z',
            }),
        );
        expect(parsed?.would_refuse_again[0]?.set_by).toBe('unknown');
    });
});
