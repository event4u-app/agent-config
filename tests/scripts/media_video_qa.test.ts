/**
 * `video-qa.sh` — the measured video floor (road-to-a-verdict-that-shows-its-frame
 * Phase 4), the video sibling of `audio-qa.sh`.
 *
 * Every fixture is drawn here as raw grayscale and encoded by ffmpeg, so each
 * expected reading follows from how the fixture was made: a frame shifted by a
 * known number of pixels per frame must read as camera motion, a brightness
 * step too small to be a cut must read as a luma jump without one, a region
 * drawn once and never redrawn must read as frozen. A filter this ffmpeg lacks
 * must read as skipped — never as a pass.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { H, W, encode, gradient, hold } from '../fixtures/media/generate.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const VIDEO_QA = path.join(REPO_ROOT, 'src', 'scripts', 'media', 'lib', 'video-qa.sh');
const CAN_RUN = spawnSync('ffmpeg', ['-version']).status === 0 && spawnSync('ffprobe', ['-version']).status === 0;
const FILTERS = CAN_RUN ? spawnSync('ffmpeg', ['-hide_banner', '-filters'], { encoding: 'utf-8' }).stdout : '';
const has = (f: string): boolean => new RegExp(`\\s${f}\\s`).test(FILTERS);

interface Freeze {
    start: number;
    end: number;
}
interface Reading {
    duration: number;
    width: number;
    height: number;
    fps: number;
    frames: number;
    cuts: Array<{ frame: number; t: number; score: number }> | null;
    camera_motion: { method: string; median_px: number; max_px: number; verdict: 'static' | 'moving' } | null;
    luma_jumps: Array<{ frame: number; t: number; delta: number }> | null;
    freezes: Freeze[] | null;
    blur: { mean: number; max: number } | null;
    block: { mean: number; max: number } | null;
    rois: Array<{ roi: string; ssim_min: number | null; ssim_min_frame: number | null; freezes: Freeze[] | null }>;
    background: { grid: string; changed_cells: string[]; max_diff: number } | null;
    seam?: { ssim: number | null; changed_cells: string[] | null; grid: string };
    checks: Record<string, string>;
}

let dir = '';
const FPS = 10;

/** A textured, non-repeating field, so motion and freezes are measurable everywhere. */
const texture = (seed: number): Uint8Array => {
    const f = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            f[y * W + x] = Math.round(60 + 60 * Math.sin((x + seed) / 7) * Math.cos(y / 5) + 50 * Math.sin((x * y) / 300));
        }
    }
    return f;
};
const wide = (): { data: Uint8Array; width: number } => {
    const width = W + 200;
    const data = new Uint8Array(width * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < width; x++) data[y * width + x] = Math.round(120 + 60 * Math.sin(x / 9) * Math.cos(y / 6) + 40 * Math.sin((x * y) / 500));
    return { data, width };
};
const view = (src: { data: Uint8Array; width: number }, ox: number): Uint8Array => {
    const f = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) f.set(src.data.subarray(y * src.width + ox, y * src.width + ox + W), y * W);
    return f;
};
const block = (frame: Uint8Array, x0: number, y0: number, w: number, h: number, level: number): Uint8Array => {
    const f = Uint8Array.from(frame);
    for (let y = y0; y < y0 + h; y++) f.fill(level, y * W + x0, y * W + x0 + w);
    return f;
};
const brighten = (frame: Uint8Array, by: number): Uint8Array => frame.map((v) => Math.min(255, v + by));
const save = (name: string, frames: Uint8Array[], quality?: number): string => encode(frames, path.join(dir, name), { fps: FPS, quality });

const measure = (file: string, args: readonly string[] = [], env: NodeJS.ProcessEnv = process.env): Reading => {
    const r = spawnSync('bash', [VIDEO_QA, file, ...args], { encoding: 'utf-8', env });
    expect(r.status, r.stderr).toBe(0);
    return JSON.parse(r.stdout) as Reading;
};

