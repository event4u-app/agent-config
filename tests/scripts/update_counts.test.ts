// Tests for src/scripts/update_counts.ts (py2ts Phase 5).
//
// Scope, stated as what this file holds: apply_to_text substitutions and drift
// detection, count() against the real tree, the README sub-note figures, the
// unapplied-pattern contract, and the TARGETS regression guard.
//
// A second layer was described in this header and never written — a
// python3-vs-tsx byte-identity run over stdout/stderr/exit plus a zero-drift
// update-mode pass. Its section marker sat at the bottom of the file with
// nothing under it, and the Python source has since been retired, so there is
// nothing left to be parity with. The header says so rather than implying a
// guard that is not here; the sibling header in generate_catalog.test.ts
// carried the same unbacked claim.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import * as uc from '../../src/scripts/update_counts.js';

afterEach(() => {
    vi.restoreAllMocks();
});

// Suppress the stderr warning apply_to_text emits on a missed pattern (the
// unittest test_missing_pattern_does_not_crash expects no crash, not silence).
function withSilentStderr<T>(fn: () => T): T {
    const se = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    try {
        return fn();
    } finally {
        se.mockRestore();
    }
}

// --- Layer 1: ported behavioural spec (apply_to_text) -----------------------

describe('update_counts.apply_to_text — ported from pytest', () => {
    it('replaces single number in match', () => {
        const text = 'Browse all 54 commands] today.';
        const counts = { commands: 57 };
        const patterns: Array<[string, string]> = [['(Browse all )(\\d+)( commands\\])', 'commands']];
        const [newText, drifts] = uc.apply_to_text(text, patterns, counts);
        expect(newText).toContain('Browse all 57 commands]');
        expect(drifts).toEqual([['commands', 54, 57]]);
    });

    it('no drift when number matches', () => {
        const text = 'Browse all 57 commands].';
        const counts = { commands: 57 };
        const patterns: Array<[string, string]> = [['(Browse all )(\\d+)( commands\\])', 'commands']];
        const [newText, drifts] = uc.apply_to_text(text, patterns, counts);
        expect(newText).toBe(text);
        expect(drifts).toEqual([]);
    });

    it('missing pattern does not crash', () => {
        const text = 'unrelated content';
        const counts = { commands: 57 };
        const patterns: Array<[string, string]> = [['(Browse all )(\\d+)( commands\\])', 'commands']];
        const [newText, drifts] = withSilentStderr(() => uc.apply_to_text(text, patterns, counts));
        expect(newText).toBe(text);
        expect(drifts).toEqual([]);
    });

    it('multiple patterns applied independently', () => {
        const text = 'Has 100 skills and 54 commands.';
        const counts = { skills: 112, commands: 57 };
        const patterns: Array<[string, string]> = [
            ['(Has )(\\d+)( skills)', 'skills'],
            ['(and )(\\d+)( commands)', 'commands'],
        ];
        const [newText, drifts] = uc.apply_to_text(text, patterns, counts);
        expect(newText).toContain('Has 112 skills');
        expect(newText).toContain('and 57 commands');
        const sorted = (d: Array<[string, number, number]>): Array<[string, number, number]> =>
            [...d].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
        expect(sorted(drifts)).toEqual(
            sorted([
                ['skills', 100, 112],
                ['commands', 54, 57],
            ]),
        );
    });

    it('same pattern multiple matches all updated', () => {
        const text = 'Browse all 54 commands] and Browse all 54 commands] later.';
        const counts = { commands: 57 };
        const patterns: Array<[string, string]> = [['(Browse all )(\\d+)( commands\\])', 'commands']];
        const [newText, drifts] = uc.apply_to_text(text, patterns, counts);
        expect((newText.match(/Browse all 57 commands\]/g) ?? []).length).toBe(2);
        expect(drifts.length).toBe(2);
    });
});

