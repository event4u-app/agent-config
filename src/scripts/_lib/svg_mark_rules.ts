/**
 * svg_mark_rules — the static readings a logo MARK needs and no other asset
 * class does, read only under `lint_svg_asset --class mark`.
 *
 * Pre-registered in `internal/bench/corpora/svg-mark-PREREG.md` before this
 * file existed: the thresholds, the fixtures and the kill criteria live there,
 * and the numbers below are copied from it rather than tuned here.
 *
 * WHY A SEPARATE MODULE, not a block in `svg_rules.ts`. That file is on the
 * `.svg` write path of the design-pass hook (its own header measures the
 * chunk), and it sits 36 lines under the 1,500-line source-size ratchet. These
 * readings apply to one asset class that only the CLI can name, so they are
 * imported by `lint_svg_asset.ts` alone and cost the hook chunk nothing.
 */

import { pathWalk, pointsExtent, staticBox, type Box, type Segment } from './svg_geometry.js';
import { parseElements, parseIgnores, readViewBox, type Finding, type Severity, type SvgElement } from './svg_rules.js';

/**
 * `report` is a reading that is printed and serialised but never changes the
 * exit code — the colour count has no measured threshold, and the recorded
 * stance (`uiRenderAssetTypes.ts`, "reported, never gated") stays true.
 */
export type AssetSeverity = Severity | 'report';

export type AssetFinding = Omit<Finding, 'severity'> & { severity: AssetSeverity };

/** Straight edges at or above this share of the larger viewBox side carry an angle. */
export const NEAR_MISS_MIN_LENGTH_SHARE = 0.04;
export const NEAR_MISS_WINDOW_DEG: readonly [number, number] = [0.3, 3];
export const NEAR_MISS_REFERENCES_DEG: readonly number[] = [0, 15, 30, 45, 60, 90];
/** A part smaller than this share of the smaller viewBox side is under a third of a pixel at 16 px. */
export const TINY_DETAIL_SHARE = 1 / 48;
/** Above this many solid paints the count is reported. Unmeasured, so never gated. */
export const COLOUR_COUNT_REPORT_ABOVE = 3;

/** The author's declaration that a near-miss angle is an intended optical overshoot. */
export const OPTICAL_ATTRIBUTE = 'data-optical';

const NON_RENDERED = new Set(['defs', 'symbol', 'clippath', 'mask', 'marker', 'pattern']);

interface Placed {
    el: SvgElement;
    /** Inside a container that never paints on its own. */
    hidden: boolean;
    /** Self or an ancestor changes the coordinate system, so a box would be a guess. */
    moved: boolean;
}

function place(elements: SvgElement[]): Placed[] {
    const out: Placed[] = [];
    const stack: Array<{ name: string; hidden: boolean; moved: boolean }> = [];
    let rootSeen = false;
    for (const el of elements) {
        if (el.closing) {
            if (stack[stack.length - 1]?.name === el.name) stack.pop();
            continue;
        }
        const top = stack[stack.length - 1];
        const hidden = Boolean(top?.hidden) || NON_RENDERED.has(el.name);
        const nestedSvg = el.name === 'svg' && rootSeen;
        if (el.name === 'svg') rootSeen = true;
        const moved =
            Boolean(top?.moved) || Boolean(el.attrs['transform']) || Boolean(el.attrs['style']?.includes('transform')) || nestedSvg;
        out.push({ el, hidden, moved });
        if (!el.selfClosing) stack.push({ name: el.name, hidden, moved });
    }
    return out;
}

function finding(rule: string, file: string, el: SvgElement, snippet: string, severity: AssetSeverity): AssetFinding {
    return { rule, file, line: el.line, snippet, severity };
}

// ---------------------------------------------------------------------------
// svg-mark-live-text
// ---------------------------------------------------------------------------

function ruleLiveText(placed: Placed[], file: string): AssetFinding[] {
    return placed
        .filter((p) => p.el.name === 'text')
        .map((p) =>
            finding(
                'svg-mark-live-text',
                file,
                p.el,
                'live <text> in a master mark renders in whatever font the viewer has — outline it to paths',
                'error',
            ),
        );
}

// ---------------------------------------------------------------------------
// svg-mark-near-miss-angle
// ---------------------------------------------------------------------------

/** Deviation of a segment's direction from the nearest reference angle, in degrees. */
export function nearMissDeviation(s: Segment): number {
    const theta = (Math.atan2(Math.abs(s.y2 - s.y1), Math.abs(s.x2 - s.x1)) * 180) / Math.PI;
    return Math.min(...NEAR_MISS_REFERENCES_DEG.map((r) => Math.abs(theta - r)));
}

function segmentsOf(el: SvgElement): Segment[] {
    const num = (k: string): number => Number(el.attrs[k]);
    switch (el.name) {
        case 'path':
            return pathWalk(el.attrs['d'] ?? '')?.segments ?? [];
        case 'line': {
            const s = { x1: num('x1'), y1: num('y1'), x2: num('x2'), y2: num('y2') };
            return [s.x1, s.y1, s.x2, s.y2].every(Number.isFinite) ? [s] : [];
        }
        case 'polyline':
        case 'polygon': {
            const nums = (el.attrs['points'] ?? '').match(/-?\d*\.?\d+(?:[eE][-+]?\d+)?/g)?.map(Number) ?? [];
            const pts: Array<[number, number]> = [];
            for (let i = 0; i + 1 < nums.length; i += 2) pts.push([nums[i] as number, nums[i + 1] as number]);
            if (el.name === 'polygon' && pts.length > 2) pts.push(pts[0] as [number, number]);
            const out: Segment[] = [];
            for (let i = 0; i + 1 < pts.length; i += 1) {
                const [x1, y1] = pts[i] as [number, number];
                const [x2, y2] = pts[i + 1] as [number, number];
                out.push({ x1, y1, x2, y2 });
            }
            return out;
        }
        default:
            return [];
    }
}

