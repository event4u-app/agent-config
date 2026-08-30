/**
 * Published-tarball payload budget (road-to-zero-ceremony-install § Phase 4):
 * compressed size + per-skill share, each individually red-testable.
 *
 * A gate that cannot fail is worse than no gate. Every rule below has an
 * explicit RED case with a deliberately oversized fixture, and the committed
 * budget file is asserted separately so the gate is proven to hold on the real
 * tree rather than only on fixtures.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    evaluate,
    parsePackJson,
    recordedBuiltPackedMb,
    skillBytes,
    type PackResult,
    type PackSizeBudget,
} from '../../src/scripts/check_pack_size.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const COMMITTED = JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, 'src', 'config', 'pack-size-budget.json'), 'utf-8'),
) as PackSizeBudget & { owner: string; review_by: string; measurement_conditions: string };

const budget: PackSizeBudget = {
    regression_pct: 10,
    budgets: {
        packed_size_mb: { max: 10, last_measured: 5, method: 'npm pack --json' },
    },
    per_skill_share: {
        max_pct: 5,
        basis: 'test',
        rationale: 'test',
        exceptions: { big: { max_pct: 60, measured_pct: 55, reason: 'fixture exception with a real reason' } },
    },
};

/**
 * A pack result with a given compressed size and skill byte distribution.
 * `filler` spreads the remaining bytes over enough small skills that none of
 * them trips the share cap on its own — mirroring the real tree, where 285 of
 * 286 skills sit far below the cap.
 */
function pack(sizeMb: number, skills: Record<string, number>, filler = 0): PackResult {
    const files = Object.entries(skills).map(([name, size]) => ({
        path: `dist/agent-src/skills/${name}/SKILL.md`,
        size,
    }));
    for (let i = 0; i < filler; i += 1) {
        files.push({ path: `dist/agent-src/skills/filler-${i}/SKILL.md`, size: 10 });
    }
    files.push({ path: 'README.md', size: 100 });
    return { size: sizeMb * 1e6, unpackedSize: sizeMb * 4e6, files };
}

describe('parsePackJson', () => {
    it('parses a clean --json payload', () => {
        expect(parsePackJson('[{"size":1,"unpackedSize":2,"files":[]}]').size).toBe(1);
    });

    it('tolerates a lifecycle banner printed ahead of the JSON', () => {
        const polluted = '✅  git hooks installed\n[{"size":7,"unpackedSize":9,"files":[]}]';
        expect(parsePackJson(polluted).size).toBe(7);
    });

    it('tolerates a banner whose own text contains a `[` before the payload', () => {
        // Collision fixture, road-to-gates-that-can-fail Phase 6.2: npm echoes
        // the lifecycle command line, and this repo's `prepare` script IS
        // `[ -d .git ] && …` — so "slice from the first `[`" sliced from the
        // banner's bracket and threw `No number after minus sign in JSON`.
        const polluted =
            '\n> agent-config@9.13.0 prepare\n' +
            '> [ -d .git ] && bash src/scripts/install-hooks.sh || true\n\n' +
            '[{"size":7,"unpackedSize":9,"files":[]}]';
        expect(parsePackJson(polluted).size).toBe(7);
    });

    it('throws on an empty array rather than returning undefined', () => {
        expect(() => parsePackJson('[]')).toThrow();
    });

    it('still throws when there is no JSON payload at all', () => {
        // Sensitivity control: the candidate-scanning loop must not turn a
        // genuinely broken stream into a silent pass.
        expect(() => parsePackJson('> [ -d .git ] && echo no payload\n')).toThrow();
    });
});

describe('skillBytes', () => {
    it('sums per skill and ignores non-skill entries', () => {
        const { perSkill, total } = skillBytes([
            { path: 'dist/agent-src/skills/a/SKILL.md', size: 10 },
            { path: 'dist/agent-src/skills/a/data/x.csv', size: 20 },
            { path: 'dist/agent-src/skills/b/SKILL.md', size: 30 },
            { path: 'README.md', size: 999 },
        ]);
        expect(perSkill).toEqual({ a: 30, b: 30 });
        expect(total).toBe(60);
    });
});

describe('check_pack_size', () => {
    it('GREEN: under the absolute budget and under the creep ceiling', () => {
        expect(evaluate(budget, pack(5.2, { big: 500 }, 100))).toEqual([]);
    });

    it('RED: a deliberately oversized tarball fails the absolute budget', () => {
        const errors = evaluate(budget, pack(11, { big: 500 }, 100));
        expect(errors.some((e) => e.includes('exceeds budget'))).toBe(true);
    });

    it('RED: >10% growth fails even while under the absolute budget', () => {
        const errors = evaluate(budget, pack(6, { big: 500 }, 100));
        expect(errors).toHaveLength(1);
        expect(errors[0]).toContain('regressed >10%');
    });

    it('RED: a skill over the default share cap fails', () => {
        const errors = evaluate(budget, pack(5, { big: 500, hog: 400 }, 100));
        expect(errors.some((e) => e.includes('hog') && e.includes('over the 5% cap'))).toBe(true);
    });

    it('GREEN: a named exception may exceed the default cap', () => {
        expect(evaluate(budget, pack(5, { big: 500 }, 100))).toEqual([]);
    });

    it('RED: an exception is not a blank cheque — its own cap still binds', () => {
        // 2000 of 3000 skill bytes = 66.7%, past `big`'s own 60% exception cap.
        const errors = evaluate(budget, pack(5, { big: 2000 }, 100));
        expect(errors.some((e) => e.includes('exception cap'))).toBe(true);
    });

    it('RED: a stale exception for a skill that no longer ships is reported', () => {
        const errors = evaluate(budget, pack(5, {}, 100));
        expect(errors.some((e) => e.includes('stale'))).toBe(true);
    });

    it('RED: an empty skills subtree fails rather than passing vacuously', () => {
        const errors = evaluate(budget, { size: 1e6, unpackedSize: 4e6, files: [{ path: 'README.md', size: 1 }] });
        expect(errors.some((e) => e.includes('vacuously'))).toBe(true);
    });

    it('RED: a missing packed_size_mb entry fails rather than passing vacuously', () => {
        const stripped: PackSizeBudget = { ...budget, budgets: {} };
        const errors = evaluate(stripped, pack(5, { big: 500 }, 100));
        expect(errors.some((e) => e.includes('vacuously'))).toBe(true);
    });
});

