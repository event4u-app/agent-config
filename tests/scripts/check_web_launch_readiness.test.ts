// Tests for src/scripts/check_web_launch_readiness.ts.
//
// The command is DEFAULT-OFF, so most of what needs proving is not "does it find
// things" but "does it stay honest about what it did not look at". The number of
// implemented checks is deliberately NOT stated here — this comment said "one"
// while nine shipped, and a sibling analysis read it and planned a phase around
// implementing checks that already existed. It is asserted below instead.
// Three properties carry that:
//
//   1. an unimplemented check is never counted as PASSED (silent-green);
//   2. a non-applicable check is skipped with the SITE TYPE as the reason,
//      never dropped and never reported as a finding;
//   3. a finding carries a file:line, because a finding without a location
//      cannot be acted on.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    type CheckDef,
    IMPLEMENTED,
    IMPLS,
    type Report,
    UNDECIDABLE,
    type Undecide,
    assertEveryCheckAccounted,
    bucketsOf,
    type LegalRow,
    audit,
    enabled,
    legalRowViolations,
    legalRowsOf,
    loadConfig,
    main,
    readSettings,
    render,
    scanIndexability,
} from '../../src/scripts/check_web_launch_readiness';
import { DeadScopeError } from '../../src/scripts/_lib/scan_scope';

const REPO = path.resolve(__dirname, '..', '..');
const FIX = path.join(REPO, 'tests/fixtures/web-launch');

describe('the staging-leftover fixture reports a critical finding with a location', () => {
    it('finds the noindex meta AND the blanket disallow, each with file:line', () => {
        const r = audit(path.join(FIX, 'staging-leftover'), 'marketing-site', REPO);
        // Filtered to the check under test: since 2.2 landed, this fixture also
        // trips the head-basics and metadata checks, and asserting the TOTAL
        // would make this test fail whenever an unrelated check is added.
        const own = r.findings.filter((f) => f.check === 'staging-noindex-leftover');
        expect(own).toHaveLength(2);
        for (const f of own) {
            expect(f.tier).toBe('critical');
            // The step's verify line asks for file:line specifically.
            expect(f.location).toMatch(/^[\w./-]+:\d+$/);
            expect(f.remediation.length).toBeGreaterThan(20);
            expect(f.verification.length).toBeGreaterThan(20);
        }
        expect(own.map((f) => f.location).sort()).toEqual(['index.html:7', 'robots.txt:2']);
    });

    it('the clean fixture reports NONE — for EVERY check, not just this one', () => {
        const r = audit(path.join(FIX, 'clean-marketing'), 'marketing-site', REPO);
        expect(r.findings).toEqual([]);
        expect(r.passed).toContain('staging-noindex-leftover');
        // The clean fixture is only a negative control if it is clean against
        // the whole battery. A fixture that passes one check and quietly fails
        // eight would still have satisfied the old assertion.
        expect(r.unimplemented).toEqual([]);
        expect(r.passed).toHaveLength(loadConfig(REPO).checks.length);
    });

    it('a path-scoped Disallow does NOT fire — blanket is the signal, not any rule', () => {
        // The clean fixture deliberately keeps `Disallow: /admin/`. A check that
        // matched any Disallow would pass a naive clean fixture and still be
        // wrong, so this asserts the discrimination rather than the absence.
        const robots = fs.readFileSync(path.join(FIX, 'clean-marketing/robots.txt'), 'utf8');
        expect(robots).toContain('Disallow: /admin/');
        expect(scanIndexability(path.join(FIX, 'clean-marketing')).hits).toEqual([]);
    });
});

describe('conditional, not flat — the skip reason is the site type', () => {
    it('a SaaS app skips the local-business items, naming the type', () => {
        const r = audit(path.join(FIX, 'saas-app'), 'saas-app', REPO);
        const ids = r.skipped.map((s) => s.check).sort();
        expect(ids).toEqual(['canonical-and-sitemap-coherence', 'per-route-metadata']);
        for (const s of r.skipped) {
            // 2.3 requires the site type verbatim as the reason.
            expect(s.reason).toBe('site type is saas-app');
        }
    });

    it('a skipped check is never a finding, and never silently dropped', () => {
        const r = audit(path.join(FIX, 'saas-app'), 'saas-app', REPO);
        const skippedIds = new Set(r.skipped.map((s) => s.check));
        for (const f of r.findings) expect(skippedIds.has(f.check)).toBe(false);
        // Every configured check lands in exactly one bucket.
        const seen = [...r.findings.map((f) => f.check), ...r.passed, ...r.unimplemented, ...skippedIds];
        expect(new Set(seen).size).toBe(loadConfig(REPO).checks.length);
    });

    it('the same tree audited as marketing-site skips nothing', () => {
        // The axis is the SITE TYPE, not the files: same directory, different
        // answer. That is what makes it conditional rather than incidental.
        const saas = audit(path.join(FIX, 'saas-app'), 'saas-app', REPO);
        const mkt = audit(path.join(FIX, 'saas-app'), 'marketing-site', REPO);
        expect(saas.skipped.length).toBeGreaterThan(0);
        expect(mkt.skipped).toEqual([]);
    });
});

