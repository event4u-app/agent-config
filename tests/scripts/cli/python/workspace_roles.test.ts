// Intent tests for src/cli/python/workspace_roles.ts (py2ts ADR-200 —
// role + task discovery for the workspace launcher, Phase 4).
//
// Was a python3-vs-tsx byte-parity rig; the `.py` original is gone, so this now
// asserts the tsx CLI's own contract directly. The CLI resolves roles from
// `agents/roles/<role>` RELATIVE TO THE CWD, so each case runs with `cwd` set to
// a hermetic temp dir holding a hand-built `agents/roles` fixture (frontmatter +
// a `## First tasks` list + a `skills.yml`). Output is fully deterministic — no
// timestamps, no randomness, only the fixture — so snapshots are taken verbatim.
//
// The spawned tsx process gets a **node-only PATH** (a temp dir holding just a
// `node` symlink) so host-CLI detection is deterministic regardless of what is
// installed on the runner, plus COLUMNS=200 so arg-error usage does not re-wrap.
//
// Coverage: list (text), tasks (per-task sorted JSON lines), show (indent-2
// sorted JSON with identity / title-fallback / parsed tasks + skills), unknown
// role (stderr + exit 1), role with no skills.yml / no first-tasks, the
// `.title()` slug fallback, and the argparse error surface. The `--help` BODY is
// NOT snapshotted (only the `usage:` line) per the porting contract.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'cli', 'python', 'workspace_roles.ts');
const TSX_BIN = path.resolve(
    REPO_ROOT,
    process.env['TSX_BIN'] ??
        path.join('node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx'),
);

// node-only PATH → deterministic host-CLI detection (nothing but `node` resolves).
const NODE_ONLY_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ws-roles-nodeonly-'));
fs.symlinkSync(process.execPath, path.join(NODE_ONLY_DIR, 'node'));
afterAll(() => {
    // temp dir is left for the OS to reap; nothing sensitive.
});

interface RunResult {
    status: number | null;
    stdout: string;
    stderr: string;
}

function runTs(args: string[], cwd: string): RunResult {
    const r = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], {
        cwd,
        encoding: 'utf8',
        env: { ...process.env, PATH: NODE_ONLY_DIR, COLUMNS: '200' },
    });
    return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
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

