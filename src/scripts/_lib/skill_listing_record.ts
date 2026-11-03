/**
 * Where the installer records its skill-listing overrides, and the value that
 * marks a skill as listed without its description. A leaf module so a hook can
 * read the record without bundling the installer's write path.
 */
import * as user_global_paths from './user_global_paths.js';

export const NAME_ONLY = 'name-only';
export const RECORD_BASENAME = 'skill-overrides.json';

export function recordPath(env?: user_global_paths.EnvMap | null): string {
    return user_global_paths.write_target(RECORD_BASENAME, { env: env ?? null });
}