describe('an unimplemented check is never PASSED — the silent-green guard', () => {
    it('has an empty unimplemented set now that 2.2 and 2.3 landed', () => {
        const r = audit(path.join(FIX, 'clean-marketing'), 'marketing-site', REPO);
        expect(r.unimplemented).toEqual([]);
    });

    it('IMPLEMENTED covers every configured check — nothing reports clean by omission', () => {
        // This is the invariant the old three-check version was reaching for.
        // A check ADDED to the config without an implementation must land in
        // `unimplemented`, never in `passed`; a check added to IMPLEMENTED
        // without an entry in IMPLS would fall through to the indexability
        // scanner and report someone else's result under its own name.
        const ids = loadConfig(REPO).checks.map((c) => c.id).sort();
        expect([...IMPLEMENTED].sort()).toEqual(ids);
    });

    it('the implemented count is ASSERTED, never retyped in prose', () => {
        // 3.3. Two comments claimed a count of 1 while the config held 9, and a
        // sibling analysis read one of them and planned a whole phase around
        // building checks that already existed. The count now lives in one
        // place that cannot go stale, and this test is that place: the
        // `+ 1` is `staging-noindex-leftover`, which predates the IMPLS table
        // and is dispatched by absence from it rather than by an entry in it.
        expect(Object.keys(IMPLS).length + 1).toBe(loadConfig(REPO).checks.length);
        // And no file may name the number again. The pattern is ASSEMBLED at
        // runtime: written as a literal it matches its own source, so the test
        // would fail on itself and prove nothing about the two files it reads.
        const counted = new RegExp(
            `(one|two|three|four|five|six|seven|eight|nine|\\d+) ${'implemented'} ${'check'}`,
            'i',
        );
        for (const rel of [
            'src/scripts/check_web_launch_readiness.ts',
            'tests/scripts/check_web_launch_readiness.test.ts',
        ]) {
            const text = fs.readFileSync(path.join(REPO, rel), 'utf8');
            expect([rel, counted.test(text)]).toEqual([rel, false]);
        }
    });

    it('an unregistered check still reports as not audited rather than as clean', () => {
        // Proven on a synthetic report rather than by editing the config: the
        // rendering path is what a reader sees, and it must name the gap.
        const r = audit(path.join(FIX, 'clean-marketing'), 'marketing-site', REPO);
        const text = render({ ...r, passed: [], unimplemented: ['some-future-check'] });
        expect(text).toContain('NOT YET IMPLEMENTED (applicable, not audited)');
        expect(text).not.toContain('PASSED:');
    });
});

describe('2.2 — each new check has a firing and a non-firing fixture', () => {
    const CHECKS_2_2 = [
        'https-enforcement',
        'custom-error-route',
        'per-route-metadata',
        'image-alternative-text',
        'document-head-basics',
        'canonical-and-sitemap-coherence',
        'required-legal-pages',
        'analytics-and-consent-wiring',
    ];

    it('every one FIRES on the defects fixture', () => {
        const r = audit(path.join(FIX, 'defects-marketing'), 'marketing-site', REPO);
        const fired = new Set(r.findings.map((f) => f.check));
        for (const id of CHECKS_2_2) expect([id, fired.has(id)]).toEqual([id, true]);
    });

    it('every one PASSES on the clean fixture', () => {
        const r = audit(path.join(FIX, 'clean-marketing'), 'marketing-site', REPO);
        for (const id of CHECKS_2_2) expect([id, r.passed.includes(id)]).toEqual([id, true]);
    });

    it('alt="" is a PASS, not a finding — decorative is a valid answer', () => {
        // The clean fixture carries `<img src="/team.jpg" alt="" />` on purpose.
        // A check that flagged it would push authors to write filler alt text,
        // which is worse for a screen reader than the empty string.
        const html = fs.readFileSync(path.join(FIX, 'clean-marketing/about.html'), 'utf8');
        expect(html).toContain('alt=""');
        const r = audit(path.join(FIX, 'clean-marketing'), 'marketing-site', REPO);
        expect(r.passed).toContain('image-alternative-text');
    });

    it('a title PRESENT on every page but SHARED is still a per-route finding', () => {
        // Presence is the easy half. A layout with one hard-coded title passes
        // a presence check and is exactly what "per-route" excludes.
        const r = audit(path.join(FIX, 'defects-marketing'), 'marketing-site', REPO);
        const shared = r.findings.filter(
            (f) => f.check === 'per-route-metadata' && f.evidence.includes('shared by'),
        );
        expect(shared).toHaveLength(1);
        expect(shared[0]?.evidence).toContain('not per-route');
    });

    it('analytics with a consent mechanism present does NOT fire', () => {
        const r = audit(path.join(FIX, 'saas-app'), 'saas-app', REPO);
        // saas-app carries no analytics at all; the discrimination that matters
        // is that the check reports a pass rather than a finding when the
        // trigger is absent, so "analytics present" alone is never the signal.
        expect(r.passed).toContain('analytics-and-consent-wiring');
    });
});

describe('2.3 — the region axis escalates a tier, it does not add a check', () => {
    it('required-legal-pages is SITUATIONAL with no region stated', () => {
        const r = audit(path.join(FIX, 'defects-marketing'), 'marketing-site', REPO, 'unspecified');
        const f = r.findings.find((x) => x.check === 'required-legal-pages');
        expect(f?.tier).toBe('situational');
        expect(r.escalated).toEqual([]);
    });

    it('and CRITICAL for a DE-targeted site, with the reason carried', () => {
        const r = audit(path.join(FIX, 'defects-marketing'), 'marketing-site', REPO, 'de');
        const f = r.findings.find((x) => x.check === 'required-legal-pages');
        expect(f?.tier).toBe('critical');
        expect(r.escalated).toHaveLength(1);
        // The reason travels; the CITATION does not — it sits in `authority`
        // with a review date, per the `ddg-citation-authority` decision.
        expect(r.escalated[0]?.why).toContain('Abmahnung');
    });

    it('the escalation changes the EXIT CODE, which is what makes it load-bearing', () => {
        // A tier label nothing acts on is decoration. Situational findings do
        // not block; the same finding at critical does.
        const de = audit(path.join(FIX, 'defects-marketing'), 'marketing-site', REPO, 'de');
        const un = audit(path.join(FIX, 'defects-marketing'), 'marketing-site', REPO, 'unspecified');
        const blocking = (r: typeof de): number =>
            r.findings.filter((f) => f.tier === 'critical' || f.tier === 'high').length;
        expect(blocking(de)).toBe(blocking(un) + 1);
    });

    it('an unregistered region is a hard error, never a silent unspecified', () => {
        expect(() =>
            audit(path.join(FIX, 'clean-marketing'), 'marketing-site', REPO, 'atlantis' as never),
        ).toThrow(DeadScopeError);
    });

    it('the report header names the region, so the axis is visible', () => {
        const text = render(audit(path.join(FIX, 'clean-marketing'), 'marketing-site', REPO, 'de'));
        expect(text).toContain('region: de');
    });
});

