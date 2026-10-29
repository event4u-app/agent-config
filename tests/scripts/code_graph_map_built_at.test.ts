import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildMap } from '../../src/scripts/code_graph/map.js';
import { repoName } from '../../src/scripts/code_graph/repo_identity.js';
import { writeProvenanceFixture } from './code_graph/provenance_fixture.js';

let root: string;
let clone: string;
let mapMd: string;

beforeAll(async () => {
    root = writeProvenanceFixture();
    execFileSync('git', ['remote', 'add', 'origin', 'git@example.com:acme/shop.git'], { cwd: root });
    // A folder name that is not the repository's name: the title must not come from it.
    clone = path.join(fs.realpathSync(os.tmpdir()), `cg-folder-${process.pid}-wt`);
    fs.renameSync(root, clone);
    fs.mkdirSync(path.join(clone, 'agents'), { recursive: true });
    mapMd = fs.readFileSync(path.join((await buildMap(clone, {})).outDir, 'MAP.md'), 'utf-8');
}, 120_000);
afterAll(() => fs.rmSync(clone, { recursive: true, force: true }));

describe('honest freshness and name (4.4, H24)', () => {
    it('names the repository from its identity, not from its folder', () => {
        expect(repoName(clone)).toBe('shop');
        expect(mapMd).toMatch(/^# Map of shop\n/);
    });

    it('says "built at" with the build sha and its date, and states nothing about HEAD', () => {
        const sha = execFileSync('git', ['rev-parse', '--short=12', 'HEAD'], { cwd: clone, encoding: 'utf-8' }).trim();
        expect(mapMd).toContain(`built at \`${sha}\` · 2026-10-01`);
        expect(mapMd).not.toMatch(/graph state/);
    });

    it('falls back to the folder of the main checkout when there is no remote', () => {
        const bare = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-noremote-'));
        execFileSync('git', ['init', '-q'], { cwd: bare });
        expect(repoName(bare)).toBe(path.basename(bare));
        fs.rmSync(bare, { recursive: true, force: true });
    });
});
