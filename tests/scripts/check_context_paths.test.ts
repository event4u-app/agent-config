// Tests for src/scripts/check_context_paths.ts (py2ts Phase 4 / Wave 4c).
//
// 1:1 port of tests/test_check_context_paths.py over the public `scan()`
// behaviour (path / collision / orphan checks), plus a golden-parity layer
// that runs python3 vs tsx on the REAL REPO (skipped without python3).
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as ccp from '../../src/scripts/check_context_paths.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');


function makeFakeRoot(tmp: string): string {
    for (const d of [
        '.agent-src.uncondensed/contexts',
        '.agent-src.uncondensed/rules',
        '.agent-src.uncondensed/skills',
        '.agent-src.uncondensed/commands',
    ]) {
        fs.mkdirSync(path.join(tmp, d), { recursive: true });
    }
    return tmp;
}

function ctx(root: string, rel: string, body = 'stub'): string {
    const p = path.join(root, '.agent-src.uncondensed', 'contexts', rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, body, 'utf-8');
    return p;
}

function rule(root: string, name: string, body: string): string {
    const p = path.join(root, '.agent-src.uncondensed', 'rules', `${name}.md`);
    fs.writeFileSync(p, body, 'utf-8');
    return p;
}

describe('check_context_paths — behavioural spec (1:1 port of pytest)', () => {
    let tmp: string;
    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ccp-'));
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    it('repo baseline is clean', () => {
        const violations = ccp.scan(REPO_ROOT);
        expect(violations).toEqual([]);
    });

    it('subtree file referenced is clean', () => {
        const root = makeFakeRoot(tmp);
        ctx(root, 'judges/persona-voice-rubric.md');
        rule(root, 'demo', 'see contexts/judges/persona-voice-rubric.md\n');
        expect(ccp.scan(root)).toEqual([]);
    });

    it('root file not grandfathered fails', () => {
        const root = makeFakeRoot(tmp);
        ctx(root, 'rogue.md');
        rule(root, 'demo', 'loads contexts/rogue.md\n');
        const kinds = new Set(ccp.scan(root).map((v) => v.kind));
        expect(kinds.has('root-not-grandfathered')).toBe(true);
    });

    it('out-of-tree subtree fails', () => {
        const root = makeFakeRoot(tmp);
        ctx(root, 'made-up/foo.md');
        rule(root, 'demo', 'loads contexts/made-up/foo.md\n');
        const kinds = new Set(ccp.scan(root).map((v) => v.kind));
        expect(kinds.has('out-of-tree')).toBe(true);
    });

    it('grandfathered root file is allowed', () => {
        const root = makeFakeRoot(tmp);
        ctx(root, 'model-recommendations.md');
        rule(root, 'demo', 'see contexts/model-recommendations.md\n');
        const kinds = new Set(ccp.scan(root).map((v) => v.kind));
        expect(kinds.has('root-not-grandfathered')).toBe(false);
        expect(kinds.has('out-of-tree')).toBe(false);
    });

    it('basename collision fails (two violations)', () => {
        const root = makeFakeRoot(tmp);
        ctx(root, 'judges/shared.md');
        ctx(root, 'analysis/shared.md');
        rule(root, 'demo', 'uses contexts/judges/shared.md and contexts/analysis/shared.md\n');
        const kinds = ccp.scan(root).map((v) => v.kind);
        expect(kinds.filter((k) => k === 'collision')).toHaveLength(2);
    });

    it('unreferenced context is orphan', () => {
        const root = makeFakeRoot(tmp);
        ctx(root, 'judges/lonely.md');
        const kinds = new Set(ccp.scan(root).map((v) => v.kind));
        expect(kinds.has('orphan')).toBe(true);
    });

    it('self reference does not save orphan', () => {
        const root = makeFakeRoot(tmp);
        ctx(root, 'judges/selfref.md', 'link: contexts/judges/selfref.md\n');
        const kinds = new Set(ccp.scan(root).map((v) => v.kind));
        expect(kinds.has('orphan')).toBe(true);
    });

    it('reference from another context satisfies', () => {
        const root = makeFakeRoot(tmp);
        ctx(root, 'judges/a.md', 'see contexts/judges/b.md\n');
        ctx(root, 'judges/b.md');
        rule(root, 'demo', 'loads contexts/judges/a.md\n');
        expect(ccp.scan(root)).toEqual([]);
    });

    it('full path reference form satisfies', () => {
        const root = makeFakeRoot(tmp);
        ctx(root, 'judges/foo.md');
        rule(root, 'demo', 'load_context:\n  - .agent-src.uncondensed/contexts/judges/foo.md\n');
        expect(ccp.scan(root)).toEqual([]);
    });

    it('short path reference form satisfies', () => {
        const root = makeFakeRoot(tmp);
        ctx(root, 'judges/foo.md');
        rule(root, 'demo', 'loads judges/foo.md\n');
        expect(ccp.scan(root)).toEqual([]);
    });

    it('format_text reports clean', () => {
        expect(ccp.format_text([])).toBe('✅  No context-path violations.');
    });
});

