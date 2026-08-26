// Tests for src/scripts/_lib/repo_root.ts
// (road-to-skill-ecosystem-runtime-enforcement Phase 2 Steps 6-7).
//
// The whole point of this module is that it FAILS. Every other repo-root
// resolver in this tree succeeds unconditionally, which is why a moved file or
// an inherited GIT_DIR turns into a silent empty scan rather than an error. So
// the refusal cases are the load-bearing ones here, not the happy path.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    GIT_DISCOVERY_OVERRIDES,
    RepoRootUnresolvedError,
    SENTINEL_PACKAGE_NAME,
    hasSentinel,
    inheritedGitOverrides,
    resolveRepoRoot,
} from '../../src/scripts/_lib/repo_root.js';

const REPO = path.resolve(import.meta.dirname, '..', '..');

let tmp: string;
beforeEach(() => {
    tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'reporoot-')));
});
afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

const writePkg = (dir: string, name: string): void => {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name }), 'utf8');
};

describe('repo_root — the refusal', () => {
    it('REFUSES a directory with no sentinel anywhere above it', () => {
        // The step's own verify clause. `/tmp` has no package.json chain, so the
        // walk reaches the filesystem root and must throw rather than return cwd.
        expect(() => resolveRepoRoot(tmp)).toThrow(RepoRootUnresolvedError);
    });

    it('names the directory it started from, so the error is actionable', () => {
        try {
            resolveRepoRoot(tmp);
            expect.unreachable('should have refused');
        } catch (e) {
            expect(e).toBeInstanceOf(RepoRootUnresolvedError);
            expect((e as RepoRootUnresolvedError).startedAt).toBe(tmp);
            expect((e as Error).message).toContain(SENTINEL_PACKAGE_NAME);
        }
    });

    it('REFUSES a bare package.json — any node_modules entry has one of those', () => {
        // The discriminator that makes the sentinel worth anything: accepting any
        // package.json would resolve to the first npm package on the walk.
        writePkg(tmp, 'some-unrelated-package');
        expect(() => resolveRepoRoot(tmp)).toThrow(RepoRootUnresolvedError);
    });

    it('REFUSES a package.json that is not valid JSON rather than crashing the walk', () => {
        fs.writeFileSync(path.join(tmp, 'package.json'), '{ not json', 'utf8');
        expect(hasSentinel(tmp)).toBe(false);
        expect(() => resolveRepoRoot(tmp)).toThrow(RepoRootUnresolvedError);
    });
});

describe('repo_root — resolution', () => {
    it('finds the sentinel in the starting directory', () => {
        writePkg(tmp, SENTINEL_PACKAGE_NAME);
        expect(resolveRepoRoot(tmp)).toBe(tmp);
    });

    it('walks UPWARD past directories that are not the root', () => {
        writePkg(tmp, SENTINEL_PACKAGE_NAME);
        const deep = path.join(tmp, 'src', 'scripts', '_lib');
        fs.mkdirSync(deep, { recursive: true });
        expect(resolveRepoRoot(deep)).toBe(tmp);
    });

    it('stops at the NEAREST sentinel — a nested checkout wins over its parent', () => {
        writePkg(tmp, SENTINEL_PACKAGE_NAME);
        const nested = path.join(tmp, 'worktrees', 'inner');
        writePkg(nested, SENTINEL_PACKAGE_NAME);
        expect(resolveRepoRoot(path.join(nested, 'src'))).toBe(nested);
    });

    it('resolves this repository from its own test file', () => {
        expect(resolveRepoRoot(import.meta.dirname)).toBe(REPO);
    });

    it('a malformed package.json mid-walk does not hide a valid root above it', () => {
        writePkg(tmp, SENTINEL_PACKAGE_NAME);
        const mid = path.join(tmp, 'mid');
        fs.mkdirSync(mid, { recursive: true });
        fs.writeFileSync(path.join(mid, 'package.json'), '{{{', 'utf8');
        expect(resolveRepoRoot(mid)).toBe(tmp);
    });
});

describe('repo_root — inherited git discovery overrides', () => {
    it('reports nothing when the environment is clean', () => {
        expect(inheritedGitOverrides({})).toEqual([]);
    });

    it('reports GIT_DIR, the one that has actually bitten', () => {
        expect(inheritedGitOverrides({ GIT_DIR: '.git' })).toEqual([{ name: 'GIT_DIR', value: '.git' }]);
    });

    it('treats an EMPTY value as absent — an exported-but-empty var overrides nothing', () => {
        expect(inheritedGitOverrides({ GIT_DIR: '' })).toEqual([]);
    });

    it('covers all four discovery overrides, not just the one that bit', () => {
        const env = Object.fromEntries(GIT_DISCOVERY_OVERRIDES.map((n) => [n, `/x/${n}`]));
        expect(inheritedGitOverrides(env).map((o) => o.name)).toEqual([...GIT_DISCOVERY_OVERRIDES]);
    });
});