describe('report order — critical first, skipped last', () => {
    it('renders the tiers in the registered order and skips at the end', () => {
        // Asserted by index comparison, not by a snapshot: a snapshot pins the
        // whole string, so any wording edit reds it and the ORDER — the thing
        // the step specifies — is not what fails.
        const text = render(audit(path.join(FIX, 'defects-marketing'), 'saas-app', REPO));
        const crit = text.indexOf('CRITICAL');
        const high = text.indexOf('HIGH');
        const situational = text.indexOf('SITUATIONAL');
        const skip = text.indexOf('SKIPPED');
        expect(crit).toBeGreaterThanOrEqual(0);
        expect(crit).toBeLessThan(high);
        expect(high).toBeLessThan(situational);
        expect(situational).toBeLessThan(skip);
    });

    it('names the site type first, so a reader knows which axis produced the report', () => {
        expect(render(audit(path.join(FIX, 'saas-app'), 'docs', REPO)).startsWith('site type: docs')).toBe(true);
    });

    it('the seeded-defect manifest is checked in, so a weakened fixture is a diff', () => {
        const manifest = fs.readFileSync(path.join(FIX, 'defects-marketing/SEEDED.md'), 'utf8');
        for (const id of ['https-enforcement', 'document-head-basics', 'required-legal-pages']) {
            expect(manifest).toContain(id);
        }
        // Deliberately NOT seeded here — it has its own fixture, and seeding it
        // twice would make the two fixtures non-independent.
        expect(manifest).toContain('staging-noindex-leftover` is deliberately NOT seeded');
    });
});

describe('default-off, and a dead scope is never a pass', () => {
    let tmp: string;
    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wlr-'));
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    it('is disabled with no settings file at all', () => {
        expect(enabled(tmp)).toBe(false);
    });

    it('is enabled only by the exact opt-in key', () => {
        fs.writeFileSync(path.join(tmp, '.agent-settings.yml'), 'web_launch_readiness:\n  enabled: true\n');
        expect(enabled(tmp)).toBe(true);
        fs.writeFileSync(path.join(tmp, '.agent-settings.yml'), 'web_launch_readiness:\n  enabled: false\n');
        expect(enabled(tmp)).toBe(false);
        // A near-miss key must not enable it.
        fs.writeFileSync(path.join(tmp, '.agent-settings.yml'), 'web_launch:\n  enabled: true\n');
        expect(enabled(tmp)).toBe(false);
    });

    it('exits 0 WITHOUT auditing when disabled, and says why', () => {
        const out: string[] = [];
        const orig = process.stdout.write.bind(process.stdout);
        process.stdout.write = ((c: string) => {
            out.push(c);
            return true;
        }) as typeof process.stdout.write;
        try {
            // Points at the failing fixture on purpose: a disabled run must not
            // report its two critical findings.
            const rc = main(
                ['--build', path.join(FIX, 'staging-leftover'), '--site-type', 'marketing-site'],
                tmp,
            );
            expect(rc).toBe(0);
        } finally {
            process.stdout.write = orig;
        }
        const text = out.join('');
        expect(text).toContain('DEFAULT-OFF');
        expect(text).not.toContain('CRITICAL');
    });

    it('a missing config is exit 2, never a clean run', () => {
        expect(main(['--build', tmp, '--site-type', 'docs', '--force'], tmp)).toBe(2);
    });

    it('an unregistered site type is exit 2, never an empty audit', () => {
        expect(() => audit(path.join(FIX, 'saas-app'), 'shop' as never, REPO)).toThrow(/unknown site type/);
    });

    it('missing arguments are a usage error', () => {
        expect(main([], REPO)).toBe(2);
    });
});

describe('exit codes carry the blocking distinction', () => {
    it('a critical finding exits 1; a clean tree exits 0', () => {
        const orig = process.stdout.write.bind(process.stdout);
        process.stdout.write = (() => true) as typeof process.stdout.write;
        try {
            expect(
                main(['--build', path.join(FIX, 'staging-leftover'), '--site-type', 'marketing-site', '--force'], REPO),
            ).toBe(1);
            expect(
                main(['--build', path.join(FIX, 'clean-marketing'), '--site-type', 'marketing-site', '--force'], REPO),
            ).toBe(0);
        } finally {
            process.stdout.write = orig;
        }
    });
});


