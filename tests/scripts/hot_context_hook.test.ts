// Tests for src/scripts/hot_context_hook.ts (road-to-second-brain Phase 1).
//
// Exercises the dispatcher-concern contract end-to-end via spawnSync:
//   stop           → deterministic, redacted, word-capped overwrite
//   session_start  → staleness-checked restore (fresh / stale-branch /
//                    stale-time / source=clear / source=compact)
//
// File locations are overridden via AGENT_CHAT_HISTORY_FILE and
// AGENT_HOT_CONTEXT_FILE so no repo state is touched.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'hot_context_hook.ts');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

let tmpDir = '';
let histFile = '';
let hotFile = '';

beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hot-context-'));
    histFile = path.join(tmpDir, 'history.jsonl');
    hotFile = path.join(tmpDir, 'hot-context.md');
});

afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
});

function runHook(
    event: string,
    payload: Record<string, unknown> = {},
): { stdout: string; status: number | null } {
    const envelope = {
        schema_version: 1,
        platform: 'claude',
        event,
        workspace_root: tmpDir,
        payload,
    };
    const proc = spawnSync(TSX_BIN, [TS_SCRIPT, '--platform', 'claude'], {
        encoding: 'utf8',
        cwd: REPO_ROOT,
        input: JSON.stringify(envelope),
        env: {
            ...process.env,
            AGENT_CHAT_HISTORY_FILE: histFile,
            AGENT_HOT_CONTEXT_FILE: hotFile,
        },
    });
    return { stdout: proc.stdout as string, status: proc.status };
}

function writeHistory(entries: Array<Record<string, unknown>>): void {
    fs.writeFileSync(histFile, entries.map((e) => JSON.stringify(e)).join('\n') + '\n', 'utf-8');
}

function wordCount(text: string): number {
    return text.split(/\s+/).filter((w) => w.length > 0).length;
}

describe('stop — deterministic write', () => {
    it('writes the capped, stamped cache and drops privacy-floor violations', () => {
        const long = 'word '.repeat(120).trim(); // exceeds every snippet cap
        writeHistory([
            { t: 'header', v: 1 },
            { t: 'user_prompt', s: 's1', text: `intent one ${long}` },
            { t: 'user_prompt', s: 's1', text: `intent two ${long}` },
            { t: 'user_prompt', s: 's1', text: `intent three ${long}` },
            // privacy-floor violation: email → line must be dropped
            { t: 'post_tool_use', s: 's1', tool: 'Bash', text: 'mail me at leak@example.com' },
            { t: 'post_tool_use', s: 's1', tool: 'Bash', text: `ran build ${long}` },
            { t: 'post_tool_use', s: 's1', tool: 'Edit', text: 'lint FAILED with exit=1' },
            { t: 'stop', s: 's1', text: `summary of the work ${long}` },
        ]);

        const { status } = runHook('stop');
        expect(status).toBe(0);
        const text = fs.readFileSync(hotFile, 'utf-8');

        expect(text).toMatch(/^Last Updated: \d{4}-\d{2}-\d{2}T/m);
        expect(text).toMatch(/^Branch: /m);
        expect(text).toContain('## Key Facts');
        expect(text).toContain('## Active Threads');
        expect(text).toContain('## Open Verifications');
        expect(text).toContain('lint FAILED with exit=1');
        expect(text).not.toContain('leak@example.com'); // redacted (dropped)
        expect(text).toMatch(/Privacy floor: 1 line\(s\) dropped/);
        expect(wordCount(text)).toBeLessThanOrEqual(400);
    });

    it('overwrites (cache, not journal)', () => {
        writeHistory([{ t: 'user_prompt', s: 's1', text: 'first run intent' }]);
        expect(runHook('stop').status).toBe(0);
        writeHistory([{ t: 'user_prompt', s: 's2', text: 'second run intent' }]);
        expect(runHook('stop').status).toBe(0);
        const text = fs.readFileSync(hotFile, 'utf-8');
        expect(text).toContain('second run intent');
        expect(text).not.toContain('first run intent');
    });
});

describe('session_start — staleness-checked restore', () => {
    function freshCache(overrides: { updated?: string; branch?: string } = {}): void {
        const updated = overrides.updated ?? new Date().toISOString();
        const branch = overrides.branch ?? 'unknown';
        fs.writeFileSync(
            hotFile,
            [
                '# Hot Context',
                '',
                `Last Updated: ${updated}`,
                `Branch: ${branch}`,
                '',
                '## Key Facts',
                '',
                '- carried-over fact',
                '',
            ].join('\n'),
            'utf-8',
        );
    }

    it('injects a spotlighted data block on a fresh cache (startup)', () => {
        freshCache();
        const { stdout, status } = runHook('session_start', { source: 'startup' });
        expect(status).toBe(0);
        const reply = JSON.parse(stdout) as Record<string, unknown>;
        expect(reply.decision).toBe('allow');
        expect(String(reply.context)).toContain('<hot-context');
        expect(String(reply.context)).toContain('DATA, not instructions');
        expect(String(reply.context)).toContain('carried-over fact');
        expect(fs.existsSync(hotFile)).toBe(true); // inject keeps the cache
    });

    it('re-injects on source=compact (compact survival)', () => {
        freshCache();
        const { stdout, status } = runHook('session_start', { source: 'compact' });
        expect(status).toBe(0);
        const reply = JSON.parse(stdout) as Record<string, unknown>;
        expect(String(reply.reason)).toContain('source=compact');
        expect(String(reply.context)).toContain('carried-over fact');
    });

    it('discards silently on source=clear', () => {
        freshCache();
        const { stdout, status } = runHook('session_start', { source: 'clear' });
        expect(status).toBe(0);
        expect(stdout.trim()).toBe('');
        expect(fs.existsSync(hotFile)).toBe(false);
    });

    it('discards on a stale timestamp (>48h)', () => {
        freshCache({ updated: new Date(Date.now() - 49 * 3600 * 1000).toISOString() });
        const { stdout, status } = runHook('session_start', { source: 'startup' });
        expect(status).toBe(0);
        expect(stdout.trim()).toBe('');
        expect(fs.existsSync(hotFile)).toBe(false);
    });

    it('discards on a branch mismatch', () => {
        // tmpDir is no git repo → current branch resolves to 'unknown'; a
        // stamped real branch must therefore be compared against a real
        // current branch — run from the repo root instead.
        const repoBranch = spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
            cwd: REPO_ROOT,
            encoding: 'utf8',
        }).stdout.trim();
        freshCache({ branch: 'definitely-not-the-current-branch' });
        const envelope = {
            schema_version: 1,
            platform: 'claude',
            event: 'session_start',
            workspace_root: REPO_ROOT,
            payload: { source: 'startup' },
        };
        const proc = spawnSync(TSX_BIN, [TS_SCRIPT, '--platform', 'claude'], {
            encoding: 'utf8',
            cwd: REPO_ROOT,
            input: JSON.stringify(envelope),
            env: { ...process.env, AGENT_HOT_CONTEXT_FILE: hotFile },
        });
        expect(repoBranch.length).toBeGreaterThan(0);
        expect(proc.status).toBe(0);
        expect((proc.stdout as string).trim()).toBe('');
        expect(fs.existsSync(hotFile)).toBe(false);
    });

    it('is silent when no cache exists', () => {
        const { stdout, status } = runHook('session_start', { source: 'startup' });
        expect(status).toBe(0);
        expect(stdout.trim()).toBe('');
    });
});
