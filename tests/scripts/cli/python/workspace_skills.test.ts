// Golden-parity tests for src/cli/python/workspace_skills.ts (py2ts ADR-200 —
// skill-body resolution for host hand-off pre-rendering, ADR-066).
//
// Strategy: run `python3 workspace_skills.py` vs `tsx workspace_skills.ts` and
// byte-compare stdout / stderr / exit. Skill resolution is deterministic: both
// languages resolve `<repo>/.agent-src.uncondensed/skills/<id>/SKILL.md` then
// `<repo>/dist/agent-src/skills/<id>/SKILL.md` (ROOT = parents[3] of the
// script), strip frontmatter the same way, and cap the body at 64 KiB. The
// resolution root is the REAL repo, so we resolve a known-present skill
// (`docker`) for the happy path plus invalid / missing ids for the note path.
//
// Coverage: resolve a present skill (section + --json), invalid id, missing id
// (section + --json), `--format=json` inline form, bad --format choice, and
// the argparse error surface. The `--help` BODY is NOT byte-compared (only the
// `usage:` line) per the porting contract.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'cli', 'python', 'workspace_skills.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'cli', 'python', 'workspace_skills.py');
const TSX_BIN = path.resolve(
    REPO_ROOT,
    process.env['TSX_BIN'] ??
        path.join('node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx'),
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}
const py3 = hasPython3();

/** Pick a skill id that exists under one of the two real SKILL_SOURCES. */
function presentSkill(): string | null {
    for (const root of [
        path.join(REPO_ROOT, '.agent-src.uncondensed', 'skills'),
        path.join(REPO_ROOT, 'dist', 'agent-src', 'skills'),
    ]) {
        let names: string[];
        try {
            names = fs.readdirSync(root);
        } catch {
            continue;
        }
        for (const n of names.sort()) {
            if (fs.existsSync(path.join(root, n, 'SKILL.md')) && /^[a-z0-9][a-z0-9-]*$/.test(n)) {
                return n;
            }
        }
    }
    return null;
}
const SKILL = presentSkill();

interface RunResult {
    status: number | null;
    stdout: string;
    stderr: string;
}

function runPy(args: string[]): RunResult {
    const r = spawnSync('python3', [PY_SCRIPT, ...args], {
        encoding: 'utf8',
        env: { ...process.env, PYTHONPATH: path.join(REPO_ROOT, 'src') },
    });
    return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

function runTs(args: string[]): RunResult {
    const r = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { encoding: 'utf8', env: { ...process.env } });
    return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

function expectParity(args: string[]): void {
    const p = runPy(args);
    const t = runTs(args);
    expect(t.status).toBe(p.status);
    expect(t.stdout).toBe(p.stdout);
    expect(t.stderr).toBe(p.stderr);
}

describe.skipIf(!py3)('workspace_skills — resolve present skill', () => {
    it.skipIf(!SKILL)('section format (full body + header)', () => {
        expectParity(['resolve', SKILL as string]);
    });
    it.skipIf(!SKILL)('--format json (sorted keys)', () => {
        expectParity(['resolve', SKILL as string, '--format', 'json']);
    });
    it.skipIf(!SKILL)('--format=json inline form', () => {
        expectParity(['resolve', SKILL as string, '--format=json']);
    });
});

describe.skipIf(!py3)('workspace_skills — resolve note path', () => {
    it('invalid id (charset reject)', () => {
        expectParity(['resolve', 'Bad Id']);
    });
    it('missing id (section note)', () => {
        expectParity(['resolve', 'nonexistent-skill-xyz']);
    });
    it('missing id (--format json note)', () => {
        expectParity(['resolve', 'nonexistent-skill-xyz', '--format', 'json']);
    });
    it('empty-ish invalid id', () => {
        expectParity(['resolve', 'UPPER']);
    });
});

describe.skipIf(!py3)('workspace_skills — argparse errors', () => {
    it('no args → required cmd, exit 2', () => {
        expectParity([]);
    });
    it('bad subcommand → invalid choice, exit 2', () => {
        expectParity(['bogus']);
    });
    it('resolve missing skill_hint → exit 2', () => {
        expectParity(['resolve']);
    });
    it('resolve bad --format choice → exit 2', () => {
        expectParity(['resolve', 'docker', '--format', 'bogus']);
    });
    it('resolve extra positional → unrecognized, exit 2', () => {
        expectParity(['resolve', 'a', 'b']);
    });
    it('top-level -h → usage line + exit 0', () => {
        const p = runPy(['-h']);
        const t = runTs(['-h']);
        expect(t.status).toBe(p.status);
        expect(t.stdout.split('\n')[0]).toBe(p.stdout.split('\n')[0]);
    });
});
