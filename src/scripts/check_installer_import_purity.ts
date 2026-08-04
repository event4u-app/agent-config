#!/usr/bin/env tsx
/**
 * Guard against a maintainer-only CLI being bundled into the consumer installer.
 *
 * ## The incident this exists to prevent (road-to-consistent-rule-scoping, 2026-07-31)
 *
 * `src/install/rule_scope.ts` imported the rule-scoping predicate from
 * `src/scripts/condense.ts` — deliberately, so install semantics could not drift
 * from projection semantics. Correct intent. But `condense.ts` is maintainer CLI
 * tooling that ends in a module-level self-invoke:
 *
 *     const isMain = _isCliEntry();
 *     if (isMain) { process.exit(main()); }
 *
 * `_isCliEntry()` compares `import.meta.url` against `process.argv[1]`. That is
 * right for a file run directly — and wrong once esbuild BUNDLES the module,
 * because `import.meta.url` then resolves to the BUNDLE's own URL, which *is*
 * `argv[1]` when a consumer runs `node dist/install/install.mjs`. The guard
 * fired inside the installer, `condense.main()` ran, found no maintainer source
 * tree in a consumer checkout, printed "No source directory found" and called
 * `process.exit(1)` — killing the install AFTER the payload had already synced.
 *
 * All four `smoke-public-install` legs went red. Nothing caught it earlier:
 * `prepack-check` verifies that imports resolve to SHIPPED paths (they did),
 * the bundle-freshness gate only byte-diffs the rebuilt output, and the
 * behavioural smoke test only runs post-push in its own workflow.
 *
 * ## What this checks
 *
 * The transitive relative-import closure of the installer bundle entry must
 * contain NO module-level `process.exit(` outside the entry itself.
 *
 * "Module-level" is decided structurally, not textually: the AST walk descends
 * through top-level statements and nested blocks/ifs/try but STOPS at any
 * function, method, class, arrow or accessor body. So
 * `function main() { process.exit(1) }` is fine — it only runs when called —
 * while `if (isMain) { process.exit(main()) }` is not, because importing the
 * module runs it.
 *
 * The entry module is exempt: it IS the CLI, and its own exit is the point.
 *
 * ## Why this shape and not the alternatives
 *
 * - **Not a string scan of the built bundle.** That reports a mystery literal
 *   with no cause. This reports the import CHAIN
 *   (`install.ts → rule_scope.ts → condense.ts`), which is the actionable fact.
 * - **Not "forbid importing condense.ts".** A denylist of one file rots the
 *   moment a second CLI module grows an entry guard. The hazard is the
 *   module-level exit, so that is what is detected.
 * - **Runs on SOURCE, so it needs no build.** It fails in `task ci` before a
 *   push instead of on four CI legs after one.
 *
 * Exit 0 clean, 1 on any finding. No network, no build, no spend.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

import { assertWatchlistResolves, DeadScopeError } from './_lib/scan_scope.js';

const _HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(_HERE, '..', '..');

/**
 * Bundle entry points that ship to consumers as a single file.
 *
 * Keep in sync with the `build:*bundle` scripts in package.json. Each entry is
 * exempt from the check for its own module-level exit — it is the CLI.
 */
const BUNDLE_ENTRIES: readonly string[] = [
    'src/scripts/install.ts', // → dist/install/install.mjs (build:install-bundle)
];

interface Finding {
    /** The offending module, repo-relative POSIX. */
    readonly module: string;
    /** 1-indexed line of the offending call. */
    readonly line: number;
    /** How the entry reaches it, entry first. */
    readonly chain: readonly string[];
}

function toPosix(p: string): string {
    return p.split(path.sep).join('/');
}

function relToRepo(abs: string, root: string = REPO_ROOT): string {
    return toPosix(path.relative(root, abs));
}

/**
 * Resolve a relative import specifier to a source file on disk.
 *
 * The codebase imports with `.js` extensions (NodeNext) while the sources are
 * `.ts`, so try the TypeScript twin first, then the literal path, then an
 * `index` file. Returns `null` for anything unresolvable — a bare package
 * specifier, a type-only path that no longer exists, or a `.json` asset.
 */
function resolveImport(fromFile: string, specifier: string): string | null {
    if (!specifier.startsWith('.')) return null;
    const base = path.resolve(path.dirname(fromFile), specifier);
    const candidates = [
        base.replace(/\.js$/, '.ts'),
        base.replace(/\.js$/, '.tsx'),
        base,
        `${base}.ts`,
        path.join(base, 'index.ts'),
    ];
    for (const c of candidates) {
        try {
            if (fs.statSync(c).isFile()) return c;
        } catch {
            // next candidate
        }
    }
    return null;
}

