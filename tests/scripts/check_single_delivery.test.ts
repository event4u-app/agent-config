// Tests for check_single_delivery — the one-artefact-one-layer invariant (ADR-235).
//
// Written to close R2 finding 14 ("no test exercises the new gate"), and shaped by
// the three defects the review found in the gate itself, because a test that only
// covers the happy path would have caught none of them:
//
//   - the gate returned 1 UNCONDITIONALLY where it is meant to be bound, because
//     absent layers tripped the dead-scope assertion before `--enforce` was read;
//   - it reported name-equality across layers of different PAYLOAD SHAPE as
//     "delivered twice";
//   - `-enforce` with one dash fell through silently, downgrading a blocking run
//     to an advisory one.
//
// Each has a case below. The exit codes are asserted through `main()` directly
// rather than by spawning and reading `$?` through a pipe — the first manual
// verification of this gate reported 0 for every case because `$?` after `| tail`
// is tail's, not the script's.

import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { declaresPaths, evaluate, main } from '../../src/scripts/check_single_delivery.js';

let root: string;

function layer(scope: 'g' | 'p', type: string): string {
    const d = join(root, scope, type);
    mkdirSync(d, { recursive: true });
    return d;
}

function rule(dir: string, name: string, opts: { paths?: boolean } = {}): void {
    const fm = opts.paths === true ? '---\npaths:\n  - "src/**"\n---\n' : '---\ntype: auto\n---\n';
    writeFileSync(join(dir, name), `${fm}\nbody\n`, 'utf8');
}

beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'csd-'));
});
afterEach(() => {
    rmSync(root, { recursive: true, force: true });
});

describe('evaluate', () => {
    it('counts a same-shape overlap as duplicated', () => {
        rule(layer('g', 'rules'), 'shared.md');
        rule(layer('p', 'rules'), 'shared.md');
        const v = evaluate(join(root, 'g'), join(root, 'p'));
        expect(v.duplicated).toBe(1);
        expect(v.nameOverlapDifferentShape).toBe(0);
    });

    it('does NOT count a different-shape overlap as duplicated', () => {
        // The commands case that produced the false "40 duplicated" headline:
        // one layer holds regular files, the other holds directories.
        const g = layer('g', 'commands');
        writeFileSync(join(g, 'thing'), 'x', 'utf8');
        mkdirSync(join(layer('p', 'commands'), 'thing'), { recursive: true });
        const v = evaluate(join(root, 'g'), join(root, 'p'));
        expect(v.duplicated).toBe(0);
        expect(v.nameOverlapDifferentShape).toBe(1);
        expect(v.readings.find((r) => r.type === 'commands')?.shapeMismatch).toBe(true);
    });

    it('classifies a symlink as a symlink, not as its target kind', () => {
        // withFileTypes does not follow links, but a reader who checked
        // isDirectory() first would lose the distinction the shape field exists for.
        const target = join(root, 'target');
        mkdirSync(target, { recursive: true });
        mkdirSync(join(layer('g', 'skills'), 'real'), { recursive: true });
        symlinkSync(target, join(layer('p', 'skills'), 'real'));
        const v = evaluate(join(root, 'g'), join(root, 'p'));
        const skills = v.readings.find((r) => r.type === 'skills');
        expect(skills?.projectShape).toEqual({ symlinks: 1, dirs: 0, files: 0 });
        expect(skills?.globalShape).toEqual({ symlinks: 0, dirs: 1, files: 0 });
        expect(skills?.shapeMismatch).toBe(true);
    });

    it('reports a `paths:` disagreement as scope defeat', () => {
        rule(layer('g', 'rules'), 'scoped.md', { paths: false });
        rule(layer('p', 'rules'), 'scoped.md', { paths: true });
        const v = evaluate(join(root, 'g'), join(root, 'p'));
        expect(v.defeated).toBe(1);
    });

    it('distinguishes an absent layer from an empty one', () => {
        layer('g', 'rules'); // exists, empty
        const v = evaluate(join(root, 'g'), join(root, 'p'));
        const rules = v.readings.find((r) => r.type === 'rules');
        expect(rules?.globalNames).toEqual([]);
        expect(rules?.projectNames).toBeNull();
        expect(v.readNothing).toBe(true);
    });
});

describe('declaresPaths', () => {
    it('is three-valued so unreadable is not silently "no"', () => {
        const d = layer('g', 'rules');
        rule(d, 'with.md', { paths: true });
        rule(d, 'without.md', { paths: false });
        expect(declaresPaths(join(d, 'with.md'))).toBe('yes');
        expect(declaresPaths(join(d, 'without.md'))).toBe('no');
        expect(declaresPaths(join(d, 'absent.md'))).toBe('unreadable');
    });
});

