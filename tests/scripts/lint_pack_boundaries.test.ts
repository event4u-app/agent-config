// Tests for src/scripts/lint_pack_boundaries.ts.
//
// A focused suite over the public behaviour (link regex, link resolution
// semantics, allow rules, requires closure, pack attribution) plus a
// scan-scope layer added with the 2026-08-02 root repair: the gate used to
// walk the deleted `packages/` tree and exit 0 with `no packages/ tree to lint
// — skipping`, so the tests below lock BOTH that it now reads the live corpus
// and that an empty corpus is a loud failure rather than a green skip.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as lpb from '../../src/scripts/lint_pack_boundaries.js';
import { runInProc } from '../_lib/run_in_process.js';

/** Floor for the live artefact corpus — a regression lock on the dead root. */
const SCANNED_FLOOR = 500;

/** Captured before any test overrides it (ESM live binding of a `let`). */
const REAL_ROOT = lpb.ROOT;


describe('lint_pack_boundaries — behavioural spec', () => {
    let tmp: string;
    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lpb-'));
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    function write(rel: string, content: string): string {
        const p = path.join(tmp, rel);
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(p, content, 'utf-8');
        return p;
    }

    // --- LINK_RE extracts the target, stripping fragment / query. ---
    it('scan extracts markdown link targets and strips #/?', () => {
        const f = write(
            'doc.md',
            'See [a](./other.md#frag) and [b](../up.md?x=1) and [c](https://ex.com).',
        );
        expect(lpb._scan_file(f)).toEqual(['./other.md', '../up.md', 'https://ex.com']);
    });

    // --- _resolve_link ignores external / absolute targets. ---
    it('_resolve_link returns null for http/mailto/absolute', () => {
        const src = path.join(tmp, 'a/b.md');
        expect(lpb._resolve_link(src, 'https://example.com')).toBeNull();
        expect(lpb._resolve_link(src, 'mailto:x@y.z')).toBeNull();
        expect(lpb._resolve_link(src, '/abs/web/path')).toBeNull();
        expect(lpb._resolve_link(src, '')).toBeNull();
    });

    // --- _is_allowed rules: same pack, core, or declared requires. ---
    it('_is_allowed: same pack always allowed', () => {
        expect(lpb._is_allowed('alpha', 'alpha', [])).toBe(true);
    });
    it('_is_allowed: core target always allowed', () => {
        expect(lpb._is_allowed('alpha', 'core', [])).toBe(true);
    });
    it('_is_allowed: declared requires allowed, undeclared denied', () => {
        expect(lpb._is_allowed('alpha', 'beta', ['beta'])).toBe(true);
        expect(lpb._is_allowed('alpha', 'beta', [])).toBe(false);
    });

    // --- _load_pack_meta reads pack.yaml or returns {}. ---
    it('_load_pack_meta returns {} when pack.yaml is absent', () => {
        fs.mkdirSync(path.join(tmp, 'pkg'), { recursive: true });
        expect(lpb._load_pack_meta(path.join(tmp, 'pkg'))).toEqual({});
    });
    it('_load_pack_meta parses pack.yaml mapping', () => {
        write('pkg/pack.yaml', 'id: my-pack\nrequires:\n  - core\n');
        const meta = lpb._load_pack_meta(path.join(tmp, 'pkg'));
        expect(meta['id']).toBe('my-pack');
        expect(meta['requires']).toEqual(['core']);
    });
});

// --- Scan scope: the live corpus, and a dead root that fails loudly ---------

describe('lint_pack_boundaries — scan scope', () => {
    it('the scan roots are the live source tree, not the deleted packages/', () => {
        const roots = lpb._scan_roots();
        expect(roots.length).toBeGreaterThan(0);
        for (const r of roots) {
            expect(r).not.toMatch(/[/\\]packages([/\\]|$)/);
            expect(r).not.toContain('.agent-src.uncondensed');
            expect(fs.statSync(r).isDirectory()).toBe(true);
        }
    });

    it('the default entry point reports a NON-ZERO scanned count', () => {
        const { scanned, index } = lpb._build_artefact_index();
        expect(scanned).toBeGreaterThanOrEqual(SCANNED_FLOOR);
        expect(index.size).toBeGreaterThanOrEqual(SCANNED_FLOOR - 200);

        const r = runInProc(lpb.main, ['--quiet', '--format', 'json']);
        const payload = JSON.parse(r.stdout) as { scanned: number; count: number };
        expect(payload.scanned).toBeGreaterThanOrEqual(SCANNED_FLOOR);
        // Exit code depends on the recorded ratchet baseline, not on this test.
        expect([0, 1]).toContain(r.status);
    });

    it('every real pack id used by an artefact resolves a requires entry', () => {
        const requires = lpb._pack_requires();
        const missing = new Set<string>();
        for (const packs of lpb._build_artefact_index().index.values()) {
            for (const p of packs) {
                if (!requires.has(p)) {
                    missing.add(p);
                }
            }
        }
        expect([...missing]).toEqual([]);
    });
});

// --- Fixture-tree behaviour: dead scope, clean pass, real rejection ---------

