import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    RUN_STATES,
    RUN_STATE_FILE,
    RunError,
    createRun,
    legalNext,
    loadRun,
    publicationKey,
    publishOnce,
    resumeRun,
    runStage,
    spendTokens,
    transition,
    type ForwardState,
    type RunRecord,
} from '../../src/scripts/analysis_run.js';

let root: string;

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'analysis-run-'));
});

afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

function advanceTo(runDir: string, record: RunRecord, target: ForwardState): RunRecord {
    let rec = record;
    while (rec.state !== target) {
        rec = transition(runDir, rec, legalNext(rec.state)[0] as ForwardState);
    }
    return rec;
}

describe('analysis run core', () => {
    it('persists the record under agents/runtime/analysis/<round-id>/', () => {
        const { runDir, record } = createRun(root, { runId: 'run-x', pins: { head: 'a1' }, tokenCap: 100 });
        expect(runDir).toBe(path.join(root, 'agents/runtime/analysis/run-x'));
        expect(record.state).toBe('initialized');
        expect(loadRun(runDir)).toEqual(record);
        expect(fs.readdirSync(runDir)).toEqual([RUN_STATE_FILE]);
    });

    it('walks the forward states in order', () => {
        const { runDir, record } = createRun(root, { pins: {}, tokenCap: 100 });
        const done = advanceTo(runDir, record, 'done');
        expect(done.history.map((h) => h.to)).toEqual(RUN_STATES.slice(1));
        expect(legalNext('done')).toEqual([]);
    });

    it('refuses an illegal transition and leaves the record untouched', () => {
        const { runDir, record } = createRun(root, { pins: {}, tokenCap: 100 });
        expect(() => transition(runDir, record, 'emitted')).toThrow(RunError);
        expect(loadRun(runDir).state).toBe('initialized');
        const back = transition(runDir, record, 'handed-back', 'owner stop');
        expect(() => transition(runDir, back, 'pinned')).toThrow(/illegal transition handed-back → pinned/);
    });

    it('resumes a run killed in emitted without re-emitting', () => {
        const { runDir, record } = createRun(root, { pins: { head: 'a1' }, tokenCap: 100 });
        let emitted = 0;
        const rec = advanceTo(runDir, record, 'awaiting-decision');
        runStage(runDir, rec, 'emitted', () => {
            emitted += 1;
        });
        expect(emitted).toBe(1);

        const resumed = resumeRun(runDir, { head: 'a1' });
        expect(resumed.moved).toEqual([]);
        expect(resumed.record.state).toBe('emitted');
        const again = runStage(runDir, resumed.record, 'emitted', () => {
            emitted += 1;
        });
        expect(again.performed).toBe(false);
        expect(emitted).toBe(1);
        const validated = runStage(runDir, again.record, 'validated', () => undefined);
        expect(validated.performed).toBe(true);
        expect(loadRun(runDir).state).toBe('validated');
    });

    it('reports a moved head on resume instead of continuing', () => {
        const { runDir, record } = createRun(root, { pins: { head: 'a1', base: 'b1' }, tokenCap: 100 });
        advanceTo(runDir, record, 'seeded');
        const { record: rec, moved } = resumeRun(runDir, { head: 'a2', base: 'b1' });
        expect(moved).toEqual([{ pin: 'head', recorded: 'a1', current: 'a2' }]);
        expect(rec.state).toBe('seeded');
        expect(resumeRun(runDir, { head: 'a1' }).moved).toEqual([{ pin: 'base', recorded: 'b1', current: null }]);
    });

    it('stops at the budget cap in handed-back', () => {
        const { runDir, record } = createRun(root, { pins: {}, tokenCap: 1000 });
        let rec = spendTokens(runDir, record, 600);
        expect(rec.state).toBe('initialized');
        rec = spendTokens(runDir, rec, 500);
        expect(rec.state).toBe('handed-back');
        expect(rec.handed_back_reason).toBe('budget: 1100 of 1000 tokens');
        expect(loadRun(runDir).state).toBe('handed-back');
        expect(() => spendTokens(runDir, rec, 1)).toThrow(RunError);
    });

    it('publishes once per key, whatever the path order', () => {
        const { runDir, record } = createRun(root, { pins: {}, tokenCap: 100 });
        const key = publicationKey(record.run_id, ['b.md', 'a.md'], 'sha1');
        expect(publicationKey(record.run_id, ['a.md', 'b.md'], 'sha1')).toBe(key);
        expect(publicationKey(record.run_id, ['a.md', 'b.md'], 'sha2')).not.toBe(key);
        let opened = 0;
        const first = publishOnce(runDir, record, key, () => {
            opened += 1;
        });
        const second = publishOnce(runDir, loadRun(runDir), key, () => {
            opened += 1;
        });
        expect([first.performed, second.performed, opened]).toEqual([true, false, 1]);
    });

    it('refuses a record with an unknown major schema version', () => {
        const { runDir, record } = createRun(root, { pins: {}, tokenCap: 100 });
        fs.writeFileSync(path.join(runDir, RUN_STATE_FILE), JSON.stringify({ ...record, schema_version: '2.0' }));
        expect(() => loadRun(runDir)).toThrow(/unknown schema_version "2.0"/);
    });

    it('refuses a second run with the same id', () => {
        createRun(root, { runId: 'run-dup', pins: {}, tokenCap: 100 });
        expect(() => createRun(root, { runId: 'run-dup', pins: {}, tokenCap: 100 })).toThrow(/already exists/);
    });
});
