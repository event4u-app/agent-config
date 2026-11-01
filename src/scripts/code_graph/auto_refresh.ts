/**
 * The auto-refresh opt-in a local `build` or `map` writes (see `enableByUse`).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { graphHome } from './graph_home.js';

/**
 * Turn auto-refresh on because this developer just built or drew the graph here.
 *
 * The ratification round of 2026-10-23 refused an EXISTING cache as consent,
 * since a repository can commit one. A `build` or `map` run on this machine is a
 * different fact: it is the developer asking for the map, and a map nobody keeps
 * current is the failure the owner reported on 2026-11-01 (a map 20 commits
 * behind because nobody ever typed `auto-refresh on`). The marker still lands in
 * the gitignored `.build/`, the concern still refuses a tracked one, and
 * `auto-refresh off` leaves an opt-out this never overrides.
 */
export function enableByUse(root: string): string {
    const home = graphHome(root);
    if (home.kind !== 'project' || fs.existsSync(home.autoRefreshPath) || fs.existsSync(home.autoRefreshOffPath)) return '';
    try {
        fs.mkdirSync(home.buildDir, { recursive: true });
        fs.writeFileSync(path.join(home.buildDir, path.basename(home.autoRefreshPath)), `${JSON.stringify({ enabled_at: new Date().toISOString(), by: 'use' })}\n`);
    } catch {
        return '';
    }
    return '    auto-refresh on — kept current at every session start and after each commit; `code-graph auto-refresh off` stops it\n';
}
