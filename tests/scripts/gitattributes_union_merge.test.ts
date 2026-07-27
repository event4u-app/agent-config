/**
 * Two-writer append merge test for the `merge=union` .gitattributes rule
 * (road-to-reachable-code-memory Phase 5): two branches each append a
 * DIFFERENT new line to the same intake JSONL file from a common base.
 *
 * Green case: with the `merge=union` attribute, git's built-in union driver
 * concats both sides instead of conflict-marking — the merge succeeds and
 * BOTH appended lines survive.
 *
 * Red control: WITHOUT the attribute, git's default 3-way text merge treats
 * both branches' end-of-file insertion as touching the same region and
 * conflicts — proving the green result is the attribute's doing, not an
 * artefact of the scenario (git does NOT auto-merge two different
 * appends-at-EOF from a common base by default).
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const big = (cwd: string) => ({ maxBuffer: 64 * 1024 * 1024, cwd, encoding: 'utf8' as const });

function git(cwd: string, args: string[]): ReturnType<typeof spawnSync> {
    return spawnSync('git', args, big(cwd));
}

const INTAKE_REL = path.join('agents', 'memory', 'intake', 'test.jsonl');

function initRepo(work: string, withUnionAttr: boolean): void {
    fs.mkdirSync(path.join(work, 'agents', 'memory', 'intake'), { recursive: true });
    expect(git(work, ['init', '-q']).status).toBe(0);
    // CI-safe identity — throwaway fixture repo, never real project history.
    git(work, ['config', 'user.email', 't@t']);
    git(work, ['config', 'user.name', 't']);
    if (withUnionAttr) {
        fs.writeFileSync(
            path.join(work, '.gitattributes'),
            'agents/memory/intake/*.jsonl merge=union eol=lf\n',
            'utf-8',
        );
    }
    fs.writeFileSync(path.join(work, INTAKE_REL), '{"id":"base-1","text":"base entry"}\n', 'utf-8');
    git(work, ['add', '-A']);
    const c = git(work, ['commit', '-qm', 'base']);
    expect(c.status, `base commit failed: ${c.stderr as string}`).toBe(0);
}

function currentBranch(work: string): string {
    const r = git(work, ['symbolic-ref', '--short', 'HEAD']);
    return (r.stdout as string).trim();
}

/** Create branch-a and branch-b, each appending a DIFFERENT line from base. */
function forkTwoWriters(work: string): void {
    const base = currentBranch(work);

    git(work, ['checkout', '-qb', 'branch-a']);
    fs.appendFileSync(path.join(work, INTAKE_REL), '{"id":"a-1","text":"from branch a"}\n');
    expect(git(work, ['commit', '-aqm', 'branch-a append']).status).toBe(0);

    git(work, ['checkout', '-q', base]);
    git(work, ['checkout', '-qb', 'branch-b']);
    fs.appendFileSync(path.join(work, INTAKE_REL), '{"id":"b-1","text":"from branch b"}\n');
    expect(git(work, ['commit', '-aqm', 'branch-b append']).status).toBe(0);

    git(work, ['checkout', '-q', 'branch-a']);
}

let work: string | undefined;

afterEach(() => {
    if (work) {
        fs.rmSync(work, { recursive: true, force: true });
        work = undefined;
    }
});

describe('gitattributes union merge — intake JSONL two-writer append', () => {
    it('merge=union: two branches appending different lines merge cleanly, both survive', () => {
        work = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'gau-union-')));
        initRepo(work, true);
        forkTwoWriters(work);

        const merge = git(work, ['merge', '--no-edit', 'branch-b']);
        expect(
            merge.status,
            `expected a clean union merge, got:\nstdout: ${merge.stdout as string}\nstderr: ${merge.stderr as string}`,
        ).toBe(0);

        const merged = fs.readFileSync(path.join(work, INTAKE_REL), 'utf-8');
        expect(merged).toContain('"id":"base-1"');
        expect(merged).toContain('"id":"a-1"');
        expect(merged).toContain('"id":"b-1"');
    });

    it('red control — WITHOUT merge=union, the same two-writer append conflicts', () => {
        work = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'gau-noattr-')));
        initRepo(work, false);
        forkTwoWriters(work);

        const merge = git(work, ['merge', '--no-edit', 'branch-b']);
        expect(merge.status, 'expected the default 3-way merge to conflict').not.toBe(0);

        const status = git(work, ['status', '--short']);
        expect(status.stdout as string).toContain('UU ');

        // Leave no MERGE_HEAD lying around (cosmetic — dir is deleted in afterEach
        // regardless, but this keeps `git status` sane if a run is inspected).
        git(work, ['merge', '--abort']);
    });
});
