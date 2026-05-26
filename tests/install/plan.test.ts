import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    buildInstallPlan,
    fileEntry,
    isEmptyPlan,
    sha256File,
    walkSourceTree,
} from '../../src/install/plan.js';
import type { ConflictPolicy } from '../../src/install/types.js';

const POLICY: ConflictPolicy = {
    force: false,
    interactive: false,
    knownPaths: new Set(),
    knownPointers: new Set(),
    defaultStrategy: 'skip',
};

function hex(content: string): string {
    return createHash('sha256').update(content).digest('hex');
}

describe('plan — helpers', () => {
    let root: string;

    beforeEach(() => {
        root = mkdtempSync(join(tmpdir(), 'plan-'));
    });

    afterEach(() => {
        rmSync(root, { recursive: true, force: true });
    });

    it('sha256File returns hex digest matching crypto.createHash', () => {
        const f = join(root, 'a.txt');
        writeFileSync(f, 'hello');
        expect(sha256File(f)).toBe(hex('hello'));
    });

    it('sha256File returns null for missing files', () => {
        expect(sha256File(join(root, 'nope.txt'))).toBeNull();
    });

    it('fileEntry honours hashContent flag', () => {
        const f = join(root, 'a.txt');
        writeFileSync(f, 'hi');
        expect(fileEntry(f, 'deployed', { hashContent: true })).toEqual({
            path: f,
            kind: 'deployed',
            sha256: hex('hi'),
        });
        expect(fileEntry(f, 'bridge', { hashContent: false })).toEqual({
            path: f,
            kind: 'bridge',
            sha256: null,
        });
    });

    it('walkSourceTree lists every file, sorted, recursing into subdirs', () => {
        mkdirSync(join(root, 'sub'), { recursive: true });
        writeFileSync(join(root, 'a.txt'), '');
        writeFileSync(join(root, 'b.txt'), '');
        writeFileSync(join(root, 'sub', 'c.txt'), '');
        const files = walkSourceTree(root);
        expect(files).toEqual([
            join(root, 'a.txt'),
            join(root, 'b.txt'),
            join(root, 'sub', 'c.txt'),
        ]);
    });

    it('walkSourceTree returns [] for missing dirs', () => {
        expect(walkSourceTree(join(root, 'gone'))).toEqual([]);
    });
});

describe('plan — buildInstallPlan', () => {
    let root: string;
    let src: string;
    let dest: string;

    beforeEach(() => {
        root = mkdtempSync(join(tmpdir(), 'plan-'));
        src = join(root, 'src');
        dest = join(root, 'dest');
        mkdirSync(src, { recursive: true });
        mkdirSync(dest, { recursive: true });
    });

    afterEach(() => {
        rmSync(root, { recursive: true, force: true });
    });

    it('produces v2 plan with target+root+policy preserved', () => {
        const plan = buildInstallPlan({
            target: 'global',
            root,
            sources: [],
            policy: POLICY,
        });
        expect(plan.version).toBe(2);
        expect(plan.target).toBe('global');
        expect(plan.root).toBe(root);
        expect(plan.policy).toBe(POLICY);
        expect(plan.mergedKeysByTool).toEqual({});
    });

    it('walks srcDir and emits one entry per file with rewritten target path + hash', () => {
        writeFileSync(join(src, 'a.txt'), 'hi');
        mkdirSync(join(src, 'nested'), { recursive: true });
        writeFileSync(join(src, 'nested', 'b.txt'), 'yo');
        const plan = buildInstallPlan({
            target: 'global',
            root,
            sources: [{ toolId: 'augment', srcDir: src, destDir: dest, kind: 'deployed' }],
            policy: POLICY,
        });
        const entries = plan.filesByTool['augment']!;
        expect(entries.length).toBe(2);
        expect(entries[0]!.path).toBe(join(dest, 'a.txt'));
        expect(entries[0]!.sha256).toBe(hex('hi'));
        expect(entries[1]!.path).toBe(join(dest, 'nested', 'b.txt'));
        expect(entries[1]!.sha256).toBe(hex('yo'));
    });

    it('bridges skip hashing — sha256 stays null', () => {
        writeFileSync(join(src, 'm.md'), 'pointer');
        const plan = buildInstallPlan({
            target: 'project',
            root,
            sources: [{ toolId: 'cursor', srcDir: src, destDir: dest, kind: 'bridge' }],
            policy: POLICY,
        });
        const entry = plan.filesByTool['cursor']![0]!;
        expect(entry.kind).toBe('bridge');
        expect(entry.sha256).toBeNull();
    });

    it('empty srcDir still emits the tool key with [] (shrinking-install contract)', () => {
        const plan = buildInstallPlan({
            target: 'global',
            root,
            sources: [{ toolId: 'augment', srcDir: src, destDir: dest, kind: 'deployed' }],
            policy: POLICY,
        });
        expect(plan.filesByTool['augment']).toEqual([]);
        expect(isEmptyPlan(plan)).toBe(true);
    });

    it('multiple sources for the same toolId concatenate in order', () => {
        const src2 = join(root, 'src2');
        mkdirSync(src2, { recursive: true });
        writeFileSync(join(src, 'a.txt'), 'a');
        writeFileSync(join(src2, 'b.txt'), 'b');
        const plan = buildInstallPlan({
            target: 'global',
            root,
            sources: [
                { toolId: 'augment', srcDir: src, destDir: join(dest, 'rules'), kind: 'deployed' },
                { toolId: 'augment', srcDir: src2, destDir: join(dest, 'skills'), kind: 'deployed' },
            ],
            policy: POLICY,
        });
        const entries = plan.filesByTool['augment']!;
        expect(entries.length).toBe(2);
        expect(entries[0]!.path).toBe(join(dest, 'rules', 'a.txt'));
        expect(entries[1]!.path).toBe(join(dest, 'skills', 'b.txt'));
    });

    it('isEmptyPlan returns false once any entry exists', () => {
        writeFileSync(join(src, 'a.txt'), 'x');
        const plan = buildInstallPlan({
            target: 'global',
            root,
            sources: [{ toolId: 'augment', srcDir: src, destDir: dest, kind: 'deployed' }],
            policy: POLICY,
        });
        expect(isEmptyPlan(plan)).toBe(false);
    });
});
