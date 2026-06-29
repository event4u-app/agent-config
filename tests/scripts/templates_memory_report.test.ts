// Intent tests for src/agent-src/templates/scripts/memory_report.ts —
// observability report (ADR-200, consumer-template memory).
//
// Was a python3-vs-tsx byte-parity rig; the `.py` twin is gone, so this asserts
// the tsx CLI's own contract directly against tmp `agents/memory` fixtures, for
// the text and `--format json` paths plus the argparse error paths.
//
// Determinism: the backend is a hard-coded `file` constant; the fixture dates
// (2000-01-01 = always overdue, 2999-01-01 = never overdue) keep the overdue
// COUNT, staleness-rate and quarter buckets date-independent. The only value
// that drifts with wall-clock is the overdue DAY count (`+Nd` in text,
// `overdue_days` in json) — masked via `norm()` before snapshotting. The
// role-mode scan dirs (`agents/sessions`, …) don't exist in the tmp tree, so
// `files_scanned` is a stable 0. Every case spawns with a node-only PATH (a
// temp dir holding just a `node` symlink) so the tsx launcher resolves but no
// `memory`-family CLI does, and COLUMNS=200 forces single-line usage so
// arg-error stderr does not re-wrap to terminal width.

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');
const _TSX_ENV = process.env['TSX_BIN'];
const TSX_BIN = _TSX_ENV
    ? (isAbsolute(_TSX_ENV) ? _TSX_ENV : resolve(REPO_ROOT, _TSX_ENV))
    : join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
const SCRIPTS_DIR = join(REPO_ROOT, 'src', 'agent-src', 'templates', 'scripts');
const TS_SCRIPT = join(SCRIPTS_DIR, 'memory_report.ts');

// node-only PATH → deterministic absent backend (nothing but `node` resolves).
const NODE_ONLY_DIR = mkdtempSync(join(tmpdir(), 'tpl-memrep-nodeonly-'));
symlinkSync(process.execPath, join(NODE_ONLY_DIR, 'node'));
afterAll(() => {
    // temp dir is left for the OS to reap; nothing sensitive.
});

interface RunResult {
    status: number | null;
    stdout: string;
    stderr: string;
}

let goldenTmp: string;
beforeEach(() => {
    goldenTmp = mkdtempSync(join(tmpdir(), 'tpl-memrep-gold-'));
});
afterEach(() => {
    rmSync(goldenTmp, { recursive: true, force: true });
});

function runTs(args: string[]): RunResult {
    const r = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], {
        cwd: goldenTmp,
        encoding: 'utf8',
        env: { HOME: process.env['HOME'] ?? '', PATH: NODE_ONLY_DIR, COLUMNS: '200', AGENT_MEMORY_STATUS: '' },
    });
    return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

// The overdue DAY count drifts with wall clock; mask it (the COUNT, rate and
// buckets are date-independent and stay asserted).
function normOverdue(s: string): string {
    return s.replace(/\+\d+d/g, '+Nd').replace(/"overdue_days": \d+/g, '"overdue_days": N');
}

function seedMemoryTree(): void {
    const memRoot = join(goldenTmp, 'agents', 'memory');
    const intake = join(memRoot, 'intake');
    mkdirSync(intake, { recursive: true });
    // Intake JSONL: 2 active (one ownership, one historical), 1 supersede,
    // a blank line + a malformed line (both must be skipped).
    const lines = [
        JSON.stringify({ entry_type: 'ownership', path: 'app/A.php', body: 'team-a' }),
        JSON.stringify({ entry_type: 'historical-patterns', path: 'app/B.php', body: 'flake' }),
        JSON.stringify({ type: 'supersede', id: 'old-1' }),
        '',
        'not-json',
    ];
    writeFileSync(join(intake, 'signals-2026-05.jsonl'), `${lines.join('\n')}\n`, 'utf-8');

    // Curated single-file layout: an overdue + a current + a no-review entry.
    const ownership = [
        'entries:',
        '  - id: own-overdue',
        '    last_validated: 2000-01-01',
        '    review_after_days: 30',
        '  - id: own-current',
        '    last_validated: 2999-01-01',
        '    review_after_days: 30',
        '  - id: own-no-review',
        '    last_validated: 2000-01-01',
    ].join('\n');
    writeFileSync(join(memRoot, 'ownership.yml'), `${ownership}\n`, 'utf-8');
}

