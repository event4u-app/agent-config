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
 * belong.
 *
 * **That sentence used to end "and the entire defect class above is gone rather
 * than relocated", and round 5 showed it was false by one line.** Round 4
 * widened WHICH files are read to include `.tsx` without widening HOW they are
 * parsed — every file was handed over as non-JSX TypeScript — so a `.tsx`
 * module's JSX text tokenized as ordinary TS and rounds 2 and 3's defect
 * classes were both live again inside the repair that added the extension. The
 * script kind is now derived from the extension. For that class the claim is
 * true; the limits below are what remains, and they are limits rather than
 * defects.
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
 *
 * **Known limits, recorded by R2 round 5 and deliberately NOT repaired**, because
 * each repair moved the review scope and forced another round; the loop was
 * terminated on the one blocking finding. All are measured, none is a hole a
 * second resolver reaches by accident:
 *
 * 1. A **dotted** namespace (`namespace A.B { … }`) nests a `ModuleDeclaration`
 *    where the block form nests a `ModuleBlock`, so its body is unwalked while
 *    the block form is covered.
 * 2. {@link exportsRouterFunction} never received the namespace walk
 *    {@link exportedNames} got, so the two disagree on a router declared inside
 *    a namespace in the sanctioned file.
 * 3. `export declare function classifyLadder(…)` — an AMBIENT declaration with
 *    no body — is accepted as a callable resolver.
 * 4. A namespace the module does not export has its members counted as module
 *    exports, so a non-exported `namespace Internal { export class … }` reports
 *    `second-resolver`. A false positive.
 * 5. A **symlinked directory** is invisible (`isDirectory()` is false for a
 *    symlink), and a UTF-16 file is counted in `scanned` while being read as
 *    mojibake. Both are silent-green.
 *
 * Limits 1-4 are syntactic and repairable; 5 is discovery. They are written
 * here rather than in a helper's docstring because a buried caveat is not a
 * disclosure. */
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

/** The single sanctioned task-side resolver, repo-relative. */
export const SANCTIONED_RESOLVER = path.join('src', 'scripts', '_lib', 'judgment_ladder.ts');

/** The council's own internal surface. The resolver does not import from it. */
export const COUNCIL_INTERNAL_DIR = path.join('src', 'scripts', 'ai_council');

/** Root walked by {@link checkOneResolver}, repo-relative. */
export const SCAN_ROOT = 'src';

/**
 * Module file extensions walked. R2 round-4 finding: `.ts` alone left the
 * tree's 28 `.tsx` modules invisible, and the gap was MASKED — `src/ui/`
 * contributes `.ts` paths to `scanned`, so the directory looked covered while
 * two thirds of its modules were never read. The anti-vacuity discriminator
 * cannot see a per-extension gap, which is the third time in four rounds that
 * a blind spot hid behind a non-empty `scanned`.
 */
const SCANNED_EXTS = ['.ts', '.tsx', '.mts', '.cts'] as const;
const TEST_SUFFIXES = ['.test.ts', '.test.tsx', '.test.mts', '.test.cts'] as const;

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

/**
 * Parse one module.
 *
 * `fileName` is not cosmetic. R2 round-5 finding, and it is the sharpest of the
 * five rounds: the previous version hard-coded `'probe.ts'` and
 * `ts.ScriptKind.TS` for EVERY file, while round 4 had just widened
 * {@link SCANNED_EXTS} to admit `.tsx`. A `.tsx` module was therefore parsed as
 * non-JSX TypeScript, so JSX text tokenized as ordinary TS — resurrecting the
 * two defect classes that killed rounds 2 and 3, inside the repair that
 * introduced the extension. The script kind is now derived from the extension,
 * so the parser is told what it is reading.
 */
function parse(text: string, fileName = 'probe.ts'): ts.SourceFile {
    const kind = fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    return ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, kind);
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
export function exportedNames(text: string, fileName?: string): string[] {
    const names: string[] = [];
    collect(parse(text, fileName).statements, names);
    return names;
}

