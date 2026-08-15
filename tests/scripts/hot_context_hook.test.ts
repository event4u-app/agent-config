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

describe('pre_compact — capture before the state is destroyed', () => {
    // road-to-inbox-harvest-2026-08-d-context-ledger Step 2.1. The slot fires
    // WHILE state is being destroyed; before this it carried no writer, so the
    // cache a post-compaction restore reads was written at the last `stop`.
    it('writes the cache on pre_compact, exactly as stop does', () => {
        writeHistory([
            { t: 'header', v: 1 },
            { t: 'user_prompt', s: 's1', text: 'the intent that must survive compaction' },
            { t: 'stop', s: 's1', text: 'summary of the work so far' },
        ]);

        expect(runHook('pre_compact').status).toBe(0);
        const text = fs.readFileSync(hotFile, 'utf-8');
        expect(text).toContain('the intent that must survive compaction');
        expect(text).toMatch(/^Last Updated: \d{4}-\d{2}-\d{2}T/m);
    });

    it('captures work done AFTER the last stop — the whole point of the slot', () => {
        // A stop writes the cache; the session then continues and compacts.
        // Without a pre_compact writer the post-stop work is lost with the
        // compaction, which is exactly the defect this step closes.
        writeHistory([{ t: 'user_prompt', s: 's1', text: 'work before the stop' }]);
        expect(runHook('stop').status).toBe(0);
        expect(fs.readFileSync(hotFile, 'utf-8')).not.toContain('work after the stop');

        writeHistory([
            { t: 'user_prompt', s: 's1', text: 'work before the stop' },
            { t: 'user_prompt', s: 's1', text: 'work after the stop' },
        ]);
        expect(runHook('pre_compact').status).toBe(0);
        expect(fs.readFileSync(hotFile, 'utf-8')).toContain('work after the stop');
    });

    it('emits nothing on this slot — it is a writer, not an injector', () => {
        writeHistory([{ t: 'user_prompt', s: 's1', text: 'some intent' }]);
        const { status, stdout } = runHook('pre_compact');
        expect(status).toBe(0);
        expect(stdout.trim()).toBe('');
    });

    it('is idempotent — a second fire cannot degrade the cache', () => {
        writeHistory([{ t: 'user_prompt', s: 's1', text: 'stable intent' }]);
        expect(runHook('pre_compact').status).toBe(0);
        const first = fs.readFileSync(hotFile, 'utf-8').replace(/^Last Updated: .*$/m, '');
        expect(runHook('pre_compact').status).toBe(0);
        const second = fs.readFileSync(hotFile, 'utf-8').replace(/^Last Updated: .*$/m, '');
        expect(second).toBe(first);
    });
});

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

// Phase 0-pre lifecycle chain (memory/knowledge validation, council
// 2026-07-08): write → survive → inject over the HOOK-written cache — the
// blocks above exercise write and restore in isolation against hand-written
// caches; this proves the composed contract, plus survival across an intake
// fold (fold_intake must never touch runtime state).
describe('lifecycle — write → survive → inject', () => {
    it('a stop-written cache round-trips into the compact re-injection', () => {
        writeHistory([
            { t: 'user_prompt', s: 's1', text: 'wire the retrieval index mode' },
            { t: 'post_tool_use', s: 's1', tool: 'Edit', text: 'tests still FAILED with exit=1' },
            { t: 'stop', s: 's1', text: 'paused mid-implementation' },
        ]);

        // Session end: hook writes the cache deterministically.
        expect(runHook('stop').status).toBe(0);
        const written = fs.readFileSync(hotFile, 'utf-8');
        expect(wordCount(written)).toBeLessThanOrEqual(400);

        // Fresh session after compaction: the SAME hook-written content is
        // re-injected, spotlighted as data, and the cache survives.
        const { stdout, status } = runHook('session_start', { source: 'compact' });
        expect(status).toBe(0);
        const reply = JSON.parse(stdout) as Record<string, unknown>;
        expect(reply.decision).toBe('allow');
        const block = String(reply.context);
        expect(block).toContain('DATA, not instructions');
        expect(block).toContain('wire the retrieval index mode');
        expect(block).toContain('tests still FAILED with exit=1');
        expect(fs.existsSync(hotFile)).toBe(true);
        expect(fs.readFileSync(hotFile, 'utf-8')).toBe(written); // inject is read-only
    });

    it('survives an intake fold — fold_intake never touches runtime state', () => {
        // Project tree: a live hot-context + a foldable knowledge intake.
        const project = fs.mkdtempSync(path.join(os.tmpdir(), 'hot-fold-'));
        try {
            const runtimeHot = path.join(project, 'agents', 'runtime', 'state', 'hot-context.md');
            fs.mkdirSync(path.dirname(runtimeHot), { recursive: true });
            const cache = '# Hot Context\n\nLast Updated: now\nBranch: b\n\n- working on auth\n';
            fs.writeFileSync(runtimeHot, cache, 'utf-8');

            const intakeDir = path.join(project, 'agents', 'knowledge', 'intake');
            fs.mkdirSync(intakeDir, { recursive: true });
            const events = Array.from({ length: 4 }, (_, i) =>
                JSON.stringify({ ts: '2026-07-08T00:00:00Z', type: 'observation', observation: `evt ${i}` }),
            );
            fs.writeFileSync(path.join(intakeDir, 'events-2026-07.jsonl'), events.join('\n') + '\n', 'utf-8');

            const fold = spawnSync(
                TSX_BIN,
                [path.join(REPO_ROOT, 'src', 'scripts', 'fold_intake.ts'), '--batch-size', '4', '--format', 'json'],
                { cwd: project, encoding: 'utf8' },
            );
            expect(fold.status).toBe(0);
            expect(JSON.parse(fold.stdout as string).folds).toHaveLength(1); // fold really ran
            expect(fs.readFileSync(runtimeHot, 'utf-8')).toBe(cache); // runtime state untouched
        } finally {
            fs.rmSync(project, { recursive: true, force: true });
        }
    });
});
