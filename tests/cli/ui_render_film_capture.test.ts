/**
 * `ui:render --profile film` — real captures of pages written into a temp
 * project (road-to-a-film-built-from-time Phases 2 and 3). Needs Chromium, so
 * it runs in the browser job (`AGENT_CONFIG_BROWSER_SUITES=1`); the pure parts
 * are in `ui_render_film.test.ts`.
 */
import { spawnSync } from 'node:child_process';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import type { Browser } from '@playwright/test';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { filmExitCode, runFilmRender, type FilmManifest } from '../../src/cli/commands/uiRenderFilm.js';

const HAS_FFMPEG =
    spawnSync('ffmpeg', ['-version']).status === 0 && spawnSync('ffprobe', ['-version']).status === 0;

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

    it('drives a registry of paused timelines (window.__timelines)', async () => {
        const m = await render('timelines', `<!doctype html><body style="margin:0"><div id="b" style="width:16px;height:16px;background:#000"></div>
<script>${META(1, 4)}
const el = document.getElementById('b');
let now = 0;
const tl = { paused: false, pause() { this.paused = true; }, seek(t) { now = t; el.style.transform = 'translateX(' + Math.round(t * 40) + 'px)'; } };
window.__timelines = { main: tl };</script></body>`);
        expect(m.form).toBe('timelines');
        expect(m.distinct_frames).toBe(4);
        expect(m.determinism.deterministic).toBe(true);
    }, 120_000);

    it('does not claim the timelines form for a registry it cannot seek', async () => {
        const m = await render('timelines-unseekable', `<!doctype html><body><p>still</p>
<script>window.__timelines = { main: { play() {} } };</script></body>`, { duration: 1, fps: 4 });
        expect(m.form).toBe('none');
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

        it('holds embedded footage at t minus its data-start', async () => {
            const clip = path.join(root, 'project', 'clip.webm');
            fs.mkdirSync(path.dirname(clip), { recursive: true });
            spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=size=64x36:rate=10:duration=2',
                '-c:v', 'libvpx', '-g', '1', '-b:v', '400k', clip]);
            const m = await render('footage', `<!doctype html><body style="margin:0">
<video src="clip.webm" muted playsinline data-start="0.5" style="display:block;width:64px;height:36px"></video>
<script>${META(1, 10)}</script></body>`);
            expect(m.form).toBe('waapi');
            // t = 0..0.5 all hold the clip's first frame; 0.6..0.9 are four more.
            expect(m.distinct_frames).toBe(5);
            expect(m.determinism.deterministic).toBe(true);
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
