/**
 * Python source helpers the Python providers share: balanced call arguments,
 * the variables a constructor call is assigned to, keyword-argument literals,
 * a def's parameter list and a class's declared bases. Text rules only — the
 * extractor already supplies the symbols and their line spans.
 */
import type { CodeNode } from '../../types.js';
import { type Kit, lineIndex } from './kit.js';

/** The text inside the parentheses opened at `open` (the index of a `(`), skipping string literals. */
export function balanced(src: string, open: number): string {
    let depth = 0;
    for (let i = open; i < src.length; i++) {
        const c = src[i];
        if (c === "'" || c === '"') {
            const q = c;
            for (i += 1; i < src.length && src[i] !== q && src[i] !== '\n'; i++) if (src[i] === '\\') i += 1;
            continue;
        }
        if (c === '#') {
            while (i < src.length && src[i] !== '\n') i += 1;
            continue;
        }
        if (c === '(' || c === '[' || c === '{') depth += 1;
        else if (c === ')' || c === ']' || c === '}') {
            depth -= 1;
            if (depth === 0) return src.slice(open + 1, i);
        }
    }
    return src.slice(open + 1);
}

export interface AssignedCall {
    /** The call's argument text. */
    args: string;
    index: number;
}

/** Module-level `name = Ctor(...)` / `name = mod.Ctor(...)` for one of `ctors`, by variable name. */
export function assignedCalls(src: string, ctors: readonly string[]): Map<string, AssignedCall> {
    const out = new Map<string, AssignedCall>();
    const re = new RegExp(`^(\\w+)\\s*(?::\\s*[\\w.]+\\s*)?=\\s*(?:[\\w.]+\\.)?(?:${ctors.join('|')})\\s*\\(`, 'gm');
    for (const m of src.matchAll(re)) {
        const open = (m.index as number) + m[0].length - 1;
        out.set(m[1] as string, { args: balanced(src, open), index: m.index as number });
    }
    return out;
}

/** The string literal a keyword argument is given (`prefix="/api"`), if it is one. */
export function kwargString(args: string, key: string): string | undefined {
    return new RegExp(`(?:^|[,(\\s])${key}\\s*=\\s*[rbuf]?(['"])([^'"]*)\\1`).exec(args)?.[2];
}

/** Offset of the first character of 1-based `line`. */
export function lineOffset(src: string, line: number): number {
    let off = 0;
    for (let l = 1; l < line; l++) {
        const nl = src.indexOf('\n', off);
        if (nl < 0) return src.length;
        off = nl + 1;
    }
    return off;
}

