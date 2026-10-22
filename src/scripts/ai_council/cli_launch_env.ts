/**
 * What a CLI seat's launch reads from its environment: the session-wide
 * subagent model ceiling and the vendor binary's version. Kept apart from
 * `clients.ts`, which is past the source-size ceiling.
 */
import { spawnSync } from 'node:child_process';

import { load_agent_settings } from '../_lib/agent_settings.js';

// Session-wide subagent model ceiling (token-economy-dispatch Phase 5.2):
// class-C setting, default absent, HUMAN-set only. When present, the CLI
// spawn below exports CLAUDE_CODE_SUBAGENT_MODEL so the spawned vendor
// session caps its own subagents' models. Memoised PER CWD, not per
// process (review finding 2026-08-10): a long-lived server process may
// serve several projects, and a single-slot memo would apply project A's
// spend cap to project B's spawns. A human edit still needs a process
// restart to be seen — acceptable for a per-install cap, stated here.
const _modelCeilingMemo = new Map<string, string | null>();
export function _subagentModelCeiling(cwd: string = process.cwd()): string | null {
    const hit = _modelCeilingMemo.get(cwd);
    if (hit !== undefined) return hit;
    let ceiling: string | null;
    try {
        const settings = load_agent_settings({ cwd }) as Record<string, unknown>;
        const sub = (settings['subagents'] ?? {}) as Record<string, unknown>;
        const v = typeof sub['model_ceiling'] === 'string' ? sub['model_ceiling'].trim() : '';
        ceiling = v.length > 0 ? v : null;
    } catch {
        ceiling = null; // unreadable settings → no ceiling (fail-open)
    }
    _modelCeilingMemo.set(cwd, ceiling);
    return ceiling;
}
/** Test seam: reset the per-cwd ceiling memo. */
export function _resetModelCeilingMemo(): void {
    _modelCeilingMemo.clear();
}

const _cliVersionCache = new Map<string, string | null>();

/** What `<binary> --version` prints, once per binary per process; null when it cannot run. */
export function _cliVersion(binary: string): string | null {
    const cached = _cliVersionCache.get(binary);
    if (cached !== undefined) return cached;
    let version: string | null = null;
    try {
        const r = spawnSync(binary, ['--version'], { encoding: 'utf8', timeout: 10_000 });
        if (r.status === 0 && typeof r.stdout === 'string') version = r.stdout.trim() || null;
    } catch {
        version = null;
    }
    _cliVersionCache.set(binary, version);
    return version;
}
