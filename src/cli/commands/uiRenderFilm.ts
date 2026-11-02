/**
 * `ui:render <page.html> --profile film` — the film witness.
 *
 * A code-rendered film is a page whose every frame is a pure function of its
 * timestamp (`docs/contracts/film-page.md`). This profile seeks the page to each
 * frame time, captures it, hashes it, proves the sequence deterministic by
 * capturing it again in reverse order, and — with ffmpeg present — encodes it,
 * checks the declared format, and runs the photosensitivity floor over the
 * frames. Every check reports `ran` or `skipped: <reason>`; a skipped check is
 * never a pass.
 *
 * WHY A SEPARATE PROFILE, not an extension of the asset profile: the asset
 * witness runs with page scripts disabled for the whole browser context
 * (`uiRenderAssetIsolation.ts`), so a page-defined `window.__seek` never
 * exists there. A film needs its scripts. They run here with the network
 * OFF — an offline context, and every request that is not a `file:` URL inside
 * the project roots (or `data:`/`blob:`/`about:`) aborted and recorded — and
 * the asset profile stays exactly as it was.
 *
 * Class A, same as the other profiles: the browser closes in a `finally` on
 * every path, nothing is cached between invocations.
 */

import { spawnSync } from 'node:child_process';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Browser, BrowserContext, Page } from '@playwright/test';

import { confinePage, fileRootsFor } from './uiRenderAssetIsolation.js';

export type SeekForm = 'seek' | 'render' | 'timelines' | 'waapi' | 'none';
export type CheckState = 'ran' | `skipped: ${string}`;

export interface FilmMeta {
    width: number;
    height: number;
    duration: number;
    fps: number;
    source: 'page' | 'flags';
}

export interface FilmFrame {
    index: number;
    t: number;
    sha256: string;
}

export interface FilmFinding {
    check: 'determinism' | 'dead-time' | 'flash' | 'red-flash' | 'format' | 'seek' | 'network' | 'encode';
    detail: string;
}

export interface FlashReading {
    max_flashes_per_second: number;
    max_red_flashes_per_second: number;
    window_start_s: number | null;
    limit: 3;
    method: 'full-frame mean relative luminance (area-averaged)';
}

export interface FilmManifest {
    schema: 1;
    profile: 'film';
    generated_at: string;
    target: string;
    form: SeekForm;
    meta: FilmMeta | null;
    frames: FilmFrame[];
    distinct_frames: number;
    dead_time: Array<{ from_s: number; to_s: number }>;
    determinism: { deterministic: boolean | null; first_diverging_frame: number | null; scope: 'this machine' };
    network: { blocked: string[] };
    flash: FlashReading | null;
    format: { width: number; height: number; fps: number; duration: number } | null;
    contact_sheet: string | null;
    audio_qa: Record<string, unknown> | null;
    encode: { path: string; sha256: string } | null;
    checks: Record<'seek' | 'determinism' | 'dead_time' | 'encode' | 'format' | 'flash' | 'contact_sheet' | 'audio_qa', CheckState>;
    findings: FilmFinding[];
    verification: 'verified' | 'static-only' | 'unassessed';
    goal: 'unassessed';
    degradation_reason?: string;
}

export interface FilmOptions {
    file: string;
    projectRoot: string;
    outDir: string;
    target: string;
    duration?: number | undefined;
    fps?: number | undefined;
    width?: number | undefined;
    height?: number | undefined;
    /** Encode the frames to this MP4 (relative to the project root). */
    out?: string | undefined;
    /** Mux this audio file into the encode and measure it. */
    audio?: string | undefined;
    /** Longest unchanged stretch, in seconds, that is not dead time. */
    hold?: number | undefined;
    /** Tiles in the contact sheet. */
    tiles?: number | undefined;
}

/* ----------------------------------------------------------------- pure parts */

export function frameTimes(duration: number, fps: number): number[] {
    const n = Math.max(1, Math.round(duration * fps));
    return Array.from({ length: n }, (_, i) => Number((i / fps).toFixed(6)));
}

