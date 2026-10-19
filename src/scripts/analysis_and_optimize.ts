/**
 * analysis_and_optimize.ts — what `analyze:and-optimize` reads (step 4.5,
 * ADR-288 D1).
 *
 * The door's scope is the one `analysis_target.ts` resolved, never a path the
 * caller names: inside a module every reader — the anchor table and the code
 * the analysts open — stays under the module root, while `project_root` stays
 * the outer project for settings and publication. The read set includes code,
 * not only roadmaps and ADRs.
 */
import * as path from 'node:path';

import { buildAnchorTable, walk, type AnchorTable, type Issue } from './analysis_anchors.js';
import { isInside, type AnalysisTarget } from './analysis_target.js';

const CODE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|py|php|rb|go|rs|java|kt|swift|cs|c|h|cpp|vue|svelte|sh)$/;

export interface ReadSet {
    scope_root: string;
    anchors: AnchorTable;
    /** Absolute paths of the code files the analysts read. */
    code: string[];
    /** Every absolute path a reader of this run opens. */
    readers: string[];
}

export function readSet(target: AnalysisTarget, opts: { goal?: string; issues?: readonly Issue[] } = {}): ReadSet {
    const root = target.scope_root;
    const anchors = buildAnchorTable({
        root,
        ...(opts.goal === undefined ? {} : { goal: opts.goal }),
        ...(opts.issues === undefined ? {} : { issues: opts.issues }),
    });
    const code = walk(root)
        .filter((f) => CODE_EXT.test(f))
        .map((f) => path.join(root, f));
    const anchored = anchors.rows
        .filter((r) => r.source !== 'issue' && r.source !== 'goal')
        .map((r) => path.join(root, r.anchor.replace(/:\d+$/u, '')));
    const readers = [...new Set([...code, ...anchored])].sort();
    const escaped = readers.filter((p) => !isInside(p, root));
    if (escaped.length > 0) throw new Error(`reader outside the scope root ${root}: ${escaped.join(', ')}`);
    return { scope_root: root, anchors, code, readers };
}