describe('committed pack-size budget', () => {
    it('carries ownership and a review date (lint_budget_ownership contract)', () => {
        expect(COMMITTED.owner.length).toBeGreaterThan(0);
        expect(COMMITTED.review_by).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('records how the number was measured, not just the number', () => {
        expect(COMMITTED.measurement_conditions.length).toBeGreaterThan(80);
        expect(COMMITTED.measurement_conditions).toContain('--ignore-scripts');
        expect(COMMITTED.budgets['packed_size_mb']?.method.length ?? 0).toBeGreaterThan(20);
    });

    it('the absolute budget leaves headroom over the last measurement, but not unlimited', () => {
        const entry = COMMITTED.budgets['packed_size_mb'];
        expect(entry).toBeDefined();
        const e = entry as { max: number; last_measured: number };
        expect(e.max).toBeGreaterThan(e.last_measured);
        expect(e.max).toBeLessThan(e.last_measured * 1.5);
    });

    it('every per-skill exception carries a substantive reason', () => {
        const exceptions = Object.entries(COMMITTED.per_skill_share.exceptions);
        expect(exceptions.length).toBeGreaterThan(0);
        for (const [name, entry] of exceptions) {
            expect(entry.reason.length, name).toBeGreaterThan(60);
            expect(entry.max_pct, name).toBeGreaterThanOrEqual(entry.measured_pct);
        }
    });
});

describe('built vs unbuilt surface — the cap describes only one of them', () => {
    // The false red this split removes, measured 2026-08-30: main packed 8.985
    // MB over 2715 entries with `--ignore-scripts`; a branch adding six source
    // files packed 9.922 over 2827 and failed `max: 9.1`. The 112-entry
    // difference is `dist/cli` + `dist/cli-delegate` — the build, not the diff.
    const builtPack = (mb: number): PackResult => ({
        size: mb * 1e6,
        unpackedSize: mb * 3e6,
        files: [
            { path: 'dist/cli/index.js', size: 10 },
            { path: 'dist/agent-src/skills/a/SKILL.md', size: 10 },
        ],
    });
    const unbuiltPack = (mb: number): PackResult => ({
        size: mb * 1e6,
        unpackedSize: mb * 3e6,
        files: [{ path: 'dist/agent-src/skills/a/SKILL.md', size: 10 }],
    });
    const withBuilt: PackSizeBudget = {
        ...budget,
         
        built_surface_measurement_2026_08_24: { built: { packed_mb: 10.5 } },
    } as unknown as PackSizeBudget;

    // The fixtures carry one tiny skill, so the per-skill rules fire on every
    // case; this narrows each assertion to the size rule under test.
    const sizeErrors = (b: PackSizeBudget, p: PackResult): string[] =>
        evaluate(b, p).filter((e) => e.startsWith('packed_size_mb'));

    it('does NOT apply the unbuilt cap to a built payload', () => {
        // 10.8 is over `max: 10` and under the built ceiling 10.5 × 1.10.
        expect(sizeErrors(withBuilt, builtPack(10.8))).toEqual([]);
    });

    it('still applies the unbuilt cap to an unbuilt payload', () => {
        expect(sizeErrors(withBuilt, unbuiltPack(10.8)).join(' ')).toContain('exceeds budget 10');
    });

    it('fails a built payload that regressed past the recorded built figure', () => {
        // 11.7 > 10.5 × 1.10 = 11.55.
        const errs = sizeErrors(withBuilt, builtPack(11.7));
        expect(errs.join(' ')).toContain('BUILT surface');
        expect(errs.join(' ')).toContain('regressed');
    });

    it('REFUSES a built payload when no built figure is recorded, rather than passing it', () => {
        // The vacuous-pass shape: without this branch a built tree would be
        // compared against a cap that does not describe it, in either
        // direction. A missing baseline is a finding, not a green.
        expect(sizeErrors(budget, builtPack(1)).join(' ')).toContain('records no built-surface');
    });

    // removing_this_constraint_reds_it: delete the `built` branch in
    // `evaluate` — cases 1 and 4 red (case 1 fails the unbuilt cap, case 4
    // passes vacuously).

    it('reads the committed budget file: it carries a built figure', () => {
        // A fixture-only test would leave the real file free to drop the key
        // and turn every built run into the refusal above.
        expect(recordedBuiltPackedMb(COMMITTED)).toBeGreaterThan(0);
    });
});
