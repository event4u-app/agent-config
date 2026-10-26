/**
 * Does a change to the pipeline's own files start the pipeline? A path filter
 * that excludes them means an edit to the workflow is never exercised by the
 * workflow it edits.
 */
import { globToRegExp, type PipelineModel } from '../../../_lib/infra_files/pipeline.js';

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

/**
 * The files a GitHub workflow is made of: itself, plus every local action and
 * reusable workflow it calls. A local action is a directory, and a path filter
 * sees the files in it, so each file `filesUnder` lists for it counts; when it
 * lists none, the `action.yml` manifest stands in for the directory.
 */
export function ownPipelineFiles(
    file: string,
    model: PipelineModel,
    filesUnder: (dir: string) => readonly string[] = () => [],
): string[] {
    const local = model.jobs
        .flatMap((j) => [j.uses?.ref, ...j.steps.map((s) => s.uses?.ref)])
        .filter((r): r is string => typeof r === 'string' && r.startsWith('./'))
        .map((r) => r.replace(/^\.\//, ''))
        .flatMap((r) => {
            if (/\.ya?ml$/.test(r)) return [r];
            const dir = r.replace(/\/$/, '');
            const files = filesUnder(dir);
            return files.length > 0 ? [...files] : [`${dir}/action.yml`];
        });
    return [...new Set([file, ...local])];
}
