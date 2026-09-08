/**
 * The vendored grammars' anchor outside their own manifest.
 *
 * `packed_binary_predicate.test.ts` proves the eleven manifest conditions
 * refuse what they must refuse. Every one of them reads the manifest, so a
 * commit that edits the manifest and the bytes together satisfies all eleven —
 * the surviving half of the `release/14.22.0` finding `d1696732ac28`. These
 * tests cover the other side: the bytes equal the locked upstream's bytes, and
 * the check refuses rather than passes whenever that comparison cannot be made.
 *
 * The real-tree case is the enforcement. The fixture cases are the sensitivity
 * proof — a check never seen red has unknown sensitivity, so every refusal path
 * and the divergence path are each driven to failure here rather than asserted
 * in prose.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import { type PackedBinaryManifest, VERIFIABLE_KIND } from '../../src/scripts/_lib/packed_binary_predicate.js';
import {
    readLockPin,
    UPSTREAM_PACKAGE,
    UpstreamAnchorRefusal,
    verifyVendoredGrammarsAgainstUpstream,
} from '../../src/scripts/_lib/vendored_grammar_upstream.js';

const REPO_ROOT = path.resolve(__dirname, '..', '..');

const tempRoots: string[] = [];

afterAll(() => {
    for (const dir of tempRoots) fs.rmSync(dir, { recursive: true, force: true });
});

/**
 * A miniature repository whose shape is the real one: a lock row, a manifest,
 * a vendored file and an installed upstream. Every negative case below is this
 * fixture with exactly one thing removed or changed, so the failure it produces
 * is attributable to that one thing.
 */
function makeFixture(over: {
    lockVersion?: string;
    lockIntegrity?: string | null;
    installedVersion?: string | null;
    vendoredBytes?: Buffer;
    upstreamBytes?: Buffer | null;
    entries?: PackedBinaryManifest['entries'];
} = {}): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'grammar-anchor-'));
    tempRoots.push(root);

    const lockVersion = over.lockVersion ?? '0.1.13';
    const integrity = over.lockIntegrity === null ? undefined : (over.lockIntegrity ?? 'sha512-fixture');
    fs.writeFileSync(
        path.join(root, 'package-lock.json'),
        JSON.stringify({
            lockfileVersion: 3,
            packages: {
                [`node_modules/${UPSTREAM_PACKAGE}`]: { version: lockVersion, ...(integrity === undefined ? {} : { integrity }) },
            },
        }),
    );

    const entries =
        over.entries ??
        ([
            {
                path: 'src/vendor/grammars/tree-sitter-fixture.wasm',
                sha256: 'unused-by-this-module',
                size: 8,
                kind: VERIFIABLE_KIND,
                grammar_id: 'fixture',
                abi: 14,
            },
        ] as PackedBinaryManifest['entries']);
    fs.mkdirSync(path.join(root, 'src', 'config'), { recursive: true });
    fs.writeFileSync(path.join(root, 'src', 'config', 'packed-binary-manifest.json'), JSON.stringify({ schema_version: 1, entries }));

    const vendored = over.vendoredBytes ?? Buffer.from([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);
    for (const entry of entries) {
        const target = path.join(root, entry.path);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, vendored);
    }

    if (over.installedVersion !== null) {
        const pkgDir = path.join(root, 'node_modules', UPSTREAM_PACKAGE);
        fs.mkdirSync(path.join(pkgDir, 'out'), { recursive: true });
        fs.writeFileSync(path.join(pkgDir, 'package.json'), JSON.stringify({ name: UPSTREAM_PACKAGE, version: over.installedVersion ?? lockVersion }));
        if (over.upstreamBytes !== null) {
            const upstream = over.upstreamBytes ?? vendored;
            for (const entry of entries) fs.writeFileSync(path.join(pkgDir, 'out', path.basename(entry.path)), upstream);
        }
    }

    return root;
}

