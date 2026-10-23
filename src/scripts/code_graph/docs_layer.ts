/**
 * The docs layer: a Markdown file that names a file gets an edge to it.
 *
 * Read by rule, not by a model (road-to-a-map-that-draws-itself 6.3, K10):
 *
 *   [text](relative/or/rooted/path)       a link, resolved from the document's directory
 *   `src/scripts/x.ts` · `x.ts:42`         a backticked path, resolved repo-relative first
 *
 * An edge is emitted only when the named file is in the tree, so a link to a
 * URL, an anchor, or a path that moved away produces nothing rather than a guess.
 */
import * as path from 'node:path';

import type { SourceFile } from './build.js';
import type { CodeEdge, CodeNode } from './types.js';
import { MAX_FILE_BYTES } from './types.js';

export const DOC_EXTS: ReadonlySet<string> = new Set(['.md', '.mdx']);

function normal(p: string): string {
    return path.posix.normalize(p).replace(/^\.\//, '');
}

export function docsLayer(docs: readonly SourceFile[], fileIds: ReadonlySet<string>): { nodes: CodeNode[]; edges: CodeEdge[] } {
    const nodes: CodeNode[] = [];
    const edges: CodeEdge[] = [];
    for (const d of [...docs].sort((a, b) => (a.path < b.path ? -1 : 1))) {
        nodes.push({ id: d.path, label: d.path, kind: 'file', source_file: d.path, source_location: [] });
        if (Buffer.byteLength(d.source, 'utf-8') > MAX_FILE_BYTES) continue;
        const dir = path.posix.dirname(d.path);
        const targets = new Set<string>();
        const consider = (raw: string, fromDocDir: boolean): void => {
            const clean = raw.trim().replace(/[#?].*$/, '').replace(/:\d+(?:-\d+)?$/, '');
            if (!clean || /^[a-z][a-z0-9+.-]*:/i.test(clean) || clean.includes('*')) return;
            const candidates = clean.startsWith('/')
                ? [normal(clean.slice(1))]
                : fromDocDir
                  ? [normal(path.posix.join(dir, clean)), normal(clean)]
                  : [normal(clean), normal(path.posix.join(dir, clean))];
            const hit = candidates.find((c) => !c.startsWith('..') && fileIds.has(c));
            if (hit && hit !== d.path) targets.add(hit);
        };
        for (const m of d.source.matchAll(/\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g)) consider(m[1] as string, true);
        for (const m of d.source.matchAll(/`([\w@./-]+\/[\w@.-]+\.[A-Za-z0-9]+(?::\d+(?:-\d+)?)?)`/g)) consider(m[1] as string, false);
        for (const t of [...targets].sort()) {
            edges.push({
                source: d.path,
                target: t,
                relation: 'documents',
                confidence: 'EXTRACTED',
                resolved_via: 'directive-scan',
                provider: 'native',
            });
        }
    }
    return { nodes, edges };
}