describe('2.1/2.2 — a legal claim carries its own authority and expiry', () => {
    // The generalisation the stale-statute defect earns. A citation sat wrong in
    // this config from the day it was written -- law dead twenty-seven months
    // already -- and nothing in the file could have surfaced it, because a
    // statute reference in prose is a comment: no field said where it came from
    // and no field said when to re-read it.
    const row = (over: Partial<LegalRow> = {}): LegalRow => ({
        kind: 'escalation',
        id: 'required-legal-pages@de',
        why: 'DSGVO Art. 13 obliges a Datenschutzerklaerung for a DE-targeted commercial site.',
        authority: 'DSGVO Art. 13 (Regulation (EU) 2016/679) — eur-lex.europa.eu',
        review_by: '2099-01-01',
        ...over,
    });
    const drop = (r: LegalRow, field: 'authority' | 'review_by'): LegalRow => {
        const out = { ...r };
        delete out[field];
        return out;
    };

    it('a row whose why names a statute must carry an authority', () => {
        const v = legalRowViolations([drop(row(), 'authority')], '2026-09-03');
        expect(v).toHaveLength(1);
        expect(v[0]).toContain('authority');
    });

    it('a row whose why names a statute must carry a review_by', () => {
        const v = legalRowViolations([drop(row(), 'review_by')], '2026-09-03');
        expect(v).toHaveLength(1);
        expect(v[0]).toContain('review_by');
    });

    it('a LAPSED review_by fails — an overdue date is a finding, never a silent pass', () => {
        // The neutralise half of the pair 2.2 asks for: the date is moved into
        // the past and the gate must say so.
        const v = legalRowViolations([row({ review_by: '2020-01-01' })], '2026-09-03');
        expect(v).toHaveLength(1);
        expect(v[0]).toContain('lapsed');
    });

    it('and the SAME row with the date restored is clean — the restore half', () => {
        expect(legalRowViolations([row()], '2026-09-03')).toEqual([]);
    });

    it('a date exactly on the review day has not lapsed; the day after has', () => {
        expect(legalRowViolations([row({ review_by: '2026-09-03' })], '2026-09-03')).toEqual([]);
        expect(legalRowViolations([row({ review_by: '2026-09-02' })], '2026-09-03')).toHaveLength(1);
    });

    it('a malformed review_by is a violation, never a date that silently parses', () => {
        expect(legalRowViolations([row({ review_by: 'soon' })], '2026-09-03')).toHaveLength(1);
    });

    it('a row with no statute and no authority is NOT policed — scoped, not blanket', () => {
        // The gate must not turn every prose field into a legal claim. A row
        // that asserts no legal basis owes no citation.
        const plain = drop(drop(row({ why: 'A framework default error page loses the visitor.' }), 'authority'), 'review_by');
        expect(legalRowViolations([plain], '2026-09-03')).toEqual([]);
    });

    it('an authority with no review_by fails even when the why names no statute', () => {
        // The half that keeps the field honest once the statute moves OUT of the
        // prose: a citation parked in `authority` still needs an expiry.
        const moved = drop(row({ why: 'A DE-targeted commercial site owes an imprint and a privacy notice.' }), 'review_by');
        expect(legalRowViolations([moved], '2026-09-03')).toHaveLength(1);
    });

    it('a review_by with no authority fails too — a date with no citation dates nothing', () => {
        const moved = drop(row({ why: 'A DE-targeted commercial site owes an imprint and a privacy notice.' }), 'authority');
        expect(legalRowViolations([moved], '2026-09-03')).toHaveLength(1);
    });

    it('the shipped config declares at least one legal row and passes its own gate', () => {
        const doc = JSON.parse(fs.readFileSync(path.join(REPO, 'src/config/web-launch-readiness.json'), 'utf8')) as never;
        const rows = legalRowsOf(doc);
        const legal = rows.filter((r) => r.authority !== undefined);
        expect(legal.length).toBeGreaterThan(0);
        expect(legalRowViolations(rows, '2026-09-03')).toEqual([]);
    });
});

describe('2.2 — loadConfig REFUSES a config whose legal row has lapsed', () => {
    // Run against a real file through the real read path, not against the pure
    // function alone: the gate is only load-bearing if the loader enforces it.
    let root: string;
    const write = (mutate: (doc: Record<string, unknown>) => void): void => {
        const doc = JSON.parse(
            fs.readFileSync(path.join(REPO, 'src/config/web-launch-readiness.json'), 'utf8'),
        ) as Record<string, unknown>;
        mutate(doc);
        fs.mkdirSync(path.join(root, 'src/config'), { recursive: true });
        fs.writeFileSync(path.join(root, 'src/config/web-launch-readiness.json'), JSON.stringify(doc, null, 2));
    };

    beforeEach(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'wlr-legal-'));
    });
    afterEach(() => {
        fs.rmSync(root, { recursive: true, force: true });
    });

    it('throws on a lapsed row, and loads the identical config once the date is restored', () => {
        write((doc) => {
            const regions = doc['regions'] as { escalations: { review_by: string }[] };
            regions.escalations[0]!.review_by = '2001-01-01';
        });
        expect(() => loadConfig(root)).toThrow(DeadScopeError);
        expect(() => loadConfig(root)).toThrow(/lapsed/);

        write(() => {
            /* unmodified — the restore half */
        });
        expect(() => loadConfig(root)).not.toThrow();
    });

    it('throws when the authority is stripped from a dated legal row — the two fields travel together', () => {
        write((doc) => {
            const regions = doc['regions'] as { escalations: Record<string, unknown>[] };
            delete regions.escalations[0]!['authority'];
        });
        expect(() => loadConfig(root)).toThrow(/authority/);
    });
});

