
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    SCAN_DIRS,
    build_matrix,
    type Edge,
} from '../../src/scripts/generate_ownership_matrix.js';


// --- Layer 1: ported build_matrix contract (tmp fixture) --------------------

let tmpDir: string;

beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gom-'));
});

afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
});

function makeSrc(): string {
    const src = path.join(tmpDir, '.agent-src.uncondensed');
    for (const sub of SCAN_DIRS) {
        fs.mkdirSync(path.join(src, sub), { recursive: true });
    }
    return src;
}

function write(p: string, content: string): void {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content, 'utf-8');
}

describe('build_matrix — frontmatter parsing', () => {
    it('emits a load_context edge', () => {
        const src = makeSrc();
        write(
            path.join(src, 'rules', 'alpha.md'),
            '---\ntype: "auto"\nload_context:\n  - .agent-src.uncondensed/contexts/foo/bar.md\n---\nbody\n',
        );
        write(path.join(src, 'contexts', 'foo', 'bar.md'), 'stub\n');
        const [, edges, depth3] = build_matrix(src);
        expect(depth3).toEqual([]);
        const lc = edges.filter((e: Edge) => e.via === 'load_context');
        expect(lc.length).toBe(1);
        expect(lc[0]?.source).toBe('.agent-src.uncondensed/rules/alpha.md');
        expect(lc[0]?.target).toBe('.agent-src.uncondensed/contexts/foo/bar.md');
        expect(lc[0]?.type).toBe('READ_ONLY');
        expect(lc[0]?.depth).toBe(1);
    });

    it('emits a load_context_eager edge', () => {
        const src = makeSrc();
        write(
            path.join(src, 'rules', 'alpha.md'),
            '---\ntype: "auto"\nload_context_eager:\n  - .agent-src.uncondensed/contexts/foo/bar.md\n---\n',
        );
        write(path.join(src, 'contexts', 'foo', 'bar.md'), 'stub\n');
        const [, edges] = build_matrix(src);
        expect(edges.filter((e: Edge) => e.via === 'load_context_eager').length).toBe(1);
    });
});

describe('build_matrix — transitive closure', () => {
    it('emits a depth-2 transitive edge', () => {
        const src = makeSrc();
        write(
            path.join(src, 'rules', 'r.md'),
            '---\nload_context:\n  - .agent-src.uncondensed/contexts/foo/a.md\n---\n',
        );
        write(
            path.join(src, 'contexts', 'foo', 'a.md'),
            '---\nload_context:\n  - .agent-src.uncondensed/contexts/foo/b.md\n---\n',
        );
        write(path.join(src, 'contexts', 'foo', 'b.md'), 'leaf\n');
        const [, edges, depth3] = build_matrix(src);
        expect(depth3).toEqual([]);
        const transitive = edges.filter((e: Edge) => e.via === 'load_context_transitive');
        expect(transitive.length).toBe(1);
        expect(transitive[0]?.source).toBe('.agent-src.uncondensed/rules/r.md');
        expect(transitive[0]?.target).toBe('.agent-src.uncondensed/contexts/foo/b.md');
        expect(transitive[0]?.depth).toBe(2);
    });

    it('flags a depth-3 chain (abort)', () => {
        const src = makeSrc();
        write(
            path.join(src, 'rules', 'r.md'),
            '---\nload_context:\n  - .agent-src.uncondensed/contexts/foo/a.md\n---\n',
        );
        write(
            path.join(src, 'contexts', 'foo', 'a.md'),
            '---\nload_context:\n  - .agent-src.uncondensed/contexts/foo/b.md\n---\n',
        );
        write(
            path.join(src, 'contexts', 'foo', 'b.md'),
            '---\nload_context:\n  - .agent-src.uncondensed/contexts/foo/c.md\n---\n',
        );
        write(path.join(src, 'contexts', 'foo', 'c.md'), 'leaf\n');
        const [, , depth3] = build_matrix(src);
        expect(depth3.length).toBeGreaterThan(0);
        expect(
            depth3.some((c) => c.includes('a.md') && c.includes('b.md') && c.includes('c.md')),
        ).toBe(true);
    });
});

describe('build_matrix — body links', () => {
    it('emits a body_link edge to a known target', () => {
        const src = makeSrc();
        write(
            path.join(src, 'rules', 'r.md'),
            '---\ntype: "auto"\n---\nSee [other](../skills/s.md) for more.\n',
        );
        write(path.join(src, 'skills', 's.md'), '---\n---\nbody\n');
        const [, edges] = build_matrix(src);
        const body = edges.filter((e: Edge) => e.via === 'body_link');
        expect(body.length).toBe(1);
        expect(body[0]?.target).toBe('.agent-src.uncondensed/skills/s.md');
    });

    it('drops body links to unknown / external targets', () => {
        const src = makeSrc();
        write(
            path.join(src, 'rules', 'r.md'),
            '---\n---\nSee [outside](../../README.md) and [external](https://example.com/x.md).\n',
        );
        const [, edges] = build_matrix(src);
        expect(edges.filter((e: Edge) => e.via === 'body_link')).toEqual([]);
    });
});

describe('build_matrix — self-WRITE invariant', () => {
    it('every file has a self-WRITE edge', () => {
        const src = makeSrc();
        write(path.join(src, 'rules', 'r.md'), '---\n---\nx\n');
        write(path.join(src, 'skills', 's.md'), '---\n---\ny\n');
        const [files, edges] = build_matrix(src);
        const selfWrites = new Set(
            edges.filter((e: Edge) => e.type === 'WRITE').map((e) => `${e.source}\0${e.target}`),
        );
        for (const rel of Object.keys(files)) {
            expect(selfWrites.has(`${rel}\0${rel}`)).toBe(true);
        }
    });
});

describe('build_matrix — repo baseline', () => {
    it('generates with no depth-3 chains and a self-WRITE per file', () => {
        const [files, edges, depth3] = build_matrix();
        expect(depth3).toEqual([]);
        const selfWrites = new Set(
            edges.filter((e: Edge) => e.type === 'WRITE').map((e) => e.source),
        );
        expect(selfWrites).toEqual(new Set(Object.keys(files)));
        const lc = edges.filter((e: Edge) => e.via === 'load_context');
        expect(lc.length).toBeGreaterThan(0);
    });
});
