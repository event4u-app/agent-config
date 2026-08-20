// Golden tests for `agent-config route:explain` — 10 pinned prompts with
// pinned explanations. The explanations are structural pins (which rules
// match, on which triggers, at which tier), not full-text snapshots: rule
// bodies change size routinely, so byte-pinning the budget numbers would make
// every rule edit red here. What must NOT drift silently: the matched-rule
// sets, the matched trigger labels, the measurement-level first line, and the
// exit-code contract.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { build_report, render_text, MEASUREMENT_HEADER } from '../../src/scripts/_cli/cmd_route_explain.js';
import type { Router } from '../../src/scripts/_lib/router_match.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const ROUTER: Router = JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, 'dist', 'router.json'), 'utf-8'),
) as Router;

function matchedIds(prompt: string, files: string[] = []): string[] {
    return build_report(ROUTER, prompt, files, 'full').matches.map((m) => m.id);
}

describe('route:explain — pinned prompt → explanation goldens', () => {
    it('G1: "refactor the controller" fires the analyze/diff/architecture cluster', () => {
        const ids = matchedIds('refactor the controller');
        for (const expected of [
            'architecture',
            'broken-access-control',
            'think-before-action',
            'active-remediation',
            'senior-engineering-discipline',
            'improve-before-implement',
            'code-comment-discipline',
        ]) {
            expect(ids, `expected ${expected} in [${ids.join(', ')}]`).toContain(expected);
        }
    });

    it('G2: "fix the login endpoint" fires think-before-action + minimal-safe-diff + access control', () => {
        const ids = matchedIds('fix the login endpoint');
        expect(ids).toContain('think-before-action');
        expect(ids).toContain('minimal-safe-diff');
        expect(ids).toContain('broken-access-control');
    });

    it('G3: "review this contract" fires the advisory + legal floors', () => {
        const ids = matchedIds('please review this contract for me');
        expect(ids).toContain('domain-safety-disclaimer');
        expect(ids).toContain('legal-safety-floor');
    });

    it('G4: brand prompts route to the MERGED brand-source-of-truth (not the retired brand-consistency)', () => {
        const ids = matchedIds('Is this landing page copy on-brand for us?');
        expect(ids).toContain('brand-source-of-truth');
        expect(ids).not.toContain('brand-consistency');
    });

    it('G5: "what is our DCF valuation" fires ONLY the finance floor (disclaimer disjoined 2026-08-04)', () => {
        const ids = matchedIds('what is our DCF valuation');
        expect(ids).toContain('finance-safety-floor');
        expect(ids).not.toContain('domain-safety-disclaimer');
    });

    it('G6: "commit the secret password" fires the VCS guard, NOT security-sensitive-stop (disjoined)', () => {
        const ids = matchedIds('commit the secret password');
        expect(ids).toContain('secret-vcs-guard');
        expect(ids).not.toContain('security-sensitive-stop');
    });

    it('G7: "harden the oauth flow" fires security-sensitive-stop via its conversational surface', () => {
        const ids = matchedIds('harden the oauth flow');
        expect(ids).toContain('security-sensitive-stop');
    });

    it('G8: an editing prompt with a skills file fires the path_prefix rules via --files', () => {
        const report = build_report(ROUTER, 'polish this skill', ['src/skills/foo/SKILL.md'], 'full');
        const ids = report.matches.map((m) => m.id);
        expect(ids).toContain('framework-neutrality-in-generic-skills');
        const fn = report.matches.find((m) => m.id === 'framework-neutrality-in-generic-skills');
        expect(fn?.matched.some((l) => l.startsWith('path_prefix:'))).toBe(true);
    });

    it('G8b: skill-quality is NOT routed here — it loads unconditionally instead', () => {
        // This golden used to assert the opposite, and the change is the point
        // rather than an accommodation. road-to-single-delivery Phase 5.1 removed
        // the `src/skills/` path trigger from `skill-quality` (and from three
        // sibling package-only rules) so they survive `/compact` once ADR-236's
        // delivery partition removes their unscoped global twin — a path-scoped
        // rule is not re-injected after compaction (ADR-227), which would let an
        // Iron Law vanish mid-session.
        //
        // So the rule is no longer ROUTED at all: it is delivered unconditionally,
        // which is strictly more available than a path match. Asserting its absence
        // from the router's match set is what distinguishes that from a regression
        // where a rule silently stopped arriving.
        const report = build_report(ROUTER, 'polish this skill', ['src/skills/foo/SKILL.md'], 'full');
        expect(report.matches.map((m) => m.id)).not.toContain('skill-quality');
        const entry = [...(ROUTER.tier_1 as Array<{ id: string; triggers: unknown[] }>),
                       ...(ROUTER.tier_2 as Array<{ id: string; triggers: unknown[] }>)]
            .find((r) => r.id === 'skill-quality');
        expect(entry, 'skill-quality must still be a router entry').toBeDefined();
        expect(entry?.triggers, 'with an empty trigger list, i.e. unconditional').toEqual([]);
    });

    it('G9: a no-match prompt leaves only the kernel and reports every candidate as rejected', () => {
        const report = build_report(ROUTER, 'xyzzy blorp quux', [], 'full');
        expect(report.matches).toEqual([]);
        expect(report.kernel_always.length).toBe(9);
        const rejected = report.rejected.find((r) => r.reason === 'no trigger matched');
        expect(rejected?.ids.length).toBe(
            (ROUTER.tier_1 as unknown[]).length + (ROUTER.tier_2 as unknown[]).length,
        );
    });

    it('G10: profile=balanced excludes tier-2 and says why', () => {
        const report = build_report(ROUTER, 'refactor the controller', [], 'balanced');
        expect(report.matches.every((m) => m.tier === 'tier-1')).toBe(true);
        const excl = report.rejected.find((r) => r.reason.includes("excluded by profile 'balanced'"));
        expect(excl).toBeDefined();
        expect(excl?.ids.length).toBe((ROUTER.tier_2 as unknown[]).length);
    });
});

describe('route:explain — output contract', () => {
    it('the measurement-level header is the mandatory first line of the text output', () => {
        const report = build_report(ROUTER, 'refactor the controller', [], 'full');
        const text = render_text(report);
        expect(text.split('\n')[0]).toBe(MEASUREMENT_HEADER);
        expect(MEASUREMENT_HEADER).toContain('NOT measured here');
    });

    it('the JSON report carries the header as its first field and budget totals add up', () => {
        const report = build_report(ROUTER, 'refactor the controller', [], 'full');
        expect(Object.keys(report)[0]).toBe('measurement_level');
        const sum = report.matches.reduce((s, m) => s + m.body_chars, 0);
        expect(report.budget.matched_chars).toBe(sum);
        expect(sum).toBeGreaterThan(0);
    });

    it('every matched rule carries tier, disposition, and at least one trigger label', () => {
        const report = build_report(ROUTER, 'refactor the controller', [], 'full');
        for (const m of report.matches) {
            expect(['tier-1', 'tier-2']).toContain(m.tier);
            expect(m.disposition).toContain('projection time');
            expect(m.matched.length).toBeGreaterThan(0);
        }
    });
});
