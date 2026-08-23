/**
 * The frame-lock probe's measurable half, and the seam-score diagnostic.
 *
 * The LIVE half of `probe-frame-lock` costs money and is deliberately not
 * exercised here — what is exercised is everything that decides what the live
 * half would conclude: the PSNR/SSIM primitives, the 30 dB threshold branch in
 * BOTH directions, and the guarantee that the default mode submits nothing.
 *
 * `inf` is asserted as a distinct value on purpose. Two byte-identical frames
 * have no error to measure, and collapsing that to a large finite number would
 * make an exact match indistinguishable from a merely good one — which is the
 * whole question the frame-0 check asks.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const SMOKE = path.join(REPO_ROOT, 'src', 'scripts', 'ai-video', 'smoke-trace.sh');

const HAS_FFMPEG = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' }).status === 0;

function run(args: string[], env: Record<string, string> = {}) {
    return spawnSync('bash', [SMOKE, ...args], {
        encoding: 'utf8',
        cwd: REPO_ROOT,
        env: { ...process.env, ...env },
    });
}

/** Two distinguishable stills plus a byte-identical copy of the first. */
function fixtures(): { dir: string; a: string; aCopy: string; b: string } {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'frame-lock-'));
    const a = path.join(dir, 'a.png');
    const b = path.join(dir, 'b.png');
    const aCopy = path.join(dir, 'a-copy.png');
    const mk = (lavfi: string, out: string) =>
        spawnSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'lavfi', '-i', lavfi, '-frames:v', '1', out]);
    mk('testsrc=size=64x64:rate=1:duration=1', a);
    mk('color=c=red:size=64x64', b);
    fs.copyFileSync(a, aCopy);
    return { dir, a, aCopy, b };
}

/** Two short clips, so the seam pair is a real last-frame/first-frame pair. */
function clips(dir: string): { one: string; two: string } {
    const one = path.join(dir, 'one.mp4');
    const two = path.join(dir, 'two.mp4');
    for (const [src, out] of [
        ['testsrc=size=64x64:rate=10:duration=1', one],
        ['color=c=blue:size=64x64:rate=10:duration=1', two],
    ] as const) {
        spawnSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'lavfi', '-i', src, '-pix_fmt', 'yuv420p', out]);
    }
    return { one, two };
}

describe.skipIf(!HAS_FFMPEG)('smoke-trace.sh similarity primitives (ffmpeg required)', () => {
    it('reports inf for byte-identical frames', () => {
        const { a, aCopy } = fixtures();
        expect(run(['psnr', a, aCopy]).stdout.trim()).toBe('inf');
    });

    it('reports a finite, low dB figure for visibly different frames', () => {
        const { a, b } = fixtures();
        const v = Number(run(['psnr', a, b]).stdout.trim());
        expect(Number.isFinite(v)).toBe(true);
        expect(v).toBeLessThan(30);
    });

    it('takes the threshold branch both ways at 30 dB', () => {
        const { a, aCopy, b } = fixtures();
        const same = JSON.parse(run(['frame0', a, aCopy]).stdout) as { start_frame: boolean; psnr_frame0: string };
        const diff = JSON.parse(run(['frame0', a, b]).stdout) as { start_frame: boolean; psnr_frame0: string };
        expect(same.start_frame).toBe(true);
        expect(same.psnr_frame0).toBe('inf');
        expect(diff.start_frame).toBe(false);
        // A failed probe KEEPS the measured value — "we looked and it did not
        // hold" is a different fact from "nobody looked".
        expect(Number(diff.psnr_frame0)).toBeGreaterThan(0);
    });

    it('the threshold is a real input, not decoration — sabotage probe', () => {
        // Neutralise the mechanism: raise the bar above `inf`'s only competitor
        // and drop it below the low reading. A verdict that ignored the
        // threshold would answer identically in both runs.
        const { a, b } = fixtures();
        const strict = JSON.parse(run(['frame0', a, b], { AIV_FRAME0_PSNR_MIN: '99' }).stdout) as {
            start_frame: boolean;
        };
        const lax = JSON.parse(run(['frame0', a, b], { AIV_FRAME0_PSNR_MIN: '1' }).stdout) as {
            start_frame: boolean;
        };
        expect(strict.start_frame).toBe(false);
        expect(lax.start_frame).toBe(true);
    });

    it('bounds SSIM in 0..1 and separates identical from different', () => {
        const { a, aCopy, b } = fixtures();
        expect(Number(run(['ssim', a, aCopy]).stdout.trim())).toBe(1);
        const d = Number(run(['ssim', a, b]).stdout.trim());
        expect(d).toBeGreaterThanOrEqual(0);
        expect(d).toBeLessThan(1);
    });

    it('refuses an unreadable input rather than reporting a score', () => {
        const { a, dir } = fixtures();
        const res = run(['psnr', a, path.join(dir, 'nope.png')]);
        expect(res.status).not.toBe(0);
        expect(res.stderr).toMatch(/cannot read/);
    });

    it('seam-score emits both metrics and labels itself diagnostic-only', () => {
        const { dir } = fixtures();
        const { one, two } = clips(dir);
        const res = run(['seam-score', one, two]);
        expect(res.status, res.stderr).toBe(0);
        const out = JSON.parse(res.stdout) as { psnr: string; ssim: string; note: string };
        expect(out.psnr).toBeTruthy();
        expect(out.ssim).toBeTruthy();
        // Both are emitted because which one (if either) tracks human judgement
        // is exactly the pre-registered question — picking one here would answer it.
        expect(out.note).toMatch(/diagnostic only/);
        expect(out.note).toMatch(/seam-score-falsifier/);
    });
});

describe('probe-frame-lock spends nothing by default', () => {
    it('prints a plan and an estimate and performs no submit', () => {
        const res = run(['probe-frame-lock', 'fal', 'fal-ai/wan/v2.2-a14b/text-to-video']);
        expect(res.status, res.stderr).toBe(0);
        const out = JSON.parse(res.stdout) as {
            dry_run: boolean;
            estimated_usd: string;
            duration_s: number;
            note: string;
        };
        expect(out.dry_run).toBe(true);
        expect(out.note).toMatch(/NO submit performed/);
        // Estimate derived from the manifest, never invented: 0.08 $/s × 5 s.
        expect(out.duration_s).toBe(5);
        expect(Number(out.estimated_usd)).toBeCloseTo(0.4, 5);
    });

    it('refuses a live probe with no --still instead of guessing one', () => {
        const res = run(['probe-frame-lock', 'fal', 'fal-ai/wan/v2.2-a14b/text-to-video'], {
            AIV_DRYRUN: 'false',
        });
        expect(res.status).not.toBe(0);
        expect(res.stderr).toMatch(/--still <png> is required/);
    });

    it('refuses an unknown adapter', () => {
        const res = run(['probe-frame-lock', 'no-such', 'm']);
        expect(res.status).not.toBe(0);
        expect(res.stderr).toMatch(/no adapter for/);
    });
});
