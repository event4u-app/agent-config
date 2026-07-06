/**
 * Shared shard driver for the Golden Transcript replay matrix.
 *
 * The 29-scenario matrix runs serially inside a single test FILE (~76 s),
 * because `replayAndCompare` is synchronous (`spawnSync` per cycle) and vitest
 * runs the cases in one `it.each` sequentially. Vitest parallelises at the
 * FILE level (fork pool), so splitting the matrix across N shard files lets the
 * forks run concurrently — full coverage, no async-spawn refactor.
 *
 * Each shard file calls `defineReplayShard(shardIndex, shardCount)`; the
 * scenario set is partitioned deterministically by `index % shardCount`.
 * `GOLDEN_SMOKE=1` collapses every shard to the 6-scenario representative
 * subset run once (only shard 0 carries them; other shards become empty and
 * are skipped) so the fast PR path stays a single cheap fork.
 */
import { describe, it, expect } from 'vitest';

import { allGtIds, replayAndCompare, diffStr } from './harness.js';

// One representative per recipe family (R1 happy + ambiguity, prompt
// high-confidence, UI build / greenfield-resume / preview-fail).
export const SMOKE_GT_IDS = new Set(['GT-1', 'GT-2', 'GT-P1', 'GT-U1', 'GT-U10', 'GT-U15']);

/** Deterministic scenario partition for shard `shardIndex` of `shardCount`. */
export function shardTargets(shardIndex: number, shardCount: number): string[] {
    const all = allGtIds();
    if (process.env['GOLDEN_SMOKE']) {
        // Smoke: run the representative subset once, all on shard 0.
        return shardIndex === 0 ? all.filter((id) => SMOKE_GT_IDS.has(id)) : [];
    }
    return all.filter((_id, i) => i % shardCount === shardIndex);
}

/** Define the vitest suite for one shard. */
export function defineReplayShard(shardIndex: number, shardCount: number): void {
    const targets = shardTargets(shardIndex, shardCount);
    const label = `golden transcript replay — shard ${shardIndex + 1}/${shardCount}`;

    describe(label, () => {
        if (targets.length === 0) {
            it.skip('no scenarios in this shard', () => {
                /* empty shard (e.g. GOLDEN_SMOKE collapses to shard 0) */
            });
            return;
        }
        // Each scenario spawns `./agent-config` once per cycle; bump the
        // per-test timeout above the suite default to absorb the subprocess cost.
        it.each(targets)('%s replays without structural drift', (gt_id) => {
            const { diffs } = replayAndCompare(gt_id);
            if (diffs.length > 0) {
                const rendered = diffs.map((d) => `  ${diffStr(d)}`).join('\n');
                expect.fail(`${gt_id} drifted from locked baseline (${diffs.length} diff(s)):\n${rendered}`);
            }
            expect(diffs).toEqual([]);
        }, 30_000);
    });
}

/** How many shard files exist — keep in sync with the `golden_replay.shardN.test.ts` set. */
export const SHARD_COUNT = 6;
