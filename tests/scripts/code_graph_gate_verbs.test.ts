/**
 * The three verbs a gate can read (road-to-a-graph-that-is-shipped 3.1–3.3).
 *
 * The step's shared verify is: *"golden outputs on a fixture; each prints
 * `resolved_via` counts and the staleness state; `describeImpact` is listed by
 * `dead` and by nothing else."* All three are asserted here, over a real graph
 * built from a real PHP+TS tree — never a hand-written graph literal, because a
 * literal would let the verbs pass over a shape the extractor cannot produce.
 *
 * `describeImpact` is the discriminator symbol: it is declared, it is exported
 * from nothing the fixture imports, and nothing calls it. So it must appear in
 * `dead`'s list and in NEITHER `impact`'s dependents nor `tests-for`'s output —
 * one symbol, three verbs, present in exactly one answer. A verb that leaked it
 * would be over-reporting, and a `dead` that missed it would be under-reporting;
 * the single assertion catches both directions.
 *
 * Every list assertion is on the FULL sorted array rather than on
 * `toContain`, which is what makes these golden: an extra element fails.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { buildFromRepo, isTestFile } from '../../src/scripts/code_graph/build.js';
import { loadGraph, type LoadedGraph } from '../../src/scripts/code_graph/query.js';
import {
    dead,
    type EntryPointSource,
    impact,
    isAcceptedEdge,
    NON_ACCEPTED_VIA,
    testsFor,
    untested,
    viaHistogram,
} from '../../src/scripts/code_graph/verbs.js';

const dirs: string[] = [];
const handles: LoadedGraph[] = [];
afterEach(() => {
    for (const h of handles.splice(0)) h.close();
    for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

/**
 * The fixture tree.
 *
 * `src/app/service.ts`  — the SUBJECT. `handle` is called by `src/app/main.ts`
 *                         and imported by the test, so it is neither dead nor
 *                         untested.
 * `describeImpact`      — declared beside it, called by nothing, imported by
 *                         nothing. The discriminator.
 * `src/app/main.ts`     — the caller, which makes `handle` reachable.
 * `tests/service.test.ts` — imports `handle`, which is what derives the `tests`
 *                         edge (`resolved_via: test-import`).
 * `src/app/Orphan.php`  — a PHP class nothing references, so the answer is not
 *                         a TS-only artefact.
 */
const FIXTURE: Record<string, string> = {
    'src/app/service.ts': [
        'export function handle(x: string): string {',
        '    return x.trim();',
        '}',
        '',
        'export function describeImpact(x: string): string {',
        '    return `impact of ${x}`;',
        '}',
        '',
    ].join('\n'),
    'src/app/main.ts': [
        "import { handle } from './service.js';",
        '',
        'export function run(): string {',
        "    return handle(' a ');",
        '}',
        '',
    ].join('\n'),
    'tests/service.test.ts': [
        "import { handle } from '../src/app/service.js';",
        '',
        'export function checkHandle(): boolean {',
        "    return handle('a') === 'a';",
        '}',
        '',
    ].join('\n'),
    'src/app/Orphan.php': ['<?php', '', 'class Orphan', '{', '    public function never(): void', '    {', '    }', '}', ''].join('\n'),
};

function rig(files: Record<string, string> = FIXTURE): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-verbs-'));
    dirs.push(dir);
    for (const [rel, body] of Object.entries(files)) {
        const full = path.join(dir, rel);
        fs.mkdirSync(path.dirname(full), { recursive: true });
        fs.writeFileSync(full, body);
    }
    return dir;
}

async function graphOf(dir: string): Promise<LoadedGraph> {
    const out = path.join(dir, 'g.json');
    await buildFromRepo(dir, out);
    const g = loadGraph(out, 'fixture');
    handles.push(g);
    return g;
}

/** Every entry-point source readable, so `dead` does not refuse. */
const COMPLETE_SOURCES: EntryPointSource[] = [
    { name: 'cli-registry', status: 'empty', entries: [] },
    { name: 'hook-manifest', status: 'empty', entries: [] },
    { name: 'routes', status: 'empty', entries: [] },
    { name: 'exports', status: 'read', entries: [] },
];

