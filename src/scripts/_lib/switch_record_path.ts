import { createHash } from 'node:crypto';
import * as path from 'node:path';

import { quotaStateDir } from './quota_ledger.js';
import type { EnvMap } from './user_global_paths.js';

/**
 * The version of the call surface between the `switch_link` chunk and the two
 * bundles that load it (`quota_notice` and the dispatch bundle's Stop path).
 * Each side compiles its own copy; the chunk answers only a caller whose copy
 * matches, so a chunk built against another call surface is not called even
 * when its digest sidecar matches it. This is API compatibility, not build
 * identity: two builds with the same number are taken as compatible, which
 * holds only while it is raised whenever the signature or meaning of
 * `switchTurn` or `checkpointBeforeMove` changes.
 */
export const SWITCH_LINK_API = 1;

/**
 * Where a session's switch record lives. Its own module because the Stop path
 * ships in the dispatch bundle and checks only that the file exists before it
 * loads the link from the `switch_link` chunk.
 */
export function switchRecordPath(sessionHash: string, stateEnv?: EnvMap | null): string {
    return path.join(quotaStateDir(stateEnv), 'switch', `${createHash('sha256').update(sessionHash).digest('hex').slice(0, 20)}.json`);
}
