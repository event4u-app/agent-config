/**
 * The T1 render gate: a deterministic, dependency-free verdict on whether an
 * SVG is a real vector drawing that renders inside its own canvas.
 *
 * Deliberately NOT agent-config's `svg_rules`: the bench's primary grader must
 * not score the package's output by the package's own rules.
 * This gate checks only properties any SVG consumer would agree on — it parses,
 * it carries no raster, script, `foreignObject`, event handler or external
 * reference, it draws something visible, and what it draws lies in the viewBox.
 */

export type GateStatus = 'pass' | 'fail' | 'unknown';
export interface GateCheck {
    id: string;
    status: GateStatus;
    detail?: string;
}

interface Node {
    name: string;
    attrs: Record<string, string>;
}

const SHAPES = new Set(['path', 'rect', 'circle', 'ellipse', 'polygon', 'polyline', 'line', 'text']);
const ATTR_RE = /([A-Za-z_:][-A-Za-z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)')/g;

/** Tokenize and check well-formedness; returns element list or the parse error. */
export function parse_svg(src: string): { nodes: Node[]; error: string | null } {
    const nodes: Node[] = [];
    const stack: string[] = [];
    const body = src.replace(/<!--[\s\S]*?-->/g, '').replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '');
    const tag = /<(\/?)([A-Za-z_][-A-Za-z0-9_:.]*)((?:\s+[^<>]*?)?)\s*(\/?)>|<\?[\s\S]*?\?>|<!DOCTYPE[^>]*>|</g;
    let m: RegExpExecArray | null;
    let seenRoot = false;
    while ((m = tag.exec(body)) !== null) {
        if (m[0] === '<') return { nodes, error: `stray "<" at ${m.index}` };
        if (m[2] === undefined) continue;
        const [, close, name, rawAttrs, selfClose] = m as unknown as [string, string, string, string, string];
        if (close) {
            if (stack.pop() !== name) return { nodes, error: `mismatched </${name}>` };
            continue;
        }
        if (stack.length === 0 && seenRoot) return { nodes, error: 'more than one root element' };
        seenRoot = true;
        const attrs: Record<string, string> = {};
        const leftover = rawAttrs.replace(ATTR_RE, (_all, k: string, _q, a?: string, b?: string) => {
            attrs[k] = a ?? b ?? '';
            return '';
        });
        if (leftover.trim() !== '') return { nodes, error: `malformed attributes on <${name}>` };
        nodes.push({ name, attrs });
        if (!selfClose) stack.push(name);
    }
    if (stack.length > 0) return { nodes, error: `unclosed <${stack[stack.length - 1]}>` };
    return { nodes, error: nodes.length === 0 ? 'no elements' : null };
}

function local(name: string): string {
    return name.includes(':') ? (name.split(':').pop() as string) : name;
}

function num(v: string | undefined, d = 0): number {
    const n = Number.parseFloat(v ?? '');
    return Number.isFinite(n) ? n : d;
}

function paint(node: Node, name: 'fill' | 'stroke'): string | null {
    const style = node.attrs['style'] ?? '';
    const m = new RegExp(`(?:^|;)\\s*${name}\\s*:\\s*([^;]+)`).exec(style);
    return (m?.[1] ?? node.attrs[name] ?? null)?.trim().toLowerCase() ?? null;
}

type Box = [number, number, number, number]; // minx, miny, maxx, maxy

function bbox(node: Node): Box | null {
    const a = node.attrs;
    switch (local(node.name)) {
        case 'rect':
            return [num(a['x']), num(a['y']), num(a['x']) + num(a['width']), num(a['y']) + num(a['height'])];
        case 'circle':
            return [num(a['cx']) - num(a['r']), num(a['cy']) - num(a['r']), num(a['cx']) + num(a['r']), num(a['cy']) + num(a['r'])];
        case 'ellipse':
            return [num(a['cx']) - num(a['rx']), num(a['cy']) - num(a['ry']), num(a['cx']) + num(a['rx']), num(a['cy']) + num(a['ry'])];
        case 'line':
            return [Math.min(num(a['x1']), num(a['x2'])), Math.min(num(a['y1']), num(a['y2'])), Math.max(num(a['x1']), num(a['x2'])), Math.max(num(a['y1']), num(a['y2']))];
        case 'text':
            // The anchor point only: glyph extents need a font, which a pure gate does not load.
            return [num(a['x']), num(a['y']), num(a['x']), num(a['y'])];
        case 'polygon':
        case 'polyline': {
            const n = (a['points'] ?? '').match(/-?\d*\.?\d+(?:e-?\d+)?/gi)?.map(Number) ?? [];
            return n.length >= 2 ? points_box(n) : null;
        }
        case 'path': {
            // Absolute moveto points only: a cheap, conservative anchor check.
            const ms = [...(a['d'] ?? '').matchAll(/M\s*(-?\d*\.?\d+)[\s,]+(-?\d*\.?\d+)/g)].flatMap((x) => [Number(x[1]), Number(x[2])]);
            return ms.length >= 2 ? points_box(ms) : null;
        }
        default:
            return null;
    }
}

