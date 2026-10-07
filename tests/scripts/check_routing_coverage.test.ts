// Tests for src/scripts/check_routing_coverage.ts — the two coverage ratchets.
//
// The property worth guarding is not "does it count" but "does it count the
// right denominator". A ratio falls two ways — a corpus case removed, or units
// added without cases — and a count ratchet would call the second one progress.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    SEED_REL,
    evaluate,
    main,
    measureRules,
    measureSkills,
    baseResolvable,
    baseUsable,
    localPaths,
    measureTouchedSkills,
    r4,
    readSeed,
    renderUncoveredCensus,
    uncoveredByPack,
} from '../../src/scripts/check_routing_coverage';

const REPO = path.resolve(__dirname, '..', '..');

let root: string;

function write(rel: string, body: string): void {
    const p = path.join(root, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, body);
}

/** A tree with 4 routed rules (2 covered) and 4 skills (1 covered). */
function fixture(seed = { rules: 0.5, skills: 0.25 }): void {
    write(
        'dist/router.json',
        JSON.stringify({
            tier_1: [{ id: 'alpha' }, { id: 'beta' }],
            tier_2: [{ id: 'gamma' }, { id: 'delta' }],
        }),
    );
    write('tests/eval/routing-matrix/alpha.yaml', 'cases: []\n');
    write('tests/eval/routing-matrix/gamma.yaml', 'cases: []\n');
    for (const s of ['s1', 's2', 's3', 's4']) write(`src/skills/${s}/SKILL.md`, `---\nname: ${s}\n---\n`);
    write('src/skills/s1/evals/triggers.json', '{}');
    write(SEED_REL, JSON.stringify({ seed }));
}

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'rcov-'));
});
afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

describe('the denominator is routed UNITS, not corpus files', () => {
    it('counts the intersection, so a fixture naming no routed rule cannot lift the ratio', () => {
        fixture();
        expect(measureRules(root)).toMatchObject({ cases: 2, units: 4, ratio: 0.5 });
        // A fixture for a rule that is not routed at all: the file count rises,
        // coverage must not.
        write('tests/eval/routing-matrix/not-a-routed-rule.yaml', 'cases: []\n');
        expect(measureRules(root)).toMatchObject({ cases: 2, units: 4, ratio: 0.5 });
    });

    it('a skill without SKILL.md is not a routed unit', () => {
        fixture();
        fs.mkdirSync(path.join(root, 'src/skills/not-a-skill'), { recursive: true });
        expect(measureSkills(root).units).toBe(4);
    });

    it('adding units WITHOUT cases lowers the ratio — the count-ratchet blind spot', () => {
        // The reason this is a ratio: every count rises here and coverage falls.
        fixture();
        const before = evaluate(root);
        expect(before.fallen).toEqual([]);
        for (const s of ['s5', 's6', 's7', 's8']) write(`src/skills/${s}/SKILL.md`, `---\nname: ${s}\n---\n`);
        const after = evaluate(root);
        expect(after.readings.find((x) => x.scope === 'skills')!.cases).toBe(1); // unchanged
        expect(after.readings.find((x) => x.scope === 'skills')!.units).toBe(8); // rose
        expect(after.fallen).toEqual(['skills']);
    });
});

describe('the ratchet fails only on a decrease', () => {
    it('is green at seed and green above it', () => {
        fixture();
        expect(evaluate(root).fallen).toEqual([]);
        write('tests/eval/routing-matrix/beta.yaml', 'cases: []\n');
        expect(evaluate(root).fallen).toEqual([]);
    });

    it('reds when a corpus case is removed, and greens when restored', () => {
        fixture();
        fs.rmSync(path.join(root, 'tests/eval/routing-matrix/alpha.yaml'));
        expect(evaluate(root).fallen).toEqual(['rules']);
        write('tests/eval/routing-matrix/alpha.yaml', 'cases: []\n');
        expect(evaluate(root).fallen).toEqual([]);
    });

    it('names BOTH scopes when both fall, never just the first', () => {
        fixture();
        fs.rmSync(path.join(root, 'tests/eval/routing-matrix/alpha.yaml'));
        fs.rmSync(path.join(root, 'src/skills/s1/evals/triggers.json'));
        expect(evaluate(root).fallen.sort()).toEqual(['rules', 'skills']);
    });
});

