/**
 * The carrier for a declared Consistency Lock (road-to-a-canvas-the-code-owns
 * step 8.2).
 *
 * `design-system-capture` lets a project declare, in `DESIGN.md` § Consistency
 * Locks, a Colour Lock (one accent family), a Shape Lock (one radius set) and,
 * when it chooses, a Spacing Lock. It said a value outside a Lock "is
 * off-system" and gets flagged — and nothing flagged it: `lint_design_slop`
 * knows no project's Locks and `lint_design_quality` excludes palette opinions by
 * design. This is the narrow, Lock-scoped form of that check.
 *
 * **Flags, never blocks.** A finding is rebuttable — the author states why in the
 * diff or records it in a baseline. A brownfield project records its existing
 * drift once with `--write-baseline`; after that only NEW drift is reported.
 * A Lock line still carrying the template's `[placeholder]` declares nothing.
 */

export interface Locks {
    /** Hue ranges in degrees, [centre, tolerance]. Empty = no Colour Lock. */
    hues: Array<[number, number]>;
    radius: Set<number> | null;
    spacing: Set<number> | null;
}

export interface LockFinding {
    file: string;
    line: number;
    lock: 'colour' | 'shape' | 'spacing';
    value: string;
    message: string;
}

const FAMILY_HUE: Record<string, [number, number]> = {
    red: [0, 15], orange: [28, 13], amber: [42, 10], yellow: [55, 10], lime: [80, 15], green: [125, 30],
    emerald: [155, 15], teal: [175, 18], cyan: [190, 12], sky: [200, 12], blue: [220, 18], indigo: [240, 12],
    violet: [260, 12], purple: [275, 12], fuchsia: [295, 15], pink: [325, 18], rose: [348, 14],
};

function hexToHsl(hex: string): { h: number; s: number; l: number } | null {
    let h = hex.replace('#', '');
    if (h.length === 3 || h.length === 4) h = h.slice(0, 3).split('').map((c) => c + c).join('');
    if (h.length !== 6 && h.length !== 8) return null;
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    const d = max - min;
    if (d === 0) return { h: 0, s: 0, l };
    const s = d / (1 - Math.abs(2 * l - 1));
    const hue = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return { h: (hue * 60 + 360) % 360, s, l };
}

const lockLine = (md: string, name: RegExp): string | null => {
    const m = new RegExp(`^\\s*-\\s*${name.source}\\s*:(.*)$`, 'im').exec(md);
    if (m === null) return null;
    const body = (m[1] as string).trim();
    return /^\[.*\]/.test(body) ? null : body;
};

const pxSet = (line: string | null): Set<number> | null => {
    if (line === null) return null;
    const nums = [...line.matchAll(/(\d+(?:\.\d+)?)(?=\s*(?:\/|px|,|$))/g)].map((m) => Number(m[1]));
    return nums.length > 0 ? new Set([0, ...nums]) : null;
};

export function parseLocks(designMd: string): Locks {
    const hues: Array<[number, number]> = [];
    const colour = lockLine(designMd, /Colou?r Lock/);
    if (colour !== null) {
        for (const word of colour.toLowerCase().match(/[a-z]+/g) ?? []) {
            const f = FAMILY_HUE[word];
            if (f !== undefined) hues.push(f);
        }
        for (const m of colour.matchAll(/#[0-9a-f]{3,8}\b/gi)) {
            const hsl = hexToHsl(m[0]);
            if (hsl !== null) hues.push([Math.round(hsl.h), 15]);
        }
    }
    return { hues, radius: pxSet(lockLine(designMd, /Shape Lock/)), spacing: pxSet(lockLine(designMd, /Spacing Lock/)) };
}

const hueDistance = (a: number, b: number): number => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));

/** Every value in one UI file that lies outside a declared Lock. */
export function checkFile(file: string, text: string, locks: Locks): LockFinding[] {
    const out: LockFinding[] = [];
    text.split('\n').forEach((lineText, i) => {
        const line = i + 1;
        if (locks.hues.length > 0) {
            for (const m of lineText.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
                const hsl = hexToHsl(m[0]);
                if (hsl === null || hsl.s * (1 - Math.abs(2 * hsl.l - 1)) < 0.08) continue; // low chroma: a neutral is never an accent
                if (locks.hues.some(([c, tol]) => hueDistance(hsl.h, c) <= tol)) continue;
                out.push({ file, line, lock: 'colour', value: m[0], message: `${m[0]} (hue ${Math.round(hsl.h)}°) lies outside the declared Colour Lock` });
            }
        }
        const prop = /(border(?:-[a-z]+)*-radius|radius)\s*:\s*([^;]+)|(margin|padding|gap|row-gap|column-gap)(?:-[a-z]+)?\s*:\s*([^;]+)/i.exec(lineText);
        if (prop === null) return;
        const isRadius = prop[1] !== undefined;
        const set = isRadius ? locks.radius : locks.spacing;
        if (set === null) return;
        for (const m of (prop[2] ?? prop[4] ?? '').matchAll(/(\d+(?:\.\d+)?)px/g)) {
            const n = Number(m[1]);
            if (set.has(n) || (isRadius && n >= 999)) continue;
            const lock = isRadius ? 'shape' : 'spacing';
            out.push({ file, line, lock, value: `${m[1]}px`, message: `${m[1]}px is not in the declared ${isRadius ? 'Shape' : 'Spacing'} Lock set` });
        }
    });
    return out;
}

/** Drop findings a brownfield baseline already records — only new drift counts. */
export function newDrift(findings: LockFinding[], baseline: ReadonlyArray<{ file: string; value: string }>): LockFinding[] {
    const known = new Set(baseline.map((b) => `${b.file}\0${b.value.toLowerCase()}`));
    return findings.filter((f) => !known.has(`${f.file}\0${f.value.toLowerCase()}`));
}
