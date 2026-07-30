// Freshness check for the committed originality report.
//
// The two properties worth pinning are the ones that make it safe to run inside
// a pipeline: it must DETECT drift, and it must leave the working tree exactly
// as it found it (otherwise a later CI step sees a spurious diff and the check
// becomes the thing that breaks the build it was supposed to warn about).
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { checkFreshness } from '../../src/scripts/check_originality_freshness.js';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const REPORT = path.join(REPO, 'agents', 'reports', 'originality.json');

let saved: Buffer | null = null;

afterEach(() => {
    if (saved !== null) {
        fs.writeFileSync(REPORT, saved);
        saved = null;
    }
});

describe('originality freshness — detection', () => {
    it('reports no drift when the committed report matches the corpus', () => {
        const { drifted, missing } = checkFreshness([REPORT]);
        expect(missing).toEqual([]);
        expect(drifted).toEqual([]);
    });

    it('reports drift when the committed report describes an older corpus', () => {
        saved = fs.readFileSync(REPORT);
        const doc = JSON.parse(saved.toString('utf-8')) as Record<string, unknown>;
        // The exact shape of the real 2026-07-31 staleness: a count from before
        // an artefact landed.
        doc['artifacts_scanned'] = (doc['artifacts_scanned'] as number) - 1;
        fs.writeFileSync(REPORT, `${JSON.stringify(doc, null, 2)}\n`);

        expect(checkFreshness([REPORT]).drifted).toEqual([REPORT]);
    });

    it('treats an absent report as missing rather than as drift', () => {
        // A path the sweep never writes — absence must not be reported as staleness.
        const absent = path.join(os.tmpdir(), 'originality-absent-fixture.json');
        fs.rmSync(absent, { force: true });

        const { drifted, missing } = checkFreshness([absent]);
        expect(drifted).toEqual([]);
        expect(missing).toEqual([]);
    });
});

describe('originality freshness — the tree is restored either way', () => {
    it('leaves a FRESH report byte-identical', () => {
        const before = fs.readFileSync(REPORT);
        checkFreshness([REPORT]);
        expect(fs.readFileSync(REPORT).equals(before)).toBe(true);
    });

    it('leaves a STALE report byte-identical — it warns, it does not silently fix', () => {
        saved = fs.readFileSync(REPORT);
        const stale = Buffer.from('{ "artifacts_scanned": 1 }\n', 'utf-8');
        fs.writeFileSync(REPORT, stale);

        expect(checkFreshness([REPORT]).drifted).toEqual([REPORT]);
        // Restoring, not overwriting: a check that quietly repaired the file
        // would hide the drift it exists to surface — and would turn a
        // read-only advisory into a writer.
        expect(fs.readFileSync(REPORT).equals(stale)).toBe(true);
    });
});
