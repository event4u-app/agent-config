/**
 * One ownership model for stores: every store is owned by the user, the
 * project, the team or the machine, and names its delete path. User-owned data
 * — preferences, working style, chat messages, session data, signals — lives
 * under the user's home keyed by a stable repository id, never in the project.
 *
 * Precedence is read from the settings code, not restated from a plan:
 * `get_modules_config` lets a team `locked_keys` entry win over everything,
 * then the developer cascade (project files over the user-global file, the
 * deepest project file last), then the team file's unlocked defaults, then the
 * built-in defaults.
 */
import * as path from 'node:path';

import { type EnvMap, event4u_root } from './user_global_paths.js';

export type StoreOwner = 'user' | 'project' | 'team' | 'machine';

/** The layers a setting resolves through, strongest first, as the settings code applies them. */
export const PRECEDENCE = ['team-locked', 'project-path', 'project', 'user-global', 'team-unlocked', 'defaults'] as const;
export type Layer = (typeof PRECEDENCE)[number];

/** The value a key resolves to and the layer it came from. */
export function resolveLayered(key: string, layers: Partial<Record<Layer, Record<string, unknown>>>, lockedKeys: readonly string[]): { value: unknown; from: Layer } | null {
    for (const layer of PRECEDENCE) {
        if (layer === 'team-locked') {
            if (lockedKeys.includes(key) && layers['team-unlocked'] && key in layers['team-unlocked']) return { value: layers['team-unlocked'][key], from: 'team-locked' };
            continue;
        }
        const l = layers[layer];
        if (l && key in l) return { value: l[key], from: layer };
    }
    return null;
}

/** Where a user-owned store for one repository lives: under the user's home, never the checkout. */
export function userProjectDir(repoId: string, env?: EnvMap | null): string {
    if (!/^[A-Za-z0-9._-]+$/.test(repoId)) throw new Error(`repo id ${JSON.stringify(repoId)} is not a safe directory name`);
    return path.join(event4u_root(env), 'user', 'projects', repoId);
}

/** Path shapes that only user-owned data takes; one of these in a committed path is a leak. */
export const USER_DATA_PATTERNS: ReadonlyArray<readonly [string, RegExp]> = [
    ['chat history', /(^|\/)\.agent-chat-history(\/|$|\.)/],
    ['session index', /(^|\/)sessions\/[^/]+\.(jsonl?|sqlite3?)$/],
    ['feedback signals', /(^|\/)signals\/[^/]+\.jsonl?$/],
    ['working style', /(^|\/)working[-_]style\.(ya?ml|json|md)$/],
    ['user profile', /(^|\/)\.agent-user\.ya?ml$/],
];

export interface OwnershipFinding {
    file: string;
    kind: string;
}

/**
 * Tracked paths that hold user-owned data. `tracked` is `git ls-files` output;
 * `userStorePaths` are the registry paths of stores owned by the user.
 */
export function userDataInCommittedPaths(tracked: readonly string[], userStorePaths: readonly string[] = []): OwnershipFinding[] {
    const out: OwnershipFinding[] = [];
    const inRepo = userStorePaths.filter((p) => !p.startsWith('~') && !path.isAbsolute(p));
    for (const f of tracked) {
        const hit = USER_DATA_PATTERNS.find(([, re]) => re.test(f));
        if (hit) {
            out.push({ file: f, kind: hit[0] });
            continue;
        }
        const store = inRepo.find((p) => f === p || f.startsWith(`${p.replace(/\/$/, '')}/`));
        if (store) out.push({ file: f, kind: `user-owned store ${store}` });
    }
    return out;
}
