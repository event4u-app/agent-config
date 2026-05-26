import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { applyPlan } from '../../src/install/apply.js';
import { buildInstallPlan } from '../../src/install/plan.js';
import type { ConflictPolicy, InstallPlan } from '../../src/install/types.js';

const POLICY: ConflictPolicy = {
    force: false,
    interactive: false,
    knownPaths: new Set(),
    knownPointers: new Set(),
    defaultStrategy: 'skip',
};

function hex(s: string): string {
    return createHash('sha256').update(s).digest('hex');
}

function sourceMapFromPlan(plan: InstallPlan, srcDir: string, destDir: string): Map<string, string> {
    const map = new Map<string, string>();
    for (const entries of Object.values(plan.filesByTool)) {
        for (const entry of entries) {
            const rel = entry.path.slice(destDir.length + 1);
            map.set(entry.path, join(srcDir, rel));
        }
    }
    return map;
}

describe('apply — applyPlan', () => {
    let root: string;
    let src: string;
    let dest: string;
    let logPath: string;

    beforeEach(() => {
        root = mkdtempSync(join(tmpdir(), 'apply-'));
        src = join(root, 'src');
        dest = join(root, 'dest');
        logPath = join(root, 'install-log.jsonl');
        mkdirSync(src, { recursive: true });
        mkdirSync(dest, { recursive: true });
    });

    afterEach(() => {
        rmSync(root, { recursive: true, force: true });
    });

    it('writes every planned file and appends one txlog entry per write', () => {
        writeFileSync(join(src, 'a.txt'), 'hello');
        writeFileSync(join(src, 'b.txt'), 'world');
        const plan = buildInstallPlan({
            target: 'global',
            root: dest,
            sources: [{ toolId: 'augment', srcDir: src, destDir: dest, kind: 'deployed' }],
            policy: POLICY,
        });
        const result = applyPlan({ plan, sourceByTarget: sourceMapFromPlan(plan, src, dest), logPath });
        expect(result.written.length).toBe(2);
        expect(result.errors.length).toBe(0);
        expect(readFileSync(join(dest, 'a.txt'), 'utf8')).toBe('hello');
        expect(readFileSync(join(dest, 'b.txt'), 'utf8')).toBe('world');
        const lines = readFileSync(logPath, 'utf8').trim().split('\n');
        expect(lines.length).toBe(2);
        expect(JSON.parse(lines[0]!).kind).toBe('write');
    });

    it('skips files whose target already matches the planned hash (idempotent)', () => {
        writeFileSync(join(src, 'a.txt'), 'hi');
        writeFileSync(join(dest, 'a.txt'), 'hi'); // pre-existing match
        const plan = buildInstallPlan({
            target: 'global',
            root: dest,
            sources: [{ toolId: 'augment', srcDir: src, destDir: dest, kind: 'deployed' }],
            policy: POLICY,
        });
        const result = applyPlan({ plan, sourceByTarget: sourceMapFromPlan(plan, src, dest), logPath });
        expect(result.skipped.length).toBe(1);
        expect(result.written.length).toBe(0);
        expect(existsSync(logPath)).toBe(false);
    });

    it('force=true bypasses the idempotency check', () => {
        writeFileSync(join(src, 'a.txt'), 'hi');
        writeFileSync(join(dest, 'a.txt'), 'hi');
        const plan = buildInstallPlan({
            target: 'global',
            root: dest,
            sources: [{ toolId: 'augment', srcDir: src, destDir: dest, kind: 'deployed' }],
            policy: { ...POLICY, force: true },
        });
        const result = applyPlan({ plan, sourceByTarget: sourceMapFromPlan(plan, src, dest), logPath });
        expect(result.written.length).toBe(1);
        expect(result.skipped.length).toBe(0);
    });

    it('bridges are recorded as skipped (writer pass owns them in A6)', () => {
        writeFileSync(join(src, 'm.md'), 'pointer');
        const plan = buildInstallPlan({
            target: 'project',
            root: dest,
            sources: [{ toolId: 'cursor', srcDir: src, destDir: dest, kind: 'bridge' }],
            policy: POLICY,
        });
        const result = applyPlan({ plan, sourceByTarget: sourceMapFromPlan(plan, src, dest), logPath });
        expect(result.skipped.length).toBe(1);
        expect(result.written.length).toBe(0);
    });

    it('missing source mapping surfaces an E_PLAN_MISSING_SOURCE error', () => {
        writeFileSync(join(src, 'a.txt'), 'hi');
        const plan = buildInstallPlan({
            target: 'global',
            root: dest,
            sources: [{ toolId: 'augment', srcDir: src, destDir: dest, kind: 'deployed' }],
            policy: POLICY,
        });
        const result = applyPlan({ plan, sourceByTarget: new Map(), logPath });
        expect(result.errors.length).toBe(1);
        expect(result.errors[0]!.code).toBe('E_PLAN_MISSING_SOURCE');
    });

    it('emits one onProgress callback per file', () => {
        writeFileSync(join(src, 'a.txt'), 'x');
        writeFileSync(join(src, 'b.txt'), 'y');
        const plan = buildInstallPlan({
            target: 'global',
            root: dest,
            sources: [{ toolId: 'augment', srcDir: src, destDir: dest, kind: 'deployed' }],
            policy: POLICY,
        });
        const events: string[] = [];
        applyPlan({
            plan,
            sourceByTarget: sourceMapFromPlan(plan, src, dest),
            logPath,
            onProgress: (p) => events.push(p.status),
        });
        expect(events).toEqual(['written', 'written']);
    });

    it('the txlog entry sha256 matches the planned hash', () => {
        writeFileSync(join(src, 'a.txt'), 'hello');
        const plan = buildInstallPlan({
            target: 'global',
            root: dest,
            sources: [{ toolId: 'augment', srcDir: src, destDir: dest, kind: 'deployed' }],
            policy: POLICY,
        });
        applyPlan({ plan, sourceByTarget: sourceMapFromPlan(plan, src, dest), logPath });
        const line = readFileSync(logPath, 'utf8').trim().split('\n')[0]!;
        expect(JSON.parse(line).sha256).toBe(hex('hello'));
    });

    it('surfaces foreign collisions as conflicts (no write, no error)', () => {
        writeFileSync(join(src, 'a.txt'), 'planned');
        writeFileSync(join(dest, 'a.txt'), 'foreign'); // exists, not in knownPaths
        const plan = buildInstallPlan({
            target: 'global',
            root: dest,
            sources: [{ toolId: 'augment', srcDir: src, destDir: dest, kind: 'deployed' }],
            policy: POLICY,
        });
        const result = applyPlan({
            plan,
            sourceByTarget: sourceMapFromPlan(plan, src, dest),
            logPath,
        });
        expect(result.conflicts.length).toBe(1);
        expect(result.written.length).toBe(0);
        expect(result.errors.length).toBe(0);
        expect(readFileSync(join(dest, 'a.txt'), 'utf8')).toBe('foreign');
    });

    it('known-path collisions skip without surfacing', () => {
        writeFileSync(join(src, 'a.txt'), 'planned');
        writeFileSync(join(dest, 'a.txt'), 'ours');
        const plan = buildInstallPlan({
            target: 'global',
            root: dest,
            sources: [{ toolId: 'augment', srcDir: src, destDir: dest, kind: 'deployed' }],
            policy: { ...POLICY, knownPaths: new Set([join(dest, 'a.txt')]) },
        });
        const result = applyPlan({
            plan,
            sourceByTarget: sourceMapFromPlan(plan, src, dest),
            logPath,
        });
        expect(result.skipped.length).toBe(1);
        expect(result.conflicts.length).toBe(0);
        expect(result.written.length).toBe(0);
    });

    it('deep-merges JSON targets that already exist on disk', () => {
        writeFileSync(
            join(src, 'settings.json'),
            JSON.stringify({ hooks: ['new'], theme: 'dark' }),
        );
        writeFileSync(
            join(dest, 'settings.json'),
            JSON.stringify({ hooks: ['old'], language: 'en' }),
        );
        const plan = buildInstallPlan({
            target: 'project',
            root: dest,
            sources: [{ toolId: 'claude', srcDir: src, destDir: dest, kind: 'deployed' }],
            policy: { ...POLICY, force: true }, // bypass surface, force the merge
        });
        const result = applyPlan({
            plan,
            sourceByTarget: sourceMapFromPlan(plan, src, dest),
            logPath,
        });
        expect(result.written.length).toBe(1);
        const merged = JSON.parse(readFileSync(join(dest, 'settings.json'), 'utf8'));
        expect(merged).toEqual({ hooks: ['new'], theme: 'dark', language: 'en' });
    });
});
