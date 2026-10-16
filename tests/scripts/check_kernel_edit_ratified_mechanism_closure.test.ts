import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as gate from '../../src/scripts/check_kernel_edit_ratified.js';
import {
    classifyPaths,
    MECHANISM_IMPORT_PATHS,
    READER_PATH,
    requiresRatification,
    SELF_PATH,
} from '../../src/scripts/check_kernel_edit_ratified.js';
import { gatedFilesOf } from '../../src/scripts/_lib/ratification_subject.js';
import { commitAll } from './ratification_git_fixture.js';

/**
 * The gate's verdict runs through the modules it imports: the record parser,
 * the ledger and the scan report. An edit to one is an edit to the gate.
 */

const IMPORTED = [
    'src/scripts/_lib/adr_frontmatter.ts',
    'src/scripts/_lib/gate_ledger.ts',
    'src/scripts/_lib/ratification_subject.ts',
    'src/scripts/_lib/scan_scope.ts',
];

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * Every module specifier `source` loads, read from the TypeScript syntax tree:
 * import and export-from declarations, `import x = require(…)`, `import(…)`
 * and `require(…)`. A load whose argument is not a string literal, or a
 * `require` used other than as a direct call, cannot be resolved and is refused —
 * a local function named `require` is refused too, which errs closed.
 */
function moduleSpecifiers(rel: string, source: string): string[] {
    const file = ts.createSourceFile(rel, source, ts.ScriptTarget.Latest, true);
    const out: string[] = [];
    const visit = (node: ts.Node): void => {
        if (
            (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
            node.moduleSpecifier !== undefined &&
            ts.isStringLiteral(node.moduleSpecifier)
        ) {
            out.push(node.moduleSpecifier.text);
        } else if (
            ts.isImportEqualsDeclaration(node) &&
            ts.isExternalModuleReference(node.moduleReference)
        ) {
            const ref = node.moduleReference.expression;
            expect(ts.isStringLiteralLike(ref), `${rel}: unresolvable import-equals`).toBe(true);
            out.push((ref as ts.StringLiteralLike).text);
        } else if (
            ts.isIdentifier(node) &&
            node.text === 'require' &&
            !(ts.isCallExpression(node.parent) && node.parent.expression === node)
        ) {
            expect.fail(`${rel}: \`require\` used other than as a direct call`);
        } else if (
            ts.isCallExpression(node) &&
            (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
                (ts.isIdentifier(node.expression) && node.expression.text === 'require'))
        ) {
            const arg = node.arguments[0];
            expect(arg !== undefined && ts.isStringLiteralLike(arg), `${rel}: unresolvable dynamic load`).toBe(true);
            out.push((arg as ts.StringLiteralLike).text);
        }
        ts.forEachChild(node, visit);
    };
    visit(file);
    return out;
}

/** Repo-relative paths of every repository module the gate loads, transitively. */
function gateImportClosure(): string[] {
    const seen = new Set<string>();
    const queue = [SELF_PATH];
    while (queue.length > 0) {
        const rel = queue.shift() as string;
        if (seen.has(rel)) continue;
        seen.add(rel);
        const source = fs.readFileSync(path.join(REPO, rel), 'utf8');
        for (const spec of moduleSpecifiers(rel, source)) {
            if (!spec.startsWith('.')) continue;
            const target = path.posix.normalize(
                path.posix.join(path.posix.dirname(rel), spec).replace(/\.js$/, '.ts'),
            );
            expect(fs.existsSync(path.join(REPO, target)), `${rel} imports ${spec} → ${target}`).toBe(true);
            queue.push(target);
        }
    }
    return [...seen].sort();
}

let root: string;

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'ker-mech-'));
});

afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

describe('the gate watches the modules its verdict runs through', () => {
    it('each imported module requires a ratification record', () => {
        for (const p of IMPORTED) {
            expect(MECHANISM_IMPORT_PATHS, p).toContain(p);
            expect(classifyPaths([p], []).self, p).toBe(true);
            expect(requiresRatification(classifyPaths([p], [])), p).toBe(true);
        }
    });

    it('every module the gate imports is gated and digested', () => {
        const closure = gateImportClosure();
        expect(closure).toContain(READER_PATH);
        for (const p of IMPORTED) expect(closure, p).toContain(p);
        const ungated = closure.filter((m) => !requiresRatification(classifyPaths([m], [])));
        expect(ungated).toEqual([]);
        for (const m of closure) {
            expect(gatedFilesOf([m], []), m).toEqual([m]);
        }
    });

    it('the walk sees dynamic imports and re-exports a lexical scan could hide', () => {
        const src = 'const a = "/*";\nimport("./x.js");\nconst b = "*/";\nexport * from "./y.js";\n';
        expect(moduleSpecifiers('f.ts', src)).toEqual(['./x.js', './y.js']);
        expect(moduleSpecifiers('g.ts', 'import d = require("./d.js");\n')).toEqual(['./d.js']);
        expect(() => moduleSpecifiers('h.ts', 'const r = require;\nr("./x.js");\n')).toThrow();
    });

    it.each(['src/scripts/_lib/adr_frontmatter.ts', 'src/scripts/_lib/ratification_subject.ts'])(
        'refuses an unratified edit of %s end to end',
        (rel) => {
            fs.mkdirSync(path.join(root, path.dirname(rel)), { recursive: true });
            fs.writeFileSync(path.join(root, rel), 'export const x = 1;\n');
            commitAll(root);
            const r = gate.evaluate([rel], root, 2);
            expect(r.exitCode).toBe(1);
            expect(r.lines.join('\n')).toContain('no ratification artifact');
        },
    );

    // The pin bound the calculator whatever file list a caller passed. Gated, it is
    // bound through the file list instead, so the entry point CI and pre-push call
    // must derive that list from the commits itself and never from the caller.
    it('the CLI derives the diff itself, so an edit of the calculator no caller names is refused', () => {
        const rel = 'src/scripts/_lib/ratification_subject.ts';
        fs.writeFileSync(path.join(root, 'README.md'), 'x\n');
        const base = commitAll(root);
        fs.mkdirSync(path.join(root, path.dirname(rel)), { recursive: true });
        fs.writeFileSync(path.join(root, rel), 'export const x = 1;\n');
        commitAll(root);
        expect(gate.main(['--root', root, '--base-ref', base, '--quiet'])).toBe(1);
    });

    it('the digest covers every mechanism file the gate classifies', () => {
        for (const p of [...IMPORTED, READER_PATH]) {
            expect(gatedFilesOf([p, 'README.md'], []), p).toEqual([p]);
        }
    });

    it('the writer CLIs and the contract stay ungated', () => {
        for (const p of [
            'src/scripts/ratification_subject.ts',
            'src/scripts/ratification_header.ts',
            'docs/contracts/ratification-artifact.md',
        ]) {
            expect(requiresRatification(classifyPaths([p], [])), p).toBe(false);
            expect(gatedFilesOf([p], []), p).toEqual([]);
        }
    });

    it('the ledger counts a gated mechanism file as gated, not out of scope', () => {
        fs.writeFileSync(path.join(root, 'README.md'), 'x\n');
        commitAll(root);
        for (const p of [READER_PATH, 'src/scripts/_lib/gate_ledger.ts']) {
            const r = gate.evaluate([p, 'README.md'], root, 2);
            expect(r.exitCode, p).toBe(1);
            expect(r.lines.join('\n'), p).toContain('planned 2 · completed 0 · failed 1 · out_of_scope 1');
        }
    });
});
