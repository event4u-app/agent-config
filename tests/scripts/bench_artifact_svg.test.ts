/**
 * Proof-where 2.4: the image → SVG tasks are graded on editability (every shape
 * named, a shape budget) and, where a source raster exists, on render similarity.
 * Similarity needs Chromium and is proven by the artifact selftest; editability is
 * pure and pinned here.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { load_artifact_corpus } from '../../src/scripts/_lib/bench_artifact_corpus.js';
import { AB_ROOT, REPO_ROOT, browser_available, grade_primary, svg_similarity_check } from '../../src/scripts/_lib/bench_artifact_graders.js';
import { editability_checks, svg_render_gate } from '../../src/scripts/_lib/bench_artifact_svg_gate.js';

const svg = (body: string): string => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">${body}</svg>`;
const status = (checks: { id: string; status: string }[], id: string): string | undefined => checks.find((c) => c.id === id)?.status;

describe('editability', () => {
    it('a shape with its own id, or inside a group with an id, is named', () => {
        const c = editability_checks(svg('<circle id="eye" cx="5" cy="5" r="2"/><g id="ears"><circle cx="1" cy="1" r="1"/><circle cx="9" cy="1" r="1"/></g>'), { max_shapes: 10 });
        expect(status(c, 'shapes-named')).toBe('pass');
        expect(status(c, 'shape-budget')).toBe('pass');
    });
    it('an anonymous shape fails naming and is counted', () => {
        const c = editability_checks(svg('<g><circle cx="1" cy="1" r="1"/></g><rect id="body" width="4" height="4"/>'), { max_shapes: 10 });
        expect(c.find((x) => x.id === 'shapes-named')).toEqual({ id: 'shapes-named', status: 'fail', detail: '1 of 2 shape(s) unnamed' });
    });
    it('a pixel-per-rect trace blows the shape budget', () => {
        const rects = Array.from({ length: 41 }, (_, i) => `<rect id="p${i}" x="${i % 48}" y="0" width="1" height="1"/>`).join('');
        expect(status(editability_checks(svg(rects), { max_shapes: 40 }), 'shape-budget')).toBe('fail');
        expect(status(editability_checks(svg(rects.split('<rect').slice(0, 41).join('<rect')), { max_shapes: 40 }), 'shape-budget')).toBe('pass');
    });
    it('the render gate runs editability only when asked', () => {
        const plain = svg('<circle cx="5" cy="5" r="2" fill="#000"/>');
        expect(svg_render_gate(plain).some((c) => c.id === 'shapes-named')).toBe(false);
        expect(status(svg_render_gate(plain, { editability: { max_shapes: 40 } }), 'shapes-named')).toBe('fail');
    });
});

describe('the two SVG tasks', () => {
    const tasks = load_artifact_corpus(path.join(REPO_ROOT, 'internal', 'bench', 'corpora', 'ab-artifact-v2.yaml'));
    const args = (id: string) => tasks.find((t) => t.id === id)?.graders.find((g) => g.role === 'primary')?.args ?? {};
    it('both carry a shape budget; the raster task names its source image', () => {
        for (const id of ['art-svg-prompt-01', 'art-svg-raster-01']) expect(args(id)['editability']).toEqual({ max_shapes: 40 });
        const sim = args('art-svg-raster-01')['similarity'] as { source: string; min: number };
        expect(fs.existsSync(path.join(AB_ROOT, sim.source))).toBe(true);
        expect(sim.min).toBeGreaterThan(0);
    });
    it('without a browser the raster task is unmeasured, never passed', async () => {
        const t = tasks.find((x) => x.id === 'art-svg-raster-01');
        const ws = fs.mkdtempSync(path.join(os.tmpdir(), 'svg-test-'));
        try {
            fs.cpSync(path.join(AB_ROOT, 'oracle-artifact', 'art-svg-raster-01', 'good'), ws, { recursive: true });
            const r = await grade_primary(ws, t as never, { browser: false });
            expect(r.status).toBe('unknown');
            expect(r.checks.find((c) => c.id === 'render-similarity')?.status).toBe('unknown');
        } finally {
            fs.rmSync(ws, { recursive: true, force: true });
        }
    });
    it.skipIf(!browser_available())('similarity passes the faithful reference and fails a two-rectangle sketch (needs Chromium)', () => {
        const sim = args('art-svg-raster-01')['similarity'] as { source: string; min: number };
        const run = (svg_src: string): string => {
            const ws = fs.mkdtempSync(path.join(os.tmpdir(), 'svg-sim-'));
            try {
                fs.mkdirSync(path.join(ws, 'out'));
                fs.writeFileSync(path.join(ws, 'out', 'mascot.svg'), svg_src);
                return svg_similarity_check(ws, { deliverable: { path: 'out/mascot.svg' } } as never, sim).status;
            } finally {
                fs.rmSync(ws, { recursive: true, force: true });
            }
        };
        expect(run(fs.readFileSync(path.join(AB_ROOT, 'oracle-artifact', 'art-svg-raster-01', 'good', 'out', 'mascot.svg'), 'utf-8'))).toBe('pass');
        expect(run(svg('<rect id="body" x="8" y="8" width="32" height="34" fill="#f2a93b"/><rect id="belly" x="18" y="26" width="12" height="12" fill="#fff4e0"/>'))).toBe('fail');
    }, 120_000);
});
