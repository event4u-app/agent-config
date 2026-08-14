// Tests for src/scripts/lint_originality.ts — the anti-reskin gate wiring.
//
// Unit layer over the pure helpers, plus two integration checks against the
// REAL corpus: a clean full audit exits 0, and a verbatim re-skin of an
// existing skill (written into a temp skill dir, removed in finally) is caught.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { FAIL, ROOT, WARN, _boilerplateSet, _dfFloor, main, overlap } from '../../src/scripts/lint_originality.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const art = (shingles: string[]): any => ({ cls: 'skill', relpath: 'x', label: 'x', shingles: new Set(shingles) });

describe('lint_originality — thresholds', () => {
    it('calibrated defaults: FAIL 60 above the legit floor, WARN 40', () => {
        expect(FAIL).toBe(60);
        expect(WARN).toBe(40);
        expect(FAIL).toBeGreaterThan(WARN);
    });
});

describe('lint_originality — _dfFloor', () => {
    it('is max(4, 3% of class size)', () => {
        expect(_dfFloor(10)).toBe(4); // 0.3 → rounded 0, floored to 4
        expect(_dfFloor(100)).toBe(4); // 3 → floored to 4
        expect(_dfFloor(200)).toBe(6);
        expect(_dfFloor(1000)).toBe(30);
    });
});

describe('lint_originality — _boilerplateSet', () => {
    it('flags shingles recurring in >= floor artifacts, keeps rare ones', () => {
        // 5 artifacts (floor = 4): "shared" appears in 4, "rare" in 2.
        const arts = [
            art(['shared', 'a1']),
            art(['shared', 'a2']),
            art(['shared', 'rare']),
            art(['shared', 'rare']),
            art(['unique']),
        ];
        const boiler = _boilerplateSet(arts);
        expect(boiler.has('shared')).toBe(true); // DF 4 >= floor 4
        expect(boiler.has('rare')).toBe(false); // DF 2 < floor — a re-skin pair survives
        expect(boiler.has('unique')).toBe(false);
    });
});

describe('lint_originality — overlap (containment)', () => {
    it('identical shingle sets score 100, disjoint score 0', () => {
        expect(overlap(art(['a', 'b', 'c']), art(['a', 'b', 'c']))).toBe(100);
        expect(overlap(art(['a', 'b']), art(['x', 'y']))).toBe(0);
    });
    it('containment uses the smaller set as denominator', () => {
        // small={a,b} fully inside large={a,b,c,d} → 100%.
        expect(overlap(art(['a', 'b']), art(['a', 'b', 'c', 'd']))).toBe(100);
    });
    it('empty set scores 0, never NaN', () => {
        expect(overlap(art([]), art(['a']))).toBe(0);
    });
});

describe('lint_originality — integration against the real corpus', () => {
    const FIXTURE_DIR = path.join(ROOT, 'src', 'skills', '__origtest_reskin_fixture');
    const FIXTURE = path.join(FIXTURE_DIR, 'SKILL.md');

    afterEach(() => {
        fs.rmSync(FIXTURE_DIR, { recursive: true, force: true });
    });

    it('full audit of the shipped corpus exits 0 (no re-skin present)', () => {
        expect(main(['--quiet'])).toBe(0);
    });

    it('a changed real skill does not flag itself (self-exclusion)', () => {
        // api-design is a real, unique skill; comparing it vs the corpus that
        // contains it must not fail on a self-match.
        expect(main(['--changed', 'src/skills/api-design/SKILL.md', '--quiet'])).toBe(1 - 1);
    });

    it('catches a verbatim re-skin of an existing skill (exit 1)', () => {
        const original = fs.readFileSync(path.join(ROOT, 'src', 'skills', 'api-design', 'SKILL.md'), 'utf-8');
        // A re-skin: the same body with framework nouns swapped — the engine
        // neutralizes those, so it still scores as a near-copy.
        const reskin = original
            .replace(/Laravel/g, 'Symfony')
            .replace(/\bREST\b/g, 'gRPC');
        fs.mkdirSync(FIXTURE_DIR, { recursive: true });
        fs.writeFileSync(FIXTURE, reskin, 'utf-8');
        expect(main(['--changed', 'src/skills/__origtest_reskin_fixture/SKILL.md', '--quiet'])).toBe(1);
    });
});

