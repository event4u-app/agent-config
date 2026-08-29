/**
 * Tests for `src/scripts/_lib/source_snapshot_dedup.ts` — provenance-aware
 * deduplication of R2 review-snapshot mirrors (`road-to-source-silence` 3.4).
 *
 * The AI council refused a blanket tier-lowering for the snapshot corpus and
 * named the exact reason: it asserted a mirror relationship without verifying
 * it. So the polarity that matters here is NOT "does a mirror get excluded" —
 * it is **does a non-mirror stay at block**. Every fail-closed branch has its
 * own case, and the five shapes the council asked for are named in the
 * describe blocks: moved content, generated projections, unrelated identical
 * values, deleted-only findings, and real external-looking slugs.
 *
 * Sensitivity was probed rather than assumed: neutralising the
 * `owners.size === 0` guard (returning `excluded: true` unconditionally) reds
 * the five fail-closed cases; neutralising the hunk-target lookup reds the leg
 * attribution cases. A green suite over an inert predicate would say nothing.
 *
 * Every token below is invented. Nothing in this file names a real source.
 */
import { describe, expect, it } from 'vitest';

import {
    dedupVerdict,
    findingKey,
    hunkTargets,
    isSnapshotPatch,
    isSnapshotPath,
    type DedupInput,
} from '../../src/scripts/_lib/source_snapshot_dedup.js';

const SNAP = 'agents/evidence/reviews/feat-example.review-input/diff.patch';
const SNAP_SIBLING = 'agents/evidence/reviews/feat-example.review-input/roadmap.md';

/** An input where `cls`/`value` is block-counted in each of `owners`. */
function inputWith(
    owners: Record<string, readonly string[]>,
    targets: Record<string, ReadonlyArray<readonly [number, string]>> = {},
    tracked: readonly string[] = [],
): DedupInput {
    return {
        blockIndex: new Map(Object.entries(owners).map(([k, v]) => [k, new Set(v)])),
        targets: new Map(Object.entries(targets).map(([k, v]) => [k, new Map(v)])),
        trackedPaths: new Set(tracked),
    };
}

describe('path predicates', () => {
    it('recognises a snapshot member and its patch', () => {
        expect(isSnapshotPath(SNAP)).toBe(true);
        expect(isSnapshotPath(SNAP_SIBLING)).toBe(true);
        expect(isSnapshotPatch(SNAP)).toBe(true);
        expect(isSnapshotPatch(SNAP_SIBLING)).toBe(false);
    });

    it('does not treat an ordinary roadmap as a snapshot', () => {
        expect(isSnapshotPath('agents/roadmaps/road-to-example.md')).toBe(false);
        expect(isSnapshotPath('agents/evidence/reviews/example.findings.md')).toBe(false);
    });
});

describe('hunkTargets', () => {
    it('attributes each line to the post-image path of its hunk', () => {
        const patch = [
            'diff --git a/src/one.ts b/src/one.ts',
            '--- a/src/one.ts',
            '+++ b/src/one.ts',
            '@@ -1 +1 @@',
            '+first',
            'diff --git a/src/two.ts b/src/two.ts',
            '--- a/src/two.ts',
            '+++ b/src/two.ts',
            '@@ -1 +1 @@',
            '+second',
        ].join('\n');
        const t = hunkTargets(patch);
        expect(t.get(5)).toBe('src/one.ts');
        expect(t.get(10)).toBe('src/two.ts');
    });

    it('leaves a deleted-only hunk unattributed — /dev/null is not a target', () => {
        const patch = ['--- a/src/gone.ts', '+++ /dev/null', '@@ -1 +0,0 @@', '-was here'].join('\n');
        expect(hunkTargets(patch).get(4)).toBeUndefined();
    });
});

describe('excludes only an EARNED mirror', () => {
    it('hunk leg — identical value block-counted in the file this hunk targets', () => {
        const v = dedupVerdict(
            { file: SNAP, line: 5, cls: 'tmp-quote', value: 'some-round' },
            inputWith(
                { [findingKey('tmp-quote', 'some-round')]: ['agents/roadmaps/road-to-x.md'] },
                { [SNAP]: [[5, 'agents/roadmaps/road-to-x.md']] },
                ['agents/roadmaps/road-to-x.md'],
            ),
        );
        expect(v).toMatchObject({ excluded: true, leg: 'hunk', matchedPath: 'agents/roadmaps/road-to-x.md' });
    });

    it('tree leg — MOVED CONTENT: counted in a different file than the hunk targets', () => {
        const v = dedupVerdict(
            { file: SNAP, line: 5, cls: 'tmp-quote', value: 'some-round' },
            inputWith(
                { [findingKey('tmp-quote', 'some-round')]: ['agents/roadmaps/archive/road-to-y.md'] },
                { [SNAP]: [[5, 'agents/roadmaps/road-to-x.md']] },
                ['agents/roadmaps/road-to-x.md', 'agents/roadmaps/archive/road-to-y.md'],
            ),
        );
        expect(v).toMatchObject({ excluded: true, leg: 'tree' });
        expect(v.matchedPath).toBe('agents/roadmaps/archive/road-to-y.md');
    });

    it('tree leg — GENERATED PROJECTION: the hunk targets dist, the count lives in src', () => {
        const v = dedupVerdict(
            { file: SNAP, line: 9, cls: 'source-header', value: 'a speaking value' },
            inputWith(
                { [findingKey('source-header', 'a speaking value')]: ['agents/roadmaps/road-to-x.md'] },
                { [SNAP]: [[9, 'dist/agent-src/rules/example.md']] },
                ['agents/roadmaps/road-to-x.md', 'dist/agent-src/rules/example.md'],
            ),
        );
        expect(v).toMatchObject({ excluded: true, leg: 'tree' });
    });

    it('a non-patch snapshot member takes the tree leg — it carries no hunk targets', () => {
        const v = dedupVerdict(
            { file: SNAP_SIBLING, line: 3, cls: 'tmp-quote', value: 'some-round' },
            inputWith({ [findingKey('tmp-quote', 'some-round')]: ['agents/roadmaps/road-to-x.md'] }),
        );
        expect(v).toMatchObject({ excluded: true, leg: 'tree' });
    });
});

