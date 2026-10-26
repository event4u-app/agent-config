import fs from 'node:fs';
import os from 'node:os';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildFromRepo } from '../../../src/scripts/code_graph/build.js';
import { evaluateDrift } from '../../../src/scripts/code_graph/drift.js';
import { readBunLock, readPnpmLock, readYarnLock } from '../../../src/scripts/code_graph/lanes/systems/lockfiles.js';
import { packageOfSpecifier, satisfies } from '../../../src/scripts/code_graph/lanes/systems/semver.js';
import type { CodeGraph } from '../../../src/scripts/code_graph/types.js';
import { writeSystemsFixture } from './systems_fixture.js';

let root: string;
let graph: CodeGraph;

beforeAll(async () => {
    root = writeSystemsFixture();
    graph = (await buildFromRepo(root, null, { lanes: true })).graph;
}, 60_000);
afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

const node = (id: string) => graph.nodes.find((n) => n.id === id);
const attrs = (id: string) => node(id)?.fact?.attrs ?? {};
const edge = (s: string, r: string, t: string) => graph.edges.find((e) => e.source === s && e.relation === r && e.target === t);

describe('systems lane — packages from lockfiles', () => {
    it('reads every locked package with its version and scope', () => {
        expect(node('package:npm:react@18.2.0')).toBeDefined();
        expect(attrs('package:npm:eslint@8.57.0')['dev']).toBe(true);
        expect(attrs('package:npm:react@18.2.0')['direct']).toBe(true);
        expect(attrs('package:npm:js-tokens@4.0.0')['direct']).toBe(false);
        expect(attrs('package:composer:laravel/framework@11.9.2')['framework']).toBe(true);
        expect(attrs('package:npm:react@18.2.0')['framework']).toBe(true);
    });

    it('records requires between packages as the lockfile resolved them', () => {
        expect(edge('package:npm:react@18.2.0', 'requires', 'package:npm:loose-envify@1.4.0')).toBeDefined();
        expect(edge('package:npm:loose-envify@1.4.0', 'requires', 'package:npm:js-tokens@4.0.0')).toBeDefined();
        expect(edge('package:composer:guzzlehttp/guzzle@7.8.1', 'requires', 'package:composer:psr/http-client@1.0.3')).toBeDefined();
    });

    it('binds a JS import and a PHP use of a vendor class to the package', () => {
        expect(edge('src/app.ts', 'uses', 'package:npm:react@18.2.0')).toBeDefined();
        expect(edge('src/app.ts', 'uses', 'package:npm:lodash@4.17.21')).toBeDefined();
        expect(edge('app/Http/Client.php', 'uses', 'package:composer:guzzlehttp/guzzle@7.8.1')).toBeDefined();
    });

    it('counts uses without an import', () => {
        const ni = (id: string) => (attrs(id)['nonimport'] as string[]).join(' | ');
        expect(ni('package:npm:vitest@1.6.0')).toMatch(/^script package\.json:\d+ test/);
        expect(ni('package:npm:eslint-plugin-react@7.34.1')).toMatch(/config \.eslintrc\.json:\d+ react/);
        expect(ni('package:composer:phpunit/phpunit@11.1.3')).toMatch(/script composer\.json/);
        expect(ni('package:composer:spatie/laravel-ray@1.36.0')).toMatch(/auto-discovery/);
        expect(ni('package:npm:eslint@8.57.0')).toMatch(/ci \.github\/workflows\/ci\.yml:8 eslint/);
    });

    it('keeps every runtime witness apart', () => {
        const w = attrs('runtime:php')['witnesses'] as string[];
        expect(w.some((x) => x.startsWith('Dockerfile:1 image 8.2'))).toBe(true);
        expect(w.some((x) => x.startsWith('composer.json:') && x.endsWith('^8.3'))).toBe(true);
        expect(attrs('runtime:php')['disagrees']).toBe(true);
        expect(attrs('runtime:node')['disagrees']).toBeUndefined();
    });
});

