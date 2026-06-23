// Intent tests for src/cli/python/workspace_documents.ts (py2ts ADR-200
// — local workspace document store, workspace-documents.md).
//
// Was a python3-vs-tsx byte-parity rig; the `.py` original is gone, so this now
// asserts the tsx CLI's own contract directly. `create`/`save`/`read`/`export`
// have NO `--root` flag — they write under `$HOME/.event4u/.../documents/
// <type>/` — so each case runs under a hermetic `HOME`; `list`/`migrate`/
// `decrypt-all`/`rekey` take an explicit `--root` (`<HOME>/.../documents`).
// `norm()` masks the nondeterministic surfaces: the `<DAY>` slug suffix
// (`<today>`), the `created_at`/`last_edited_at` ISO second, the `updated_at`
// ISO-millis, the float `mtime`, and the HOME tmp root — leaving the structural
// payload (slug, frontmatter, delta counts, body_sha256, listing shape) a
// reproducible assertion. body_sha256 is content-derived, hence stable.
//
// Encryption-at-rest defaults OFF (no `.agent-settings.yml → encrypt_at_rest`
// in the run CWD — each run uses a fresh empty `cwd`): migrate raises (exit 1),
// decrypt-all is a crypto-free `{decrypted: 0}`. pandoc export (pdf/docx) is
// NOT exercised — only `md` export, which is pure copy.
//
// Every case spawns with a **node-only PATH** (a temp dir holding just a `node`
// symlink) so the tsx launcher resolves but no host CLI / pandoc does, keeping
// detection deterministic regardless of the runner. COLUMNS=80 stabilizes
// usage wrapping.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'cli', 'python', 'workspace_documents.ts');
const TSX_BIN = path.resolve(
    REPO_ROOT,
    process.env['TSX_BIN'] ??
        path.join('node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx'),
);

// node-only PATH → deterministic regardless of installed host CLIs / pandoc.
const NODE_ONLY_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ws-docs-nodeonly-'));
fs.symlinkSync(process.execPath, path.join(NODE_ONLY_DIR, 'node'));
afterAll(() => {
    fs.rmSync(NODE_ONLY_DIR, { recursive: true, force: true });
});

interface RunResult {
    status: number | null;
    stdout: string;
    stderr: string;
}

let tsHome: string;
let cwd: string;

function docsRoot(home: string): string {
    return path.join(home, '.event4u', 'agent-config', 'workspace', 'documents');
}

function runTs(args: string[]): RunResult {
    const r = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], {
        encoding: 'utf8',
        cwd,
        env: { ...process.env, HOME: tsHome, PATH: NODE_ONLY_DIR, COLUMNS: '80' },
    });
    return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

/** Mask slug-day suffix / timestamps / mtime / HOME root. */
function norm(text: string, home: string): string {
    let out = text;
    out = out.split(home).join('<H>');
    let real = home;
    try {
        real = fs.realpathSync(home);
    } catch {
        /* removed */
    }
    out = out.split(real).join('<H>');
    out = out.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z/g, '<TS>'); // ISO sec/millis
    out = out.replace(/\d{4}-\d{2}-\d{2}/g, '<DAY>'); // slug day suffix
    out = out.replace(/"mtime": [0-9.]+/g, '"mtime": <M>'); // float mtime (if any leaks)
    return out;
}

function usageOnly(text: string): string {
    const out: string[] = [];
    for (const line of text.split('\n')) {
        if (out.length > 0 && line.trim() === '') break;
        out.push(line);
    }
    return out.join('\n');
}

function bodyFile(dir: string, content: string): string {
    const p = path.join(dir, `body-${Math.random().toString(16).slice(2)}.txt`);
    fs.writeFileSync(p, content);
    return p;
}

/** Pull the slug out of a `create` JSON line. */
function slugOf(stdout: string): string {
    return (JSON.parse(stdout) as { slug: string }).slug;
}