describe('fails closed — the polarity the council asked for', () => {
    it('UNRELATED IDENTICAL VALUE is not enough when nothing is block-counted', () => {
        const v = dedupVerdict(
            { file: SNAP, line: 5, cls: 'repo-slug', value: 'realish-owner/realish-repo' },
            inputWith({}),
        );
        expect(v.excluded).toBe(false);
        expect(v.reason).toContain('no independent block-counted occurrence');
    });

    it('a REAL EXTERNAL-LOOKING SLUG unique to the snapshot stays at block', () => {
        const v = dedupVerdict(
            { file: SNAP, line: 12, cls: 'repo-slug', value: 'plausible-org/plausible-tool' },
            inputWith(
                { [findingKey('repo-slug', 'a-different-org/a-different-tool')]: ['agents/roadmaps/road-to-x.md'] },
                { [SNAP]: [[12, 'agents/roadmaps/road-to-x.md']] },
                ['agents/roadmaps/road-to-x.md'],
            ),
        );
        expect(v.excluded).toBe(false);
    });

    it('CLASS must match exactly — same value, different class, no exclusion', () => {
        const v = dedupVerdict(
            { file: SNAP, line: 5, cls: 'repo-slug', value: 'same-value' },
            inputWith({ [findingKey('tmp-quote', 'same-value')]: ['agents/roadmaps/road-to-x.md'] }),
        );
        expect(v.excluded).toBe(false);
    });

    it('DELETED-ONLY finding: no hunk target and no tree match stays at block', () => {
        const v = dedupVerdict(
            { file: SNAP, line: 4, cls: 'tmp-quote', value: 'deleted-round' },
            inputWith({}, { [SNAP]: [] }, []),
        );
        expect(v.excluded).toBe(false);
    });

    it('an UNTRACKED hunk target cannot carry the hunk leg', () => {
        const v = dedupVerdict(
            { file: SNAP, line: 5, cls: 'tmp-quote', value: 'some-round' },
            inputWith(
                { [findingKey('tmp-quote', 'some-round')]: ['agents/roadmaps/deleted-since.md'] },
                { [SNAP]: [[5, 'agents/roadmaps/deleted-since.md']] },
                [],
            ),
        );
        expect(v.excluded).toBe(false);
        expect(v.reason).toContain('not a tracked path');
    });

    it('a finding OUTSIDE a snapshot is never a dedup candidate', () => {
        const v = dedupVerdict(
            { file: 'agents/roadmaps/road-to-x.md', line: 1, cls: 'tmp-quote', value: 'some-round' },
            inputWith({ [findingKey('tmp-quote', 'some-round')]: ['agents/roadmaps/road-to-y.md'] }),
        );
        expect(v.excluded).toBe(false);
        expect(v.reason).toBe('not a snapshot finding');
    });

    it('an empty owner set is treated as no match, not as a match', () => {
        const v = dedupVerdict(
            { file: SNAP, line: 5, cls: 'tmp-quote', value: 'some-round' },
            { blockIndex: new Map([[findingKey('tmp-quote', 'some-round'), new Set<string>()]]), targets: new Map(), trackedPaths: new Set() },
        );
        expect(v.excluded).toBe(false);
    });
});

describe('the shipped gate wiring', () => {
    it('the diff.patch carve-out is gone from skip_paths', async () => {
        const fs = await import('node:fs');
        const cfg = JSON.parse(
            fs.readFileSync('src/scripts/external_sources_denylist.json', 'utf-8'),
        ) as { skip_paths: string[] };
        expect(cfg.skip_paths).not.toContain('agents/evidence/reviews/*.review-input/diff.patch');
    });

    it('skip_paths is at or below the measured floor of 22 entries', async () => {
        const fs = await import('node:fs');
        const cfg = JSON.parse(
            fs.readFileSync('src/scripts/external_sources_denylist.json', 'utf-8'),
        ) as { skip_paths: string[] };
        expect(cfg.skip_paths.length).toBeLessThanOrEqual(22);
    });
});