/** Runs of identical consecutive frames longer than `hold` seconds. */
export function deadTimeSpans(digests: readonly string[], fps: number, hold: number): Array<{ from_s: number; to_s: number }> {
    const spans: Array<{ from_s: number; to_s: number }> = [];
    let start = 0;
    for (let i = 1; i <= digests.length; i++) {
        if (i < digests.length && digests[i] === digests[start]) continue;
        const frames = i - start;
        if (frames / fps > hold) spans.push({ from_s: start / fps, to_s: i / fps });
        start = i;
    }
    return spans;
}

/** Index of the first frame whose two captures differ, or null. */
export function firstDivergence(a: readonly string[], b: readonly string[]): number | null {
    const n = Math.max(a.length, b.length);
    for (let i = 0; i < n; i++) if (a[i] !== b[i]) return i;
    return null;
}

/** sRGB 0–255 channel to linear light. */
const lin = (c: number): number => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

export function relativeLuminance(r: number, g: number, b: number): number {
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/**
 * Frame indices at which a luminance change counts toward a flash: an
 * opposing change of at least 0.1 relative luminance where the darker state is
 * below 0.8. A run in one direction extends its extreme instead of counting
 * twice, so a slow fade is one change and never a flash.
 */
export function luminanceChanges(lum: readonly number[]): number[] {
    const changes: number[] = [];
    if (lum.length === 0) return changes;
    let anchor = lum[0] ?? 0;
    let lastDir = 0;
    for (let i = 1; i < lum.length; i++) {
        const v = lum[i] ?? 0;
        if ((lastDir === 1 && v > anchor) || (lastDir === -1 && v < anchor)) {
            anchor = v;
            continue;
        }
        const delta = v - anchor;
        if (Math.abs(delta) >= 0.1 && Math.min(v, anchor) < 0.8) {
            const dir = delta > 0 ? 1 : -1;
            if (dir !== lastDir) {
                changes.push(i);
                lastDir = dir;
                anchor = v;
            }
        }
    }
    return changes;
}

/** Frame indices where saturated red (R / (R+G+B) ≥ 0.8) switches on or off. */
export function redChanges(rgb: ReadonlyArray<readonly [number, number, number]>): number[] {
    const sat = rgb.map(([r, g, b]) => (r + g + b > 0 ? r / (r + g + b) >= 0.8 : false));
    const out: number[] = [];
    for (let i = 1; i < sat.length; i++) if (sat[i] !== sat[i - 1]) out.push(i);
    return out;
}

/** The most flashes (pairs of changes) in any one-second window, and where it starts. */
export function maxFlashesPerSecond(changes: readonly number[], fps: number): { max: number; at: number | null } {
    let max = 0;
    let at: number | null = null;
    const win = Math.max(1, Math.round(fps));
    for (let s = 0; s < changes.length; s++) {
        const start = changes[s] ?? 0;
        let count = 0;
        for (let e = s; e < changes.length && (changes[e] ?? 0) < start + win; e++) count++;
        const flashes = Math.floor(count / 2);
        if (flashes > max) {
            max = flashes;
            at = start / fps;
        }
    }
    return { max, at };
}

export function formatFindings(
    declared: { width: number; height: number; fps: number; duration: number },
    probed: { width: number; height: number; fps: number; duration: number },
): FilmFinding[] {
    const out: FilmFinding[] = [];
    if (declared.width !== probed.width || declared.height !== probed.height) {
        out.push({ check: 'format', detail: `size: declared ${String(declared.width)}x${String(declared.height)}, file ${String(probed.width)}x${String(probed.height)}` });
    }
    if (Math.abs(declared.fps - probed.fps) > 0.01) {
        out.push({ check: 'format', detail: `fps: declared ${String(declared.fps)}, file ${String(probed.fps)}` });
    }
    if (Math.abs(declared.duration - probed.duration) > 1 / declared.fps + 1e-6) {
        out.push({ check: 'format', detail: `duration: declared ${String(declared.duration)} s, file ${String(probed.duration)} s` });
    }
    return out;
}

/* ------------------------------------------------------------- page interface */

/** Which seek form does the page expose? Read after load, scripts running. */
function detectForm(): SeekForm {
    const w = window as unknown as Record<string, unknown>;
    if (typeof w['__seek'] === 'function') return 'seek';
    if (typeof w['render'] === 'function') return 'render';
    // A registry of paused timelines (`window.__timelines`), the shape a
    // timeline framework exposes. Each entry must be seekable to count.
    const reg = w['__timelines'];
    if (reg !== null && typeof reg === 'object') {
        const tls = Object.values(reg as Record<string, Record<string, unknown> | null>);
        const seekable = (tl: Record<string, unknown> | null): boolean =>
            tl !== null && typeof tl === 'object' && ['seek', 'time', 'totalTime'].some((k) => typeof tl[k] === 'function');
        if (tls.length > 0 && tls.every(seekable)) return 'timelines';
    }
    if (document.querySelector('video') !== null) return 'waapi';
    const smil = document.querySelector('svg animate, svg animateTransform, svg animateMotion, svg set') !== null;
    if (smil || document.getAnimations().length > 0) return 'waapi';
    return 'none';
}

function readPageMeta(): { width: number; height: number; duration: number; fps: number } | null {
    const m = (window as unknown as { __videoMeta?: Record<string, unknown> }).__videoMeta;
    if (m === undefined || m === null) return null;
    const n = (k: string): number => Number(m[k]);
    const meta = { width: n('width'), height: n('height'), duration: n('duration'), fps: n('fps') };
    return Object.values(meta).every((v) => Number.isFinite(v) && v > 0) ? meta : null;
}

async function seekPage(arg: { t: number; form: SeekForm }): Promise<void> {
    const w = window as unknown as Record<string, (t: number) => unknown>;
    if (arg.form === 'seek') await w['__seek']?.(arg.t);
    else if (arg.form === 'render') await w['render']?.(arg.t);
    else {
        if (arg.form === 'timelines') {
            const reg = (window as unknown as { __timelines?: Record<string, Record<string, ((...a: unknown[]) => unknown) | undefined>> }).__timelines ?? {};
            for (const tl of Object.values(reg)) {
                tl['pause']?.call(tl);
                if (typeof tl['seek'] === 'function') tl['seek'].call(tl, arg.t, false);
                else if (typeof tl['totalTime'] === 'function') tl['totalTime'].call(tl, arg.t, true);
                else tl['time']?.call(tl, arg.t, true);
            }
        }
        for (const svg of Array.from(document.querySelectorAll('svg'))) {
            const s = svg as SVGSVGElement;
            if (typeof s.pauseAnimations === 'function') {
                s.pauseAnimations();
                s.setCurrentTime(arg.t);
            }
        }
        for (const anim of document.getAnimations()) {
            anim.pause();
            anim.currentTime = arg.t * 1000;
        }
        // Embedded footage: held at `t - data-start`, clamped inside the clip,
        // and only captured once the decoder reports the seek done.
        await Promise.all(Array.from(document.querySelectorAll('video')).map(async (v) => {
            v.pause();
            const start = Number(v.dataset['start'] ?? 0) || 0;
            const settle = (ev: string): Promise<void> => new Promise<void>((r) => {
                v.addEventListener(ev, () => r(), { once: true });
                v.addEventListener('error', () => r(), { once: true });
            });
            if (v.readyState < 1) await settle('loadedmetadata');
            if (v.error !== null) return;
            const end = Number.isFinite(v.duration) ? Math.max(0, v.duration - 0.001) : Infinity;
            const target = Math.min(Math.max(0, arg.t - start), end);
            if (Math.abs(v.currentTime - target) < 1e-6 && v.readyState >= 2) return;
            const done = settle('seeked');
            v.currentTime = target;
            await done;
        }));
    }
    await document.fonts.ready;
    // Two animation frames, so a held animation's new time has reached the
    // compositor before the screenshot is taken.
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

/* --------------------------------------------------------------- the profile */

const sha = (b: Buffer): string => crypto.createHash('sha256').update(b).digest('hex');
const hasTool = (bin: string): boolean => spawnSync(bin, ['-version'], { stdio: 'ignore' }).status === 0;

async function openFilmPage(context: BrowserContext, url: string, blocked: string[], roots: readonly string[], size: { width: number; height: number }): Promise<Page> {
    const page = await context.newPage();
    await page.setViewportSize(size);
    await confinePage(page, blocked, roots);
    page.on('websocket', (ws) => blocked.push(ws.url()));
    await page.goto(url, { waitUntil: 'load', timeout: 30_000 });
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    return page;
}

async function captureSequence(page: Page, times: readonly number[], form: SeekForm, order: readonly number[], dir: string | null): Promise<string[]> {
    const digests: string[] = new Array<string>(times.length).fill('');
    // A warm-up seek, not captured: the first capture after load would
    // otherwise be the only frame that follows no seek, and a held animation
    // renders it from a different layer state than every later frame.
    await page.evaluate(seekPage, { t: times[times.length - 1 - (order[0] ?? 0)] ?? 0, form });
    for (const i of order) {
        await page.evaluate(seekPage, { t: times[i] ?? 0, form });
        const shot = await page.screenshot({ type: 'png' });
        digests[i] = sha(shot);
        if (dir !== null) fs.writeFileSync(path.join(dir, `f_${String(i).padStart(5, '0')}.png`), shot);
    }
    return digests;
}

/** Mean sRGB per frame, read by area-averaging each frame to one pixel. */
function meanRgb(framesDir: string, fps: number): Array<[number, number, number]> | null {
    const r = spawnSync(
        'ffmpeg',
        ['-v', 'error', '-framerate', String(fps), '-i', path.join(framesDir, 'f_%05d.png'),
            '-vf', 'scale=1:1:flags=area,format=rgb24', '-f', 'rawvideo', '-'],
        { maxBuffer: 64 * 1024 * 1024 },
    );
    if (r.status !== 0) return null;
    const out: Array<[number, number, number]> = [];
    for (let i = 0; i + 2 < r.stdout.length; i += 3) out.push([r.stdout[i] ?? 0, r.stdout[i + 1] ?? 0, r.stdout[i + 2] ?? 0]);
    return out;
}

function probe(file: string): { width: number; height: number; fps: number; duration: number } | null {
    const r = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries',
        'stream=width,height,r_frame_rate:format=duration', '-of', 'json', file], { encoding: 'utf-8' });
    if (r.status !== 0) return null;
    const j = JSON.parse(r.stdout) as { streams?: Array<{ width: number; height: number; r_frame_rate: string }>; format?: { duration: string } };
    const s = j.streams?.[0];
    if (s === undefined) return null;
    const [num, den] = s.r_frame_rate.split('/').map(Number);
    return { width: s.width, height: s.height, fps: (num ?? 0) / (den || 1), duration: Number(j.format?.duration ?? 0) };
}

