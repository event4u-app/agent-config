import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { readRegistry, updateRegistry } from '../../../src/scripts/_lib/project_registry.js';
import { main } from '../../../src/scripts/code_graph/cli.js';
import { indexPath, openEstate } from '../../../src/scripts/code_graph/estate_index.js';
import { manifestFacts } from '../../../src/scripts/code_graph/estate_manifests.js';
import { graphHome } from '../../../src/scripts/code_graph/graph_home.js';
import { type Estate, makeEstate } from './estate_fixture.js';

let tmp: string;
let saved: string | undefined;

async function cg(...argv: string[]): Promise<number> {
    return main(argv);
}

function idOf(root: string): string {
    const hit = Object.entries(readRegistry().projects).find(([, e]) => e.root === root);
    if (!hit) throw new Error(`not registered: ${root}`);
    return hit[0];
}

beforeEach(() => {
    tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cg-estate-')));
    saved = process.env.EVENT4U_CONFIG_HOME;
    process.env.EVENT4U_CONFIG_HOME = path.join(tmp, 'home');
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
});
afterEach(() => {
    vi.restoreAllMocks();
    process.env.EVENT4U_CONFIG_HOME = saved;
    fs.rmSync(tmp, { recursive: true, force: true });
});

async function indexed(estate: Estate): Promise<void> {
    expect(await cg('projects', 'index', 'on')).toBe(0);
    for (const r of [estate.core, estate.app, estate.billing]) expect(await cg('build', '--root', r)).toBe(0);
}

describe('opt in per machine (4.1)', () => {
    it('is off by default, and a refresh with it off writes no index file', async () => {
        const { core } = makeEstate(tmp, 2);
        expect(readRegistry().index).toBe(false);
        expect(await cg('refresh', '--root', core)).toBe(0);
        expect(readRegistry().projects[idOf(core)]).toBeDefined();
        expect(fs.existsSync(indexPath())).toBe(false);
    }, 60_000);

    it('on writes the index on the next refresh; off deletes it', async () => {
        const { core } = makeEstate(tmp, 2);
        expect(await cg('projects', 'index', 'on')).toBe(0);
        expect(readRegistry().index).toBe(true);
        expect(await cg('refresh', '--root', core)).toBe(0);
        expect(fs.existsSync(indexPath())).toBe(true);
        expect(await cg('projects', 'index', 'off')).toBe(0);
        expect(readRegistry().index).toBe(false);
        expect(fs.existsSync(indexPath())).toBe(false);
    }, 60_000);
});

describe('packages and exports per project (4.2)', () => {
    it('npm and composer manifests yield their declared and published packages', () => {
        const e = makeEstate(tmp, 1);
        expect(manifestFacts(e.app)).toEqual({
            declares: [
                { ecosystem: 'npm', package: '@estate/core', manifest: 'package.json' },
                { ecosystem: 'npm', package: 'vitest', manifest: 'package.json' },
            ],
            publishes: [{ ecosystem: 'npm', package: 'estate-app' }],
        });
        expect(manifestFacts(e.billing)).toEqual({
            declares: [{ ecosystem: 'composer', package: 'monolog/monolog', manifest: 'composer.json' }],
            publishes: [{ ecosystem: 'composer', package: 'estate/billing' }],
        });
    });

    it('reads pyproject, requirements, go.mod, Cargo.toml and Gemfile', () => {
        const r = path.join(tmp, 'poly');
        fs.mkdirSync(r, { recursive: true });
        fs.writeFileSync(path.join(r, 'pyproject.toml'), '[project]\nname = "Poly_Tool"\ndependencies = [\n  "Requests>=2",\n  "pydantic",\n]\n');
        fs.writeFileSync(path.join(r, 'requirements-dev.txt'), '# dev\npytest==8.0\n-r other.txt\n');
        fs.writeFileSync(path.join(r, 'go.mod'), 'module example.com/poly\n\nrequire (\n\tgithub.com/pkg/errors v0.9.1\n)\nrequire golang.org/x/sync v0.1.0\n');
        fs.writeFileSync(path.join(r, 'Cargo.toml'), '[package]\nname = "poly"\n\n[dependencies]\nserde = "1"\n');
        fs.writeFileSync(path.join(r, 'Gemfile'), "source 'https://rubygems.org'\ngem 'rails', '~> 7'\n");
        const f = manifestFacts(r);
        expect(f.publishes).toEqual([
            { ecosystem: 'cargo', package: 'poly' },
            { ecosystem: 'go', package: 'example.com/poly' },
            { ecosystem: 'pypi', package: 'poly-tool' },
        ]);
        expect(f.declares.map((d) => `${d.ecosystem}:${d.package}`).sort()).toEqual(
            ['cargo:serde', 'go:github.com/pkg/errors', 'go:golang.org/x/sync', 'pypi:pydantic', 'pypi:pytest', 'pypi:requests', 'rubygems:rails'].sort(),
        );
    });

    it('stores declared, published and top-level exported names, and replaces rows on the next refresh', async () => {
        const e = makeEstate(tmp, 2);
        await indexed(e);
        const idCore = idOf(e.core);
        let db = openEstate()!;
        try {
            expect(db.rows('publishes', idCore)).toEqual([{ project: idCore, ecosystem: 'npm', package: '@estate/core' }]);
            expect(db.rows('declares', idCore).map((r) => r['package'])).toEqual(['vitest']);
            const names = db.rows('exports', idCore).map((r) => r['name']);
            expect(names).toEqual(expect.arrayContaining(['uniqueThing', 'sharedName', 'coreStep0a', 'coreBox1']));
            expect(names).not.toContain('open');
        } finally {
            db.close();
        }
        fs.writeFileSync(
            path.join(e.core, 'package.json'),
            JSON.stringify({ name: '@estate/core', devDependencies: { vitest: '^3.0.0', tsx: '^4.0.0' } }),
        );
        fs.rmSync(path.join(e.core, 'src', 'index.ts'));
        expect(await cg('build', '--root', e.core)).toBe(0);
        db = openEstate()!;
        try {
            expect(db.rows('declares', idCore).map((r) => r['package'])).toEqual(['tsx', 'vitest']);
            const names = db.rows('exports', idCore).map((r) => r['name']);
            expect(names).not.toContain('uniqueThing');
            expect(new Set(names).size).toBe(names.length);
        } finally {
            db.close();
        }
    }, 120_000);
});

