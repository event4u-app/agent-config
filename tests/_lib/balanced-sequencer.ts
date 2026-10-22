/**
 * Duration-balanced shards for `vitest --shard=i/n`.
 *
 * Vitest's own `shard()` slices the SHA1-sorted file list by COUNT, so one
 * heavy file (build_proof's `render()`) lands wherever its hash falls and that
 * shard decides when the matrix finishes. This assigns files by measured
 * seconds instead, longest first onto the lightest shard — every shard computes
 * the same assignment from the same file list, so every file still runs in
 * exactly one shard.
 *
 * Active only when `VITEST_BALANCED_SHARDS=1` (CI sets it); otherwise, and
 * whenever `--shard` is absent, the base sequencer decides unchanged.
 * Weights come from `tests/timing-manifest.json`, refreshed by
 * `./scripts-run src/scripts/plan_test_shards`.
 */
import { readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';

import { BaseSequencer, type TestSpecification } from 'vitest/node';

export interface TimingManifest {
    readonly ubuntu: Readonly<Record<string, number>>;
    readonly macos: Readonly<Record<string, number>>;
}

/** Median of the known weights; a file the manifest has never seen gets this, never zero. */
export function medianWeight(weights: Readonly<Record<string, number>>): number {
    const v = Object.values(weights).sort((a, b) => a - b);
    if (v.length === 0) return 1;
    const mid = Math.floor(v.length / 2);
    return v.length % 2 === 1 ? (v[mid] as number) : ((v[mid - 1] as number) + (v[mid] as number)) / 2;
}

/**
 * Longest-processing-time assignment of `files` to `count` shards. Ties break on
 * the path and on the lower shard index, so the result depends only on the input.
 */
export function assignShards(
    files: readonly string[],
    count: number,
    weights: Readonly<Record<string, number>>,
): string[][] {
    const fallback = medianWeight(weights);
    const weighted = [...new Set(files)]
        .map((f) => ({ f, w: weights[f] ?? fallback }))
        .sort((a, b) => b.w - a.w || (a.f < b.f ? -1 : a.f > b.f ? 1 : 0));
    const shards: string[][] = Array.from({ length: count }, () => []);
    const load: number[] = new Array<number>(count).fill(0);
    for (const { f, w } of weighted) {
        let best = 0;
        for (let i = 1; i < count; i++) if ((load[i] as number) < (load[best] as number)) best = i;
        (shards[best] as string[]).push(f);
        load[best] = (load[best] as number) + w;
    }
    return shards;
}

export function osKey(platform: NodeJS.Platform = process.platform): keyof TimingManifest {
    return platform === 'darwin' ? 'macos' : 'ubuntu';
}

export default class BalancedSequencer extends BaseSequencer {
    override async shard(files: TestSpecification[]): Promise<TestSpecification[]> {
        const shard = this.ctx.config.shard;
        if (process.env['VITEST_BALANCED_SHARDS'] !== '1' || !shard) return super.shard(files);
        const root = this.ctx.config.root;
        const manifest = JSON.parse(
            readFileSync(resolve(root, 'tests/timing-manifest.json'), 'utf-8'),
        ) as TimingManifest;
        const keyOf = (spec: TestSpecification): string => relative(root, spec.moduleId).split('\\').join('/');
        const mine = new Set(assignShards(files.map(keyOf), shard.count, manifest[osKey()])[shard.index - 1]);
        return files.filter((spec) => mine.has(keyOf(spec)));
    }
}
