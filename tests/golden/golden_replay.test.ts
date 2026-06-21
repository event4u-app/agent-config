/**
 * Vitest entry for the Golden Transcript replay harness (TS twin of the retired
 * `test_replay.py`). Replays each captured GT scenario against the live `.ts`
 * work_engine and asserts no structural drift versus the locked baseline under
 * `tests/golden/baseline/`. The comparison logic lives in `./harness.ts`.
 *
 * Coverage: the full 29-scenario matrix runs by default (deterministic, no
 * coverage regression versus the python smoke+nightly split). Set
 * `GOLDEN_SMOKE=1` for the fast PR subset — one representative per recipe
 * family covering all four comparators (exit codes, state shape, halt markers,
 * delivery report) without paying the full subprocess-per-cycle cost.
 */
import { describe, it, expect } from 'vitest';

import { allGtIds, replayAndCompare, diffStr } from './harness.js';

// One representative per recipe family (R1 happy + ambiguity, prompt
// high-confidence, UI build / greenfield-resume / preview-fail).
const SMOKE_GT_IDS = new Set(['GT-1', 'GT-2', 'GT-P1', 'GT-U1', 'GT-U10', 'GT-U15']);

const ALL = allGtIds();
const TARGETS = process.env['GOLDEN_SMOKE'] ? ALL.filter((id) => SMOKE_GT_IDS.has(id)) : ALL;

describe('golden transcript replay', () => {
    // Each scenario spawns `./agent-config` once per cycle; bump the per-test
    // timeout above the suite default to absorb the subprocess cost.
    it.each(TARGETS)('%s replays without structural drift', (gt_id) => {
        const { diffs } = replayAndCompare(gt_id);
        if (diffs.length > 0) {
            const rendered = diffs.map((d) => `  ${diffStr(d)}`).join('\n');
            expect.fail(`${gt_id} drifted from locked baseline (${diffs.length} diff(s)):\n${rendered}`);
        }
        expect(diffs).toEqual([]);
    }, 30_000);
});
