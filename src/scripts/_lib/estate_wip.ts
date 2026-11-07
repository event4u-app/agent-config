/**
 * The work-in-progress cap on active roadmaps, and the one way past it: an owner
 * record the change did not write itself. 25, not five: a blocker can hold an
 * active roadmap still, and a small cap then stops all other work.
 */
import { spawnSync } from 'node:child_process';

export const WIP_CAP = 25;

const OWNER_RECORD_RE = /agents\/evidence\/owner-directives\/([A-Za-z0-9._-]+\.md)/g;

/**
 * The reason cites an owner-directive file that exists at `baseRef` — so this
 * change did not write it — and whose text names `slug`.
 */
export function citesOwnerRecord(reason: string, repoRoot: string, baseRef: string | null, slug: string): boolean {
    if (baseRef === null) return false;
    for (const m of reason.matchAll(OWNER_RECORD_RE)) {
        const r = spawnSync('git', ['show', `${baseRef}:agents/evidence/owner-directives/${m[1] ?? ''}`], {
            cwd: repoRoot,
            encoding: 'utf-8',
        });
        if (r.status === 0 && r.stdout.includes(slug)) return true;
    }
    return false;
}
