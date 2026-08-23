/**
 * Tests for `src/scripts/grade_target_readiness.ts` — the readiness matrix
 * `/project:analyze` prints for a TARGET repository.
 *
 * These assertions ARE step 1.1/1.3/1.4's verify, discharged literally: the
 * roadmap asks that each dimension's presence be detected and its absence not
 * be, "both asserted by a vitest spec", and that the knockout string be pinned
 * exactly. A gather list in a command's markdown cannot be asserted by anything,
 * which is why the detection is a script.
 *
 * SABOTAGE PROBES, run 2026-08-23 before this file was trusted, each restored
 * from a backup copy (never `git checkout`, which would discard the uncommitted
 * fixtures):
 *   1. make the knockout verdict `max` instead of `min` → **3 of 17 red**,
 *      including the pinned `L0 — bound by CI enforcement` string;
 *   2. grade an undetectable dimension `0` instead of `null` → **4 red**, and the
 *      Python case reports a false absence, which is the exact defect 1.4 exists
 *      to prevent;
 *   3. add a percentage to `renderMatrix` → **2 red** (the anti-vanity assertions).
 * Restoring gives 17/17 and `git diff --stat` over the script is empty.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { grade, isPythonTarget, main, renderMatrix, selfTest } from '../../src/scripts/grade_target_readiness.js';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const FIX = join(REPO_ROOT, 'tests', 'fixtures', 'target-repos');
const full = join(FIX, 'full');
const ciAbsent = join(FIX, 'ci-absent');
const python = join(FIX, 'python');

describe('grade_target_readiness — 1.1 detection: presence detected, absence not', () => {
    it('detects every dimension it can in the full fixture', () => {
        const byId = new Map(grade(full).dimensions.map((d) => [d.id, d]));
        // Each of these has a config file in `full/`; a 0 here means the probe
        // stopped matching, which is the drift this assertion exists to catch.
        for (const id of [
            'behaviour-contract',
            'test-presence',
            'test-strength',
            'static-analysis',
            'architecture-gates',
            'security-supply-chain',
            'ci-enforcement',
            'independent-verification',
            'evidence-traceability',
        ]) {
            expect(byId.get(id)?.grade, id).toBeGreaterThan(0);
        }
    });

    it('does NOT detect what the ci-absent fixture removed', () => {
        // The only difference between the two fixtures is `.github/workflows/`.
        // Absence must read as 0, and it must not leak into other dimensions.
        const byId = new Map(grade(ciAbsent).dimensions.map((d) => [d.id, d]));
        expect(byId.get('ci-enforcement')?.grade).toBe(0);
        expect(byId.get('static-analysis')?.grade).toBe(1); // present, not enforced
        expect(byId.get('test-presence')?.grade).toBe(1);
    });

    it('grades 1 → 2 only when CI can actually fail the build', () => {
        // The distinction the roadmap asks for: a job that exists versus a job
        // that BLOCKS. `full/` has no continue-on-error, `ci-absent/` has no CI.
        const f = new Map(grade(full).dimensions.map((d) => [d.id, d]));
        expect(f.get('test-presence')?.grade).toBe(2);
        expect(f.get('static-analysis')?.grade).toBe(2);
    });

    it('all ten dimensions are always reported, present or not', () => {
        for (const root of [full, ciAbsent, python]) {
            expect(grade(root).dimensions).toHaveLength(10);
        }
    });
});

describe('grade_target_readiness — 1.3 knockout semantics, pinned exactly', () => {
    it('nine dimensions high and CI at 0 prints the exact bound string', () => {
        // The roadmap pins this literal so the binding dimension cannot quietly
        // become advisory.
        expect(renderMatrix(grade(ciAbsent))).toContain('L0 — bound by CI enforcement');
    });

    it('the level is the MINIMUM over knockouts, never an average or a max', () => {
        const m = grade(ciAbsent);
        const knockouts = m.dimensions.filter((d) => d.knockout);
        const lowest = Math.min(...knockouts.map((d) => (d.grade === null ? 0 : d.grade)));
        expect(m.level).toBe(lowest);
        // A max or a mean would both read above 0 here, since three of the four
        // knockouts are at 1 in this fixture.
        expect(Math.max(...knockouts.map((d) => d.grade ?? 0))).toBeGreaterThan(m.level);
    });

    it('marks exactly the four declared knockout dimensions', () => {
        const ids = grade(full).dimensions.filter((d) => d.knockout).map((d) => d.id).sort();
        expect(ids).toEqual(['ci-enforcement', 'security-supply-chain', 'static-analysis', 'test-presence']);
    });
});

describe('grade_target_readiness — 1.4 not-detectable is not zero', () => {
    it('a Python target prints the literal reason string', () => {
        expect(renderMatrix(grade(python))).toContain('not detectable — quality-tools has no Python mode');
    });

    it('the undetectable knockout BINDS at L0 with its reason', () => {
        const m = grade(python);
        expect(m.level).toBe(0);
        expect(m.boundBy).toBe('static analysis & types');
        expect(m.boundReason).toBe('quality-tools has no Python mode');
    });

    it('reports null rather than 0 — a 0 would claim a false absence', () => {
        // This is the whole point of 1.4. The Python fixture may well have mypy;
        // the tool cannot tell, and a 0 would assert that it does not.
        const sa = grade(python).dimensions.find((d) => d.id === 'static-analysis');
        expect(sa?.grade).toBeNull();
        expect(sa?.grade).not.toBe(0);
    });

    it('a target with package.json is not read as Python', () => {
        expect(isPythonTarget(python)).toBe(true);
        expect(isPythonTarget(full)).toBe(false);
    });
});

describe('grade_target_readiness — 1.2 no aggregate score, anywhere', () => {
    it('the rendered matrix contains no percentage and no x/100', () => {
        for (const root of [full, ciAbsent, python]) {
            const out = renderMatrix(grade(root));
            expect(out, root).not.toMatch(/%/);
            expect(out, root).not.toMatch(/\/100/);
        }
    });

    it('the command template gained the READINESS section and forbids a score', () => {
        const cmd = readFileSync(join(REPO_ROOT, 'src/domains/engineering-base/project/analyze/command.md'), 'utf-8');
        expect(cmd).toContain('READINESS');
        expect(cmd).toContain('grade_target_readiness');
        expect(cmd).toContain('Never emit an aggregate');
        expect(cmd).toContain('not detectable');
    });

    it('the DISPLAYED readiness block emits no aggregate — the prohibition text is not a violation', () => {
        // 1.2's verify as written is `grep -nE '/100|%'` over the new section,
        // and run literally it FAILS on the section's own prohibition sentence
        // ("No percentage, no `x/100`"). That is a false positive, not a defect:
        // the rule forbidding a score is not a score. So the assertion is scoped
        // to what the template tells the agent to PRINT — the fenced display
        // block — rather than to the prose that governs it. Recorded because a
        // future reader running the roadmap's grep will hit the same hit.
        const cmd = readFileSync(join(REPO_ROOT, 'src/domains/engineering-base/project/analyze/command.md'), 'utf-8');
        const start = cmd.indexOf('READINESS  (verbatim');
        expect(start).toBeGreaterThan(-1);
        const display = cmd.slice(start, cmd.indexOf('**Print the script', start));
        expect(display).not.toMatch(/%/);
        expect(display).not.toMatch(/\/100/);
    });
});

describe('grade_target_readiness — CLI and fixtures', () => {
    it('the three fixtures are committed', () => {
        for (const p of [full, ciAbsent, python]) expect(existsSync(p), p).toBe(true);
    });

    it('exits 0 on a real target and 1 on a missing one', () => {
        expect(main(['--quiet', '--target', full])).toBe(0);
        expect(main(['--quiet', '--target', join(FIX, 'nope')])).toBe(1);
    });

    it('self-test passes', () => {
        expect(selfTest()).toBe(0);
    }, 120_000);
});

/**
 * Evidence binding — `road-to-agentic-engineering-assurance` step 1.3, whose
 * verify line reads: *"`available` without at least one evidence ref fails
 * schema validation."*
 *
 * WHY THIS BLOCK EXISTS AND WHAT IT FOUND. The property already HOLDS — every
 * dimension in all three fixtures emits a non-empty `evidence` string, and both
 * `null` grades carry `notDetectable`. Nothing asserted it. So the umbrella
 * roadmap's 1.3 was satisfied in behaviour and unenforced in fact: a new
 * eleventh dimension could ship with `evidence: ''` and no gate, test or
 * reviewer would notice. That is the gap this block closes, and it is the honest
 * scope of the step — the grader was not rebuilt, an unasserted invariant was
 * pinned.
 *
 * SABOTAGE PROBES, run before this block was trusted, each restored from a `cp`
 * backup (never `git checkout`, which would discard uncommitted work):
 *   1. blank one dimension's `evidence` string → the first `it` goes red naming
 *      that dimension's id;
 *   2. drop `notDetectable` from the runtime-verification dimension → the second
 *      `it` goes red for all three fixtures.
 * Both restored; the recorded counts are in the roadmap step.
 */
