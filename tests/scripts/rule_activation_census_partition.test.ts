/**
 * The census must not report a divergence that the delivery partition explains.
 *
 * `--projection` compares a host tree's `paths:` count against the source
 * verdict. The source verdict counts every rule in `src/rules/`; a delivered
 * tree does not carry the package-only ones, because ADR-236 partitions those
 * to the project layer. Before the subtraction existed, a correctly-emitted,
 * globally-partitioned projection reported ⚠️ divergence permanently — measured
 * 2026-08-30: source 4 scoped, projection 3, one of the four (`source-of-truth`)
 * package-only.
 *
 * Both polarities are pinned. A gate that only proves it stays quiet has not
 * been shown to fire.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { census } from '../../src/scripts/rule_activation_census.js';

const REPO_ROOT = path.resolve(__dirname, '../..');

function runCensus(projectionDir: string): string {
    return execFileSync(
        path.join(REPO_ROOT, 'node_modules/.bin/tsx'),
        [path.join(REPO_ROOT, 'src/scripts/rule_activation_census.ts'), '--projection', projectionDir],
        { cwd: REPO_ROOT, encoding: 'utf-8', env: { ...process.env, TMPDIR: '/tmp' } },
    );
}

/** A projection carrying exactly `n` files that declare `paths:`. */
function makeProjection(withPaths: number, total: number): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'census-proj-'));
    for (let i = 0; i < total; i += 1) {
        const body = i < withPaths ? '---\npaths:\n  - "*.vue"\n---\n\nBody.\n' : 'Body.\n';
        fs.writeFileSync(path.join(dir, `rule-${i}.md`), body);
    }
    return dir;
}

describe('census() package_only classification', () => {
    it('marks at least one scoped rule package-only — the case the subtraction exists for', () => {
        const rows = census(REPO_ROOT);
        const scoped = rows.filter((r) => r.verdict === 'scoped');
        expect(scoped.length).toBeGreaterThan(0);
        const pkgOnly = scoped.filter((r) => r.package_only);
        expect(pkgOnly.map((r) => r.id)).toContain('source-of-truth');
        // And it must NOT mark every scoped rule package-only, or the
        // subtraction would silently expect zero and never diverge again.
        expect(pkgOnly.length).toBeLessThan(scoped.length);
    });
});

describe('--projection divergence reporting', () => {
    const rows = census(REPO_ROOT);
    const scoped = rows.filter((r) => r.verdict === 'scoped');
    const expectedDelivered = scoped.filter((r) => !r.package_only).length;

    it('stays quiet when the projection matches the partition-adjusted count', () => {
        const dir = makeProjection(expectedDelivered, expectedDelivered + 3);
        try {
            const out = runCensus(dir);
            expect(out).toContain('consistent with the source verdict');
            expect(out).not.toContain('⚠️  diverges');
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });

    it('STILL fires on a real divergence — one fewer scoped file than delivery expects', () => {
        const dir = makeProjection(expectedDelivered - 1, expectedDelivered + 3);
        try {
            const out = runCensus(dir);
            expect(out).toContain('⚠️  diverges');
            expect(out).not.toContain('consistent with the source verdict');
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });

    it('names the withheld rules so a reader can check the subtraction', () => {
        const dir = makeProjection(expectedDelivered, expectedDelivered + 3);
        try {
            const out = runCensus(dir);
            expect(out).toContain('package-only and never');
            expect(out).toContain('source-of-truth');
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });
});
