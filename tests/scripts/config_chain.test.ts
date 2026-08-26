// Tests for src/scripts/_lib/config_chain.ts —
// road-to-consumer-repo-reality Phase 2 (2.1, 2.2).
//
// Every fixture is synthetic. The assertions follow the two steps' verify lines
// literally, plus risk-register rank 5 — "config-chain resolution follows a
// chain out of the repository and digests someone else's rules as the
// project's" — whose mitigation is normative: an external hop is REPORTED and
// excluded from the digest, never merged into it.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { nearestConfig, resolveConfigChain } from '../../src/scripts/_lib/config_chain.js';

const tmps: string[] = [];

function tree(files: Record<string, string>): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'chain-'));
    tmps.push(root);
    for (const [rel, body] of Object.entries(files)) {
        const abs = path.join(root, rel);
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, body, 'utf8');
    }
    return root;
}

const j = (o: unknown): string => `${JSON.stringify(o, null, 2)}\n`;

afterEach(() => {
    while (tmps.length > 0) fs.rmSync(tmps.pop() as string, { recursive: true, force: true });
});

describe('2.1 — the chain is followed before anything is digested', () => {
    it('yields a workspace package’s rules when the root config only extends it', () => {
        const root = tree({
            'package.json': j({ name: 'root', workspaces: ['packages/*'] }),
            'packages/config/package.json': j({ name: '@acme/config' }),
            'packages/config/index.json': j({ rules: { 'no-any': 'error' } }),
            '.eslintrc.json': j({ extends: '@acme/config/index.json' }),
        });
        const r = resolveConfigChain(root, '.eslintrc.json');
        expect(r.complete).toBe(true);
        const digested = r.digestible.map((h) => h.path);
        expect(digested).toContain('packages/config/index.json');
        expect(r.digestible.some((h) => h.origin === 'workspace-package')).toBe(true);
    });

    it('returns the hops that DID resolve plus the unresolved hop by name, as partial', () => {
        const root = tree({
            'package.json': j({ name: 'root' }),
            'tsconfig.json': j({ extends: './tsconfig.base.json' }),
        });
        const r = resolveConfigChain(root, 'tsconfig.json');
        expect(r.complete).toBe(false);
        expect(r.unresolved).toHaveLength(1);
        expect(r.unresolved[0]?.specifier).toBe('./tsconfig.base.json');
        expect((r.unresolved[0]?.reason ?? '')).not.toBe('');
        // Partial, never empty: the hop that resolved is still reported.
        expect(r.digestible.map((h) => h.path)).toContain('tsconfig.json');
    });

    it('never returns an empty digest for a chain that partly resolved', () => {
        const root = tree({
            'package.json': j({ name: 'root' }),
            'tsconfig.json': j({ extends: './missing.json' }),
        });
        expect(resolveConfigChain(root, 'tsconfig.json').digestible.length).toBeGreaterThan(0);
    });

    // Risk-register rank 5. Presenting a third-party preset as the project's own
    // standard is worse than reporting nothing.
    it('LABELS a hop that leaves the repository and keeps it OUT of the digest', () => {
        const root = tree({
            'package.json': j({ name: 'root' }),
            'node_modules/eslint-config-vendor/index.json': j({ rules: { 'vendor-rule': 'error' } }),
            '.eslintrc.json': j({ extends: './node_modules/eslint-config-vendor/index.json' }),
        });
        const r = resolveConfigChain(root, '.eslintrc.json');
        expect(r.externals.length).toBeGreaterThan(0);
        expect(r.externals[0]?.origin).toBe('external');
        // Reported with its path, so the reader can see what was excluded.
        expect(r.externals[0]?.path).toContain('eslint-config-vendor');
        expect(r.digestible.some((h) => (h.path ?? '').includes('eslint-config-vendor'))).toBe(false);
    });

    it('names a cycle rather than looping', () => {
        const root = tree({
            'package.json': j({ name: 'root' }),
            'a.json': j({ extends: './b.json' }),
            'b.json': j({ extends: './a.json' }),
        });
        const r = resolveConfigChain(root, 'a.json');
        expect(r.complete).toBe(false);
        expect(r.unresolved.some((h) => (h.reason ?? '').includes('cycle'))).toBe(true);
    });

    it('attributes an unparsable config to ITSELF, not to a missing file', () => {
        const root = tree({
            'package.json': j({ name: 'root' }),
            'broken.json': '{ this is not json\n',
        });
        const r = resolveConfigChain(root, 'broken.json');
        expect(r.complete).toBe(false);
        const reason = r.unresolved[0]?.reason ?? '';
        expect(reason).not.toBe('');
        expect(reason).not.toMatch(/does not exist/);
    });
});

describe('2.2 — the config nearest the edit governs it', () => {
    it('returns the per-package config for a path inside that package', () => {
        const root = tree({
            'tsconfig.json': j({ compilerOptions: { strict: false } }),
            'packages/api/tsconfig.json': j({ compilerOptions: { strict: true } }),
            'packages/api/src/handler.ts': 'export const x = 1;\n',
        });
        const r = nearestConfig(root, 'packages/api/src/handler.ts', ['tsconfig.json']);
        expect(r.governing).toBe(path.join('packages', 'api', 'tsconfig.json'));
        expect(r.basis).toBe('nearest-wins');
    });

    it('reports the root config it outranked, so the precedence is visible', () => {
        const root = tree({
            'tsconfig.json': j({}),
            'packages/api/tsconfig.json': j({}),
            'packages/api/src/handler.ts': 'export const x = 1;\n',
        });
        const r = nearestConfig(root, 'packages/api/src/handler.ts', ['tsconfig.json']);
        expect(r.candidates).toContain('tsconfig.json');
        expect(r.candidates[0]).toBe(path.join('packages', 'api', 'tsconfig.json'));
    });

    it('falls back to the root config when the package carries none', () => {
        const root = tree({
            'tsconfig.json': j({}),
            'packages/api/src/handler.ts': 'export const x = 1;\n',
        });
        const r = nearestConfig(root, 'packages/api/src/handler.ts', ['tsconfig.json']);
        expect(r.governing).toBe('tsconfig.json');
        expect(r.basis).toBe('root-only');
    });

    it('says none-found rather than inventing one', () => {
        const root = tree({ 'packages/api/src/handler.ts': 'export const x = 1;\n' });
        const r = nearestConfig(root, 'packages/api/src/handler.ts', ['tsconfig.json']);
        expect(r.governing).toBeNull();
        expect(r.basis).toBe('none-found');
        expect(r.candidates).toEqual([]);
    });

    it('does not escape the repository root while walking up', () => {
        const root = tree({ 'a/b/c/file.ts': 'x\n' });
        const r = nearestConfig(root, 'a/b/c/file.ts', ['tsconfig.json']);
        expect(r.candidates).toEqual([]);
    });
});
