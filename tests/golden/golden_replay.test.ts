/**
 * Golden Transcript replay — shard 0 of SHARD_COUNT.
 *
 * The 29-scenario matrix is sharded across `golden_replay.test.ts` +
 * `golden_replay.shard{1..N}.test.ts` so vitest's fork pool runs them
 * concurrently (each file = its own fork). This is the fast path that keeps
 * the FULL matrix — no coverage cut. `GOLDEN_SMOKE=1` collapses to the
 * 6-scenario representative subset on this shard only.
 *
 * Shard mechanics + the smoke subset live in `./replay_shard.ts`.
 */
import { defineReplayShard, SHARD_COUNT } from './replay_shard.js';

defineReplayShard(0, SHARD_COUNT);
