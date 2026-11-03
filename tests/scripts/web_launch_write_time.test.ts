// writeTimeFindings: rows 2.1 and 2.2 over ONE written file — the function a
// write-time carrier calls. The carrier itself (design_pass_hook) is carried to
// later/road-to-a-page-check-at-write-time; this pins the function it will call.
import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { loadConfig } from '../../src/scripts/check_web_launch_readiness';
import { classifyLoads, loadRegister, writeTimeFindings } from '../../src/scripts/web_launch_third_party';

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

    it('a canonical naming a registered provider does not make that provider the site itself', () => {
        const page = (canonical: string) =>
            `<html><head>\n<link rel="canonical" href="https://${canonical}/">\n` +
            '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter">\n</head><body></body></html>\n';
        for (const host of ['fonts.googleapis.com', 'FONTS.GOOGLEAPIS.COM']) {
            expect(writeTimeFindings('index.html', page(host), register, table).map((h) => [h.check, h.line]), host).toEqual([
                ['third-party-load-in-markup', 3],
            ]);
        }
        // The site's own host still suppresses its absolute self-references.
        const own = '<html><head>\n<link rel="canonical" href="https://example.com/">\n<script src="https://example.com/app.js"></script>\n</head></html>\n';
        expect(writeTimeFindings('index.html', own, register, table)).toEqual([]);
    });

    describe('a lazy-loaded data-src', () => {
        const img = '<img data-src="https://maps.googleapis.com/maps/api/staticmap?x" alt="Map">';
        const lazy = '<script src="/js/lazysizes.min.js"></script>';
        const gate = '<div class="click-to-load"></div>';
        const classify = (body: string) => {
            const c = classifyLoads([{ rel: 'index.html', base: 'index.html', text: body, lines: body.split('\n') }], register);
            return { findings: c.findings.map((h) => h.line), undecided: c.undecided.map((h) => h.line) };
        };

        it('with a lazy loader and no gate is a first-paint load, at write time too', () => {
            for (const loader of [lazy, '<img class="lazyload" alt="">', '<script>new IntersectionObserver(()=>{})</script>']) {
                const page = `${loader}\n${img}\n`;
                expect(classify(page), loader).toEqual({ findings: [2], undecided: [] });
                expect(writeTimeFindings('index.html', page, register, table).map((h) => [h.check, h.line]), loader).toEqual([
                    ['third-party-load-in-markup', 2],
                ]);
            }
        });

        it('with neither a loader nor a gate is undecided, never silent', () => {
            expect(classify(`${img}\n`)).toEqual({ findings: [], undecided: [1] });
        });

        it('behind a click-to-load gate without a loader is not a load', () => {
            expect(classify(`${gate}\n${img}\n`)).toEqual({ findings: [], undecided: [] });
        });

        it('with both a loader and a gate is undecided, as a gated src is', () => {
            expect(classify(`${lazy}\n${gate}\n${img}\n`)).toEqual({ findings: [], undecided: [3] });
        });

        it('a src beside a data-src is read once, as the src', () => {
            const both = '<img src="https://maps.googleapis.com/a" data-src="https://maps.googleapis.com/b" alt="">';
            expect(classify(`${lazy}\n${both}\n`)).toEqual({ findings: [2], undecided: [] });
        });
    });

    it('a non-markup file is never read', () => {
        expect(scan('app/layout.tsx', 'decoys/app/layout.tsx')).toEqual([]);
    });
});
