// Golden-parity tests for src/cli/python/workspace_documents.ts (py2ts ADR-200
// — local workspace document store, workspace-documents.md).
//
// Strategy: run `python3 workspace_documents.py` vs `tsx workspace_documents.ts`
// and byte-compare stdout / stderr / exit. `create`/`save`/`read`/`export` have
// NO `--root` flag — they write under `$HOME/.event4u/.../documents/<type>/` —
// so each language runs under a SEPARATE hermetic `HOME`; `list`/`migrate`/
// `decrypt-all`/`rekey` take an explicit `--root` (`<HOME>/.../documents`).
// `norm()` masks the nondeterministic surfaces: the `<DAY>` slug suffix
// (`<today>`), the `created_at`/`last_edited_at` ISO second, the `updated_at`
// ISO-millis, the float `mtime`, and the HOME tmp root — leaving the structural
// payload (slug, frontmatter, delta counts, body_sha256, listing shape) a true
// byte-for-byte assertion. body_sha256 is content-derived, hence identical.
//
// Encryption-at-rest defaults OFF (no `.agent-settings.yml → encrypt_at_rest`
// in the run CWD): migrate raises (exit 1 both sides), decrypt-all is a
// crypto-free `{decrypted: 0}`. The `--help` BODY is NOT byte-compared (only
// the `usage:` line); Python runs force COLUMNS=80. pandoc export (pdf/docx) is
// NOT exercised — only `md` export, which is pure copy.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'cli', 'python', 'workspace_documents.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'cli', 'python', 'workspace_documents.py');
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

const COLS80 = { COLUMNS: '80' };

let pyHome: string;
let tsHome: string;
let cwd: string;

function docsRoot(home: string): string {
    return path.join(home, '.event4u', 'agent-config', 'workspace', 'documents');
}

function runPy(args: string[]): RunResult {
    const r = spawnSync('python3', [PY_SCRIPT, ...args], {
        encoding: 'utf8',
        cwd,
        env: { ...process.env, HOME: pyHome, PYTHONPATH: path.join(REPO_ROOT, 'src'), ...COLS80 },
    });
    return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

function runTs(args: string[]): RunResult {
    const r = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], {
        encoding: 'utf8',
        cwd,
        env: { ...process.env, HOME: tsHome, ...COLS80 },
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

function expectParityExact(args: string[]): void {
    const p = runPy(args);
    const t = runTs(args);
    expect(t.status).toBe(p.status);
    expect(t.stdout).toBe(p.stdout);
    expect(t.stderr).toBe(p.stderr);
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
    pyHome = fs.mkdtempSync(path.join(os.tmpdir(), 'wsdoc-py-'));
    tsHome = fs.mkdtempSync(path.join(os.tmpdir(), 'wsdoc-ts-'));
    cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'wsdoc-cwd-')); // no .agent-settings.yml
});
afterEach(() => {
    fs.rmSync(pyHome, { recursive: true, force: true });
    fs.rmSync(tsHome, { recursive: true, force: true });
    fs.rmSync(cwd, { recursive: true, force: true });
});

