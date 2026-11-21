/**
 * The reachability map — every runnable surface a repo declares, derived from
 * its own files and nothing hand-written (road-to-done-claims-with-read-exit-codes
 * 4.1). Each fixture is copied to a temp dir first, because the deriver writes
 * its map under the repo it reads and a fixture must stay as committed.
 */
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