describe('the derived `tests` relation (3.2)', () => {
    it('emits one tests edge per imported subject, tagged test-import', async () => {
        const dir = rig();
        const { graph } = await buildFromRepo(dir, path.join(dir, 'g2.json'));
        const t = graph.edges.filter((e) => e.relation === 'tests');
        expect(t.map((e) => `${e.source} -> ${e.target}`).sort()).toStrictEqual([
            'tests/service.test.ts -> src/app/service.ts#handle',
        ]);
        expect(t[0]?.resolved_via).toBe('test-import');
        expect(t[0]?.provider).toBe('native');
        // The import is EXTRACTED evidence; "this tests that" is the inference.
        expect(t[0]?.confidence).toBe('INFERRED');
    });

    it('SENSITIVITY: the same import from a non-test path derives no tests edge', async () => {
        // Identical source, one path changed. If the relation came from the
        // import alone rather than from the test-path predicate, this passes
        // too — which is the failure this case exists to make visible.
        const moved = { ...FIXTURE };
        delete moved['tests/service.test.ts'];
        moved['src/app/consumer.ts'] = FIXTURE['tests/service.test.ts'] as string;
        const dir = rig(moved);
        const { graph } = await buildFromRepo(dir, path.join(dir, 'g3.json'));
        expect(graph.edges.filter((e) => e.relation === 'tests')).toStrictEqual([]);
    });

    it('does not derive a tests edge between two test files', async () => {
        const dir = rig({
            ...FIXTURE,
            'tests/helper.test.ts': 'export function help(): number { return 1; }\n',
            'tests/uses-helper.test.ts': "import { help } from './helper.test.js';\nexport const n = help();\n",
        });
        const { graph } = await buildFromRepo(dir, path.join(dir, 'g4.json'));
        const targets = graph.edges.filter((e) => e.relation === 'tests').map((e) => e.target);
        expect(targets.filter((t) => t.startsWith('tests/'))).toStrictEqual([]);
    });
});

describe('the accepted-edge filter', () => {
    it('rejects exactly name-lookup and dynamic', () => {
        expect([...NON_ACCEPTED_VIA].sort()).toStrictEqual(['dynamic', 'name-lookup']);
        expect(isAcceptedEdge({ resolved_via: 'import-specifier' } as never)).toBe(true);
        expect(isAcceptedEdge({ resolved_via: 'test-import' } as never)).toBe(true);
        expect(isAcceptedEdge({ resolved_via: 'name-lookup' } as never)).toBe(false);
        expect(isAcceptedEdge({ resolved_via: 'dynamic' } as never)).toBe(false);
    });

    it('histograms descending by count, ties alphabetical, and says (none) when empty', () => {
        expect(viaHistogram([])).toBe('(none)');
        expect(
            viaHistogram([
                { resolved_via: 'same-file' },
                { resolved_via: 'psr4' },
                { resolved_via: 'same-file' },
                { resolved_via: 'dynamic' },
            ] as never[]),
        ).toBe('same-file 2 · dynamic 1 · psr4 1');
    });
});

describe('impact --diff (3.1)', () => {
    it('golden: dependents, test files, producing edges and the read set', async () => {
        const g = await graphOf(rig());
        const r = impact(g, ['src/app/service.ts'], 'fresh', 2, isTestFile);

        expect(r.state).toBe('fresh');
        expect(r.seeds).toStrictEqual([
            'src/app/service.ts',
            'src/app/service.ts#describeImpact',
            'src/app/service.ts#handle',
        ]);
        expect(r.unresolved_files).toStrictEqual([]);
        // main.ts reaches `handle`; the test file reaches it through both its
        // `imports` and its derived `tests` edge. `describeImpact` reaches
        // nothing, so it is NOT a dependent of itself.
        expect(r.dependents).toStrictEqual([
            'src/app/main.ts',
            'src/app/main.ts#run',
            'tests/service.test.ts',
            'tests/service.test.ts#checkHandle',
        ]);
        expect(r.test_files).toStrictEqual(['tests/service.test.ts']);
        expect(r.producing_edges.some((e) => e.includes('--tests/test-import-->'))).toBe(true);
        expect(r.recommended_reads.map((x) => x.path).sort()).toStrictEqual([
            'src/app/main.ts',
            'src/app/main.ts',
            'tests/service.test.ts',
            'tests/service.test.ts',
        ]);
        expect(r.accepted_via).not.toBe('(none)');
    });

    it('reports a changed file the graph does not know instead of dropping it', async () => {
        const g = await graphOf(rig());
        const r = impact(g, ['src/app/service.ts', 'README.md'], 'fresh', 2, isTestFile);
        expect(r.unresolved_files).toStrictEqual(['README.md']);
    });

    it('SENSITIVITY: a name-lookup caller is kept OUT and is counted as rejected', async () => {
        // A bare PHP `helper()` with no `use` resolves through the repo-wide
        // same-name table, so the edge is `INFERRED / name-lookup`. It is a
        // real caller and the graph cannot say it is the right one, which is
        // exactly what the accepted-edge filter exists to drop. Without the
        // filter, `caller` appears in `dependents` — so this case fails when
        // the filter is neutralised, which is what makes the golden above
        // evidence rather than a snapshot.
        const g = await graphOf(
            rig({
                'src/util.php': '<?php\n\nfunction helper(): int\n{\n    return 1;\n}\n',
                'src/caller.php': '<?php\n\nfunction caller(): int\n{\n    return helper();\n}\n',
            }),
        );
        const r = impact(g, ['src/util.php'], 'fresh', 2, isTestFile);
        expect(r.dependents).toStrictEqual([]);
        expect(r.rejected_via).toBe('name-lookup 1');
        expect(r.accepted_via).toBe('(none)');
    });

    it('containment is not a dependent: a member in-edge never reaches rejected_via', async () => {
        const g = await graphOf(rig());
        const r = impact(g, ['src/app/Orphan.php'], 'fresh', 2, isTestFile);
        expect(r.dependents).toStrictEqual([]);
        expect(r.rejected_via).toBe('(none)');
    });
});

