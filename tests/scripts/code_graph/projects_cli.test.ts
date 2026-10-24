import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { readRegistry, recordProject, updateRegistry } from '../../../src/scripts/_lib/project_registry.js';
import { main } from '../../../src/scripts/code_graph/cli.js';
import { graphHome } from '../../../src/scripts/code_graph/graph_home.js';

let tmp: string;
let saved: string | undefined;
let out: string[];

function repo(name: string, origin?: string): string {
    const r = path.join(tmp, name);
    fs.mkdirSync(path.join(r, 'src'), { recursive: true });
    fs.writeFileSync(path.join(r, 'src', 'a.ts'), 'export const a = 1;\n');
    execFileSync('git', ['-C', r, 'init', '-q']);
    if (origin) execFileSync('git', ['-C', r, 'remote', 'add', 'origin', origin]);
    execFileSync('git', ['-C', r, 'add', '-A']);
    execFileSync('git', ['-C', r, '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', 'a']);
    return r;
}

async function cg(...argv: string[]): Promise<{ rc: number; stdout: string }> {
    out = [];
    const rc = await main(argv);
    return { rc, stdout: out.join('') };
}

beforeEach(() => {
    tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cg-projects-')));
    saved = process.env.EVENT4U_CONFIG_HOME;
    process.env.EVENT4U_CONFIG_HOME = path.join(tmp, 'home');
    out = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((s: string | Uint8Array) => {
        out.push(String(s));
        return true;
    });
    vi.spyOn(process.stderr, 'write').mockImplementation((s: string | Uint8Array) => {
        out.push(String(s));
        return true;
    });
});
afterEach(() => {
    vi.restoreAllMocks();
    process.env.EVENT4U_CONFIG_HOME = saved;
    fs.rmSync(tmp, { recursive: true, force: true });
});

describe('registration by use (3.3)', () => {
    it('a build records its root with commit, languages and graph home', async () => {
        const r = repo('widget', 'https://github.com/Acme/widget.git');
        expect((await cg('build', '--root', r)).rc).toBe(0);
        const [e] = Object.values(readRegistry().projects);
        expect(e?.root).toBe(r);
        expect(e?.remote).toBe('github.com/Acme/widget');
        expect(e?.graph_home).toBe(graphHome(r).dir);
        expect(e?.graph_commit).toBe(execFileSync('git', ['-C', r, 'rev-parse', 'HEAD'], { encoding: 'utf-8' }).trim());
        expect(e?.languages).toEqual(['typescript']);
    });

    it('a refresh records its root too', async () => {
        const r = repo('w2');
        expect((await cg('refresh', '--root', r)).rc).toBe(0);
        expect(Object.values(readRegistry().projects).map((e) => e.root)).toEqual([r]);
    }, 60_000);
});

describe('code-graph projects list|add|remove|prune', () => {
    it('add registers a path by hand and list shows it', async () => {
        const r = repo('handmade');
        expect((await cg('projects', 'add', r)).rc).toBe(0);
        const list = await cg('projects', 'list');
        expect(list.rc).toBe(0);
        expect(list.stdout).toContain(r);
        const [id] = Object.keys(readRegistry().projects);
        expect(list.stdout).toContain(id);
    });

    it('add refuses a path that does not exist', async () => {
        expect((await cg('projects', 'add', path.join(tmp, 'nope'))).rc).toBe(1);
        expect(readRegistry().projects).toEqual({});
    });

    it('remove drops one entry by id, name or path, and refuses an ambiguous name', async () => {
        const a = repo(path.join('x', 'same'), 'https://github.com/A/same.git');
        const b = repo(path.join('y', 'same'), 'https://github.com/B/same.git');
        const c = repo('other');
        for (const p of [a, b, c]) recordProject(p);
        expect((await cg('projects', 'remove', 'same')).rc).toBe(1);
        expect(Object.keys(readRegistry().projects)).toHaveLength(3);
        expect((await cg('projects', 'remove', 'other')).rc).toBe(0);
        expect((await cg('projects', 'remove', a)).rc).toBe(0);
        const [idB] = Object.keys(readRegistry().projects);
        expect((await cg('projects', 'remove', idB!)).rc).toBe(0);
        expect(readRegistry().projects).toEqual({});
        expect((await cg('projects', 'remove', 'other')).rc).toBe(1);
    });

    it('prune removes only roots missing past the threshold', async () => {
        const keep = repo('keep');
        const goneOld = repo('gone-old');
        const goneNew = repo('gone-new');
        for (const p of [keep, goneOld, goneNew]) recordProject(p);
        updateRegistry((reg) => {
            for (const e of Object.values(reg.projects)) if (e.root === goneOld) e.last_seen = '2026-01-01T00:00:00.000Z';
        });
        fs.rmSync(goneOld, { recursive: true });
        fs.rmSync(goneNew, { recursive: true });
        expect((await cg('projects', 'prune')).rc).toBe(0);
        expect(Object.values(readRegistry().projects).map((e) => e.root).sort()).toEqual([goneNew, keep].sort());
    });

    it('rejects an unknown verb', async () => {
        expect((await cg('projects', 'crawl')).rc).toBe(2);
    });
});

describe('no crawl', () => {
    it('the registry and its CLI never walk a directory tree', () => {
        for (const f of ['src/scripts/_lib/project_registry.ts', 'src/scripts/code_graph/projects_cli.ts']) {
            const src = fs.readFileSync(path.resolve(f), 'utf-8');
            expect(src, f).not.toMatch(/\b(readdirSync|readdir|opendirSync|opendir|globSync|glob)\s*\(|os\.homedir\s*\(|\bhomedir\s*\(/);
        }
    });
});
