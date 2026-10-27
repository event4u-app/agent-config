import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildMap, HUB_SCRIPTS, renderHtml, VIEWER_SCRIPTS, VIEWER_STYLES, viewerScript } from '../../src/scripts/code_graph/map.js';
import { areaProblems, areaSummaryLines, KNOWLEDGE_AREA_IDS, type MapAreas } from '../../src/scripts/code_graph/map_areas.js';
import { sampleAreas, wit } from './code_graph_map_areas_fixture.js';

const VIEWER_DIR = path.join(path.dirname(new URL(import.meta.url).pathname), '..', '..', 'src', 'scripts', 'code_graph', 'map_viewer');
let root: string;

beforeEach(() => {
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cg-areas-')));
    fs.mkdirSync(path.join(root, 'agents'));
    for (const n of ['a', 'b', 'c', 'd']) fs.writeFileSync(path.join(root, `${n}.ts`), n === 'a' ? 'export const a = 1;\n' : `import { a } from './a';\nexport const ${n} = a;\n`);
});
afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

const sha = (s: string): string => createHash('sha256').update(s, 'utf-8').digest('base64');
const inlineScript = (html: string): string => html.slice(html.lastIndexOf('<script>') + '<script>'.length, html.lastIndexOf('</script>'));
const inlineStyle = (html: string): string => html.slice(html.indexOf('<style>') + '<style>'.length, html.indexOf('</style>'));

describe('the areas payload contract', () => {
    it('a payload of every area with sound witnesses has no problems', () => {
        expect(areaProblems(sampleAreas())).toEqual([]);
        expect(areaProblems({})).toEqual([]);
    });

    it('names each unsafe or unreadable witness and an unknown area', () => {
        const bad = (file: string, line = 3, hash = 'abcdef12', confirm = 'confirmed'): MapAreas => ({
            interfaces: {
                reader: 'r',
                completeness: 'complete',
                findings: [],
                services: [{ name: 's', protocol: 'rest', direction: 'outbound', configNames: [], operations: [], witness: { file, line, hash, confirm } as never }],
            },
        });
        expect(areaProblems(bad('/Users/someone/app/x.php')).join()).toMatch(/repository-relative/);
        expect(areaProblems(bad('C:/app/x.php')).join()).toMatch(/repository-relative/);
        expect(areaProblems(bad('app\\x.php')).join()).toMatch(/repository-relative/);
        expect(areaProblems(bad('app/../../etc/passwd')).join()).toMatch(/repository-relative/);
        expect(areaProblems(bad('app/x.php', 0)).join()).toMatch(/positive integer/);
        expect(areaProblems(bad('app/x.php', 1.5)).join()).toMatch(/positive integer/);
        expect(areaProblems(bad('app/x.php', 3, 'not hex!')).join()).toMatch(/hash must be hex/);
        expect(areaProblems(bad('app/x.php', 3, 'abcdef12', 'maybe')).join()).toMatch(/unknown confirm state/);
        expect(areaProblems({ projects: {} } as unknown as MapAreas)).toEqual(["unknown area 'projects'"]);
        // A finding's second witness is checked like any other.
        const areas = sampleAreas();
        areas.data!.findings[0]!.witnesses.push({ ...wit('x.php', 1), file: '/abs/x.php' });
        expect(areaProblems(areas)).toHaveLength(1);
    });

    it('summarises each area for MAP.md: counts, an empty read with its reason, or no reader at all', () => {
        const lines = areaSummaryLines(sampleAreas());
        expect(lines).toHaveLength(KNOWLEDGE_AREA_IDS.length);
        expect(lines[0]).toMatch(/^- data: 2 tables, 1 foreign key, 1 relation, 1 finding — migration replay \(partial read: counts are lower bounds\)$/);
        expect(lines[1]).toBe('- systems: no data yet — no reader for this area ran on this tree');
        expect(lines[2]).toMatch(/^- interfaces: 1 service, 1 operation, 0 findings — http clients$/);
        expect(lines[3]).toBe('- runtime: compose found nothing — no compose file in this tree');
        expect(lines[5]).toBe('- impact: no data yet — no reader for this area ran on this tree');
        expect(areaSummaryLines({}).every((l) => /no data yet/.test(l))).toBe(true);
    });
});

