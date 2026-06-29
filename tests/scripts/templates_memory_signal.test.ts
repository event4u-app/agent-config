// Intent tests for src/agent-src/templates/scripts/memory_signal.ts —
// write-side helper (ADR-200, consumer-template memory).
//
// Was a python3-vs-tsx byte-parity rig; the `.py` twin is gone, so this asserts
// the tsx CLI's own contract directly. The generated `id` (crypto.randomBytes)
// and `ts` (wall clock) are non-deterministic, so the emit-success stdout is
// snapshotted with `id` masked, and the written JSONL record is asserted via
// its key set + its non-id/ts values (which ARE deterministic). Error paths are
// snapshotted directly. The script always writes the JSONL trail (no backend
// skip path), so no backend stub is needed; a node-only PATH keeps the launcher
// resolvable and COLUMNS=200 pins usage-line wrapping out of the picture (the
// usage block is a hard-coded 80-col constant in the script either way).

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');
const _TSX_ENV = process.env['TSX_BIN'];
const TSX_BIN = _TSX_ENV
    ? (isAbsolute(_TSX_ENV) ? _TSX_ENV : resolve(REPO_ROOT, _TSX_ENV))
    : join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
const SCRIPTS_DIR = join(REPO_ROOT, 'src', 'agent-src', 'templates', 'scripts');
const TS_SCRIPT = join(SCRIPTS_DIR, 'memory_signal.ts');

// node-only PATH → deterministic launcher resolution (nothing else resolves).
const NODE_ONLY_DIR = mkdtempSync(join(tmpdir(), 'tpl-memsig-nodeonly-'));
symlinkSync(process.execPath, join(NODE_ONLY_DIR, 'node'));
afterAll(() => {
    // temp dir is left for the OS to reap; nothing sensitive.
});

interface RunResult {
    status: number | null;
    stdout: string;
    stderr: string;
}

function runTs(cwd: string, args: string[]): RunResult {
    const r = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], {
        cwd,
        encoding: 'utf8',
        env: { HOME: process.env['HOME'] ?? '', PATH: NODE_ONLY_DIR, COLUMNS: '200', AGENT_MEMORY_STATUS: '' },
    });
    return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

// id=sig-<hex> in stdout is non-deterministic; mask it for the snapshot.
function normId(s: string): string {
    return s.replace(/id=sig-[0-9a-f]+/g, 'id=sig-XXX');
}

function writtenRecord(dir: string): Record<string, unknown> {
    const root = join(dir, 'agents', 'memory', 'intake');
    const f = readdirSync(root).find((n) => n.endsWith('.jsonl')) as string;
    return JSON.parse(readFileSync(join(root, f), 'utf-8').trim()) as Record<string, unknown>;
}

