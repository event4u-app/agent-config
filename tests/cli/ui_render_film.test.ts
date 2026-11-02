/**
 * `ui:render --profile film` — the film witness (road-to-a-film-built-from-time
 * Phases 2 and 3). Pure parts first, then real captures of pages written into
 * a temp project, so every expectation follows from how the page was built.
 */
import { spawnSync } from 'node:child_process';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import type { Browser } from '@playwright/test';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { absentFilmManifest } from '../../src/cli/commands/uiRender.js';
import {
    deadTimeSpans,
    filmExitCode,
    firstDivergence,
    formatFindings,
    frameTimes,
    luminanceChanges,
    maxFlashesPerSecond,
    redChanges,
    relativeLuminance,
    runFilmRender,
    type FilmManifest,
} from '../../src/cli/commands/uiRenderFilm.js';

const HAS_FFMPEG =
    spawnSync('ffmpeg', ['-version']).status === 0 && spawnSync('ffprobe', ['-version']).status === 0;

describe('film witness — pure parts', () => {
    it('places one frame per 1/fps across the duration', () => {
        expect(frameTimes(1, 4)).toEqual([0, 0.25, 0.5, 0.75]);
        expect(frameTimes(2, 30)).toHaveLength(60);
    });

    it('reports a still longer than the hold, and only that one', () => {
        const fps = 10;
        const d = [...'abcd'.split(''), ...Array<string>(25).fill('x'), 'e', 'f'];
        expect(deadTimeSpans(d, fps, 2)).toEqual([{ from_s: 0.4, to_s: 2.9 }]);
        expect(deadTimeSpans(d, fps, 3)).toEqual([]);
    });

    it('names the first frame whose two captures differ', () => {
        expect(firstDivergence(['a', 'b', 'c'], ['a', 'b', 'c'])).toBeNull();
        expect(firstDivergence(['a', 'b', 'c'], ['a', 'x', 'y'])).toBe(1);
    });

    it('computes sRGB relative luminance at its anchors', () => {
        expect(relativeLuminance(0, 0, 0)).toBe(0);
        expect(relativeLuminance(255, 255, 255)).toBeCloseTo(1, 6);
        expect(relativeLuminance(255, 0, 0)).toBeCloseTo(0.2126, 4);
    });

    it('counts a 6 Hz black/white strobe as six flashes a second and a slow fade as none', () => {
        const fps = 30;
        const strobe = Array.from({ length: 60 }, (_, i) => (Math.floor(i / 2.5) % 2 === 0 ? 0 : 1));
        expect(maxFlashesPerSecond(luminanceChanges(strobe), fps).max).toBeGreaterThan(3);
        const fade = Array.from({ length: 60 }, (_, i) => i / 59);
        expect(luminanceChanges(fade)).toHaveLength(1);
        expect(maxFlashesPerSecond(luminanceChanges(fade), fps).max).toBe(0);
    });

    it('ignores changes between two bright states (both above 0.8)', () => {
        const bright = Array.from({ length: 60 }, (_, i) => (i % 4 < 2 ? 0.85 : 1));
        expect(luminanceChanges(bright)).toEqual([]);
    });

    it('counts saturated-red switching separately', () => {
        const rgb = Array.from({ length: 30 }, (_, i): [number, number, number] => (i % 2 === 0 ? [255, 0, 0] : [0, 0, 0]));
        expect(maxFlashesPerSecond(redChanges(rgb), 30).max).toBeGreaterThan(3);
    });

    it('turns every declared/encoded mismatch into a finding and a match into none', () => {
        const declared = { width: 160, height: 90, fps: 30, duration: 2 };
        expect(formatFindings(declared, { ...declared })).toEqual([]);
        const f = formatFindings(declared, { width: 160, height: 90, fps: 24, duration: 2 });
        expect(f).toHaveLength(1);
        expect(f[0]?.detail).toContain('fps');
    });

    it('never reads a renderer-absent run as a pass', () => {
        const m = absentFilmManifest('film.html');
        expect(m.verification).toBe('unassessed');
        expect(Object.values(m.checks).every((v) => v.startsWith('skipped'))).toBe(true);
        expect(m.degradation_reason).toContain('playwright');
        expect(filmExitCode(m)).toBe(1);
    });
});

/* ------------------------------------------------------------------ captures */

const META = (duration: number, fps: number) =>
    `window.__videoMeta = { width: 64, height: 36, duration: ${String(duration)}, fps: ${String(fps)} };`;

