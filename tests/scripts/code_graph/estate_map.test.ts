import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { main } from '../../../src/scripts/code_graph/cli.js';
import { estateMapDir, renderEstateHtml } from '../../../src/scripts/code_graph/estate_map.js';
import { verifyMap } from '../../../src/scripts/code_graph/map_verify.js';
import { makeEstate } from './estate_fixture.js';

let tmp: string;
let saved: string | undefined;
let out: string[];

async function cg(...argv: string[]): Promise<number> {
    out = [];
    return main(argv);
}

beforeEach(() => {
    tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cg-estate-map-')));
    saved = process.env.EVENT4U_CONFIG_HOME;
    process.env.EVENT4U_CONFIG_HOME = path.join(tmp, 'home');
    out = [];
    const sink = (s: string | Uint8Array): boolean => {
        out.push(String(s));
        return true;
    };
    vi.spyOn(process.stdout, 'write').mockImplementation(sink);
    vi.spyOn(process.stderr, 'write').mockImplementation(sink);
});
afterEach(() => {
    vi.restoreAllMocks();
    process.env.EVENT4U_CONFIG_HOME = saved;
    fs.rmSync(tmp, { recursive: true, force: true });
});

async function indexEstate(): Promise<void> {
    const e = makeEstate(tmp, 2);
    expect(await cg('projects', 'index', 'on')).toBe(0);
    for (const r of [e.core, e.app, e.billing]) expect(await cg('build', '--root', r)).toBe(0);
}

describe('map --estate (5.4)', () => {
    it('writes one page under the user-global home, package edges solid and guesses dashed', async () => {
        await indexEstate();
        expect(await cg('map', '--estate', '--no-verify')).toBe(0);
        const page = path.join(estateMapDir(), 'index.html');
        expect(fs.readdirSync(estateMapDir())).toEqual(['index.html']);
        const html = fs.readFileSync(page, 'utf-8');
        expect(html).toContain('"via":"package"');
        expect(html).toContain('"via":"unique-name"');
        expect(html).toMatch(/line\.package\{[^}]*stroke-width:2\}/);
        expect(html).toMatch(/line\.guess\{[^}]*stroke-dasharray/);
        expect(html).not.toMatch(/(src|href)="https?:/);
    }, 120_000);

    it('passes the map render check', async () => {
        await indexEstate();
        expect(await cg('map', '--estate', '--no-verify')).toBe(0);
        const check = await verifyMap(path.join(estateMapDir(), 'index.html'));
        expect(check.verification, JSON.stringify(check)).not.toBe('failed');
        if (check.verification === 'verified') {
            expect(check.viewports.map((v) => v.name)).toEqual(['desktop', 'mobile-375', 'mobile-320']);
            for (const v of check.viewports) {
                expect(v.pageErrors + v.externalRequests).toBe(0);
                expect(v.horizontalScroll).toBe(false);
                expect(v.views.every((x) => x.labels === 3 && x.outside === 0 && x.overlapping === 0)).toBe(true);
            }
        }
    }, 180_000);

    it('is refused inside a git work tree, for --out and for a home that sits in one', async () => {
        await indexEstate();
        const repo = path.join(tmp, 'some-repo');
        fs.mkdirSync(repo);
        execFileSync('git', ['-C', repo, 'init', '-q']);
        expect(await cg('map', '--estate', '--out', path.join(repo, 'estate'), '--no-verify')).toBe(1);
        expect(out.join('')).toMatch(/refusing to write the estate map inside a git work tree/);
        expect(fs.existsSync(path.join(repo, 'estate'))).toBe(false);
        process.env.EVENT4U_CONFIG_HOME = path.join(repo, 'home');
        expect(await cg('map', '--estate', '--no-verify')).toBe(1);
        expect(fs.existsSync(path.join(repo, 'home', 'runtime', 'estate'))).toBe(false);
    }, 120_000);

    it('renders a hostile project name as data', () => {
        const html = renderEstateHtml({ projects: [{ id: 'a'.repeat(12), name: '</script><img src=x onerror=alert(1)>', indexed_at: 'x' }], edges: [] });
        expect(html).not.toContain('</script><img');
        expect(html).toContain('\\u003c/script>');
    });
});