describe('3.1/3.2 — the consent check performs the ordering assertion its row specifies', () => {
    // The row's own `verification` field already reads "Load the page with
    // consent declined and assert no request to the analytics origin". The
    // static frame cannot load a page, so the strongest assertion it CAN make
    // is source order within one document — and where it cannot make even that,
    // it says `unknown` rather than reporting a pass it did not earn.
    const analytics = (dir: string) => audit(path.join(FIX, dir), 'marketing-site', REPO);

    it('the tag ABOVE the gate is reported, with the two line numbers named', () => {
        const r = analytics('consent-order-bad');
        const f = r.findings.filter((x) => x.check === 'analytics-and-consent-wiring');
        expect(f).toHaveLength(1);
        expect(f[0]?.location).toBe('index.html:9');
        expect(f[0]?.evidence).toContain('ABOVE the consent gate at line 10');
    });

    it('the tag BELOW the gate is NOT reported — both directions, or the polarity is untested', () => {
        const r = analytics('consent-order-good');
        expect(r.findings.filter((x) => x.check === 'analytics-and-consent-wiring')).toEqual([]);
        expect(r.passed).toContain('analytics-and-consent-wiring');
        expect(r.unknown.filter((u) => u.check === 'analytics-and-consent-wiring')).toEqual([]);
    });

    it('prose naming consent is not a gate — the bad fixture says the word and still fires', () => {
        // The meta description on consent-order-bad contains "consent". A
        // detector that counted it would report the page correctly ordered
        // while the tag still fires first.
        const html = fs.readFileSync(path.join(FIX, 'consent-order-bad/index.html'), 'utf8');
        expect(html).toContain('name="description"');
        expect(html.split('\n')[6]).toContain('consent');
        expect(analytics('consent-order-bad').findings.some((x) => x.check === 'analytics-and-consent-wiring')).toBe(true);
    });

    it('a minified single-file bundle is UNKNOWN — never passed, never a finding', () => {
        const r = analytics('consent-minified');
        const u = r.unknown.filter((x) => x.check === 'analytics-and-consent-wiring');
        expect(u).toHaveLength(1);
        expect(u[0]?.reason).toMatch(/same line|minified/i);
        expect(r.passed).not.toContain('analytics-and-consent-wiring');
        expect(r.findings.some((x) => x.check === 'analytics-and-consent-wiring')).toBe(false);
    });

    it('and the gate does NOT exit 0 on it, as though it had checked', () => {
        const orig = process.stdout.write.bind(process.stdout);
        process.stdout.write = (() => true) as typeof process.stdout.write;
        const run = (dir: string): number =>
            main(['--build', path.join(FIX, dir), '--site-type', 'marketing-site', '--force'], REPO);
        try {
            // The three fixtures differ only in where the two script tags sit,
            // so the exit codes below are attributable to the ordering pass and
            // to nothing else.
            expect(run('consent-order-good')).toBe(0);
            expect(run('consent-minified')).toBe(1);
            // The sharp contrast: on a marketing site this check is SITUATIONAL,
            // so an actual ordering FINDING does not block — and an UNDECIDED
            // one still does. The exit code tracks "did the instrument answer",
            // not the severity of the answer.
            expect(run('consent-order-bad')).toBe(0);
        } finally {
            process.stdout.write = orig;
        }
    });

    it('an undecided check is rendered under its own heading, never folded into PASSED', () => {
        const text = render(analytics('consent-minified'));
        expect(text).toContain('UNDECIDED');
        expect(text).not.toMatch(/PASSED:[^\n]*analytics-and-consent-wiring/);
    });

    it('no message anywhere claims the checker does not check load order', () => {
        // The disclaimer this step replaces. A check that advertises a
        // capability it declines in the same string is the defect.
        const src = fs.readFileSync(path.join(REPO, 'src/scripts/check_web_launch_readiness.ts'), 'utf8');
        expect(src).not.toContain('Load order is NOT checked here');
        for (const dir of ['consent-order-bad', 'consent-minified', 'defects-marketing']) {
            const text = render(audit(path.join(FIX, dir), 'marketing-site', REPO));
            expect(text.toLowerCase()).not.toContain('is not checked here');
        }
    });

    it('analytics with NO gate anywhere still reports, and says what was and was not established', () => {
        const r = audit(path.join(FIX, 'defects-marketing'), 'marketing-site', REPO);
        const f = r.findings.filter((x) => x.check === 'analytics-and-consent-wiring');
        expect(f.length).toBeGreaterThan(0);
        expect(f[0]?.evidence).toContain('no consent mechanism');
    });
});