const canvasPage = (script: string) => `<!doctype html><html><body style="margin:0">
<canvas id="c" width="64" height="36" style="display:block"></canvas>
<script>
const ctx = document.getElementById('c').getContext('2d');
${script}
</script></body></html>`;

describe('film witness — captures', () => {
    let browser: Browser | undefined;
    let root = '';
    beforeAll(async () => {
        const { chromium } = await import('@playwright/test');
        browser = await chromium.launch({ headless: true });
        root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'film-')));
    }, 120_000);
    afterAll(async () => {
        await browser?.close();
        if (root) fs.rmSync(root, { recursive: true, force: true });
    });

    const render = async (name: string, html: string, extra: Record<string, unknown> = {}): Promise<FilmManifest> => {
        const file = path.join(root, 'project', `${name}.html`);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, html);
        const outDir = path.join(root, 'out', name);
        if (browser === undefined) throw new Error('no browser');
        return runFilmRender(browser, { file, projectRoot: path.join(root, 'project'), outDir, target: `${name}.html`, ...extra });
    };

    it('sees a canvas film through window.__seek and proves it deterministic', async () => {
        const m = await render('seek', canvasPage(`${META(1, 10)}
window.__seek = (t) => { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 64, 36); ctx.fillStyle = '#fff'; ctx.fillRect(Math.round(t * 50), 10, 8, 8); };`));
        expect(m.form).toBe('seek');
        expect(m.frames).toHaveLength(10);
        expect(m.distinct_frames).toBe(10);
        expect(m.determinism).toMatchObject({ deterministic: true, first_diverging_frame: null });
        expect(m.meta?.source).toBe('page');
    }, 120_000);

    it('reads the window.render(t) form with declared flags', async () => {
        const m = await render('render', `<!doctype html><body style="margin:0"><div id="d" style="width:64px;height:36px"></div>
<script>window.render = (t) => { document.getElementById('d').style.background = t < 0.5 ? 'red' : 'blue'; };</script></body>`,
        { duration: 1, fps: 4, width: 64, height: 36 });
        expect(m.form).toBe('render');
        expect(m.meta?.source).toBe('flags');
        expect(m.distinct_frames).toBe(2);
    }, 120_000);

    it('holds Web Animations at each declared time', async () => {
        const m = await render('waapi', `<!doctype html><body style="margin:0"><div id="b" style="width:16px;height:16px;background:#000"></div>
<script>document.getElementById('b').animate([{ transform: 'translateX(0)' }, { transform: 'translateX(40px)' }], { duration: 1000, fill: 'both' });</script></body>`,
        { duration: 1, fps: 4, width: 64, height: 36 });
        expect(m.form).toBe('waapi');
        expect(m.distinct_frames).toBe(4);
        expect(m.determinism.deterministic).toBe(true);
    }, 120_000);

    it('refuses a page with no seek form instead of capturing empty frames', async () => {
        const m = await render('formless', '<!doctype html><body><p>still</p></body>', { duration: 1, fps: 4 });
        expect(m.form).toBe('none');
        expect(m.frames).toEqual([]);
        expect(m.verification).toBe('unassessed');
        expect(m.findings.some((f) => f.check === 'seek')).toBe(true);
        expect(filmExitCode(m)).toBe(2);
    }, 120_000);

    it('names the frame where unseeded randomness breaks determinism', async () => {
        const m = await render('random', canvasPage(`${META(1, 10)}
window.__seek = (t) => { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 64, 36); ctx.fillStyle = '#fff'; ctx.fillRect(Math.floor(Math.random() * 56), 10, 8, 8); };`));
        expect(m.determinism.deterministic).toBe(false);
        expect(m.determinism.first_diverging_frame).not.toBeNull();
        expect(m.findings.some((f) => f.check === 'determinism')).toBe(true);
        expect(filmExitCode(m)).toBe(2);
    }, 120_000);

    it('passes the same film once the randomness is seeded from t', async () => {
        const m = await render('seeded', canvasPage(`${META(1, 10)}
const rand = (s) => { let x = Math.sin(s * 9301 + 49297) * 233280; return x - Math.floor(x); };
window.__seek = (t) => { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 64, 36); ctx.fillStyle = '#fff'; ctx.fillRect(Math.floor(rand(t) * 56), 10, 8, 8); };`));
        expect(m.determinism.deterministic).toBe(true);
    }, 120_000);

    it('blocks every network attempt and keeps capturing', async () => {
        const outside = path.join(root, 'outside.txt');
        fs.writeFileSync(outside, 'secret');
        const m = await render('network', canvasPage(`${META(0.5, 4)}
fetch('https://example.invalid/x').catch(() => {});
try { new WebSocket('wss://example.invalid/s'); } catch (e) {}
const img = new Image(); img.src = 'https://example.invalid/p.png'; document.body.appendChild(img);
fetch('file://${outside}').catch(() => {});
window.__seek = (t) => { ctx.fillStyle = t < 0.25 ? '#000' : '#fff'; ctx.fillRect(0, 0, 64, 36); };`));
        expect(m.frames).toHaveLength(2);
        const blocked = m.network.blocked.join(' ');
        expect(blocked).toContain('example.invalid/p.png');
        expect(m.findings.some((f) => f.check === 'network')).toBe(true);
    }, 120_000);

    it('reports a still in the middle as dead time with its window', async () => {
        const m = await render('still', canvasPage(`${META(4, 5)}
window.__seek = (t) => { const x = t < 1 ? t * 20 : t < 3.5 ? 20 : 20 + (t - 3.5) * 20; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 64, 36); ctx.fillStyle = '#fff'; ctx.fillRect(Math.round(x), 10, 8, 8); };`),
        { hold: 2 });
        expect(m.dead_time).toHaveLength(1);
        expect(m.dead_time[0]?.from_s).toBeCloseTo(1, 1);
        expect(m.findings.filter((f) => f.check === 'dead-time')).toHaveLength(1);
    }, 120_000);

    // skip-reason: tool absent — the flash floor, encode and format checks need ffmpeg
    describe.skipIf(!HAS_FFMPEG)('with ffmpeg', () => {
        it('fails a full-frame strobe on the flash floor and passes a slow fade', async () => {
            const strobe = await render('strobe', canvasPage(`${META(2, 30)}
window.__seek = (t) => { ctx.fillStyle = Math.floor(t * 12) % 2 === 0 ? '#000' : '#fff'; ctx.fillRect(0, 0, 64, 36); };`));
            expect(strobe.checks.flash).toBe('ran');
            expect(strobe.flash?.max_flashes_per_second ?? 0).toBeGreaterThan(3);
            expect(strobe.findings.some((f) => f.check === 'flash')).toBe(true);

            const fade = await render('fade', canvasPage(`${META(2, 30)}
window.__seek = (t) => { const v = Math.round(t / 2 * 255); ctx.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')'; ctx.fillRect(0, 0, 64, 36); };`));
            expect(fade.flash?.max_flashes_per_second).toBe(0);
            expect(fade.findings).toEqual([]);
            expect(fade.contact_sheet).not.toBeNull();
        }, 180_000);

        it('encodes, records the digest of the file on disk, and checks the declared format', async () => {
            const m = await render('encode', canvasPage(`${META(1, 10)}
window.__seek = (t) => { ctx.fillStyle = '#123'; ctx.fillRect(0, 0, 64, 36); ctx.fillStyle = '#fc0'; ctx.fillRect(Math.round(t * 50), 10, 8, 8); };`),
            { out: 'film/encode.mp4' });
            expect(m.checks.encode).toBe('ran');
            expect(m.checks.format).toBe('ran');
            const file = path.join(root, 'project', m.encode?.path ?? '');
            expect(m.encode?.sha256).toBe(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'));
            expect(m.format).toMatchObject({ width: 64, height: 36 });
            expect(m.format?.fps).toBeCloseTo(10, 3);
            expect(m.findings).toEqual([]);
            expect(m.verification).toBe('verified');
            expect(filmExitCode(m)).toBe(0);
        }, 180_000);

        it('measures a muxed audio track into the manifest', async () => {
            const wav = path.join(root, 'project', 'tone.wav');
            spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1', '-ac', '2', wav]);
            const m = await render('audio', canvasPage(`${META(1, 10)}
window.__seek = (t) => { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 64, 36); ctx.fillStyle = '#fff'; ctx.fillRect(Math.round(t * 50), 10, 8, 8); };`),
            { out: 'film/audio.mp4', audio: 'tone.wav' });
            expect(m.checks.audio_qa).toBe('ran');
            expect(typeof m.audio_qa?.['integrated_lufs']).toBe('number');
        }, 180_000);
    });
});