describe('update_counts.count — sanity against the real tree', () => {
    it('skills non-zero', () => {
        expect(uc.count('skills')).toBeGreaterThan(0);
    });
    it('rules non-zero', () => {
        expect(uc.count('rules')).toBeGreaterThan(0);
    });
    it('commands non-zero', () => {
        expect(uc.count('commands')).toBeGreaterThan(0);
    });
    it('guidelines counts nested', () => {
        expect(uc.count('guidelines')).toBeGreaterThan(0);
    });
    it('personas non-zero', () => {
        expect(uc.count('personas')).toBeGreaterThan(0);
    });
});

// `road-to-surfaces-no-gate-reads` Phase 1. The README sub-note carries four
// figures in prose, and three of them had no owner: at the base it said
// "Rules 121" against 122 source rules and "projection holds 120" against 121.
// The Commands half the audit reported was already correct, which is the point
// — a hand-typed figure is right until it is not, and nothing says when.
describe('update_counts — the README sub-note figures, 1.1', () => {
    it('counts top-level command files, non-recursively', () => {
        const top = uc.count('commands_toplevel');
        expect(top).toBeGreaterThan(0);
        // Non-recursive is the whole claim: the sub-note exists to explain why
        // the badge and the linked directory differ, so a recursive count here
        // would make the sentence explain nothing.
        expect(top).toBeLessThan(uc.count('commands_active'));
    });

    it('counts projected rules, which is not the source count', () => {
        const projected = uc.count('rules_projected');
        expect(projected).toBeGreaterThan(0);
        // A dormant rule is not projected, so the projection is at most the
        // source count — and the sub-note's job is to say so with real numbers.
        expect(projected).toBeLessThanOrEqual(uc.count('rules'));
    });

    it('the README entry carries a pattern for each of the four figures', () => {
        const readme = uc.TARGETS.find(([rel]) => rel === 'README.md');
        expect(readme).toBeDefined();
        const kinds = (readme as [string, ReadonlyArray<[string, string]>])[1].map(([, kind]) => kind);
        for (const kind of ['commands_active', 'commands_toplevel', 'rules', 'rules_projected']) {
            expect(kinds).toContain(kind);
        }
    });

    it('a stale sub-note figure is a drift, not a silent pass', () => {
        const stale =
            '**Commands 205** counts every command file **recursively** (the linked directory ' +
            'holds 60 at its top level), and **Rules 999** counts the **source** rules while the ' +
            'linked projection holds 998 — one rule is dormant and is not projected.';
        const readme = uc.TARGETS.find(([rel]) => rel === 'README.md') as [
            string,
            ReadonlyArray<[string, string]>,
        ];
        const counts = { commands_active: 205, commands_toplevel: 60, rules: 122, rules_projected: 121 };
        const [fixed, drifts] = withSilentStderr(() =>
            uc.apply_to_text(stale, readme[1] as Array<[string, string]>, counts),
        );
        expect(drifts.map(([kind]) => kind).sort()).toEqual(['rules', 'rules_projected']);
        expect(fixed).toContain('**Rules 122**');
        expect(fixed).toContain('projection holds 121');
        // The halves that were already right are left exactly as they were.
        expect(fixed).toContain('**Commands 205**');
        expect(fixed).toContain('holds 60 at its top level');
    });
});

describe('update_counts.apply_to_text — a kind with no count is refused', () => {
    it('never writes the literal `undefined` into a target', () => {
        // Measured 2026-10-12 while adding the sub-note patterns: two new
        // patterns whose kinds were not in KINDS rewrote the README to "holds
        // undefined at its top level", and `--check` then reported "All counts
        // in sync" because the pattern no longer matched its own output. A
        // generator that can corrupt the file it maintains, and then call the
        // corruption clean, is worse than one that does nothing.
        const text = 'the directory holds 60 at its top level';
        const patterns: Array<[string, string]> = [['(holds )(\\d+)( at its top level)', 'nonexistent_kind']];
        const [out, drifts] = withSilentStderr(() => uc.apply_to_text(text, patterns, { rules: 122 }));
        expect(out).toBe(text);
        expect(out).not.toContain('undefined');
        expect(drifts).toEqual([]);
    });

    it('every kind named in TARGETS has a count', () => {
        // The structural version of the same defect: this fails when a pattern
        // is added without its kind, instead of the README finding out.
        const counts: Record<string, number> = {};
        for (const kind of uc.KINDS) counts[kind] = uc.count(kind);
        for (const [, patterns] of uc.TARGETS) {
            for (const [, kind] of patterns) {
                expect(typeof counts[kind], `kind "${kind}" is in TARGETS but not in KINDS`).toBe('number');
            }
        }
    });
});

