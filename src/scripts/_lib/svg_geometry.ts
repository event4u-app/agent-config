/**
 * svg_geometry — the numeric readings over SVG geometry: path data, points
 * lists, and the box of a statically-sized element.
 *
 * Split out of `svg_rules` because `svg_rules` crossed the 1,500-line
 * source-size ceiling while the completion review of
 * `road-to-svg-review-followups` was being remediated, and a ratchet only
 * turns one way. This block is the extraction that costs nothing to read: it
 * takes numbers and returns numbers, it reports no finding, and it shares no
 * state with the rules — the two rules that consume it (`svg-geometry-outside-
 * viewbox`, `svg-structure-unparseable-path`) stay where the other rules are.
 *
 * `SvgElement` is imported as a TYPE only, so the import is erased and the two
 * modules carry no runtime edge in either direction.
 */

import type { SvgElement } from './svg_rules.js';

export interface Box {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
}

/**
 * The box of an element whose geometry is fully numeric and untransformed.
 *
 * Returns `null` for anything else — a transform, a percentage, a unit, a
 * `path`. That conservatism is the rule's whole safety margin: a box this
 * function guesses at is a box the "entirely outside" test would flag wrongly.
 */
export function staticBox(el: SvgElement): Box | null {
    if (el.attrs['transform'] || el.attrs['style']?.includes('transform')) return null;
    const num = (k: string): number | null => {
        const v = el.attrs[k];
        if (v === undefined) return null;
        if (!/^-?\d+(\.\d+)?$/.test(v.trim())) return null;
        return Number(v);
    };
    /**
     * A coordinate that defaults to 0 when ABSENT — and refuses the element
     * when present and unreadable.
     *
     * Finding 7 of this change's second completion review. `num(k) ?? 0`
     * conflated the two, so `<rect x="50%" width="10" height="10"/>` read as
     * `x = 0`: a percentage, which this function's own doc promises to refuse,
     * silently became a number. The rule that reads this box then reported an
     * element outside the viewBox that is not, and missed one that is — a
     * wrong answer in both directions, from a function whose entire safety
     * margin is that it returns `null` when it cannot be sure.
     */
    const originOr0 = (k: string): number | null => (el.attrs[k] === undefined ? 0 : num(k));
    switch (el.name) {
        case 'rect': {
            const x = originOr0('x');
            const y = originOr0('y');
            const w = num('width');
            const h = num('height');
            if (x === null || y === null || w === null || h === null) return null;
            return { minX: x, minY: y, maxX: x + w, maxY: y + h };
        }
        case 'circle': {
            const cx = originOr0('cx');
            const cy = originOr0('cy');
            const r = num('r');
            if (cx === null || cy === null || r === null) return null;
            return { minX: cx - r, minY: cy - r, maxX: cx + r, maxY: cy + r };
        }
        case 'ellipse': {
            const cx = originOr0('cx');
            const cy = originOr0('cy');
            const rx = num('rx');
            const ry = num('ry');
            if (cx === null || cy === null || rx === null || ry === null) return null;
            return { minX: cx - rx, minY: cy - ry, maxX: cx + rx, maxY: cy + ry };
        }
        case 'line': {
            const x1 = num('x1');
            const y1 = num('y1');
            const x2 = num('x2');
            const y2 = num('y2');
            if (x1 === null || y1 === null || x2 === null || y2 === null) return null;
            return {
                minX: Math.min(x1, x2),
                minY: Math.min(y1, y2),
                maxX: Math.max(x1, x2),
                maxY: Math.max(y1, y2),
            };
        }
        default:
            return null;
    }
}

/**
 * The extent of a path's own points, with relative commands walked properly.
 *
 * Finding 2.1 of `road-to-svg-rules-in-the-dispatch-path`. The icon reference
 * reader used to scrape `d` with `/(-?[\d.]+)[\s,]+(-?[\d.]+)/g`, which reads
 * every number pair as an absolute coordinate — so `m 2 2 l 4 0` was read as
 * the points (2,2) and (4,0) rather than (2,2) and (6,2). That is not a
 * rounding error: a path drawn entirely with relative commands reports an
 * extent anchored at the origin.
 *
 * APPROXIMATE, AND DELIBERATELY SO. Curve control points are included rather
 * than the curve's true hull, which can over-estimate a Bézier's extent by
 * the control polygon. The alternative is a full flattener, and the consumer
 * here is a padding comparison against other icons measured exactly the same
 * way — a shared conservative bound is a comparison; a precise bound on one
 * side and a loose one on the other is finding 2.2.
 *
 * Returns null for an empty or unparseable `d`, which is a separate finding
 * (`pathDataError`) and not this function's to report.
 */
