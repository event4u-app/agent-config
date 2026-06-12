// Tests for src/scripts/linked_projects_list.ts (py2ts Phase 8 / Wave 8e).
//
// No pytest suite existed — focused differential over a crafted fixture root
// (a VS Code .code-workspace pointing at a sibling git repo) exercising the
// three opt-in states (yes / no / undecided) in both text and json formats,
// plus the bad-`--format` argparse error path. All compared python3 vs tsx
// byte-for-byte; skipped without python3. Read-only, no git drift.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'linked_projects_list.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'linked_projects_list.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

const py = hasPython3();
const runPy = (args: string[]) =>
    spawnSync('python3', [PY_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
const runTs = (args: string[]) =>
    spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });

function assertSame(args: string[]): void {
    const p = runPy(args);
    const t = runTs(args);
    expect(t.status).toBe(p.status);
    expect(t.stdout).toBe(p.stdout);
    expect(t.stderr).toBe(p.stderr);
}

describe('linked_projects_list — real repo', () => {
    it.skipIf(!py)('text (opted-in only) matches', () => {
        assertSame([]);
    });
    it.skipIf(!py)('--all --format json matches', () => {
        assertSame(['--all', '--format', 'json']);
    });
    it.skipIf(!py)('--format json matches', () => {
        assertSame(['--format', 'json']);
    });
    it.skipIf(!py)('bad --format exits 2 identically', () => {
        const p = runPy(['--format', 'xml']);
        const t = runTs(['--format', 'xml']);
        expect(p.status).toBe(2);
        expect(t.status).toBe(2);
        expect(t.stderr).toBe(p.stderr);
    });
});

describe('linked_projects_list — fixture with a sibling', () => {
    let tmp: string;
    let proj: string;
    let siblingResolved: string;

    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lpl-'));
        proj = path.join(tmp, 'proj');
        const sibling = path.join(tmp, 'sibling');
        fs.mkdirSync(proj, { recursive: true });
        fs.mkdirSync(path.join(sibling, '.git'), { recursive: true });
        // realpath so the opt-in path matches Python Path.resolve() output.
        siblingResolved = fs.realpathSync(sibling);
        fs.writeFileSync(
            path.join(proj, 'ws.code-workspace'),
            JSON.stringify({ folders: [{ path: '../sibling' }] }),
            'utf-8',
        );
        fs.mkdirSync(path.join(proj, 'agents', 'settings'), { recursive: true });
    });

    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    function writeOptIn(include: boolean): void {
        fs.writeFileSync(
            path.join(proj, 'agents', 'settings', '.agent-settings.local.yml'),
            `linked_projects:\n  - path: "${siblingResolved}"\n    include: ${include}\n`,
            'utf-8',
        );
    }

    it.skipIf(!py)('opted-in: json + text match', () => {
        writeOptIn(true);
        assertSame(['--root', proj, '--format', 'json']);
        assertSame(['--root', proj]);
        assertSame(['--root', proj, '--all']);
    });

    it.skipIf(!py)('declined: --all surfaces include=no identically', () => {
        writeOptIn(false);
        assertSame(['--root', proj, '--all', '--format', 'json']);
        assertSame(['--root', proj, '--all']);
        // opted-in-only view is empty
        assertSame(['--root', proj, '--format', 'json']);
    });

    it.skipIf(!py)('undecided (no opt-in file): --all surfaces undecided', () => {
        assertSame(['--root', proj, '--all', '--format', 'json']);
        assertSame(['--root', proj, '--all']);
    });
});
