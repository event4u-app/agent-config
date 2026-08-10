/**
 * Edit-shape advisory — `post_tool_use` concern
 * (`src/scripts/hooks/edit_shape_hook.ts`, road-to-token-economy-cache
 * Phase 5.1/5.2).
 *
 * Two layers, mirroring `end_review_nudge_hook.test.ts`'s shape:
 *   - Unit tests over the exported pure helpers (exemption matching,
 *     numstat reduction, advisory line, line counting).
 *   - E2E: spawns the hook via tsx with a dispatcher envelope on stdin
 *     against a real temp git repo, asserting the fire/no-fire pairs the
 *     roadmap names (small diff on a big tracked file → fire; new file /
 *     small file / big diff / exempt path / second fire / non-Write →
 *     silence).
 *
 * All fixtures live under `os.tmpdir()` — no tracked file is ever written.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import {
    buildAdvisoryLine,
    fileLineCount,
    isExemptPath,
    MAX_DIFF_RATIO,
    MIN_FILE_LINES,
    parseNumstatLines,
} from '../../src/scripts/hooks/edit_shape_hook.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const HOOK = path.join(REPO_ROOT, 'src', 'scripts', 'hooks', 'edit_shape_hook.ts');
const TSX = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

const tmp_dirs: string[] = [];

afterEach(() => {
    while (tmp_dirs.length > 0) {
        fs.rmSync(tmp_dirs.pop() as string, { recursive: true, force: true });
    }
});

function makeTmpDir(): string {
    const dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'edit-shape-'));
    tmp_dirs.push(dir);
    return dir;
}

function git(cwd: string, ...args: string[]): void {
    const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
    expect(r.status, `git ${args.join(' ')}: ${r.stderr}`).toBe(0);
}

/** Fresh git repo with one committed 60-line file at `relPath`. */
function makeRepo(relPath = 'src/big.ts', lines = 60): { root: string; abs: string } {
    const root = makeTmpDir();
    git(root, 'init', '-q');
    git(root, 'config', 'user.email', 'test@example.com');
    git(root, 'config', 'user.name', 'test');
    const abs = path.join(root, relPath);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, fileBody(lines));
    git(root, 'add', '.');
    git(root, 'commit', '-q', '-m', 'init');
    return { root, abs };
}

function fileBody(lines: number, marker = 'orig'): string {
    return Array.from({ length: lines }, (_, i) => `line ${i} ${marker}`).join('\n') + '\n';
}

/** Rewrite `abs` with `changed` of its `lines` lines modified. */
function modifyLines(abs: string, lines: number, changed: number): void {
    const body = Array.from({ length: lines }, (_, i) =>
        i < changed ? `line ${i} CHANGED` : `line ${i} orig`,
    ).join('\n');
    fs.writeFileSync(abs, body + '\n');
}

function envelope(root: string, payload: unknown, session = 'sess-1'): string {
    return JSON.stringify({
        schema_version: 1,
        platform: 'claude',
        event: 'post_tool_use',
        session_id: session,
        workspace_root: root,
        payload,
    });
}

function run(input: string, cwd: string): { status: number | null; stdout: string } {
    const r = spawnSync(TSX, [HOOK], { encoding: 'utf8', cwd, input });
    expect(r.status).not.toBeNull();
    return { status: r.status, stdout: r.stdout as string };
}

// ── Pure-helper unit tests ──────────────────────────────────────────────

describe('committed thresholds', () => {
    it('are the roadmap-committed values', () => {
        expect(MIN_FILE_LINES).toBe(50);
        expect(MAX_DIFF_RATIO).toBe(0.2);
    });
});

describe('isExemptPath', () => {
    it('matches the committed exemption list', () => {
        expect(isExemptPath('dist/agent-src/rules/a.md')).toBe(true);
        expect(isExemptPath('src/generated/types.ts')).toBe(true);
        expect(isExemptPath('package-lock.lock')).toBe(true);
        expect(isExemptPath('assets/app.min.js')).toBe(true);
        expect(isExemptPath('agents/runtime/state/x.json')).toBe(true);
    });
    it('does not match ordinary source paths', () => {
        expect(isExemptPath('src/scripts/hooks/edit_shape_hook.ts')).toBe(false);
        expect(isExemptPath('docs/distinction.md')).toBe(false); // "dist" as substring, not a segment
        expect(isExemptPath('src/minify.ts')).toBe(false);
    });
});

describe('parseNumstatLines', () => {
    it('sums added+deleted, treating binary "-" rows as 0', () => {
        expect(parseNumstatLines('5\t5\tsrc/a.ts\n')).toBe(10);
        expect(parseNumstatLines('-\t-\tbin/blob\n')).toBe(0);
        expect(parseNumstatLines('')).toBe(0);
    });
});

