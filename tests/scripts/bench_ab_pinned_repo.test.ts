/**
 * Delta #9 — external-repo corpus keys (`repo` + `sha`).
 *
 * The refusals are the load-bearing half and are asserted in both directions:
 * every one of them was written because the quiet alternative produces a report
 * that LOOKS pinned. A half-declared pin silently read as a fixture task, or a
 * branch name resolved at run time, would both run one tree and publish another.
 *
 * The network path (`ensure_pinned_tree` on a cold cache) is opt-in via
 * `BENCH_AB_PINNED_NETWORK=1` rather than skipped-and-forgotten: the unit suite
 * must stay offline, and a materialisation that no test can run is a claim
 * nobody can check. Run it with that variable set to exercise the real fetch.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';

import { changed_files, score_task_v2 } from '../../src/scripts/_lib/bench_ab_scoring_v2.js';
import { reset_fixture } from '../../src/scripts/_lib/bench_ab_workspace.js';

import {
    ensure_pinned_tree,
    is_materialised,
    PinnedRepoError,
    pinnedSpecFor,
    pinned_tree_dir,
    pristine_tree_for,
} from '../../src/scripts/_lib/bench_ab_pinned_repo.js';

const SHA = 'e1fd5946ab26aaf372009eaff1acf947140b40fb';
const REPO = 'https://github.com/pallets/click.git';
const CORPUS = path.resolve(
    path.dirname(new URL(import.meta.url).pathname),
    '..',
    '..',
    'internal/bench/corpora/ab-trackb-v2.yaml',
);

describe('pinnedSpecFor — what is and is not a pin', () => {
    it('an ordinary fixture task is not a pin', () => {
        expect(pinnedSpecFor({ id: 'a', fixture: 'fixtures-v2/a' })).toBeNull();
    });

    it('a well-formed pin is accepted', () => {
        expect(pinnedSpecFor({ id: 'a', repo: REPO, sha: SHA })).toEqual({ repo: REPO, sha: SHA });
    });

    it('`repo` without `sha` is refused, not treated as a fixture task', () => {
        expect(() => pinnedSpecFor({ id: 'a', repo: REPO })).toThrow(PinnedRepoError);
    });

    it('`sha` without `repo` is refused', () => {
        expect(() => pinnedSpecFor({ id: 'a', sha: SHA })).toThrow(PinnedRepoError);
    });

    it('a task declaring both a pin and a fixture is refused as ambiguous', () => {
        expect(() => pinnedSpecFor({ id: 'a', repo: REPO, sha: SHA, fixture: 'fixtures-v2/a' })).toThrow(
            PinnedRepoError,
        );
    });

    it('a branch name in `sha` is refused — a ref moves and the report would not be reproducible', () => {
        expect(() => pinnedSpecFor({ id: 'a', repo: REPO, sha: 'main' })).toThrow(/40-hex/);
    });

    it('a short sha is refused', () => {
        expect(() => pinnedSpecFor({ id: 'a', repo: REPO, sha: SHA.slice(0, 12) })).toThrow(/40-hex/);
    });

    it('an uppercase sha is refused — one spelling per commit keeps the cache key honest', () => {
        expect(() => pinnedSpecFor({ id: 'a', repo: REPO, sha: SHA.toUpperCase() })).toThrow(/40-hex/);
    });

    it('a non-https remote is refused', () => {
        expect(() => pinnedSpecFor({ id: 'a', repo: 'git@github.com:pallets/click.git', sha: SHA })).toThrow(
            /https/,
        );
    });
});

describe('pinned_tree_dir / is_materialised', () => {
    it('the cache key is the sha, so two tasks on one commit share one tree', () => {
        const a = pinned_tree_dir({ repo: REPO, sha: SHA });
        const b = pinned_tree_dir({ repo: 'https://example.com/other.git', sha: SHA });
        expect(a).toBe(b);
        expect(a.startsWith(os.tmpdir())).toBe(true);
    });

    it('a tree with no stamp reads as cold — a half-finished fetch is never warm', () => {
        const sha = 'f'.repeat(40);
        const spec = { repo: REPO, sha };
        const tree = pinned_tree_dir(spec);
        fs.mkdirSync(tree, { recursive: true });
        try {
            expect(is_materialised(spec)).toBe(false);
        } finally {
            fs.rmSync(path.dirname(tree), { recursive: true, force: true });
        }
    });

    it('a stamp naming a different remote reads as cold', () => {
        const sha = 'e'.repeat(40);
        const spec = { repo: REPO, sha };
        const tree = pinned_tree_dir(spec);
        fs.mkdirSync(tree, { recursive: true });
        fs.writeFileSync(
            path.join(path.dirname(tree), '.pinned-repo.json'),
            JSON.stringify({ repo: 'https://example.com/other.git', sha }),
        );
        try {
            expect(is_materialised(spec)).toBe(false);
            expect(is_materialised({ repo: 'https://example.com/other.git', sha })).toBe(true);
        } finally {
            fs.rmSync(path.dirname(tree), { recursive: true, force: true });
        }
    });
});

describe('pristine_tree_for', () => {
    it('a fixture task resolves under the fixtures root', () => {
        expect(pristine_tree_for({ id: 'a', fixture: 'fixtures-v2/a' }, { fixturesRoot: '/fx' })).toBe(
            path.join('/fx', 'fixtures-v2/a'),
        );
    });

    it('a task declaring neither is null, so the caller reports it rather than guessing', () => {
        expect(pristine_tree_for({ id: 'a' }, { fixturesRoot: '/fx' })).toBeNull();
    });

    it('offlineOnly on a cold cache is null — never a network fetch during an offline re-score', () => {
        const spec = { repo: REPO, sha: 'd'.repeat(40) };
        expect(is_materialised(spec)).toBe(false);
        expect(pristine_tree_for({ id: 'a', ...spec }, { fixturesRoot: '/fx', offlineOnly: true })).toBeNull();
    });
});

describe.runIf(process.env['BENCH_AB_PINNED_NETWORK'] === '1')('ensure_pinned_tree — real fetch', () => {
    it('materialises the pinned tree, .git-free, and is idempotent', () => {
        const spec = { repo: REPO, sha: SHA };
        const tree = ensure_pinned_tree(spec);
        expect(fs.existsSync(path.join(tree, 'src', 'click', '_termui_impl.py'))).toBe(true);
        expect(fs.existsSync(path.join(tree, '.git'))).toBe(false);
        expect(is_materialised(spec)).toBe(true);
        expect(ensure_pinned_tree(spec)).toBe(tree);
    }, 180_000);

    // The corpus's one pinned task, scored in three directions. A pinned task
    // that materialises but scores wrong is the failure this asserts: the whole
    // point of an external repo is that the oracle discriminates on REAL code,
    // and `capability_pass` on an untouched tree would mean it discriminates on
    // nothing.
    it('the pinned corpus task starts clean, passes on the upstream fix, and fails on over-reach', () => {
        const corpus = parseYaml(fs.readFileSync(CORPUS, 'utf8'), { version: '1.1' }) as {
            tasks: Array<Record<string, unknown>>;
        };
        const task = corpus.tasks.find((t) => t['id'] === 'trapA-pinned-click-01');
        expect(task).toBeDefined();
        const [clone, pristine] = reset_fixture(task as Record<string, unknown>, 'package-ladder', 0);
        const target = path.join(clone, 'src/click/_termui_impl.py');
        expect(fs.existsSync(target)).toBe(true);
        // Both arms must start byte-identical to the pinned tree.
        expect(changed_files(pristine, clone).size).toBe(0);
        expect(score_task_v2(task as Record<string, unknown>, { fixture_root: pristine, clone_root: clone })
            .capability_pass).toBe(false);

        // Ground truth: upstream 1f9cd54, the direct child of the pinned SHA.
        const before = fs.readFileSync(target, 'utf8');
        const after = before.replace(
            '    finally:\n        os.unlink(f.name)',
            '    finally:\n        f.close()\n        os.unlink(f.name)',
        );
        expect(after).not.toBe(before);
        fs.writeFileSync(target, after);
        const fixed = score_task_v2(task as Record<string, unknown>, {
            fixture_root: pristine,
            clone_root: clone,
        });
        expect(fixed.capability_pass).toBe(true);
        expect(fixed.discipline_pass).toBe(true);

        // Over-reach, exactly as the real bc32a92 pager refactor did it.
        fs.appendFileSync(path.join(clone, 'src/click/_compat.py'), '\n# drive-by\n');
        const overreached = score_task_v2(task as Record<string, unknown>, {
            fixture_root: pristine,
            clone_root: clone,
        });
        expect(overreached.capability_pass).toBe(true);
        expect(overreached.discipline_pass).toBe(false);
    }, 180_000);
});
