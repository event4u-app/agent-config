import { createHash } from 'node:crypto';
import * as path from 'node:path';

import { quotaStateDir } from './quota_ledger.js';
import type { EnvMap } from './user_global_paths.js';

/**
 * Where a session's switch record lives. Its own module because the Stop path
 * ships in the dispatch bundle and checks only that the file exists before it
 * loads the link from the `quota_notice` chunk.
 */
export function switchRecordPath(sessionHash: string, stateEnv?: EnvMap | null): string {
    return path.join(quotaStateDir(stateEnv), 'switch', `${createHash('sha256').update(sessionHash).digest('hex').slice(0, 20)}.json`);
}