describe('templates/memory_report — populated tree', () => {
    it('text output (overdue-days masked)', () => {
        seedMemoryTree();
        const r = runTs([]);
        expect({ status: r.status, stderr: r.stderr, stdout: normOverdue(r.stdout) }).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "Backend:   file (backend=file)
                     reason: file-backed memory (no external backend)
          Intake:    2 active, 1 superseded
            - historical-patterns: 1
            - ownership: 1
          Staleness: 1 entrie(s) overdue
            - own-overdue (ownership)  +Nd  agents/memory/ownership.yml
          Quarterly: staleness-rate=33.3% (1/3)
            accepted: 2000Q1:2, 2999Q1:1
          ",
          }
        `);
    });

    it('json output (overdue-days masked)', () => {
        seedMemoryTree();
        const r = runTs(['--format', 'json']);
        expect({ status: r.status, stderr: r.stderr, stdout: normOverdue(r.stdout) }).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "{
            "backend": {
              "status": "file",
              "backend": "file",
              "reason": "file-backed memory (no external backend)"
            },
            "intake": {
              "total_active": 2,
              "superseded": 1,
              "by_type": {
                "ownership": 1,
                "historical-patterns": 1
              },
              "by_month": {
                "2026-05": 2
              }
            },
            "staleness": [
              {
                "file": "agents/memory/ownership.yml",
                "type": "ownership",
                "id": "own-overdue",
                "overdue_days": N
              }
            ],
            "quarterly": {
              "accepted_by_quarter": {
                "2000Q1": 2,
                "2999Q1": 1
              },
              "retired_by_quarter": {},
              "staleness_rate": 0.333,
              "curated_total": 3,
              "curated_overdue": 1
            },
            "role_modes": {
              "total_markers": 0,
              "files_scanned": 0,
              "by_mode": {},
              "unknown_modes": []
            }
          }
          ",
          }
        `);
    });
});

describe('templates/memory_report — empty tree', () => {
    it('text output (fully deterministic)', () => {
        expect(runTs([])).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "Backend:   file (backend=file)
                     reason: file-backed memory (no external backend)
          Intake:    0 active, 0 superseded
          Staleness: no curated entries past review_after_days
          Quarterly: staleness-rate=0.0% (0/0)
          ",
          }
        `);
    });

    it('json output (fully deterministic)', () => {
        expect(runTs(['--format', 'json'])).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "{
            "backend": {
              "status": "file",
              "backend": "file",
              "reason": "file-backed memory (no external backend)"
            },
            "intake": {
              "total_active": 0,
              "superseded": 0,
              "by_type": {},
              "by_month": {}
            },
            "staleness": [],
            "quarterly": {
              "accepted_by_quarter": {},
              "retired_by_quarter": {},
              "staleness_rate": 0.0,
              "curated_total": 0,
              "curated_overdue": 0
            },
            "role_modes": {
              "total_markers": 0,
              "files_scanned": 0,
              "by_mode": {},
              "unknown_modes": []
            }
          }
          ",
          }
        `);
    });
});

describe('templates/memory_report — argparse errors', () => {
    it('bad --format choice → exit 2', () => {
        expect(runTs(['--format', 'xml'])).toMatchInlineSnapshot(`
          {
            "status": 2,
            "stderr": "usage: memory_report.py [-h] [--format {text,json}]
          memory_report.py: error: argument --format: invalid choice: 'xml' (choose from 'text', 'json')
          ",
            "stdout": "",
          }
        `);
    });
    it('unrecognized argument → exit 2', () => {
        expect(runTs(['--bogus'])).toMatchInlineSnapshot(`
          {
            "status": 2,
            "stderr": "usage: memory_report.py [-h] [--format {text,json}]
          memory_report.py: error: unrecognized arguments: --bogus
          ",
            "stdout": "",
          }
        `);
    });
    it('-h → usage + exit 0', () => {
        expect(runTs(['-h'])).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "usage: memory_report.py [-h] [--format {text,json}]
          ",
          }
        `);
    });
});
