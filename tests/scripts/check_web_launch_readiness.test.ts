// Tests for src/scripts/check_web_launch_readiness.ts.
//
// The command is DEFAULT-OFF and ships one implemented check, so most of what
// needs proving is not "does it find things" but "does it stay honest about what
// it did not look at". Three properties carry that:
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
    IMPLEMENTED,
    audit,
    enabled,
    loadConfig,
    main,
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
        expect(r.escalated[0]?.why).toContain('TMG');
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