describe('systems lane — drift', () => {
    const findings = () => evaluateDrift(graph).findings.filter((f) => f.lane === 'systems');
    const subjectsOf = (rule: string) => findings().filter((f) => f.rule === rule).map((f) => f.subject);

    it('SY-1 names only the package nothing reaches', () => {
        expect(subjectsOf('SY-1')).toEqual(['package:npm:is-even@1.0.0']);
    });
    it('SY-2 names the transitive package production code imports', () => {
        expect(subjectsOf('SY-2')).toEqual(['package:npm:js-tokens@4.0.0']);
    });
    it('SY-3 names the dev package production code imports', () => {
        expect(subjectsOf('SY-3')).toEqual(['package:npm:eslint@8.57.0']);
    });
    it('SY-4 names the runtime whose witnesses disagree, with both witnesses', () => {
        const f = findings().find((x) => x.rule === 'SY-4');
        expect(f?.subject).toBe('runtime:php');
        expect(f?.witnesses[1]).not.toBeNull();
    });
});

describe('other lockfile formats', () => {
    it('pnpm v9: importers are roots, snapshots carry the edges', () => {
        const g = readPnpmLock(
            'pnpm-lock.yaml',
            "lockfileVersion: '9.0'\nimporters:\n  .:\n    dependencies:\n      a:\n        specifier: ^1.0.0\n        version: 1.0.0\npackages:\n  a@1.0.0:\n    resolution: {integrity: x}\n  b@2.0.0:\n    resolution: {integrity: y}\nsnapshots:\n  a@1.0.0:\n    dependencies:\n      b: 2.0.0\n  b@2.0.0: {}\n",
        );
        if ('unread' in g) throw new Error(g.unread);
        expect(g.roots.map((r) => [r.name, r.to])).toEqual([['a', 'a@1.0.0']]);
        expect(g.packages.get('a@1.0.0')?.requires.map((r) => r.to)).toEqual(['b@2.0.0']);
    });

    it('yarn v1: descriptors resolve requires', () => {
        const g = readYarnLock(
            'yarn.lock',
            '# yarn lockfile v1\n\n"a@^1.0.0":\n  version "1.2.0"\n  resolved "x"\n  dependencies:\n    b "^2.0.0"\n\nb@^2.0.0, b@^2.1.0:\n  version "2.1.3"\n  resolved "y"\n',
            [{ file: 'package.json', text: '{"dependencies":{"a":"^1.0.0"}}' }],
        );
        if ('unread' in g) throw new Error(g.unread);
        expect(g.packages.get('a@1.2.0')?.requires.map((r) => r.to)).toEqual(['b@2.1.3']);
        expect(g.roots.map((r) => r.to)).toEqual(['a@1.2.0']);
    });

    it('yarn berry: npm: descriptors resolve', () => {
        const g = readYarnLock(
            'yarn.lock',
            '__metadata:\n  version: 6\n\n"a@npm:^1.0.0":\n  version: 1.2.0\n  resolution: "a@npm:1.2.0"\n  dependencies:\n    b: "npm:^2.0.0"\n  languageName: node\n\n"b@npm:^2.0.0":\n  version: 2.1.3\n  resolution: "b@npm:2.1.3"\n  languageName: node\n',
            [{ file: 'package.json', text: '{"dependencies":{"a":"^1.0.0"}}' }],
        );
        if ('unread' in g) throw new Error(g.unread);
        expect(g.packages.get('a@1.2.0')?.requires.map((r) => r.to)).toEqual(['b@2.1.3']);
        expect(g.roots.map((r) => r.to)).toEqual(['a@1.2.0']);
    });

    it('bun.lock: trailing commas, workspaces and nested paths', () => {
        const g = readBunLock(
            'bun.lock',
            '{\n  "lockfileVersion": 1,\n  "workspaces": {\n    "": {\n      "dependencies": { "a": "^1.0.0", },\n    },\n  },\n  "packages": {\n    "a": ["a@1.0.0", "", { "dependencies": { "b": "^2.0.0" } }, "sha"],\n    "b": ["b@2.0.0", "", {}, "sha"],\n  },\n}\n',
        );
        if ('unread' in g) throw new Error(g.unread);
        expect(g.roots.map((r) => r.to)).toEqual(['a@1.0.0']);
        expect(g.packages.get('a@1.0.0')?.requires.map((r) => r.to)).toEqual(['b@2.0.0']);
    });
});

