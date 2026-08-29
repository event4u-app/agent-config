// Two REAL processes, two worktrees of one repository, one database
// (road-to-runtime-event-journal 1.3 / AC-3).
//
// The database lives under the common git directory, so both worktrees resolve
// to the SAME file and genuinely contend for it. That is what makes this test
// able to fail: were the store worktree-local (`agents/runtime/state/`), the
// two writers would land in two different files and "both records present"
// would be true by construction, forever.
//
// SENSITIVITY. This test has been observed RED with the mechanism neutralised —
// `PRAGMA journal_mode = WAL` changed to `DELETE` and `PRAGMA busy_timeout`
// changed to `0` in `_lib/runtime_journal.ts::createSchema`. The observation is
// recorded in `agents/evidence/analysis/runtime-journal-capture-2026-08-28.md`.

import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
    isJournalAvailable,
    openJournal,
    readAllEvents,
    resolveJournal,
} from '../../src/scripts/_lib/runtime_journal.js';

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const TSX = path.join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
const WRITER = path.join(REPO_ROOT, 'tests', 'scripts', '_runtime_journal_writer.ts');

/** Events each process writes. High enough that the write windows really overlap. */
const PER_PROCESS = 120;

const sqliteOk = isJournalAvailable();
const tsxOk = fs.existsSync(TSX);

let tmp: string;
let mainCheckout: string;
let linkedWorktree: string;

function git(cwd: string, ...args: string[]): void {
    execFileSync('git', args, { cwd, stdio: 'pipe' });
}

beforeAll(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rt-journal-conc-'));
    mainCheckout = path.join(tmp, 'main');
    linkedWorktree = path.join(tmp, 'wt');
    fs.mkdirSync(mainCheckout, { recursive: true });
    git(mainCheckout, 'init', '--initial-branch=main');
    git(mainCheckout, 'config', 'user.email', 'test@example.com');
    git(mainCheckout, 'config', 'user.name', 'Journal Test');
    fs.writeFileSync(path.join(mainCheckout, 'README.md'), 'fixture\n', 'utf8');
    git(mainCheckout, 'add', 'README.md');
    git(mainCheckout, 'commit', '-m', 'fixture');
    git(mainCheckout, 'worktree', 'add', '-b', 'side', linkedWorktree);
});

afterAll(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

/** Run one writer process; resolves with its exit code and stderr. */
function runWriter(
    root: string,
    sessionId: string,
    startAt: number,
): Promise<{ code: number | null; stderr: string }> {
    return new Promise((resolve) => {
        const child = spawn(
            TSX,
            [WRITER, root, sessionId, 'task-concurrent', 'dispatch_hook', String(PER_PROCESS), String(startAt)],
            { cwd: REPO_ROOT, stdio: ['ignore', 'pipe', 'pipe'] },
        );
        let stderr = '';
        child.stderr.on('data', (d: Buffer) => {
            stderr += d.toString();
        });
        child.stdout.on('data', () => {
            /* drain */
        });
        child.on('close', (code) => resolve({ code, stderr }));
    });
}

describe.runIf(sqliteOk && tsxOk)('two concurrent writers, two worktrees, one database (1.3, AC-3)', () => {
    it('both worktrees resolve to the same database file — the contention is real', () => {
        const a = resolveJournal(mainCheckout);
        const b = resolveJournal(linkedWorktree);
        expect(a.scope).toBe('repo-shared');
        expect(b.scope).toBe('repo-shared');
        // File-path separation is what decides whether they share a database.
        expect(b.path).toBe(a.path);
    });

    it('every record from both processes lands, and no seq is duplicated', async () => {
        // Both processes cross the barrier at the same instant.
        const startAt = Date.now() + 1500;
        const [a, b] = await Promise.all([
            runWriter(mainCheckout, 'sess-main', startAt),
            runWriter(linkedWorktree, 'sess-linked', startAt),
        ]);

        expect(a.stderr, `main-checkout writer failed: ${a.stderr}`).toBe('');
        expect(b.stderr, `linked-worktree writer failed: ${b.stderr}`).toBe('');
        expect(a.code).toBe(0);
        expect(b.code).toBe(0);

        const h = openJournal(mainCheckout);
        try {
            const events = readAllEvents(h);
            expect(events).toHaveLength(PER_PROCESS * 2);
            expect(events.filter((e) => e.session_id === 'sess-main')).toHaveLength(PER_PROCESS);
            expect(events.filter((e) => e.session_id === 'sess-linked')).toHaveLength(PER_PROCESS);
            // No corruption: seq is a unique key across both writers.
            expect(new Set(events.map((e) => e.seq)).size).toBe(PER_PROCESS * 2);
            // Interleaving actually happened — otherwise the test would pass on
            // a serialised run and prove nothing about contention.
            const order = events.map((e) => e.session_id);
            const switches = order.filter((s, i) => i > 0 && s !== order[i - 1]).length;
            expect(switches).toBeGreaterThan(0);
        } finally {
            h.close();
        }
    }, 60_000);
});