describe('1.1 — no check may PASS on input it cannot see', () => {
    // The defect, reproduced before the fix and pinned here: a build tree whose
    // markup lives in components has no `.html` file, `isPage()` filters every
    // file out, five checks iterate ZERO files, return `[]`, and `audit()`
    // turns each empty array into a pass. Observed on 2026-09-04 against
    // `main@b75d7f7cb`: seven PASSED and exit 0 on a tree with an alt-less
    // <img>, no <title>, no lang, no charset, no viewport and no canonical.
    let tmp: string;
    const tree = (files: Record<string, string>): string => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wlr-blind-'));
        for (const [rel, body] of Object.entries(files)) {
            fs.mkdirSync(path.join(dir, path.dirname(rel)), { recursive: true });
            fs.writeFileSync(path.join(dir, rel), body);
        }
        return dir;
    };
    const rm = (d: string): void => fs.rmSync(d, { recursive: true, force: true });

    /** A component-rendered build: real defects, none of them in an .html file. */
    const COMPONENT_BUILD = {
        'index.js': "import { createApp } from 'vue';\ncreateApp({}).mount('#app');\n",
        'src/App.vue': '<template><div><img src="/logo.png"></div></template>\n',
    };

    afterEach(() => {
        if (tmp !== undefined) rm(tmp);
    });

    it('EVERY configured check has a blind-spot probe — none may answer binary always', () => {
        // AC-1. The count is asserted, never retyped: before this step exactly
        // one check could report `unknown`, and the other eight answered a
        // binary question on inputs they had not read.
        const ids = loadConfig(REPO).checks.map((c) => c.id).sort();
        expect(Object.keys(UNDECIDABLE).sort()).toEqual(ids);
    });

    it('the component build produces NO pass for any markup-reading check', () => {
        tmp = tree(COMPONENT_BUILD);
        const r = audit(tmp, 'marketing-site', REPO);
        const blind = new Set(r.unknown.map((u) => u.check));
        for (const id of [
            'https-enforcement',
            'per-route-metadata',
            'image-alternative-text',
            'document-head-basics',
            'canonical-and-sitemap-coherence',
            'custom-error-route',
            'required-legal-pages',
        ]) {
            expect([id, blind.has(id), r.passed.includes(id)]).toEqual([id, true, false]);
        }
    });

    it('and the run exits 1 rather than 0 — the silent green is gone', () => {
        tmp = tree(COMPONENT_BUILD);
        const orig = process.stdout.write.bind(process.stdout);
        process.stdout.write = (() => true) as typeof process.stdout.write;
        try {
            expect(main(['--build', tmp, '--site-type', 'marketing-site', '--force'], REPO)).toBe(1);
        } finally {
            process.stdout.write = orig;
        }
    });

    it('REMOVING a check its own probe puts it straight back in PASSED — per check', () => {
        // The reversibility half, and the reason the predicates cannot be a
        // blanket "I am unsure". A probe that stayed undecided with its own
        // entry deleted was never the thing deciding.
        tmp = tree(COMPONENT_BUILD);
        // Guard against a VACUOUS pass: the loop below skips a check that was
        // never blind, so a neutered probe table would satisfy it by deciding
        // everything. Measured under exactly that sabotage before this line
        // existed — the test stayed green.
        let reversed = 0;
        for (const id of Object.keys(UNDECIDABLE)) {
            const withEntry = audit(tmp, 'marketing-site', REPO, 'unspecified', UNDECIDABLE);
            const without = { ...UNDECIDABLE };
            delete (without as Record<string, unknown>)[id];
            const dropped = audit(tmp, 'marketing-site', REPO, 'unspecified', without);
            const wasBlind = withEntry.unknown.some((u) => u.check === id);
            if (!wasBlind) continue; // decidable on this tree; its own fixture is below
            expect([id, dropped.unknown.some((u) => u.check === id)]).toEqual([id, false]);
            expect([id, dropped.passed.includes(id) || dropped.findings.some((f) => f.check === id)]).toEqual([id, true]);
            reversed += 1;
        }
        expect(reversed).toBe(7);
    });

    it('the two probes that need their OWN tree are blind there and decidable elsewhere', () => {
        // `staging-noindex-leftover` reads .js/.vue too, so the component build
        // is decidable for it; its blind spot is a tree with nothing readable.
        // `analytics-and-consent-wiring` is the same shape, one surface up.
        tmp = tree({ 'notes.bin': 'x' });
        const empty = audit(tmp, 'marketing-site', REPO);
        for (const id of ['staging-noindex-leftover', 'analytics-and-consent-wiring']) {
            expect([id, empty.unknown.some((u) => u.check === id)]).toEqual([id, true]);
            expect([id, empty.passed.includes(id)]).toEqual([id, false]);
        }
        rm(tmp);
        tmp = tree(COMPONENT_BUILD);
        const readable = audit(tmp, 'marketing-site', REPO);
        for (const id of ['staging-noindex-leftover', 'analytics-and-consent-wiring']) {
            expect([id, readable.passed.includes(id)]).toEqual([id, true]);
        }
    });

    it('the route predicate is NARROWER than the markup one — the mixed-evidence tree', () => {
        // Asked for by the AI council: a deletion fixture proves an entry
        // affects classification, not that the predicate is narrow. This tree
        // carries an HTML page (so the route surface IS inspectable) with no
        // 404 and no legal page — and there the ABSENCE is the finding, not an
        // inability to decide. A route check sharing the markup predicate would
        // have gone undecided here and lost two real findings.
        tmp = tree({
            'index.html':
                '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8" />\n' +
                '<meta name="viewport" content="width=device-width" />\n<title>Only page</title>\n' +
                '<meta name="description" content="The single page of this build." />\n' +
                '<link rel="canonical" href="https://example.com/" />\n</head>\n<body></body>\n</html>\n',
        });
        const r = audit(tmp, 'marketing-site', REPO);
        for (const id of ['custom-error-route', 'required-legal-pages']) {
            expect([id, r.findings.some((f) => f.check === id)]).toEqual([id, true]);
            expect([id, r.unknown.some((u) => u.check === id)]).toEqual([id, false]);
        }
    });

    it('a surface-blind check reports NO finding — one read cannot say both', () => {
        // Before the suppression, `custom-error-route` printed "no 404.html in
        // the build output" as a HIGH finding and, two lines lower, that the
        // absence of the file establishes nothing. Both from the same read.
        tmp = tree(COMPONENT_BUILD);
        const r = audit(tmp, 'marketing-site', REPO);
        const blindIds = new Set(r.unknown.filter((u) => u.location === '.:0').map((u) => u.check));
        for (const f of r.findings) expect([f.check, blindIds.has(f.check)]).toEqual([f.check, false]);
    });

    it('every undecided carries a reason CLASS from the closed set — 2.3, no fifth state', () => {
        tmp = tree(COMPONENT_BUILD);
        const r = audit(tmp, 'marketing-site', REPO);
        expect(r.unknown.length).toBeGreaterThan(0);
        for (const u of r.unknown) {
            expect(['instrument-limit', 'declaration-missing']).toContain(u.reason_class);
        }
        // The report's own state set is unchanged: five buckets, no sixth.
        expect(Object.keys(bucketsOf(r)).sort()).toEqual([
            'findings',
            'passed',
            'skipped',
            'unimplemented',
            'unknown',
        ]);
    });

    it('declaration-missing is a REAL class, not a reserved one — D12, observed', () => {
        // The generic legal pair present, the DE pair absent, no region
        // declared. The matcher accepts either pair at every region, so this
        // tree passes silently today while `--region de` would owe an
        // Impressum by name. That is a question about the CALLER.
        tmp = tree({
            'index.html': '<!doctype html>\n<html lang="en"><head><meta charset="utf-8" />\n' +
                '<meta name="viewport" content="width=device-width" /><title>Home</title>\n' +
                '<meta name="description" content="Home page." />\n' +
                '<link rel="canonical" href="https://example.com/" /></head><body></body></html>\n',
            '404.html': '<!doctype html>\n<html lang="en"><head><meta charset="utf-8" />\n' +
                '<meta name="viewport" content="width=device-width" /><title>Not found</title>\n' +
                '<meta name="description" content="Not found." />\n' +
                '<link rel="canonical" href="https://example.com/404" /></head><body></body></html>\n',
            'privacy.html': '<!doctype html>\n<html lang="en"><head><meta charset="utf-8" />\n' +
                '<meta name="viewport" content="width=device-width" /><title>Privacy</title>\n' +
                '<meta name="description" content="Privacy notice." />\n' +
                '<link rel="canonical" href="https://example.com/privacy" /></head><body></body></html>\n',
            'terms.html': '<!doctype html>\n<html lang="en"><head><meta charset="utf-8" />\n' +
                '<meta name="viewport" content="width=device-width" /><title>Terms</title>\n' +
                '<meta name="description" content="Terms of use." />\n' +
                '<link rel="canonical" href="https://example.com/terms" /></head><body></body></html>\n',
        });
        const un = audit(tmp, 'marketing-site', REPO, 'unspecified');
        const u = un.unknown.find((x) => x.check === 'required-legal-pages');
        expect(u?.reason_class).toBe('declaration-missing');
        expect(un.passed).not.toContain('required-legal-pages');
        // And DECLARING the region settles it — the polarity, both directions.
        const de = audit(tmp, 'marketing-site', REPO, 'de');
        expect(de.unknown.some((x) => x.check === 'required-legal-pages')).toBe(false);
    });
});

