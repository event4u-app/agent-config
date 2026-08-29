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
    // export [default] [declare] [abstract] [async] <kw> [*] NAME
    // `declare`, `enum` and the generator `function*` were added after an R2
    // round-2 finding: `export declare class` sits ONE keyword from
    // `export abstract class`, which was covered, so a reader had no signal
    // that the neighbouring form was not.
    /\bexport\s+(?:default\s+)?(?:declare\s+)?(?:abstract\s+)?(?:async\s+)?(?:class|interface|type|enum|const|let|var|function)\b\s*\*?\s*(NAME)\b/,
    // export default NAME
    /\bexport\s+default\s+(NAME)\b/,
    // export { NAME } / export { NAME as X } / export { X as NAME } / re-export
    /\bexport\s*\{[^}]*\b(NAME)\b[^}]*\}/,
];

export interface Violation {
    readonly file: string;
    readonly kind: 'second-resolver' | 'council-import-in-resolver' | 'resolver-missing' | 'resolver-is-not-a-resolver';
    readonly detail: string;
}

export interface ScanResult {
    readonly violations: readonly Violation[];
    /** Every file actually read, repo-relative. Empty means the scan found nothing to look at. */
    readonly scanned: readonly string[];
}

/**
 * Single-pass source scanner: classify every character as code, comment or
 * string literal, in ONE left-to-right pass.
 *
 * ## Why this is a scanner and not a sequence of regexes
 *
 * The previous version stripped block comments first with an unbounded
 * `/\*[\s\S]*?\*\/`, then line comments, then strings. An R2 review round
 * found that unsound and measured it on the live tree: any `//` comment
 * containing the two characters `/*` — a glob such as
 * `packages/<star>/commands/` — opened a spurious block comment that ran to the
 * next `*\/` anywhere in the file and deleted the real code between them.
 * **34 non-test `.ts` files under `src/` already carry such a comment, and in
 * 12 of them top-level `export` declarations vanished** (one lost 6,510 of
 * 13,270 characters, including its `export function run`). A second resolver
 * hidden behind such a comment scanned green WHILE its file appeared in
 * `scanned`, so the anti-vacuity discriminator could not catch it either.
 *
 * The defect is not fixable by reordering: comment-vs-string precedence is
 * positional, so whichever opens FIRST wins, and only a left-to-right pass
 * knows which that is.
 *
 * ## Known limit, stated rather than claimed away
 *
 * Regex literals are NOT tracked. A regex literal whose body contains a
 * comment opener is read as a comment start. Distinguishing division from a regex
 * literal needs a real parser, and the failure is a false NEGATIVE (code
 * dropped, so a router could hide there). It is left uncovered deliberately
 * rather than papered over: the round-1 lesson here was that claiming
 * exhaustiveness is what made the gap invisible.
 */
export interface Segments {
    /** Source with comments blanked; string literals preserved verbatim. */
    readonly codeAndStrings: string;
    /** Source with comments AND string contents blanked. */
    readonly codeOnly: string;
}

const BACKTICK = '\u0060';
const QUOTES = new Set(["'", '\u0022', BACKTICK]);

export function segment(text: string): Segments {
    const keepStrings: string[] = [];
    const dropStrings: string[] = [];
    let i = 0;
    const n = text.length;

    const push = (ch: string, inString: boolean): void => {
        keepStrings.push(ch);
        dropStrings.push(inString && ch !== '\n' ? ' ' : ch);
    };

    while (i < n) {
        const c = text[i] as string;
        const d = text[i + 1];

        if (c === '/' && d === '/') {
            while (i < n && text[i] !== '\n') {
                keepStrings.push(' ');
                dropStrings.push(' ');
                i++;
            }
            continue;
        }
        if (c === '/' && d === '*') {
            const close = text.indexOf('*/', i + 2);
            const stop = close === -1 ? n : close + 2;
            for (; i < stop; i++) {
                const ch = text[i] as string;
                keepStrings.push(ch === '\n' ? '\n' : ' ');
                dropStrings.push(ch === '\n' ? '\n' : ' ');
            }
            continue;
        }
        if (QUOTES.has(c)) {
            const quote = c;
            push(c, false);
            i++;
            while (i < n) {
                const ch = text[i] as string;
                if (ch === '\\') {
                    push(ch, true);
                    if (i + 1 < n) push(text[i + 1] as string, true);
                    i += 2;
                    continue;
                }
                push(ch, ch !== quote);
                i++;
                if (ch === quote) break;
                // A template literal may span lines; the others may not.
                if (ch === '\n' && quote !== BACKTICK) break;
            }
            continue;
        }
        push(c, false);
        i++;
    }
    return { codeAndStrings: keepStrings.join(''), codeOnly: dropStrings.join('') };
}

/** Source with comments and string CONTENTS blanked — for declaration matching. */
export function stripNonCode(text: string): string {
    return segment(text).codeOnly;
}

/** Source with comments blanked, string literals kept — import specifiers live in one. */
export function stripComments(text: string): string {
    return segment(text).codeAndStrings;
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
 * Covers static `from`, the SIDE-EFFECT form (which needs neither `from` nor a
 * paren, and was missed by the round-1 repair under a test titled "covers every
 * import form"), dynamic `import()`, `require()`, and the index form with no
 * trailing slash. Runs over comment-stripped text with string literals intact,
 * so a docstring mentioning the path cannot red the gate.
 */
export function importsCouncilInternal(text: string): boolean {
    const code = stripComments(text);
    return [
        /\bfrom\s+['"][^'"]*ai_council(?:\/|['"])/,
        /\bimport\s+['"][^'"]*ai_council(?:\/|['"])/,
        /\bimport\s*\(\s*['"][^'"]*ai_council(?:\/|['"])/,
        /\brequire\s*\(\s*['"][^'"]*ai_council(?:\/|['"])/,
    ].some((re) => re.test(code));
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
    const resolverAbs = path.join(root, SANCTIONED_RESOLVER);
    if (!fs.existsSync(resolverAbs)) {
        violations.push({
            file: SANCTIONED_RESOLVER,
            kind: 'resolver-missing',
            detail:
                'the sanctioned task-side resolver does not exist. "Exactly one" is ' +
                'violated by zero as well as by two; a tree with no resolver must not scan green.',
        });
    } else if (!declaresRouter(fs.readFileSync(resolverAbs, 'utf-8'))) {
        // R2 round-2 finding: existence is not identity. A `judgment_ladder.ts`
        // gutted to `export const NOTE = "moved"` passed the existence check,
        // so `rm` was caught and hollowing-out was not.
        violations.push({
            file: SANCTIONED_RESOLVER,
            kind: 'resolver-is-not-a-resolver',
            detail:
                'the sanctioned path exists but declares no resolver. Presence is not ' +
                'identity: a file gutted to a stub satisfies `existsSync` while the ' +
                'invariant it anchors has quietly moved somewhere unscanned.',
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
