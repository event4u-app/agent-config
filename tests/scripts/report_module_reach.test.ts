/**
 * road-to-modules-that-something-calls.md Phase 1.1 / 1.2.
 *
 * verify: this file.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
    analyseModuleReach,
    buildImportGraph,
    computeReach,
    groupCounts,
    listLibModules,
    runByPathTargets,
} from '../../src/scripts/_lib/module_reach.js';
import { human, markdown, main } from '../../src/scripts/report_module_reach.js';

const REPO = process.cwd();

const roots: string[] = [];
afterEach(() => {
    while (roots.length > 0) fs.rmSync(roots.pop() as string, { recursive: true, force: true });
});

function fixtureRoot(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'module-reach-'));
    roots.push(dir);
    fs.mkdirSync(path.join(dir, 'src', 'scripts', '_lib'), { recursive: true });
    return dir;
}

function write(root: string, rel: string, content: string): void {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, 'utf-8');
}

describe('on the real tree', () => {
    it('is stable across two runs', () => {
        expect(JSON.stringify(analyseModuleReach(REPO))).toBe(JSON.stringify(analyseModuleReach(REPO)));
    });

    it('finds a real corpus of _lib modules', () => {
        expect(listLibModules(REPO).length).toBeGreaterThan(100);
    });

    it('every module lands in exactly one reach state and, when unreferenced, exactly one group', () => {
        const { modules } = analyseModuleReach(REPO);
        for (const m of modules) {
            expect(typeof m.reachedByImportOrPath).toBe('boolean');
            if (!m.namedByProduction) expect(m.group).not.toBeNull();
            else expect(m.group).toBeNull();
        }
    });

    it('exits 0 — this is a report, never a gate', () => {
        expect(main([], REPO)).toBe(0);
        expect(main(['--json'], REPO)).toBe(0);
        expect(main(['--markdown'], REPO)).toBe(0);
    });
});

describe('import-graph reach — direct, transitive, and the unreached-importing-unreached case', () => {
    it('a module imported directly from a top-level script is reached', () => {
        const root = fixtureRoot();
        write(root, 'src/scripts/entry.ts', "import { x } from './_lib/direct.js';\nx();\n");
        write(root, 'src/scripts/_lib/direct.ts', 'export const x = () => 1;\n');
        write(root, 'src/scripts/_lib/orphan.ts', 'export const y = () => 2;\n');
        const graph = buildImportGraph(root);
        expect(graph.get('src/scripts/entry.ts')).toContain('src/scripts/_lib/direct.ts');
        const { reached } = computeReach(root);
        expect(reached.has('src/scripts/_lib/direct.ts')).toBe(true);
        expect(reached.has('src/scripts/_lib/orphan.ts')).toBe(false);
    });

    it('a module reached only transitively through another live module is reached', () => {
        const root = fixtureRoot();
        write(root, 'src/scripts/entry.ts', "import { x } from './_lib/a.js';\nx();\n");
        write(root, 'src/scripts/_lib/a.ts', "import { y } from './b.js';\nexport const x = y;\n");
        write(root, 'src/scripts/_lib/b.ts', 'export const y = 1;\n');
        const { reached } = computeReach(root);
        expect(reached.has('src/scripts/_lib/a.ts')).toBe(true);
        expect(reached.has('src/scripts/_lib/b.ts')).toBe(true);
    });

    it('a module imported ONLY by another unreached module stays unreached', () => {
        // The exact shape the roadmap calls out: "eight that only other
        // unreached modules import" — reachability does not propagate
        // through a dead node.
        const root = fixtureRoot();
        write(root, 'src/scripts/_lib/dead_importer.ts', "import { y } from './dead_target.js';\nexport const x = y;\n");
        write(root, 'src/scripts/_lib/dead_target.ts', 'export const y = 1;\n');
        const { reached } = computeReach(root);
        expect(reached.has('src/scripts/_lib/dead_importer.ts')).toBe(false);
        expect(reached.has('src/scripts/_lib/dead_target.ts')).toBe(false);
    });

    it('a module invoked by path from the dispatcher is reached without any import edge', () => {
        const root = fixtureRoot();
        write(root, 'src/scripts/_dispatch.bash', '$TSX_BIN "$SCRIPT_DIR/_lib/run_by_path.ts" "$@"\n');
        write(root, 'src/scripts/_lib/run_by_path.ts', 'export const z = 1;\n');
        expect(runByPathTargets(root).has('src/scripts/_lib/run_by_path.ts')).toBe(true);
        const { reached } = computeReach(root);
        expect(reached.has('src/scripts/_lib/run_by_path.ts')).toBe(true);
    });

    it('a module invoked by path from a Taskfile target is reached', () => {
        const root = fixtureRoot();
        write(
            root,
            'Taskfile.yml',
            ['tasks:', '  ci:', '    cmds:', '      - ./scripts-run src/scripts/_lib/task_run.ts'].join('\n'),
        );
        write(root, 'src/scripts/_lib/task_run.ts', 'export const z = 1;\n');
        const { reached } = computeReach(root);
        expect(reached.has('src/scripts/_lib/task_run.ts')).toBe(true);
    });
});

describe('name occurrence — the generous reading', () => {
    it('a mention in a comment counts as named, even with no import', () => {
        const root = fixtureRoot();
        write(root, 'src/scripts/_lib/mentioned.ts', 'export const a = 1;\n');
        write(root, 'src/other.ts', '// see _lib/mentioned.ts for the rationale\n');
        const { modules } = analyseModuleReach(root);
        const m = modules.find((x) => x.name === 'mentioned');
        expect(m?.namedByProduction).toBe(true);
    });

    it('a mention ONLY in a test file does not count as named by production', () => {
        const root = fixtureRoot();
        write(root, 'src/scripts/_lib/only_in_test.ts', 'export const a = 1;\n');
        write(root, 'tests/scripts/_lib/only_in_test.test.ts', "import { a } from '../../../src/scripts/_lib/only_in_test.js';\n");
        const { modules } = analyseModuleReach(root);
        const m = modules.find((x) => x.name === 'only_in_test');
        expect(m?.namedByProduction).toBe(false);
        expect(m?.importingTests).toContain('tests/scripts/_lib/only_in_test.test.ts');
    });

    it('a module naming itself does not count', () => {
        const root = fixtureRoot();
        write(root, 'src/scripts/_lib/self_named.ts', '// self_named handles its own thing\nexport const a = 1;\n');
        const { modules } = analyseModuleReach(root);
        const m = modules.find((x) => x.name === 'self_named');
        expect(m?.namedByProduction).toBe(false);
    });
});

describe('the four groups, over the unreferenced-by-name set', () => {
    function unreferencedFixture(root: string, name: string): void {
        write(root, `src/scripts/_lib/${name}.ts`, 'export const a = 1;\n');
    }

    it('group 1 — imported by a test under tests/contracts/', () => {
        const root = fixtureRoot();
        unreferencedFixture(root, 'contract_carried');
        write(
            root,
            'tests/contracts/some_contract.test.ts',
            "import { a } from '../../src/scripts/_lib/contract_carried.js';\n",
        );
        const { modules } = analyseModuleReach(root);
        const m = modules.find((x) => x.name === 'contract_carried');
        expect(m?.group).toBe('contract-test');
    });

    it('group 2 — named in an OPEN step of an active roadmap', () => {
        const root = fixtureRoot();
        unreferencedFixture(root, 'waited_on');
        write(
            root,
            'agents/roadmaps/road-to-x.md',
            ['# Road to x', '', '- [ ] **1.1 Wire it.** Uses `waited_on` for the thing.'].join('\n'),
        );
        const { modules } = analyseModuleReach(root);
        const m = modules.find((x) => x.name === 'waited_on');
        expect(m?.group).toBe('open-or-deferred-step');
        expect(m?.groupEvidence).toContain('road-to-x.md');
    });

    it('group 2 — named in a DEFERRED ([~]) step counts the same as open', () => {
        const root = fixtureRoot();
        unreferencedFixture(root, 'deferred_on');
        write(
            root,
            'agents/roadmaps/road-to-y.md',
            ['# Road to y', '', '- [~] **1.1 Later.** Needs `deferred_on`.'].join('\n'),
        );
        const { modules } = analyseModuleReach(root);
        const m = modules.find((x) => x.name === 'deferred_on');
        expect(m?.group).toBe('open-or-deferred-step');
    });

    it('group 3 — named in a live roadmap, but only under a CLOSED step', () => {
        const root = fixtureRoot();
        unreferencedFixture(root, 'landed_unwired');
        write(
            root,
            'agents/roadmaps/road-to-z.md',
            ['# Road to z', '', '- [x] **1.1 Shipped it.** Added `landed_unwired`.'].join('\n'),
        );
        const { modules } = analyseModuleReach(root);
        const m = modules.find((x) => x.name === 'landed_unwired');
        expect(m?.group).toBe('named-outside-open-step');
    });

    it('group 3 — named in a parked (later/) roadmap counts too', () => {
        const root = fixtureRoot();
        unreferencedFixture(root, 'parked_mention');
        write(
            root,
            'agents/roadmaps/later/road-to-parked.md',
            ['# Road to parked', '', 'Prose mentioning `parked_mention` with no step.'].join('\n'),
        );
        const { modules } = analyseModuleReach(root);
        const m = modules.find((x) => x.name === 'parked_mention');
        expect(m?.group).toBe('named-outside-open-step');
    });

    it('group 4 — named in no live roadmap at all', () => {
        const root = fixtureRoot();
        unreferencedFixture(root, 'nowhere');
        write(root, 'agents/roadmaps/road-to-unrelated.md', ['# Unrelated', '', '- [ ] does something else'].join('\n'));
        const { modules } = analyseModuleReach(root);
        const m = modules.find((x) => x.name === 'nowhere');
        expect(m?.group).toBe('named-in-none');
    });

    it('a module named BOTH by a contract test and in an open step lands in group 1 (test wins)', () => {
        const root = fixtureRoot();
        unreferencedFixture(root, 'dual');
        write(root, 'tests/contracts/dual.test.ts', "import { a } from '../../src/scripts/_lib/dual.js';\n");
        write(root, 'agents/roadmaps/road-to-dual.md', ['# Road to dual', '', '- [ ] uses `dual`'].join('\n'));
        const { modules } = analyseModuleReach(root);
        const m = modules.find((x) => x.name === 'dual');
        expect(m?.group).toBe('contract-test');
    });

    it('groupCounts tallies all four buckets and only the unreferenced set', () => {
        const root = fixtureRoot();
        unreferencedFixture(root, 'bucket_a');
        unreferencedFixture(root, 'bucket_b');
        write(root, 'src/other.ts', '// mentions bucket_b so it is named by production\n');
        const { modules } = analyseModuleReach(root);
        const counts = groupCounts(modules);
        const total = Object.values(counts).reduce((a, b) => a + b, 0);
        const unreferenced = modules.filter((m) => !m.namedByProduction);
        expect(total).toBe(unreferenced.length);
    });
});

describe('skip the roadmap groups when agents/roadmaps/ is absent', () => {
    it('falls back to the no-roadmaps-available group without throwing', () => {
        const root = fixtureRoot();
        write(root, 'src/scripts/_lib/no_estate.ts', 'export const a = 1;\n');
        const { modules, roadmapsAvailable } = analyseModuleReach(root);
        expect(roadmapsAvailable).toBe(false);
        const m = modules.find((x) => x.name === 'no_estate');
        expect(m?.group).toBe('named-in-none');
        expect(m?.groupEvidence).toMatch(/roadmaps directory/);
    });
});

describe('the human and markdown renderers', () => {
    it('human() names every module and the four group labels', () => {
        const { modules } = analyseModuleReach(REPO);
        const out = human(modules);
        expect(out).toContain('module reach:');
        expect(out).toContain('named in no live roadmap');
    });

    it('markdown() carries the evidence-type marker and a reading: line per unreferenced module', () => {
        const { modules, roadmapsAvailable } = analyseModuleReach(REPO);
        const out = markdown(modules, roadmapsAvailable);
        expect(out).toContain('<!-- evidence-type: analysis -->');
        const unreferencedCount = modules.filter((m) => !m.namedByProduction).length;
        const readingLines = out.split('\n').filter((l) => l.startsWith('reading:'));
        expect(readingLines.length).toBe(unreferencedCount);
    });
});
