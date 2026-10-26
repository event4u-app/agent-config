/**
 * `ui:render --region <selector>` — visual regression of the changed region
 * against an approved baseline (road-to-a-control-that-matches-its-neighbours
 * 3.7).
 *
 * The comparison is a COMPUTED-STYLE SIGNATURE of the region's subtree, not a
 * pixel diff: anti-aliasing and font rasterisation make a pixel verdict a
 * per-machine verdict, the reason the asset profile's own compare refuses one.
 * Animations and transitions are off while capturing. A difference whose only
 * cause is the resolved font family reads `degraded` with both families named,
 * never `fail` — the same rule the asset compare keeps.
 *
 * No approved baseline → `no-baseline`, never a pass; the caller compares
 * against a sibling instead (`ui_conformance_probe --reference-sibling`).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import type { Page } from '@playwright/test';

export const BASELINE_REL = path.join('agents', 'runtime', 'state', 'render-baselines');

export interface RegionNode {
    tag: string;
    role: string;
    width: number;
    height: number;
    padding: string;
    radius: string;
    color: string;
    background: string;
    border: string;
    font_size: string;
    font_family: string;
}

export interface RegionDelta {
    index: number;
    tag: string;
    property: keyof RegionNode | 'structure';
    baseline: string;
    current: string;
}

export interface RegionReading {
    selector: string;
    status: 'pass' | 'fail' | 'degraded' | 'no-baseline' | 'not-found';
    baseline: string | null;
    deltas: RegionDelta[];
    nodes: number;
}

const FREEZE_CSS = '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}';

/** The region's subtree as a list of nodes in document order, capped at 400. */
export async function captureRegion(page: Page, selector: string): Promise<RegionNode[] | null> {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addStyleTag({ content: FREEZE_CSS });
    const root = await page.$(selector);
    if (!root) return null;
    return root.evaluate((el) => {
        const out: RegionNode[] = [];
        const all = [el, ...Array.from(el.querySelectorAll('*'))].slice(0, 400);
        for (const n of all) {
            const cs = getComputedStyle(n);
            if (cs.display === 'none') continue;
            const r = n.getBoundingClientRect();
            out.push({
                tag: n.tagName.toLowerCase(),
                role: n.getAttribute('role') ?? '',
                width: Math.round(r.width * 2) / 2,
                height: Math.round(r.height * 2) / 2,
                padding: `${cs.paddingTop} ${cs.paddingRight} ${cs.paddingBottom} ${cs.paddingLeft}`,
                radius: cs.borderTopLeftRadius,
                color: cs.color,
                background: cs.backgroundColor,
                border: `${cs.borderTopWidth} ${cs.borderTopStyle} ${cs.borderTopColor}`,
                font_size: cs.fontSize,
                font_family: cs.fontFamily.split(',')[0]?.trim().replace(/^["']|["']$/g, '') ?? '',
            });
        }
        return out;
    });
}

/**
 * Pure. Structure first: a different node sequence is one `structure` delta and
 * nothing else, because pairing nodes by index across a changed tree compares
 * the wrong elements.
 */
export function compareRegion(
    baseline: RegionNode[],
    current: RegionNode[],
    tolerancePx = 1,
): { status: 'pass' | 'fail' | 'degraded'; deltas: RegionDelta[] } {
    const shape = (ns: RegionNode[]) => ns.map((n) => `${n.tag}:${n.role}`).join('|');
    if (shape(baseline) !== shape(current)) {
        return {
            status: 'fail',
            deltas: [{ index: -1, tag: '', property: 'structure', baseline: `${baseline.length} node(s)`, current: `${current.length} node(s)` }],
        };
    }
    const deltas: RegionDelta[] = [];
    for (const [i, b] of baseline.entries()) {
        const c = current[i]!;
        for (const k of Object.keys(b) as Array<keyof RegionNode>) {
            if (k === 'tag' || k === 'role') continue;
            if (k === 'width' || k === 'height') {
                if (Math.abs(b[k] - c[k]) > tolerancePx) deltas.push({ index: i, tag: b.tag, property: k, baseline: String(b[k]), current: String(c[k]) });
            } else if (b[k] !== c[k]) {
                deltas.push({ index: i, tag: b.tag, property: k, baseline: String(b[k]), current: String(c[k]) });
            }
        }
    }
    if (deltas.length === 0) return { status: 'pass', deltas };
    // Width deltas that only accompany a changed family are font metrics, not a regression.
    const fontOnly = deltas.every((d) => d.property === 'font_family' || d.property === 'width');
    return { status: fontOnly && deltas.some((d) => d.property === 'font_family') ? 'degraded' : 'fail', deltas };
}

/** Capture the region, then compare it to the approved baseline, or approve it. */
export async function regionReading(
    page: Page,
    selector: string,
    baselinePath: string,
    approve: boolean,
): Promise<RegionReading> {
    const nodes = await captureRegion(page, selector);
    if (nodes === null) return { selector, status: 'not-found', baseline: null, deltas: [], nodes: 0 };
    if (approve) {
        fs.mkdirSync(path.dirname(baselinePath), { recursive: true });
        fs.writeFileSync(baselinePath, `${JSON.stringify({ selector, nodes }, null, 2)}\n`);
        return { selector, status: 'pass', baseline: baselinePath, deltas: [], nodes: nodes.length };
    }
    let baseline: RegionNode[] | null = null;
    try {
        baseline = (JSON.parse(fs.readFileSync(baselinePath, 'utf8')) as { nodes: RegionNode[] }).nodes;
    } catch {
        baseline = null;
    }
    if (baseline === null) return { selector, status: 'no-baseline', baseline: null, deltas: [], nodes: nodes.length };
    const { status, deltas } = compareRegion(baseline, nodes);
    return { selector, status, baseline: baselinePath, deltas, nodes: nodes.length };
}