describe('lint_pack_boundaries — fixture tree', () => {
    let root: string;

    beforeEach(() => {
        // realpath: macOS /var → /private/var, and _resolve_link canonicalizes
        // before comparing against ROOT.
        root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'lpb-fx-')));
        lpb._set_paths_for_test({ root });
    });
    afterEach(() => {
        lpb._set_paths_for_test({ root: REAL_ROOT });
        fs.rmSync(root, { recursive: true, force: true });
    });

    function write(rel: string, content: string): void {
        const p = path.join(root, rel);
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(p, content, 'utf-8');
    }

    function vocab(entries: Array<{ id: string; requires?: string[] }>): void {
        write(
            'packs.yml',
            entries
                .map(
                    (e) =>
                        `- id: ${e.id}\n  requires: [${(e.requires ?? []).join(', ')}]\n`,
                )
                .join(''),
        );
    }

    function skill(slug: string, packs: string[], body: string): void {
        write(
            `skills/${slug}/SKILL.md`,
            `---\nname: ${slug}\npacks: [${packs.join(', ')}]\n---\n\n${body}\n`,
        );
    }

    it('an EMPTY tree is a dead-scope FAILURE, not a green skip', () => {
        vocab([{ id: 'alpha' }]);
        const r = runInProc(lpb.main, []);
        expect(r.status).toBe(2);
        expect(r.stderr).toContain('lint_pack_boundaries: scanned 0 artefact(s)');
        expect(r.stderr).toContain('the scan scope is dead or the root moved');
    });

    it('allowed links (same pack, core, declared requires) pass clean', () => {
        vocab([{ id: 'alpha', requires: ['beta'] }, { id: 'beta' }, { id: 'core' }]);
        skill('a-one', ['alpha'], 'see [two](../a-two/SKILL.md) and [b](../b-one/SKILL.md)');
        skill('a-two', ['alpha'], 'leaf');
        skill('b-one', ['beta'], 'leaf');
        skill('c-one', ['core'], 'leaf');
        write('rules/r.md', '---\npacks: [beta]\n---\n\n[core](../skills/c-one/SKILL.md)\n');

        const r = runInProc(lpb.main, []);
        expect(r.status, r.stdout + r.stderr).toBe(0);
        expect(r.stdout).toContain('OK — no cross-pack drift');
    });

    it('an UNDECLARED cross-pack link is rejected', () => {
        vocab([{ id: 'alpha' }, { id: 'beta' }]);
        skill('a-one', ['alpha'], 'reaches [b](../b-one/SKILL.md)');
        skill('b-one', ['beta'], 'leaf');

        const r = runInProc(lpb.main, []);
        expect(r.status).toBe(1);
        expect(r.stdout).toContain(
            '✗ alpha -> beta : skills/a-one/SKILL.md → skills/b-one/SKILL.md',
        );
        expect(r.stdout).toContain('1 cross-pack violation(s)');
    });

    it('requires is expanded transitively (alpha → beta → gamma)', () => {
        vocab([
            { id: 'alpha', requires: ['beta'] },
            { id: 'beta', requires: ['gamma'] },
            { id: 'gamma' },
        ]);
        skill('a-one', ['alpha'], 'reaches [g](../g-one/SKILL.md)');
        skill('g-one', ['gamma'], 'leaf');

        const r = runInProc(lpb.main, []);
        expect(r.status, r.stdout).toBe(0);
    });

    it('a skill reference file inherits its pack from the sibling SKILL.md', () => {
        vocab([{ id: 'alpha' }, { id: 'beta' }]);
        skill('a-one', ['alpha'], 'root');
        write('skills/a-one/reference.md', 'reaches [b](../b-one/SKILL.md)\n');
        skill('b-one', ['beta'], 'leaf');

        const packs = lpb._packs_of(path.join(root, 'skills/a-one/reference.md'), new Map());
        expect(packs).toEqual(['alpha']);
        const r = runInProc(lpb.main, []);
        expect(r.status).toBe(1);
        expect(r.stdout).toContain('skills/a-one/reference.md');
    });

    it('a SKILL.md with no packs is an unresolved-pack finding, never a silent pass', () => {
        vocab([{ id: 'alpha' }]);
        write('skills/nopack/SKILL.md', '---\nname: nopack\n---\n\nno packs key\n');
        skill('a-one', ['alpha'], 'leaf');

        const r = runInProc(lpb.main, []);
        expect(r.status).toBe(1);
        expect(r.stdout).toContain('skills/nopack/SKILL.md : no `packs:` declared');
        expect(r.stdout).toContain('cannot be boundary-checked');
    });

    it('the ratchet never judges a fixture tree', () => {
        vocab([{ id: 'alpha' }, { id: 'beta' }]);
        skill('a-one', ['alpha'], 'reaches [b](../b-one/SKILL.md)');
        skill('b-one', ['beta'], 'leaf');
        const r = runInProc(lpb.main, ['--format', 'json']);
        const payload = JSON.parse(r.stdout) as { ratchet: unknown };
        expect(payload.ratchet).toBeNull();
    });
});

// --- Set-level allow rule + closure -----------------------------------------

describe('lint_pack_boundaries — set semantics', () => {
    const closure = (graph: Record<string, string[]>) => (p: string) =>
        lpb._requires_closure(p, new Map(Object.entries(graph)));

    it('_requires_closure expands transitively and survives a cycle', () => {
        const g = new Map(Object.entries({ a: ['b'], b: ['c'], c: ['a'] }));
        expect([...lpb._requires_closure('a', g)].sort()).toEqual(['a', 'b', 'c']);
    });

    it('EVERY source pack must reach the target — a partial match is a violation', () => {
        const c = closure({ alpha: ['gamma'], beta: [], gamma: [] });
        expect(lpb._link_allowed(['alpha'], ['gamma'], c)).toBe(true);
        // `beta` cannot reach gamma, so the multi-pack artefact fails.
        expect(lpb._link_allowed(['alpha', 'beta'], ['gamma'], c)).toBe(false);
    });

    it('a multi-pack TARGET is reachable when ANY of its packs is', () => {
        const c = closure({ alpha: ['gamma'], beta: [], gamma: [] });
        expect(lpb._link_allowed(['alpha'], ['beta', 'gamma'], c)).toBe(true);
    });
});