describe('display and verdict share one rounding', () => {
    it('r4 rounds to the comparison precision', () => {
        expect(r4(0.895238095)).toBe(0.8952);
        expect(r4(0.254180602)).toBe(0.2542);
    });

    it('a ratio equal to seed after rounding is NOT a fall', () => {
        // The defect this guards: the first version compared the raw float in
        // the row and the rounded value in the verdict, so rules printed `↑` and
        // skills printed `❌` while the summary correctly said green. A gate
        // whose rows contradict its verdict is worse than one that is wrong.
        fixture({ rules: 0.5, skills: 0.25 });
        const v = evaluate(root);
        for (const r of v.readings) expect(r4(r.ratio)).toBe(r4(v.seed[r.scope]));
        expect(v.fallen).toEqual([]);
    });
});

describe('a missing input is a dead scope, never a pass', () => {
    it('no seed file is exit 2 — a ratchet with no seed passes every tree', () => {
        fixture();
        fs.rmSync(path.join(root, SEED_REL));
        expect(main([], root)).toBe(2);
    });

    it('a seed missing one scope is exit 2, not a half-checked run', () => {
        fixture();
        write(SEED_REL, JSON.stringify({ seed: { rules: 0.5 } }));
        expect(main([], root)).toBe(2);
    });

    it('an unreadable router is exit 2, not coverage zero', () => {
        fixture();
        fs.rmSync(path.join(root, 'dist/router.json'));
        expect(main([], root)).toBe(2);
    });
});

describe('the live tree', () => {
    it('is at seed in both scopes', () => {
        const v = evaluate(REPO);
        expect(v.fallen).toEqual([]);
    });

    it('the seeds ARE the live measurement, whatever it currently reads', () => {
        // Deliberately NOT pinned to 0.8952 / 0.2542. Those were the values on
        // the day the ratchet landed, and the very next commit in the same
        // roadmap raised the skills seed to 0.3010 by adding corpus files —
        // which reddened the pinned version for doing exactly what the ratchet
        // exists to encourage. A snapshot of a number the work is supposed to
        // move is a test of the calendar, not of the gate.
        const s = readSeed(REPO);
        expect(r4(measureRules(REPO).ratio)).toBe(r4(s.rules));
        expect(r4(measureSkills(REPO).ratio)).toBe(r4(s.skills));
    });

    it('and the two scopes still differ sharply — the gap IS defect D1', () => {
        // The rules surface is covered by a corpus that can fail a PR; the
        // skills surface, which production routes on, is covered only by a
        // harness its own header calls advisory. The threshold is loose on
        // purpose: it asserts the SHAPE of the finding, and closing the gap is
        // the roadmap's goal, so a future run that legitimately narrows it
        // should change this line deliberately rather than trip it.
        const s = readSeed(REPO);
        expect(s.rules - s.skills).toBeGreaterThan(0.4);
    });

    it('measures 107 routed rules and 299 routed skills', () => {
        // 106 -> 107 on 2026-10-06: `neighbour-precedence`
        // (road-to-neighbours-that-pull-their-weight 2.1).
        // 105 -> 106 on 2026-09-13: `test-first`
        // (road-to-adversarial-verification-and-long-runs 1.1). A pinned
        // DENOMINATOR is deliberately different from the pinned RATIO the test
        // above refuses to snapshot: the ratio is what the work is supposed to
        // move, while the unit count changing means the estate changed, which is
        // a thing a reader should be told about rather than have absorbed.
        expect(measureRules(REPO).units).toBe(107);
        expect(measureSkills(REPO).units).toBe(299);
    });
});

// The touched-skill scope. The two ratios above are estate-wide and patient:
// editing a corpus-less skill moves neither, because numerator and denominator
// both stay put. What follows pins the third scope, whose value is that it is
// diff-shaped — and whose risk is that an unresolvable base ref reads as
// "nothing touched" and passes while checking nothing.