const AUDIO_QA = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'scripts', 'media', 'lib', 'audio-qa.sh');

export async function runFilmRender(browser: Browser, opts: FilmOptions): Promise<FilmManifest> {
    const blocked: string[] = [];
    const findings: FilmFinding[] = [];
    const roots = fileRootsFor(opts.projectRoot, opts.file);
    const m: FilmManifest = {
        schema: 1, profile: 'film', generated_at: new Date().toISOString(), target: opts.target,
        form: 'none', meta: null, frames: [], distinct_frames: 0, dead_time: [],
        determinism: { deterministic: null, first_diverging_frame: null, scope: 'this machine' },
        network: { blocked }, flash: null, format: null, contact_sheet: null, audio_qa: null, encode: null,
        checks: {
            seek: 'skipped: not reached', determinism: 'skipped: not reached', dead_time: 'skipped: not reached',
            encode: 'skipped: no --out', format: 'skipped: no --out', flash: 'skipped: not reached',
            contact_sheet: 'skipped: not reached', audio_qa: 'skipped: no --audio',
        },
        findings, verification: 'unassessed', goal: 'unassessed',
    };

    // Scripts ON, network OFF: the context is offline and every page is confined.
    const context = await browser.newContext({ javaScriptEnabled: true, offline: true });
    await context.addInitScript(() => {
        const g = globalThis as unknown as { __name?: (fn: unknown) => unknown };
        if (typeof g.__name !== 'function') g.__name = (fn: unknown) => fn;
    });
    try {
        const url = `file://${opts.file}`;
        const probePage = await openFilmPage(context, url, blocked, roots, { width: opts.width ?? 1280, height: opts.height ?? 720 });
        m.form = await probePage.evaluate(detectForm);
        const pageMeta = await probePage.evaluate(readPageMeta);
        await probePage.close();

        const flagMeta = opts.duration !== undefined && opts.fps !== undefined
            ? { width: opts.width ?? 1280, height: opts.height ?? 720, duration: opts.duration, fps: opts.fps }
            : null;
        const meta = pageMeta ?? flagMeta;
        if (meta === null) {
            m.checks.seek = 'skipped: no window.__videoMeta and no --duration/--fps';
            findings.push({ check: 'seek', detail: 'duration and fps unknown — declare window.__videoMeta or pass --duration and --fps' });
            m.degradation_reason = 'film length undeclared';
            return m;
        }
        m.meta = { ...meta, source: pageMeta !== null ? 'page' : 'flags' };
        if (m.form === 'none') {
            m.checks.seek = 'skipped: no recognised seek form';
            findings.push({ check: 'seek', detail: 'page exposes neither window.__seek(t), window.render(t), window.__timelines, Web Animations, SMIL nor <video>' });
            m.degradation_reason = 'no seek form';
            return m;
        }
        m.checks.seek = 'ran';

        const times = frameTimes(meta.duration, meta.fps);
        const framesDir = path.join(opts.outDir, 'frames');
        fs.rmSync(framesDir, { recursive: true, force: true });
        fs.mkdirSync(framesDir, { recursive: true });
        const size = { width: meta.width, height: meta.height };

        const forward = await openFilmPage(context, url, blocked, roots, size);
        const ascending = times.map((_, i) => i);
        const a = await captureSequence(forward, times, m.form, ascending, framesDir);
        await forward.close();
        // The second pass runs on a fresh page in reverse order, so every frame
        // follows a different predecessor: state carried between frames shows up.
        const backward = await openFilmPage(context, url, blocked, roots, size);
        const b = await captureSequence(backward, times, m.form, [...ascending].reverse(), null);
        await backward.close();

        m.frames = a.map((d, i) => ({ index: i, t: times[i] ?? 0, sha256: d }));
        m.distinct_frames = new Set(a).size;
        const diverge = firstDivergence(a, b);
        m.determinism = { deterministic: diverge === null, first_diverging_frame: diverge, scope: 'this machine' };
        m.checks.determinism = 'ran';
        if (diverge !== null) {
            findings.push({ check: 'determinism', detail: `frame ${String(diverge)} (t=${String(times[diverge])} s) differs between forward and reverse capture` });
        }
        m.dead_time = deadTimeSpans(a, meta.fps, opts.hold ?? 3);
        m.checks.dead_time = 'ran';
        for (const s of m.dead_time) findings.push({ check: 'dead-time', detail: `no change from ${s.from_s.toFixed(2)} s to ${s.to_s.toFixed(2)} s` });
        if (blocked.length > 0) findings.push({ check: 'network', detail: `${String(blocked.length)} request(s) blocked: ${blocked.slice(0, 3).join(', ')}` });

        const ffmpeg = hasTool('ffmpeg');
        const ffprobe = hasTool('ffprobe');
        if (!ffmpeg) {
            m.checks.flash = 'skipped: ffmpeg not on PATH';
            m.checks.contact_sheet = 'skipped: ffmpeg not on PATH';
            if (opts.out !== undefined) m.checks.encode = 'skipped: ffmpeg not on PATH';
            if (opts.out !== undefined) m.checks.format = 'skipped: ffmpeg not on PATH';
            if (opts.audio !== undefined) m.checks.audio_qa = 'skipped: ffmpeg not on PATH';
            m.degradation_reason = 'ffmpeg absent — frames captured and hashed; flash floor, encode and format not assessed';
            m.verification = 'static-only';
            return m;
        }

        const rgb = meanRgb(framesDir, meta.fps);
        if (rgb === null) m.checks.flash = 'skipped: frame read failed';
        else {
            const lum = rgb.map(([r, g, bl]) => relativeLuminance(r, g, bl));
            const gen = maxFlashesPerSecond(luminanceChanges(lum), meta.fps);
            const red = maxFlashesPerSecond(redChanges(rgb), meta.fps);
            m.flash = {
                max_flashes_per_second: gen.max, max_red_flashes_per_second: red.max,
                window_start_s: gen.max >= red.max ? gen.at : red.at, limit: 3,
                method: 'full-frame mean relative luminance (area-averaged)',
            };
            m.checks.flash = 'ran';
            if (gen.max > 3) findings.push({ check: 'flash', detail: `${String(gen.max)} general flashes in one second from ${String(gen.at)} s (limit 3)` });
            if (red.max > 3) findings.push({ check: 'red-flash', detail: `${String(red.max)} saturated-red flashes in one second from ${String(red.at)} s (limit 3)` });
        }

        const tiles = Math.max(1, Math.min(opts.tiles ?? 12, times.length));
        const step = Math.max(1, Math.floor(times.length / tiles));
        const cols = Math.ceil(Math.sqrt(tiles));
        const rows = Math.ceil(tiles / cols);
        const sheet = path.join(opts.outDir, 'contact.png');
        const sheetRun = spawnSync('ffmpeg', ['-v', 'error', '-y', '-framerate', String(meta.fps), '-i', path.join(framesDir, 'f_%05d.png'),
            '-vf', `select='not(mod(n\\,${String(step)}))',scale=320:-2,tile=${String(cols)}x${String(rows)}`, '-frames:v', '1', sheet]);
        if (sheetRun.status === 0) {
            m.contact_sheet = path.relative(opts.projectRoot, sheet).split(path.sep).join('/');
            m.checks.contact_sheet = 'ran';
        } else m.checks.contact_sheet = 'skipped: tile failed';

        if (opts.audio !== undefined) {
            const qa = spawnSync('bash', [AUDIO_QA, path.resolve(opts.projectRoot, opts.audio)], { encoding: 'utf-8' });
            if (qa.status === 0) {
                m.audio_qa = JSON.parse(qa.stdout) as Record<string, unknown>;
                m.checks.audio_qa = 'ran';
            } else m.checks.audio_qa = `skipped: audio-qa exit ${String(qa.status)}`;
        }

        if (opts.out !== undefined) {
            const outFile = path.resolve(opts.projectRoot, opts.out);
            fs.mkdirSync(path.dirname(outFile), { recursive: true });
            const args = ['-v', 'error', '-y', '-framerate', String(meta.fps), '-i', path.join(framesDir, 'f_%05d.png')];
            if (opts.audio !== undefined) args.push('-i', path.resolve(opts.projectRoot, opts.audio), '-c:a', 'aac', '-shortest');
            args.push('-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', String(meta.fps), outFile);
            const enc = spawnSync('ffmpeg', args, { encoding: 'utf-8' });
            if (enc.status !== 0) {
                m.checks.encode = `skipped: ffmpeg exit ${String(enc.status)}`;
                findings.push({ check: 'encode', detail: enc.stderr.trim().split('\n').slice(-1)[0] ?? 'encode failed' });
            } else {
                m.encode = { path: path.relative(opts.projectRoot, outFile).split(path.sep).join('/'), sha256: sha(fs.readFileSync(outFile)) };
                m.checks.encode = 'ran';
                const probed = ffprobe ? probe(outFile) : null;
                if (probed === null) m.checks.format = 'skipped: ffprobe not on PATH';
                else {
                    m.format = probed;
                    m.checks.format = 'ran';
                    findings.push(...formatFindings(meta, probed));
                }
            }
        }

        // `verified` needs every check that applies to have run, and an encode
        // whose recorded digest is the file on disk.
        const pending = Object.entries(m.checks).filter(([k, v]) => v !== 'ran' && !(k === 'audio_qa' && opts.audio === undefined)
            && !((k === 'encode' || k === 'format') && opts.out === undefined));
        const encodedMatches = m.encode === null
            || sha(fs.readFileSync(path.resolve(opts.projectRoot, m.encode.path))) === m.encode.sha256;
        m.verification = pending.length === 0 && encodedMatches ? 'verified' : 'static-only';
        return m;
    } finally {
        await context.close();
    }
}

/** Exit status for a film manifest: 0 clean, 2 findings, 1 not assessed. */
export function filmExitCode(m: FilmManifest): number {
    if (m.findings.length > 0) return 2;
    return m.verification === 'unassessed' ? 1 : 0;
}
