/**
 * PHP name resolution shared by the PHP providers: a class reference read the
 * way its file states it (namespace + `use` aliases), then located through the
 * project's PSR-4 map. A reference that resolves to no class node in the graph
 * resolves to nothing — never to a same-named class in another namespace.
 */
import { resolvePsr4, type ResolutionConfig } from '../../resolution_tiers.js';
import type { Kit } from './kit.js';

export interface PhpScope {
    namespace: string;
    uses: Map<string, string>;
}

export function phpScope(src: string): PhpScope {
    const ns = /^\s*namespace\s+([\\\w]+)\s*;/m.exec(src)?.[1] ?? '';
    const uses = new Map<string, string>();
    for (const m of src.matchAll(/^\s*use\s+([\\\w]+)(?:\s+as\s+(\w+))?\s*;/gm)) {
        const fq = (m[1] as string).replace(/^\\/, '');
        uses.set(m[2] ?? fq.split('\\').pop() ?? fq, fq);
    }
    return { namespace: ns, uses };
}

/** Fully-qualified name of a class reference as written under `scope`. */
export function qualify(ref: string, scope: PhpScope): string {
    if (ref.startsWith('\\')) return ref.slice(1);
    const [head, ...rest] = ref.split('\\');
    const aliased = scope.uses.get(head as string);
    if (aliased) return [aliased, ...rest].join('\\');
    return scope.namespace ? `${scope.namespace}\\${ref}` : ref;
}

export function shortName(fq: string): string {
    return fq.split('\\').pop() ?? fq;
}

/** The class node a fully-qualified name names, through PSR-4; null when absent. */
export function classNode(kit: Kit, fq: string, resolution: ResolutionConfig): string | null {
    const file = resolvePsr4(fq, resolution, kit.fileIds);
    const id = file ? `${file}#${shortName(fq)}` : null;
    return id && kit.nodeById.has(id) ? id : null;
}

/** Offset of the bracket closing the one at `open` (`(`, `[` or `{`), skipping string literals. */
export function matchingClose(src: string, open: number): number {
    const pair: Record<string, string> = { '(': ')', '[': ']', '{': '}' };
    const o = src[open] as string;
    const c = pair[o];
    let depth = 0;
    for (let i = open; i < src.length; i++) {
        const ch = src[i];
        if (ch === "'" || ch === '"') {
            for (i += 1; i < src.length && src[i] !== ch; i++) if (src[i] === '\\') i += 1;
            continue;
        }
        if (ch === o) depth += 1;
        else if (ch === c) {
            depth -= 1;
            if (depth === 0) return i;
        }
    }
    return src.length;
}
