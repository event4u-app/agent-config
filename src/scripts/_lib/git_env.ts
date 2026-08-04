/**
 * Environment for child `git` invocations that must resolve from their `cwd`.
 *
 * Git hooks export `GIT_DIR` (and often `GIT_INDEX_FILE`), and every child
 * process inherits them. An inherited `GIT_DIR` **overrides** repository
 * discovery, so `execFileSync('git', […], { cwd })` silently operates against
 * the hook's repository instead of `cwd`. In a linked worktree the two differ,
 * and the symptom is not an error but wrong data: `git log -- <path>` returns
 * nothing, which the Gate R1 grandfather clause reads as "no pre-activation
 * baseline" and reports as `missing_register` on every grandfathered roadmap.
 *
 * That made the pre-push enforcement layer fire spuriously while CI — which
 * runs the same gate WITHOUT `GIT_DIR` — stayed green: the worst shape for a
 * gate, since the failure looks like a content problem and the authoritative
 * layer disagrees with the local one.
 *
 * Every gate in this family therefore runs git through this env: the variables
 * that redirect discovery are removed, so `cwd` is the only thing that decides.
 */

/** Git env vars that override repository discovery and must not be inherited. */
export const GIT_DISCOVERY_VARS: readonly string[] = [
    'GIT_DIR',
    'GIT_WORK_TREE',
    'GIT_INDEX_FILE',
    'GIT_OBJECT_DIRECTORY',
    'GIT_ALTERNATE_OBJECT_DIRECTORIES',
    'GIT_COMMON_DIR',
    'GIT_NAMESPACE',
    'GIT_PREFIX',
];

/** `process.env` minus the discovery-overriding variables. */
export function gitEnv(base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = { ...base };
    for (const key of GIT_DISCOVERY_VARS) {
        delete env[key];
    }
    return env;
}
