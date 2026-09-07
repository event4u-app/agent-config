/**
 * road-to-observed-learning-signal Phase 2 — the model-noticed record.
 *
 * One test file per step verify, so a failing assertion names the step it
 * refutes rather than a generic "self-repair broke".
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as url from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    type DefectFinding,
    type DefectRecord,
    validateRecord,
} from '../../src/scripts/_lib/self_repair.js';
import {
    listRecords,
    migrateReleasedRecords,
    partitionTargets,
    readRecord,
    targetCounts,
    TARGET_INDEX_FILE,
    upsertFinding,
    writeRecord,
    writeTargetIndex,
    storeDir,
} from '../../src/scripts/_lib/self_repair_store.js';

const REPO = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..', '..');
const NOW = '2026-09-07T10:00:00.000Z';
const LATER = '2026-09-07T12:00:00.000Z';

function mkTmp(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'self-repair-model-noticed-'));
}

function finding(over: Partial<DefectFinding> = {}): DefectFinding {
    return {
        defect_class: 'model-noticed',
        source: 'model-noticed',
        evidence: 'the rule states a floor its own trigger set cannot reach',
        suggested_surface: 'widen the trigger set, or state the gap',
        ...over,
    };
}

// 2.1
describe('2.1 — model-noticed is a third source, not a second store', () => {
    it('round-trips through the existing store reader with its source intact', () => {
        const tmp = mkTmp();
        try {
            const written = upsertFinding(tmp, finding(), NOW);
            expect(written).not.toBeNull();
            const back = readRecord(tmp, (written as DefectRecord).fingerprint);
            expect(back).not.toBeNull();
            expect(back?.source).toBe('model-noticed');
            expect(back?.defect_class).toBe('model-noticed');
            // The SAME reader the other two sources use — no second store.
            expect(listRecords(tmp).map((r) => r.fingerprint)).toEqual([
                (written as DefectRecord).fingerprint,
            ]);
        } finally {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
    });
});

// 2.2
describe('2.2 — targets are a closed vocabulary resolved against the tree', () => {
    it('rejects an unresolvable target into `proposes` and keeps a real one', () => {
        const tmp = mkTmp();
        try {
            const bad = upsertFinding(
                tmp,
                finding({ target: ['rule:does-not-exist'], evidence: 'unresolvable-target case' }),
                NOW,
                { treeRoot: REPO },
            ) as DefectRecord;
            expect(bad.target).toBeUndefined();
            expect(bad.proposes).toEqual(['rule:does-not-exist']);

            const good = upsertFinding(
                tmp,
                finding({ target: ['rule:scope-control'], evidence: 'resolvable-target case' }),
                NOW,
                { treeRoot: REPO },
            ) as DefectRecord;
            expect(good.target).toEqual(['rule:scope-control']);
            expect(good.proposes).toBeUndefined();
        } finally {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
    });

    it('resolves all four kinds against the real tree', () => {
        const split = partitionTargets(REPO, [
            'rule:scope-control',
            'skill:skill-improvement-pipeline',
            'command:agent-handoff',
            'hook:self-repair',
            'rule:no-such-rule',
            'not-a-target',
        ]);
        expect(split.target).toEqual([
            'rule:scope-control',
            'skill:skill-improvement-pipeline',
            'command:agent-handoff',
            'hook:self-repair',
        ]);
        expect(split.proposes).toEqual(['rule:no-such-rule', 'not-a-target']);
    });

    it('an empty target list stays legal — an observation with no home is information', () => {
        const tmp = mkTmp();
        try {
            const rec = upsertFinding(tmp, finding({ target: [] }), NOW, { treeRoot: REPO });
            expect(rec).not.toBeNull();
            expect((rec as DefectRecord).target).toBeUndefined();
        } finally {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
    });
});

// 2.3
describe('2.3 — the widened status enum and the parked wake condition', () => {
    it('a parked record without parked_until fails validation', () => {
        const rec: DefectRecord = {
            ...finding(),
            fingerprint: 'deadbeefdeadbeef',
            first_seen: NOW,
            last_seen: NOW,
            occurrences: 1,
            status: 'parked',
        };
        expect(validateRecord(rec)).toEqual([
            'status is `parked` but `parked_until` is missing — a park with no wake condition is a deferral, not a park',
        ]);
        const tmp = mkTmp();
        try {
            expect(() => writeRecord(tmp, rec)).toThrow(/refusing to write an invalid record/);
            expect(validateRecord({ ...rec, parked_until: '2026-12-01' })).toEqual([]);
        } finally {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
    });

    it('the released migration is idempotent — a second run produces no diff', () => {
        const tmp = mkTmp();
        try {
            const rec = upsertFinding(tmp, finding(), NOW) as DefectRecord;
            // Write the RETIRED status directly, as a pre-migration store carries it.
            const p = path.join(storeDir(tmp), `${rec.fingerprint}.json`);
            fs.writeFileSync(
                p,
                `${JSON.stringify({ ...rec, status: 'released' }, null, 2)}\n`,
                'utf-8',
            );

            expect(migrateReleasedRecords(tmp)).toEqual([rec.fingerprint]);
            const afterFirst = fs.readFileSync(p, 'utf-8');
            expect(JSON.parse(afterFirst).status).toBe('actioned');
            expect(JSON.parse(afterFirst).resolution).toMatch(/retired `released` status/);

            expect(migrateReleasedRecords(tmp)).toEqual([]);
            expect(fs.readFileSync(p, 'utf-8')).toBe(afterFirst);
        } finally {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
    });
});

// 2.4
describe('2.4 — occurrences counted per target, not only per fingerprint', () => {
    it('three distinct fingerprints sharing one target report a count of three', () => {
        const tmp = mkTmp();
        try {
            for (const evidence of ['first manifestation', 'second one', 'a third']) {
                upsertFinding(tmp, finding({ evidence, target: ['rule:scope-control'] }), NOW, {
                    treeRoot: REPO,
                });
            }
            const records = listRecords(tmp);
            expect(new Set(records.map((r) => r.fingerprint)).size).toBe(3);
            // Each record has ONE occurrence; the per-fingerprint counter can
            // therefore never reach the third-recurrence escalation.
            expect(records.every((r) => r.occurrences === 1)).toBe(true);

            const counts = targetCounts(tmp);
            expect(counts).toHaveLength(1);
            expect(counts[0]?.target).toBe('rule:scope-control');
            expect(counts[0]?.occurrences).toBe(3);
            expect(counts[0]?.records).toHaveLength(3);
        } finally {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
    });

    it('deleting the derived index and rebuilding is byte-stable', () => {
        const tmp = mkTmp();
        try {
            for (const evidence of ['alpha', 'beta']) {
                upsertFinding(
                    tmp,
                    finding({ evidence, target: ['rule:scope-control', 'skill:git-workflow'] }),
                    NOW,
                    { treeRoot: REPO },
                );
            }
            writeTargetIndex(tmp);
            const idx = path.join(storeDir(tmp), TARGET_INDEX_FILE);
            const first = fs.readFileSync(idx);
            fs.rmSync(idx);
            writeTargetIndex(tmp);
            expect(fs.readFileSync(idx).equals(first)).toBe(true);
        } finally {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
    });

    it('the index file is not itself read back as a record', () => {
        const tmp = mkTmp();
        try {
            const rec = upsertFinding(tmp, finding(), LATER) as DefectRecord;
            writeTargetIndex(tmp);
            expect(listRecords(tmp).map((r) => r.fingerprint)).toEqual([rec.fingerprint]);
        } finally {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
    });
});
