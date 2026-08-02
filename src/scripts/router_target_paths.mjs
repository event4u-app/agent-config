/**
 * router_target_paths.mjs — the ONE kind→path table for `dist/router.json`
 * `routes_to` targets.
 *
 * Two consumers read it and they must not disagree:
 *   * `src/scripts/_cli/cmd_conformance.ts::routeTargetPaths` — resolves a
 *     pointer against the INSTALLED package tree at runtime.
 *   * `src/scripts/prepack-check.mjs` gate 4 — asserts the same pointer lands
 *     inside the `files[]` whitelist BEFORE the tarball is built.
 *
 * A copied table would let one side ship a target the other cannot see, which
 * is exactly the packaging↔runtime gap the pack gate exists to close
 * (road-to-gates-that-can-fail Phase 4). Plain `.mjs` because `prepack-check`
 * runs as raw Node during the npm lifecycle and cannot load TypeScript; the
 * TS side reads the sibling `router_target_paths.d.mts` declarations. Same
 * shape as `prepack_lifecycle_check.mjs`.
 *
 * Templates are POSIX-relative with a single `{id}` placeholder. Callers that
 * need platform separators split on `/` and `path.join` the segments.
 */

/**
 * Candidate homes per target kind, in resolution order — the FIRST existing
 * candidate wins.
 *
 * `contract:` has two legitimate homes in the shipped tree: the public
 * contract pages under `docs/contracts/` (per the rule-router contract) and
 * the agent-facing contract contexts under
 * `dist/agent-src/contexts/contracts/` (e.g. artifact-engagement-flow).
 */
export const ROUTE_TARGET_TEMPLATES = Object.freeze({
    skill: Object.freeze(['dist/agent-src/skills/{id}/SKILL.md']),
    command: Object.freeze(['dist/agent-src/commands/{id}.md']),
    guideline: Object.freeze(['docs/guidelines/{id}.md']),
    contract: Object.freeze([
        'docs/contracts/{id}.md',
        'dist/agent-src/contexts/contracts/{id}.md',
    ]),
});

/**
 * Split a `<kind>:<id>` target. Returns `null` for a malformed target (no
 * colon, empty kind, empty id, or an unknown kind).
 *
 * @param {string} target
 * @returns {{ kind: string, id: string } | null}
 */
export function parseRouteTarget(target) {
    const sep = target.indexOf(':');
    if (sep <= 0) return null;
    const kind = target.slice(0, sep);
    const id = target.slice(sep + 1);
    if (!id) return null;
    if (!Object.prototype.hasOwnProperty.call(ROUTE_TARGET_TEMPLATES, kind)) return null;
    return { kind, id };
}

/**
 * POSIX package-relative candidate paths for one `routes_to` target.
 * Empty array = the target is unparseable or its kind is unknown.
 *
 * @param {string} target
 * @returns {string[]}
 */
export function routeTargetPathsPosix(target) {
    const parsed = parseRouteTarget(target);
    if (parsed === null) return [];
    return ROUTE_TARGET_TEMPLATES[parsed.kind].map((tpl) => tpl.replace('{id}', parsed.id));
}
