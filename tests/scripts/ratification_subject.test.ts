import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import {
    gatedFilesOf,
    subjectDigest,
    DELETED_MARKER,
} from '../../src/scripts/_lib/ratification_subject.js';

function tmpTree(files: Readonly<Record<string, string>>): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'subj-'));
    for (const [rel, body] of Object.entries(files)) {
        const abs = path.join(root, rel);
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, body);
    }
    return root;
}

const KERNEL = 'src/rules/commit-policy.md';
const UNGATED = 'docs/contracts/ratification-artifact.md';

describe('2.1 — the gated set, assembled from the gate’s own constants', () => {
    it('keeps a kernel rule and drops an ungated file', () => {
        const g = gatedFilesOf([KERNEL, UNGATED, 'README.md']);
        expect(g).toContain(KERNEL);
        expect(g).not.toContain(UNGATED);
        expect(g).not.toContain('README.md');
    });

    it('keeps a self path — which `classifyPaths` reports only as a boolean', () => {
        const g = gatedFilesOf(['src/scripts/check_kernel_edit_ratified.ts', 'README.md']);
        expect(g).toEqual(['src/scripts/check_kernel_edit_ratified.ts']);
    });

    it('is sorted and deduplicated, so a caller’s order cannot change the digest', () => {
        const a = gatedFilesOf([KERNEL, 'src/config/ratification-policy.json']);
        const b = gatedFilesOf(['src/config/ratification-policy.json', KERNEL, KERNEL]);
        expect(a).toEqual(b);
        expect([...a]).toEqual([...a].sort());
    });
});

describe('2.1 — the digest binds paths AND contents', () => {
    it('is stable across repeated calls on an unchanged tree', () => {
        const root = tmpTree({ [KERNEL]: 'one\n' });
        expect(subjectDigest(root, [KERNEL])).toBe(subjectDigest(root, [KERNEL]));
    });

    it('MOVES when one byte of a gated file changes', () => {
        const root = tmpTree({ [KERNEL]: 'one\n' });
        const before = subjectDigest(root, [KERNEL]);
        fs.writeFileSync(path.join(root, KERNEL), 'onf\n');
        expect(subjectDigest(root, [KERNEL])).not.toBe(before);
    });

    it('does NOT move when an ungated file changes', () => {
        const root = tmpTree({ [KERNEL]: 'one\n', [UNGATED]: 'a\n' });
        const before = subjectDigest(root, [KERNEL, UNGATED]);
        fs.writeFileSync(path.join(root, UNGATED), 'b\n');
        expect(subjectDigest(root, [KERNEL, UNGATED])).toBe(before);
    });

    it('a deleted gated file is entered as deleted, not skipped', () => {
        const present = tmpTree({ [KERNEL]: 'one\n' });
        const absent = tmpTree({ 'README.md': 'x\n' });
        const withDeleted = subjectDigest(absent, [KERNEL]);
        // Deleting is not the same as never having been in the set …
        expect(withDeleted).not.toBe(subjectDigest(present, [KERNEL]));
        // … and not the same as an empty gated set either.
        expect(withDeleted).not.toBe(subjectDigest(absent, []));
        expect(DELETED_MARKER.length).toBeGreaterThan(0);
    });

    it('two different paths with identical content do not collide', () => {
        const a = tmpTree({ [KERNEL]: 'same\n' });
        const b = tmpTree({ 'src/rules/scope-control.md': 'same\n' });
        expect(subjectDigest(a, [KERNEL])).not.toBe(
            subjectDigest(b, ['src/rules/scope-control.md']),
        );
    });

    it('renaming a file changes the digest even with identical bytes', () => {
        const root = tmpTree({ [KERNEL]: 'same\n', 'src/rules/scope-control.md': 'same\n' });
        expect(subjectDigest(root, [KERNEL])).not.toBe(
            subjectDigest(root, ['src/rules/scope-control.md']),
        );
    });

    it('an empty gated set has a digest of its own rather than throwing', () => {
        const root = tmpTree({ 'README.md': 'x\n' });
        expect(subjectDigest(root, [])).toMatch(/^[0-9a-f]{64}$/);
    });
});
