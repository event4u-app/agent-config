import { describe, expect, it } from 'vitest';

import { buildGraph, parseRouter, pathTokens, route, select, shardCount, stripComments, touchesCode } from '../../src/scripts/ci_select_tests.js';

const TREE: Record<string, string> = {
    'src/scripts/_lib/util.ts': `export const x = 1;`,
    'src/scripts/_lib/settings.ts': `import * as fs from 'node:fs';\nexport const read = () => fs.readFileSync('src/config/template.yml');`,
    'src/scripts/lint_a.ts': `import { x } from './_lib/util.js';\n// see src/scripts/lint_b.ts for the sibling\n`,
    'src/scripts/lint_b.ts': `import { read } from './_lib/settings.js';\nconst names = ['lint_a.ts'];`,
    'src/scripts/_cli/cmd_doctor.ts': `import { read } from '../_lib/settings.js';`,
    'src/scripts/_dispatch.bash': [
        'exec_ts() { tsx "$@"; }',
        'cmd_doctor() {',
        '  exec_ts "$PACKAGE_ROOT/src/scripts/_cli/cmd_doctor.ts" "$@"',
        '}',
        'main() {',
        '  case "$cmd" in',
        '    doctor)                  cmd_doctor "$@" ;;',
        '  esac',
        '}',
        'main "$@"',
    ].join('\n'),
    'src/cli/main.ts': `import { heavy } from '../scripts/_lib/util.js';`,
    'src/cli/agent-config.ts': `void import('./main.js');`,
    'src/config/template.yml': 'a: 1',
    'agent-config': '#!/usr/bin/env bash\nexec node dist/cli/agent-config.js "$@"',
    'agents/roadmaps/r.md': '# r',
    'docs/readme.md': '# docs',
    'tests/scripts/lint_a.test.ts': `import { x } from '../../src/scripts/lint_a.js';`,
    'tests/scripts/lint_b.test.ts': `const S = path.join(REPO, 'src', 'scripts', 'lint_b.ts'); spawnSync(TSX, [S]);`,
    'tests/scripts/roadmaps.test.ts': `const D = path.join(REPO, 'agents', 'roadmaps');`,
    'tests/cli/doctor.test.ts': `spawnSync(path.join(REPO, 'agent-config'), ['doctor', '--json']);`,
    'tests/cli/version.test.ts': `spawnSync(path.join(REPO, 'agent-config'), ['--version']);`,
    'tests/golden/replay.test.ts': `spawnSync(path.join(REPO, 'agent-config'), scenario.args);`,
    'tests/fixtures/x/a.test.ts': `import '../../../src/scripts/lint_a.js';`,
};
const FILES = Object.keys(TREE);
const GRAPH = buildGraph(FILES, (f) => TREE[f] ?? null);
// Share 1: in a tree this small the full-run threshold would mask the edges under test.
const pick = (changed: string[]): string[] => select(changed, FILES, GRAPH, 1).tests;

describe('select — reaches the suites a change can affect, and only those', () => {
    it('selects the importing suite of a changed module, transitively', () => {
        expect(pick(['src/scripts/_lib/util.ts'])).toContain('tests/scripts/lint_a.test.ts');
        expect(pick(['src/scripts/_lib/util.ts'])).not.toContain('tests/scripts/lint_b.test.ts');
    });

    it('selects a suite that runs the changed script as a subprocess', () => {
        expect(pick(['src/scripts/lint_b.ts'])).toEqual(['tests/scripts/lint_b.test.ts']);
    });

    it('follows a data file read by a module into that module’s suites', () => {
        expect(pick(['src/config/template.yml'])).toContain('tests/scripts/lint_b.test.ts');
    });

    it('selects a suite naming a data directory when a file inside it changes', () => {
        expect(pick(['agents/roadmaps/r.md'])).toEqual(['tests/scripts/roadmaps.test.ts']);
    });

    it('routes a CLI suite to the command it names, not to every command', () => {
        const picked = pick(['src/scripts/_cli/cmd_doctor.ts']);
        expect(picked).toContain('tests/cli/doctor.test.ts');
        expect(picked).not.toContain('tests/cli/version.test.ts');
    });

    it('gives a replay suite every routed command', () => {
        expect(pick(['src/scripts/_cli/cmd_doctor.ts'])).toContain('tests/golden/replay.test.ts');
    });

    it('selects every CLI suite for a change to the CLI shell itself', () => {
        const picked = pick(['src/cli/main.ts']);
        expect(picked).toEqual(expect.arrayContaining(['tests/cli/doctor.test.ts', 'tests/cli/version.test.ts']));
    });

    it('does not reach CLI suites through a module the shell merely loads', () => {
        expect(pick(['src/scripts/_lib/util.ts'])).not.toContain('tests/cli/version.test.ts');
    });

    it('ignores a path that only appears in a comment', () => {
        expect(pick(['src/scripts/lint_b.ts'])).not.toContain('tests/scripts/lint_a.test.ts');
    });

    it('treats a named code file inside module source as data, not a dependency', () => {
        expect(pick(['src/scripts/lint_a.ts'])).not.toContain('tests/scripts/lint_b.test.ts');
    });

    it('selects a changed suite itself and never a fixture', () => {
        expect(pick(['tests/scripts/lint_a.test.ts'])).toEqual(['tests/scripts/lint_a.test.ts']);
        expect(pick(['src/scripts/lint_a.ts'])).not.toContain('tests/fixtures/x/a.test.ts');
    });

    it('selects nothing for a diff no suite can reach', () => {
        expect(select(['docs/readme.md'], FILES, GRAPH).mode).toBe('none');
    });
});