function points_box(n: number[]): Box {
    const xs = n.filter((_, i) => i % 2 === 0);
    const ys = n.filter((_, i) => i % 2 === 1);
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

/** Run every gate check. `palette`, when given, requires ≥ `palette_min` of its colours to appear. */
export function svg_render_gate(src: string, opts: { palette?: string[]; palette_min?: number } = {}): GateCheck[] {
    const checks: GateCheck[] = [];
    const { nodes, error } = parse_svg(src);
    checks.push({ id: 'parses', status: error === null ? 'pass' : 'fail', ...(error ? { detail: error } : {}) });
    if (error !== null) return checks;
    const root = nodes[0] as Node;
    checks.push({ id: 'root-svg', status: local(root.name) === 'svg' ? 'pass' : 'fail' });
    const vb = (root.attrs['viewBox'] ?? '').trim().split(/[\s,]+/).map(Number);
    const vbOk = vb.length === 4 && vb.every(Number.isFinite) && (vb[2] as number) > 0 && (vb[3] as number) > 0;
    checks.push({ id: 'viewbox', status: vbOk ? 'pass' : 'fail' });

    const forbidden = nodes.filter((n) => ['image', 'script', 'foreignObject', 'iframe', 'object', 'embed'].includes(local(n.name)));
    checks.push({ id: 'no-raster-script-foreign', status: forbidden.length === 0 ? 'pass' : 'fail', ...(forbidden.length ? { detail: forbidden.map((n) => n.name).join(',') } : {}) });
    const handlers = nodes.flatMap((n) => Object.keys(n.attrs).filter((k) => /^on/i.test(k)));
    checks.push({ id: 'no-event-handlers', status: handlers.length === 0 ? 'pass' : 'fail', ...(handlers.length ? { detail: handlers.join(',') } : {}) });
    const external = nodes.flatMap((n) =>
        Object.entries(n.attrs).filter(([k, v]) => ((/(^|:)href$/i.test(k) && !v.startsWith('#')) || /url\(\s*['"]?(?!#)/i.test(v))).map(([k]) => `${n.name}@${k}`),
    );
    const styleImport = /@import|url\(\s*['"]?(?!#)/i.test(src.replace(/<!--[\s\S]*?-->/g, '')) && external.length === 0 ? ['style@url'] : [];
    checks.push({ id: 'no-external-refs', status: external.length + styleImport.length === 0 ? 'pass' : 'fail', ...(external.length + styleImport.length ? { detail: [...external, ...styleImport].join(',') } : {}) });

    const visible = nodes.filter((n) => {
        if (!SHAPES.has(local(n.name))) return false;
        const fill = paint(n, 'fill');
        const stroke = paint(n, 'stroke');
        return (fill === null || fill !== 'none') || (stroke !== null && stroke !== 'none');
    });
    checks.push({ id: 'not-blank', status: visible.length > 0 ? 'pass' : 'fail', detail: `${visible.length} visible shape(s)` });

    if (vbOk) {
        const [x, y, w, h] = vb as [number, number, number, number];
        const out = visible.filter((n) => {
            const b = bbox(n);
            return b !== null && (b[2] < x || b[0] > x + w || b[3] < y || b[1] > y + h);
        });
        checks.push({ id: 'in-canvas', status: out.length === 0 && visible.length > 0 ? 'pass' : 'fail', ...(out.length ? { detail: `${out.length} shape(s) outside the viewBox` } : {}) });
    } else {
        checks.push({ id: 'in-canvas', status: 'fail', detail: 'no usable viewBox' });
    }
    if (opts.palette && opts.palette.length > 0) {
        const lower = src.toLowerCase();
        const hits = opts.palette.filter((c) => lower.includes(c.toLowerCase()));
        const min = opts.palette_min ?? opts.palette.length;
        checks.push({ id: 'palette', status: hits.length >= min ? 'pass' : 'fail', detail: `${hits.length}/${opts.palette.length} source colours` });
    }
    return checks;
}