describe('version helpers', () => {
    it.each([
        ['8.2.0', '^8.3', false],
        ['8.3.12', '^8.3', true],
        ['8.2', '>=8.1 <9.0', true],
        ['8.2', '>=8.1,<8.2', false],
        ['20.11.0', '>=20', true],
        ['1.2.3', '1.x', true],
        ['2.0.0', '^1.0 || ^2.0', true],
        ['0.2.5', '^0.1.0', false],
    ])('satisfies(%s, %s) = %s', (v, r, want) => expect(satisfies(v, r)).toBe(want));

    it('returns null for a form it does not read', () => {
        expect(satisfies('1.0.0', 'dev-main')).toBeNull();
    });

    it.each([
        ['react', 'react'],
        ['lodash/map', 'lodash'],
        ['@scope/pkg/sub', '@scope/pkg'],
        ['node:fs', null],
        ['fs', null],
        ['./local', null],
        ['@/alias', null],
    ])('packageOfSpecifier(%s) = %s', (s, want) => expect(packageOfSpecifier(s)).toBe(want));
});

describe('package verbs', () => {
    it('why lists the path from the declaration to a transitive package', async () => {
        const { why } = await import('../../../src/scripts/code_graph/lanes/systems/verbs.js');
        const [a] = why(graph, 'js-tokens');
        expect(a?.paths.map((p) => p.steps.join(' > '))).toEqual(['react@18.2.0 > loose-envify@1.4.0 > js-tokens@4.0.0']);
    });

    it('usage says "surface unknown" while the package is not installed, and computes a share once it is', async () => {
        const { usage } = await import('../../../src/scripts/code_graph/lanes/systems/verbs.js');
        expect(usage(graph, root, 'react')[0]?.share).toBeNull();
        expect(usage(graph, root, 'react')[0]?.reason).toMatch(/surface unknown/);
        fs.mkdirSync(`${root}/node_modules/react`, { recursive: true });
        fs.writeFileSync(`${root}/node_modules/react/package.json`, JSON.stringify({ name: 'react', types: 'index.d.ts' }));
        fs.writeFileSync(`${root}/node_modules/react/index.d.ts`, 'export declare function useState(): void;\nexport declare function useEffect(): void;\nexport declare function createElement(): void;\n');
        const [u] = usage(graph, root, 'react');
        expect(u?.surface?.names).toBe(3);
        expect(u?.share).toBe(33.3);
        fs.rmSync(`${root}/node_modules`, { recursive: true, force: true });
    });

    it('remove-plan names the declaration and what would leave with it', async () => {
        const { removePlan } = await import('../../../src/scripts/code_graph/lanes/systems/verbs.js');
        const [p] = removePlan(graph, 'is-even');
        expect(p?.declared[0]).toMatch(/^package\.json:\d+ prod \^1\.0\.0$/);
        expect(p?.orphans).toEqual(['is-odd@0.1.2']);
        expect(p?.sites).toEqual([]);
        const [r] = removePlan(graph, 'loose-envify');
        expect(r?.dependents).toEqual(['react@18.2.0 requires ^1.1.0']);
    });
});

describe('SY-5 — one package in two majors across workspaces', () => {
    it('flags both direct versions', async () => {
        const { readSystems } = await import('../../../src/scripts/code_graph/lanes/systems/index.js');
        const ws = fs.realpathSync(fs.mkdtempSync(`${os.tmpdir()}/cg-sy5-`));
        fs.mkdirSync(`${ws}/packages/w`, { recursive: true });
        fs.writeFileSync(`${ws}/package.json`, JSON.stringify({ dependencies: { a: '^1.0.0' } }));
        fs.writeFileSync(`${ws}/packages/w/package.json`, JSON.stringify({ dependencies: { a: '^2.0.0' } }));
        fs.writeFileSync(
            `${ws}/package-lock.json`,
            JSON.stringify(
                {
                    lockfileVersion: 3,
                    packages: {
                        '': { dependencies: { a: '^1.0.0' } },
                        'packages/w': { dependencies: { a: '^2.0.0' } },
                        'node_modules/a': { version: '1.0.0' },
                        'packages/w/node_modules/a': { version: '2.0.0' },
                    },
                },
                null,
                2,
            ),
        );
        const out = readSystems(ws);
        const flagged = out.facts.filter((f) => f.attrs['multi_major'] === true).map((f) => f.id).sort();
        expect(flagged).toEqual(['package:npm:a@1.0.0', 'package:npm:a@2.0.0']);
        const findings = evaluateDrift(out).findings.filter((f) => f.rule === 'SY-5');
        expect(findings).toHaveLength(2);
        expect(findings.every((f) => f.witnesses[1] !== null)).toBe(true);
        fs.rmSync(ws, { recursive: true, force: true });
    });
});