describe('select — falls back to the whole suite when it cannot decide', () => {
    it.each([
        ['package-lock.json'],
        ['vitest.config.ts'],
        ['tests/_lib/hermetic-env.ts'],
        ['.github/workflows/tests.yml'],
        ['src/scripts/ci_select_tests.ts'],
    ])('runs everything when %s changes', (p) => {
        expect(select([p], FILES, GRAPH).mode).toBe('full');
    });

    it('treats an unreadable diff and an empty diff as full', () => {
        expect(select(null, FILES, GRAPH).mode).toBe('full');
        expect(select([], FILES, GRAPH).mode).toBe('full');
    });

    it('treats a missing graph as full', () => {
        expect(select(['src/scripts/lint_a.ts'], FILES, null).mode).toBe('full');
    });

    it('runs everything when the reached share crosses the threshold', () => {
        const all = FILES.filter((f) => f.startsWith('tests/') && !f.startsWith('tests/fixtures/'));
        expect(select(all, FILES, GRAPH).mode).toBe('full');
    });
});

describe('route and shardCount', () => {
    it('sends golden suites to the golden job, not to node shards', () => {
        const r = route({ mode: 'targeted', reason: '', tests: ['tests/golden/replay.test.ts', 'tests/scripts/lint_a.test.ts'], unmapped: [] });
        expect(r.golden).toBe(true);
        expect(r.node_files).toEqual(['tests/scripts/lint_a.test.ts']);
        expect(r.node_shards).toEqual([1]);
    });

    it('asks for every job and four shards on a full run', () => {
        expect(route({ mode: 'full', reason: '', tests: [], unmapped: [] })).toMatchObject({ node_shards: [1, 2, 3, 4], golden: true, workspace: true, browser: true });
    });

    it('asks for no node shard when nothing is selected', () => {
        expect(route({ mode: 'none', reason: '', tests: [], unmapped: [] }).node_shards).toEqual([]);
    });

    it.each([
        [0, 0],
        [1, 1],
        [40, 1],
        [41, 2],
        [160, 2],
        [161, 4],
    ])('%i files → %i shards', (n, shards) => {
        expect(shardCount(n)).toBe(shards);
    });
});

describe('token helpers', () => {
    it('joins the literal segments of a path.join call', () => {
        expect(pathTokens(`path.join(ROOT, 'src', 'scripts', 'x.ts')`)).toContain('src/scripts/x.ts');
    });

    it('keeps a glob that contains a block-comment opener inside a string', () => {
        expect(stripComments(`const g = 'src/**/*.ts'; // trailing`, 'a.ts')).toContain(`'src/**/*.ts'`);
    });

    it('drops whole-line bash comments but keeps the shebang', () => {
        expect(stripComments('#!/bin/bash\n# src/x.ts\necho hi', 'a.sh')).toBe('#!/bin/bash\necho hi');
    });

    it('maps dispatcher command names to the bodies of the functions they run, helpers included', () => {
        const r = parseRouter(TREE['src/scripts/_dispatch.bash'] as string);
        expect(r.commands.get('doctor')).toContain('cmd_doctor.ts');
        expect(r.commands.get('doctor')).toContain('tsx');
        expect(r.core).not.toContain('cmd_doctor.ts');
    });
});

describe('touchesCode — the former trigger path filter, now evaluated inside the run', () => {
    it('is false for a docs- or roadmap-only diff', () => {
        expect(touchesCode(['docs/x.md', 'agents/notes/x.md', 'README.md'])).toBe(false);
    });

    it('is true for source, tests, dependencies, build config or the workflow itself', () => {
        for (const p of ['src/a.ts', 'tests/a.test.ts', 'package-lock.json', 'taskfiles/ci.yml', 'setup.sh', '.github/workflows/tests.yml']) {
            expect(touchesCode([p]), p).toBe(true);
        }
    });

    it('treats an unreadable or empty diff as code', () => {
        expect(touchesCode(null)).toBe(true);
        expect(touchesCode([])).toBe(true);
    });
});
