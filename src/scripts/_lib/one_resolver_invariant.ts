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
 * green — which is what
 * `road-to-inbox-harvest-2026-08-e-council-topology-evidence` step 0.5 asks to
 * be closed: "lock the one-resolver invariant in documentation AND in a test".
 *
 * This module is the scanner half. It is deliberately a pure function over
 * file text so the test can drive it against a synthetic tree and observe it
 * going red — a guard never seen red has unknown sensitivity.
 *
 * ## Revised 2026-08-29 after an R2 completion review (6 findings, 2 high)
 *
 * The first version was reviewed by a fresh subagent and was wrong in ways the
 * implementing session had asserted were right. Recorded here rather than in a
 * commit message alone, because each one is a property a future reader will
 * otherwise re-assume:
 *
 * 1. **It could scan nothing and pass.** The result now carries `scanned`, the
 *    exact file list, so "green" and "walked zero files" are distinguishable by
 *    a caller instead of by inspection. The reviewer proved the old version by
 *    mutating the scan root to a typo and watching both real-tree tests pass.
 * 2. **The patterns were evadable by export SYNTAX, not just naming.** The old
 *    set matched `export class` and `export function` only, so
 *    `export default class CouncilTopologyRouter`, `export abstract class …`,
 *    `export const X = class`, an arrow-const, and a bare `export { X }` all
 *    passed. Nine of eleven measured shapes evaded it.
 * 3. **The scan root was `src/scripts` alone**, leaving `src/cli`,
 *    `src/shared`, `src/server` and the `work_engine` template tree invisible.
 * 4. **It never asserted the resolver EXISTS**, so deleting `judgment_ladder.ts`
 *    scanned green — the positive half of the invariant was enforced by nothing.
 * 5. **The import check missed `import()`, `require()` and the index form**, and
 *    false-positived on a comment, so a docstring reword could red the gate.
 */
import fs from 'node:fs';
import path from 'node:path';

/** The single sanctioned task-side resolver, repo-relative. */
export const SANCTIONED_RESOLVER = path.join('src', 'scripts', '_lib', 'judgment_ladder.ts');

/** The council's own internal surface. Task-side code does not import from it. */
export const COUNCIL_INTERNAL_DIR = path.join('src', 'scripts', 'ai_council');

/**
 * Roots walked by {@link checkOneResolver}, repo-relative.
 *
 * Finding 3: `src/scripts` alone left a second resolver invisible anywhere
 * else in `src/`. The root is now `src/` entire, minus the exclusions below —
 * a positive list of directories would have the same defect one directory
 * later.
 */
export const SCAN_ROOT = 'src';

/** Directory names never walked. */
const SKIP_DIRS = new Set(['node_modules', '__tests__', 'dist', '.git']);

/**
 * Names that mark a module as a task-side council/dispatch ROUTER — the thing
 * there may be only one of.
 *
 * Split from the export SYNTAX (below) after finding 2. Keeping the two apart
 * is the point: a name list that also has to enumerate every way TypeScript
 * can export a binding will always be one syntax behind.
 */
export const ROUTER_NAMES: readonly RegExp[] = [
    /\w*Council\w*Router\b/,
    /\bclassifyLadder\b/,
    /\w*resolveCouncilRoute\w*\b/,
];

/**
 * Export forms a router name can arrive in. Deliberately exhaustive over the
 * shapes the reviewer measured evading the first version.
 */
export const EXPORT_FORMS: readonly RegExp[] = [
    // export [default] [abstract] class|interface|function|const|let|var NAME
    /\bexport\s+(?:default\s+)?(?:abstract\s+)?(?:class|interface|type|function|const|let|var)\s+(NAME)\b/,
    // export default NAME
    /\bexport\s+default\s+(NAME)\b/,
    // export { NAME } / export { NAME as X } / export { X as NAME }
    /\bexport\s*\{[^}]*\b(NAME)\b[^}]*\}/,
    // export async function NAME
    /\bexport\s+async\s+function\s+(NAME)\b/,
];

export interface Violation {
    readonly file: string;
    readonly kind: 'second-resolver' | 'council-import-in-resolver' | 'resolver-missing';
    readonly detail: string;
}

export interface ScanResult {
    readonly violations: readonly Violation[];
    /** Every file actually read, repo-relative. Empty means the scan found nothing to look at. */
    readonly scanned: readonly string[];
}

/**
 * Strip line and block comments and string literals, so a mention in prose is
 * not read as code. Finding 5's false positive.
 *
 * Intentionally crude: it over-strips inside template literals, which costs a
 * missed detection in code nobody writes a router in, and never invents a hit.
 */
export function stripNonCode(text: string): string {
    return text
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
        .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
        .replace(/"(?:[^"\\\n]|\\.)*"/g, '""');
}

/** Does this file text declare a task-side council/dispatch router? */
export function declaresRouter(text: string): boolean {
    const code = stripNonCode(text);
    for (const name of ROUTER_NAMES) {
        for (const form of EXPORT_FORMS) {
            const re = new RegExp(form.source.replace('NAME', name.source), 'm');
            if (re.test(code)) return true;
        }
    }
    return false;
}

/**
 * Does this file import from the council's internal directory?
 *
 * Covers static `from`, dynamic `import()`, `require()`, and the index form
 * with no trailing slash — all three misses in finding 5 — over comment- and
 * string-stripped text, which removes the false positive in the same pass.
 *
 * NOTE the ordering: literals are stripped, so the *specifier* is gone too.
 * The patterns therefore run over the ORIGINAL text with comments removed
 * only, which is what {@link stripComments} exists for.
 */
export function importsCouncilInternal(text: string): boolean {
    const code = stripComments(text);
    return [
        /\bfrom\s+['"][^'"]*ai_council(?:\/|['"])/,
        /\bimport\s*\(\s*['"][^'"]*ai_council(?:\/|['"])/,
        /\brequire\s*\(\s*['"][^'"]*ai_council(?:\/|['"])/,
    ].some((re) => re.test(code));
}

/** Remove comments only, preserving string literals (import specifiers live there). */
export function stripComments(text: string): string {
    return text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
}

/** Walk `.ts` files under a directory, skipping tests and build output. */
function walk(dir: string, out: string[] = []): string[] {
    if (!fs.existsSync(dir)) return out;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (SKIP_DIRS.has(entry.name)) continue;
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
 * @returns the violations AND the files actually read. A caller that only
 *          checks `violations.length === 0` cannot tell a clean tree from an
 *          unscanned one — which is finding 1, and why `scanned` is returned
 *          rather than logged.
 */
export function checkOneResolver(root: string): ScanResult {
    const violations: Violation[] = [];
    const scanned: string[] = [];

    // Finding 4: the POSITIVE half. Without this the invariant is satisfied by
    // deleting the resolver, which is not "one resolver" — it is none.
    if (!fs.existsSync(path.join(root, SANCTIONED_RESOLVER))) {
        violations.push({
            file: SANCTIONED_RESOLVER,
            kind: 'resolver-missing',
            detail:
                'the sanctioned task-side resolver does not exist. "Exactly one" is ' +
                'violated by zero as well as by two; a tree with no resolver must not scan green.',
        });
    }

    for (const abs of walk(path.join(root, SCAN_ROOT))) {
        const rel = path.relative(root, abs);
        // The council's own internals are not task-side and are out of scope.
        if (rel.startsWith(COUNCIL_INTERNAL_DIR + path.sep)) continue;
        scanned.push(rel);
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
    return { violations, scanned };
}
