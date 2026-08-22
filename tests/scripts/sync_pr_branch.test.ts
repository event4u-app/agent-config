/**
 * Keep the branch current with its PR base before a push.
 *
 * Anchored to PR #1391: the base moved three times during one run, the push was
 * rejected twice for it, and the PR reached `CONFLICTING` before anyone noticed.
 * `check_branch_freshness` detected each one and refused — what did not exist was
 * the half that does something about it.
 *
 * The conflict SPLIT is the load-bearing unit under test. A generated conflict
 * has exactly one correct resolution (regenerate) and an authored one has none a
 * script may choose, so collapsing them into "conflicts: 2" throws away the only
 * information that tells a reader what to do next.
 */

import { describe, expect, it } from 'vitest';

import { classifyConflicts, isGenerated, isRemeasured, main, renderConflictReport, resolveBase } from '../../src/scripts/sync_pr_branch.js';

describe('generated vs authored', () => {
    it('recognises the generated artefacts a merge routinely conflicts on', () => {
        // Every one of these actually conflicted on this branch.
        expect(isGenerated('agents/roadmaps-progress.md')).toBe(true);
        expect(isGenerated('dist/agent-src/skills/x/SKILL.md')).toBe(true);
        expect(isGenerated('.augment/rules/x.md')).toBe(true);
        expect(isGenerated('agents/index.md')).toBe(true);
    });

    it('classifies the compiled hook manifest as generated, not authored', () => {
        // Regression for road-to-session-closeout 8.5. `hook_manifest.json` is
        // compiled from `hook_manifest.yaml`; mixing hunks yields a concern
        // table matching neither branch. The YAML source stays AUTHORED — that
        // is the file a human actually edits, and the asymmetry is the point.
        expect(isGenerated('src/scripts/hook_manifest.json')).toBe(true);
        expect(isGenerated('src/scripts/hook_manifest.yaml')).toBe(false);
    });

    it('classifies the two paths a grep-based audit of the list could not find', () => {
        // Both found by measurement over the last 50 sessions, not by reading
        // the generator: `docs/decisions/INDEX.md` in 4 distinct sessions, and
        // `dist/router.json` in 1.
        //
        // `regenerate_index.ts` takes the decisions directory as an argument, so
        // the path literal is in no generator and every grep missed it.
        expect(isGenerated('docs/decisions/INDEX.md')).toBe(true);
        // `dist/router.json` sits one level ABOVE the `dist/agent-src/` prefix,
        // so the prefix check did not reach it.
        expect(isGenerated('dist/router.json')).toBe(true);
        // The ADRs themselves are authored — only their index is generated, and
        // conflating the two would discard a human's decision record.
        expect(isGenerated('docs/decisions/ADR-239-no-union-merge.md')).toBe(false);
        // And the router entry must not widen into a `dist/` catch-all: `dist/`
        // also carries `dist/install/`, which is shipped and hand-reviewed.
        expect(isGenerated('dist/router.json.bak')).toBe(false);
    });

    it('does NOT claim an authored file is generated', () => {
        // gate-coverage.yml conflicted on this branch and is hand-authored — a
        // regenerate-resolution there would have discarded the other side.
        expect(isGenerated('src/config/gate-coverage.yml')).toBe(false);
        expect(isGenerated('src/scripts/lint_evidence_artifacts.ts')).toBe(false);
        expect(isGenerated('agents/roadmaps/road-to-x.md')).toBe(false);
        // A prefix that only LOOKS like the generated root must not match.
        expect(isGenerated('dist/agent-src-notes.md')).toBe(false);
        expect(isGenerated('agents/roadmaps-progress.md.bak')).toBe(false);
    });

    it('classifies the archive-index PAIR as generated, not authored', () => {
        // road-to-merge-hotspot-drawdown 1.1. Both files are written by ONE
        // `build_archive_index.ts` call (`:409-410`) from the archived roadmap
        // tree, so neither is ever hand-authored -- yet both classified AUTHORED
        // until 2026-08-21 and conflict in 2 of the 7 open PRs measured there.
        expect(isGenerated('agents/roadmaps/archive/INDEX.md')).toBe(true);
        expect(isGenerated('agents/roadmaps/archive/index.json')).toBe(true);
        // The pair is generated; the archived roadmaps they index are authored.
        expect(isGenerated('agents/roadmaps/archive/road-to-x.md')).toBe(false);
        // A prefix that only LOOKS like the pair must not match.
        expect(isGenerated('agents/roadmaps/archive/INDEX.md.bak')).toBe(false);
    });

    it('classifies the two ratchet baselines as REMEASURED, not generated and not authored', () => {
        // road-to-merge-hotspot-drawdown 1.2. Both conflict in 7 of 7 open PRs.
        // A baseline records what a tree MEASURED, so there is no side to take
        // (authored) and no file to re-render (generated) -- the resolution is
        // to re-run the measurement on the merged tree.
        for (const rel of ['src/config/estate-count-budget.json', 'src/config/gate-violation-baselines.json']) {
            expect(isRemeasured(rel)).toBe(true);
            // The three buckets are mutually exclusive: a baseline that also read
            // as generated would be handed a `git checkout --ours` instruction,
            // which is exactly the pick-a-side that loosens a ratchet.
            expect(isGenerated(rel)).toBe(false);
        }
    });

    it('does NOT claim a neighbouring config file is a measured baseline', () => {
        // The gate that READS the baselines is authored; only the baselines
        // themselves are re-measured. A broader match here would tell the reader
        // to re-measure a hand-written script.
        expect(isRemeasured('src/config/gate-coverage.yml')).toBe(false);
        expect(isRemeasured('src/scripts/_lib/gate_baseline.ts')).toBe(false);
        expect(isRemeasured('src/config/estate-count-budget.json.bak')).toBe(false);
        expect(isRemeasured('agents/roadmaps-progress.md')).toBe(false);
    });

    it('a three-way conflict set lands one path in each bucket', () => {
        const out = classifyConflicts([
            'agents/roadmaps/archive/index.json',
            'src/config/gate-violation-baselines.json',
            'agents/roadmaps/stubs/README.md',
        ]);
        expect(out.generated).toEqual(['agents/roadmaps/archive/index.json']);
        expect(out.remeasured).toEqual(['src/config/gate-violation-baselines.json']);
        expect(out.authored).toEqual(['agents/roadmaps/stubs/README.md']);
    });

    it('every one of the six measured conflicting paths is classified — AC-1', () => {
        // The population is the six paths that actually conflict, measured with
        // `git merge-tree` across all 7 CONFLICTING open PRs on 2026-08-21. A
        // path in none of the three buckets is a path this tool is silent about.
        const measured: ReadonlyArray<readonly [string, 'generated' | 'remeasured' | 'authored']> = [
            ['agents/roadmaps-progress.md', 'generated'],
            ['agents/roadmaps/archive/INDEX.md', 'generated'],
            ['agents/roadmaps/archive/index.json', 'generated'],
            ['src/config/estate-count-budget.json', 'remeasured'],
            ['src/config/gate-violation-baselines.json', 'remeasured'],
            ['agents/roadmaps/stubs/README.md', 'authored'],
        ];
        for (const [rel, bucket] of measured) {
            const out = classifyConflicts([rel]);
            expect(out[bucket], `${rel} should classify as ${bucket}`).toEqual([rel]);
            const others = (['generated', 'remeasured', 'authored'] as const).filter((b) => b !== bucket);
            for (const o of others) expect(out[o], `${rel} must not be ${o}`).toEqual([]);
        }
    });

    it('splits a mixed conflict set and drops blank lines', () => {
        const out = classifyConflicts([
            'agents/roadmaps-progress.md',
            '',
            'src/config/gate-coverage.yml',
            '  dist/agent-src/x.md  ',
        ]);
        expect(out.generated).toEqual(['agents/roadmaps-progress.md', 'dist/agent-src/x.md']);
        expect(out.authored).toEqual(['src/config/gate-coverage.yml']);
        expect(out.remeasured).toEqual([]);
    });

    it('an empty list is empty on both sides, not a silent pass', () => {
        expect(classifyConflicts([])).toEqual({ generated: [], remeasured: [], authored: [] });
        expect(classifyConflicts(['', '   '])).toEqual({ generated: [], remeasured: [], authored: [] });
    });
});