export function pathExtent(d: string): Box | null {
    const tokens = tokenisePath(d);
    if (!tokens) return null;
    const argCount: Record<string, number> = { m: 2, l: 2, t: 2, h: 1, v: 1, c: 6, s: 4, q: 4, a: 7, z: 0 };
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    const see = (x: number, y: number): void => {
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
    };
    // Current point, and the subpath start `Z` returns to.
    let cx = 0;
    let cy = 0;
    let sx = 0;
    let sy = 0;
    let i = 0;
    let cmd = '';
    let rel = false;
    while (i < tokens.length) {
        const tok = tokens[i] as string;
        if (/^[a-zA-Z]$/.test(tok)) {
            cmd = tok.toLowerCase();
            rel = tok === tok.toLowerCase();
            i += 1;
            if (cmd === 'z') {
                cx = sx;
                cy = sy;
                continue;
            }
            if (!(cmd in argCount)) return null;
        } else if (cmd === '' || cmd === 'z') {
            // A number where no repeatable command is open.
            return null;
        }
        const need = argCount[cmd] as number;
        if (need === 0) continue;
        const args: number[] = [];
        while (args.length < need && i < tokens.length && !/^[a-zA-Z]$/.test(tokens[i] as string)) {
            args.push(Number(tokens[i]));
            i += 1;
        }
        if (args.length < need) return null;
        switch (cmd) {
            case 'h': {
                cx = rel ? cx + (args[0] as number) : (args[0] as number);
                break;
            }
            case 'v': {
                cy = rel ? cy + (args[0] as number) : (args[0] as number);
                break;
            }
            case 'a': {
                // rx ry rotation large-arc sweep x y — only the last pair is a point.
                cx = rel ? cx + (args[5] as number) : (args[5] as number);
                cy = rel ? cy + (args[6] as number) : (args[6] as number);
                break;
            }
            default: {
                // Every remaining command is a run of (x, y) pairs; the last
                // pair is the new current point and the earlier ones are
                // control points, which are included as the bound above says.
                for (let k = 0; k + 1 < args.length; k += 2) {
                    const px = rel ? cx + (args[k] as number) : (args[k] as number);
                    const py = rel ? cy + (args[k + 1] as number) : (args[k + 1] as number);
                    see(px, py);
                    if (k + 2 >= args.length) {
                        cx = px;
                        cy = py;
                    }
                }
                break;
            }
        }
        see(cx, cy);
        if (cmd === 'm') {
            // `m`/`M` opens a subpath at its FIRST pair; `Z` returns there, not
            // to wherever the run ended. One `need`-sized group is read per
            // iteration, so this pair is that start.
            sx = cx;
            sy = cy;
            // A repeated `m` argument group is an implicit lineto, per the path
            // grammar — so the command for the next group is `l`, not `m`.
            cmd = 'l';
        }
    }
    if (!Number.isFinite(minX)) return null;
    return { minX, minY, maxX, maxY };
}

/**
 * Path-data tokens, with the two shapes a number-or-letter alternation misses.
 *
 * Finding 17 of this change's completion review. `a 5 5 0 0130 30` is valid:
 * `large-arc-flag` and `sweep-flag` are single digits and the grammar lets
 * them run together with what follows. The old regex read `0130` as ONE
 * number, shifted every argument of that command and every relative command
 * after it, and produced a silently WRONG extent rather than `null` — so the
 * grid padding degraded to a wrong number instead of to `unverified`. A
 * leading `+`, also legal, was dropped by the same alternation.
 *
 * So the arc command is tokenised positionally: four numbers, then two single
 * digits, then two numbers. Everything else keeps the general form.
 */
