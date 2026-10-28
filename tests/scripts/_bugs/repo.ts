/**
 * A throwaway git repository for the Stage H bug tests. Synthetic content only.
 * Not a test file — no `.test` in the name.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

export class Repo {
    readonly dir: string;
    private day = 1;

    constructor() {
        this.dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bugs-repo-')));
        this.run('init', '-q', '-b', 'main');
    }

    run(...args: string[]): string {
        const date = `2026-09-${String(this.day).padStart(2, '0')}T12:00:00Z`;
        return execFileSync('git', ['-c', 'user.name=dev', '-c', 'user.email=dev@example.com', '-c', 'commit.gpgsign=false', ...args], {
            cwd: this.dir,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe'],
            env: { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date },
        });
    }

    git = (args: readonly string[]): string => this.run(...args);

    write(rel: string, body: string): void {
        const p = path.join(this.dir, rel);
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(p, body);
    }

    /** Commit everything, one day after the previous commit; returns the full sha. */
    commit(message: string): string {
        this.run('add', '-A');
        this.run('commit', '-q', '--allow-empty', '-m', message);
        this.day++;
        return this.run('rev-parse', 'HEAD').trim();
    }

    cleanup(): void {
        fs.rmSync(this.dir, { recursive: true, force: true });
    }
}
