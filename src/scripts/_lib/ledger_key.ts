import * as path from 'node:path';

/**
 * The one key both the read ledger and the reference duty use for a file:
 * relative to the workspace when the file is inside it, absolute otherwise. Two
 * derivations of this key would silently disagree for every reference outside
 * the workspace.
 */
export function ledgerKey(workspaceRoot: string, absPath: string): string {
    const rel = path.relative(workspaceRoot, absPath);
    return rel === '' || rel.startsWith('..') || path.isAbsolute(rel) ? absPath : rel;
}
