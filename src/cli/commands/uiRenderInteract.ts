/**
 * `ui:render --interact <selector>` — the open state of a control
 * (road-to-a-control-that-matches-its-neighbours 3.5).
 *
 * A closed-state screenshot cannot show the reported defect: an added select
 * whose popup is unstyled, clipped by a scrolling dialog, or painted under a
 * sibling. This opens each named control the way a user would — focus, click,
 * keyboard — captures the open state, and records where the popup landed:
 * its bounds, whether a scroll ancestor clips it, and its z-index. It also
 * reads the control's own box so the `ui:audit` role map can carry
 * `box_metrics.source: render`.
 *
 * A native `<select>` opens an OS popup the page cannot see. That is recorded
 * as `popup: 'native-os'`, never as a captured open state, because a
 * screenshot of the closed element taken after a click would be the false
 * "verified" this exists to prevent.
 */
import * as path from 'node:path';

import type { Page } from '@playwright/test';

import { roleOfTag, type ControlRole } from '../../scripts/_lib/control_roles.js';

export interface PopupReading {
    /** `page` when the popup is DOM the page rendered, `native-os` for a native select, `none` when nothing opened. */
    popup: 'page' | 'native-os' | 'none';
    bounds: { x: number; y: number; width: number; height: number } | null;
    clipped_by: string | null;
    z_index: string | null;
    portalled: boolean;
}

export interface InteractionReading {
    selector: string;
    /** The control role of the element, so `ui:audit` can file its box under it. */
    role: ControlRole | null;
    found: boolean;
    open_state: 'captured' | 'not-captured';
    screenshot: string | null;
    popup: PopupReading;
    closes_on_escape: boolean | null;
    closes_on_outside_click: boolean | null;
    box: {
        height_px: number;
        padding_x_px: number;
        padding_y_px: number;
        radius_px: number;
        font_size_px: number;
        border_px: number;
        source: 'render';
    } | null;
    reason?: string;
}

/** Snapshot the visible, positioned elements so a popup is whatever appears after the click. */
const VISIBLE_IDS = (): string[] => {
    const out: string[] = [];
    let i = 0;
    for (const el of Array.from(document.querySelectorAll('body *'))) {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        if (r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none') {
            if (!el.hasAttribute('data-ac-seen')) el.setAttribute('data-ac-seen', String(i++));
            out.push(el.getAttribute('data-ac-seen') ?? '');
        }
    }
    return out;
};

/** The first element that became visible after the interaction and is not inside the control. */
const READ_POPUP = (args: { before: string[]; selector: string }): PopupReading => {
    const control = document.querySelector(args.selector);
    const before = new Set(args.before);
    const candidates = Array.from(document.querySelectorAll('body *')).filter((el) => {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        const visible = r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
        const seen = el.getAttribute('data-ac-seen');
        return visible && (seen === null || !before.has(seen)) && !(control && control.contains(el));
    });
    const role = (el: Element) => el.getAttribute('role') ?? '';
    const popup =
        candidates.find((el) => /listbox|menu|dialog|tooltip|grid|tree/.test(role(el))) ??
        candidates.find((el) => el.parentElement === null || !candidates.includes(el.parentElement));
    if (!popup) return { popup: 'none', bounds: null, clipped_by: null, z_index: null, portalled: false };
    const r = popup.getBoundingClientRect();
    let clipped: string | null = null;
    for (let a = popup.parentElement; a && a !== document.body; a = a.parentElement) {
        const cs = getComputedStyle(a);
        if (/(auto|scroll|hidden|clip)/.test(`${cs.overflowX} ${cs.overflowY}`)) {
            const ar = a.getBoundingClientRect();
            if (r.top < ar.top - 0.5 || r.bottom > ar.bottom + 0.5 || r.left < ar.left - 0.5 || r.right > ar.right + 0.5) {
                clipped = a.id ? `#${a.id}` : `${a.tagName.toLowerCase()}${a.className ? `.${String(a.className).split(/\s+/)[0]}` : ''}`;
                break;
            }
        }
    }
    const portalled = control !== null && !control.parentElement?.contains(popup);
    return {
        popup: 'page',
        bounds: { x: r.x, y: r.y, width: r.width, height: r.height },
        clipped_by: clipped,
        z_index: getComputedStyle(popup).zIndex,
        portalled,
    };
};