function gitAt(at: string): (...args: string[]) => string {
    const env = { ...process.env };
    for (const k of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_COMMON_DIR']) delete env[k];
    return (...args: string[]): string => {
        const r = spawnSync('git', args, { cwd: at, encoding: 'utf-8', env });
        if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
        return r.stdout;
    };
}

function gitInit(at: string, edit: () => void): void {
    const git = gitAt(at);
    git('init', '--quiet', '--initial-branch=base');
    git('config', 'user.email', 'test@example.invalid');
    git('config', 'user.name', 'test');
    git('config', 'commit.gpgsign', 'false');
    git('add', '--all');
    git('commit', '--quiet', '-m', 'baseline');
    edit();
}

/** Commit `edit` onto a feature branch, so the change lives in HEAD and not the tree. */
function gitCommitOnBranch(at: string, edit: () => void): void {
    gitInit(at, () => undefined);
    const git = gitAt(at);
    git('checkout', '--quiet', '-b', 'feature');
    edit();
    git('add', '--all');
    git('commit', '--quiet', '-m', 'the change');
}

describe('check_routing_coverage — the touched-skill scope', () => {
    it('reports a touched skill that carries no corpus', () => {
        fixture();
        gitInit(root, () => write('src/skills/s4/SKILL.md', '---\nname: s4\nedited: true\n---\n'));
        const t = measureTouchedSkills(root, 'base');
        expect(t.measured).toBe(true);
        expect(t.touched).toEqual(['s4']);
        expect(t.uncovered).toEqual(['s4']);
    });

    it('accepts a touched skill that does carry a corpus', () => {
        fixture();
        gitInit(root, () => write('src/skills/s1/SKILL.md', '---\nname: s1\nedited: true\n---\n'));
        const t = measureTouchedSkills(root, 'base');
        expect(t.touched).toEqual(['s1']);
        expect(t.uncovered).toEqual([]);
    });

    it('ignores corpus-less skills the diff never touched', () => {
        fixture();
        gitInit(root, () => write('unrelated.txt', 'x\n'));
        const t = measureTouchedSkills(root, 'base');
        expect(t.touched).toEqual([]);
        expect(t.uncovered).toEqual([]);
    });

    it('an unresolvable base is NOT read as an empty touch set', () => {
        fixture();
        gitInit(root, () => write('src/skills/s4/SKILL.md', '---\nname: s4\nedited: true\n---\n'));
        const t = measureTouchedSkills(root, 'no-such-ref');
        expect(t.measured).toBe(false);
    });

    it('main exits 1 on an uncovered touched skill and 0 once its corpus lands', () => {
        fixture();
        gitInit(root, () => write('src/skills/s4/SKILL.md', '---\nname: s4\nedited: true\n---\n'));
        expect(main(['--base', 'base', '--quiet'], root)).toBe(1);
        write('src/skills/s4/evals/triggers.json', '{}');
        expect(main(['--base', 'base', '--quiet'], root)).toBe(0);
    });
});

// The by-pack census. Its risk is not arithmetic but OMISSION: a skill dropped
// from the table is invisible to the contributor who would have written its
// corpus, and a table that silently lists 197 of 198 reads exactly like one that
// lists all of them.
describe('check_routing_coverage --census', () => {
    function packed(name: string, packs: string[], corpus = false): void {
        write(
            `src/skills/${name}/SKILL.md`,
            `---\nname: ${name}\npacks:\n${packs.map((p) => `  - ${p}\n`).join('')}---\n`,
        );
        if (corpus) write(`src/skills/${name}/evals/triggers.json`, '{}');
    }

    it('lists only the skills with NO corpus, grouped by the packs they declare', () => {
        fixture();
        packed('covered', ['alpha'], true);
        packed('bare', ['alpha', 'beta']);
        const byPack = uncoveredByPack(root);
        expect(byPack['alpha']).toEqual(['bare']);
        expect(byPack['beta']).toEqual(['bare']);
    });

    it('buckets a pack-less skill rather than dropping it — an omission is the defect', () => {
        fixture();
        packed('nopack', []);
        expect(uncoveredByPack(root)['(no pack declared)']).toContain('nopack');
    });

    it('the rendered total equals units minus cases, so the table cannot disagree with the ratio', () => {
        fixture();
        const lines = renderUncoveredCensus(root);
        const reading = measureSkills(root);
        expect(lines[0]).toContain(`**${String(reading.units - reading.cases)} of ${String(reading.units)}**`);
    });

    it('every uncovered skill appears in the rendered table at least once', () => {
        fixture();
        packed('bare-one', ['alpha']);
        packed('bare-two', []);
        const text = renderUncoveredCensus(root).join('\n');
        for (const name of ['bare-one', 'bare-two', 's2', 's3', 's4']) expect(text).toContain(`\`${name}\``);
        expect(text).not.toContain('`s1`');
    });

    it('--census exits 0 and prints the table without running the ratchet', () => {
        fixture({ rules: 0.99, skills: 0.99 });
        expect(main(['--census'], root)).toBe(0);
    });
});

// The BRANCH arm — the one CI actually uses, and the one the first round of
// tests never exercised because every fixture left its edit uncommitted. A
// shallow clone is its failure mode: `git rev-parse origin/main` succeeds while
// `git diff origin/main...HEAD` exits 128 with `no merge base`, so a gate that
// probes ref existence reads zero changed paths and passes over a corpus it
// never saw.
describe('check_routing_coverage — the branch arm, committed rather than dirty', () => {
    it('sees a corpus-less skill changed in a COMMIT, not only in the working tree', () => {
        fixture();
        gitCommitOnBranch(root, () => write('src/skills/s4/SKILL.md', '---\nname: s4\nedited: true\n---\n'));
        const t = measureTouchedSkills(root, 'base');
        expect(t.measured).toBe(true);
        expect(t.touched).toEqual(['s4']);
        expect(t.uncovered).toEqual(['s4']);
    });

    it('main exits 1 on a committed uncovered skill', () => {
        fixture();
        gitCommitOnBranch(root, () => write('src/skills/s4/SKILL.md', '---\nname: s4\nedited: true\n---\n'));
        expect(main(['--base', 'base', '--quiet'], root)).toBe(1);
    });

    it('baseUsable is false when the ref RESOLVES but cannot be diffed', () => {
        // Two unrelated histories: `other` exists as a ref and shares no commit
        // with HEAD, which is the same `no merge base` git reports in a shallow
        // clone. Ref existence alone would call this usable.
        fixture();
        gitCommitOnBranch(root, () => write('src/skills/s4/SKILL.md', '---\nname: s4\nedited: true\n---\n'));
        const git = gitAt(root);
        // Built with plumbing rather than `checkout --orphan`: the orphan
        // checkout would have to unstage the whole fixture first, and what this
        // test needs is only a ref with no common ancestor.
        const emptyTree = git('mktree').trim();
        const orphan = git('commit-tree', emptyTree, '-m', 'unrelated root').trim();
        git('update-ref', 'refs/heads/other', orphan);
        expect(baseResolvable(root, 'other')).toBe(true);
        expect(baseUsable(root, 'other')).toBe(false);
    });

    it('an undiffable base still fails on a DIRTY uncovered skill — the local arms need no base', () => {
        // The half a bare early-return threw away: working tree, index and
        // untracked need no merge base, so an unresolvable base must narrow the
        // claim rather than switch the scope off.
        fixture();
        gitInit(root, () => write('src/skills/s4/SKILL.md', '---\nname: s4\nedited: true\n---\n'));
        const t = measureTouchedSkills(root, 'no-such-ref');
        expect(t.measured).toBe(false);
        expect(t.uncovered).toEqual(['s4']);
        expect(main(['--base', 'no-such-ref', '--quiet'], root)).toBe(1);
    });

    it('localPaths reads dirty, staged and untracked without any base at all', () => {
        fixture();
        gitInit(root, () => undefined);
        write('src/skills/s2/SKILL.md', '---\nname: s2\nedited: true\n---\n');
        write('src/skills/brand-new/SKILL.md', '---\nname: brand-new\n---\n');
        const paths = localPaths(root);
        expect(paths).toContain('src/skills/s2/SKILL.md');
        expect(paths).toContain('src/skills/brand-new/SKILL.md');
    });
});

describe('check_routing_coverage — the verdict never claims an unmeasured scope', () => {
    it('a clean run with an undiffable base exits 0 and says the branch arm did NOT run', () => {
        const log: string[] = [];
        const write_ = process.stdout.write.bind(process.stdout);
        process.stdout.write = ((c: string) => {
            log.push(String(c));
            return true;
        }) as typeof process.stdout.write;
        try {
            fixture({ rules: 0.5, skills: 0.25 });
            gitInit(root, () => undefined);
            write('src/skills/s1/evals/triggers.json', '{}');
            expect(main(['--base', 'no-such-ref'], root)).toBe(0);
        } finally {
            process.stdout.write = write_;
        }
        const out = log.join('');
        expect(out).toContain('did NOT run');
        expect(out).not.toContain('every touched skill carries a corpus');
    });
});