describe('main exit codes', () => {
    let out: string[];
    beforeEach(() => {
        out = [];
        vi.spyOn(process.stdout, 'write').mockImplementation((c: unknown) => {
            out.push(String(c));
            return true;
        });
        vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    });
    afterEach(() => vi.restoreAllMocks());

    const args = (...extra: string[]): string[] => [
        '--global',
        join(root, 'g'),
        '--project',
        join(root, 'p'),
        ...extra,
    ];

    it('exits 0 on absent layers WITHOUT --enforce (the CI shape)', () => {
        // The high finding: this returned 1 unconditionally, contradicting --help.
        expect(main(args())).toBe(0);
    });

    it('exits 1 on absent layers WITH --enforce, and never calls it a pass', () => {
        expect(main(args('--enforce'))).toBe(1);
        expect(out.join('')).not.toContain('one artefact, one layer — no overlap');
    });

    it('exits 0 on disjoint layers under --enforce', () => {
        rule(layer('g', 'rules'), 'only-global.md');
        rule(layer('p', 'rules'), 'only-project.md');
        expect(main(args('--enforce'))).toBe(0);
    });

    it('exits 1 on a real overlap under --enforce, 0 without it', () => {
        rule(layer('g', 'rules'), 'shared.md');
        rule(layer('p', 'rules'), 'shared.md');
        expect(main(args('--enforce'))).toBe(1);
        expect(main(args())).toBe(0);
    });

    it('rejects a single-dash flag instead of silently reporting', () => {
        // `-enforce` used to fall through, so a typo turned a blocking run advisory.
        expect(main(args('-enforce'))).toBe(1);
    });

    it('rejects a bare positional', () => {
        expect(main(args('bogus'))).toBe(1);
    });

    it('rejects --global without a value', () => {
        expect(main(['--global'])).toBe(1);
    });
});

describe('unknown family in the project layer', () => {
    // The forcing function for this gate's OWN 2026-08-21 omission: `personas` was
    // written by a generator, shipped by the installer, and named by neither
    // measurer — so it was invisible rather than reported. A gate cannot report a
    // family it was never told exists, and nothing made the omission surface.
    const args = (...extra: string[]): string[] => [
        '--global',
        join(root, 'g'),
        '--project',
        join(root, 'p'),
        ...extra,
    ];

    it('REPORTS but does not refuse when --project is repointed', () => {
        // The refusal is scoped to `<repo>/.claude`, which `condense.ts` writes and
        // nothing else does. Under an arbitrary `--project` path an unrecognised
        // directory does not establish generator ownership — it may be a consumer
        // tree with a host-native or project-only family that legitimately cannot
        // overlap, and refusing there would make a nominal report exit 1 on a
        // correct topology. (Neutral review, 2026-08-21.) The refusal over the real
        // repo root is verified end-to-end, not here: `mkdir .claude/widgets` in the
        // checkout exits 1, removing it exits 0.
        rule(layer('g', 'rules'), 'a.md');
        rule(layer('p', 'rules'), 'b.md');
        mkdirSync(join(root, 'p', 'widgets'), { recursive: true });
        expect(main(args())).toBe(0);
        expect(main(args('--enforce'))).toBe(0);
    });

    it('still DETECTS the family under a repointed root — reporting, not blindness', () => {
        // The scoping above must not have turned detection off, only the exit code.
        rule(layer('g', 'rules'), 'a.md');
        mkdirSync(join(root, 'p', 'widgets'), { recursive: true });
        expect(evaluate(join(root, 'g'), join(root, 'p')).unknownFamilies).toEqual(['widgets']);
    });

    it('reports nothing on the same tree once the family is gone (mutation control)', () => {
        // Without this the assertions above could be passing for any reason at all.
        rule(layer('g', 'rules'), 'a.md');
        rule(layer('p', 'rules'), 'b.md');
        expect(evaluate(join(root, 'g'), join(root, 'p')).unknownFamilies).toEqual([]);
        expect(main(args())).toBe(0);
    });

    it('ignores dotfile directories and the six known families', () => {
        rule(layer('g', 'rules'), 'a.md');
        for (const t of ['rules', 'skills', 'commands', 'personas', 'user-types', 'agents']) {
            mkdirSync(join(root, 'p', t), { recursive: true });
        }
        mkdirSync(join(root, 'p', '.hidden'), { recursive: true });
        expect(evaluate(join(root, 'g'), join(root, 'p')).unknownFamilies).toEqual([]);
    });

    it('reports several unknown families sorted, not just the first', () => {
        mkdirSync(join(root, 'p', 'zeta'), { recursive: true });
        mkdirSync(join(root, 'p', 'alpha'), { recursive: true });
        expect(evaluate(join(root, 'g'), join(root, 'p')).unknownFamilies).toEqual(['alpha', 'zeta']);
    });
});