/** Relative import specifiers declared by `source`, in source order. */
function importSpecifiers(source: ts.SourceFile): string[] {
    const out: string[] = [];
    const visit = (node: ts.Node): void => {
        if (
            (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
            node.moduleSpecifier !== undefined &&
            ts.isStringLiteral(node.moduleSpecifier)
        ) {
            out.push(node.moduleSpecifier.text);
        } else if (
            ts.isCallExpression(node) &&
            node.expression.kind === ts.SyntaxKind.ImportKeyword &&
            node.arguments.length > 0 &&
            ts.isStringLiteral(node.arguments[0] as ts.Node)
        ) {
            // A dynamic import() is still bundled by esbuild unless code-split,
            // so it carries the same hazard as a static one.
            out.push((node.arguments[0] as ts.StringLiteral).text);
        }
        ts.forEachChild(node, visit);
    };
    ts.forEachChild(source, visit);
    return out;
}

/** True for nodes whose body only runs when called — the walk stops here. */
function isDeferredScope(node: ts.Node): boolean {
    return (
        ts.isFunctionDeclaration(node) ||
        ts.isFunctionExpression(node) ||
        ts.isArrowFunction(node) ||
        ts.isMethodDeclaration(node) ||
        ts.isConstructorDeclaration(node) ||
        ts.isGetAccessorDeclaration(node) ||
        ts.isSetAccessorDeclaration(node) ||
        ts.isClassDeclaration(node) ||
        ts.isClassExpression(node)
    );
}

/** Is `node` a `process.exit(...)` call? */
function isProcessExitCall(node: ts.Node): boolean {
    if (!ts.isCallExpression(node)) return false;
    const callee = node.expression;
    if (!ts.isPropertyAccessExpression(callee)) return false;
    return (
        ts.isIdentifier(callee.expression) &&
        callee.expression.text === 'process' &&
        callee.name.text === 'exit'
    );
}

/**
 * 1-indexed lines of every `process.exit(` that executes at MODULE LOAD.
 *
 * Descends through statement-level structure (blocks, if/else, try/catch/finally,
 * loops, labels) and stops at any deferred scope, so a call inside a function is
 * not reported while one inside a top-level `if` is.
 */
function moduleLevelExitLines(source: ts.SourceFile): number[] {
    const lines: number[] = [];
    const visit = (node: ts.Node): void => {
        if (isDeferredScope(node)) return;
        if (isProcessExitCall(node)) {
            lines.push(source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1);
        }
        ts.forEachChild(node, visit);
    };
    ts.forEachChild(source, visit);
    return lines;
}

function parse(file: string): ts.SourceFile | null {
    let text: string;
    try {
        text = fs.readFileSync(file, 'utf-8');
    } catch {
        return null;
    }
    return ts.createSourceFile(file, text, ts.ScriptTarget.ESNext, true);
}

/**
 * Walk one entry's closure; return every module-level exit found below it.
 *
 * `root` defaults to the repo; tests pass a fixture tree so the chain-reporting
 * itself is covered, not only the per-file detector.
 */
function auditEntry(entryRel: string, root: string = REPO_ROOT): Finding[] {
    const entryAbs = path.join(root, entryRel);
    const findings: Finding[] = [];
    const seen = new Set<string>([entryAbs]);
    // BFS so the reported chain is a shortest path — the least confusing one.
    const queue: Array<{ file: string; chain: string[] }> = [
        { file: entryAbs, chain: [entryRel] },
    ];
    while (queue.length > 0) {
        const { file, chain } = queue.shift() as { file: string; chain: string[] };
        const source = parse(file);
        if (source === null) continue;

        // The entry is the CLI; its own module-level exit is intended.
        if (file !== entryAbs) {
            for (const line of moduleLevelExitLines(source)) {
                findings.push({ module: relToRepo(file, root), line, chain });
            }
        }

        for (const spec of importSpecifiers(source)) {
            const target = resolveImport(file, spec);
            if (target === null || seen.has(target)) continue;
            seen.add(target);
            queue.push({ file: target, chain: [...chain, relToRepo(target, root)] });
        }
    }
    return findings;
}

function main(): number {
    // BUNDLE_ENTRIES is the whole scan scope — every module examined is reached
    // from one of them. This REPLACES the per-entry existence guard in
    // `auditEntry`, which could not fail: it set `process.exitCode = 1` and
    // returned no findings, and `process.exit(main())` then overwrote that with
    // main's 0, so a moved entry printed "✅ … reach no module-level
    // process.exit()". 1 is the only failure code this gate has.
    try {
        assertWatchlistResolves({
            gate: 'check_installer_import_purity',
            candidates: BUNDLE_ENTRIES,
            repoRoot: REPO_ROOT,
        });
    } catch (err) {
        if (err instanceof DeadScopeError) {
            process.stderr.write(`❌  ${err.message}\n`);
            return 1;
        }
        throw err;
    }

    const all: Finding[] = [];
    for (const entry of BUNDLE_ENTRIES) {
        all.push(...auditEntry(entry));
    }
    if (all.length === 0) {
        process.stdout.write(
            `✅  installer import purity: ${BUNDLE_ENTRIES.length} bundle entr` +
                `${BUNDLE_ENTRIES.length === 1 ? 'y' : 'ies'} reach no module-level ` +
                'process.exit()\n',
        );
        return 0;
    }
    process.stdout.write('❌  installer import purity — module-level process.exit() reachable:\n');
    for (const f of all) {
        process.stdout.write(`\n    ${f.module}:${f.line}\n`);
        process.stdout.write(`      reached via: ${f.chain.join(' → ')}\n`);
    }
    process.stdout.write(
        '\n  Why this fails the build: esbuild bundles the whole closure into\n' +
            '  dist/install/install.mjs. A module-level process.exit() then runs when a\n' +
            '  CONSUMER loads the installer — and a CLI entry guard comparing\n' +
            '  import.meta.url to process.argv[1] evaluates TRUE inside a bundle, because\n' +
            '  the bundle IS argv[1].\n\n' +
            '  Fix: move the code the installer actually needs into a module with no CLI\n' +
            '  entry and no top-level exit, and let the CLI re-export it. Do NOT relax\n' +
            '  this gate — the failure it prevents kills a consumer install after the\n' +
            '  payload has already been written.\n',
    );
    return 1;
}

const _isCliEntry = (): boolean => {
    if (process.argv[1] === undefined) return false;
    try {
        return (
            fs.realpathSync(fileURLToPath(import.meta.url)) ===
            fs.realpathSync(path.resolve(process.argv[1]))
        );
    } catch {
        return false;
    }
};

if (_isCliEntry()) {
    process.exit(main());
}

export { auditEntry, moduleLevelExitLines, BUNDLE_ENTRIES };
