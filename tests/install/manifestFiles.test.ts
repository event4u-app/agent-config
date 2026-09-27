// The manifest `files[]` inventory: what a run records, and what it must not
// erase. Every expectation here is derived from the fixture inputs.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    filesByToolFromDeploy,
    hydrateRecordedInventories,
    preservedIndex,
    readRecordedByTool,
    reconcileToolFiles,
    type ManifestFileEntry,
} from '../../src/install/manifestFiles.js';
import { sidecarPathFor } from '../../src/install/preserve.js';

describe('filesByToolFromDeploy', () => {
    it('records what a deployed tool wrote', () => {
        const out = filesByToolFromDeploy({ a: [1, 0, 'deployed', ['/x/one.md']] });
        expect(out['a']).toEqual([{ path: '/x/one.md', kind: 'deployed', sha256: null }]);
    });

    it('says NOTHING — not "no files" — for a tool whose deploy failed', () => {
        // The difference is the defect: an empty list replaces the recorded
        // inventory and erases every digest the tool had.
        const out = filesByToolFromDeploy({ a: [0, 0, 'deploy_failed', []] });
        expect(out['a']).toBeNull();
    });
});

describe('reconcileToolFiles', () => {
    const entry = (p: string, sha: string): ManifestFileEntry => ({
        path: p,
        kind: 'deployed',
        sha256: sha,
    });
    const inventory = (...files: ManifestFileEntry[]) => ({
        files: files.map((e) => ({ entry: e, resolved: path.resolve(String(e['path'])) })),
        mergedKeys: [],
    });

    it('carries the whole previous inventory when this run learned nothing', () => {
        const prior = inventory(entry('/x/one.md', 'aaa'));
        expect(reconcileToolFiles(null, prior, new Map())).toEqual([
            entry('/x/one.md', 'aaa'),
        ]);
    });

    it('keeps a preserved path recorded, with the digest it had before', () => {
        const prior = inventory(entry('/x/kept.md', 'aaa'), entry('/x/other.md', 'bbb'));
        const out = reconcileToolFiles(
            [entry('/x/other.md', 'ccc')],
            prior,
            preservedIndex(['/x/kept.md'], new Map()),
        );

        // The fresh entry wins for a path this run rewrote; the preserved one
        // survives untouched, because its digest is what proves the file on
        // disk is a user edit rather than ours.
        expect(out).toContainEqual(entry('/x/other.md', 'ccc'));
        expect(out).toContainEqual(entry('/x/kept.md', 'aaa'));
        expect(out).not.toContainEqual(entry('/x/other.md', 'bbb'));
    });

    it('records the staged sidecar beside its preserved target', () => {
        const target = '/x/kept.md';
        const prior = inventory(entry(target, 'aaa'));
        const staged = new Map([[sidecarPathFor(target), 'sidecarsha']]);

        const out = reconcileToolFiles([], prior, preservedIndex([target], staged));

        expect(out).toContainEqual({
            path: sidecarPathFor(target),
            kind: 'sidecar',
            sha256: 'sidecarsha',
        });
    });

    it('does not duplicate a preserved path this run also wrote', () => {
        const prior = inventory(entry('/x/one.md', 'aaa'));
        const out = reconcileToolFiles(
            [entry('/x/one.md', 'ccc')],
            prior,
            preservedIndex(['/x/one.md'], new Map()),
        );
        expect(out).toHaveLength(1);
    });
});

describe('readRecordedByTool / hydrateRecordedInventories', () => {
    let root: string;
    let manifest: string;

    beforeEach(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'manifestfiles-'));
        manifest = path.join(root, 'installed-tools.lock');
    });
    afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

    it('resolves a relative recorded path against the project root', () => {
        fs.writeFileSync(
            manifest,
            'tools:\n  - name: a\n    files:\n      - path: sub/one.md\n        sha256: "aaa"\n',
        );
        const got = readRecordedByTool(manifest, root).get('a');
        expect(got?.files[0]?.resolved).toBe(path.resolve(root, 'sub/one.md'));
    });

    it('answers empty for a malformed manifest rather than throwing', () => {
        fs.writeFileSync(manifest, ':\n  - [unbalanced\n');
        expect(readRecordedByTool(manifest, root).size).toBe(0);
    });

    it('restores an inventory the degraded parser dropped', () => {
        fs.writeFileSync(
            manifest,
            'tools:\n  - name: a\n    files:\n      - path: /x/one.md\n        sha256: "aaa"\n',
        );
        // What `installed_tools.read_manifest` hands back: the scalars, and
        // empty nested lists whatever the file actually held.
        const degraded = [{ name: 'a', scope: 'project', files: [], merged_keys: [] }];

        hydrateRecordedInventories(degraded, readRecordedByTool(manifest, root));

        expect(degraded[0]?.['files']).toEqual([{ path: '/x/one.md', sha256: 'aaa' }]);
    });

    it('never overwrites an inventory the caller already filled in', () => {
        fs.writeFileSync(
            manifest,
            'tools:\n  - name: a\n    files:\n      - path: /x/old.md\n        sha256: "aaa"\n',
        );
        const fresh = [{ name: 'a', files: [{ path: '/x/new.md' }], merged_keys: [] }];

        hydrateRecordedInventories(fresh, readRecordedByTool(manifest, root));

        expect(fresh[0]?.['files']).toEqual([{ path: '/x/new.md' }]);
    });
});
