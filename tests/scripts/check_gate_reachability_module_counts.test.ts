/**
 * road-to-modules-that-something-calls.md step 3.1.
 *
 * verify: this file.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { main, moduleReachLine, moduleReachSummary } from '../../src/scripts/check_gate_reachability.js';

const REPO = process.cwd();

describe('the five module-reach numbers, beside this gate\'s own verdicts', () => {
    it('moduleReachSummary agrees with module_reach.ts on the real tree', async () => {
        const { analyseModuleReach, groupCounts } = await import('../../src/scripts/_lib/module_reach.js');
        const { modules } = analyseModuleReach(REPO);
        const unreferenced = modules.filter((m) => !m.namedByProduction);
        const s = moduleReachSummary(REPO);
        expect(s.unreferencedTotal).toBe(unreferenced.length);
        expect(s.groups).toEqual(groupCounts(unreferenced));
        expect(s.reachedByNothing).toBe(modules.filter((m) => !m.reachedByImportOrPath).length);
    });

    it('unreferencedTotal is a cross-check, not one of the five — it is not printed', () => {
        const s = moduleReachSummary(REPO);
        const sum = Object.values(s.groups).reduce((a, b) => a + b, 0);
        expect(s.unreferencedTotal).toBe(sum);
        expect(moduleReachLine(s)).not.toContain('unreferencedTotal');
    });

    it('the printed line is marked reported, not gated, and names all five numbers', () => {
        const s = moduleReachSummary(REPO);
        const line = moduleReachLine(s);
        expect(line).toContain('reported, not gated');
        expect(line).toContain(`contract-test ${String(s.groups['contract-test'])}`);
        expect(line).toContain(`open-or-deferred-step ${String(s.groups['open-or-deferred-step'])}`);
        expect(line).toContain(`named-outside-open-step ${String(s.groups['named-outside-open-step'])}`);
        expect(line).toContain(`named-in-none ${String(s.groups['named-in-none'])}`);
        expect(line).toContain(`REACHED-BY-NOTHING total ${String(s.reachedByNothing)}`);
    });

    it('appears on the default invocation', () => {
        const chunks: string[] = [];
        const orig = process.stdout.write.bind(process.stdout);
        process.stdout.write = ((chunk: string) => {
            chunks.push(chunk);
            return true;
        }) as typeof process.stdout.write;
        try {
            expect(main([], REPO)).toBe(0);
        } finally {
            process.stdout.write = orig;
        }
        expect(chunks.join('')).toContain('module reach (reported, not gated)');
    });

    it('appears under --gate, on both the clean and the failing path', () => {
        const capture = (argv: string[]): { exit: number; out: string } => {
            const chunks: string[] = [];
            const origOut = process.stdout.write.bind(process.stdout);
            const origErr = process.stderr.write.bind(process.stderr);
            process.stdout.write = ((c: string) => {
                chunks.push(c);
                return true;
            }) as typeof process.stdout.write;
            process.stderr.write = ((c: string) => {
                chunks.push(c);
                return true;
            }) as typeof process.stderr.write;
            try {
                return { exit: main(argv, REPO), out: chunks.join('') };
            } finally {
                process.stdout.write = origOut;
                process.stderr.write = origErr;
            }
        };
        const clean = capture(['--gate']);
        expect(clean.out).toContain('module reach (reported, not gated)');
    });

    it('is present in --json output', () => {
        const chunks: string[] = [];
        const orig = process.stdout.write.bind(process.stdout);
        process.stdout.write = ((c: string) => {
            chunks.push(c);
            return true;
        }) as typeof process.stdout.write;
        try {
            expect(main(['--json'], REPO)).toBe(0);
        } finally {
            process.stdout.write = orig;
        }
        const parsed = JSON.parse(chunks.join('')) as { moduleReach?: unknown };
        expect(parsed.moduleReach).toBeDefined();
    });
});

describe('a fixture module moves the reported counts, enforcing nothing', () => {
    const roots: string[] = [];
    afterEach(() => {
        while (roots.length > 0) fs.rmSync(roots.pop() as string, { recursive: true, force: true });
    });

    function fixtureRoot(): string {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gr-module-counts-'));
        roots.push(dir);
        fs.mkdirSync(path.join(dir, 'src', 'scripts', '_lib'), { recursive: true });
        fs.writeFileSync(
            path.join(dir, 'Taskfile.yml'),
            ['tasks:', '  ci:', '    cmds:', '      -'].join('\n'),
            'utf-8',
        );
        return dir;
    }

    it('a module with a test and no consumer changes the fourth group and the reached-by-nothing total', () => {
        const dir = fixtureRoot();
        const before = moduleReachSummary(dir);
        fs.writeFileSync(path.join(dir, 'src', 'scripts', '_lib', 'orphan_fixture.ts'), 'export const a = 1;\n', 'utf-8');
        const after = moduleReachSummary(dir);

        expect(after.groups['named-in-none']).toBe(before.groups['named-in-none'] + 1);
        expect(after.reachedByNothing).toBe(before.reachedByNothing + 1);
    });

    it('a module a comment mentions changes the reached-by-nothing total ONLY — never the fourth group', () => {
        const dir = fixtureRoot();
        const before = moduleReachSummary(dir);
        fs.writeFileSync(path.join(dir, 'src', 'scripts', '_lib', 'mentioned_fixture.ts'), 'export const a = 1;\n', 'utf-8');
        // Named by production (the generous reading) via a file under `src/`,
        // but the mention is prose, not an import edge — it never reaches
        // anything by path either.
        fs.writeFileSync(path.join(dir, 'src', 'other.ts'), '// see _lib/mentioned_fixture.ts for context\n', 'utf-8');
        const after = moduleReachSummary(dir);

        expect(after.reachedByNothing).toBe(before.reachedByNothing + 1);
        expect(after.groups['named-in-none']).toBe(before.groups['named-in-none']);
        expect(after.unreferencedTotal).toBe(before.unreferencedTotal);
    });
});
