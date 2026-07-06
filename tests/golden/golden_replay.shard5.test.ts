/**
 * Golden Transcript replay — shard 5 of SHARD_COUNT.
 * See `./golden_replay.test.ts` + `./replay_shard.ts` for the shard design.
 */
import { defineReplayShard, SHARD_COUNT } from './replay_shard.js';

defineReplayShard(5, SHARD_COUNT);