describe.skipIf(!py3)('workspace_documents — create + read + save', () => {
    it('create returns {slug, path}; slugify normalizes the title', () => {
        const pb = bodyFile(pyHome, 'Line one\nLine two\n');
        const tb = bodyFile(tsHome, 'Line one\nLine two\n');
        const p = runPy(['create', '--type', 'memo', '--title', 'Hello World!', '--body-file', pb, '--role', 'sales']);
        const t = runTs(['create', '--type', 'memo', '--title', 'Hello World!', '--body-file', tb, '--role', 'sales']);
        expect(t.status).toBe(p.status);
        expect(norm(t.stdout, tsHome)).toBe(norm(p.stdout, pyHome));
    });

    it('read returns the document body (frontmatter stripped)', () => {
        const pb = bodyFile(pyHome, 'Alpha\nBeta\n');
        const tb = bodyFile(tsHome, 'Alpha\nBeta\n');
        const ps = slugOf(runPy(['create', '--type', 'brief', '--title', 'Doc', '--body-file', pb]).stdout);
        const ts = slugOf(runTs(['create', '--type', 'brief', '--title', 'Doc', '--body-file', tb]).stdout);
        const p = runPy(['read', 'brief', ps]);
        const t = runTs(['read', 'brief', ts]);
        expect(t.status).toBe(p.status);
        expect(norm(t.stdout, tsHome)).toBe(norm(p.stdout, pyHome));
    });

    it('read missing document → stderr + exit 1', () => {
        const p = runPy(['read', 'memo', 'nope']);
        const t = runTs(['read', 'memo', 'nope']);
        expect(t.status).toBe(p.status);
        expect(t.stdout).toBe(p.stdout);
        expect(t.stderr).toBe(p.stderr); // names the missing slug (deterministic)
    });

    it('save records a revision (added/removed delta + body_sha256)', () => {
        const pb = bodyFile(pyHome, 'A\nB\n');
        const tb = bodyFile(tsHome, 'A\nB\n');
        const ps = slugOf(runPy(['create', '--type', 'memo', '--title', 'D', '--body-file', pb]).stdout);
        const ts = slugOf(runTs(['create', '--type', 'memo', '--title', 'D', '--body-file', tb]).stdout);
        const nb = bodyFile(cwd, 'A\nB\nC\nD\n');
        const p = runPy(['save', 'memo', ps, '--body-file', nb, '--actor', 'user']);
        const t = runTs(['save', 'memo', ts, '--body-file', nb, '--actor', 'user']);
        expect(t.status).toBe(p.status);
        expect(norm(t.stdout, tsHome)).toBe(norm(p.stdout, pyHome));
    });

    it('save shrinking body records a removed delta', () => {
        const pb = bodyFile(pyHome, 'one\ntwo\nthree\n');
        const tb = bodyFile(tsHome, 'one\ntwo\nthree\n');
        const ps = slugOf(runPy(['create', '--type', 'memo', '--title', 'S', '--body-file', pb]).stdout);
        const ts = slugOf(runTs(['create', '--type', 'memo', '--title', 'S', '--body-file', tb]).stdout);
        const nb = bodyFile(cwd, 'one\n');
        const p = runPy(['save', 'memo', ps, '--body-file', nb]);
        const t = runTs(['save', 'memo', ts, '--body-file', nb]);
        expect(norm(t.stdout, tsHome)).toBe(norm(p.stdout, pyHome));
    });
});

describe.skipIf(!py3)('workspace_documents — secret guard', () => {
    it('high-confidence secret in body → refused, exit 3, identical message', () => {
        const sec = bodyFile(cwd, 'aws key AKIAIOSFODNN7EXAMPLE here\n');
        const p = runPy(['create', '--type', 'memo', '--title', 'X', '--body-file', sec]);
        const t = runTs(['create', '--type', 'memo', '--title', 'X', '--body-file', sec]);
        expect(t.status).toBe(3);
        expect(p.status).toBe(3);
        expect(t.stdout).toBe(p.stdout); // empty
        expect(t.stderr).toBe(p.stderr); // "refused — high-confidence secret (aws_access_key) ..."
    });

    it('fuzzy secret in body → warns on stderr, still writes (normalized)', () => {
        const pb = bodyFile(pyHome, 'password: hunter2hunter2xx\n');
        const tb = bodyFile(tsHome, 'password: hunter2hunter2xx\n');
        const p = runPy(['create', '--type', 'memo', '--title', 'F', '--body-file', pb]);
        const t = runTs(['create', '--type', 'memo', '--title', 'F', '--body-file', tb]);
        expect(t.status).toBe(p.status); // 0 / 0
        expect(t.stderr).toBe(p.stderr); // identical warning line
        expect(norm(t.stdout, tsHome)).toBe(norm(p.stdout, pyHome));
    });
});

