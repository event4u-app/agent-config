/**
 * The one-resolver invariant, made checkable.
 *
 * `judgment_ladder.ts` is the ONE task-side resolver that decides which
 * dispatch rung a task takes, council included. Its own module docstring says
 * so, and says two further things that were equally unenforced: that no fourth
 * parallel classifier may be "bolted on beside it", and that it is
 * "deliberately independent of `ai_council/necessity.ts`", which is the
 * council's OWN council-internal necessity gate.
 *
 * All three were prose. A docstring cannot fail, so a second task-side council
 * router could land beside the ladder and every gate in this tree would stay
 * green — which is exactly what
 * `road-to-inbox-harvest-2026-08-e-council-topology-evidence` step 0.5 asks to
 * be closed: "lock the one-resolver invariant in documentation AND in a test".
 *
 * This module is the scanner half. It is deliberately a pure function over
 * file text so the test can drive it against a synthetic tree and observe it
 * going red — a guard never seen red has unknown sensitivity.
 */
import fs from 'node:fs';
import path from 'node:path';

/** The single sanctioned task-side resolver, repo-relative. */
export const SANCTIONED_RESOLVER = path.join('src', 'scripts', '_lib', 'judgment_ladder.ts');

/** The council's own internal surface. Task-side code does not import from it. */
export const COUNCIL_INTERNAL_DIR = path.join('src', 'scripts', 'ai_council');

/**
 * Exported identifiers that mark a module as a task-side council/dispatch
 * ROUTER — the thing there may be only one of.
 *
 * Deliberately narrow. A broad pattern (anything containing `council`) would
 * match every consumer, reader and formatter in the tree and the guard would
 * be noise. These three shapes are what a competing resolver actually looks
 * like: a class named for the job, or a function that returns a routing
 * verdict.
 */
export const ROUTER_EXPORT_PATTERNS: readonly RegExp[] = [
    /\bexport\s+(?:class|interface)\s+\w*Council\w*Router\b/,
    /\bexport\s+(?:async\s+)?function\s+classifyLadder\b/,
    /\bexport\s+(?:async\s+)?function\s+\w*resolveCouncilRoute\w*\b/,
];

export interface Violation {
    readonly file: string;
    readonly kind: 'second-resolver' | 'council-import-in-resolver';
    readonly detail: string;
}

/** Does this file text declare a task-side council/dispatch router? */
export function declaresRouter(text: string): boolean {
    return ROUTER_EXPORT_PATTERNS.some((re) => re.test(text));
}

/**
 * Does the sanctioned resolver import from the council's internal directory?
 *
 * The ladder's docstring states the independence as a design choice; an import
 * would silently make the two surfaces one, which is the same invariant seen
 * from the other end.
 */
export function importsCouncilInternal(text: string): boolean {
    return /\bfrom\s+['"][^'"]*ai_council\//.test(text);
}

/** Walk `.ts` files under a directory, skipping tests and node_modules. */
function walk(dir: string, out: string[] = []): string[] {
    if (!fs.existsSync(dir)) return out;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === 'node_modules' || entry.name === '__tests__') continue;
            walk(p, out);
        } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
            out.push(p);
        }
    }
    return out;
}

/**
 * Check the invariant over a tree.
 *
 * @param root repository root to scan
 * @returns every violation found; empty means the invariant holds
 */
export function checkOneResolver(root: string): Violation[] {
    const violations: Violation[] = [];
    const scanRoot = path.join(root, 'src', 'scripts');
    for (const abs of walk(scanRoot)) {
        const rel = path.relative(root, abs);
        // The council's own internals are not task-side and are out of scope.
        if (rel.startsWith(COUNCIL_INTERNAL_DIR + path.sep)) continue;
        const text = fs.readFileSync(abs, 'utf-8');
        if (rel !== SANCTIONED_RESOLVER && declaresRouter(text)) {
            violations.push({
                file: rel,
                kind: 'second-resolver',
                detail:
                    `declares a task-side council/dispatch router beside ` +
                    `${SANCTIONED_RESOLVER}. There is exactly one task-side resolver; ` +
                    `a second one makes routing depend on which classifier ran first.`,
            });
        }
        if (rel === SANCTIONED_RESOLVER && importsCouncilInternal(text)) {
            violations.push({
                file: rel,
                kind: 'council-import-in-resolver',
                detail:
                    `imports from ${COUNCIL_INTERNAL_DIR}/. The resolver is deliberately ` +
                    `independent of the council's own necessity gate; an import merges the ` +
                    `task-side and council-internal surfaces the ladder's docstring keeps apart.`,
            });
        }
    }
    return violations;
}