export function tokenisePath(d: string): string[] | null {
    const NUM = /[+-]?(?:\d*\.\d+|\d+\.?)(?:[eE][+-]?\d+)?/y;
    const FLAG = /[01]/y;
    const SEP = /[\s,]*/y;
    const out: string[] = [];
    const text = d.trim();
    let i = 0;
    let cmd = '';
    const eat = (re: RegExp): string | null => {
        re.lastIndex = i;
        const m = re.exec(text);
        if (m === null) return null;
        i = re.lastIndex;
        return m[0];
    };
    const skip = (): void => {
        void eat(SEP);
    };
    while (i < text.length) {
        skip();
        if (i >= text.length) break;
        const ch = text[i] as string;
        if (/[a-zA-Z]/.test(ch)) {
            cmd = ch;
            out.push(ch);
            i += 1;
            continue;
        }
        if (cmd.toLowerCase() === 'a') {
            // rx ry rotation | large-arc sweep | x y
            for (let k = 0; k < 3; k += 1) {
                skip();
                const n = eat(NUM);
                if (n === null) return null;
                out.push(n);
            }
            for (let k = 0; k < 2; k += 1) {
                skip();
                const f = eat(FLAG);
                if (f === null) return null;
                out.push(f);
            }
            for (let k = 0; k < 2; k += 1) {
                skip();
                const n = eat(NUM);
                if (n === null) return null;
                out.push(n);
            }
            continue;
        }
        const n = eat(NUM);
        if (n === null) return null;
        out.push(n);
    }
    return out.length > 0 ? out : null;
}

/** Extent of a `points` list (`<polygon>`, `<polyline>`). Absolute by definition. */
export function pointsExtent(points: string): Box | null {
    const nums = points.trim().match(/-?\d*\.?\d+(?:[eE][-+]?\d+)?/g);
    if (!nums || nums.length < 2) return null;
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (let i = 0; i + 1 < nums.length; i += 2) {
        const x = Number(nums[i]);
        const y = Number(nums[i + 1]);
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
    }
    return Number.isFinite(minX) ? { minX, minY, maxX, maxY } : null;
}

/**
 * One element's own extent in user units, whichever way it was drawn.
 *
 * The union of `staticBox` (rect, circle, ellipse, line), `pathExtent` and
 * `pointsExtent`. Finding 2.1's first half: a reference icon drawn with
 * primitives used to yield no extent at all and was dropped from the set
 * SILENTLY — after which the reading reported "no icon reference set was
 * supplied" although one was.
 *
 * Returns null for a transformed element, inheriting `staticBox`'s refusal to
 * guess at a transform, and for anything that carries no geometry.
 */
export function elementExtent(el: SvgElement): Box | null {
    if (el.closing) return null;
    if (el.attrs['transform'] || el.attrs['style']?.includes('transform')) return null;
    if (el.name === 'path') return pathExtent(el.attrs['d'] ?? '');
    if (el.name === 'polygon' || el.name === 'polyline') return pointsExtent(el.attrs['points'] ?? '');
    return staticBox(el);
}

export function pathDataError(d: string): string | null {
    const trimmed = d.trim();
    if (!trimmed) return 'empty d attribute';
    if (!/^[mM]/.test(trimmed)) return 'path data does not start with a moveto command';
    const argCount: Record<string, number> = {
        m: 2, l: 2, t: 2, h: 1, v: 1, c: 6, s: 4, q: 4, a: 7, z: 0,
    };
    // The SAME tokeniser `pathExtent` reads. Finding 5 of this change's second
    // completion review: this one kept the superseded letter-or-number
    // alternation, so `M 0 0 a 5 5 0 0130 30` — valid path data whose two arc
    // flags are written without separators — read as five arguments where the
    // arc takes seven, and was reported as an UNPARSEABLE PATH. Worse than
    // finding 17's wrong extent: a finding against a correct file, from the
    // rule whose job is to say a file cannot be read.
    const tokens = tokenisePath(trimmed);
    if (!tokens) {
        return 'path data could not be read — a coordinate, an arc flag or a command letter is malformed';
    }
    let i = 0;
    while (i < tokens.length) {
        const tok = tokens[i] as string;
        if (!/^[a-zA-Z]$/.test(tok)) return `unexpected token "${tok}" where a command letter was required`;
        const cmd = tok.toLowerCase();
        if (!(cmd in argCount)) return `unknown path command "${tok}"`;
        const need = argCount[cmd] as number;
        i += 1;
        if (need === 0) continue;
        let consumed = 0;
        while (i < tokens.length && !/^[a-zA-Z]$/.test(tokens[i] as string)) {
            i += 1;
            consumed += 1;
        }
        if (consumed === 0 || consumed % need !== 0) {
            return `command "${tok}" takes ${need} coordinate(s) per repetition, got ${consumed}`;
        }
    }
    return null;
}
