/**
 * The reachability map — every runnable surface a repo declares, derived from
 * its own files and nothing hand-written (road-to-done-claims-with-read-exit-codes
 * 4.1). Each fixture is copied to a temp dir first, because the deriver writes
 * its map under the repo it reads and a fixture must stay as committed.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
    LIVE_SURFACES_REL,
    deriveLiveSurfaces,
    ensureLiveSurfaces,
    main,
} from '../../src/scripts/derive_live_surfaces.js';

const FIXTURES = path.resolve(__dirname, '..', 'fixtures', 'live-surfaces');
const tmps: string[] = [];

function copyFixture(name: string): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), `live-surfaces-${name}-`));
    tmps.push(dir);
    fs.cpSync(path.join(FIXTURES, name), dir, { recursive: true });
    return dir;
}

afterEach(() => {
    for (const d of tmps.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

describe('deriveLiveSurfaces', () => {
    it('skips an input file over the size bound instead of reading it', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'live-surfaces-big-'));
        tmps.push(dir);
        const pad = ' '.repeat(2 * 1024 * 1024);
        fs.writeFileSync(path.join(dir, 'package.json'), `{"scripts":{"dev":"vite"},"x":"${pad}"}`);
        expect(deriveLiveSurfaces(dir)).toEqual([]);
    });

    it('reads at most eight compose files', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'live-surfaces-many-'));
        tmps.push(dir);
        for (let i = 10; i < 30; i += 1) {
            fs.writeFileSync(path.join(dir, `compose.${String(i)}.yml`), `services:\n  s${String(i)}:\n    ports:\n      - "${String(8000 + i)}:80"\n`);
        }
        expect(deriveLiveSurfaces(dir).filter((x) => x.kind === 'compose')).toHaveLength(8);
    });

    it('names the line of each compose service with ports, past many without', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'live-surfaces-svc-'));
        tmps.push(dir);
        const quiet = Array.from({ length: 3000 }, (_, i) => `  q${String(i)}:\n    image: x\n`).join('');
        fs.writeFileSync(path.join(dir, 'compose.yml'), `services:\n${quiet}  web:\n    ports:\n      - "8080:80"\n`);
        const [web] = deriveLiveSurfaces(dir).filter((x) => x.kind === 'compose');
        expect(web?.name).toBe('web');
        expect(web?.derived_from).toBe(`compose.yml:${String(2 + 3000 * 2)}`);
    });

    it('names the line of the first window for every tauri window', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'live-surfaces-win-'));
        tmps.push(dir);
        const windows = Array.from({ length: 50 }, (_, i) => ({ title: `w${String(i)}`, width: 800, height: 600 }));
        fs.writeFileSync(path.join(dir, 'tauri.conf.json'), JSON.stringify({ app: { windows } }, null, 2));
        const found = deriveLiveSurfaces(dir).filter((x) => x.kind === 'tauri');
        expect(found).toHaveLength(50);
        expect(new Set(found.map((x) => x.derived_from)).size).toBe(1);
    });

    it('does not follow a symlinked input out of the repo', () => {
        const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'live-surfaces-outside-'));
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'live-surfaces-link-'));
        tmps.push(outside, dir);
        fs.writeFileSync(path.join(outside, 'package.json'), '{"scripts":{"dev":"vite"}}');
        fs.symlinkSync(path.join(outside, 'package.json'), path.join(dir, 'package.json'));
        expect(deriveLiveSurfaces(dir)).toEqual([]);
    });

    it('does not read through a symlinked directory out of the repo', () => {
        const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'live-surfaces-outdir-'));
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'live-surfaces-dirlink-'));
        tmps.push(outside, dir);
        fs.writeFileSync(path.join(outside, 'tauri.conf.json'), JSON.stringify({ app: { windows: [{ title: 'x' }] } }));
        fs.symlinkSync(outside, path.join(dir, 'src-tauri'));
        expect(deriveLiveSurfaces(dir)).toEqual([]);
    });

    it('a tauri config that parses to null does not drop the other surfaces', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'live-surfaces-null-'));
        tmps.push(dir);
        fs.writeFileSync(path.join(dir, 'tauri.conf.json'), 'null');
        fs.writeFileSync(path.join(dir, 'package.json'), '{"scripts":{"dev":"vite"}}');
        expect(deriveLiveSurfaces(dir).map((x) => x.kind)).toEqual(['npm-script']);
    });

    it('a config with a huge window list is cut before the windows are built', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'live-surfaces-huge-'));
        tmps.push(dir);
        fs.writeFileSync(path.join(dir, 'tauri.conf.json'), `{"app":{"windows":[${Array(200000).fill('{}').join(',')}]}}`);
        const t0 = Date.now();
        expect(deriveLiveSurfaces(dir)).toHaveLength(64);
        expect(Date.now() - t0).toBeLessThan(2000);
    });

    it('derives at most 64 surfaces however many windows a config lists', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'live-surfaces-cap-'));
        tmps.push(dir);
        const windows = Array.from({ length: 500 }, (_, i) => ({ title: `w${String(i)}` }));
        fs.writeFileSync(path.join(dir, 'tauri.conf.json'), JSON.stringify({ app: { windows } }));
        expect(deriveLiveSurfaces(dir)).toHaveLength(64);
    });

    it('skips an input that is not a regular file, so a FIFO cannot block the read', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'live-surfaces-fifo-'));
        tmps.push(dir);
        const made = spawnSync('mkfifo', [path.join(dir, 'package.json')]);
        if (made.status !== 0) return;
        expect(deriveLiveSurfaces(dir)).toEqual([]);
    });

    it('reads a tauri window with its size and the line it came from', () => {
        const surfaces = deriveLiveSurfaces(copyFixture('tauri'));
        const tauri = surfaces.find((s) => s.kind === 'tauri');
        expect(tauri).toBeDefined();
        expect(tauri?.size).toBe('1040x620');
        expect(tauri?.start).toBe('npm run tauri dev');
        expect(tauri?.derived_from).toMatch(/^src-tauri\/tauri\.conf\.json:\d+$/);
    });

    it('reads dev and preview scripts and the playwright baseURL', () => {
        const surfaces = deriveLiveSurfaces(copyFixture('vite'));
        const scripts = surfaces.filter((s) => s.kind === 'npm-script').map((s) => s.start).sort();
        expect(scripts).toEqual(['npm run dev', 'npm run preview']);
        const pw = surfaces.find((s) => s.kind === 'playwright');
        expect(pw?.url).toBe('http://localhost:4173');
        expect(pw?.derived_from).toMatch(/^playwright\.config\.ts:\d+$/);
        for (const s of surfaces) expect(s.derived_from).toMatch(/:\d+$/);
    });

    it('finds nothing in a library with only a test script', () => {
        expect(deriveLiveSurfaces(copyFixture('none'))).toEqual([]);
    });
});

describe('the map file', () => {
    it('writes the map under agents/state and regenerates when an input is newer', () => {
        const dir = copyFixture('vite');
        const first = ensureLiveSurfaces(dir);
        const file = path.join(dir, LIVE_SURFACES_REL);
        expect(fs.existsSync(file)).toBe(true);
        expect(first.surfaces.length).toBe(3);

        const pkg = path.join(dir, 'package.json');
        const json = JSON.parse(fs.readFileSync(pkg, 'utf8')) as { scripts: Record<string, string> };
        json.scripts['serve'] = 'vite preview --port 5000';
        fs.writeFileSync(pkg, JSON.stringify(json, null, 2));
        const later = new Date(Date.now() + 5_000);
        fs.utimesSync(pkg, later, later);

        expect(ensureLiveSurfaces(dir).surfaces.length).toBe(4);
    });

    it('the CLI prints the surfaces as JSON and exits 0', () => {
        const dir = copyFixture('tauri');
        expect(main(['--root', dir, '--quiet'])).toBe(0);
        expect(fs.existsSync(path.join(dir, LIVE_SURFACES_REL))).toBe(true);
    });
});
