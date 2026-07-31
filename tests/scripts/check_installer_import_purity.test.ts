/**
 * The installer-import-purity gate — bite-tested in both directions.
 *
 * A gate that cannot go red proves nothing, so the load-bearing case here is
 * the POSITIVE one: a module-level `process.exit()` reachable from the bundle
 * entry must be reported, with its import chain. The real incident it encodes
 * is `install.ts → rule_scope.ts → condense.ts` (2026-07-31).
 */

import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import {
    BUNDLE_ENTRIES,
    auditEntry,
    moduleLevelExitLines,
} from '../../src/scripts/check_installer_import_purity.js';
import ts from 'typescript';

function parse(text: string): ts.SourceFile {
    return ts.createSourceFile('probe.ts', text, ts.ScriptTarget.ESNext, true);
}

describe('moduleLevelExitLines — what counts as "runs on import"', () => {
    it('reports a bare top-level exit', () => {
        expect(moduleLevelExitLines(parse('process.exit(1);\n'))).toEqual([1]);
    });

    it('reports the real incident shape — a guarded top-level exit', () => {
        const src = ['const isMain = check();', 'if (isMain) {', '  process.exit(main());', '}'].join(
            '\n',
        );
        expect(moduleLevelExitLines(parse(src))).toEqual([3]);
    });

    it('reports an exit inside a top-level try/catch', () => {
        const src = ['try {', '  process.exit(0);', '} catch {}'].join('\n');
        expect(moduleLevelExitLines(parse(src))).toEqual([2]);
    });

    it('does NOT report an exit inside a function — it only runs when called', () => {
        const src = ['function main() {', '  process.exit(1);', '}', 'export { main };'].join('\n');
        expect(moduleLevelExitLines(parse(src))).toEqual([]);
    });

    it('does NOT report an exit inside an arrow, method, or class body', () => {
        for (const src of [
            'const f = () => { process.exit(1); };',
            'class C { m() { process.exit(1); } }',
            'const o = { m() { process.exit(1); } };',
        ]) {
            expect(moduleLevelExitLines(parse(src)), src).toEqual([]);
        }
    });

    it('does not confuse a same-named method on another object', () => {
        expect(moduleLevelExitLines(parse('logger.exit(1);\nthing.process.exit(2);\n'))).toEqual([]);
    });

    it('reports every occurrence, not just the first', () => {
        expect(moduleLevelExitLines(parse('process.exit(1);\nprocess.exit(2);\n'))).toEqual([1, 2]);
    });
});

describe('auditEntry — the real tree', () => {
    it('declares at least one bundle entry, and it exists', () => {
        expect(BUNDLE_ENTRIES.length).toBeGreaterThan(0);
        for (const rel of BUNDLE_ENTRIES) {
            expect(fs.existsSync(path.join(process.cwd(), rel)), rel).toBe(true);
        }
    });

    it('is clean on the shipped tree', () => {
        for (const rel of BUNDLE_ENTRIES) {
            expect(auditEntry(rel), rel).toEqual([]);
        }
    });
});

describe('auditEntry — goes red on the incident, with the chain', () => {
    /**
     * A miniature of the real closure: entry → helper → cli, where `cli` ends
     * in a guarded module-level exit exactly as `condense.ts` does.
     */
    function fixtureTree(root: string): void {
        fs.mkdirSync(path.join(root, 'src', 'scripts'), { recursive: true });
        fs.mkdirSync(path.join(root, 'src', 'install'), { recursive: true });
        fs.writeFileSync(
            path.join(root, 'src', 'scripts', 'entry.ts'),
            "import { predicate } from '../install/helper.js';\nexport const x = predicate();\nprocess.exit(0);\n",
        );
        fs.writeFileSync(
            path.join(root, 'src', 'install', 'helper.ts'),
            "import { decide } from '../scripts/cli.js';\nexport const predicate = () => decide();\n",
        );
        fs.writeFileSync(
            path.join(root, 'src', 'scripts', 'cli.ts'),
            [
                'export function decide(): boolean { return true; }',
                'export function main(): number { return 1; }',
                'const isMain = true;',
                'if (isMain) {',
                '  process.exit(main());',
                '}',
            ].join('\n'),
        );
    }

    it('reports the offending module, its line, and the shortest import chain', () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'import-purity-'));
        try {
            fixtureTree(root);
            const findings = auditEntry('src/scripts/entry.ts', root);

            expect(findings).toHaveLength(1);
            const [f] = findings as [(typeof findings)[number]];
            expect(f.module).toBe('src/scripts/cli.ts');
            expect(f.line).toBe(5);
            // The chain is the gate's whole advantage over scanning the built
            // bundle for a string: it names HOW the installer reaches the CLI.
            expect(f.chain).toEqual([
                'src/scripts/entry.ts',
                'src/install/helper.ts',
                'src/scripts/cli.ts',
            ]);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    it("does not report the entry's OWN top-level exit — it is the CLI", () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'import-purity-'));
        try {
            fixtureTree(root);
            // entry.ts has `process.exit(0)` at line 3; only cli.ts is reported.
            const modules = auditEntry('src/scripts/entry.ts', root).map((f) => f.module);
            expect(modules).not.toContain('src/scripts/entry.ts');
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    it('is clean once the CLI is no longer reachable from the entry', () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'import-purity-'));
        try {
            fixtureTree(root);
            // The real fix: the helper stops importing the CLI module.
            fs.writeFileSync(
                path.join(root, 'src', 'install', 'helper.ts'),
                'export const predicate = () => true;\n',
            );
            expect(auditEntry('src/scripts/entry.ts', root)).toEqual([]);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    it('the guard the incident turned on is detected in its exact shipped form', () => {
        // Verbatim tail shape of src/scripts/condense.ts at the time of the
        // incident — if this stops being detected, the gate has lost its teeth.
        const shipped = [
            'const isMain =',
            '    _isCliEntry();',
            '',
            'if (isMain) {',
            '    process.exit(main());',
            '}',
        ].join('\n');
        expect(moduleLevelExitLines(parse(shipped))).toEqual([5]);
    });
});