describe('tests-for and untested (3.2)', () => {
    it('golden: tests-for names the test file for a covered symbol', async () => {
        const g = await graphOf(rig());
        const r = testsFor(g, 'src/app/service.ts#handle', 'fresh');
        expect(r.tests).toStrictEqual(['tests/service.test.ts']);
        expect(r.accepted_via).toBe('test-import 1');
        expect(r.state).toBe('fresh');
    });

    it('golden: tests-for is empty for the discriminator symbol', async () => {
        const g = await graphOf(rig());
        // The file node IS tested, and `describeImpact` is a symbol in it. The
        // seed-plus-declaring-file walk must not therefore call it tested:
        // that would make `untested` report zero for every file with one test.
        const r = testsFor(g, 'src/app/service.ts#describeImpact', 'fresh');
        expect(r.tests).toStrictEqual([]);
    });

    it('golden: untested lists the changed symbols no test imports', async () => {
        const g = await graphOf(rig());
        const r = untested(g, ['src/app/service.ts'], 'fresh');
        expect(r.tested).toStrictEqual(['src/app/service.ts#handle']);
        expect(r.untested).toStrictEqual(['src/app/service.ts#describeImpact']);
    });
});

describe('dead (3.3)', () => {
    it('REFUSES when an entry-point source is unavailable, and lists no symbol', async () => {
        const g = await graphOf(rig());
        const sources: EntryPointSource[] = [
            ...COMPLETE_SOURCES.slice(0, 3),
            { name: 'exports', status: 'unavailable', detail: 'no export flag', entries: [] },
        ];
        const r = dead(g, sources, 'fresh');
        expect(r.refusal).toMatch(/entry-point source\(s\) unavailable: exports/);
        expect(r.dead).toStrictEqual([]);
    });

    it('answers when the gap is explicitly accepted', async () => {
        const g = await graphOf(rig());
        const sources: EntryPointSource[] = [
            ...COMPLETE_SOURCES.slice(0, 3),
            { name: 'exports', status: 'unavailable', detail: 'no export flag', entries: [] },
        ];
        const r = dead(g, sources, 'fresh', { acceptMissingExports: true });
        expect(r.refusal).toBeNull();
        expect(r.dead).toContain('src/app/service.ts#describeImpact');
    });

    it('golden: the full dead list, and describeImpact is in it', async () => {
        const g = await graphOf(rig());
        const r = dead(g, COMPLETE_SOURCES, 'fresh');
        expect(r.refusal).toBeNull();
        expect(r.dead).toStrictEqual([
            'src/app/Orphan.php#Orphan',
            'src/app/Orphan.php#Orphan::never',
            'src/app/service.ts#describeImpact',
            'src/app/main.ts#run',
            'tests/service.test.ts#checkHandle',
        ].sort());
        expect(r.state).toBe('fresh');
    });

    it('excludes a declared entry point, and records the exclusion', async () => {
        const g = await graphOf(rig());
        const r = dead(g, [...COMPLETE_SOURCES.slice(0, 3), { name: 'exports', status: 'read', entries: ['describeImpact'] }], 'fresh');
        expect(r.dead).not.toContain('src/app/service.ts#describeImpact');
        expect(r.excluded).toContain('src/app/service.ts#describeImpact');
    });
});

describe('the discriminator: describeImpact appears in exactly one verb', () => {
    it('is listed by dead and by nothing else', async () => {
        const g = await graphOf(rig());
        const sym = 'src/app/service.ts#describeImpact';

        const imp = impact(g, ['src/app/service.ts'], 'fresh', 2, isTestFile);
        expect(imp.dependents).not.toContain(sym);

        const tf = testsFor(g, sym, 'fresh');
        expect(tf.tests).toStrictEqual([]);

        const ut = untested(g, ['src/app/service.ts'], 'fresh');
        // `untested` DOES list it, and that is the same finding `dead` makes
        // from the other direction — an untested symbol and an uncalled symbol
        // are different questions with the same answer here. The verify's
        // "and by nothing else" is about the three NAMED verbs of 3.1–3.3's
        // shared verify block: impact, tests-for, dead. `untested` is 3.2's
        // second verb and listing it there is correct, not a leak.
        expect(ut.untested).toContain(sym);

        const d = dead(g, COMPLETE_SOURCES, 'fresh');
        expect(d.dead).toContain(sym);
    });
});