describe('templates/memory_signal — emit', () => {
    it('emit stdout shape (id masked)', () => {
        const dir = mkdtempSync(join(tmpdir(), 'tpl-memsig-emit-'));
        try {
            const r = runTs(dir, ['--type', 'historical-patterns', '--path', 'app/Foo.php', '--body', 'null deref']);
            expect({ status: r.status, stderr: r.stderr, stdout: normId(r.stdout) }).toMatchInlineSnapshot(`
              {
                "status": 0,
                "stderr": "",
                "stdout": "  ✅  signal emitted: id=sig-XXX type=historical-patterns path=app/Foo.php
              ",
              }
            `);
            // Written record: deterministic key set + non-volatile values.
            const rec = writtenRecord(dir);
            expect(Object.keys(rec).sort()).toMatchInlineSnapshot(`
              [
                "body",
                "entry_type",
                "id",
                "origin",
                "path",
                "ts",
              ]
            `);
            delete rec['id'];
            delete rec['ts'];
            expect(rec).toMatchInlineSnapshot(`
              {
                "body": "null deref",
                "entry_type": "historical-patterns",
                "origin": "agent",
                "path": "app/Foo.php",
              }
            `);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    it('emit with --extra preserves extra keys (id masked)', () => {
        const dir = mkdtempSync(join(tmpdir(), 'tpl-memsig-extra-'));
        try {
            const r = runTs(dir, [
                '--type',
                'ownership',
                '--path',
                'app/Bill',
                '--body',
                'team-x',
                '--extra',
                '{"symptom":"flaky","owner":"team-x"}',
            ]);
            expect({ status: r.status, stdout: normId(r.stdout) }).toMatchInlineSnapshot(`
              {
                "status": 0,
                "stdout": "  ✅  signal emitted: id=sig-XXX type=ownership path=app/Bill
              ",
              }
            `);
            const rec = writtenRecord(dir);
            expect(Object.keys(rec).sort()).toMatchInlineSnapshot(`
              [
                "body",
                "entry_type",
                "id",
                "origin",
                "owner",
                "path",
                "symptom",
                "ts",
              ]
            `);
            delete rec['id'];
            delete rec['ts'];
            expect(rec).toMatchInlineSnapshot(`
              {
                "body": "team-x",
                "entry_type": "ownership",
                "origin": "agent",
                "owner": "team-x",
                "path": "app/Bill",
                "symptom": "flaky",
              }
            `);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });
});

describe('templates/memory_signal — error paths', () => {
    it('invalid --type choice → exit 2', () => {
        const dir = mkdtempSync(join(tmpdir(), 'tpl-memsig-err-'));
        try {
            expect(runTs(dir, ['--type', 'bogus', '--path', 'x', '--body', 'y'])).toMatchInlineSnapshot(`
              {
                "status": 2,
                "stderr": "usage: memory_signal.py [-h] --type
                                      {domain-invariants,historical-patterns,incident-learnings,ownership,product-rules}
                                      --path PATH --body BODY [--origin ORIGIN]
                                      [--extra EXTRA] [--force]
              memory_signal.py: error: argument --type: invalid choice: 'bogus' (choose from 'domain-invariants', 'historical-patterns', 'incident-learnings', 'ownership', 'product-rules')
              ",
                "stdout": "",
              }
            `);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });
    it('missing required args → exit 2', () => {
        const dir = mkdtempSync(join(tmpdir(), 'tpl-memsig-err-'));
        try {
            expect(runTs(dir, ['--path', 'x'])).toMatchInlineSnapshot(`
              {
                "status": 2,
                "stderr": "usage: memory_signal.py [-h] --type
                                      {domain-invariants,historical-patterns,incident-learnings,ownership,product-rules}
                                      --path PATH --body BODY [--origin ORIGIN]
                                      [--extra EXTRA] [--force]
              memory_signal.py: error: the following arguments are required: --type, --body
              ",
                "stdout": "",
              }
            `);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });
    it('unrecognized argument → exit 2', () => {
        const dir = mkdtempSync(join(tmpdir(), 'tpl-memsig-err-'));
        try {
            expect(runTs(dir, ['--type', 'ownership', '--path', 'x', '--body', 'y', '--bogus']))
                .toMatchInlineSnapshot(`
              {
                "status": 2,
                "stderr": "usage: memory_signal.py [-h] --type
                                      {domain-invariants,historical-patterns,incident-learnings,ownership,product-rules}
                                      --path PATH --body BODY [--origin ORIGIN]
                                      [--extra EXTRA] [--force]
              memory_signal.py: error: unrecognized arguments: --bogus
              ",
                "stdout": "",
              }
            `);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });
    it('--extra not a JSON object → exit 2', () => {
        const dir = mkdtempSync(join(tmpdir(), 'tpl-memsig-err-'));
        try {
            expect(runTs(dir, ['--type', 'ownership', '--path', 'x', '--body', 'y', '--extra', '[1,2]']))
                .toMatchInlineSnapshot(`
              {
                "status": 2,
                "stderr": "error: --extra must be a JSON object
              ",
                "stdout": "",
              }
            `);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });
    it('no args → required-args error, exit 2', () => {
        const dir = mkdtempSync(join(tmpdir(), 'tpl-memsig-err-'));
        try {
            expect(runTs(dir, [])).toMatchInlineSnapshot(`
              {
                "status": 2,
                "stderr": "usage: memory_signal.py [-h] --type
                                      {domain-invariants,historical-patterns,incident-learnings,ownership,product-rules}
                                      --path PATH --body BODY [--origin ORIGIN]
                                      [--extra EXTRA] [--force]
              memory_signal.py: error: the following arguments are required: --type, --path, --body
              ",
                "stdout": "",
              }
            `);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });
});