describe('map.json carries the areas section', () => {
    it('writes an empty section when no reader ran, and the page says so per area', async () => {
        const res = await buildMap(root, { areas: {} });
        const doc = JSON.parse(fs.readFileSync(path.join(res.outDir, 'code', 'map.json'), 'utf-8')) as { areas?: unknown; model?: unknown };
        expect(doc.areas).toEqual({});
        expect(fs.readFileSync(path.join(res.outDir, 'MAP.md'), 'utf-8')).toMatch(/## Knowledge areas[\s\S]*- data: no data yet/);
    });

    it('passes a payload through unchanged into map.json and the page data', async () => {
        const areas = sampleAreas();
        const res = await buildMap(root, { areas });
        const doc = JSON.parse(fs.readFileSync(path.join(res.outDir, 'code', 'map.json'), 'utf-8')) as { areas: MapAreas };
        expect(doc.areas).toEqual(areas);
        const html = fs.readFileSync(path.join(res.outDir, 'index.html'), 'utf-8');
        const block = html.slice(html.indexOf('id="map-data">') + 'id="map-data">'.length, html.indexOf('</script>'));
        expect((JSON.parse(block) as { areas: MapAreas }).areas).toEqual(areas);
        expect(fs.readFileSync(path.join(res.outDir, 'MAP.md'), 'utf-8')).toContain('- interfaces: 1 service, 1 operation');
    });

    it('refuses a payload with a host path and leaves the previous map in place', async () => {
        const first = await buildMap(root);
        const before = fs.readFileSync(path.join(first.outDir, 'code', 'map.json'), 'utf-8');
        const areas = sampleAreas();
        areas.data!.tables[0]!.witness.file = `${root}/database/x.php`;
        await expect(buildMap(root, { areas })).rejects.toThrow(/repository-relative/);
        expect(fs.readFileSync(path.join(first.outDir, 'code', 'map.json'), 'utf-8')).toBe(before);
    });
});

describe('the viewer is joined from its parts before it is hashed', () => {
    it('the CSP pins the hash of exactly the inline script and style the page carries', async () => {
        const res = await buildMap(root, { areas: sampleAreas() });
        const html = fs.readFileSync(path.join(res.outDir, 'index.html'), 'utf-8');
        const csp = /Content-Security-Policy" content="([^"]+)"/.exec(html)?.[1] ?? '';
        expect(csp).toContain(`script-src 'sha256-${sha(inlineScript(html))}'`);
        expect(csp).toContain(`style-src 'sha256-${sha(inlineStyle(html))}'`);
        expect(csp).toMatch(/^default-src 'none'; .*connect-src 'none'/);
        expect(inlineScript(html)).toBe(viewerScript());
    });

    it('every part file is in the script, once, in the declared order, inside one strict function', () => {
        const js = viewerScript();
        expect(js.startsWith("(function () {\n'use strict';\n")).toBe(true);
        expect(js.trimEnd().endsWith('})();')).toBe(true);
        let at = -1;
        for (const part of VIEWER_SCRIPTS) {
            const body = fs.readFileSync(path.join(VIEWER_DIR, part), 'utf-8');
            const i = js.indexOf(body);
            expect(i, part).toBeGreaterThan(at);
            expect(js.indexOf(body, i + 1), part).toBe(-1);
            at = i;
        }
        // No part of the viewer is left out of the join; the Projects area joins the hub's only.
        const onDisk = fs.readdirSync(VIEWER_DIR).filter((f) => f.endsWith('.js') || f.endsWith('.css')).sort();
        expect(onDisk).toEqual([...new Set([...VIEWER_SCRIPTS, ...HUB_SCRIPTS, ...VIEWER_STYLES])].sort());
        expect(HUB_SCRIPTS.filter((p) => !(VIEWER_SCRIPTS as readonly string[]).includes(p))).toEqual(['area_projects.js']);
        expect(js).not.toContain('AREA_MODULES.projects');
        expect(viewerScript(HUB_SCRIPTS)).toContain('AREA_MODULES.projects');
    });

    it('a change to one part changes the pinned hash', () => {
        const meta = { title: 'Map of x', commit: 'abc', state: 'fresh', summary: '' };
        const model = { version: 1, thresholds: {}, files: [], edges: [], guessEdges: [], areas: [], areaEdges: [], analyses: {} } as never;
        const a = /script-src '([^']+)'/.exec(renderHtml(model, meta))?.[1];
        const p = path.join(VIEWER_DIR, 'area_agent.js');
        const original = fs.readFileSync(p, 'utf-8');
        try {
            fs.writeFileSync(p, `${original}\n`);
            expect(/script-src '([^']+)'/.exec(renderHtml(model, meta))?.[1]).not.toBe(a);
        } finally {
            fs.writeFileSync(p, original);
        }
    });
});

