/**
 * `svg-structure-filled-counter` — step 3.2 of `road-to-type-with-a-witness`.
 *
 * A letter with a counter (o, e, a, B, 8) or an O-ring mark is one path with an
 * outer and an inner contour. Under `fill-rule="nonzero"`, the default, the
 * counter stays open only when the inner contour winds the OTHER way: a
 * same-direction inner contour adds to the winding number and the counter
 * paints. Measured on the repo's Chromium: two same-direction circles of radius
 * 250 and 160 painted 196,282 px, the ring they should be 115,940.
 *
 * The check flattens each subpath to a polygon, and reports a subpath whose
 * every vertex lies inside another subpath of the same path when the two share
 * a winding sign. It is advisory (decision A8): `warning`, never `error`, until
 * the false-positive census of step 3.3 says otherwise.
 *
 * Limits, stated rather than guessed around: a transform does not change a
 * winding sign unless it mirrors, and a mirror flips both contours alike, so
 * transforms are ignored; `fill-rule` set from a stylesheet selector is not
 * read — an attribute or inline style, on the path or an ancestor, is.
 */

import { tokenisePath } from './svg_geometry.js';
import type { Finding, SvgElement } from './svg_rules.js';

type Pt = [number, number];

export interface FilledCounter {
    /** The `<path>` element. */
    element: SvgElement;
    /** 1-based index of the subpath that should be a counter. */
    inner: number;
    /** 1-based index of the subpath that contains it. */
    outer: number;
}

const CURVE_STEPS = 12;
const MAX_SUBPATHS = 400;

function styleProp(el: SvgElement, prop: string): string | undefined {
    const direct = el.attrs[prop];
    if (direct !== undefined) return direct.trim();
    const m = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, 'i').exec(el.attrs['style'] ?? '');
    return m?.[1]?.trim();
}

function arcPoints(from: Pt, args: number[]): Pt[] {
    const [rxIn, ryIn, rotDeg, large, sweep, x, y] = args as [number, number, number, number, number, number, number];
    const [x1, y1] = from;
    let rx = Math.abs(rxIn);
    let ry = Math.abs(ryIn);
    if (rx === 0 || ry === 0 || (x1 === x && y1 === y)) return [[x, y]];
    const phi = (rotDeg * Math.PI) / 180;
    const cos = Math.cos(phi);
    const sin = Math.sin(phi);
    const dx = (x1 - x) / 2;
    const dy = (y1 - y) / 2;
    const xp = cos * dx + sin * dy;
    const yp = -sin * dx + cos * dy;
    const lambda = (xp * xp) / (rx * rx) + (yp * yp) / (ry * ry);
    if (lambda > 1) {
        rx *= Math.sqrt(lambda);
        ry *= Math.sqrt(lambda);
    }
    const num = rx * rx * ry * ry - rx * rx * yp * yp - ry * ry * xp * xp;
    const den = rx * rx * yp * yp + ry * ry * xp * xp;
    const coef = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, num / den));
    const cxp = (coef * rx * yp) / ry;
    const cyp = (-coef * ry * xp) / rx;
    const cx = cos * cxp - sin * cyp + (x1 + x) / 2;
    const cy = sin * cxp + cos * cyp + (y1 + y) / 2;
    const angle = (ux: number, uy: number, vx: number, vy: number): number => {
        const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
        return a;
    };
    const t1 = angle(1, 0, (xp - cxp) / rx, (yp - cyp) / ry);
    let dt = angle((xp - cxp) / rx, (yp - cyp) / ry, (-xp - cxp) / rx, (-yp - cyp) / ry);
    if (!sweep && dt > 0) dt -= 2 * Math.PI;
    if (sweep && dt < 0) dt += 2 * Math.PI;
    const out: Pt[] = [];
    for (let k = 1; k <= CURVE_STEPS; k++) {
        const t = t1 + (dt * k) / CURVE_STEPS;
        const ex = rx * Math.cos(t);
        const ey = ry * Math.sin(t);
        out.push([cos * ex - sin * ey + cx, sin * ex + cos * ey + cy]);
    }
    return out;
}

function bezier(p0: Pt, p1: Pt, p2: Pt, p3: Pt): Pt[] {
    const out: Pt[] = [];
    for (let k = 1; k <= CURVE_STEPS; k++) {
        const t = k / CURVE_STEPS;
        const u = 1 - t;
        out.push([
            u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
            u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
        ]);
    }
    return out;
}

