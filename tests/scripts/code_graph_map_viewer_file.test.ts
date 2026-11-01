import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { openMap } from '../../src/scripts/code_graph/cli.js';
import { buildMap } from '../../src/scripts/code_graph/map.js';
import { ensureViewer, viewerFromStored } from '../../src/scripts/code_graph/map_viewer_file.js';

let root: string;
let mapDir: string;

function write(rel: string, body: string): void {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), body);
}

function git(...args: string[]): string {
    return execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { cwd: root, encoding: 'utf-8' });
}

interface PageData {
    meta: { commit: string; state: string; graph_generation?: string };
    model: { files: Array<{ path: string }>; areas: Array<{ id: string }>; edges: unknown[]; pin?: { commit: string; generation: string } };
    areas: Record<string, unknown>;
}

function pageData(html: string): PageData {
    const m = /<script type="application\/json" id="map-data">([\s\S]*?)<\/script>/.exec(html);
    if (!m?.[1]) throw new Error('no map-data block');
    return JSON.parse(m[1]) as PageData;
}

const page = (): string => fs.readFileSync(path.join(mapDir, 'index.html'), 'utf-8');
const manifest = (): { commit: string; generation: string; state: string } => JSON.parse(fs.readFileSync(path.join(mapDir, 'manifest.json'), 'utf-8'));

beforeEach(() => {
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cg-viewer-')));
    mapDir = path.join(root, 'agents', 'map');
    fs.mkdirSync(path.join(root, 'agents'));
    write('.gitignore', fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'config', 'gitignore-block.txt'), 'utf-8'));
    write('src/util/log.ts', 'export function log(m: string): void { void m; }\n');
    write('src/a.ts', "import { log } from './util/log.js';\nexport function a(): void { log('a'); }\n");
    write('src/b.ts', "import { a } from './a.js';\nexport function b(): void { a(); }\n");
    git('init', '-q');
    git('add', '-A');
    git('commit', '-qm', 'init');
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

describe('the viewer page is local and rendered from the committed map data (ADR-297 amendment 2)', () => {
    it('the consumer ignore block keeps index.html out of git while the map data is committed', async () => {
        await buildMap(root);
        git('add', '-A');
        const tracked = git('ls-files', 'agents/map').split('\n').filter(Boolean);
        expect(tracked).toContain('agents/map/code/map.json');
        expect(tracked).toContain('agents/map/manifest.json');
        expect(tracked).not.toContain('agents/map/index.html');
        expect(tracked.some((p) => p.startsWith('agents/map/.build/'))).toBe(false);
    });

    it('a redraw leaves a page that matches the data, so nothing re-renders it', async () => {
        await buildMap(root);
        const before = page();
        expect(ensureViewer(mapDir)).toBe('current');
        expect(page()).toBe(before);
    });

    it('a missing page — a fresh clone — is rendered from the stored data, commit and generation from the manifest', async () => {
        const drawn = await buildMap(root);
        const drawnData = pageData(page());
        fs.rmSync(path.join(mapDir, 'index.html'));
        expect(ensureViewer(mapDir)).toBe('rendered');
        const data = pageData(page());
        const man = manifest();
        expect(data.meta.commit).toBe(man.commit);
        expect(data.meta.graph_generation).toBe(man.generation);
        expect(data.model.pin?.commit).toBe(man.commit);
        expect(data.model.pin?.generation).toBe(man.generation);
        expect(data.model.files.map((f) => f.path)).toEqual(drawn.model.files.map((f) => f.path));
        expect(data.model.areas.map((a) => a.id)).toEqual(drawnData.model.areas.map((a) => a.id));
        expect(data.model.edges).toEqual(drawnData.model.edges);
        expect(Object.keys(data.areas).sort()).toEqual(Object.keys(drawnData.areas).filter((k) => k !== 'impact').sort());
        expect(ensureViewer(mapDir)).toBe('current');
    });

    it('committed data that changed without a redraw — a pull — re-renders the page once', async () => {
        await buildMap(root);
        const mapJson = path.join(mapDir, 'code', 'map.json');
        fs.writeFileSync(mapJson, fs.readFileSync(mapJson, 'utf-8').replace(/"summary": "[^"]*"/, '"summary": "pulled from another branch"'));
        expect(ensureViewer(mapDir)).toBe('rendered');
        expect(page()).toContain('pulled from another branch');
        expect(ensureViewer(mapDir)).toBe('current');
    });

    it('a manifest-only change — a redraw on another commit — re-renders the page with the new commit', async () => {
        await buildMap(root);
        const man = manifest();
        fs.writeFileSync(path.join(mapDir, 'manifest.json'), JSON.stringify({ ...man, commit: 'abcdef123456' }, null, 2));
        expect(ensureViewer(mapDir)).toBe('rendered');
        expect(pageData(page()).meta.commit).toBe('abcdef123456');
    });

    it('`code-graph open` renders a missing page before opening it', async () => {
        await buildMap(root);
        fs.rmSync(path.join(mapDir, 'index.html'));
        const opened: string[] = [];
        expect(await openMap(['--root', root], async (t) => opened.push(t))).toBe(0);
        expect(opened).toEqual([path.join(mapDir, 'index.html')]);
        expect(pageData(page()).meta.commit).toBe(manifest().commit);
    });

    it('no map, no page: nothing is written', () => {
        expect(ensureViewer(mapDir)).toBe('no-map');
        expect(viewerFromStored(mapDir)).toBeNull();
        expect(fs.existsSync(path.join(mapDir, 'index.html'))).toBe(false);
    });
});
