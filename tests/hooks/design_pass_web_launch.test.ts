// Rows 2.1 and 2.2 of check_web_launch_readiness reach the agent at write time
// through design_pass_hook's post_tool_use pass (road-to-a-page-check-at-write-time 1.1).
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    WEB_LAUNCH_MAX_CHARS,
    WEB_LAUNCH_RE,
    isPassSurface,
    withDegradation,
    type PassResult,
} from '../../src/scripts/hooks/design_pass_hook';
import { scanWebLaunch } from '../../src/scripts/hooks/web_launch_rows';
import { WEB_LAUNCH_CHUNK, loadWebLaunchScan } from '../../src/scripts/hooks/web_launch_rows_loader';

const CORPUS = path.resolve(__dirname, '..', 'fixtures', 'third-party-load');
const read = (rel: string): string => fs.readFileSync(path.join(CORPUS, rel), 'utf8');

describe('design_pass_hook — web-launch rows at write time', () => {
    it('reads exactly the written .html/.css files, and they are pass surfaces', () => {
        for (const p of ['site/index.html', 'site/a.htm', 'site/css/site.css']) {
            expect(WEB_LAUNCH_RE.test(p), p).toBe(true);
            expect(isPassSurface(p), p).toBe(true);
        }
        expect(WEB_LAUNCH_RE.test('app/layout.tsx')).toBe(false);
        expect(WEB_LAUNCH_RE.test('logo.svg')).toBe(false);
    });

    it('a page loading Google Fonts surfaces the preconnect and the stylesheet, advisory P2', () => {
        const f = scanWebLaunch('index.html', read('planted/index.html'));
        expect(f.map((x) => [x.rule, x.line])).toEqual([
            ['third-party-load-in-markup', 6],
            ['third-party-load-in-markup', 7],
        ]);
        expect(f.every((x) => x.severity === 'P2' && x.file === 'index.html')).toBe(true);
    });

    it('a stylesheet @import of the provider surfaces its line', () => {
        expect(scanWebLaunch('css/site.css', read('planted/css/site.css')).map((x) => x.line)).toEqual([1]);
    });

    it('an imprint citing the superseded statute surfaces it', () => {
        const f = scanWebLaunch('impressum.html', read('planted/impressum.html'));
        expect(f.some((x) => x.rule === 'superseded-statute-in-legal-page' && x.line === 6)).toBe(true);
    });

    it('the safe twins surface nothing', () => {
        for (const rel of ['index.html', 'css/site.css', 'kontakt.html', 'ueber-uns.html', 'impressum.html']) {
            expect(scanWebLaunch(rel, read(`safe/${rel}`)), rel).toEqual([]);
        }
    });

    it('the input cap is one megabyte of characters', () => {
        expect(WEB_LAUNCH_MAX_CHARS).toBe(1_000_000);
    });
});

describe('the loader', () => {
    it('unbundled, returns null (the hook then neither scans nor reports a gap)', () => {
        expect(loadWebLaunchScan(import.meta.url, false)).toBeNull();
    });

    it('bundled, reads scanWebLaunch from the chunk beside it, and null when absent', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wl-chunk-'));
        try {
            const self = pathToFileURL(path.join(dir, 'dispatch.js')).href;
            expect(loadWebLaunchScan(self, true)).toBeNull();
            fs.writeFileSync(path.join(dir, WEB_LAUNCH_CHUNK), 'exports.scanWebLaunch = () => [{ rule: "x", line: 1 }];');
            expect(loadWebLaunchScan(self, true)?.('a.html', '')).toHaveLength(1);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });
});

describe('withDegradation — an unchecked file is never a clean pass', () => {
    const base: PassResult = { slot: 'post_tool_use', findings: [], blocked: [], audit_missing: [], verification: 'verified' };

    it('marks the pass degraded with the reason', () => {
        expect(withDegradation(base, 'r1')).toMatchObject({ verification: 'degraded', degradation_reason: 'r1' });
    });

    it('appends to an earlier reason rather than replacing it', () => {
        expect(withDegradation(withDegradation(base, 'r1'), 'r2').degradation_reason).toBe('r1; r2');
    });
});
