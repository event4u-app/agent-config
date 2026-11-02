// The four outward rows of check_web_launch_readiness, scored against the
// corpus frozen before they existed (road-to-a-page-that-says-what-it-loads 2.x,
// claim:third-party-load-finds-planted).
import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { audit, type Report } from '../../src/scripts/check_web_launch_readiness';
import { loadRegister } from '../../src/scripts/web_launch_third_party';

const REPO = path.resolve(__dirname, '..', '..');
const CORPUS = path.join(REPO, 'tests', 'fixtures', 'third-party-load');
const ROWS = [
    'third-party-load-in-markup',
    'superseded-statute-in-legal-page',
    'placeholder-in-legal-page',
    'privacy-page-provider-coverage',
];

interface Truth {
    findings: { id: string; check: string; file: string; line?: number; provider?: string }[];
    undecided: { check: string; file: string; line: number }[];
}
const truth = JSON.parse(fs.readFileSync(path.join(CORPUS, 'ground-truth.json'), 'utf8')) as Truth;

const run = (build: string, region: 'de' | 'unspecified' = 'unspecified'): Report =>
    audit(path.join(CORPUS, build), 'local-business', REPO, region);
const ours = <T extends { check: string }>(xs: T[]): T[] => xs.filter((x) => ROWS.includes(x.check));

describe('planted build', () => {
    const r = run('planted');
    const findings = ours(r.findings);

    it('finds every planted entry at its recorded file and line', () => {
        for (const t of truth.findings) {
            const rel = t.file.replace(/^planted\//, '');
            const hit = findings.find(
                (f) =>
                    f.check === t.check &&
                    f.location.startsWith(`${rel}:`) &&
                    (t.line === undefined || f.location === `${rel}:${String(t.line)}`) &&
                    (t.provider === undefined || f.evidence.includes(t.provider)),
            );
            expect(hit, t.id).toBeDefined();
        }
    });

    it('reports nothing outside the ground truth', () => {
        expect(findings).toHaveLength(truth.findings.length);
    });

    it('nocookie is a load, not an exit', () => {
        expect(findings.some((f) => f.evidence.includes('www.youtube-nocookie.com'))).toBe(true);
    });

    it('the DE region raises the rows to the tiers decision E4 set', () => {
        const de = ours(run('planted', 'de').findings);
        const tier = (id: string): string | undefined => de.find((f) => f.check === id)?.tier;
        expect(tier('third-party-load-in-markup')).toBe('high');
        expect(tier('privacy-page-provider-coverage')).toBe('high');
        expect(tier('superseded-statute-in-legal-page')).toBe('critical');
        expect(tier('placeholder-in-legal-page')).toBe('critical');
    });
});

describe('safe twins and decoys', () => {
    it('no safe twin is flagged and nothing is undecided', () => {
        const r = run('safe');
        expect(ours(r.findings)).toEqual([]);
        expect(ours(r.unknown)).toEqual([]);
        for (const id of ROWS) expect(r.passed, id).toContain(id);
    });

    it('no decoy is flagged; the dns-prefetch line is undecided, not a finding', () => {
        const r = run('decoys');
        expect(ours(r.findings)).toEqual([]);
        const und = ours(r.unknown);
        for (const u of truth.undecided) {
            const rel = u.file.replace(/^decoys\//, '');
            expect(und.some((x) => x.check === u.check && x.location === `${rel}:${String(u.line)}`)).toBe(true);
        }
        expect(und).toHaveLength(truth.undecided.length);
    });
});

describe('the register', () => {
    it('loads, and a lapsed review_by fails it', () => {
        expect(loadRegister(REPO, '2026-11-02').length).toBeGreaterThan(0);
        expect(() => loadRegister(REPO, '2999-01-01')).toThrow(/lapsed/);
    });

    it('carries every origin ANALYTICS_RE already names — one list, not two', () => {
        const hosts = loadRegister(REPO, '2026-11-02').map((r) => r.host);
        for (const h of ['www.googletagmanager.com', 'www.google-analytics.com', 'plausible.io', 'cdn.segment.com', 'static.hotjar.com']) {
            expect(hosts, h).toContain(h);
        }
    });

    it('removing the gate marker turns the click-to-load twin into a finding — the undecide does the work', () => {
        const tmp = fs.mkdtempSync(path.join(REPO, 'agents', 'runtime', 'tmp-tpl-'));
        try {
            fs.writeFileSync(
                path.join(tmp, 'kontakt.html'),
                '<!doctype html><html lang="de"><head><title>K</title></head><body>\n' +
                    '<div class="click-to-load"><iframe src="https://www.google.com/maps/embed?pb=1"></iframe></div>\n</body></html>\n',
            );
            const gated = audit(tmp, 'local-business', REPO);
            expect(ours(gated.unknown).some((u) => u.check === 'third-party-load-in-markup')).toBe(true);
            expect(ours(gated.findings).some((f) => f.check === 'third-party-load-in-markup')).toBe(false);
            fs.writeFileSync(
                path.join(tmp, 'kontakt.html'),
                '<!doctype html><html lang="de"><head><title>K</title></head><body>\n' +
                    '<div><iframe src="https://www.google.com/maps/embed?pb=1"></iframe></div>\n</body></html>\n',
            );
            const open = audit(tmp, 'local-business', REPO);
            expect(ours(open.findings).some((f) => f.check === 'third-party-load-in-markup')).toBe(true);
        } finally {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
    });
});
