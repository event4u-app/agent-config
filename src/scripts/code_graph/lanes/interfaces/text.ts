/**
 * Text helpers shared by the interface readers: line numbers, balanced call
 * arguments, string literals and the enclosing symbol of an offset.
 */
import { spanHash, type Witness } from '../lane_fact.js';

export class SourceText {
    private readonly starts: number[] = [0];
    readonly lines: string[];

    constructor(
        readonly file: string,
        readonly text: string,
    ) {
        for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) this.starts.push(i + 1);
        this.lines = text.split('\n');
    }

    lineOf(offset: number): number {
        let lo = 0;
        let hi = this.starts.length - 1;
        while (lo < hi) {
            const mid = (lo + hi + 1) >> 1;
            if ((this.starts[mid] as number) <= offset) lo = mid;
            else hi = mid - 1;
        }
        return lo + 1;
    }

    /** Witness over the whole lines spanned by [start, end). */
    witness(start: number, end = start): Witness {
        const a = this.lineOf(start);
        const b = this.lineOf(Math.max(start, end - 1));
        return { file: this.file, line: a, hash: spanHash(this.lines.slice(a - 1, b).join('\n')) };
    }

    witnessAtLine(line: number): Witness {
        return { file: this.file, line, hash: spanHash(this.lines[line - 1] ?? '') };
    }
}

const OPEN: Record<string, string> = { '(': ')', '[': ']', '{': '}' };

/**
 * Which offsets of `text` are code: `false` inside a comment or a string
 * literal. A call named there is prose, never a call site. `#` opens a line
 * comment in PHP, Python and Ruby; `//` and `/* *\/` in the C-family and PHP.
 */
export function codeMask(text: string, lang: Lang): (offset: number) => boolean {
    const mask = new Uint8Array(text.length).fill(1);
    const hashComment = lang === 'php' || lang === 'python' || lang === 'ruby';
    const slashComment = lang !== 'python' && lang !== 'ruby';
    const off = (from: number, to: number): void => mask.fill(0, from, Math.min(to, text.length));
    let i = 0;
    while (i < text.length) {
        const c = text[i] as string;
        const n = text[i + 1];
        if ((slashComment && c === '/' && n === '/') || (hashComment && c === '#' && !(lang === 'php' && n === '['))) {
            const end = text.indexOf('\n', i);
            const to = end < 0 ? text.length : end;
            off(i, to);
            i = to;
            continue;
        }
        if (slashComment && c === '/' && n === '*') {
            const end = text.indexOf('*/', i + 2);
            const to = end < 0 ? text.length : end + 2;
            off(i, to);
            i = to;
            continue;
        }
        if (c === '"' || c === "'" || c === '`') {
            const triple = lang === 'python' && text.startsWith(c.repeat(3), i);
            const close = triple ? text.indexOf(c.repeat(3), i + 3) : -1;
            const to = triple ? (close < 0 ? text.length : close + 3) : skipString(text, i);
            off(i, to);
            i = to;
            continue;
        }
        i++;
    }
    return (offset) => mask[offset] === 1;
}

/** Offset just past the string literal that starts at `i` (quote char at `i`). */
function skipString(text: string, i: number): number {
    const q = text[i] as string;
    let j = i + 1;
    while (j < text.length) {
        const c = text[j];
        if (c === '\\') {
            j += 2;
            continue;
        }
        if (q === '`' && c === '$' && text[j + 1] === '{') {
            j = balancedEnd(text, j + 1);
            continue;
        }
        if (c === q) return j + 1;
        j++;
    }
    return text.length;
}

/** Offset just past the bracket group that opens at `i`. */
export function balancedEnd(text: string, i: number): number {
    const stack: string[] = [];
    let j = i;
    while (j < text.length) {
        const c = text[j] as string;
        if (c === '"' || c === "'" || c === '`') {
            j = skipString(text, j);
            continue;
        }
        if (OPEN[c]) stack.push(OPEN[c] as string);
        else if (c === stack[stack.length - 1]) {
            stack.pop();
            if (stack.length === 0) return j + 1;
        }
        j++;
    }
    return text.length;
}

/** Top-level comma-separated arguments of the call whose `(` is at `open`. */
export function callArgs(text: string, open: number): { args: string[]; end: number } {
    const end = balancedEnd(text, open);
    const inner = text.slice(open + 1, end - 1);
    const args: string[] = [];
    let depth = 0;
    let from = 0;
    for (let j = 0; j < inner.length; j++) {
        const c = inner[j] as string;
        if (c === '"' || c === "'" || c === '`') {
            j = skipString(inner, j) - 1;
            continue;
        }
        if (OPEN[c]) depth++;
        else if (c === ')' || c === ']' || c === '}') depth--;
        else if (c === ',' && depth === 0) {
            args.push(inner.slice(from, j).trim());
            from = j + 1;
        }
    }
    const last = inner.slice(from).trim();
    if (last || args.length) args.push(last);
    return { args, end };
}

