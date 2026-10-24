import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    emptyRegistry,
    findProjects,
    readRegistry,
    repoIdOf,
    recordProject,
    registryPath,
    writeRegistry,
} from '../../../src/scripts/_lib/project_registry.js';

let tmp: string;
let dir: string;

beforeEach(() => {
    tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'project-registry-')));
    dir = path.join(tmp, 'projects');
});
afterEach(() => {
    fs.chmodSync(tmp, 0o700);
    if (fs.existsSync(dir)) fs.chmodSync(dir, 0o700);
    fs.rmSync(tmp, { recursive: true, force: true });
});

function repo(name: string, origin?: string): string {
    const r = path.join(tmp, name);
    fs.mkdirSync(r, { recursive: true });
    execFileSync('git', ['-C', r, 'init', '-q']);
    if (origin) execFileSync('git', ['-C', r, 'remote', 'add', 'origin', origin]);
    return r;
}

describe('project registry (3.1)', () => {
    it('lives at runtime/projects/registry.json under the user-global root by default', () => {
        expect(registryPath({ EVENT4U_CONFIG_HOME: path.join(tmp, 'h') })).toBe(
            path.join(tmp, 'h', 'runtime', 'projects', 'registry.json'),
        );
    });

    it('records a project keyed by repo id and checkout and reads it back', () => {
        const r = repo('widget', 'https://x-access-token:SECRET@github.com/Acme/widget.git');
        const now = new Date('2026-10-24T10:00:00Z');
        const id = recordProject(r, { languages: ['typescript'], providers: ['express'], graph_commit: 'abc123' }, { dir, now });
        expect(id).toMatch(/^[0-9a-f]{12}-[0-9a-f]{8}$/);
        const reg = readRegistry({ dir });
        const e = reg.projects[id];
        expect(e).toMatchObject({
            root: r,
            remote: 'github.com/Acme/widget',
            last_seen: now.toISOString(),
            languages: ['typescript'],
            providers: ['express'],
            graph_commit: 'abc123',
            pinned: false,
        });
        expect(fs.readFileSync(registryPath(undefined, dir), 'utf-8')).not.toContain('SECRET');
    });

    it('updates an entry in place instead of adding a second one', () => {
        const r = repo('w', 'git@github.com:Acme/w.git');
        recordProject(r, { languages: ['php'] }, { dir, now: new Date('2026-10-01T00:00:00Z') });
        recordProject(r, { graph_commit: 'def' }, { dir, now: new Date('2026-10-02T00:00:00Z') });
        const reg = readRegistry({ dir });
        expect(Object.keys(reg.projects)).toHaveLength(1);
        const e = Object.values(reg.projects)[0]!;
        expect(e.languages).toEqual(['php']);
        expect(e.graph_commit).toBe('def');
        expect(e.last_seen).toBe('2026-10-02T00:00:00.000Z');
    });

    it('writes atomically: no temp file survives, and a failed write leaves the old file whole', () => {
        const reg = emptyRegistry();
        writeRegistry(reg, { dir });
        const before = fs.readFileSync(registryPath(undefined, dir), 'utf-8');
        expect(fs.readdirSync(dir).filter((f) => f.includes('.tmp'))).toEqual([]);
        fs.chmodSync(dir, 0o500);
        expect(() => writeRegistry({ ...reg, index: true }, { dir })).toThrow();
        fs.chmodSync(dir, 0o700);
        expect(fs.readFileSync(registryPath(undefined, dir), 'utf-8')).toBe(before);
    });

    it('reads a corrupt or foreign file as an empty registry', () => {
        fs.mkdirSync(dir, { recursive: true });
        for (const bad of ['{not json', '[]', '{"schema":99}', '']) {
            fs.writeFileSync(registryPath(undefined, dir), bad);
            expect(readRegistry({ dir })).toEqual(emptyRegistry());
        }
        expect(readRegistry({ dir: path.join(tmp, 'absent') })).toEqual(emptyRegistry());
    });

    it('gives two clones of one origin their own entries under one repo id', () => {
        const a = repo('clone-a', 'https://github.com/Acme/widget.git');
        const b = repo('clone-b', 'git@github.com:Acme/widget.git');
        const ia = recordProject(a, { graph_commit: 'aaa', languages: ['php'] }, { dir });
        const ib = recordProject(b, { graph_commit: 'bbb', languages: ['go'] }, { dir });
        expect(ia).not.toBe(ib);
        expect(repoIdOf(ia)).toBe(repoIdOf(ib));
        recordProject(a, { graph_commit: 'aaa2' }, { dir });
        const reg = readRegistry({ dir });
        expect(Object.keys(reg.projects).sort()).toEqual([ia, ib].sort());
        expect(reg.projects[ia]).toMatchObject({ root: a, graph_commit: 'aaa2', languages: ['php'] });
        expect(reg.projects[ib]).toMatchObject({ root: b, graph_commit: 'bbb', languages: ['go'] });
        expect(findProjects(reg, repoIdOf(ia)).map(([id]) => id).sort()).toEqual([ia, ib].sort());
    });

    it('still loads a registry keyed by a bare repo id, as that repo\'s main checkout', () => {
        const r = repo('legacy', 'https://github.com/Acme/legacy.git');
        const bare = repoIdOf(recordProject(r, {}, { dir }));
        const reg = emptyRegistry();
        reg.projects[bare] = {
            root: r,
            remote: 'github.com/Acme/legacy',
            fingerprint: 'fp',
            last_seen: '2026-10-01T00:00:00.000Z',
            graph_home: null,
            graph_commit: 'old',
            languages: ['ruby'],
            providers: [],
            pinned: true,
            homes: {},
        };
        writeRegistry(reg, { dir });
        expect(readRegistry({ dir }).projects[bare]?.root).toBe(r);
        expect(findProjects(readRegistry({ dir }), bare).map(([, e]) => e.root)).toEqual([r]);
        const id = recordProject(r, { graph_commit: 'new' }, { dir });
        const after = readRegistry({ dir });
        expect(Object.keys(after.projects)).toEqual([id]);
        expect(after.projects[id]).toMatchObject({ root: r, fingerprint: 'fp', graph_commit: 'new', languages: ['ruby'], pinned: true });
    });

    it('defaults to the index off and a 2048 MB budget', () => {
        expect(emptyRegistry()).toMatchObject({ index: false, budget_mb: 2048, projects: {} });
    });
});