describe.skipIf(!py3)('workspace_documents — list + export', () => {
    it('list --json (single doc, normalized updated_at / mtime)', () => {
        const pb = bodyFile(pyHome, 'x\n');
        const tb = bodyFile(tsHome, 'x\n');
        runPy(['create', '--type', 'memo', '--title', 'One', '--body-file', pb, '--role', 'sales']);
        runTs(['create', '--type', 'memo', '--title', 'One', '--body-file', tb, '--role', 'sales']);
        const p = runPy(['list', '--type', 'memo', '--root', docsRoot(pyHome), '--json']);
        const t = runTs(['list', '--type', 'memo', '--root', docsRoot(tsHome), '--json']);
        expect(t.status).toBe(p.status);
        expect(norm(t.stdout, tsHome)).toBe(norm(p.stdout, pyHome));
    });

    it('list --role filter (per-line JSON)', () => {
        const pb = bodyFile(pyHome, 'x\n');
        const tb = bodyFile(tsHome, 'x\n');
        runPy(['create', '--type', 'memo', '--title', 'Sales', '--body-file', pb, '--role', 'sales']);
        runTs(['create', '--type', 'memo', '--title', 'Sales', '--body-file', tb, '--role', 'sales']);
        const p = runPy(['list', '--role', 'support', '--root', docsRoot(pyHome)]);
        const t = runTs(['list', '--role', 'support', '--root', docsRoot(tsHome)]);
        expect(t.status).toBe(p.status);
        expect(t.stdout).toBe(p.stdout); // both empty (filtered out)
    });

    it('list empty root → empty', () => {
        const p = runPy(['list', '--root', docsRoot(pyHome)]);
        const t = runTs(['list', '--root', docsRoot(tsHome)]);
        expect(t.status).toBe(p.status);
        expect(t.stdout).toBe(p.stdout);
    });

    it('export md writes cleartext (compare exported file content)', () => {
        const pb = bodyFile(pyHome, 'Exported body\n');
        const tb = bodyFile(tsHome, 'Exported body\n');
        const ps = slugOf(runPy(['create', '--type', 'memo', '--title', 'E', '--body-file', pb]).stdout);
        const ts = slugOf(runTs(['create', '--type', 'memo', '--title', 'E', '--body-file', tb]).stdout);
        const pOut = fs.mkdtempSync(path.join(os.tmpdir(), 'exp-py-'));
        const tOut = fs.mkdtempSync(path.join(os.tmpdir(), 'exp-ts-'));
        runPy(['export', 'memo', ps, '--to', pOut, '--format', 'md']);
        runTs(['export', 'memo', ts, '--to', tOut, '--format', 'md']);
        const pTxt = fs.readFileSync(path.join(pOut, `${ps}.md`), 'utf8');
        const tTxt = fs.readFileSync(path.join(tOut, `${ts}.md`), 'utf8');
        expect(norm(tTxt, tsHome)).toBe(norm(pTxt, pyHome));
        fs.rmSync(pOut, { recursive: true, force: true });
        fs.rmSync(tOut, { recursive: true, force: true });
    });
});

describe.skipIf(!py3)('workspace_documents — encryption-at-rest defaults (flag off)', () => {
    it('migrate with flag off → exit 1 (RuntimeError both sides)', () => {
        const p = runPy(['migrate', '--root', docsRoot(pyHome)]);
        const t = runTs(['migrate', '--root', docsRoot(tsHome)]);
        expect(t.status).toBe(p.status); // 1 / 1
    });

    it('decrypt-all on plaintext store → {"decrypted": 0}', () => {
        const pb = bodyFile(pyHome, 'x\n');
        const tb = bodyFile(tsHome, 'x\n');
        runPy(['create', '--type', 'memo', '--title', 'D', '--body-file', pb]);
        runTs(['create', '--type', 'memo', '--title', 'D', '--body-file', tb]);
        const p = runPy(['decrypt-all', '--root', docsRoot(pyHome)]);
        const t = runTs(['decrypt-all', '--root', docsRoot(tsHome)]);
        expect(t.status).toBe(p.status);
        expect(t.stdout).toBe(p.stdout); // {"decrypted": 0}
    });
});

describe.skipIf(!py3)('workspace_documents — argparse errors', () => {
    it('no args → required cmd, exit 2', () => {
        expectParityExact([]);
    });
    it('bad subcommand → invalid choice, exit 2', () => {
        expectParityExact(['bogus']);
    });
    it('create missing required flags → exit 2', () => {
        expectParityExact(['create']);
    });
    it('save missing positionals + flag → exit 2 (type, slug, --body-file order)', () => {
        expectParityExact(['save']);
    });
    it('save missing slug + flag → exit 2', () => {
        expectParityExact(['save', 'memo']);
    });
    it('read missing positionals → exit 2', () => {
        expectParityExact(['read']);
    });
    it('export missing positionals + --to → exit 2 (type, slug, --to order)', () => {
        expectParityExact(['export']);
    });
    it('list bad --limit int → exit 2', () => {
        expectParityExact(['list', '--limit', 'abc']);
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
    ])('%s -h usage line byte-matches', (sub) => {
        const p = runPy([sub, '-h']);
        const t = runTs([sub, '-h']);
        expect(t.status).toBe(p.status); // 0 / 0
        expect(usageOnly(t.stdout)).toBe(usageOnly(p.stdout));
    });
});