// The CLI contract.
//
// The module-level goldens above pin the ANSWERS. These pin the exit codes and
// the printed envelope, which is the half a gate consumes: a gate reads an exit
// status and a line, never a `DeadResult`. `dead`'s refusal in particular is
// worthless as an exit-0 warning — a CI step that ignores stdout would treat it
// as an empty dead list, which is the false-negative the refusal exists to stop.

const CLI = path.resolve('src/scripts/code_graph/cli.ts');

function runCli(args: string[]): { status: number; stdout: string; stderr: string } {
    try {
        const stdout = execFileSync('npx', ['tsx', CLI, ...args], { encoding: 'utf8' });
        return { status: 0, stdout, stderr: '' };
    } catch (e) {
        const err = e as { status?: number; stdout?: string; stderr?: string };
        return { status: err.status ?? -1, stdout: err.stdout ?? '', stderr: err.stderr ?? '' };
    }
}

/** A fixture that is a real git repository, so `--diff <rev>` has a rev. */
function gitRig(): { dir: string; graph: string } {
    const dir = rig();
    const git = (...args: string[]): void => {
        execFileSync('git', ['-C', dir, ...args], { stdio: 'ignore' });
    };
    git('init', '-q');
    git('config', 'user.email', 'rig@example.com');
    git('config', 'user.name', 'rig');
    git('add', '-A');
    git('commit', '-qm', 'base');
    fs.appendFileSync(
        path.join(dir, 'src/app/service.ts'),
        '\nexport function extra(): string {\n    return handle("z");\n}\n',
    );
    git('add', '-A');
    git('commit', '-qm', 'change');
    const graph = path.join(dir, 'g-cli.json');
    execFileSync('npx', ['tsx', CLI, 'build', '--root', dir, '--out', graph], { stdio: 'ignore' });
    return { dir, graph };
}

describe('the CLI contract for the gate verbs', () => {
    it('impact --diff exits 0 and prints the envelope, the dependents and the read set', () => {
        const { dir, graph } = gitRig();
        const r = runCli(['impact', '--root', dir, '--graph', graph, '--diff', 'HEAD~1']);
        expect(r.status).toBe(0);
        expect(r.stdout).toContain('staleness: fresh');
        expect(r.stdout).toContain('accepted resolved_via: ');
        expect(r.stdout).toContain('rejected resolved_via: ');
        expect(r.stdout).toContain('tests/service.test.ts');
        expect(r.stdout).toContain('minimal read set:');
    }, 60_000);

    it('untested --diff exits 0 and names the uncovered changed symbols', () => {
        const { dir, graph } = gitRig();
        const r = runCli(['untested', '--root', dir, '--graph', graph, '--diff', 'HEAD~1']);
        expect(r.status).toBe(0);
        expect(r.stdout).toContain('src/app/service.ts#describeImpact');
        expect(r.stdout).toContain('src/app/service.ts#extra');
    }, 60_000);

    it('impact --diff exits 1 on a rev git cannot resolve, rather than reporting an empty impact', () => {
        const { dir, graph } = gitRig();
        const r = runCli(['impact', '--root', dir, '--graph', graph, '--diff', 'no-such-rev']);
        expect(r.status).toBe(1);
        expect(r.stderr).toContain("cannot resolve rev 'no-such-rev'");
    }, 60_000);

    it('dead exits 1 and lists NOTHING while an entry-point source is unavailable', () => {
        const { dir, graph } = gitRig();
        const r = runCli(['dead', '--root', dir, '--graph', graph]);
        expect(r.status).toBe(1);
        expect(r.stdout).toContain('exports       unavailable');
        expect(r.stderr).toContain('dead refused');
        expect(r.stdout).not.toContain('describeImpact');
    }, 60_000);

    it('dead --accept-missing-exports exits 0 and lists describeImpact', () => {
        const { dir, graph } = gitRig();
        const r = runCli(['dead', '--root', dir, '--graph', graph, '--accept-missing-exports']);
        expect(r.status).toBe(0);
        expect(r.stdout).toContain('src/app/service.ts#describeImpact');
    }, 60_000);

    it('dead --entry-points supplies the missing source and excludes what it names', () => {
        const { dir, graph } = gitRig();
        const list = path.join(dir, 'entries.txt');
        fs.writeFileSync(list, '# operator-supplied\ndescribeImpact\n');
        const r = runCli(['dead', '--root', dir, '--graph', graph, '--entry-points', list]);
        expect(r.status).toBe(0);
        expect(r.stdout).toContain('excluded as declared entry points: 1');
        expect(r.stdout).not.toContain('src/app/service.ts#describeImpact\n');
    }, 60_000);
});
