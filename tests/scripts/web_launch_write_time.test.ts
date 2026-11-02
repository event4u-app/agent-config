// writeTimeFindings: rows 2.1 and 2.2 over ONE written file — the function a
// write-time carrier calls. The carrier itself (design_pass_hook) is carried to
// later/road-to-a-page-check-at-write-time; this pins the function it will call.
import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { loadConfig } from '../../src/scripts/check_web_launch_readiness';
import { loadRegister, writeTimeFindings } from '../../src/scripts/web_launch_third_party';

const REPO = path.resolve(__dirname, '..', '..');
const CORPUS = path.join(REPO, 'tests', 'fixtures', 'third-party-load');
const register = loadRegister(REPO, '2026-11-02');
const table = loadConfig(REPO).supersessions;
const scan = (rel: string, file: string) =>
    writeTimeFindings(rel, fs.readFileSync(path.join(CORPUS, file), 'utf8'), register, table);

describe('writeTimeFindings', () => {
    it('a page loading Google Fonts yields the preconnect and the stylesheet', () => {
        expect(scan('index.html', 'planted/index.html').map((h) => [h.check, h.line])).toEqual([
            ['third-party-load-in-markup', 6],
            ['third-party-load-in-markup', 7],
        ]);
    });

    it('a stylesheet @import of the provider yields its line', () => {
        expect(scan('css/site.css', 'planted/css/site.css').map((h) => h.line)).toEqual([1]);
    });

    it('an imprint citing the superseded statute yields it', () => {
        expect(scan('impressum.html', 'planted/impressum.html').some((h) => h.check === 'superseded-statute-in-legal-page' && h.line === 6)).toBe(true);
    });

    it('the safe twins yield nothing', () => {
        for (const rel of ['index.html', 'css/site.css', 'kontakt.html', 'ueber-uns.html', 'impressum.html']) {
            expect(scan(rel, `safe/${rel}`), rel).toEqual([]);
        }
    });

    it('a non-markup file is never read', () => {
        expect(scan('app/layout.tsx', 'decoys/app/layout.tsx')).toEqual([]);
    });
});