describe('update_counts — missed-pattern-fails', () => {
    // A pattern that matches nothing used to warn on stderr and continue, so
    // --check printed "All counts in sync" about a sentence it could not find.
    // The figure that pattern owned was then ungenerated and ungated, and the
    // only signal was a line in a stream nobody reads on a passing run.
    function withTempTarget(body: string, fn: (root: string) => void) {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'uc-'));
        try {
            fs.writeFileSync(path.join(root, 'TARGET.md'), body, 'utf-8');
            fn(root);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    }

    it('--check exits 1 and names the pattern that applied to nothing', () => {
        const err = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
        const out = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
        withTempTarget('this file mentions no count at all\n', (root) => {
            const code = uc.main(['--check'], {
                root,
                targets: [['TARGET.md', [['(ships )(\\d+)( rules)', 'rules']]]],
            });
            expect(code).toBe(1);
            const written = err.mock.calls.map((c) => String(c[0])).join('');
            expect(written).toContain('TARGET.md');
            expect(written).toContain('pattern matched nothing');
            expect(written).toContain('(ships )(\\d+)( rules)');
            // The misleading half: it must NOT also claim the tree is in sync.
            expect(out.mock.calls.map((c) => String(c[0])).join('')).not.toContain('All counts in sync');
        });
    });

    it('--check exits 1 when a pattern names a kind that has no count', () => {
        // The same silent-pass shape one branch over: the substitution is
        // refused to avoid writing `undefined`, and the refusal then passed.
        const err = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
        vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
        withTempTarget('ships 7 widgets\n', (root) => {
            const code = uc.main(['--check'], {
                root,
                targets: [['TARGET.md', [['(ships )(\\d+)( widgets)', 'no_such_kind']]]],
            });
            expect(code).toBe(1);
            expect(err.mock.calls.map((c) => String(c[0])).join('')).toContain('no count for this kind');
        });
    });

    it('--check still passes when every pattern applies', () => {
        // The negative control: without it the two tests above would pass on a
        // main() that returned 1 unconditionally.
        vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
        const out = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
        withTempTarget(`ships ${uc.count('rules')} rules\n`, (root) => {
            const code = uc.main(['--check'], {
                root,
                targets: [['TARGET.md', [['(ships )(\\d+)( rules)', 'rules']]]],
            });
            expect(code).toBe(0);
            expect(out.mock.calls.map((c) => String(c[0])).join('')).toContain('All counts in sync');
        });
    });
});

