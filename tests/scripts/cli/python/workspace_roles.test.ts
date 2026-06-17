// Golden-parity tests for src/cli/python/workspace_roles.ts (py2ts ADR-200 —
// role + task discovery for the workspace launcher, Phase 4).
//
// Strategy: run `python3 workspace_roles.py` vs `tsx workspace_roles.ts` and
// byte-compare stdout / stderr / exit. The CLI resolves roles from
// `agents/roles/<role>` RELATIVE TO THE CWD, so each case runs both languages
// with `cwd` set to a hermetic temp dir holding a hand-built `agents/roles`
// fixture (frontmatter + a `## First tasks` list + a `skills.yml`). Output is
// fully deterministic (no timestamps, no randomness).
//
// Coverage: list (text), tasks (per-task sorted JSON lines), show (indent-2
// sorted JSON with identity / title-fallback / parsed tasks + skills), unknown
// role (stderr + exit 1), role with no skills.yml / no first-tasks, the
// `.title()` slug fallback, and the argparse error surface. The `--help` BODY
// is NOT byte-compared (only the `usage:` line) per the porting contract.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'cli', 'python', 'workspace_roles.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'cli', 'python', 'workspace_roles.py');
const TSX_BIN = path.resolve(
    REPO_ROOT,
    process.env['TSX_BIN'] ??
        path.join('node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx'),
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}
const py3 = hasPython3();

interface RunResult {
    status: number | null;
    stdout: string;
    stderr: string;
}

function runPy(args: string[], cwd: string): RunResult {
    const r = spawnSync('python3', [PY_SCRIPT, ...args], {
        cwd,
        encoding: 'utf8',
        env: { ...process.env, PYTHONPATH: path.join(REPO_ROOT, 'src') },
    });
    return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

function runTs(args: string[], cwd: string): RunResult {
    const r = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd, encoding: 'utf8', env: { ...process.env } });
    return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

function expectParity(args: string[], cwd: string): void {
    const p = runPy(args, cwd);
    const t = runTs(args, cwd);
    expect(t.status).toBe(p.status);
    expect(t.stdout).toBe(p.stdout);
    expect(t.stderr).toBe(p.stderr);
}

let tmp: string;
beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wsroles-'));
    const roles = path.join(tmp, 'agents', 'roles');
    // sales — full: title, identity, first tasks, skills.yml.
    const sales = path.join(roles, 'sales');
    fs.mkdirSync(sales, { recursive: true });
    fs.writeFileSync(
        path.join(sales, 'index.md'),
        [
            '---',
            'title: Sales Pro',
            'explain_default: technical',
            '---',
            '',
            'You help close deals and write crisp offers.',
            '',
            '## First tasks',
            '',
            '- draft-offer — Draft an offer from a brief',
            '- answer-customer: Reply to a customer question',
            '- Prep Discovery Call',
            '',
            '## Other',
            '',
            '- not-a-task — should be ignored',
            '',
        ].join('\n'),
    );
    fs.writeFileSync(
        path.join(sales, 'skills.yml'),
        ['# role skills', 'skills:', '  - positioning-strategy', "  - 'deal-qualification-meddic'", 'other: x', ''].join(
            '\n',
        ),
    );
    // content-creator — no title (→ .title() fallback), no skills.yml, "## Tasks".
    const cc = path.join(roles, 'content-creator');
    fs.mkdirSync(cc, { recursive: true });
    fs.writeFileSync(
        path.join(cc, 'index.md'),
        ['---', 'explain_default: plain', '---', '', 'Identity para.', '', '## Tasks', '', '* write-thread — Expand a post into a thread', ''].join(
            '\n',
        ),
    );
    // empty-role — index.md with no frontmatter, no tasks.
    const empty = path.join(roles, 'empty-role');
    fs.mkdirSync(empty, { recursive: true });
    fs.writeFileSync(path.join(empty, 'index.md'), 'Just a body, no frontmatter, no tasks.\n');
    // a non-dir entry + a dir without index.md (must be excluded from list).
    fs.writeFileSync(path.join(roles, 'README.md'), 'not a role\n');
    fs.mkdirSync(path.join(roles, 'noindex'), { recursive: true });
});
afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

describe.skipIf(!py3)('workspace_roles — list', () => {
    it('lists only dirs with index.md, sorted', () => {
        expectParity(['list'], tmp);
    });
    it('empty cwd (no agents/roles) → empty', () => {
        const bare = fs.mkdtempSync(path.join(os.tmpdir(), 'wsroles-bare-'));
        try {
            expectParity(['list'], bare);
        } finally {
            fs.rmSync(bare, { recursive: true, force: true });
        }
    });
});

describe.skipIf(!py3)('workspace_roles — tasks', () => {
    it('full role tasks (sorted-key JSON per line)', () => {
        expectParity(['tasks', 'sales'], tmp);
    });
    it('## Tasks heading variant', () => {
        expectParity(['tasks', 'content-creator'], tmp);
    });
    it('role with no tasks → no output', () => {
        expectParity(['tasks', 'empty-role'], tmp);
    });
    it('unknown role → no output (tasks returns [])', () => {
        expectParity(['tasks', 'zzz'], tmp);
    });
});

describe.skipIf(!py3)('workspace_roles — show', () => {
    it('full role (indent-2 sorted JSON)', () => {
        expectParity(['show', 'sales'], tmp);
    });
    it('title fallback via .title() + no skills.yml', () => {
        expectParity(['show', 'content-creator'], tmp);
    });
    it('no-frontmatter role', () => {
        expectParity(['show', 'empty-role'], tmp);
    });
    it('unknown role → stderr + exit 1', () => {
        expectParity(['show', 'zzz'], tmp);
    });
});

describe.skipIf(!py3)('workspace_roles — argparse errors', () => {
    it('no args → required cmd, exit 2', () => {
        expectParity([], tmp);
    });
    it('bad subcommand → invalid choice, exit 2', () => {
        expectParity(['bogus'], tmp);
    });
    it('tasks missing role → exit 2', () => {
        expectParity(['tasks'], tmp);
    });
    it('show missing role → exit 2', () => {
        expectParity(['show'], tmp);
    });
    it('list extra positional → unrecognized, exit 2', () => {
        expectParity(['list', 'extra'], tmp);
    });
    it('tasks extra positional → unrecognized, exit 2', () => {
        expectParity(['tasks', 'a', 'b'], tmp);
    });
    it('top-level -h → usage line + exit 0', () => {
        const p = runPy(['-h'], tmp);
        const t = runTs(['-h'], tmp);
        expect(t.status).toBe(p.status);
        expect(t.stdout.split('\n')[0]).toBe(p.stdout.split('\n')[0]);
    });
});