const READ_BOX = (el: Element) => {
    const cs = getComputedStyle(el);
    const px = (v: string) => Math.round(parseFloat(v || '0') * 2) / 2;
    return {
        height_px: Math.round(el.getBoundingClientRect().height * 2) / 2,
        padding_x_px: px(cs.paddingLeft),
        padding_y_px: px(cs.paddingTop),
        radius_px: px(cs.borderTopLeftRadius),
        font_size_px: px(cs.fontSize),
        border_px: px(cs.borderTopWidth),
        source: 'render' as const,
    };
};

async function popupOpen(page: Page, before: string[], selector: string): Promise<boolean> {
    return (await page.evaluate(READ_POPUP, { before, selector })).popup === 'page';
}

/** Open, read and close one control. Never throws: a failure is a reading with a reason. */
export async function interactWith(page: Page, selector: string, outDir: string, index: number): Promise<InteractionReading> {
    const empty: InteractionReading = {
        selector,
        role: null,
        found: false,
        open_state: 'not-captured',
        screenshot: null,
        popup: { popup: 'none', bounds: null, clipped_by: null, z_index: null, portalled: false },
        closes_on_escape: null,
        closes_on_outside_click: null,
        box: null,
    };
    try {
        const handle = await page.$(selector);
        if (!handle) return { ...empty, reason: `no element matches ${selector}` };
        const box = await handle.evaluate(READ_BOX);
        const tag = await handle.evaluate((el) => el.tagName.toLowerCase());
        const attrs = await handle.evaluate((el) =>
            Array.from(el.attributes)
                .map((x) => `${x.name}="${x.value}"`)
                .join(' '),
        );
        const role = roleOfTag(tag, attrs) ?? (/aria-haspopup="(listbox|true)"/.test(attrs) ? 'select' : null);
        if (tag === 'select') {
            return {
                ...empty,
                role,
                found: true,
                box,
                popup: { ...empty.popup, popup: 'native-os' },
                reason: 'a native select opens an OS popup the page cannot capture; style its closed state and use appearance: base-select',
            };
        }

        const before = await page.evaluate(VISIBLE_IDS);
        await handle.focus();
        await handle.click();
        let opened = await popupOpen(page, before, selector);
        if (!opened) {
            await page.keyboard.press('Enter');
            opened = await popupOpen(page, before, selector);
        }
        if (!opened) {
            await page.keyboard.press('ArrowDown');
            opened = await popupOpen(page, before, selector);
        }
        if (!opened) return { ...empty, role, found: true, box, reason: 'nothing became visible after click, Enter or ArrowDown' };

        const popup = await page.evaluate(READ_POPUP, { before, selector });
        const shot = path.join(outDir, `interact-${index}.png`);
        await page.screenshot({ path: shot, fullPage: true });

        await page.keyboard.press('Escape');
        const closesOnEscape = !(await popupOpen(page, before, selector));
        if (!closesOnEscape) await page.keyboard.press('Escape');

        await handle.click();
        const reopened = await popupOpen(page, before, selector);
        let closesOnOutside: boolean | null = null;
        if (reopened) {
            await page.mouse.click(1, 1);
            closesOnOutside = !(await popupOpen(page, before, selector));
        }

        return {
            selector,
            role,
            found: true,
            open_state: 'captured',
            screenshot: shot,
            popup,
            closes_on_escape: closesOnEscape,
            closes_on_outside_click: closesOnOutside,
            box,
        };
    } catch (err) {
        return { ...empty, reason: `interaction failed: ${String(err)}` };
    }
}
