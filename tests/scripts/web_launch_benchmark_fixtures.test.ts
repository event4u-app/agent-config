/**
 * The benchmark fixtures carry the defects their ground truth claims.
 *
 * `road-to-web-launch-readiness` 3.1. A ground-truth manifest that drifts from
 * the tree is worse than none: both arms would be scored against a target that
 * no longer describes what they read, and the drift would be invisible in the
 * scores. So every row in `GROUND-TRUTH.md` is asserted here against the actual
 * fixture, and the decoy's ABSENCE from the check set is asserted too.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { audit, loadConfig } from '../../src/scripts/check_web_launch_readiness';

const REPO = path.resolve(__dirname, '..', '..');
const BENCH = path.join(REPO, 'tests/fixtures/web-launch-benchmark');

const read = (p: string): string => fs.readFileSync(path.join(BENCH, p), 'utf8');
const exists = (p: string): boolean => fs.existsSync(path.join(BENCH, p));

describe('the three fixture sites exist and are what the manifest says', () => {
    it('all three are present, and no fourth has been added unrecorded', () => {
        const dirs = fs
            .readdirSync(BENCH, { withFileTypes: true })
            .filter((e) => e.isDirectory())
            .map((e) => e.name)
            .sort();
        expect(dirs).toEqual(['docs', 'local-business', 'saas-app']);
    });

    it('the ground truth is checked in and names every fixture', () => {
        const gt = read('GROUND-TRUTH.md');
        for (const d of ['local-business', 'saas-app', 'docs']) expect(gt).toContain(d);
    });
});

describe('local-business — the seeded rows are actually there', () => {
    it('1+2 the staging noindex AND the blanket disallow', () => {
        expect(read('local-business/index.html')).toContain('content="noindex, nofollow"');
        expect(read('local-business/robots.txt')).toMatch(/^Disallow: \/$/m);
    });

    it('3 no custom 404 anywhere', () => {
        expect(exists('local-business/404.html')).toBe(false);
    });

    it('4+5 two routes with no title and no description', () => {
        for (const f of ['local-business/sortiment.html', 'local-business/kontakt.html']) {
            expect(read(f)).not.toContain('<title>');
            expect(read(f)).not.toContain('name="description"');
        }
    });

    it('6 exactly three images with no alt', () => {
        const imgs = ['local-business/index.html', 'local-business/sortiment.html']
            .flatMap((f) => read(f).match(/<img\b[^>]*>/gi) ?? [])
            .filter((tag) => !/\balt\s*=/i.test(tag));
        expect(imgs).toHaveLength(3);
    });

    it('7 an Impressum WITHOUT a Datenschutz page — the DE half-miss', () => {
        // A check that only asked "is there a legal page" would pass this, and
        // it is the common real-world shape, which is why it is seeded.
        expect(exists('local-business/impressum.html')).toBe(true);
        const files = fs.readdirSync(path.join(BENCH, 'local-business'));
        expect(files.some((f) => /datenschutz|privacy/i.test(f))).toBe(false);
    });
});

describe('saas-app — the decoy fixture', () => {
    it('D the decoy is a missing TEAM PHOTO, and no check asks for one', () => {
        // The gate, asserted from the config rather than from memory: if a
        // future check ever did ask for team imagery, the decoy would stop
        // being a decoy and this benchmark would silently start scoring it.
        const ids = loadConfig(REPO).checks.map((c) => c.id);
        for (const id of ids) expect(id).not.toMatch(/team|photo|portrait|about-us/i);
        expect(read('GROUND-TRUTH.md')).toContain('no team photo');
    });

    it('the decoy is present in EXACTLY ONE fixture', () => {
        const mentions = ['local-business', 'saas-app', 'docs'].filter((d) =>
            fs
                .readdirSync(path.join(BENCH, d), { recursive: true })
                .some((f) => /team/i.test(String(f))),
        );
        // Zero directories carry a team asset — the decoy is an ABSENCE, and it
        // is scoped to saas-app by the ground truth, which names it once.
        expect(mentions).toEqual([]);
        const gt = read('GROUND-TRUTH.md');
        expect(gt.match(/DECOY/g) ?? []).toHaveLength(1);
    });

    it('8 an http:// script on a host they control', () => {
        expect(read('saas-app/index.html')).toContain('src="http://cdn.ledgerly.example');
    });

    it('13 the shell and the dashboard share one title', () => {
        const a = /<title>([^<]+)<\/title>/.exec(read('saas-app/index.html'))?.[1];
        const b = /<title>([^<]+)<\/title>/.exec(read('saas-app/app/dashboard.html'))?.[1];
        expect(a).toBe(b);
    });

    it('14 an imprint WITHOUT a privacy page', () => {
        expect(exists('saas-app/imprint.html')).toBe(true);
        expect(exists('saas-app/privacy.html')).toBe(false);
    });
});

describe('docs — the present-and-wrong canonical', () => {
    it('19 the canonical host appears nowhere in the sitemap', () => {
        const api = read('docs/api.html');
        const canonical = /rel="canonical"[^>]*href="https?:\/\/([^/"]+)/.exec(api)?.[1];
        expect(canonical).toBe('ledgerly.example');
        expect(read('docs/sitemap.xml')).not.toContain('https://ledgerly.example/');
        expect(read('docs/sitemap.xml')).toContain('docs.ledgerly.example');
    });

    it('17 both pages carry the identical title', () => {
        const a = /<title>([^<]+)<\/title>/.exec(read('docs/index.html'))?.[1];
        const b = /<title>([^<]+)<\/title>/.exec(read('docs/api.html'))?.[1];
        expect(a).toBe(b);
    });
});

describe('the skill arm scores non-trivially on all three, which is the precondition for a benchmark', () => {
    it.each([
        ['local-business', 'local-business'],
        ['saas-app', 'saas-app'],
        ['docs', 'docs'],
    ])('%s produces findings', (dir, siteType) => {
        const r = audit(path.join(BENCH, dir), siteType as never, REPO);
        expect(r.findings.length).toBeGreaterThan(0);
        // Not a scoring assertion — 3.2 has not run. This asserts only that the
        // fixture is READABLE by the arm, so an UNDERPOWERED verdict later
        // means the comparison failed rather than the fixture.
        expect(r.scanned_files).toBeGreaterThan(0);
    });

    it('and never flags anything decoy-shaped on the saas app', () => {
        const r = audit(path.join(BENCH, 'saas-app'), 'saas-app', REPO);
        for (const f of r.findings) expect(f.check).not.toMatch(/team|photo|portrait/i);
    });
});