function ruleNearMissAngle(placed: Placed[], file: string, side: number): AssetFinding[] {
    const minLength = side * NEAR_MISS_MIN_LENGTH_SHARE;
    const [lo, hi] = NEAR_MISS_WINDOW_DEG;
    const out: AssetFinding[] = [];
    for (const p of placed) {
        if (p.hidden || p.moved) continue;
        if (p.el.attrs[OPTICAL_ATTRIBUTE] === 'overshoot') continue;
        const hit = segmentsOf(p.el).find((s) => {
            if (Math.hypot(s.x2 - s.x1, s.y2 - s.y1) < minLength) return false;
            const dev = nearMissDeviation(s);
            return dev >= lo && dev <= hi;
        });
        if (!hit) continue;
        out.push(
            finding(
                'svg-mark-near-miss-angle',
                file,
                p.el,
                `straight edge (${hit.x1},${hit.y1})→(${hit.x2},${hit.y2}) is ${nearMissDeviation(hit).toFixed(2)}° off ` +
                    `a reference angle — level it, or declare ${OPTICAL_ATTRIBUTE}="overshoot" if it is intended`,
                'warning',
            ),
        );
    }
    return out;
}

// ---------------------------------------------------------------------------
// svg-mark-tiny-detail
// ---------------------------------------------------------------------------

function painted(el: SvgElement): boolean {
    const fill = (el.attrs['fill'] ?? '').trim().toLowerCase();
    const stroke = (el.attrs['stroke'] ?? '').trim().toLowerCase();
    return fill !== 'none' || (stroke !== '' && stroke !== 'none');
}

function partsOf(el: SvgElement): Box[] {
    if (el.name === 'path') return pathWalk(el.attrs['d'] ?? '')?.subpaths ?? [];
    if (el.name === 'polygon' || el.name === 'polyline') {
        const b = pointsExtent(el.attrs['points'] ?? '');
        return b ? [b] : [];
    }
    if (el.name === 'svg') return [];
    const b = staticBox(el);
    return b ? [b] : [];
}

function ruleTinyDetail(placed: Placed[], file: string, side: number): AssetFinding[] {
    const bound = side * TINY_DETAIL_SHARE;
    const out: AssetFinding[] = [];
    for (const p of placed) {
        if (p.hidden || p.moved || !painted(p.el)) continue;
        const tiny = partsOf(p.el)
            .map((b) => Math.max(b.maxX - b.minX, b.maxY - b.minY))
            .filter((size) => size > 0 && size < bound);
        if (!tiny.length) continue;
        out.push(
            finding(
                'svg-mark-tiny-detail',
                file,
                p.el,
                `${tiny.length} part(s) at ${Math.min(...tiny).toFixed(2)} units, under ${bound.toFixed(2)} ` +
                    '(1/48 of the viewBox) — a third of a pixel at 16 px',
                'warning',
            ),
        );
    }
    return out;
}

// ---------------------------------------------------------------------------
// svg-mark-colour-count (report-only)
// ---------------------------------------------------------------------------

function normalisePaint(raw: string): string | null {
    const v = raw.trim().toLowerCase().replace(/\s+/g, '');
    if (!v || v === 'none' || v === 'transparent' || v === 'currentcolor' || v === 'inherit') return null;
    if (v.startsWith('url(')) return null;
    const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(v);
    if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`;
    return v;
}

export function solidPaints(elements: SvgElement[]): string[] {
    const seen = new Set<string>();
    const add = (raw: string | undefined): void => {
        const p = raw === undefined ? null : normalisePaint(raw);
        if (p) seen.add(p);
    };
    for (const el of elements) {
        if (el.closing) continue;
        add(el.attrs['fill']);
        add(el.attrs['stroke']);
        add(el.attrs['stop-color']);
        for (const m of (el.attrs['style'] ?? '').matchAll(/(?:^|;)\s*(fill|stroke|stop-color)\s*:\s*([^;]+)/gi)) {
            add(m[2]);
        }
    }
    return [...seen].sort();
}

function ruleColourCount(elements: SvgElement[], file: string, root: SvgElement): AssetFinding[] {
    const paints = solidPaints(elements);
    if (paints.length <= COLOUR_COUNT_REPORT_ABOVE) return [];
    return [
        finding(
            'svg-mark-colour-count',
            file,
            root,
            `${paints.length} solid paints (${paints.join(', ')}) — reported, never gated: no threshold was measured`,
            'report',
        ),
    ];
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/** The mark readings for one `.svg` file. Empty when there is no readable viewBox. */
export function scanMark(content: string, relPath: string): AssetFinding[] {
    const elements = parseElements(content);
    const root = elements.find((el) => el.name === 'svg' && !el.closing);
    if (!root) return [];
    const placed = place(elements);
    const vb = readViewBox(root);
    const findings: AssetFinding[] = [
        ...ruleLiveText(placed, relPath),
        ...(vb ? ruleNearMissAngle(placed, relPath, Math.max(vb.w, vb.h)) : []),
        ...(vb ? ruleTinyDetail(placed, relPath, Math.min(vb.w, vb.h)) : []),
        ...ruleColourCount(elements, relPath, root),
    ];
    // Same markers and same semantics as the base rule set.
    const ignores = parseIgnores(content.split('\n'));
    return findings.filter((f) => {
        const hit = ignores.get(f.rule);
        return !(hit && (hit.wholeFile || hit.lines.has(f.line)));
    });
}
