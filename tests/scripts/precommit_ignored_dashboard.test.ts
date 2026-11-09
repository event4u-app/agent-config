/**
 * The roadmap dashboard is gitignored in this repository and CI refuses a
 * committed copy. Three surfaces used to tell the agent to stage it after
 * every regeneration, so every merge of main re-committed it and CI went red
 * (PR #2949). The pre-commit hook now refuses a staged ignored dashboard
 * before anything else runs.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const INSTALLER = path.resolve(__dirname, '../../src/scripts/install-hooks.sh');
const BLOCKED = 'agents/roadmaps-progress.md is staged, but this repository';
let hook: string;

function extractPreCommit(installer: string): string {
    const lines = fs.readFileSync(installer, 'utf8').split('\n');
    const start = lines.findIndex((l) => l.startsWith('cat > "$HOOKS_DIR/pre-commit"'));
    if (start === -1) throw new Error('pre-commit heredoc not found');
    const end = lines.findIndex((l, i) => i > start && l.trimEnd() === 'EOF');
    return `${lines.slice(start + 1, end).join('\n')}\n`;
}

function repo(ignored: boolean): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'precommit-dash-'));
    const git = (...a: string[]) => execFileSync('git', a, { cwd: dir, stdio: 'pipe' });
    git('init', '-q');
    git('config', 'user.email', 't@example.com');
    git('config', 'user.name', 't');
    fs.mkdirSync(path.join(dir, 'agents'));
    if (ignored) fs.writeFileSync(path.join(dir, '.gitignore'), '/agents/roadmaps-progress.md\n');
    fs.writeFileSync(path.join(dir, 'agents/roadmaps-progress.md'), '# dashboard\n');
    git('add', '-f', 'agents/roadmaps-progress.md');
    return dir;
}

function run(cwd: string): string {
    try {
        return execFileSync('bash', [hook], { cwd, encoding: 'utf8', env: { PATH: '/usr/bin:/bin', HOME: cwd } });
    } catch (e) {
        const err = e as { stdout?: string; stderr?: string };
        return `${err.stdout ?? ''}${err.stderr ?? ''}`;
    }
}

beforeAll(() => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'precommit-'));
    hook = path.join(dir, 'pre-commit');
    fs.writeFileSync(hook, extractPreCommit(INSTALLER), { mode: 0o755 });
});

describe('pre-commit — a gitignored dashboard never enters a commit', () => {
    it('refuses a staged dashboard the repository ignores, and names the fix', () => {
        const out = run(repo(true));
        expect(out).toContain(BLOCKED);
        expect(out).toContain('git rm --cached agents/roadmaps-progress.md');
    });

    it('lets a repository that tracks its dashboard commit it', () => {
        expect(run(repo(false))).not.toContain(BLOCKED);
    });
});
