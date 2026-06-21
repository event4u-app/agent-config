// Tests for src/scripts/hooks/dispatch_hook.ts feedback-dir path-traversal
// neutralisation (py2ts — GAP coverage).
//
// Ports ONLY the session_id path-traversal case from
// tests/hooks/test_dispatcher_feedback.py
// (test_session_id_path_traversal_is_neutralised). The rest of that
// python file (per-concern files, summary rollup, silent-severity
// inference, empty-envelope fallback) is already covered end-to-end by
// the golden-parity layer in tests/scripts/hooks/dispatch_hook.test.ts,
// so only the traversal gap is filled here.
//
// Two layers:
//   1. Pure unit — feedback_dir() is the neutralisation site; assert `/`,
//      `\`, and `..` collapse to `_` with no subprocess.
//   2. End-to-end — drive the dispatcher (main) the way the python test
//      does (against a tmp manifest + fixture concern) and assert no
//      parent-escape directory lands on disk. Runs via tsx subprocess so
//      it mirrors the python in-process main() run; the concern result is
//      irrelevant (fail-open) so it passes even when python3 is stubbed.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { EXIT_ALLOW } from '../../../src/scripts/hooks/dispatch_hook.js';
import { feedback_dir, FEEDBACK_DIRNAME } from '../../../src/scripts/hooks/state_io.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'hooks', 'dispatch_hook.ts');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);
const FIXTURE_CONCERN = 'tests/hooks/fixtures/concern_allow.ts';

let tmp: string;
beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dispatch-traversal-'));
});
afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

// --- Layer 1: pure unit on feedback_dir (the neutralisation site) -----

describe('feedback_dir — path-traversal neutralisation', () => {
    it('collapses /, \\ and .. in the session id to _', () => {
        const stateRoot = path.join(tmp, 'agents', 'runtime', 'state');
        const dir = feedback_dir(stateRoot, '../etc/passwd');
        const base = path.basename(dir);
        // No path separators or parent-escape sequences survive.
        expect(base).not.toContain('/');
        expect(base).not.toContain('\\');
        expect(base).not.toContain('..');
        // The dir stays inside the .dispatcher root — never escapes upward:
        // the sanitised id is a single path segment under .dispatcher.
        const dispatcherRoot = path.join(stateRoot, FEEDBACK_DIRNAME);
        expect(path.dirname(dir)).toBe(dispatcherRoot);
        expect(base.length).toBeGreaterThan(0);
        expect(base.split(path.sep).length).toBe(1);
    });

    it('neutralises a backslash-based traversal too', () => {
        const stateRoot = path.join(tmp, 'agents', 'runtime', 'state');
        const dir = feedback_dir(stateRoot, '..\\..\\secret');
        const base = path.basename(dir);
        expect(base).not.toContain('\\');
        expect(base).not.toContain('..');
        expect(path.dirname(dir)).toBe(path.join(stateRoot, FEEDBACK_DIRNAME));
    });
});

// --- Layer 2: end-to-end main() run, no parent-escape on disk ---------

function writeManifest(target: string): void {
    const lines = [
        'schema_version: 1',
        'concerns:',
        '  allow_one:',
        `    script: ${FIXTURE_CONCERN}`,
        '    fail_closed: false',
        'platforms:',
        '  augment:',
        '    stop: [allow_one]',
        '',
    ];
    fs.writeFileSync(target, lines.join('\n'), 'utf8');
}

describe('dispatch_hook end-to-end — session_id path-traversal cannot escape', () => {
    it('a ../etc/passwd session id leaves no parent-escape dir on disk', () => {
        const ws = path.join(tmp, 'ws');
        fs.mkdirSync(ws, { recursive: true });
        const manifest = path.join(tmp, 'manifest.yaml');
        writeManifest(manifest);

        const payload = JSON.stringify({ session_id: '../etc/passwd' });
        const r = spawnSync(
            TSX_BIN,
            [TS_SCRIPT, '--platform', 'augment', '--event', 'stop', '--manifest', manifest],
            { cwd: ws, input: payload, encoding: 'utf8' },
        );
        // Concern result is irrelevant (fail-open); the dispatcher still
        // exits allow and writes feedback to the sanitised dir.
        expect(r.status).toBe(EXIT_ALLOW);

        const dispatcherDir = path.join(ws, 'agents', 'runtime', 'state', '.dispatcher');
        expect(fs.existsSync(dispatcherDir)).toBe(true);
        const children = fs
            .readdirSync(dispatcherDir)
            .filter((p) => fs.statSync(path.join(dispatcherDir, p)).isDirectory())
            .sort();
        // Every session dir is sanitised — no `/` or `..` survives.
        for (const c of children) {
            expect(c).not.toContain('/');
            expect(c).not.toContain('..');
        }
        // Hard assertion: no parent-escape directories on disk.
        expect(fs.existsSync(path.join(ws, 'agents', 'runtime', 'state', 'etc'))).toBe(false);
        expect(fs.existsSync(path.join(ws, 'etc'))).toBe(false);
        expect(fs.existsSync(path.join(tmp, 'etc'))).toBe(false);
    });
});