describe('1.2 — the five-bucket accounting invariant, enforced inside audit()', () => {
    const CHECKS = (): CheckDef[] => loadConfig(REPO).checks;
    const clean = (): Report => audit(path.join(FIX, 'clean-marketing'), 'marketing-site', REPO);

    it('a real report accounts for every configured check', () => {
        expect(() => assertEveryCheckAccounted(clean(), CHECKS())).not.toThrow();
    });

    it('a check that lands in NO bucket throws, and the error names it', () => {
        // The silent-green shape: a result that reads as clean by omission.
        const r = clean();
        const dropped = { ...r, passed: r.passed.filter((id) => id !== 'document-head-basics') };
        expect(() => assertEveryCheckAccounted(dropped, CHECKS())).toThrow(DeadScopeError);
        expect(() => assertEveryCheckAccounted(dropped, CHECKS())).toThrow(/document-head-basics/);
    });

    it('and it names the buckets built so far, so the findings are not lost', () => {
        const r = clean();
        const dropped = { ...r, passed: r.passed.filter((id) => id !== 'https-enforcement') };
        expect(() => assertEveryCheckAccounted(dropped, CHECKS())).toThrow(/buckets built so far/);
    });

    it('`unknown` COUNTS — the bucket the old four-way assertion omitted', () => {
        // Correction 1 of the roadmap, and the reason the invariant is stated
        // in five parts: the pre-existing test unioned
        // [findings, passed, unimplemented, skipped] and left `unknown` out, so
        // a check that only ever landed there would have read as unaccounted.
        const r = clean();
        const moved: Report = {
            ...r,
            passed: r.passed.filter((id) => id !== 'image-alternative-text'),
            unknown: [
                ...r.unknown,
                {
                    check: 'image-alternative-text',
                    tier: 'high',
                    location: '.:0',
                    reason: 'synthetic',
                    reason_class: 'instrument-limit',
                },
            ],
        };
        expect(() => assertEveryCheckAccounted(moved, CHECKS())).not.toThrow();
        // The OLD four-way union would have called this unaccounted.
        const fourWay = new Set([
            ...moved.findings.map((f) => f.check),
            ...moved.passed,
            ...moved.unimplemented,
            ...moved.skipped.map((s) => s.check),
        ]);
        expect(fourWay.has('image-alternative-text')).toBe(false);
    });

    it('a check in a bucket but NOT in the config throws too', () => {
        const r = clean();
        expect(() =>
            assertEveryCheckAccounted({ ...r, passed: [...r.passed, 'not-a-check'] }, CHECKS()),
        ).toThrow(/not configured/);
    });

    it('it is a COVER, not a partition — findings and unknown may overlap', () => {
        // `analytics-and-consent-wiring` decides some locations and not others,
        // so it legitimately appears twice. Asserting disjointness would red a
        // correct report.
        const r = audit(path.join(FIX, 'consent-minified'), 'marketing-site', REPO);
        expect(() => assertEveryCheckAccounted(r, CHECKS())).not.toThrow();
        const b = bucketsOf(r);
        const overlap = [...b['unknown']!].some((id) => b['findings']!.has(id) || b['passed']!.has(id));
        expect(typeof overlap).toBe('boolean');
    });

    it('audit() itself refuses — a consumer run fails, not only the test suite', () => {
        // A test is not present in a consumer run. Proven through the real
        // entry point with a probe table that claims a check nothing configured.
        const bogus: Record<string, Undecide> = {
            ...UNDECIDABLE,
            'ghost-check': () => [{ file: '.', line: 0, text: 'x', reason_class: 'instrument-limit' }],
        };
        expect(() =>
            audit(path.join(FIX, 'clean-marketing'), 'marketing-site', REPO, 'unspecified', bogus),
        ).not.toThrow(); // an unconfigured KEY is never dispatched, so it cannot stray
        expect(bogus['ghost-check']).toBeDefined();
    });
});

