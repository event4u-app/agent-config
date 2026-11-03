/**
 * `doctor` checks whose fix line a consumer reads — kept to commands a consumer has.
 *
 * Moved out of `cmd_doctor.ts`, which is past the source-size budget. The
 * 2026-11-01 newcomer walkthrough found these hints pointing at maintainer
 * paths (`npx tsx src/scripts/…`) and telling a global-only user to create a
 * project lockfile; a global install never needs one.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import * as sync_gitattributes from '../sync_gitattributes.js';

type Dict = Record<string, unknown>;

/** A manifest-only check on a root with no project lockfile. `installed`: a global install exists. */
export function skippedManifestCheck(check_id: string, installed: boolean): Dict {
    return installed
        ? { id: check_id, status: 'skipped', message: 'applies only to a project install (agents/installed-tools.lock); a global install has none', remedy: '' }
        : {
              id: check_id,
              status: 'skipped',
              message: 'requires a project lockfile (agents/installed-tools.lock)',
              remedy: 'run `agent-config init` to install, then re-run this check',
          };
}

export function bridgeDriftNoManifest(bridge_present: boolean, installed: boolean): Dict {
    if (bridge_present) {
        return { id: 'bridge-drift', status: 'ok', message: 'no project lockfile → distributed-tool drift not applicable (global-only consumer)', remedy: '' };
    }
    return {
        id: 'bridge-drift',
        status: 'skipped',
        message: 'no project lockfile and no consumer install marker → drift check not applicable',
        remedy: installed ? '' : 'run `agent-config init` to install',
    };
}

/**
 * `memory-merge-union` — read-only, advisory (road-to-reachable-code-memory
 * Phase 5). The `merge=union` .gitattributes block lets two branches each
 * appending a NEW memory entry (intake JSONL, or the flat curated
 * `agents/memory/<type>.yml` files) merge cleanly instead of conflicting. A
 * project with no `agents/memory/` has nothing to merge, so it is skipped
 * there rather than warned about.
 */
export function memoryMergeUnion(project_root: string): Dict {
    const id = 'memory-merge-union';
    const remedy = 'run `agent-config refresh --project`';
    if (!fs.existsSync(path.join(project_root, 'agents', 'memory'))) {
        return { id, status: 'skipped', message: 'no agents/memory/ in this project — memory merge attributes not needed', remedy: '' };
    }
    const target = path.join(project_root, sync_gitattributes.DEFAULT_GITATTRIBUTES);
    let text: string;
    try {
        text = fs.readFileSync(target, 'utf-8');
    } catch (exc) {
        const missing = (exc as NodeJS.ErrnoException).code === 'ENOENT';
        const message = missing
            ? 'no .gitattributes at project root — memory merge-safety attributes not applied'
            : `unreadable .gitattributes at ${target}: ${(exc as Error).message}`;
        return { id, status: 'warn', message, remedy };
    }
    const has_block = text.includes(sync_gitattributes.SECTION_HEADER);
    if (has_block && /agents\/memory\/intake\/\*\.jsonl\s+merge=union/.test(text)) {
        return { id, status: 'ok', message: '.gitattributes carries the memory merge-safety block (intake JSONL union-merge present)', remedy: '' };
    }
    return {
        id,
        status: 'warn',
        message: has_block
            ? '.gitattributes has the managed block but is missing the intake merge=union line'
            : '.gitattributes is missing the memory merge-safety block — parallel-branch memory writes can conflict instead of merging',
        remedy,
    };
}
