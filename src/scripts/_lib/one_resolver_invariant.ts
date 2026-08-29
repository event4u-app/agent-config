/**
 * The one-resolver invariant, made checkable.
 *
 * `judgment_ladder.ts` is the ONE task-side resolver that decides which
 * dispatch rung a task takes, council included. Its own module docstring says
 * so, and says two further things that were equally unenforced: that no fourth
 * parallel classifier may be "bolted on beside it", and that it is
 * "deliberately independent of `ai_council/necessity.ts`", the council's OWN
 * council-internal necessity gate.
 *
 * All three were prose. A docstring cannot fail, so a second task-side council
 * router could land beside the ladder and every gate in this tree would stay
 * green — which is what
 * `road-to-inbox-harvest-2026-08-e-council-topology-evidence` step 0.5 asks to
 * be closed: "lock the one-resolver invariant in documentation AND in a test".
 *
 * ## This file PARSES. It does not lex. That is the whole point.
 *
 * Three successive R2 review rounds killed three successive text-scanning
 * implementations, each defect introduced by the repair for the last:
 *
 * | Round | Approach | What a fresh reviewer measured |
 * |---|---|---|
 * | 1 | no comment/string handling | false POSITIVE: a router name in a comment or string counted as a declaration |
 * | 2 | ordered regexes, block comments first | false NEGATIVE: a line comment containing a glob opened a spurious block comment. 12 files under `src/` lost top-level exports |
 * | 3 | hand-written character scanner | false NEGATIVE, worse: a backtick inside a REGEX LITERAL read as a template opener, and templates do not end at a newline. **54 files, 231 exports lost** |
 *
 * Round 3's trigger was ordinary, not exotic: `check_portability.ts:741`
 * contains a regex with a backtick in it.
 *
 * The AI council was asked for guidance at the N=3 budget and **split** —
 * one seat for withdrawing the guard, one for parsing properly. Both seats
 * classified withdrawal and narrowing as OWNER-RESERVED and both refused
 * another hand-lexing round, so parsing is the only option a council may
 * execute. Both recorded the same principle:
 *
 * > A gate must not implement a partial lexer or parser for a language when an
 * > authoritative parser for it is already a dependency.
 *
 * and a second, which is the one that explains three rounds of near-misses:
 *
 * > A repair is tested against the violated PROPERTY and representative
 * > mutations, never against the reproducer's literal spelling.
 *
 * `typescript` is already a dependency. Comments, strings, template literals
 * and regex literals are therefore the parser's problem, which is where they
 * belong, and the entire defect class above is gone rather than relocated.
 *
 * ## The frozen claim — what this guard does and does not assert
 *
 * **Asserts, syntactically:** no module outside the sanctioned resolver
 * EXPORTS A BINDING WHOSE NAME matches a router pattern, in any export form the
 * TypeScript parser recognises; the sanctioned resolver itself exports one; and
 * the sanctioned resolver names no council-internal module in any import,
 * re-export, dynamic import or `require` specifier.
 *
 * **Does NOT assert, and no reading of it should:** anything requiring symbol
 * resolution or a module graph. A router exported under an unrelated name, or
 * reached through an alias chain this file cannot follow, is outside the claim.
 * Closing that needs semantic analysis and is a separate decision.
 */
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

/** The single sanctioned task-side resolver, repo-relative. */
export const SANCTIONED_RESOLVER = path.join('src', 'scripts', '_lib', 'judgment_ladder.ts');

/** The council's own internal surface. The resolver does not import from it. */
export const COUNCIL_INTERNAL_DIR = path.join('src', 'scripts', 'ai_council');

/** Root walked by {@link checkOneResolver}, repo-relative. */
export const SCAN_ROOT = 'src';

/** Directory names never walked. */
const SKIP_DIRS = new Set(['node_modules', '__tests__', 'dist', '.git']);

/** Names that mark an exported binding as a task-side council/dispatch ROUTER. */
export const ROUTER_NAMES: readonly RegExp[] = [
    /^\w*Council\w*Router$/,
    /^classifyLadder$/,
    /^\w*resolveCouncilRoute\w*$/,
];

export interface Violation {
    readonly file: string;
    readonly kind:
        | 'second-resolver'
        | 'council-import-in-resolver'
        | 'resolver-missing'
        | 'resolver-is-not-a-resolver';
    readonly detail: string;
}

export interface ScanResult {
    readonly violations: readonly Violation[];
    /** Every file actually read, repo-relative. Empty means the scan found nothing to look at. */
    readonly scanned: readonly string[];
}

