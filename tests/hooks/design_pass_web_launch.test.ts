// road-to-a-page-that-says-what-it-loads 4.2: rows 2.1 and 2.2 reach the agent
// at write time through design_pass_hook's post_tool_use pass.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { isPassSurface, webLaunchFindings as viaHook } from '../../src/scripts/hooks/design_pass_hook';
import { scanWebLaunch } from '../../src/scripts/hooks/web_launch_rows';
import { WEB_LAUNCH_CHUNK, loadWebLaunchScan } from '../../src/scripts/hooks/web_launch_rows_loader';

const webLaunchFindings = (rel: string, content: string) => viaHook(rel, content, scanWebLaunch);

const CORPUS = path.resolve(__dirname, '..', 'fixtures', 'third-party-load');
const read = (rel: string): string => fs.readFileSync(path.join(CORPUS, rel), 'utf8');

describe('design_pass_hook — web-launch rows at write time', () => {
    it('the written files are pass surfaces', () => {
        expect(isPassSurface('site/index.html')).toBe(true);
        expect(isPassSurface('site/css/site.css')).toBe(true);
    });

    it('a page loading Google Fonts surfaces the load, advisory', () => {
        const f = webLaunchFindings('index.html', read('planted/index.html'));
        expect(f.map((x) => [x.rule, x.line])).toEqual([
            ['third-party-load-in-markup', 6],
            ['third-party-load-in-markup', 7],
        ]);
        expect(f.every((x) => x.severity === 'P2')).toBe(true);
    });

    it('a stylesheet @import of the provider surfaces too', () => {
        expect(webLaunchFindings('css/site.css', read('planted/css/site.css')).map((x) => x.line)).toEqual([1]);
    });

    it('an imprint citing the superseded statute surfaces it', () => {
        const f = webLaunchFindings('impressum.html', read('planted/impressum.html'));
        expect(f.some((x) => x.rule === 'superseded-statute-in-legal-page' && x.line === 6)).toBe(true);
    });

    it('the safe twins surface nothing', () => {
        for (const rel of ['index.html', 'css/site.css', 'kontakt.html', 'ueber-uns.html', 'impressum.html']) {
            expect(webLaunchFindings(rel, read(`safe/${rel}`)), rel).toEqual([]);
        }
    });

    it('a non-markup file is never read for these rows', () => {
        expect(webLaunchFindings('app/layout.tsx', read('decoys/app/layout.tsx'))).toEqual([]);
    });

    it('unbundled, the loader returns null and the hook stays silent rather than throwing', () => {
        expect(loadWebLaunchScan(import.meta.url, false)).toBeNull();
        expect(viaHook('index.html', read('planted/index.html'), null)).toEqual([]);
    });

    it('bundled, the loader reads scanWebLaunch from the chunk beside it, and null when absent', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wl-chunk-'));
        try {
            const self = new URL(`file://${path.join(dir, 'dispatch.js')}`).href;
            expect(loadWebLaunchScan(self, true)).toBeNull();
            fs.writeFileSync(path.join(dir, WEB_LAUNCH_CHUNK), 'exports.scanWebLaunch = () => [{ check: "x", file: "f", line: 1, text: "t" }];');
            const scan = loadWebLaunchScan(self, true);
            expect(scan).not.toBeNull();
            expect(scan!('a.html', '')).toHaveLength(1);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });
});