/** The value of a single plain string literal, or null when the expression is anything else. */
export function stringLiteral(expr: string): string | null {
    const e = expr.trim();
    const m = /^(?:[rbfu]{0,2})?(["'`])([\s\S]*)\1$/i.exec(e);
    if (!m) return null;
    const body = m[2] as string;
    if (m[1] === '`' && body.includes('${')) return null;
    if (/^[rbu]*f/i.test(e) && body.includes('{')) return null;
    if (m[1] === '"' && /\$\w|\{\$/.test(body)) return null;
    if (body.includes(m[1] as string)) return null;
    return body;
}

/** Keys of a literal array/object/dict expression, top level only. */
export function literalKeys(expr: string): string[] | null {
    const e = expr.trim();
    if (!/^[[{(]/.test(e) && !/^(?:array|dict)\s*\(/.test(e)) return null;
    const open = e.search(/[[{(]/);
    const { args } = callArgs(e, open);
    const keys: string[] = [];
    for (const a of args) {
        if (!a) continue;
        const m =
            /^["']([\w.-]+)["']\s*(?:=>|:)/.exec(a) ??
            /^([A-Za-z_]\w*)\s*[:=](?!=)/.exec(a) ??
            /^([A-Za-z_]\w*)$/.exec(a);
        if (m) keys.push(m[1] as string);
    }
    return keys;
}

/** Value expression stored under `key` in a literal array/object/dict, or null. */
export function literalValue(expr: string, key: string): string | null {
    const e = expr.trim();
    const open = e.search(/[[{(]/);
    if (open < 0) return null;
    const { args } = callArgs(e, open);
    for (const a of args) {
        const m = new RegExp(`^["']?${key}["']?\\s*(?:=>|:|=)(?!=)\\s*([\\s\\S]*)$`).exec(a);
        if (m) return (m[1] as string).trim();
    }
    return null;
}

export type Lang = 'php' | 'js' | 'python' | 'go' | 'java' | 'csharp' | 'ruby';

export function langOf(file: string): Lang | null {
    const ext = file.slice(file.lastIndexOf('.') + 1).toLowerCase();
    if (ext === 'php') return 'php';
    if (['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'vue', 'svelte'].includes(ext)) return 'js';
    if (ext === 'py') return 'python';
    if (ext === 'go') return 'go';
    if (ext === 'java' || ext === 'kt') return 'java';
    if (ext === 'cs') return 'csharp';
    if (ext === 'rb') return 'ruby';
    return null;
}

const CLASS_RE = /\b(?:class|struct|interface|record|module)\s+([A-Za-z_]\w*)/;
const FUNC_RE: Record<Lang, RegExp> = {
    php: /\bfunction\s+([A-Za-z_]\w*)\s*\(/,
    js: /(?:\bfunction\s*\*?\s*([A-Za-z_$][\w$]*)\s*\(|^\s*(?:export\s+)?(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function\b|\([^)]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>)|^\s*(?:public\s+|private\s+|protected\s+|static\s+|async\s+)*([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*(?::[^={]*)?\{)/,
    python: /^\s*(?:async\s+)?def\s+([A-Za-z_]\w*)\s*\(/,
    go: /^func\s+(?:\([^)]*?\*?([A-Za-z_]\w*)\)\s+)?([A-Za-z_]\w*)\s*\(/,
    java: /^\s*(?:public|private|protected|static|final|synchronized|\s)*[\w<>[\],\s]+\s+([a-z_]\w*)\s*\([^;]*$/,
    csharp: /^\s*(?:public|private|protected|internal|static|async|virtual|override|\s)+[\w<>[\],?\s]+\s+([A-Za-z_]\w*)\s*\([^;]*$/,
    ruby: /^\s*def\s+(?:self\.)?([A-Za-z_]\w*[?!]?)/,
};
const NOT_FUNC = new Set(['if', 'for', 'while', 'switch', 'catch', 'return', 'function', 'new', 'else']);

/**
 * Graph node id of the symbol enclosing `line`, in the extractor's id shape
 * (`<file>#<Class>::<method>`, `<file>#<fn>`, or the file itself). Nearest
 * preceding declaration wins; it is a best effort, not a parse.
 */
export function enclosingSymbol(src: SourceText, line: number, lang: Lang): string {
    let fn: string | null = null;
    let cls: string | null = null;
    for (let l = line - 1; l >= 0; l--) {
        const t = src.lines[l] ?? '';
        if (!fn) {
            const m = FUNC_RE[lang].exec(t);
            if (m) {
                if (lang === 'go') {
                    fn = m[2] ?? null;
                    cls = m[1] ?? null;
                    break;
                }
                const name = m.slice(1).find((x) => x) ?? null;
                if (name && !NOT_FUNC.has(name)) fn = name;
            }
        }
        const c = CLASS_RE.exec(t);
        if (c && !/^\s*(?:\/\/|\*|#)/.test(t)) {
            cls = c[1] as string;
            break;
        }
    }
    if (cls && fn) return `${src.file}#${cls}::${fn}`;
    if (cls) return `${src.file}#${cls}`;
    if (fn) return `${src.file}#${fn}`;
    return src.file;
}