/** The parameter list text of the def a function or method node starts at. */
export function paramsOf(src: string, fn: CodeNode): string {
    const from = lineOffset(src, fn.source_location[0] as number);
    const def = /\bdef\s+\w+\s*\(/g;
    def.lastIndex = from;
    const m = def.exec(src);
    if (!m) return '';
    return balanced(src, (m.index as number) + m[0].length - 1);
}

/** The source lines of a node's span, joined. */
export function spanText(src: string, n: CodeNode): string {
    const lines = src.split('\n');
    const start = n.source_location[0] as number;
    const end = (n.source_location[2] ?? start) as number;
    return lines.slice(start - 1, end).join('\n');
}

/** The base-class expressions a class statement declares (`class A(models.Model, Mixin):` → `['models.Model', 'Mixin']`). */
export function classBases(src: string, cls: CodeNode): string[] {
    const head = /^\s*class\s+\w+\s*\(/.exec(spanText(src, cls));
    if (!head) return [];
    const text = spanText(src, cls);
    return balanced(text, head[0].length - 1)
        .split(',')
        .map((b) => b.trim())
        .filter((b) => b.length > 0 && !b.includes('='));
}

export interface RouteDecorator {
    /** The decorated object (`app` in `@app.get(...)`). */
    receiver: string;
    /** The decorator attribute (`get`, `route`). */
    method: string;
    /** The route path: the first positional string literal, else a `path=` literal. */
    path: string | null;
    /** The decorator's argument text. */
    args: string;
    line: number;
    /** The function or method the decorator decorates. */
    handler: CodeNode | null;
}

/** Every `@<receiver>.<method>(...)` decorator in `file` whose method is one of `methods`. */
export function routeDecorators(kit: Kit, file: { path: string; source: string }, methods: readonly string[]): RouteDecorator[] {
    const at = lineIndex(file.source);
    const out: RouteDecorator[] = [];
    const re = new RegExp(`^[ \\t]*@(\\w+)\\.(${methods.join('|')})\\s*\\(`, 'gm');
    for (const m of file.source.matchAll(re)) {
        const line = at(m.index as number);
        const args = balanced(file.source, (m.index as number) + m[0].length - 1);
        const positional = /^\s*[rbuf]?(['"])([^'"]*)\1/.exec(args)?.[2];
        const handler = kit.nextSymbol(file.path, line, ['function', 'method']);
        out.push({
            receiver: m[1] as string,
            method: m[2] as string,
            path: positional ?? kwargString(args, 'path') ?? null,
            args,
            line,
            handler: handler && handler.kind !== 'class' ? handler : null,
        });
    }
    return out;
}

/** A call's argument text split at its top-level commas, each trimmed. */
export function splitArgs(args: string): string[] {
    const out: string[] = [];
    let depth = 0;
    let start = 0;
    for (let i = 0; i < args.length; i++) {
        const c = args[i];
        if (c === "'" || c === '"') {
            const q = c;
            for (i += 1; i < args.length && args[i] !== q; i++) if (args[i] === '\\') i += 1;
            continue;
        }
        if (c === '(' || c === '[' || c === '{') depth += 1;
        else if (c === ')' || c === ']' || c === '}') depth -= 1;
        else if (c === ',' && depth === 0) {
            out.push(args.slice(start, i).trim());
            start = i + 1;
        }
    }
    const last = args.slice(start).trim();
    if (last) out.push(last);
    return out;
}

/** A string literal argument's value (`"x"`, `r"^x$"`), or null when the argument is no plain literal. */
export function stringLiteral(arg: string): string | null {
    return /^[rbu]?(['"])([^'"]*)\1$/.exec(arg.trim())?.[2] ?? null;
}

/**
 * Module files the file imports by name, by local name: `from a import b` and
 * `import a.b as b` map `b` to `a/b.py` (or `a/b/__init__.py`) when that file is in
 * `inventory`, searched under each root and, for a relative import, beside `file`.
 */
export function importedModules(file: string, src: string, roots: readonly string[], inventory: ReadonlySet<string>): Map<string, string> {
    const out = new Map<string, string>();
    const dir = file.includes('/') ? file.slice(0, file.lastIndexOf('/')) : '';
    const find = (dotted: string): string | null => {
        const rel = /^\.+/.exec(dotted)?.[0].length ?? 0;
        const parts = dotted.slice(rel).split('.').filter(Boolean);
        let bases: string[];
        if (rel > 0) {
            const segs = dir ? dir.split('/') : [];
            bases = [segs.slice(0, Math.max(0, segs.length - (rel - 1))).join('/')];
        } else bases = [...roots];
        for (const b of bases) {
            const stem = [b, ...parts].filter(Boolean).join('/');
            for (const c of [`${stem}.py`, `${stem}/__init__.py`]) if (stem && inventory.has(c)) return c;
        }
        return null;
    };
    for (const m of src.matchAll(/^\s*from\s+([.\w]+)\s+import\s+\(?([^)\n]+)\)?/gm)) {
        const mod = m[1] as string;
        for (const item of (m[2] as string).split(',')) {
            const [name, alias] = item.trim().split(/\s+as\s+/) as [string, string | undefined];
            if (!/^\w+$/.test(name)) continue;
            const hit = find(mod.endsWith('.') ? `${mod}${name}` : `${mod}.${name}`);
            if (hit) out.set(alias ?? name, hit);
        }
    }
    for (const m of src.matchAll(/^\s*import\s+([\w.]+)\s+as\s+(\w+)\s*$/gm)) {
        const hit = find(m[1] as string);
        if (hit) out.set(m[2] as string, hit);
    }
    return out;
}
