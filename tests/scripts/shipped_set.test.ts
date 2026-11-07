/**
 * The prepack check models the npm package from package.json `files`. npm honours
 * `!`-negated entries; a model that did not would scan files that never ship and
 * miss a shipped import of one that no longer does.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { shippedSet } from '../../src/scripts/_lib/shipped_set.mjs';

describe('shippedSet', () => {
    const set = shippedSet(['src/scripts/', 'AGENTS.md', 'docs/contracts/*.md', '!src/scripts/release.ts', '!src/scripts/bench_*']);
    it('ships a directory prefix, an exact file and a glob', () => {
        expect(set.isShipped('src/scripts/check_claims.ts')).toBe(true);
        expect(set.isShipped('AGENTS.md')).toBe(true);
        expect(set.isShipped('docs/contracts/a.md')).toBe(true);
        expect(set.isShipped('docs/contracts/sub/a.md')).toBe(false);
        expect(set.isShipped('README.md')).toBe(false);
    });
    it('a negated entry removes a file the directory would otherwise ship, and only that file', () => {
        expect(set.isShipped('src/scripts/release.ts')).toBe(false);
        expect(set.isShipped('src/scripts/release_drill.ts')).toBe(true);
        expect(set.isShipped('src/scripts/bench_x.ts')).toBe(false);
        expect(set.isShipped('src/scripts/_lib/bench_x.ts')).toBe(true);
    });
    it('the real package ships no bench file and keeps the files the council path needs', () => {
        const files = (JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '..', '..', 'package.json'), 'utf-8')) as { files: string[] }).files;
        const real = shippedSet(files);
        expect(real.isShipped('internal/bench/core/bench_ab_v2_run.ts')).toBe(false);
        expect(real.isShipped('src/scripts/check_quality_regression.ts')).toBe(true);
        expect(real.isShipped('src/scripts/ai_council/jury_aggregate.ts')).toBe(true);
        expect(real.isShipped('src/scripts/showcase_run.ts')).toBe(false);
    });
});