describe('the conflict report names a per-class resolution', () => {
    // The generated example is `hook_manifest.json` and not the archive index
    // on purpose: since 2026-08-22 the archive index and the dashboard are
    // generated AND untracked, so they carry a different instruction and would
    // make this fixture test two classes at once.
    const plan = {
        exit: 1 as const,
        message: 'merge of origin/main hit 3 conflict(s).',
        generated: ['src/scripts/hook_manifest.json'],
        remeasured: ['src/config/gate-violation-baselines.json'],
        authored: ['agents/roadmaps/stubs/README.md'],
        scanned: 1,
    };

    it('tells a remeasured conflict to re-run the measurement, not to read both sides', () => {
        // road-to-merge-hotspot-drawdown 1.2 promised this assertion and the
        // first version of that step shipped without it. Consequence, measured:
        // the entire report block could be deleted and all 16 tests stayed green
        // while the header still counted the conflict and named no path.
        const out = renderConflictReport(plan);
        const section = out.slice(out.indexOf('REMEASURED'), out.indexOf('AUTHORED'));
        expect(section).toContain('RE-RUN THE MEASUREMENT');
        expect(section).toContain('src/config/gate-violation-baselines.json');
        // The two resolutions it must NOT be handed. `read both sides` is the
        // authored advice; `checkout --ours` is the generated one, and picking a
        // side on a ratchet number is how the ratchet silently loosens.
        expect(section).not.toContain('read both sides');
        expect(section).not.toContain('checkout --ours');
    });

    it('keeps the three classes and their instructions separate', () => {
        const out = renderConflictReport(plan);
        expect(out).toContain('GENERATED (1)');
        expect(out).toContain('REMEASURED (1)');
        expect(out).toContain('AUTHORED (1)');
        // Every conflicted path is NAMED. A count with no path is the shape the
        // deleted-block failure produced.
        for (const f of [...plan.generated, ...plan.remeasured, ...plan.authored]) {
            expect(out).toContain(f);
        }
        // Order is generated -> remeasured -> authored, so the mechanical
        // resolutions come before the one that needs a human.
        expect(out.indexOf('GENERATED')).toBeLessThan(out.indexOf('REMEASURED'));
        expect(out.indexOf('REMEASURED')).toBeLessThan(out.indexOf('AUTHORED'));
    });

    it('sends an untracked-by-design conflict to the deletion, never to --ours', () => {
        // The regression this exists to stop, in one assertion: a branch created
        // before the 2026-08-22 cutover hits `modify/delete` on these paths, and
        // the generic generated advice (`git checkout --ours`) has no side to
        // check out — following it re-adds the file, which is how PR #1505 put
        // the dashboard back on `main` a day after it was first untracked.
        const out = renderConflictReport({
            ...plan,
            generated: ['agents/roadmaps-progress.md', 'agents/roadmaps/archive/INDEX.md'],
        });
        const section = out.slice(out.indexOf('UNTRACKED BY DESIGN'), out.indexOf('REMEASURED'));
        expect(section).toContain('TAKE THE DELETION');
        expect(section).toContain('git rm --cached');
        expect(section).toContain('agents/roadmaps-progress.md');
        expect(section).toContain('agents/roadmaps/archive/INDEX.md');
        expect(section).not.toContain('checkout --ours');
        // …and the class it was split out of is not also emitted for them.
        expect(out).not.toContain('GENERATED (');
    });

    it('emits no class section when that class is empty', () => {
        const only = renderConflictReport({ ...plan, generated: [], remeasured: [] });
        expect(only).not.toContain('GENERATED');
        expect(only).not.toContain('REMEASURED');
        expect(only).toContain('AUTHORED (1)');
    });
});

describe('base resolution', () => {
    it('an explicit --base wins over any probe', () => {
        const r = resolveBase(process.cwd(), 'origin/release/9.9.9');
        expect(r.base).toBe('origin/release/9.9.9');
        expect(r.how).toMatch(/--base/);
    });

    it('a blank --base is not an override', () => {
        // Otherwise `--base ""` would pin the base to the empty string and every
        // rev-list against it would read as "already current".
        const r = resolveBase(process.cwd(), '   ');
        expect(r.base).not.toBe('   ');
    });

    it('names HOW the base was resolved, so a wrong base is visible', () => {
        const r = resolveBase(process.cwd(), null);
        expect(r.how.length).toBeGreaterThan(0);
    });
});

describe('CLI', () => {
    it('refuses a value-taking flag with no value', () => {
        expect(main(['--repo'])).toBe(1);
        expect(main(['--base'])).toBe(1);
        expect(main(['--base', '--dry-run'])).toBe(1);
    });

    it('rejects an unknown argument', () => {
        expect(main(['--nope'])).toBe(1);
    });

    it('--help exits 0', () => {
        expect(main(['--help'])).toBe(0);
    });
});
