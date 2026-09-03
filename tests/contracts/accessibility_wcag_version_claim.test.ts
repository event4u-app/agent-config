/**
 * The WCAG version an audit skill CLAIMS must be a version it CARRIES.
 *
 * The defect this pins (road-to-declared-coverage-truth Phase 2): the skill
 * stated "WCAG 2.2 AA" in four places while its own content carried two of
 * the nine criteria 2.2 added over 2.1 — and those two only as rows of a
 * corpus CSV, never as auditable conditions. A reader routed by the
 * description got a 2.1 audit under a 2.2 label.
 *
 * Why a test and not a `lint_*` gate: a gate script owes a gate-coverage row,
 * a minimum-scan floor and a self-test, and it would scan exactly one file.
 * The roadmap's step explicitly permits "a gate or test"; this is the smaller
 * of the two and runs in the same CI shard as every other contract test.
 *
 * The check is deliberately keyed on the CLAIMED version, not hardcoded to
 * 2.2: bumping the claim to a version with no registry below fails loudly
 * instead of passing silently. That is the property the drift needed.
 *
 * Sensitivity is asserted, not assumed — the third case runs the checker over
 * content with 2.4.11 deleted and requires a finding. A checker never seen
 * red has unknown sensitivity.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SKILL = path.join(REPO_ROOT, 'src/skills/accessibility-auditor/SKILL.md');

/**
 * Success criteria a WCAG version added over its predecessor, by level.
 * `aaa` entries are outside an AA claim and only have to be DISPOSITIONED
 * (present, or named with their level) — never silently absent.
 */
const CRITERIA_BY_VERSION: Record<string, { a: string[]; aa: string[]; aaa: string[] }> = {
    '2.2': {
        a: ['3.2.6', '3.3.7'],
        aa: ['2.4.11', '2.5.7', '2.5.8', '3.3.8'],
        aaa: ['2.4.12', '2.4.13'],
    },
};

export interface Finding {
    criterion: string;
    level: 'A' | 'AA' | 'AAA';
    why: string;
}

/**
 * Pure checker over the skill's own text. Returns every criterion the claim
 * covers that the content does not carry.
 */
export function checkVersionClaim(content: string): { claimed: string | null; level: string | null; findings: Finding[] } {
    const m = content.match(/WCAG\s+(\d+\.\d+)\s+(AAA|AA|A)\b/);
    if (!m) {
        return { claimed: null, level: null, findings: [] };
    }
    const claimed = m[1] as string;
    const level = m[2] as string;
    const registry = CRITERIA_BY_VERSION[claimed];
    const findings: Finding[] = [];
    if (!registry) {
        findings.push({
            criterion: '(registry)',
            level: 'AA',
            why: `the skill claims WCAG ${claimed} and CRITERIA_BY_VERSION has no entry for it — add the criterion list that version introduced`,
        });
        return { claimed, level, findings };
    }
    // An AA claim is cumulative: level A criteria are inside it.
    const required = level === 'A' ? registry.a : [...registry.a, ...registry.aa];
    for (const c of required) {
        if (!content.includes(c)) {
            findings.push({
                criterion: c,
                level: registry.aa.includes(c) ? 'AA' : 'A',
                why: `inside the claimed WCAG ${claimed} ${level} bar but absent from the skill's own content`,
            });
        }
    }
    // AAA criteria need a disposition, not coverage.
    for (const c of registry.aaa) {
        if (!content.includes(c)) {
            findings.push({
                criterion: c,
                level: 'AAA',
                why: `WCAG ${claimed} added it at level AAA — name it as an out-of-scope omission rather than leaving it silent`,
            });
        }
    }
    return { claimed, level, findings };
}

describe('accessibility-auditor: claimed WCAG version is carried', () => {
    const content = fs.readFileSync(SKILL, 'utf8');

    it('states a WCAG version and level at all', () => {
        const { claimed, level } = checkVersionClaim(content);
        expect(claimed).not.toBeNull();
        expect(level).not.toBeNull();
    });

    it('carries every criterion its claim covers, and dispositions the AAA ones', () => {
        const { findings } = checkVersionClaim(content);
        expect(
            findings.map((f) => `${f.criterion} (${f.level}): ${f.why}`),
            'the skill claims a WCAG version whose criteria it does not carry',
        ).toEqual([]);
    });

    it('is sensitive — removing 2.4.11 from the content produces a finding', () => {
        const mutated = content.replace(/2\.4\.11/g, 'XX');
        const { findings } = checkVersionClaim(mutated);
        expect(findings.some((f) => f.criterion === '2.4.11' && f.level === 'AA')).toBe(true);
    });

    it('is sensitive — claiming an unregistered version produces a finding', () => {
        const mutated = content.replace(/WCAG\s+2\.2/g, 'WCAG 2.9');
        const { claimed, findings } = checkVersionClaim(mutated);
        expect(claimed).toBe('2.9');
        expect(findings.some((f) => f.criterion === '(registry)')).toBe(true);
    });
});