beforeEach(() => {
    tsHome = fs.mkdtempSync(path.join(os.tmpdir(), 'wsdoc-ts-'));
    cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'wsdoc-cwd-')); // no .agent-settings.yml
});
afterEach(() => {
    fs.rmSync(tsHome, { recursive: true, force: true });
    fs.rmSync(cwd, { recursive: true, force: true });
});

describe('workspace_documents — create + read + save', () => {
    it('create returns {slug, path}; slugify normalizes the title', () => {
        const tb = bodyFile(tsHome, 'Line one\nLine two\n');
        const t = runTs(['create', '--type', 'memo', '--title', 'Hello World!', '--body-file', tb, '--role', 'sales']);
        expect(t.status).toBe(0);
        expect(norm(t.stdout, tsHome)).toMatchInlineSnapshot(`
          "{"path": "<H>/.event4u/agent-config/workspace/documents/memo/hello-world-<DAY>.md", "slug": "hello-world-<DAY>"}
          "
        `);
    });

    it('read returns the document body (frontmatter stripped)', () => {
        const tb = bodyFile(tsHome, 'Alpha\nBeta\n');
        const ts = slugOf(runTs(['create', '--type', 'brief', '--title', 'Doc', '--body-file', tb]).stdout);
        const t = runTs(['read', 'brief', ts]);
        expect(t.status).toBe(0);
        expect(norm(t.stdout, tsHome)).toMatchInlineSnapshot(`
          "Alpha
          Beta

          "
        `);
    });

    it('read missing document → stderr + exit 1', () => {
        const t = runTs(['read', 'memo', 'nope']);
        expect(t.status).toBe(1);
        expect(t.stdout).toMatchInlineSnapshot(`""`);
        expect(norm(t.stderr, tsHome)).toMatchInlineSnapshot(`
          "no such document: memo/nope
          "
        `);
    });

    it('save records a revision (added/removed delta + body_sha256)', () => {
        const tb = bodyFile(tsHome, 'A\nB\n');
        const ts = slugOf(runTs(['create', '--type', 'memo', '--title', 'D', '--body-file', tb]).stdout);
        const nb = bodyFile(cwd, 'A\nB\nC\nD\n');
        const t = runTs(['save', 'memo', ts, '--body-file', nb, '--actor', 'user']);
        expect(t.status).toBe(0);
        expect(norm(t.stdout, tsHome)).toMatchInlineSnapshot(`
          "{"actor": "user", "body_sha256": "a7f5cf19fdb779272b12bed17134c60d18d464fddfda599b8a70fdc5cab185d1", "delta": {"added": 2, "removed": 0}, "kind": "save", "ts": "<TS>"}
          "
        `);
    });

    it('save shrinking body records a removed delta', () => {
        const tb = bodyFile(tsHome, 'one\ntwo\nthree\n');
        const ts = slugOf(runTs(['create', '--type', 'memo', '--title', 'S', '--body-file', tb]).stdout);
        const nb = bodyFile(cwd, 'one\n');
        const t = runTs(['save', 'memo', ts, '--body-file', nb]);
        expect(norm(t.stdout, tsHome)).toMatchInlineSnapshot(`
          "{"actor": "user", "body_sha256": "2c8b08da5ce60398e1f19af0e5dccc744df274b826abe585eaba68c525434806", "delta": {"added": 0, "removed": 2}, "kind": "save", "ts": "<TS>"}
          "
        `);
    });
});