describe('the shipped decisions stay in place under the new shell', () => {
    let html = '';
    let js = '';
    let css = '';
    beforeEach(async () => {
        html = fs.readFileSync(path.join((await buildMap(root)).outDir, 'index.html'), 'utf-8');
        js = inlineScript(html);
        css = inlineStyle(html);
    });

    it('1–2 the traced AC mark is the logo and icon, inline, with no image loaded', () => {
        expect(html).toMatch(/<svg class="logo" width="40" height="40" viewBox="0 0 172 172" role="img" aria-label="AC">/);
        expect(html).toContain('<linearGradient id="acRim"');
        expect(html).toContain('M74.4 47.4L75.6 47.9');
        expect(html).not.toMatch(/<img\b/);
        expect(html).toMatch(/img-src 'none'/);
    });

    it('3–4 side panels pin only from 1240 px, fly out with a scrim below it, never pin on a phone, and animate unless motion is reduced', () => {
        expect(js).toContain("return w <= 720 ? 'phone' : w < 1240 ? 'tablet' : 'wide';");
        expect(html).toContain('<div class="scrim" id="scrim" hidden></div>');
        expect(html).toContain('<div class="scrim" id="av-scrim" hidden></div>');
        expect(css).toMatch(/transition: transform 0\.2s ease, visibility 0\.2s;[\s\S]*prefers-reduced-motion: reduce/);
        expect(css).toContain('.wb.mode-phone .pane-pin { display: none; }');
        expect(css).toContain('.av-body.mode-phone #av-pin { display: none; }');
    });

    it('5 the area limit is a styled listbox, not a native select', () => {
        expect(html).toContain('<ul id="limlist" class="ddlist" role="listbox" hidden>');
        expect(html.replace(js, "")).not.toMatch(/<select[\s>]/);
    });

    it('6 the back trail keeps 50 steps and skips a step that changed nothing', () => {
        expect(js).toContain('if (trail.length > 50) trail.shift();');
        expect(js).toContain('while (prev && sameView(prev, snapshot())) prev = trail.pop();');
    });

    it('7 a control without data says so with its reason, and so does an area', () => {
        expect(js).toContain("b.setAttribute('title', t('noDataTitle')(reason));");
        expect(css).toContain('.nodata-tag {');
        expect(js).toContain("el('p', { class: 'reason' }, p ? p.empty : t('noReader')[id])");
    });

    it('8 guessed edges are dashed', () => {
        expect(js).toContain('ctx.setLineDash(dashed ? [4, 4] : []);');
        expect(js).toContain('if (state.showGuesses) drawEdges(model.guessEdges, true);');
    });

    it('9 fonts are the system stacks: nothing is fetched, no font source is allowed', () => {
        expect(html).not.toMatch(/fonts\.googleapis|fonts\.gstatic|@font-face|@import/);
        expect(html).not.toMatch(/font-src/);
        expect(html).not.toMatch(/\b(src|href)\s*=\s*["']?https?:/i);
    });

    it('10 the theme follows prefers-color-scheme', () => {
        expect(js).toContain("window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'");
    });

    it('11 the language follows the browser and both string tables exist', () => {
        expect(js).toContain("(navigator.language || 'en').toLowerCase().indexOf('de') === 0 ? 'de' : 'en'");
        expect(js).toMatch(/extendStrings\(\{\n\s+en: \{/);
    });

    it('12 the treemap is one bucket per folder', () => {
        expect(js).toContain("hTreemap: 'Area = lines per folder'");
        expect(js).toContain('state.treePath = state.treePath ? state.treePath + \'/\' + it.name : it.name;');
    });

    it('13 red is the handover --red token, --alert* stay aliases, and no link leads to the user-global hub', () => {
        expect(css).toMatch(/--red: #[0-9a-f]{6}; --redText: #[0-9a-f]{6}; --redTint:/);
        expect(css).toContain('--alert: var(--red); --alertText: var(--redText);');
        expect(html).not.toMatch(/Global ↗|\.event4u|estate/i);
    });

    it('the wordmark is KNOWLEDGE MAP and the nav names the eleven areas in the handover order', () => {
        expect(html).toContain('<div class="brand-name"><b>AGENT CONFIG</b><span>KNOWLEDGE MAP</span></div>');
        const routes = [...html.matchAll(/<a href="#\/(\w+)" data-route="\w+">/g)].map((m) => m[1]);
        expect(routes).toEqual(['overview', 'code', 'data', 'systems', 'interfaces', 'runtime', 'delivery', 'bugs', 'knowledge', 'impact', 'agent']);
    });
});