function collect(statements: readonly ts.Statement[], names: string[]): void {
    for (const st of statements) {
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
        }
        // R2 round-4 finding: a namespace's own name was read and its BODY was
        // not, so `export namespace Dispatch { export class CouncilTopologyRouter {} }`
        // was invisible while the enclosing form was caught. The visitor listed
        // `isModuleDeclaration` and only half-honoured it, which is worse than
        // omitting it — a reader sees the kind in the list and assumes cover.
        if (ts.isModuleDeclaration(st) && st.body && ts.isModuleBlock(st.body)) {
            collect(st.body.statements, names);
            continue;
        }
        if (ts.isModuleDeclaration(st)) continue;
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
export function exportsRouterFunction(text: string, fileName?: string): boolean {
    const sf = parse(text, fileName);
    const named = (n: string): boolean => ROUTER_NAMES.some((re) => re.test(n));

    /** Peel `(x)`, `x as T`, `x satisfies T`, `x!` — none of them changes the value. */
    const unwrap = (e: ts.Expression): ts.Expression => {
        let cur = e;
        for (;;) {
            if (ts.isParenthesizedExpression(cur) || ts.isAsExpression(cur) || ts.isNonNullExpression(cur)) {
                cur = cur.expression;
            } else if (ts.isSatisfiesExpression(cur)) {
                cur = cur.expression;
            } else {
                return cur;
            }
        }
    };
    const callableExpr = (e: ts.Expression | undefined): boolean => {
        if (e === undefined) return false;
        const inner = unwrap(e);
        return ts.isArrowFunction(inner) || ts.isFunctionExpression(inner) || ts.isClassExpression(inner);
    };

    // Local declarations, so an export STATEMENT can be resolved to what it
    // actually exports. R2 round-4 finding: the previous version recognised a
    // router only when declared INLINE, so `function classifyLadder() {}` +
    // `export { classifyLadder }` — and `export default classifyLadder`, and an
    // `as`- or `satisfies`-wrapped arrow — were all reported as
    // `resolver-is-not-a-resolver` on the sanctioned file, with a diagnostic
    // asserting the resolver had "gone somewhere this guard does not look"
    // while the function sat two lines above. `exportedNames` already accepted
    // those exact forms, so one syntax counted as "declares a router" for every
    // other file and as "is not a resolver" for this one.
    const localCallable = new Map<string, boolean>();
    for (const st of sf.statements) {
        if (ts.isFunctionDeclaration(st) && st.name) localCallable.set(st.name.text, true);
        else if (ts.isClassDeclaration(st) && st.name) localCallable.set(st.name.text, true);
        else if (ts.isVariableStatement(st)) {
            for (const d of st.declarationList.declarations) {
                if (ts.isIdentifier(d.name)) localCallable.set(d.name.text, callableExpr(d.initializer));
            }
        }
    }
    const resolves = (local: string): boolean => localCallable.get(local) === true;

    for (const st of sf.statements) {
        // Inline: `export function X`, `export class X`, `export const X = () => …`
        if (ts.isFunctionDeclaration(st) && hasExportModifier(st) && st.name && named(st.name.text)) return true;
        if (ts.isClassDeclaration(st) && hasExportModifier(st) && st.name && named(st.name.text)) return true;
        if (ts.isVariableStatement(st) && hasExportModifier(st)) {
            for (const d of st.declarationList.declarations) {
                if (ts.isIdentifier(d.name) && named(d.name.text) && callableExpr(d.initializer)) return true;
            }
        }
        // `export default X` / `export default function X() {}`
        if (ts.isExportAssignment(st) && !st.isExportEquals) {
            const e = unwrap(st.expression);
            if (ts.isIdentifier(e) && named(e.text) && resolves(e.text)) return true;
            if (ts.isFunctionExpression(e) && e.name && named(e.name.text)) return true;
            if (ts.isClassExpression(e) && e.name && named(e.name.text)) return true;
        }
        // `export { X }` / `export { local as X }` — LOCAL only. A re-export
        // carrying a module specifier resolves to another file and is still
        // refused, which is what R2 round 3 asked for.
        if (ts.isExportDeclaration(st) && st.moduleSpecifier === undefined) {
            const clause = st.exportClause;
            if (clause !== undefined && ts.isNamedExports(clause)) {
                for (const el of clause.elements) {
                    if (!named(el.name.text)) continue;
                    if (resolves((el.propertyName ?? el.name).text)) return true;
                }
            }
        }
    }
    return false;
}

/** Does this file declare a task-side council/dispatch router? */
export function declaresRouter(text: string, fileName?: string): boolean {
    return exportedNames(text, fileName).some((n) => ROUTER_NAMES.some((re) => re.test(n)));
}

/**
 * Every module specifier this file names — static import (side-effect included),
 * re-export, dynamic `import()`, and `require()`. String and
 * no-substitution-template specifiers both count; a specifier built by
 * interpolation is outside the frozen claim and is not guessed at.
 */
export function moduleSpecifiers(text: string, fileName?: string): string[] {
    const sf = parse(text, fileName);
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
export function importsCouncilInternal(text: string, fileName?: string): boolean {
    return moduleSpecifiers(text, fileName).some((spec) => /(?:^|\/)ai_council(?:\/|$)/.test(spec));
}

/** Walk `.ts` files under a directory, skipping tests and build output. */
function walk(dir: string, out: string[] = []): string[] {
    if (!fs.existsSync(dir)) return out;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (SKIP_DIRS.has(entry.name)) continue;
            walk(p, out);
        } else if (SCANNED_EXTS.some((e) => entry.name.endsWith(e)) && !TEST_SUFFIXES.some((t) => entry.name.endsWith(t))) {
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
    } else if (!exportsRouterFunction(fs.readFileSync(resolverAbs, 'utf-8'), SANCTIONED_RESOLVER)) {
        // R2 round-2 finding: existence is not identity. A `judgment_ladder.ts`
        // gutted to `export const NOTE = "moved"` passed the existence check,
        // so `rm` was caught and hollowing-out was not.
        violations.push({
            file: SANCTIONED_RESOLVER,
            kind: 'resolver-is-not-a-resolver',
            detail:
                'the sanctioned path exists but exports no CALLABLE binding whose name ' +
                'matches a router pattern. Presence is not identity and neither is the name: ' +
                'a stub such as `export const classifyLadder = \"moved\"` keeps both. If the ' +
                'resolver was RENAMED rather than gutted, update ROUTER_NAMES in the same ' +
                'change — this check reports the name it can see, not a conclusion about ' +
                'where the resolver went.',
        });
    }

    for (const abs of walk(path.join(root, SCAN_ROOT))) {
        const rel = path.relative(root, abs);
        // The council's own internals are not task-side and are out of scope.
        if (rel.startsWith(COUNCIL_INTERNAL_DIR + path.sep)) continue;
        scanned.push(rel);
        const text = fs.readFileSync(abs, 'utf-8');
        if (rel !== SANCTIONED_RESOLVER && declaresRouter(text, rel)) {
            violations.push({
                file: rel,
                kind: 'second-resolver',
                detail:
                    `declares a task-side council/dispatch router beside ` +
                    `${SANCTIONED_RESOLVER}. There is exactly one task-side resolver; ` +
                    `a second one makes routing depend on which classifier ran first.`,
            });
        }
        if (rel === SANCTIONED_RESOLVER && importsCouncilInternal(text, rel)) {
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