describe('workspace_roles — list', () => {
    it('lists only dirs with index.md, sorted', () => {
        expect(runTs(['list'], tmp)).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "content-creator
          empty-role
          sales
          ",
          }
        `);
    });
    it('empty cwd (no agents/roles) → empty', () => {
        const bare = fs.mkdtempSync(path.join(os.tmpdir(), 'wsroles-bare-'));
        try {
            expect(runTs(['list'], bare)).toMatchInlineSnapshot(`
              {
                "status": 0,
                "stderr": "",
                "stdout": "",
              }
            `);
        } finally {
            fs.rmSync(bare, { recursive: true, force: true });
        }
    });
});

describe('workspace_roles — tasks', () => {
    it('full role tasks (sorted-key JSON per line)', () => {
        expect(runTs(['tasks', 'sales'], tmp)).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "{"document_type": null, "output_shape": "chat", "prompt_path": null, "slug": "draft-offer", "title": "Draft an offer from a brief"}
          {"document_type": null, "output_shape": "chat", "prompt_path": null, "slug": "answer-customer", "title": "answer-customer: Reply to a customer question"}
          {"document_type": null, "output_shape": "chat", "prompt_path": null, "slug": "prep-discovery-call", "title": "Prep Discovery Call"}
          ",
          }
        `);
    });
    it('## Tasks heading variant', () => {
        expect(runTs(['tasks', 'content-creator'], tmp)).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "{"document_type": null, "output_shape": "chat", "prompt_path": null, "slug": "write-thread", "title": "Expand a post into a thread"}
          ",
          }
        `);
    });
    it('role with no tasks → no output', () => {
        expect(runTs(['tasks', 'empty-role'], tmp)).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "",
          }
        `);
    });
    it('unknown role → no output (tasks returns [])', () => {
        expect(runTs(['tasks', 'zzz'], tmp)).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "",
          }
        `);
    });
});

describe('workspace_roles — show', () => {
    it('full role (indent-2 sorted JSON)', () => {
        expect(runTs(['show', 'sales'], tmp)).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "{
            "explain_default": "technical",
            "identity": "You help close deals and write crisp offers.",
            "skills": [
              "positioning-strategy",
              "deal-qualification-meddic"
            ],
            "slug": "sales",
            "tasks": [
              {
                "document_type": null,
                "output_shape": "chat",
                "prompt_path": null,
                "slug": "draft-offer",
                "title": "Draft an offer from a brief"
              },
              {
                "document_type": null,
                "output_shape": "chat",
                "prompt_path": null,
                "slug": "answer-customer",
                "title": "answer-customer: Reply to a customer question"
              },
              {
                "document_type": null,
                "output_shape": "chat",
                "prompt_path": null,
                "slug": "prep-discovery-call",
                "title": "Prep Discovery Call"
              }
            ],
            "title": "Sales Pro"
          }
          ",
          }
        `);
    });
    it('title fallback via .title() + no skills.yml', () => {
        expect(runTs(['show', 'content-creator'], tmp)).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "{
            "explain_default": "plain",
            "identity": "Identity para.",
            "skills": [],
            "slug": "content-creator",
            "tasks": [
              {
                "document_type": null,
                "output_shape": "chat",
                "prompt_path": null,
                "slug": "write-thread",
                "title": "Expand a post into a thread"
              }
            ],
            "title": "Content Creator"
          }
          ",
          }
        `);
    });
    it('no-frontmatter role', () => {
        expect(runTs(['show', 'empty-role'], tmp)).toMatchInlineSnapshot(`
          {
            "status": 0,
            "stderr": "",
            "stdout": "{
            "explain_default": "plain",
            "identity": "Just a body, no frontmatter, no tasks.",
            "skills": [],
            "slug": "empty-role",
            "tasks": [],
            "title": "Empty Role"
          }
          ",
          }
        `);
    });
    it('unknown role → stderr + exit 1', () => {
        expect(runTs(['show', 'zzz'], tmp)).toMatchInlineSnapshot(`
          {
            "status": 1,
            "stderr": "unknown role: zzz
          ",
            "stdout": "",
          }
        `);
    });
});

describe('workspace_roles — argparse errors', () => {
    it('no args → required cmd, exit 2', () => {
        expect(runTs([], tmp)).toMatchInlineSnapshot(`
          {
            "status": 2,
            "stderr": "usage: workspace_roles [-h] {list,tasks,show} ...
          workspace_roles: error: the following arguments are required: cmd
          ",
            "stdout": "",
          }
        `);
    });
    it('bad subcommand → invalid choice, exit 2', () => {
        expect(runTs(['bogus'], tmp)).toMatchInlineSnapshot(`
          {
            "status": 2,
            "stderr": "usage: workspace_roles [-h] {list,tasks,show} ...
          workspace_roles: error: argument cmd: invalid choice: 'bogus' (choose from 'list', 'tasks', 'show')
          ",
            "stdout": "",
          }
        `);
    });
    it('tasks missing role → exit 2', () => {
        expect(runTs(['tasks'], tmp)).toMatchInlineSnapshot(`
          {
            "status": 2,
            "stderr": "usage: workspace_roles tasks [-h] role
          workspace_roles tasks: error: the following arguments are required: role
          ",
            "stdout": "",
          }
        `);
    });
    it('show missing role → exit 2', () => {
        expect(runTs(['show'], tmp)).toMatchInlineSnapshot(`
          {
            "status": 2,
            "stderr": "usage: workspace_roles show [-h] role
          workspace_roles show: error: the following arguments are required: role
          ",
            "stdout": "",
          }
        `);
    });
    it('list extra positional → unrecognized, exit 2', () => {
        expect(runTs(['list', 'extra'], tmp)).toMatchInlineSnapshot(`
          {
            "status": 2,
            "stderr": "usage: workspace_roles [-h] {list,tasks,show} ...
          workspace_roles: error: unrecognized arguments: extra
          ",
            "stdout": "",
          }
        `);
    });
    it('tasks extra positional → unrecognized, exit 2', () => {
        expect(runTs(['tasks', 'a', 'b'], tmp)).toMatchInlineSnapshot(`
          {
            "status": 2,
            "stderr": "usage: workspace_roles [-h] {list,tasks,show} ...
          workspace_roles: error: unrecognized arguments: b
          ",
            "stdout": "",
          }
        `);
    });
    it('top-level -h → usage line + exit 0', () => {
        const r = runTs(['-h'], tmp);
        expect({ status: r.status, usage: r.stdout.split('\n')[0] }).toMatchInlineSnapshot(`
          {
            "status": 0,
            "usage": "usage: workspace_roles [-h] {list,tasks,show} ...",
          }
        `);
    });
});