describe('grade_target_readiness — 1.3 evidence binding', () => {
    it('every dimension in every fixture carries a non-empty evidence ref', () => {
        for (const [name, root] of [
            ['full', full],
            ['ci-absent', ciAbsent],
            ['python', python],
        ] as const) {
            for (const d of grade(root).dimensions) {
                expect(typeof d.evidence, `${name}/${d.id}`).toBe('string');
                expect(d.evidence.trim().length, `${name}/${d.id}`).toBeGreaterThan(0);
            }
        }
    });

    it('a null grade always says WHY it is not detectable, and a graded one never does', () => {
        // `null` is "this tool cannot tell", which the module docstring insists is
        // NOT a zero. An unexplained null is indistinguishable from a bug in the
        // probe, so the reason is what makes the distinction checkable.
        for (const [name, root] of [
            ['full', full],
            ['ci-absent', ciAbsent],
            ['python', python],
        ] as const) {
            for (const d of grade(root).dimensions) {
                if (d.grade === null) {
                    expect(d.notDetectable, `${name}/${d.id}`).toBeTruthy();
                    expect((d.notDetectable ?? '').trim().length, `${name}/${d.id}`).toBeGreaterThan(0);
                } else {
                    expect(d.notDetectable, `${name}/${d.id}`).toBeUndefined();
                }
            }
        }
    });
});