describe('the real tree', () => {
    it('anchors every vendored grammar to the locked upstream, byte for byte', () => {
        const verdict = verifyVendoredGrammarsAgainstUpstream({ repoRoot: REPO_ROOT });
        expect(verdict.divergences).toEqual([]);
        expect(verdict.comparisons.length).toBeGreaterThanOrEqual(3);
        for (const c of verdict.comparisons) expect(c.equal).toBe(true);
    });

    it('compares against the version package-lock.json pins, not whatever is installed', () => {
        const pin = readLockPin(REPO_ROOT);
        const installed = JSON.parse(
            fs.readFileSync(path.join(REPO_ROOT, 'node_modules', UPSTREAM_PACKAGE, 'package.json'), 'utf-8'),
        ) as { version: string };
        expect(installed.version).toBe(pin.version);
        expect(pin.integrity.startsWith('sha512-')).toBe(true);
    });

    it('covers every grammar the manifest admits, by full path, so no admitted file is unanchored', () => {
        const manifest = JSON.parse(
            fs.readFileSync(path.join(REPO_ROOT, 'src', 'config', 'packed-binary-manifest.json'), 'utf-8'),
        ) as PackedBinaryManifest;
        const admitted = manifest.entries.filter((e) => e.kind === VERIFIABLE_KIND).map((e) => path.join(REPO_ROOT, e.path));
        const verdict = verifyVendoredGrammarsAgainstUpstream({ repoRoot: REPO_ROOT });
        // Compared on the FULL path, not the basename: comparing basenames here
        // would apply the same collapse the module was found doing, so the test
        // could not catch it. R2 finding 2, 2026-09-09.
        expect(verdict.comparisons.map((c) => c.vendoredPath).sort()).toEqual(admitted.sort());
    });

    it('reports the version it actually read from node_modules, not the one it read from the lock', () => {
        const verdict = verifyVendoredGrammarsAgainstUpstream({ repoRoot: REPO_ROOT });
        const installed = JSON.parse(
            fs.readFileSync(path.join(REPO_ROOT, 'node_modules', UPSTREAM_PACKAGE, 'package.json'), 'utf-8'),
        ) as { version: string };
        expect(verdict.installedVersion).toBe(installed.version);
    });
});

describe('the divergence it exists to catch', () => {
    it('reports a mutated vendored byte as a divergence', () => {
        const mutated = Buffer.from([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x01]);
        const root = makeFixture({ vendoredBytes: mutated, upstreamBytes: Buffer.from([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]) });
        const verdict = verifyVendoredGrammarsAgainstUpstream({ repoRoot: root });
        expect(verdict.divergences).toHaveLength(1);
        expect(verdict.divergences[0]).toContain('tree-sitter-fixture.wasm');
        expect(verdict.comparisons[0]?.equal).toBe(false);
    });

    it('names both hashes, so the divergence is diagnosable without re-running it', () => {
        const root = makeFixture({
            vendoredBytes: Buffer.from([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x01]),
            upstreamBytes: Buffer.from([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]),
        });
        const verdict = verifyVendoredGrammarsAgainstUpstream({ repoRoot: root });
        const expected = createHash('sha256').update(Buffer.from([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x01])).digest('hex');
        expect(verdict.divergences[0]).toContain(expected);
    });

    it('is sensitive to the REAL vendored bytes — mutating a copy of the shipped grammar diverges', () => {
        const real = fs.readFileSync(path.join(REPO_ROOT, 'src', 'vendor', 'grammars', 'tree-sitter-php.wasm'));
        const mutated = Buffer.from(real);
        mutated[mutated.length - 1] = (mutated[mutated.length - 1] as number) ^ 0xff;
        const root = makeFixture({ vendoredBytes: mutated, upstreamBytes: real });
        expect(verifyVendoredGrammarsAgainstUpstream({ repoRoot: root }).divergences).toHaveLength(1);
    });
});