describe('workspace_documents — secret guard', () => {
    it('high-confidence secret in body → refused, exit 3', () => {
        const sec = bodyFile(cwd, 'aws key AKIAIOSFODNN7EXAMPLE here\n');
        const t = runTs(['create', '--type', 'memo', '--title', 'X', '--body-file', sec]);
        expect(t.status).toBe(3);
        expect(t.stdout).toMatchInlineSnapshot(`""`);
        expect(norm(t.stderr, tsHome)).toMatchInlineSnapshot(`
          "workspace_documents: refused — high-confidence secret (aws_access_key) detected in body; redact it before saving — the document was NOT written
          "
        `);
    });

    it('fuzzy secret in body → warns on stderr, still writes (normalized)', () => {
        const tb = bodyFile(tsHome, 'password: hunter2hunter2xx\n');
        const t = runTs(['create', '--type', 'memo', '--title', 'F', '--body-file', tb]);
        expect(t.status).toBe(0);
        expect(norm(t.stderr, tsHome)).toMatchInlineSnapshot(`
          "workspace_documents: warning — possible secret (kv_secret) in body; review before sharing
          "
        `);
        expect(norm(t.stdout, tsHome)).toMatchInlineSnapshot(`
          "{"path": "<H>/.event4u/agent-config/workspace/documents/memo/f-<DAY>.md", "slug": "f-<DAY>"}
          "
        `);
    });
});

describe('workspace_documents — list + export', () => {
    it('list --json (single doc, normalized updated_at / mtime)', () => {
        const tb = bodyFile(tsHome, 'x\n');
        runTs(['create', '--type', 'memo', '--title', 'One', '--body-file', tb, '--role', 'sales']);
        const t = runTs(['list', '--type', 'memo', '--root', docsRoot(tsHome), '--json']);
        expect(t.status).toBe(0);
        expect(norm(t.stdout, tsHome)).toMatchInlineSnapshot(`
          "[{"last_edited_at": "<TS>", "path": "<H>/.event4u/agent-config/workspace/documents/memo/one-<DAY>.md", "role": "sales", "slug": "one-<DAY>", "title": "One", "type": "memo", "updated_at": "<TS>"}]
          "
        `);
    });

    it('list --role filter (per-line JSON)', () => {
        const tb = bodyFile(tsHome, 'x\n');
        runTs(['create', '--type', 'memo', '--title', 'Sales', '--body-file', tb, '--role', 'sales']);
        const t = runTs(['list', '--role', 'support', '--root', docsRoot(tsHome)]);
        expect(t.status).toBe(0);
        expect(t.stdout).toMatchInlineSnapshot(`""`); // empty (filtered out)
    });

    it('list empty root → empty', () => {
        const t = runTs(['list', '--root', docsRoot(tsHome)]);
        expect(t.status).toBe(0);
        expect(t.stdout).toMatchInlineSnapshot(`""`);
    });

    it('export md writes cleartext (compare exported file content)', () => {
        const tb = bodyFile(tsHome, 'Exported body\n');
        const ts = slugOf(runTs(['create', '--type', 'memo', '--title', 'E', '--body-file', tb]).stdout);
        const tOut = fs.mkdtempSync(path.join(os.tmpdir(), 'exp-ts-'));
        runTs(['export', 'memo', ts, '--to', tOut, '--format', 'md']);
        const tTxt = fs.readFileSync(path.join(tOut, `${ts}.md`), 'utf8');
        expect(norm(tTxt, tsHome)).toMatchInlineSnapshot(`
          "---
          type: memo
          title: E
          created_at: <TS>
          last_edited_at: <TS>
          schema: workspace-document/v0
          ---

          Exported body
          "
        `);
        fs.rmSync(tOut, { recursive: true, force: true });
    });
});

describe('workspace_documents — encryption-at-rest defaults (flag off)', () => {
    it('migrate with flag off → exit 1 (RuntimeError)', () => {
        const t = runTs(['migrate', '--root', docsRoot(tsHome)]);
        expect(t.status).toBe(1);
    });

    it('decrypt-all on plaintext store → {"decrypted": 0}', () => {
        const tb = bodyFile(tsHome, 'x\n');
        runTs(['create', '--type', 'memo', '--title', 'D', '--body-file', tb]);
        const t = runTs(['decrypt-all', '--root', docsRoot(tsHome)]);
        expect(t.status).toBe(0);
        expect(t.stdout).toMatchInlineSnapshot(`
          "{"decrypted": 0}
          "
        `);
    });
});

