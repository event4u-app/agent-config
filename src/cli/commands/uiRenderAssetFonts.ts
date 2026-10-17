/**
 * Which face painted each `<text>` — steps 1.1 and 1.2 of
 * `road-to-type-with-a-witness`.
 *
 * The sentinel in `readAssetInPage` tells a family that resolved from one that
 * did not, by comparing a measured width against an absent family. It cannot
 * tell a face whose file failed from a face that never loaded, and it cannot
 * see a requested weight the face does not carry. Both are read here from
 * `document.fonts`, the renderer's own record of the faces it registered.
 *
 * No added wait. Measured on Chromium: a face the page uses holds the `load`
 * event (a 2,000 ms delayed face, `load` at 2,019 ms, status `loaded`), so the
 * navigation the witness already performs is the wait. One bounded
 * `document.fonts.ready` wait runs ONLY when a declared face still reads
 * `loading` — the face only a later script asks for — and a wait that ends
 * with the face still loading is reported as `timeout`, never as a fallback.
 */

import type { Page } from '@playwright/test';

import type { AssetFinding, AssetReading, FaceState } from './uiRenderAssetTypes.js';

/** The bounded wait, in milliseconds, for a face still `loading` after `load`. */
export const FACE_WAIT_MS = 3_000;

export interface FaceStateReading {
    /** Index of the `<text>` among `svg.querySelectorAll('*')` of the first `<svg>`. */
    index: number;
    family: string;
    state: FaceState;
}

interface RawFaceReading {
    index: number;
    family: string;
    state: FaceState | 'loading';
}

/**
 * In-page: for every `<text>`, the first family of its computed stack that
 * registers an `@font-face`, and that family's state. A text whose stack names
 * no registered family is not reported — the resolved flag already covers it.
 *
 * Self-contained: `page.evaluate` ships the source.
 */
function readFacesInPage(): RawFaceReading[] {
    const svg = document.querySelector('svg');
    if (!svg) return [];
    const unquote = (s: string): string => s.trim().replace(/^["']|["']$/g, '').toLowerCase();
    const faces = Array.from((document as unknown as { fonts: Iterable<FontFace> }).fonts);
    const all = Array.from(svg.querySelectorAll('*'));
    const out: RawFaceReading[] = [];
    for (let i = 0; i < all.length; i++) {
        const el = all[i] as Element;
        if (el.tagName.toLowerCase() !== 'text') continue;
        // Layout first: a face is requested by the layout that needs it, so a
        // stack changed after `load` reads `unloaded` until something lays out.
        try {
            (el as SVGGraphicsElement).getBBox();
        } catch {
            // An element that cannot be measured still has a computed style.
        }
        const cs = window.getComputedStyle(el);
        const stack = cs.fontFamily.split(',').map(unquote);
        let family = '';
        let own: FontFace[] = [];
        for (const name of stack) {
            const match = faces.filter((f) => unquote(f.family) === name);
            if (match.length > 0) {
                family = match[0]?.family.replace(/^["']|["']$/g, '') ?? name;
                own = match;
                break;
            }
        }
        if (own.length === 0) continue;

        const statuses = own.map((f) => f.status);
        let state: RawFaceReading['state'] = 'unloaded';
        if (statuses.includes('loaded')) state = 'loaded';
        else if (statuses.includes('loading')) state = 'loading';
        else if (statuses.includes('error')) state = 'error';

        if (state === 'loaded') {
            // Synthesis (1.2). Matching is on the @font-face DESCRIPTORS, which
            // is what the renderer matches on. Emboldening runs when 600 or
            // more is requested and no loaded face reaches 600; an oblique is
            // synthesised when italic is requested and no loaded face is
            // italic or oblique. `font-synthesis: none` turns both off.
            const loaded = own.filter((f) => f.status === 'loaded');
            const maxWeight = (w: string): number => {
                const parts = w.trim().split(/\s+/).map((p) => (p === 'bold' ? 700 : p === 'normal' ? 400 : Number(p)));
                return Math.max(...parts.filter((n) => Number.isFinite(n)), 0);
            };
            const synthOff = (axis: 'weight' | 'style'): boolean => {
                const longhand = cs.getPropertyValue(`font-synthesis-${axis}`).trim();
                if (longhand !== '') return longhand === 'none';
                return !cs.getPropertyValue('font-synthesis').includes(axis);
            };
            const requested = Number(cs.fontWeight) || 400;
            const fauxBold = requested >= 600 && loaded.every((f) => maxWeight(f.weight) < 600) && !synthOff('weight');
            const wantsSlant = cs.fontStyle !== 'normal';
            const fauxSlant = wantsSlant && loaded.every((f) => f.style.trim() === 'normal') && !synthOff('style');
            if (fauxBold || fauxSlant) state = 'synthesised';
        }
        out.push({ index: i, family, state });
    }
    return out;
}

/** Resolves `true` when every face settled inside `ms`, `false` on the bound. */
function waitForFacesInPage(ms: number): Promise<boolean> {
    const ready = (document as unknown as { fonts: { ready: Promise<unknown> } }).fonts.ready.then(() => true);
    return Promise.race([ready, new Promise<boolean>((r) => setTimeout(() => r(false), ms))]);
}

/**
 * The face state of every `<text>` on the page, with the bounded wait applied
 * only when a face still reads `loading`. `waited` says whether it ran.
 */
export async function readFaceStates(
    page: Page,
    indices?: readonly number[],
    waitMs: number = FACE_WAIT_MS,
): Promise<{ readings: FaceStateReading[]; waited: boolean }> {
    let raw = await page.evaluate(readFacesInPage);
    let waited = false;
    if (raw.some((r) => r.state === 'loading')) {
        waited = true;
        await page.evaluate(waitForFacesInPage, waitMs);
        raw = await page.evaluate(readFacesInPage);
    }
    const wanted = indices ? new Set(indices) : null;
    const readings = raw
        .filter((r) => wanted === null || wanted.has(r.index))
        .map((r) => ({ index: r.index, family: r.family, state: r.state === 'loading' ? 'timeout' : r.state }));
    return { readings, waited };
}

/** Attach the face state to the text readings `applyGeometry` already made. */
export async function applyFaceStates(page: Page, reading: AssetReading): Promise<void> {
    if (reading.texts.length === 0) return;
    const { readings } = await readFaceStates(
        page,
        reading.texts.map((t) => t.index),
    );
    const byIndex = new Map(readings.map((r) => [r.index, r]));
    for (const t of reading.texts) {
        const r = byIndex.get(t.index);
        if (!r) continue;
        t.face_family = r.family;
        t.face_state = r.state;
    }
}

/** Findings for a face that did not paint as declared. */
export function faceFindings(r: AssetReading): AssetFinding[] {
    const out: AssetFinding[] = [];
    for (const t of r.texts) {
        const label = `<text>${t.id ? ` #${t.id}` : ''}`;
        if (t.face_state === 'error' || t.face_state === 'timeout' || t.face_state === 'unloaded') {
            out.push({
                rule: 'geometry/font-face-error',
                severity: 'warning',
                detail:
                    `${label} declares "${t.face_family}" through @font-face, and that face reads ` +
                    `${t.face_state}: the text was painted by a fallback, not by the declared face`,
            });
        } else if (t.face_state === 'synthesised') {
            out.push({
                rule: 'geometry/font-synthesised',
                severity: 'warning',
                detail:
                    `${label} requests a weight or style no loaded face of "${t.face_family}" carries, so the ` +
                    'renderer synthesised it; load that face, or set `font-synthesis: none` on purpose',
            });
        }
    }
    return out;
}
