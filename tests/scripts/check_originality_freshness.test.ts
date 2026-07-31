// Freshness check for the committed originality report.
//
// The two properties worth pinning are the ones that make it safe to run inside
// a pipeline: it must DETECT drift, and it must leave the working tree exactly
// as it found it (otherwise a later CI step sees a spurious diff and the check
// becomes the thing that breaks the build it was supposed to warn about).
//
// NOT-NEGOTIABLE for this file: nothing here writes to a TRACKED path. An
// earlier version wrote a stale report into `agents/reports/originality.json` to
// exercise the drift path, and because vitest runs suites in parallel, a sibling
// test asserting a clean worktree (`backfill_model_tier`'s dry-run purity check)
// observed the transient write and failed. Shared tracked state is not a fixture.
// Drift and restore are therefore proven on temp files via the injectable
// `regenerate` hook; only the fresh path touches the real reports, and that is
// safe because rewriting identical bytes is invisible to git.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { REPORTS, checkFreshness } from '../../src/scripts/check_originality_freshness.js';

const tmps: string[] = [];

function tmpdir(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'originality-freshness-'));
    tmps.push(d);
    return d;
}

afterEach(() => {
    while (tmps.length) fs.rmSync(tmps.pop() as string, { recursive: true, force: true });
});

/** A report fixture plus a regenerate hook that rewrites it with `next`. */
function fixture(current: string, next: string): { file: string; regenerate: () => void } {
    const file = path.join(tmpdir(), 'originality.json');
    fs.writeFileSync(file, current, 'utf-8');
    return { file, regenerate: () => fs.writeFileSync(file, next, 'utf-8') };
}

describe('originality freshness — detection', () => {
    it('reports no drift when regeneration reproduces the committed bytes', () => {
        const same = '{ "artifacts_scanned": 508 }\n';
        const { file, regenerate } = fixture(same, same);

        expect(checkFreshness([file], regenerate)).toEqual({ drifted: [], missing: [] });
    });

    it('reports drift when the committed report describes an older corpus', () => {
        // The exact shape of the real 2026-07-31 staleness: a count from before
        // an artefact landed.
        const { file, regenerate } = fixture(
            '{ "artifacts_scanned": 507 }\n',
            '{ "artifacts_scanned": 508 }\n',
        );

        expect(checkFreshness([file], regenerate).drifted).toEqual([file]);
    });

    it('treats an absent report as missing rather than as drift', () => {
        const absent = path.join(tmpdir(), 'never-written.json');
        const wrote = (): void => fs.writeFileSync(absent, 'fresh\n', 'utf-8');

        const { drifted, missing } = checkFreshness([absent], wrote);
        expect(drifted).toEqual([]);
        expect(missing).toEqual([absent]);
        // Restoring "absent" means removing it again, so the tree is as found.
        expect(fs.existsSync(absent)).toBe(false);
    });

    it('does not report drift when regeneration throws — a broken sweep is not a stale report', () => {
        const { file } = fixture('{ "artifacts_scanned": 507 }\n', '');
        const boom = (): void => {
            throw new Error('sweep unavailable');
        };

        expect(checkFreshness([file], boom)).toEqual({ drifted: [], missing: [] });
        expect(fs.readFileSync(file, 'utf-8')).toBe('{ "artifacts_scanned": 507 }\n');
    });
});

describe('originality freshness — the file is restored either way', () => {
    it('leaves a FRESH report byte-identical', () => {
        const same = '{ "artifacts_scanned": 508 }\n';
        const { file, regenerate } = fixture(same, same);

        checkFreshness([file], regenerate);
        expect(fs.readFileSync(file, 'utf-8')).toBe(same);
    });

    it('leaves a STALE report byte-identical — it warns, it does not silently fix', () => {
        const stale = '{ "artifacts_scanned": 1 }\n';
        const { file, regenerate } = fixture(stale, '{ "artifacts_scanned": 508 }\n');

        expect(checkFreshness([file], regenerate).drifted).toEqual([file]);
        // Restoring, not overwriting: a check that quietly repaired the file
        // would hide the drift it exists to surface — and would turn a
        // read-only advisory into a writer.
        expect(fs.readFileSync(file, 'utf-8')).toBe(stale);
    });
});

describe('originality freshness — the real wiring', () => {
    it('covers BOTH committed reports, not just the json', () => {
        // Asserted rather than exercised by mutation: dropping the .md from
        // REPORTS is the regression worth catching, and it is catchable without
        // writing to a tracked path.
        expect(REPORTS.map((f) => path.basename(f)).sort()).toEqual([
            'originality.json',
            'originality.md',
        ]);
    });

    it('runs the real sweep against the committed reports and finds them fresh', () => {
        // The one test that touches tracked files. Safe by construction: the
        // sweep rewrites identical bytes when the report is current, which git
        // cannot see — and if it were NOT current, this failing is the point.
        expect(checkFreshness()).toEqual({ drifted: [], missing: [] });
    });
});