describe('fileLineCount', () => {
    it('counts lines, trailing newline not opening a new line', () => {
        const dir = makeTmpDir();
        const f = path.join(dir, 'f.txt');
        fs.writeFileSync(f, 'a\nb\nc\n');
        expect(fileLineCount(f)).toBe(3);
        fs.writeFileSync(f, 'a\nb\nc');
        expect(fileLineCount(f)).toBe(3);
        expect(fileLineCount(path.join(dir, 'missing.txt'))).toBe(0);
    });
});

describe('buildAdvisoryLine', () => {
    it('names line count, percentage, and the cheaper primitive', () => {
        const line = buildAdvisoryLine(60, 10);
        expect(line).toContain('60 lines');
        expect(line).toContain('~17%');
        expect(line).toContain('targeted Edit');
    });
});

// ── E2E fire/no-fire pairs ──────────────────────────────────────────────

describe('edit_shape_hook E2E', () => {
    it('fires (exit 2, warn JSON) on a Write to a >=50-line tracked file with a small diff', () => {
        const { root, abs } = makeRepo('src/big.ts', 60);
        modifyLines(abs, 60, 5); // 5 changed lines → 10 numstat lines → ~17% of 60
        const { status, stdout } = run(
            envelope(root, { tool_name: 'Write', tool_input: { file_path: abs } }),
            root,
        );
        expect(status).toBe(2);
        const out = JSON.parse(stdout);
        expect(out.decision).toBe('warn');
        expect(out.reason).toContain('edit-shape');
        expect(out.additional_context).toContain('targeted Edit');
    });

    it('is silent on a brand-new (untracked) file — no pre-image, not a replace', () => {
        const { root } = makeRepo();
        const fresh = path.join(root, 'src', 'new.ts');
        fs.writeFileSync(fresh, fileBody(80));
        const { status, stdout } = run(
            envelope(root, { tool_name: 'Write', tool_input: { file_path: fresh } }),
            root,
        );
        expect(status).toBe(0);
        expect(stdout.trim()).toBe('');
    });

    it('is silent on a small file (< MIN_FILE_LINES)', () => {
        const { root, abs } = makeRepo('src/small.ts', 20);
        modifyLines(abs, 20, 2);
        const { status } = run(
            envelope(root, { tool_name: 'Write', tool_input: { file_path: abs } }),
            root,
        );
        expect(status).toBe(0);
    });

    it('is silent when the diff is big (a real rewrite, not a wasteful replace)', () => {
        const { root, abs } = makeRepo('src/big.ts', 60);
        modifyLines(abs, 60, 40); // 80 numstat lines / 60 file lines >> 20%
        const { status } = run(
            envelope(root, { tool_name: 'Write', tool_input: { file_path: abs } }),
            root,
        );
        expect(status).toBe(0);
    });

    it('is silent on an exempt path even when the shape would otherwise fire', () => {
        const { root, abs } = makeRepo('dist/big.ts', 60);
        modifyLines(abs, 60, 5);
        const { status } = run(
            envelope(root, { tool_name: 'Write', tool_input: { file_path: abs } }),
            root,
        );
        expect(status).toBe(0);
    });

    it('fires at most once per session (F2-style marker)', () => {
        const { root, abs } = makeRepo('src/big.ts', 60);
        modifyLines(abs, 60, 5);
        const env = envelope(root, { tool_name: 'Write', tool_input: { file_path: abs } }, 'sess-once');
        expect(run(env, root).status).toBe(2);
        const second = run(env, root);
        expect(second.status).toBe(0);
        expect(second.stdout.trim()).toBe('');
        // Marker carries a timestamp only — flags, never content.
        const stateDir = path.join(root, 'agents', 'runtime', 'state', 'edit-shape');
        // atomic_write_json leaves its `.dispatcher.lock` sentinel alongside
        // the marker — only the marker itself is asserted here.
        const markers = fs.readdirSync(stateDir).filter((f) => f.endsWith('.json'));
        expect(markers).toHaveLength(1);
        const marker = JSON.parse(fs.readFileSync(path.join(stateDir, markers[0] as string), 'utf8'));
        expect(Object.keys(marker)).toEqual(['fired_at']);
    });

    it('is silent on non-Write tools (Edit, Read, Bash)', () => {
        const { root, abs } = makeRepo('src/big.ts', 60);
        modifyLines(abs, 60, 5);
        for (const tool_name of ['Edit', 'Read', 'Bash']) {
            const { status, stdout } = run(
                envelope(root, { tool_name, tool_input: { file_path: abs } }),
                root,
            );
            expect(status, tool_name).toBe(0);
            expect(stdout.trim()).toBe('');
        }
    });

    it('is silent (exit 0) on malformed / empty stdin', () => {
        const root = makeTmpDir();
        expect(run('not json {', root).status).toBe(0);
        expect(run('', root).status).toBe(0);
        expect(run('{"tool_name": 42}', root).status).toBe(0);
    });
});
