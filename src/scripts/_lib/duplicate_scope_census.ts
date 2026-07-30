/**
 * Duplicate-scope rule census — the shared byte-comparison primitive behind
 * both C-2 (`cache_realization_report.ts`'s `computeDuplicateScope`, which
 * turns this into a share of subagent write volume) and the `doctor`
 * `duplicate-scope-rules` health check (`_cli/cmd_doctor.ts`), so the two
 * surfaces can never drift on what counts as "shared" or how a redundant
 * copy's size is estimated.
 *
 * `agents/roadmaps/road-to-cache-economy.md` Phase 3: the same 110 rule
 * filenames observed at both `~/.claude/rules` (user scope) and
 * `dist/agent-src/rules` (project scope) on this maintainer's own checkout —
 * C-2 confirmed at 38.5% of subagent write volume. This module answers only
 * "which filenames are shared, and how many redundant bytes do they cost" —
 * the write-volume share and the doctor warning are each computed by their
 * own caller from this raw census.
 *
 * Detection only. Never deletes, never rewrites a user's file — see
 * `non-destructive-by-default`.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface DuplicateScopeCensus {
    evaluable: boolean;
    reason?: string | undefined;
    /** `.md` basenames present in BOTH directories, sorted. */
    shared_filenames: string[];
    /** Σ min(userBytes, projectBytes) over shared filenames — the conservative
     *  estimate of the redundant copy (the roadmap's byte census found the two
     *  scopes near-identical in size, so the min/max choice rarely matters). */
    duplicate_chars: number;
}

/**
 * For every `.md` filename present in BOTH `userRulesDir` and
 * `projectRulesDir`, the redundant copy is estimated as the SMALLER of the
 * two files' byte sizes, summed across all shared filenames.
 */
export function censusDuplicateScope(userRulesDir: string, projectRulesDir: string): DuplicateScopeCensus {
    if (!fs.existsSync(userRulesDir) || !fs.existsSync(projectRulesDir)) {
        return {
            evaluable: false,
            reason: `one or both rule directories are missing (user: ${userRulesDir}, project: ${projectRulesDir})`,
            shared_filenames: [],
            duplicate_chars: 0,
        };
    }

    const userFiles = new Set(fs.readdirSync(userRulesDir).filter((f) => f.endsWith('.md')));
    const projectFiles = fs.readdirSync(projectRulesDir).filter((f) => f.endsWith('.md'));

    const shared: string[] = [];
    let duplicateChars = 0;
    for (const f of projectFiles) {
        if (!userFiles.has(f)) continue;
        shared.push(f);
        const a = fs.statSync(path.join(userRulesDir, f)).size;
        const b = fs.statSync(path.join(projectRulesDir, f)).size;
        duplicateChars += Math.min(a, b);
    }
    shared.sort();

    if (shared.length === 0) {
        return {
            evaluable: false,
            reason: 'no shared .md filenames between the two rule scopes — this checkout has no duplicate-scope install',
            shared_filenames: [],
            duplicate_chars: 0,
        };
    }

    return {
        evaluable: true,
        shared_filenames: shared,
        duplicate_chars: duplicateChars,
    };
}