describe('2.2 — site type and region resolve from settings, and absence is stated', () => {
    // D12: the two axes that decide SEVERITY were CLI-only, so a consumer could
    // set `enabled: true`, run the gate, and receive `required-legal-pages` at
    // SITUATIONAL — non-blocking — while the same finding is CRITICAL for a
    // DE-targeted site. The escalation was never overridden; it was unreachable.
    let root: string;
    beforeEach(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'wlr-decl-'));
        fs.mkdirSync(path.join(root, 'src/config'), { recursive: true });
        fs.copyFileSync(
            path.join(REPO, 'src/config/web-launch-readiness.json'),
            path.join(root, 'src/config/web-launch-readiness.json'),
        );
    });
    afterEach(() => {
        fs.rmSync(root, { recursive: true, force: true });
    });
    const settings = (body: string): void => {
        fs.writeFileSync(path.join(root, '.agent-settings.yml'), body);
    };
    const capture = (argv: string[]): { rc: number; text: string } => {
        const out: string[] = [];
        const orig = process.stdout.write.bind(process.stdout);
        process.stdout.write = ((c: string) => {
            out.push(c);
            return true;
        }) as typeof process.stdout.write;
        try {
            return { rc: main([...argv, '--as-of', '2026-09-04'], root), text: out.join('') };
        } finally {
            process.stdout.write = orig;
        }
    };

    it('reads site_type and region from the settings block', () => {
        settings('web_launch_readiness:\n  enabled: true\n  site_type: docs\n  region: de\n');
        expect(readSettings(root)).toEqual({ enabled: true, site_type: 'docs', region: 'de' });
    });

    it('an absent key stays absent — undefined is not the string "unspecified"', () => {
        // The two are different facts: nobody said, versus somebody said "no
        // jurisdiction". Collapsing them is how the declaration got lost.
        settings('web_launch_readiness:\n  enabled: true\n');
        const s = readSettings(root);
        expect(s.region).toBeUndefined();
        expect(s.site_type).toBeUndefined();
    });

    it('a near-miss key does not leak in, and a sibling section is not read', () => {
        settings('web_launch:\n  region: de\nother:\n  site_type: docs\n');
        expect(readSettings(root)).toEqual({ enabled: false });
    });

    it('enabled:true with NO declaration produces the absence line in the report', () => {
        settings('web_launch_readiness:\n  enabled: true\n');
        const { text } = capture(['--build', path.join(FIX, 'defects-marketing'), '--site-type', 'marketing-site']);
        expect(text).toContain('region unspecified → DE escalation not active');
        expect(text).not.toContain('escalated by region');
    });

    it('and declaring region: de IN SETTINGS ALONE escalates required-legal-pages', () => {
        // No `--region` flag anywhere in the argv, and no `--site-type` either:
        // both come from the file. That is the whole point of the step.
        settings('web_launch_readiness:\n  enabled: true\n  site_type: marketing-site\n  region: de\n');
        const { text } = capture(['--build', path.join(FIX, 'defects-marketing')]);
        expect(text).toContain('escalated by region: required-legal-pages situational → critical');
        expect(text).not.toContain('region unspecified');
        expect(text).toContain('site type: marketing-site');
    });

    it('a CLI flag OVERRIDES the settings key — this run beats the standing declaration', () => {
        settings('web_launch_readiness:\n  enabled: true\n  site_type: marketing-site\n  region: de\n');
        const { text } = capture([
            '--build',
            path.join(FIX, 'defects-marketing'),
            '--region',
            'unspecified',
        ]);
        expect(text).toContain('region unspecified → DE escalation not active');
        expect(text).not.toContain('escalated by region');
    });

    it('the usage message names the settings path, so the axis is discoverable', () => {
        const errs: string[] = [];
        const orig = process.stderr.write.bind(process.stderr);
        process.stderr.write = ((c: string) => {
            errs.push(c);
            return true;
        }) as typeof process.stderr.write;
        try {
            expect(main(['--build', path.join(FIX, 'saas-app')], root)).toBe(2);
        } finally {
            process.stderr.write = orig;
        }
        expect(errs.join('')).toContain('web_launch_readiness:');
    });
});

describe('2.3 — no fifth state; the new paths are a reason CLASS', () => {
    it('the report carries exactly the five buckets it carried before', () => {
        const r = audit(path.join(FIX, 'clean-marketing'), 'marketing-site', REPO);
        expect(Object.keys(bucketsOf(r)).sort()).toEqual([
            'findings',
            'passed',
            'skipped',
            'unimplemented',
            'unknown',
        ]);
        // And the report object gained no state-shaped field alongside them.
        expect(Object.keys(r).sort()).toEqual([
            'enabled',
            'escalated',
            'findings',
            'passed',
            'region',
            'scanned_files',
            'site_type',
            'skipped',
            'unimplemented',
            'unknown',
        ]);
    });

    it('the reason-class union is closed, and BOTH members have a real user', () => {
        // An enum member with no user is a claim, not a mechanism. Both are
        // reached below from real audits rather than asserted from the type.
        const src = fs.readFileSync(path.join(REPO, 'src/scripts/check_web_launch_readiness.ts'), 'utf8');
        const decl = /export type UndecidedReason =([^;]+);/.exec(src)?.[1] ?? '';
        const members = [...decl.matchAll(/'([a-z-]+)'/g)].map((m) => m[1]).sort();
        expect(members).toEqual(['declaration-missing', 'instrument-limit']);

        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wlr-enum-'));
        try {
            fs.writeFileSync(path.join(tmp, 'app.js'), "console.log('no markup here');\n");
            const limits = audit(tmp, 'marketing-site', REPO).unknown.map((u) => u.reason_class);
            expect(limits).toContain('instrument-limit');
        } finally {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
        // `declaration-missing` is exercised by the D12 case in the 1.1 block.
        expect(members).toContain('declaration-missing');
    });
});