describe('update_counts — the claim row admits only re-derived badges', () => {
    const readmePatterns = uc.TARGETS.find(([rel]) => rel === 'README.md')?.[1] ?? [];
    const badgePatterns = readmePatterns.filter(([p]) => p.includes('/badge/'));
    const downloads =
        '[![npm downloads](https://img.shields.io/npm/dm/@event4u/agent-config?label=downloads%2Fmonth)](https://www.npmjs.com/package/@event4u/agent-config)';

    function claimRow(): string {
        const names: Record<string, string> = {
            skills: 'Skills',
            rules: 'Rules',
            commands_active: 'Commands',
            guidelines: 'Guidelines',
            personas: 'Personas',
            advisors: 'Advisors',
        };
        const badges = badgePatterns.map(
            ([, kind]) => `[![x](https://img.shields.io/badge/${names[kind]}-${uc.count(kind)}-orange)](x/)`,
        );
        return `${badges.join(' ')} ${uc.CLAIM_ROW_MARKER}`;
    }

    function runCheck(body: string): { code: number; err: string } {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'uc-claim-'));
        const err = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
        vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
        try {
            fs.writeFileSync(path.join(root, 'README.md'), body, 'utf-8');
            const code = uc.main(['--check'], { root, targets: [['README.md', badgePatterns]] });
            return { code, err: err.mock.calls.map((c) => String(c[0])).join('') };
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    }

    it('every badge on the real claim row is re-derived, Advisors included', () => {
        const text = fs.readFileSync(path.join(uc.REPO_ROOT, 'README.md'), 'utf-8');
        expect(badgePatterns.map(([, kind]) => kind)).toContain('advisors');
        expect(uc.claim_row_findings(text, readmePatterns)).toEqual([]);
    });

    it('a download badge ON the claim line makes --check exit non-zero', () => {
        const row = claimRow().replace(uc.CLAIM_ROW_MARKER, `${downloads} ${uc.CLAIM_ROW_MARKER}`);
        const { code, err } = runCheck(`# T\n\n${row}\n`);
        expect(code).not.toBe(0);
        expect(err).toContain('README.md:3');
        expect(err).toContain('/npm/dm/');
    });

    it('a reference-style image ON the claim line is resolved and checked', () => {
        const dm = 'https://img.shields.io/npm/dm/@event4u/agent-config';
        const row = claimRow().replace(uc.CLAIM_ROW_MARKER, `![downloads][dl] ${uc.CLAIM_ROW_MARKER}`);
        const findings = uc.claim_row_findings(`# T\n\n${row}\n\n[dl]: ${dm}\n`, readmePatterns);
        expect(findings).toEqual([[3, dm]]);
    });

    it('a collapsed reference image ON the claim line is resolved and checked', () => {
        const dm = 'https://img.shields.io/npm/dm/@event4u/agent-config';
        const row = claimRow().replace(uc.CLAIM_ROW_MARKER, `![dl][] ${uc.CLAIM_ROW_MARKER}`);
        expect(uc.claim_row_findings(`${row}\n\n[dl]: <${dm}> "title"\n`, readmePatterns)).toEqual([[1, dm]]);
    });

    it('a reference image with no definition is a finding, never a pass', () => {
        const row = claimRow().replace(uc.CLAIM_ROW_MARKER, `![x][missing] ${uc.CLAIM_ROW_MARKER}`);
        expect(uc.claim_row_findings(row, readmePatterns)).toEqual([[1, '[missing]']]);
    });

    it('a reference image resolving to a count badge passes', () => {
        const [first] = claimRow().match(/https:\/\/img\.shields\.io\/badge\/[^)\s]+/) ?? [];
        expect(first).toBeDefined();
        const row = claimRow().replace(uc.CLAIM_ROW_MARKER, `![c][count] ${uc.CLAIM_ROW_MARKER}`);
        expect(uc.claim_row_findings(`${row}\n[count]: ${first}\n`, readmePatterns)).toEqual([]);
    });

    it('an HTML <img> ON the claim line is checked', () => {
        const dm = 'https://img.shields.io/npm/dm/@event4u/agent-config';
        const row = claimRow().replace(uc.CLAIM_ROW_MARKER, `<img alt="dl" src='${dm}'> ${uc.CLAIM_ROW_MARKER}`);
        expect(uc.claim_row_findings(row, readmePatterns)).toEqual([[1, dm]]);
    });

    it('the same badge one line above the claim line exits 0', () => {
        const { code, err } = runCheck(`# T\n${downloads}\n${claimRow()}\n`);
        expect(err).not.toContain('claim row');
        expect(code).toBe(0);
    });
});

describe('update_counts.TARGETS — regression guard', () => {
    it('stronger-skills baseline is not tracked', () => {
        const paths = uc.TARGETS.map(([rel]) => rel);
        expect(paths).not.toContain('agents/roadmaps/road-to-stronger-skills.md');
        expect(paths).not.toContain('agents/roadmaps/skipped/road-to-stronger-skills.md');
    });
});
