/**
 * prepack_router_targets.mjs — pure core of prepack gate 4.
 *
 * Every `routes_to` target in `dist/router.json` must resolve to a file that
 * (a) exists and (b) is inside the `files[]` whitelist. A pointer that
 * resolves in the dev tree but is not in the tarball is dead the moment a
 * consumer installs it — `agent-config conformance`'s `router-pointers` check
 * then fails on the consumer's machine, for a defect introduced here.
 *
 * The kind→path table is NOT defined here: it is imported from
 * `router_target_paths.mjs`, which `cmd_conformance.ts::routeTargetPaths` also
 * consumes. One table, two readers — see that file's header for why.
 *
 * Extracted from `prepack-check.mjs` for the same reason
 * `prepack_lifecycle_check.mjs` was: the entry script has top-level side
 * effects and `process.exit`, so it cannot be imported by a test.
 * road-to-gates-that-can-fail Phase 4.
 */
import { routeTargetPathsPosix } from './router_target_paths.mjs';

/**
 * @typedef {object} RouterTargetOptions
 * @property {string} routerPath        Absolute path to the router index.
 * @property {(relPath: string) => boolean} isShipped  `files[]` membership test.
 * @property {(relPath: string) => boolean} exists     Existence test, repo-relative.
 * @property {(absPath: string) => string} readFile    Reader for `routerPath`.
 */

/**
 * @param {RouterTargetOptions} opts
 * @returns {{ errors: string[], scanned: number }}
 */
export function checkRouterTargetsShipped(opts) {
    const { routerPath, isShipped, exists, readFile } = opts;
    const errors = [];
    let scanned = 0;

    let router;
    try {
        router = JSON.parse(readFile(routerPath));
    } catch (e) {
        return {
            errors: [`router index ${routerPath} unreadable or not JSON: ${e.message}`],
            scanned: 0,
        };
    }

    for (const tier of ['tier_1', 'tier_2']) {
        for (const entry of router[tier] ?? []) {
            const ruleId = String(entry?.id ?? '<unnamed rule>');
            for (const raw of entry?.routes_to ?? []) {
                const target = String(raw);
                scanned += 1;
                const candidates = routeTargetPathsPosix(target);
                if (candidates.length === 0) {
                    errors.push(
                        `${tier}:${ruleId} routes_to ${JSON.stringify(target)} — unparseable ` +
                            'target or unknown kind (router_target_paths.mjs has no template ' +
                            'for it), so nothing can be verified as shipped',
                    );
                    continue;
                }
                const present = candidates.filter((rel) => exists(rel));
                if (present.length === 0) {
                    errors.push(
                        `${tier}:${ruleId} routes_to '${target}' → none of ` +
                            `[${candidates.join(', ')}] exists in the tree`,
                    );
                    continue;
                }
                if (!present.some((rel) => isShipped(rel))) {
                    errors.push(
                        `${tier}:${ruleId} routes_to '${target}' → ${present[0]} exists but is ` +
                            'NOT in the package.json `files` whitelist — the pointer would ' +
                            'ship dead and fail `agent-config conformance` on the consumer',
                    );
                }
            }
        }
    }

    // Zero-scope is a failure (Phase 1 of the same roadmap): a router index
    // that yields no targets means the shape changed under the gate, not that
    // the package is clean.
    if (errors.length === 0 && scanned === 0) {
        errors.push(
            `scanned 0 routes_to target(s) in ${routerPath} — the scan scope is dead or the ` +
                'router schema moved; this gate cannot report clean on nothing',
        );
    }

    return { errors, scanned };
}