describe('the refusals — an unestablished anchor is never a pass', () => {
    it('refuses when the upstream package is not installed', () => {
        const root = makeFixture({ installedVersion: null });
        expect(() => verifyVendoredGrammarsAgainstUpstream({ repoRoot: root })).toThrow(UpstreamAnchorRefusal);
        expect(() => verifyVendoredGrammarsAgainstUpstream({ repoRoot: root })).toThrow(/is not installed/);
    });

    it('refuses when the installed version is not the locked one', () => {
        const root = makeFixture({ lockVersion: '0.1.13', installedVersion: '0.1.12' });
        expect(() => verifyVendoredGrammarsAgainstUpstream({ repoRoot: root })).toThrow(/pins 0\.1\.13/);
    });

    it('refuses when the lock row carries no integrity, because it then pins no bytes', () => {
        const root = makeFixture({ lockIntegrity: null });
        expect(() => verifyVendoredGrammarsAgainstUpstream({ repoRoot: root })).toThrow(/integrity/);
    });

    it('refuses when the lock carries no row for the upstream at all', () => {
        const root = makeFixture();
        fs.writeFileSync(path.join(root, 'package-lock.json'), JSON.stringify({ lockfileVersion: 3, packages: {} }));
        expect(() => verifyVendoredGrammarsAgainstUpstream({ repoRoot: root })).toThrow(/no locked source/);
    });

    it('refuses an empty claim set instead of reporting a green over nothing', () => {
        const root = makeFixture({ entries: [] });
        expect(() => verifyVendoredGrammarsAgainstUpstream({ repoRoot: root })).toThrow(/nothing was compared/);
    });

    it('refuses when a manifest-admitted grammar has no counterpart upstream', () => {
        const root = makeFixture({ upstreamBytes: null });
        expect(() => verifyVendoredGrammarsAgainstUpstream({ repoRoot: root })).toThrow(/no counterpart/);
    });

    it('refuses when a manifest-admitted grammar is missing from the vendored dir', () => {
        const root = makeFixture();
        fs.rmSync(path.join(root, 'src', 'vendor', 'grammars', 'tree-sitter-fixture.wasm'));
        expect(() => verifyVendoredGrammarsAgainstUpstream({ repoRoot: root })).toThrow(/does not exist/);
    });

    it('refuses two admitted entries that share a filename in different directories', () => {
        // The upstream is one flat directory, so both rows would anchor to the
        // same file and one admitted binary would be silently unverified while
        // the verdict claimed full coverage. R2 finding 2, 2026-09-09.
        const root = makeFixture({
            entries: [
                {
                    path: 'src/vendor/grammars/tree-sitter-fixture.wasm',
                    sha256: 'unused-by-this-module',
                    size: 8,
                    kind: VERIFIABLE_KIND,
                    grammar_id: 'fixture',
                    abi: 14,
                },
                {
                    path: 'src/vendor/other/tree-sitter-fixture.wasm',
                    sha256: 'unused-by-this-module',
                    size: 8,
                    kind: VERIFIABLE_KIND,
                    grammar_id: 'fixture',
                    abi: 14,
                },
            ] as PackedBinaryManifest['entries'],
        });
        expect(() => verifyVendoredGrammarsAgainstUpstream({ repoRoot: root })).toThrow(/share a filename/);
    });

    it('resolves the vendored file by its own manifest path, not by basename under one directory', () => {
        // Sensitivity for the fix: the second row lives elsewhere and carries
        // DIFFERENT bytes. Under the basename collapse both rows read the first
        // file and the divergence disappears.
        const root = makeFixture({
            entries: [
                {
                    path: 'src/vendor/grammars/tree-sitter-a.wasm',
                    sha256: 'unused-by-this-module',
                    size: 8,
                    kind: VERIFIABLE_KIND,
                    grammar_id: 'a',
                    abi: 14,
                },
                {
                    path: 'src/vendor/other/tree-sitter-b.wasm',
                    sha256: 'unused-by-this-module',
                    size: 8,
                    kind: VERIFIABLE_KIND,
                    grammar_id: 'b',
                    abi: 14,
                },
            ] as PackedBinaryManifest['entries'],
        });
        fs.writeFileSync(
            path.join(root, 'src', 'vendor', 'other', 'tree-sitter-b.wasm'),
            Buffer.from([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x01]),
        );
        const verdict = verifyVendoredGrammarsAgainstUpstream({ repoRoot: root });
        expect(verdict.comparisons.map((c) => c.vendoredPath)).toEqual([
            path.join(root, 'src/vendor/grammars/tree-sitter-a.wasm'),
            path.join(root, 'src/vendor/other/tree-sitter-b.wasm'),
        ]);
        expect(verdict.divergences).toHaveLength(1);
        expect(verdict.divergences[0]).toContain('src/vendor/other/tree-sitter-b.wasm');
    });
});
