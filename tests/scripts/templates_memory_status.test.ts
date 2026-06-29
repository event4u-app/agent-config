// Intent tests for src/agent-src/templates/scripts/memory_status.ts — backend
// probe (ADR-200, consumer-template memory; byte-identical to the dev-side
// src/scripts/memory_status.ts apart from the header doc-comment path).
//
// Was a python3-vs-tsx byte-parity rig; the `.py` twin is gone, so this asserts
// the tsx CLI's own contract directly. The backend is a hard-coded `file`
// constant (no clock, no tmp paths, no external probe), so output is fully
// deterministic. Every case spawns with a node-only PATH (a temp dir holding
// just a `node` symlink) so the tsx launcher resolves but NO `memory`-family
// CLI does, and COLUMNS=200 forces single-line usage so arg-error stderr does
// not re-wrap to terminal width.

import { spawnSync } from 'node:child_process';
import { mkdtempSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');
const _TSX_ENV = process.env['TSX_BIN'];
const TSX_BIN = _TSX_ENV
    ? (isAbsolute(_TSX_ENV) ? _TSX_ENV : resolve(REPO_ROOT, _TSX_ENV))
    : join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
const SCRIPTS_DIR = join(REPO_ROOT, 'src', 'agent-src', 'templates', 'scripts');
const TS_SCRIPT = join(SCRIPTS_DIR, 'memory_status.ts');

// node-only PATH → deterministic absent backend (nothing but `node` resolves).
const NODE_ONLY_DIR = mkdtempSync(join(tmpdir(), 'tpl-memstat-nodeonly-'));
symlinkSync(process.execPath, join(NODE_ONLY_DIR, 'node'));
afterAll(() => {
    // temp dir is left for the OS to reap; nothing sensitive.
});

interface RunResult {
    status: number | null;
    stdout: string;
    stderr: string;
}

function runTs(args: string[]): RunResult {
    const r = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], {
        encoding: 'utf8',
        env: { HOME: process.env['HOME'] ?? '', PATH: NODE_ONLY_DIR, COLUMNS: '200', AGENT_MEMORY_STATUS: '' },
    });
    return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

describe('templates/memory_status — status', () => {
    it('text output (absent)', () => {
        expect(runTs(['--refresh'])).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "  ℹ️  backend=file  status=file  reason=file-backed memory (no external backend)
          ",
          }
        `);
    });
    it('json output (absent)', () => {
        expect(runTs(['--refresh', '--format', 'json'])).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "{"status": "file", "backend": "file", "reason": "file-backed memory (no external backend)", "elapsed_ms": 0}
          ",
          }
        `);
    });
    it('--health (absent)', () => {
        expect(runTs(['--health', '--refresh'])).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "{"contract_version": 1, "status": "ok", "backend_version": "0.0.0-file", "features": ["file-fallback"]}
          ",
          }
        `);
    });
});

describe('templates/memory_status — argparse errors', () => {
    it('bad --format choice → exit 2', () => {
        expect(runTs(['--format', 'xml'])).toMatchInlineSnapshot(`
          {
            "status": 2,
            "stderr": "usage: memory_status.py [-h] [--format {text,json}] [--refresh] [--health]
          memory_status.py: error: argument --format: invalid choice: 'xml' (choose from 'text', 'json')
          ",
            "stdout": "",
          }
        `);
    });
    it('unrecognized argument → exit 2', () => {
        expect(runTs(['--bogus'])).toMatchInlineSnapshot(`
          {
            "status": 2,
            "stderr": "usage: memory_status.py [-h] [--format {text,json}] [--refresh] [--health]
          memory_status.py: error: unrecognized arguments: --bogus
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
            "stdout": "usage: memory_status.py [-h] [--format {text,json}] [--refresh] [--health]
          ",
          }
        `);
    });
});