describe('lint_originality — adversarial batch masking is closed', () => {
    // A batch of >= _dfFloor near-identical NEW command files submitted together.
    // With the pre-fix DF pass (boilerplate computed INCLUDING the change set)
    // their shared shingles reach the floor, get classified as boilerplate,
    // subtracted, and score 0 against each other — the gate blinds itself. The
    // fix excludes the change set from the boilerplate baseline, so the batch is
    // caught. Commands floor = max(4, 3% of ~189) = 6, so 7 copies exercises it.
    const BATCH_DIR = path.join(ROOT, 'src', 'domains', '__origtest_batch');
    // A novel body (not in the corpus), long enough to shingle at k=8.
    const NOVEL = `---
name: batchcmd
pack: __origtest
---

# /batchcmd

This orchestrator coordinates a bespoke reconciliation sweep across every
ledger partition, folding divergent snapshots into a single authoritative
manifest before the downstream settlement window opens for the trading desk.
It never mutates a partition in place; it stages a shadow copy, diffs the
delta, and promotes only once the invariant checker signs off on the merge.`;

    afterEach(() => { fs.rmSync(BATCH_DIR, { recursive: true, force: true }); });

    it('flags a batch of 7 near-identical new commands (exit 1)', () => {
        const rel: string[] = [];
        for (let i = 1; i <= 7; i++) {
            const dir = path.join(BATCH_DIR, `c${i}`);
            fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(path.join(dir, 'command.md'), NOVEL, 'utf-8');
            rel.push(`src/domains/__origtest_batch/c${i}/command.md`);
        }
        expect(main(['--changed', ...rel, '--quiet'])).toBe(1);
    });

    it('stays closed under --base: files absent at the base contribute no scaffold', () => {
        // The guard must not depend on which form resolves "established". These
        // files exist nowhere in git, so their shared shingles cannot enter the
        // base-derived boilerplate set either.
        const rel: string[] = [];
        for (let i = 1; i <= 7; i++) {
            const dir = path.join(BATCH_DIR, `c${i}`);
            fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(path.join(dir, 'command.md'), NOVEL, 'utf-8');
            rel.push(`src/domains/__origtest_batch/c${i}/command.md`);
        }
        expect(main(['--base', 'HEAD', '--changed', ...rel, '--quiet'])).toBe(1);
    });
});

describe('lint_originality — whole-class change sets do not fabricate overlap', () => {
    // Regression pin for the degeneracy found in road-to-tier-removal Phase 4.
    // A mechanical edit across EVERY file of a class (there: dropping one
    // frontmatter key from all 200 commands) makes "on-disk corpus MINUS the
    // change set" empty. Nothing then clears the DF floor, no shingle is
    // scaffold, and the class's shared skeleton scores as authored overlap —
    // 3 pairs above FAIL where the full audit reports none.
    //
    // The fixture is the REAL command corpus, deliberately: a synthetic one
    // would not carry the cluster-head skeleton that produced the false fail.
    const ALL_COMMANDS = (): string[] => {
        const out: string[] = [];
        const walk = (dir: string): void => {
            for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
                const full = path.join(dir, ent.name);
                if (ent.isDirectory()) walk(full);
                else if (ent.name === 'command.md') out.push(path.relative(ROOT, full));
            }
        };
        walk(path.join(ROOT, 'src', 'domains'));
        return out.sort();
    };

    it('the entire command class as the change set passes with --base', () => {
        // HEAD is the committed state of these same files, so the established
        // corpus is non-empty and the scores match the full audit's.
        expect(main(['--base', 'HEAD', '--changed', ...ALL_COMMANDS(), '--quiet'])).toBe(0);
    });

    it('the full audit agrees — no pair is genuinely above FAIL', () => {
        // The pin above is only meaningful if the corpus really is clean; this
        // is the independent reading of the same question.
        expect(main(['--quiet'])).toBe(0);
    });

    it('--base is refused without --changed instead of being ignored', () => {
        expect(main(['--base', 'HEAD', '--quiet'])).toBe(2);
    });
});