function parse(text: string): ts.SourceFile {
    return ts.createSourceFile('probe.ts', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

function hasExportModifier(node: ts.Node): boolean {
    const mods = (node as { modifiers?: readonly ts.ModifierLike[] }).modifiers;
    return (mods ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
}

/** Every name a binding pattern introduces, so `export const { X } = mod` is seen. */
function bindingNames(name: ts.BindingName, out: string[]): void {
    if (ts.isIdentifier(name)) {
        out.push(name.text);
        return;
    }
    for (const el of name.elements) {
        if (ts.isBindingElement(el)) bindingNames(el.name, out);
    }
}

/**
 * Every identifier this module exports, by any syntax the parser recognises:
 * declarations with an `export` modifier, `export default`, named exports,
 * aliased exports, re-exports, type-only exports, and `export * as NS from`.
 */
export function exportedNames(text: string): string[] {
    const sf = parse(text);
    const names: string[] = [];
    for (const st of sf.statements) {
        if (ts.isVariableStatement(st) && hasExportModifier(st)) {
            for (const d of st.declarationList.declarations) bindingNames(d.name, names);
            continue;
        }
        if (
            (ts.isClassDeclaration(st) ||
                ts.isInterfaceDeclaration(st) ||
                ts.isTypeAliasDeclaration(st) ||
                ts.isEnumDeclaration(st) ||
                ts.isFunctionDeclaration(st) ||
                ts.isModuleDeclaration(st)) &&
            hasExportModifier(st)
        ) {
            if (st.name && ts.isIdentifier(st.name)) names.push(st.name.text);
            continue;
        }
        if (ts.isExportAssignment(st)) {
            if (ts.isIdentifier(st.expression)) names.push(st.expression.text);
            if (ts.isClassExpression(st.expression) && st.expression.name) names.push(st.expression.name.text);
            continue;
        }
        if (ts.isExportDeclaration(st)) {
            const clause = st.exportClause;
            if (clause === undefined) continue;
            if (ts.isNamespaceExport(clause)) {
                names.push(clause.name.text);
                continue;
            }
            for (const el of clause.elements) names.push(el.name.text);
        }
    }
    return names;
}

/**
 * Does this file export a router-named binding that is actually CALLABLE?
 *
 * R2 round-3 finding: the previous resolver check tested for the identifier
 * `classifyLadder` in an export position, so `export const classifyLadder =
 * "moved"` scanned green while round 2's own reproducer `export const NOTE =
 * "moved"` was caught — the two differ only in whether the stub kept the name.
 * That is repairing to the reproducer rather than to the property, which is one
 * of the two principles the council asked to be recorded.
 *
 * The property is "this file still holds a resolver", so the declaration KIND
 * is what is checked: a function, a class, or a binding initialised to one. A
 * string, a number or an object literal is a stub whatever it is called.
 *
 * Still syntactic, and deliberately so — a function that merely `return`s a
 * constant satisfies this. Closing THAT needs semantic analysis and is outside
 * the frozen claim.
 */
export function exportsRouterFunction(text: string): boolean {
    const sf = parse(text);
    const named = (n: string): boolean => ROUTER_NAMES.some((re) => re.test(n));
    const callable = (init: ts.Expression | undefined): boolean =>
        init !== undefined &&
        (ts.isArrowFunction(init) || ts.isFunctionExpression(init) || ts.isClassExpression(init));
    for (const st of sf.statements) {
        if (ts.isFunctionDeclaration(st) && hasExportModifier(st) && st.name && named(st.name.text)) return true;
        if (ts.isClassDeclaration(st) && hasExportModifier(st) && st.name && named(st.name.text)) return true;
        if (ts.isVariableStatement(st) && hasExportModifier(st)) {
            for (const d of st.declarationList.declarations) {
                if (ts.isIdentifier(d.name) && named(d.name.text) && callable(d.initializer)) return true;
            }
        }
    }
    return false;
}

/** Does this file declare a task-side council/dispatch router? */
export function declaresRouter(text: string): boolean {
    return exportedNames(text).some((n) => ROUTER_NAMES.some((re) => re.test(n)));
}

/**
 * Every module specifier this file names — static import (side-effect included),
 * re-export, dynamic `import()`, and `require()`. String and
 * no-substitution-template specifiers both count; a specifier built by
 * interpolation is outside the frozen claim and is not guessed at.
 */
export function moduleSpecifiers(text: string): string[] {
    const sf = parse(text);
    const out: string[] = [];
    const literal = (n: ts.Node | undefined): void => {
        if (n === undefined) return;
        if (ts.isStringLiteralLike(n)) out.push(n.text);
    };
    const visit = (n: ts.Node): void => {
        if (ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) literal(n.moduleSpecifier);
        else if (ts.isImportEqualsDeclaration(n) && ts.isExternalModuleReference(n.moduleReference)) {
            literal(n.moduleReference.expression);
        } else if (ts.isCallExpression(n)) {
            const isDynamic = n.expression.kind === ts.SyntaxKind.ImportKeyword;
            const isRequire = ts.isIdentifier(n.expression) && n.expression.text === 'require';
            if (isDynamic || isRequire) literal(n.arguments[0]);
        }
        ts.forEachChild(n, visit);
    };
    visit(sf);
    return out;
}

/** Does this file import from the council's internal directory? */
export function importsCouncilInternal(text: string): boolean {
    return moduleSpecifiers(text).some((spec) => /(?:^|\/)ai_council(?:\/|$)/.test(spec));
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
    } else if (!exportsRouterFunction(fs.readFileSync(resolverAbs, 'utf-8'))) {
        // R2 round-2 finding: existence is not identity. A `judgment_ladder.ts`
        // gutted to `export const NOTE = "moved"` passed the existence check,
        // so `rm` was caught and hollowing-out was not.
        violations.push({
            file: SANCTIONED_RESOLVER,
            kind: 'resolver-is-not-a-resolver',
            detail:
                'the sanctioned path exists but exports no CALLABLE router-named binding. ' +
                'Presence is not identity, and neither is the name: a stub such as ' +
                '`export const classifyLadder = \"moved\"` keeps both while the resolver ' +
                'it anchors has gone somewhere this guard does not look.',
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