describe('workspace_documents — argparse errors', () => {
    it('no args → required cmd, exit 2', () => {
        expect(runTs([])).toMatchInlineSnapshot(`
          {
            "status": 2,
            "stderr": "usage: workspace_documents [-h]
                                     {create,save,list,read,export,migrate,decrypt-all,rekey}
                                     ...
          workspace_documents: error: the following arguments are required: cmd
          ",
            "stdout": "",
          }
        `);
    });
    it('bad subcommand → invalid choice, exit 2', () => {
        expect(runTs(['bogus'])).toMatchInlineSnapshot(`
          {
            "status": 2,
            "stderr": "usage: workspace_documents [-h]
                                     {create,save,list,read,export,migrate,decrypt-all,rekey}
                                     ...
          workspace_documents: error: argument cmd: invalid choice: 'bogus' (choose from 'create', 'save', 'list', 'read', 'export', 'migrate', 'decrypt-all', 'rekey')
          ",
            "stdout": "",
          }
        `);
    });
    it('create missing required flags → exit 2', () => {
        expect(runTs(['create'])).toMatchInlineSnapshot(`
          {
            "status": 2,
            "stderr": "usage: workspace_documents create [-h] --type TYPE --title TITLE --body-file
                                            BODY_FILE [--role ROLE] [--session SESSION]
                                            [--prompt PROMPT]
          workspace_documents create: error: the following arguments are required: --type, --title, --body-file
          ",
            "stdout": "",
          }
        `);
    });
    it('save missing positionals + flag → exit 2 (type, slug, --body-file order)', () => {
        expect(runTs(['save'])).toMatchInlineSnapshot(`
          {
            "status": 2,
            "stderr": "usage: workspace_documents save [-h] --body-file BODY_FILE [--actor ACTOR]
                                          type slug
          workspace_documents save: error: the following arguments are required: type, slug, --body-file
          ",
            "stdout": "",
          }
        `);
    });
    it('save missing slug + flag → exit 2', () => {
        expect(runTs(['save', 'memo'])).toMatchInlineSnapshot(`
          {
            "status": 2,
            "stderr": "usage: workspace_documents save [-h] --body-file BODY_FILE [--actor ACTOR]
                                          type slug
          workspace_documents save: error: the following arguments are required: slug, --body-file
          ",
            "stdout": "",
          }
        `);
    });
    it('read missing positionals → exit 2', () => {
        expect(runTs(['read'])).toMatchInlineSnapshot(`
          {
            "status": 2,
            "stderr": "usage: workspace_documents read [-h] type slug
          workspace_documents read: error: the following arguments are required: type, slug
          ",
            "stdout": "",
          }
        `);
    });
    it('export missing positionals + --to → exit 2 (type, slug, --to order)', () => {
        expect(runTs(['export'])).toMatchInlineSnapshot(`
          {
            "status": 2,
            "stderr": "usage: workspace_documents export [-h] --to TO [--format FORMAT] type slug
          workspace_documents export: error: the following arguments are required: type, slug, --to
          ",
            "stdout": "",
          }
        `);
    });
    it('list bad --limit int → exit 2', () => {
        expect(runTs(['list', '--limit', 'abc'])).toMatchInlineSnapshot(`
          {
            "status": 2,
            "stderr": "usage: workspace_documents list [-h] [--type TYPE] [--role ROLE]
                                          [--limit LIMIT] [--root ROOT] [--json]
          workspace_documents list: error: argument --limit: invalid int value: 'abc'
          ",
            "stdout": "",
          }
        `);
    });
    it.each([
        ['create'],
        ['save'],
        ['list'],
        ['read'],
        ['export'],
        ['migrate'],
        ['decrypt-all'],
        ['rekey'],
    ])('%s -h usage line', (sub) => {
        const t = runTs([sub, '-h']);
        expect(t.status).toBe(0);
        expect(usageOnly(t.stdout)).toMatchSnapshot();
    });
});
