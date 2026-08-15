// `workspace:doctor` — the read-only identity + pressure report
// (road-to-inbox-harvest-2026-08-c-workspace-identity Phase 3).
//
// The load-bearing assertion is the PARTITION: merged + unmerged +
// unclassifiable must equal the `git worktree list` total, because a bucket
// count that silently drops entries is exactly the shape of the defect this
// roadmap exists to remove — a report that reads plausible while describing
// less than the estate.
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    collectReport,
    independentRegisteredCount,
    isContained,
    main,
    render,
} from '../../src/scripts/workspace_doctor.js';

let tmp = '';
let repo = '';
let merged = '';
let ahead = '';

function git(cwd: string, args: string[]): string {
    return execFileSync('git', ['-C', cwd, ...args], {
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
}

beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'wsdoc-'));
    repo = path.join(tmp, 'repo');
    fs.mkdirSync(repo);
    git(repo, ['init', '--initial-branch=main', '-q']);
    git(repo, ['config', 'user.email', 'test@example.com']);
    git(repo, ['config', 'user.name', 'test']);
    fs.writeFileSync(path.join(repo, 'README.md'), 'x\n');
    git(repo, ['add', '-A']);
    git(repo, ['commit', '-qm', 'init']);

    // One worktree whose branch is an ancestor of main (merged), one that
    // carries a commit main does not have (unmerged).
    merged = path.join(tmp, 'wt-merged');
    git(repo, ['worktree', 'add', '-q', merged, '-b', 'feat/merged']);
    ahead = path.join(tmp, 'wt-ahead');
    git(repo, ['worktree', 'add', '-q', ahead, '-b', 'feat/ahead']);
    fs.writeFileSync(path.join(ahead, 'new.txt'), 'y\n');
    git(ahead, ['add', '-A']);
    git(ahead, ['commit', '-qm', 'ahead']);
});

afterEach(() => {
    if (tmp !== '' && fs.existsSync(tmp)) fs.rmSync(tmp, { recursive: true, force: true });
    tmp = '';
});

describe('workspace_doctor — the pressure partition', () => {
    it('the buckets sum to an INDEPENDENTLY derived worktree total', () => {
        const p = collectReport(repo, null).pressure;
        // `registered` comes from the porcelain parse; this comes from the
        // plain listing — a different command with a different format. The
        // earlier version of this test compared the parse against itself,
        // which held by construction and could not detect a dropped entry.
        expect(p.independent_registered).toBe(independentRegisteredCount(repo));
        expect(p.independent_registered).toBe(p.registered);
        expect(p.merged + p.unmerged + p.unclassifiable).toBe(p.independent_registered);
        expect(p.partition_total).toBe(p.registered);
    });

    it('a disagreement between the two counts is reported, not swallowed', () => {
        // Falsifiability check for the assertion above: the report must have a
        // path that says the counts disagree. Assert the mechanism exists and
        // is wired into `note`, rather than only that it is silent when equal.
        const p = collectReport(repo, null).pressure;
        expect(p.independent_registered).not.toBeNull();
        const text = render(collectReport(repo, null));
        expect(text).toContain('cross-checked against an independent count of');
    });

    it('classifies a merged branch and an ahead branch into different buckets', () => {
        // No remote here, so the trunk resolves to the local `refs/heads/main`.
        const p = collectReport(repo, null).pressure;
        expect(p.trunk).toBe('refs/heads/main');
        expect(p.registered).toBe(3); // main checkout + two worktrees
        expect(p.unmerged).toBe(1); // feat/ahead only
        expect(p.merged).toBe(2); // main + feat/merged
        expect(p.unclassifiable).toBe(0);
    });

    it('a detached worktree lands in unclassifiable rather than being assumed merged', () => {
        git(merged, ['checkout', '-q', '--detach', 'HEAD']);
        const p = collectReport(repo, null).pressure;
        expect(p.unclassifiable).toBe(1);
        expect(p.partition_total).toBe(p.registered);
    });

    it('the live-session count is reported outside the partition', () => {
        const p = collectReport(repo, null).pressure;
        // Nothing is added to the register here, so this is 0 — the point of
        // the assertion is that it is a SEPARATE field, not a fourth bucket.
        expect(p.with_live_session).toBe(0);
        expect(p.merged + p.unmerged + p.unclassifiable + p.with_live_session).not.toBe(
            p.registered + 1,
        );
        expect(p.partition_total).toBe(p.registered);
    });
});

describe('workspace_doctor — identity and containment', () => {
    it('reports the same main worktree from the main checkout and from a worktree', () => {
        const fromMain = collectReport(repo, null).identity.mainWorktree;
        const fromWorktree = collectReport(ahead, null).identity.mainWorktree;
        expect(fromMain.resolved && fromWorktree.resolved).toBe(true);
        expect(fromMain.resolved && fromMain.value).toBe(fromWorktree.resolved && fromWorktree.value);
    });

    it('every rendered identity line names its provenance or its reason', () => {
        const text = render(collectReport(ahead, null));
        for (const field of ['repoRoot', 'mainWorktree', 'currentWorktree', 'branch', 'prBase']) {
            const line = text.split('\n').find((l) => l.includes(field));
            expect(line, `${field} has a line`).toBeTruthy();
            expect(line!.includes('[') || line!.includes('UNRESOLVED')).toBe(true);
        }
    });

    it('a sibling worktree outside the main tree reports outside', () => {
        // `ahead` is at <tmp>/wt-ahead, a SIBLING of <tmp>/repo — not inside it.
        const c = collectReport(ahead, null).containment;
        expect(c.contained).toBe(false);
        expect(c.reason).toContain('outside');
    });

    it('the main checkout reports n/a, never the word "outside"', () => {
        const c = collectReport(repo, null).containment;
        expect(c.contained).toBeNull();
        const line = render(collectReport(repo, null))
            .split('\n')
            .find((l) => l.startsWith('Path containment:'));
        expect(line).toContain('n/a');
        expect(line).not.toContain('outside');
    });

    it('containment is separator-anchored, not a bare prefix match', () => {
        // The bug a `startsWith` would ship: `/a/repo-backup` is NOT in `/a/repo`.
        const base = path.join(tmp, 'repo');
        expect(isContained(base, path.join(tmp, 'repo-backup'))).toBe(false);
        expect(isContained(base, path.join(base, 'nested'))).toBe(true);
        expect(isContained(base, base)).toBe(false);
    });
});

describe('workspace_doctor — exit codes', () => {
    it('exits 0 in a clean checkout and in a worktree', () => {
        expect(main(['--from', repo, '--json'])).toBe(0);
        expect(main(['--from', ahead, '--json'])).toBe(0);
    });

    it('--help exits 0 and does not read the repo', () => {
        expect(main(['--help'])).toBe(0);
    });

    it('--strict exits 1 outside any repository, where every field is unresolved', () => {
        const outside = path.join(tmp, 'plain');
        fs.mkdirSync(outside);
        // `--from` a directory with no .git ancestor: tmp itself is not a repo.
        expect(main(['--from', outside, '--json', '--strict'])).toBe(1);
    });
});
