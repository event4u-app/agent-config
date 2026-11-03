/**
 * `ui:render --profile film` — the film witness (road-to-a-film-built-from-time
 * Phases 2 and 3). Pure parts first, then real captures of pages written into
 * a temp project, so every expectation follows from how the page was built.
 * The captures need Chromium and live in `ui_render_film_capture.test.ts`,
 * which only the browser job runs.
 */
import { describe, expect, it } from 'vitest';

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
} from '../../src/cli/commands/uiRenderFilm.js';

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
        expect(m.checks.video_qa).toBe('skipped: renderer absent');
        expect(m.video_qa).toBeNull();
        expect(m.degradation_reason).toContain('playwright');
        expect(filmExitCode(m)).toBe(1);
    });
});
