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

const REPO = path.resolve(__dirname, '..', '..');
const FIX = path.join(REPO, 'tests/fixtures/web-launch');

describe('the staging-leftover fixture reports a critical finding with a location', () => {
    it('finds the noindex meta AND the blanket disallow, each with file:line', () => {
        const r = audit(path.join(FIX, 'staging-leftover'), 'marketing-site', REPO);
        expect(r.findings).toHaveLength(2);
        for (const f of r.findings) {
            expect(f.tier).toBe('critical');
            expect(f.check).toBe('staging-noindex-leftover');
            // The step's verify line asks for file:line specifically.
            expect(f.location).toMatch(/^[\w./-]+:\d+$/);
            expect(f.remediation.length).toBeGreaterThan(20);
            expect(f.verification.length).toBeGreaterThan(20);
        }
        expect(r.findings.map((f) => f.location).sort()).toEqual(['index.html:7', 'robots.txt:2']);
    });

    it('the clean fixture reports NONE — both states demonstrated', () => {
        const r = audit(path.join(FIX, 'clean-marketing'), 'marketing-site', REPO);
        expect(r.findings).toEqual([]);
        expect(r.passed).toContain('staging-noindex-leftover');
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
    it('reports the six unimplemented checks separately from the one that ran', () => {
        const r = audit(path.join(FIX, 'clean-marketing'), 'marketing-site', REPO);
        expect(r.passed).toEqual(['staging-noindex-leftover']);
        expect(r.unimplemented.length).toBe(6);
        expect(r.unimplemented).not.toContain('staging-noindex-leftover');
    });

    it('IMPLEMENTED holds exactly the checks with a real scan behind them', () => {
        // A check added to IMPLEMENTED without an implementation would report
        // clean, which is the defect this list exists to make visible.
        expect([...IMPLEMENTED]).toEqual(['staging-noindex-leftover']);
    });

    it('the rendered report names them as not audited, not as clean', () => {
        const text = render(audit(path.join(FIX, 'clean-marketing'), 'marketing-site', REPO));
        expect(text).toContain('NOT YET IMPLEMENTED (applicable, not audited)');
    });
});

describe('report order — critical first, skipped last', () => {
    it('renders the tiers in the registered order and skips at the end', () => {
        const text = render(audit(path.join(FIX, 'staging-leftover'), 'saas-app', REPO));
        const crit = text.indexOf('CRITICAL');
        const unimpl = text.indexOf('NOT YET IMPLEMENTED');
        const skip = text.indexOf('SKIPPED');
        expect(crit).toBeGreaterThanOrEqual(0);
        expect(crit).toBeLessThan(unimpl);
        expect(unimpl).toBeLessThan(skip);
    });

    it('names the site type first, so a reader knows which axis produced the report', () => {
        expect(render(audit(path.join(FIX, 'saas-app'), 'docs', REPO)).startsWith('site type: docs')).toBe(true);
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
