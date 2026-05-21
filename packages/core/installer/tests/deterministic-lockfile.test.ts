/**
 * Determinism guard: given the same manifest, the same workspace + pack
 * selection, and the same clock, two independent `executeInstallPlan`
 * runs MUST produce byte-identical lockfile YAML. Drift here breaks
 * `sync` and `validate` for every consumer.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { computeInstallPlan, executeInstallPlan } from '../src/install-plan.js';
import { lockfileToYaml } from '../src/lockfile.js';
import { resolvePacks } from '../src/resolver.js';
import { makeArtefact, makeManifest, makePack } from './_fixtures.js';

describe('deterministic lockfile output', () => {
    let pkgA: string;
    let pkgB: string;
    let projA: string;
    let projB: string;

    beforeEach(() => {
        pkgA = mkdtempSync(join(tmpdir(), 'installer-detA-pkg-'));
        pkgB = mkdtempSync(join(tmpdir(), 'installer-detB-pkg-'));
        projA = mkdtempSync(join(tmpdir(), 'installer-detA-proj-'));
        projB = mkdtempSync(join(tmpdir(), 'installer-detB-proj-'));
    });

    afterEach(() => {
        for (const dir of [pkgA, pkgB, projA, projB]) {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    function writeSource(pkgRoot: string, manifestPath: string, content: string): void {
        const abs = join(pkgRoot, manifestPath);
        mkdirSync(dirname(abs), { recursive: true });
        writeFileSync(abs, content);
    }

    function buildFixture(pkgRoot: string): ReturnType<typeof makeManifest> {
        writeSource(pkgRoot, '.agent-src.uncompressed/rules/zebra.md', 'zebra body\n');
        writeSource(pkgRoot, '.agent-src.uncompressed/rules/alpha.md', 'alpha body\n');
        writeSource(pkgRoot, '.agent-src.uncompressed/skills/mike/SKILL.md', 'mike body\n');
        return makeManifest({
            packs: [makePack({ id: 'a' }), makePack({ id: 'b' })],
            artefacts: [
                makeArtefact({ path: '.agent-src.uncompressed/rules/zebra.md', packs: ['a'] }),
                makeArtefact({ path: '.agent-src.uncompressed/rules/alpha.md', packs: ['a', 'b'] }),
                makeArtefact({
                    path: '.agent-src.uncompressed/skills/mike/SKILL.md',
                    category: 'skill',
                    packs: ['b'],
                }),
            ],
        });
    }

    it('produces byte-identical lockfile YAML across two independent runs', () => {
        const manifestA = buildFixture(pkgA);
        const manifestB = buildFixture(pkgB);
        const resolvedA = resolvePacks(manifestA, ['a', 'b']);
        const resolvedB = resolvePacks(manifestB, ['a', 'b']);
        const planA = computeInstallPlan({
            manifest: manifestA,
            workspaces: ['engineering'],
            packs: resolvedA.packs,
            packageRoot: pkgA,
            projectRoot: projA,
        });
        const planB = computeInstallPlan({
            manifest: manifestB,
            workspaces: ['engineering'],
            packs: resolvedB.packs,
            packageRoot: pkgB,
            projectRoot: projB,
        });
        const runOpts = {
            manifestSha256: 'sha256:cafef00d',
            agentConfigVersion: '0.1.0',
            packVersion: '0.1.0',
            now: () => '2026-05-21T00:00:00Z',
        } as const;
        const resultA = executeInstallPlan({ ...runOpts, plan: planA, projectRoot: projA });
        const resultB = executeInstallPlan({ ...runOpts, plan: planB, projectRoot: projB });
        const yamlA = lockfileToYaml(resultA.lockfile);
        const yamlB = lockfileToYaml(resultB.lockfile);
        expect(yamlA).toBe(yamlB);
    });

    it('lockfile lists files in lexicographic order regardless of artefact input order', () => {
        const manifest = makeManifest({
            packs: [makePack({ id: 'a' })],
            artefacts: [
                makeArtefact({ path: '.agent-src.uncompressed/rules/zebra.md', packs: ['a'] }),
                makeArtefact({ path: '.agent-src.uncompressed/rules/alpha.md', packs: ['a'] }),
                makeArtefact({ path: '.agent-src.uncompressed/rules/mike.md', packs: ['a'] }),
            ],
        });
        writeSource(pkgA, '.agent-src.uncompressed/rules/zebra.md', 'z\n');
        writeSource(pkgA, '.agent-src.uncompressed/rules/alpha.md', 'a\n');
        writeSource(pkgA, '.agent-src.uncompressed/rules/mike.md', 'm\n');
        const resolved = resolvePacks(manifest, ['a']);
        const plan = computeInstallPlan({
            manifest,
            workspaces: ['engineering'],
            packs: resolved.packs,
            packageRoot: pkgA,
            projectRoot: projA,
        });
        const result = executeInstallPlan({
            plan,
            projectRoot: projA,
            manifestSha256: 'sha256:cafef00d',
            agentConfigVersion: '0.1.0',
            packVersion: '0.1.0',
            now: () => '2026-05-21T00:00:00Z',
        });
        const paths = result.lockfile.files.map((f) => f.path);
        expect(paths).toEqual([
            '.augment/rules/alpha.md',
            '.augment/rules/mike.md',
            '.augment/rules/zebra.md',
        ]);
    });
});
