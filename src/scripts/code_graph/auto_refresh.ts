/**
 * The auto-refresh opt-in a local `build` or `map` writes (see `enableByUse`).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { writeContained } from '../_lib/contained_write.js';
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
 * `auto-refresh off` leaves an opt-out this never overrides. The owner's
 * directive is recorded in agents/evidence/owner-directives/2026-11-01-map-auto-refresh.md;
 * under `CI` nothing is written.
 */
export function enableByUse(root: string): string {
    // A CI run is a script, not a developer asking for a map; the kill switch also covers the opt-in.
    if (process.env['CI'] || process.env['AGENT_CONFIG_CODE_GRAPH_REFRESH'] === 'off') return '';
    const home = graphHome(root);
    if (home.kind !== 'project' || fs.existsSync(home.autoRefreshPath) || fs.existsSync(home.autoRefreshOffPath)) return '';
    // Contained: a symlink the repository ships under agents/map never redirects the opt-in.
    if (!writeContained(root, path.join(home.buildDir, path.basename(home.autoRefreshPath)), `${JSON.stringify({ enabled_at: new Date().toISOString(), by: 'use' })}\n`)) return '';
    return '    auto-refresh on — refreshed at session start and at a turn end, at most once per HEAD and 10-minute window; `code-graph auto-refresh off` stops it\n';
}