describe('an unchanged refresh rewrites nothing', () => {
    it('keeps the rows and their indexed_at when neither graph nor manifests changed', async () => {
        const e = makeEstate(tmp, 1);
        expect(await cg('projects', 'index', 'on')).toBe(0);
        expect(await cg('build', '--root', e.core)).toBe(0);
        const at = (): string => {
            const db = openEstate()!;
            try {
                return db.projects().find((p) => p.root === e.core)!.indexed_at;
            } finally {
                db.close();
            }
        };
        const first = at();
        await new Promise((r) => setTimeout(r, 5));
        expect(await cg('build', '--root', e.core)).toBe(0);
        expect(at()).toBe(first);
        fs.writeFileSync(path.join(e.core, 'package.json'), JSON.stringify({ name: '@estate/core', dependencies: { zod: '^3.0.0' } }));
        expect(await cg('build', '--root', e.core)).toBe(0);
        expect(at()).not.toBe(first);
    }, 60_000);
});

describe('cross-project edges, honestly labelled (4.3)', () => {
    it('a path dependency is a package edge; a name only one project declares is a unique-name guess; a shared name is none', async () => {
        const e = makeEstate(tmp, 2);
        await indexed(e);
        const [core, app, billing] = [idOf(e.core), idOf(e.app), idOf(e.billing)];
        const db = openEstate()!;
        try {
            const edges = db.xedges();
            expect(edges).toContainEqual({ source: app, target: core, via: 'package', detail: '@estate/core' });
            expect(edges).toContainEqual({ source: billing, target: core, via: 'unique-name', detail: 'uniqueThing' });
            expect(edges.filter((x) => x.detail === 'sharedName')).toEqual([]);
            // A package edge already states the pair; no guess is added beside it.
            expect(edges.filter((x) => x.source === app && x.target === core).map((x) => x.via)).toEqual(['package']);
        } finally {
            db.close();
        }
    }, 120_000);

    it('a reference to another registered project by name is a mention', async () => {
        const e = makeEstate(tmp, 1);
        fs.writeFileSync(path.join(e.billing, 'src', 'ping.ts'), 'export function ping(): number {\n    return core();\n}\n');
        await indexed(e);
        const db = openEstate()!;
        try {
            expect(db.xedges()).toContainEqual({ source: idOf(e.billing), target: idOf(e.core), via: 'mention', detail: 'core' });
        } finally {
            db.close();
        }
    }, 120_000);
});

describe('size stays small (4.4)', () => {
    it('the index stays under 2 % of the summed project graph JSON', async () => {
        const e = makeEstate(tmp, 120);
        await indexed(e);
        const graphs = [e.core, e.app, e.billing].reduce((n, r) => n + fs.statSync(graphHome(r).cachePath).size, 0);
        const index = fs.statSync(indexPath()).size;
        const ratio = index / graphs;
        expect(ratio, `index ${index} B / graphs ${graphs} B`).toBeLessThanOrEqual(0.02);
    }, 180_000);
});

describe('the registry switch is the only gate', () => {
    it('a switch flipped by hand in the registry is honoured too', async () => {
        const { core } = makeEstate(tmp, 1);
        updateRegistry((reg) => {
            reg.index = true;
        });
        expect(await cg('build', '--root', core)).toBe(0);
        expect(fs.existsSync(indexPath())).toBe(true);
    }, 60_000);
});