/** Each subpath of `d` as a flattened polygon, or `null` when `d` does not parse. */
export function subpathPolygons(d: string): Pt[][] | null {
    const tokens = tokenisePath(d);
    if (tokens === null) return null;
    const ARGS: Record<string, number> = { m: 2, l: 2, t: 2, h: 1, v: 1, c: 6, s: 4, q: 4, a: 7, z: 0 };
    const polys: Pt[][] = [];
    let poly: Pt[] = [];
    let cur: Pt = [0, 0];
    let start: Pt = [0, 0];
    let lastCtrl: Pt | null = null;
    let lastQuad: Pt | null = null;
    let i = 0;
    let cmd = '';
    const flush = (): void => {
        if (poly.length >= 3) polys.push(poly);
        poly = [];
    };
    while (i < tokens.length) {
        const tok = tokens[i] as string;
        if (/^[a-zA-Z]$/.test(tok)) {
            cmd = tok;
            i += 1;
            if (cmd.toLowerCase() === 'z') {
                cur = start;
                lastCtrl = lastQuad = null;
                flush();
                continue;
            }
            if (i >= tokens.length) break;
            continue;
        }
        const lower = cmd.toLowerCase();
        const n = ARGS[lower];
        if (n === undefined || n === 0) return null;
        const a = tokens.slice(i, i + n).map(Number);
        if (a.length < n || a.some((v) => !Number.isFinite(v))) return null;
        i += n;
        const rel = cmd !== cmd.toUpperCase();
        const ox = rel ? cur[0] : 0;
        const oy = rel ? cur[1] : 0;
        const at = (k: number): Pt => [(a[k] as number) + ox, (a[k + 1] as number) + oy];
        let next: Pt = cur;
        let pts: Pt[] = [];
        let ctrl: Pt | null = null;
        let quad: Pt | null = null;
        switch (lower) {
            case 'm':
                flush();
                next = at(0);
                start = next;
                pts = [next];
                // Further pairs after a moveto are implicit linetos.
                cmd = rel ? 'l' : 'L';
                break;
            case 'l':
                next = at(0);
                pts = [next];
                break;
            case 'h':
                next = [(a[0] as number) + ox, cur[1]];
                pts = [next];
                break;
            case 'v':
                next = [cur[0], (a[0] as number) + oy];
                pts = [next];
                break;
            case 'c':
                ctrl = at(2);
                next = at(4);
                pts = bezier(cur, at(0), ctrl, next);
                break;
            case 's': {
                const c1: Pt = lastCtrl ? [2 * cur[0] - lastCtrl[0], 2 * cur[1] - lastCtrl[1]] : cur;
                ctrl = at(0);
                next = at(2);
                pts = bezier(cur, c1, ctrl, next);
                break;
            }
            case 'q':
            case 't': {
                const q: Pt =
                    lower === 'q' ? at(0) : lastQuad ? [2 * cur[0] - lastQuad[0], 2 * cur[1] - lastQuad[1]] : cur;
                next = lower === 'q' ? at(2) : at(0);
                quad = q;
                const c1: Pt = [cur[0] + (2 / 3) * (q[0] - cur[0]), cur[1] + (2 / 3) * (q[1] - cur[1])];
                const c2: Pt = [next[0] + (2 / 3) * (q[0] - next[0]), next[1] + (2 / 3) * (q[1] - next[1])];
                pts = bezier(cur, c1, c2, next);
                break;
            }
            case 'a':
                next = [(a[5] as number) + ox, (a[6] as number) + oy];
                pts = arcPoints(cur, [a[0], a[1], a[2], a[3], a[4], next[0], next[1]] as number[]);
                break;
        }
        poly.push(...pts);
        cur = next;
        lastCtrl = ctrl;
        lastQuad = quad;
        if (polys.length > MAX_SUBPATHS) return polys;
    }
    flush();
    return polys;
}

function signedArea(poly: readonly Pt[]): number {
    let s = 0;
    for (let k = 0; k < poly.length; k++) {
        const [x1, y1] = poly[k] as Pt;
        const [x2, y2] = poly[(k + 1) % poly.length] as Pt;
        s += x1 * y2 - x2 * y1;
    }
    return s / 2;
}

function inside(pt: Pt, poly: readonly Pt[]): boolean {
    let hit = false;
    for (let k = 0, j = poly.length - 1; k < poly.length; j = k++) {
        const [xi, yi] = poly[k] as Pt;
        const [xj, yj] = poly[j] as Pt;
        if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) hit = !hit;
    }
    return hit;
}

/**
 * Every `<path>` painted under `nonzero` whose subpath sits inside another of
 * its subpaths with the same winding. One entry per inner subpath.
 */
export function filledCounters(elements: readonly SvgElement[]): FilledCounter[] {
    const out: FilledCounter[] = [];
    // The fill rule and fill each element inherits, by an open-element stack.
    const stack: Array<{ name: string; rule: string | undefined; fill: string | undefined }> = [];
    for (const el of elements) {
        if (el.closing) {
            const at = stack.map((s) => s.name).lastIndexOf(el.name);
            if (at >= 0) stack.length = at;
            continue;
        }
        const parent = stack[stack.length - 1];
        const rule = styleProp(el, 'fill-rule') ?? parent?.rule;
        const fill = styleProp(el, 'fill') ?? parent?.fill;
        if (!el.selfClosing) stack.push({ name: el.name, rule, fill });
        if (el.name !== 'path') continue;
        if ((rule ?? 'nonzero').toLowerCase() === 'evenodd' || (fill ?? '').toLowerCase() === 'none') continue;
        const polys = subpathPolygons(el.attrs['d'] ?? '');
        if (polys === null || polys.length < 2 || polys.length > MAX_SUBPATHS) continue;
        const areas = polys.map(signedArea);
        for (let inner = 0; inner < polys.length; inner++) {
            const ia = areas[inner] as number;
            if (Math.abs(ia) < 1e-9) continue;
            for (let outer = 0; outer < polys.length; outer++) {
                if (outer === inner) continue;
                const oa = areas[outer] as number;
                if (Math.abs(oa) <= Math.abs(ia) || Math.sign(oa) !== Math.sign(ia)) continue;
                const op = polys[outer] as Pt[];
                if ((polys[inner] as Pt[]).every((p) => inside(p, op))) {
                    out.push({ element: el, inner: inner + 1, outer: outer + 1 });
                    break;
                }
            }
        }
    }
    return out;
}

/** The rule as `scanSvg` runs it: one advisory finding per filled counter. */
export function ruleFilledCounter(elements: readonly SvgElement[], file: string): Finding[] {
    return filledCounters(elements).map((c) => ({
        rule: 'svg-structure-filled-counter',
        file,
        line: c.element.line,
        snippet:
            `<path> subpath ${c.inner} sits inside subpath ${c.outer} with the same winding under nonzero, so ` +
            'the counter paints — wind the inner contour the other way, or declare fill-rule="evenodd"',
        severity: 'warning',
    }));
}