// skip-reason: tool absent — ffmpeg and ffprobe are system tools, not dependencies
describe.skipIf(!CAN_RUN)('video-qa.sh', () => {
    const fixtures: Record<string, string> = {};

    beforeAll(() => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'video-qa-'));
        const field = wide();
        fixtures['pan'] = save('pan.mp4', Array.from({ length: 30 }, (_, n) => view(field, n * 3)));
        fixtures['static'] = save('static.mp4', Array.from({ length: 30 }, (_, n) => block(view(field, 0), 10 + n * 4, 60, 12, 12, 250)));
        const t = texture(0);
        fixtures['luma'] = save('luma.mp4', Array.from({ length: 30 }, (_, n) => {
            const moving = block(t, 20 + n * 3, 20, 10, 10, 240);
            return n >= 15 ? brighten(moving, 18) : moving;
        }));
        fixtures['cut'] = save('cut.mp4', [...Array.from({ length: 15 }, () => texture(0)), ...Array.from({ length: 15 }, () => gradient('ltr'))]);
        fixtures['freeze'] = save('freeze.mp4', [...Array.from({ length: 10 }, (_, n) => view(field, n * 4)), ...hold(view(field, 36), 2)]);
        // The block in the top-left corner is drawn once and never changes; everything else pans.
        fixtures['roi'] = save('roi.mp4', Array.from({ length: 30 }, (_, n) => block(view(field, n * 3), 8, 8, 48, 36, 200)));
        // Same clip, coarser quantiser: the frozen region now carries codec noise, as a CI ffmpeg produced.
        fixtures['roi-noisy'] = save('roi-noisy.mp4', Array.from({ length: 30 }, (_, n) => block(view(field, n * 3), 8, 8, 48, 36, 200)), 8);
        const bg = view(field, 0);
        fixtures['walk'] = save('walk.mp4', Array.from({ length: 40 }, (_, n) => block(bg, 4 + n * 7, 70, 16, 16, 250)));
        fixtures['swap'] = save('swap.mp4', Array.from({ length: 40 }, (_, n) => (n >= 20 ? block(bg, 240, 20, 40, 40, 250) : bg)));
        fixtures['a'] = save('seam-a.mp4', Array.from({ length: 10 }, (_, n) => view(field, n * 2)));
        fixtures['b-cont'] = save('seam-b-cont.mp4', Array.from({ length: 10 }, (_, n) => view(field, 20 + n * 2)));
        fixtures['b-swap'] = save('seam-b-swap.mp4', Array.from({ length: 10 }, (_, n) => block(view(field, 20 + n * 2), 200, 0, 120, 180, 20)));
    }, 120_000);
    afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

    it('reads the format of the stream it was given', () => {
        const r = measure(fixtures['pan']!);
        expect(r.width).toBe(W);
        expect(r.height).toBe(H);
        expect(r.fps).toBeCloseTo(FPS, 3);
        expect(r.frames).toBe(30);
        expect(r.duration).toBeCloseTo(3, 1);
        expect(r.checks['format']).toBe('ran');
    });

    // skip-reason: tool absent — this ffmpeg build lacks the filter; the filter-missing case below asserts it reads as skipped
    it.skipIf(!has('deshake'))('reads a pan as camera motion and a still camera as static', () => {
        const pan = measure(fixtures['pan']!);
        expect(pan.camera_motion?.verdict).toBe('moving');
        expect(pan.camera_motion?.median_px).toBeGreaterThan(1.5);
        const still = measure(fixtures['static']!);
        expect(still.camera_motion?.verdict).toBe('static');
        expect(still.checks['camera_motion']).toBe('ran');
    });

    // skip-reason: tool absent — this ffmpeg build lacks the filter; the filter-missing case below asserts it reads as skipped
    it.skipIf(!has('scdet') || !has('signalstats'))('names a luma jump with no cut, and not the brightness change at a real cut', () => {
        const luma = measure(fixtures['luma']!);
        expect(luma.cuts).toEqual([]);
        expect(luma.luma_jumps?.map((j) => j.frame)).toEqual([15]);
        expect(luma.luma_jumps?.[0]?.delta).toBeGreaterThan(12);
        const cut = measure(fixtures['cut']!);
        expect(cut.cuts?.map((c) => c.frame)).toEqual([15]);
        expect(cut.luma_jumps).toEqual([]);
    });

    // skip-reason: tool absent — this ffmpeg build lacks the filter; the filter-missing case below asserts it reads as skipped
    it.skipIf(!has('freezedetect'))('finds a held tail as one freeze and none on a pan', () => {
        const frozen = measure(fixtures['freeze']!);
        expect(frozen.freezes).toHaveLength(1);
        expect(frozen.freezes?.[0]?.start).toBeGreaterThan(0.8);
        expect(frozen.freezes?.[0]?.end).toBeCloseTo(3, 0);
        expect(measure(fixtures['pan']!).freezes).toEqual([]);
    });

    // skip-reason: tool absent — this ffmpeg build lacks the filter; the filter-missing case below asserts it reads as skipped
    it.skipIf(!has('freezedetect') || !has('ssim'))('finds a region frozen while the frame around it moves', () => {
        const r = measure(fixtures['roi']!, ['--roi', '8,8,48,36', '--roi', '200,60,48,36']);
        expect(r.freezes).toEqual([]);
        const [frozen, moving] = r.rois;
        expect(frozen?.roi).toBe('8,8,48,36');
        // An encoder keyframe can split one freeze in two; what counts is the time covered.
        const frozenFor = (frozen?.freezes ?? []).reduce((sum, f) => sum + f.end - f.start, 0);
        expect(frozenFor, `rois=${JSON.stringify(r.rois)} checks=${JSON.stringify(r.checks)}`).toBeGreaterThan(0.8 * r.duration);
        expect(frozen?.ssim_min).toBeGreaterThan(0.95);
        expect(moving?.freezes).toEqual([]);
        expect(moving?.ssim_min ?? 1).toBeLessThan(frozen?.ssim_min ?? 0);

        const noisy = measure(fixtures['roi-noisy']!, ['--roi', '8,8,48,36', '--roi', '200,60,48,36']);
        const [noisyFrozen, noisyMoving] = noisy.rois;
        const noisyFor = (noisyFrozen?.freezes ?? []).reduce((sum, f) => sum + f.end - f.start, 0);
        expect(noisyFor, `rois=${JSON.stringify(noisy.rois)}`).toBeGreaterThan(0.8 * noisy.duration);
        expect(noisyMoving?.freezes).toEqual([]);
    });

    // skip-reason: tool absent — this ffmpeg build lacks the filter; the filter-missing case below asserts it reads as skipped
    it.skipIf(!has('tmedian') || !has('blend') || !has('deshake'))('names a swapped background patch on a static shot, and nothing for a walking block', () => {
        const swap = measure(fixtures['swap']!, ['--grid', '8x6']);
        expect(swap.background?.changed_cells.length).toBeGreaterThan(0);
        // The patch spans x 240-280, y 20-60 of a 320x180 frame: columns G-H, rows 1-2 of an 8x6 grid.
        for (const cell of swap.background?.changed_cells ?? []) expect(['G1', 'H1', 'G2', 'H2']).toContain(cell);
        const walk = measure(fixtures['walk']!, ['--grid', '8x6']);
        expect(walk.background?.changed_cells).toEqual([]);
        expect(walk.checks['background']).toBe('ran');
        expect(measure(fixtures['pan']!).checks['background']).toMatch(/^skipped: camera moving/);
    });

    // skip-reason: tool absent — this ffmpeg build lacks the filter; the filter-missing case below asserts it reads as skipped
    it.skipIf(!has('ssim') || !has('blend'))('compares the seam between two clips: continuous holds, a swapped background breaks', () => {
        const cont = measure(fixtures['a']!, ['--seam', fixtures['b-cont']!]);
        const swap = measure(fixtures['a']!, ['--seam', fixtures['b-swap']!]);
        expect(cont.seam?.ssim).not.toBeNull();
        expect(cont.seam?.ssim ?? 0).toBeGreaterThan(swap.seam?.ssim ?? 1);
        expect(swap.seam?.changed_cells?.length ?? 0).toBeGreaterThan(cont.seam?.changed_cells?.length ?? 0);
        expect(swap.seam?.changed_cells?.length ?? 0).toBeGreaterThan(4);
    });

    it('reports a filter this ffmpeg lacks as skipped, never as a pass', () => {
        const binDir = fs.mkdtempSync(path.join(dir, 'bin-'));
        const real = spawnSync('bash', ['-c', 'command -v ffmpeg'], { encoding: 'utf-8' }).stdout.trim();
        const fake = path.join(binDir, 'ffmpeg');
        fs.writeFileSync(
            fake,
            `#!/usr/bin/env bash\ncase " $* " in *" -filters "*) "${real}" "$@" | grep -vE '[[:space:]](scdet|deshake|freezedetect|ssim)[[:space:]]'; exit 0;; esac\nexec "${real}" "$@"\n`,
        );
        fs.chmodSync(fake, 0o755);
        const r = measure(fixtures['roi']!, ['--roi', '8,8,48,36'], { ...process.env, PATH: `${binDir}${path.delimiter}${process.env['PATH'] ?? ''}` });
        expect(r.checks['cuts']).toBe('skipped: scdet unavailable');
        expect(r.checks['camera_motion']).toBe('skipped: deshake unavailable');
        expect(r.checks['freezes']).toBe('skipped: freezedetect unavailable');
        expect(r.checks['roi_ssim']).toBe('skipped: ssim unavailable');
        expect(r.cuts).toBeNull();
        expect(r.camera_motion).toBeNull();
        expect(r.freezes).toBeNull();
        expect(r.luma_jumps).toBeNull();
        expect(r.rois[0]?.ssim_min).toBeNull();
    });

    it('exits 4 on a file with no video stream, 2 on a missing file', () => {
        const wav = path.join(dir, 'tone.wav');
        spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'sine=duration=1', wav]);
        expect(spawnSync('bash', [VIDEO_QA, wav]).status).toBe(4);
        expect(spawnSync('bash', [VIDEO_QA, path.join(dir, 'nope.mp4')]).status).toBe(2);
        expect(spawnSync('bash', [VIDEO_QA, fixtures['pan']!, '--roi', '300,170,50,50']).status).toBe(2);
    });
});
