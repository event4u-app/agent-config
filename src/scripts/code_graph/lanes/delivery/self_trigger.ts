/**
 * Does a change to the pipeline's own files start the pipeline? A path filter
 * that excludes them means an edit to the workflow is never exercised by the
 * workflow it edits.
 */
import { globToRegExp } from '../../../_lib/infra_files/pipeline.js';

/** GitHub semantics: patterns apply in order, a `!` pattern negates, the last match wins. */
function matchesFilter(globs: string[], file: string): boolean {
    let hit = false;
    for (const g of globs) {
        const neg = g.startsWith('!');
        const pat = neg ? g.slice(1) : g;
        const prefix = `${pat.replace(/\/?\*\*$/, '').replace(/\/$/, '')}/`;
        if (globToRegExp(pat).test(file) || file === pat || file.startsWith(prefix)) hit = !neg;
    }
    return hit;
}

/**
 * True when each of `own` (the pipeline file, the local actions and workflows
 * it uses), changed alone, passes the filter; false when any is filtered out.
 */
export function selfTriggers(paths: string[], pathsIgnore: string[], own: string[]): boolean {
    return excludedOwnFiles(paths, pathsIgnore, own).length === 0;
}

/** The pipeline files that, changed alone, do not pass the filter. */
export function excludedOwnFiles(paths: string[], pathsIgnore: string[], own: string[]): string[] {
    return own.filter((f) => !((paths.length === 0 || matchesFilter(paths, f)) && !(pathsIgnore.length > 0 && matchesFilter(pathsIgnore, f))));
}
