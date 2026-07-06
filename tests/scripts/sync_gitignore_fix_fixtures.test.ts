// Fixture-repo tests for the /sync-gitignore:fix detection passes
// (road-to-agents-dir-and-gitignore-hygiene Phase 5.5).
//
// Three consumer shapes, each a REAL git repo built in a tmpdir:
//   1. consumer with a committed runtime file (tracked-but-ignored after
//      the managed block lands) → check_tracked_but_ignored reports it
//      with the exact `git rm --cached` fix; clean after untracking.
//   2. consumer with pre-Phase-5 legacy .gitignore entries →
//      sync_gitignore --cleanup-legacy scrubs + resyncs; the second run
//      is a byte-identical no-op (idempotency).
//   3. clean consumer → block lands once; every check green; second
//      run reports "already in sync".
import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { main as tbiMain } from '../../src/scripts/check_tracked_but_ignored.js';
import { DEFAULT_TEMPLATE, main as syncMain } from '../../src/scripts/sync_gitignore.js';
import { runInProc } from '../_lib/run_in_process.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
void REPO_ROOT;

function git(cwd: string, args: string): string {
    return execSync(`git ${args}`, { cwd, encoding: 'utf-8' });
}

/** git init + identity so commits work on bare CI runners. */
function initRepo(root: string): void {
    git(root, 'init -q -b main');
    git(root, 'config user.email fixture@test.local');
    git(root, 'config user.name fixture');
    git(root, 'config commit.gpgsign false');
}

function write(root: string, rel: string, content: string): void {
    const p = path.join(root, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content, 'utf-8');
}

function readGitignore(root: string): string {
    return fs.readFileSync(path.join(root, '.gitignore'), 'utf-8');
}

function runSync(root: string, extra: string[] = []): { status: number; stdout: string; stderr: string } {
    return runInProc(
        syncMain,
        ['--path', path.join(root, '.gitignore'), '--template', DEFAULT_TEMPLATE, ...extra],
        { cwd: root },
    );
}

function runTbi(root: string): { status: number; stdout: string; stderr: string } {
    return runInProc(tbiMain, [], { cwd: root });
}

describe('sync-gitignore fix flow — fixture repos', () => {
    let tmp: string;
    beforeEach(() => {
        // realpath: on macOS os.tmpdir() is a /var → /private/var symlink and
        // git prints physical paths — normalize so string asserts match.
        tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'sgfix-')));
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    // -- Scenario 1: consumer with a committed runtime file ------------------

    it('committed runtime file → detected as tracked-but-ignored with the exact fix command', () => {
        initRepo(tmp);
        write(tmp, 'agents/runtime/.agent-chat-history', 'log\n');
        write(tmp, 'README.md', 'consumer\n');
        git(tmp, 'add -A');
        git(tmp, 'commit -qm seed');

        // Managed block lands AFTER the file was committed — the exact drift class.
        expect(runSync(tmp).status).toBe(0);
        git(tmp, 'add .gitignore');
        git(tmp, 'commit -qm "chore: agent-config gitignore block"');

        const r = runTbi(tmp);
        expect(r.status).toBe(1);
        expect(r.stdout).toContain('agents/runtime/.agent-chat-history');
        expect(r.stdout).toContain('git rm --cached');
        // Never executes the fix itself — file must still be tracked.
        expect(git(tmp, 'ls-files agents/runtime/')).toContain('.agent-chat-history');
    });

    it('after running the printed git rm --cached, detection is clean and the file stays on disk', () => {
        initRepo(tmp);
        write(tmp, 'agents/runtime/.agent-chat-history', 'log\n');
        git(tmp, 'add -A');
        git(tmp, 'commit -qm seed');
        expect(runSync(tmp).status).toBe(0);

        git(tmp, 'rm -q --cached agents/runtime/.agent-chat-history');
        git(tmp, 'add .gitignore');
        git(tmp, 'commit -qm untrack');

        const r = runTbi(tmp);
        expect(r.status).toBe(0);
        expect(r.stdout).toContain('No tracked-but-ignored');
        expect(fs.existsSync(path.join(tmp, 'agents/runtime/.agent-chat-history'))).toBe(true);
    });

    it('outside a git repo → exit 2', () => {
        // tmp is a plain dir (no init). Guard: must not sit inside a parent repo.
        const r = runTbi(tmp);
        expect([0, 2]).toContain(r.status); // 2 expected; 0 tolerated if tmpdir nests in a repo
        if (r.status === 2) {
            expect(r.stdout).toContain('git ls-files failed');
        }
    });

    // -- Scenario 2: consumer with pre-Phase-5 legacy entries ----------------

    it('legacy entries are scrubbed, block synced, second run is a byte-identical no-op', () => {
        initRepo(tmp);
        write(
            tmp,
            '.gitignore',
            ['# my project', 'node_modules/', '.agent-chat-history', '.agent-prices.md', 'agents/.agent-prices.md', ''].join('\n'),
        );
        git(tmp, 'add -A');
        git(tmp, 'commit -qm seed');

        const first = runSync(tmp, ['--cleanup-legacy']);
        expect(first.status).toBe(0);
        const afterFirst = readGitignore(tmp);
        // Legacy root-level lines are gone…
        expect(afterFirst.split('\n')).not.toContain('.agent-prices.md');
        expect(afterFirst.split('\n')).not.toContain('agents/.agent-prices.md');
        // …user lines survive, managed block landed with the current canon.
        expect(afterFirst).toContain('node_modules/');
        expect(afterFirst).toContain('# event4u/agent-config');
        expect(afterFirst).toContain('/agents/runtime/');
        expect(afterFirst).toContain('/agents/tmp/');
        expect(afterFirst).toContain('/agents/tmp.old/');

        const second = runSync(tmp, ['--cleanup-legacy']);
        expect(second.status).toBe(0);
        expect(readGitignore(tmp)).toBe(afterFirst); // idempotent
        expect(second.stdout).toContain('already in sync');
    });

    // -- Scenario 3: clean consumer ------------------------------------------

    it('clean consumer: block lands once, all checks green, second run already in sync', () => {
        initRepo(tmp);
        write(tmp, 'README.md', 'clean consumer\n');
        git(tmp, 'add -A');
        git(tmp, 'commit -qm seed');

        const first = runSync(tmp);
        expect(first.status).toBe(0);
        const afterFirst = readGitignore(tmp);
        expect(afterFirst).toContain('# event4u/agent-config');
        expect(afterFirst).toContain('/agents/tmp/');

        expect(runTbi(tmp).status).toBe(0);

        const second = runSync(tmp);
        expect(second.status).toBe(0);
        expect(second.stdout).toContain('already in sync');
        expect(readGitignore(tmp)).toBe(afterFirst);
    });
});
