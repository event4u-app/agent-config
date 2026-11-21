/**
 * The CI replay cannot run inside pre-push: `git push` holds the connection to
 * GitHub open while the hook runs, and GitHub closed it after a 5-minute green
 * replay (exit 141, twice, on PR #2949). The hook therefore only checks that a
 * green replay of the pushed commit is on record, and names the command when
 * it is not.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const INSTALLER = path.resolve(__dirname, '../../src/scripts/install-hooks.sh');
const ZERO = '0'.repeat(40);
let hook: string;

function extractPrePush(installer: string): string {
    const lines = fs.readFileSync(installer, 'utf8').split('\n');
    const start = lines.findIndex((l) => l.startsWith('cat > "$HOOKS_DIR/pre-push"'));
    const end = lines.findIndex((l, i) => i > start && l.trimEnd() === 'EOF');
    return `${lines.slice(start + 1, end).join('\n')}\n`;
}

function repo(): { dir: string; sha: string } {
    const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'prepush-stamp-')));
    const git = (...a: string[]) => execFileSync('git', a, { cwd: dir, encoding: 'utf8' }).trim();
    git('init', '-q');
    git('-c', 'user.email=t@example.com', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', 'x');
    // Every other gate in the hook goes through ./scripts-run; a passing stub
    // isolates the stamp check.
    fs.writeFileSync(path.join(dir, 'scripts-run'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
    return { dir, sha: git('rev-parse', 'HEAD') };
}

function run(dir: string, sha: string, extraEnv: Record<string, string> = {}): string {
    try {
        return execFileSync('bash', [hook], {
            cwd: dir,
            input: `refs/heads/topic ${sha} refs/heads/topic ${ZERO}\n`,
            encoding: 'utf8',
            env: { PATH: '/usr/bin:/bin', HOME: dir, ...extraEnv },
        });
    } catch (e) {
        const err = e as { stdout?: string; stderr?: string };
        return `${err.stdout ?? ''}${err.stderr ?? ''}`;
    }
}

beforeAll(() => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prepush-'));
    hook = path.join(dir, 'pre-push');
    fs.writeFileSync(hook, extractPrePush(INSTALLER), { mode: 0o755 });
});

describe('pre-push — a green CI-mirror replay must be on record', () => {
    it('blocks a commit with no stamp, names the command, and does not replay in the hook', () => {
        const { dir, sha } = repo();
        const out = run(dir, sha);
        expect(out).toContain(`No green CI-mirror replay on record for: ${sha.slice(0, 10)}`);
        expect(out).toContain('./scripts-run src/scripts/ci_mirror');
        expect(out).toContain('Push blocked');
    });

    it('lets a stamped commit through without running anything long', () => {
        const { dir, sha } = repo();
        fs.mkdirSync(path.join(dir, '.git/ci-mirror'), { recursive: true });
        fs.writeFileSync(path.join(dir, '.git/ci-mirror', `${sha}.json`), '{}');
        const t0 = Date.now();
        const out = run(dir, sha);
        expect(out).toContain('green replay on record');
        expect(out).not.toContain('Push blocked');
        expect(Date.now() - t0).toBeLessThan(10_000);
    });

    it('a stamp for another commit does not count', () => {
        const { dir, sha } = repo();
        fs.mkdirSync(path.join(dir, '.git/ci-mirror'), { recursive: true });
        fs.writeFileSync(path.join(dir, '.git/ci-mirror', `${'f'.repeat(40)}.json`), '{}');
        expect(run(dir, sha)).toContain('No green CI-mirror replay on record');
    });
});

// The mirror reports a refused ratification record as `owner-decision`: CI will
// show that step red. Pushing it anyway is the known-red push the owner asked to
// stop on 2026-11-21 ("wir wissen doch schon lokal was ist").
describe('pre-push — a known-red stamp stays local until the owner has decided', () => {
    const ownerStamp = (dir: string, sha: string): void => {
        fs.mkdirSync(path.join(dir, '.git/ci-mirror'), { recursive: true });
        const stamp = {
            head: sha,
            not_verified: [{ job: 'Sync', step: 'Kernel / governance-hook edits carry a ratification artifact', verdict: 'owner-decision', detail: null }],
        };
        fs.writeFileSync(path.join(dir, '.git/ci-mirror', `${sha}.json`), JSON.stringify(stamp, null, 2));
    };

    it('refuses a commit whose stamp carries an owner decision, and says what to do instead', () => {
        const { dir, sha } = repo();
        ownerStamp(dir, sha);
        const out = run(dir, sha);
        expect(out).toContain(`CI will be red for: ${sha.slice(0, 10)}`);
        expect(out).toContain('ask the owner');
        expect(out).toContain('Push blocked');
    });

    it('lets it through, loudly, once the owner has decided', () => {
        const { dir, sha } = repo();
        ownerStamp(dir, sha);
        const out = run(dir, sha, { AGENT_CONFIG_PUSH_OWNER_DECIDED: '1' });
        expect(out).toContain('AGENT_CONFIG_PUSH_OWNER_DECIDED=1');
        expect(out).not.toContain('Push blocked');
    });

    it('a stamp whose unverified steps are only not-reproducible still passes', () => {
        const { dir, sha } = repo();
        fs.mkdirSync(path.join(dir, '.git/ci-mirror'), { recursive: true });
        const stamp = { head: sha, not_verified: [{ job: 'Tests', step: 'macOS shard', verdict: 'not-reproducible', detail: null }] };
        fs.writeFileSync(path.join(dir, '.git/ci-mirror', `${sha}.json`), JSON.stringify(stamp, null, 2));
        const out = run(dir, sha);
        expect(out).toContain('green replay on record');
        expect(out).not.toContain('Push blocked');
    });
});
