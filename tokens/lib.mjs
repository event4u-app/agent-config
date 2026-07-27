// Shared color math for the token generators (build-ac.mjs, build-as.mjs)
// and the contrast guard (check-contrast.mjs). No dependencies.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const TOKENS_DIR = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.dirname(TOKENS_DIR);

/** Load and lightly validate the canonical token file. */
export function loadTokens() {
    const file = path.join(TOKENS_DIR, 'event4u-agent-tokens.json');
    const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (typeof doc._version !== 'number') {
        throw new Error('event4u-agent-tokens.json: missing top-level _version');
    }
    for (const theme of ['dark', 'light']) {
        if (!doc.color?.[theme]) throw new Error(`event4u-agent-tokens.json: missing color.${theme}`);
    }
    return doc;
}

/** DTCG group → flat { name: value } map (drops $-keys). */
export function flatten(group) {
    const out = {};
    for (const [name, token] of Object.entries(group)) {
        if (name.startsWith('$')) continue;
        out[name] = token.$value;
    }
    return out;
}

export function parseHex(hex) {
    const h = hex.replace('#', '');
    if (!/^[0-9a-fA-F]{6}$/.test(h)) throw new Error(`not a 6-digit hex: ${hex}`);
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

/** Parse `rgba(r, g, b, a)` → { rgb: [r,g,b], alpha }. */
export function parseRgba(value) {
    const m = value.match(/^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)$/);
    if (!m) throw new Error(`not an rgba() value: ${value}`);
    return { rgb: [Number(m[1]), Number(m[2]), Number(m[3])], alpha: Number(m[4]) };
}

export function toHex(rgb) {
    return '#' + rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
}

/** Composite an rgba color over an opaque hex background → opaque hex. */
export function blendOver(rgbaValue, bgHex) {
    const { rgb, alpha } = parseRgba(rgbaValue);
    const bg = parseHex(bgHex);
    return toHex(rgb.map((v, i) => v * alpha + bg[i] * (1 - alpha)));
}

/**
 * Hex → shadcn HSL channel triple `"H S% L%"` (integer-ish, one decimal
 * where needed — matches the hand-written precision in AS's index.css).
 */
export function hexToHslChannels(hex) {
    let [r, g, b] = parseHex(hex).map((v) => v / 255);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            default: h = (r - g) / d + 4;
        }
        h /= 6;
    }
    const round1 = (x) => {
        const r10 = Math.round(x * 10) / 10;
        return Number.isInteger(r10) ? String(r10) : r10.toFixed(1);
    };
    return `${round1(h * 360)} ${round1(s * 100)}% ${round1(l * 100)}%`;
}

/** WCAG relative luminance of a hex color. */
export function luminance(hex) {
    const f = (v) => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    const [r, g, b] = parseHex(hex);
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/** WCAG contrast ratio between two opaque hex colors. */
export function contrast(a, b) {
    const la = luminance(a);
    const lb = luminance(b);
    const [hi, lo] = la > lb ? [la, lb] : [lb, la];
    return (hi + 0.05) / (lo + 0.05);
}

/**
 * Byte-compare generated content against a committed file for --check mode.
 * Returns process exit code (0 clean, 1 drift/missing).
 */
export function checkAgainst(committedPath, generated, label) {
    if (!fs.existsSync(committedPath)) {
        console.error(`DRIFT: ${label} — committed file missing: ${committedPath}`);
        return 1;
    }
    const committed = fs.readFileSync(committedPath, 'utf8');
    if (committed !== generated) {
        console.error(
            `DRIFT: ${label} — ${committedPath} differs from generator output.\n` +
            `Regenerate with the matching build script under tokens/ (never hand-edit).`,
        );
        return 1;
    }
    console.log(`OK: ${label} matches generator output.`);
    return 0;
}
