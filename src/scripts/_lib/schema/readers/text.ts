/** Shared text helpers for the schema readers: witnesses, balanced spans, string arguments. */
import { spanHash } from '../../../code_graph/lanes/lane_fact.js';
import type { SchemaAt } from '../replay.js';

/** Offset → 1-based line, linear after one pass over the text. */
export function lineIndex(src: string): (offset: number) => number {
    const starts = [0];
    for (let i = 0; i < src.length; i++) if (src.charCodeAt(i) === 10) starts.push(i + 1);
    return (offset: number): number => {
        let lo = 0;
        let hi = starts.length - 1;
        while (lo < hi) {
            const mid = (lo + hi + 1) >> 1;
            if ((starts[mid] as number) <= offset) lo = mid;
            else hi = mid - 1;
        }
        return lo + 1;
    };
}

/** A witness for `offset` in `src`: the line it sits on, hashed. */
export function witnessAt(file: string, src: string, lineOf: (o: number) => number, offset: number): SchemaAt {
    const line = lineOf(offset);
    const text = src.split('\n')[line - 1] ?? '';
    return { file, line, hash: spanHash(text.trim()) };
}

/** Offset of the bracket closing the one at `open`, skipping quoted strings and comments; -1 when unbalanced. */
export function closingBracket(src: string, open: number): number {
    const o = src[open];
    const c = o === '(' ? ')' : o === '[' ? ']' : '}';
    let depth = 0;
    for (let i = open; i < src.length; i++) {
        const ch = src[i];
        if (ch === "'" || ch === '"' || ch === '`') {
            for (i += 1; i < src.length && src[i] !== ch; i++) if (src[i] === '\\') i += 1;
            continue;
        }
        if (ch === '/' && src[i + 1] === '/') {
            while (i < src.length && src[i] !== '\n') i += 1;
            continue;
        }
        if (ch === '#' && src[i + 1] !== '[') {
            while (i < src.length && src[i] !== '\n') i += 1;
            continue;
        }
        if (ch === '/' && src[i + 1] === '*') {
            const end = src.indexOf('*/', i + 2);
            i = end < 0 ? src.length : end + 1;
            continue;
        }
        if (ch === o) depth += 1;
        else if (ch === c) {
            depth -= 1;
            if (depth === 0) return i;
        }
    }
    return -1;
}

/** Split `s` on `sep` at bracket depth zero and outside quotes, keeping each part's offset. */
export function splitTop(s: string, sep: string): Array<{ text: string; offset: number }> {
    const out: Array<{ text: string; offset: number }> = [];
    let depth = 0;
    let start = 0;
    for (let i = 0; i < s.length; i++) {
        const ch = s[i];
        if (ch === "'" || ch === '"') {
            for (i += 1; i < s.length && s[i] !== ch; i++) if (s[i] === '\\') i += 1;
            continue;
        }
        if (ch === '(' || ch === '[' || ch === '{') depth += 1;
        else if (ch === ')' || ch === ']' || ch === '}') depth -= 1;
        else if (ch === sep && depth === 0) {
            out.push({ text: s.slice(start, i), offset: start });
            start = i + 1;
        }
    }
    out.push({ text: s.slice(start), offset: start });
    return out.filter((p) => p.text.trim() !== '');
}

/** Every quoted string literal in `s`, in order. */
export function stringLiterals(s: string): string[] {
    return [...s.matchAll(/'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"/g)].map((m) => (m[1] ?? m[2] ?? '') as string);
}

/** Blank comments to spaces, keeping newlines so offsets and lines survive. */
export function blankComments(src: string, flavour: 'php' | 'sql'): string {
    let out = '';
    for (let i = 0; i < src.length; i++) {
        const ch = src[i] as string;
        if (ch === "'" || ch === '"' || ch === '`') {
            const start = i;
            for (i += 1; i < src.length && src[i] !== ch; i++) if (src[i] === '\\') i += 1;
            out += src.slice(start, i + 1);
            continue;
        }
        const lineComment =
            (flavour === 'php' && ch === '/' && src[i + 1] === '/') ||
            (flavour === 'sql' && ch === '-' && src[i + 1] === '-') ||
            (ch === '#' && src[i + 1] !== '[');
        if (lineComment) {
            while (i < src.length && src[i] !== '\n') {
                out += ' ';
                i += 1;
            }
            if (i < src.length) out += '\n';
            continue;
        }
        if (ch === '/' && src[i + 1] === '*') {
            const end = src.indexOf('*/', i + 2);
            const stop = end < 0 ? src.length : end + 2;
            out += src.slice(i, stop).replace(/[^\n]/g, ' ');
            i = stop - 1;
            continue;
        }
        out += ch;
    }
    return out;
}
